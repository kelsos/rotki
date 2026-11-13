import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue';
import { type BigNumber, HistoricalAssetPriceResponse } from '@rotki/common';
import { startPromise } from '@shared/utils';
import { map as mapResult } from 'plainfp/result';
import { msg } from '@/message-key';
import { priceBackfillActivity } from '@/modules/assets/prices/prices.activity';
import { useHistoricPriceCache } from '@/modules/assets/prices/use-historic-price-cache';
import { useAssetInfoRetrieval } from '@/modules/assets/use-asset-info-retrieval';
import { logger } from '@/modules/core/common/logging/logging';
import { HistoricPriceBackfill } from '@/modules/settings/types/frontend-settings';
import { useSetting } from '@/modules/settings/use-setting';
import { useStatisticsApi } from '@/modules/statistics/api/use-statistics-api';
import { nextPacing } from '@/modules/statistics/pricing/backfill-pacing';
import { type BackfillAsset, type BackfillRange, type BackfillRequest, planBackfill } from '@/modules/statistics/pricing/backfill-plan';
import { knownPrices } from '@/modules/statistics/pricing/price-series';
import { PricePair, usePriceSeriesStore } from '@/modules/statistics/pricing/use-price-series-store';
import { activityLabelFor } from '@/modules/task-center/activity-labels';
import { ActivityKind, ActivityPart } from '@/modules/task-center/core/types';
import { useNativeTask } from '@/modules/task-center/use-native-task';
import { useTaskCenter } from '@/modules/task-center/use-task-center';

/** How many planned requests are looked at to find one not tried yet. */
const PLAN_LOOKAHEAD = 20;

/** What a chart needs priced: its range and how much of each asset it shows at most. */
export interface BackfillDemand {
  readonly range: BackfillRange;
  readonly holdings: readonly { readonly asset: string; readonly heldValue: BigNumber }[];
}

type RequestResult = 'ok' | 'rate-limited';

interface UsePriceBackfillReturn {
  /** Adds a chart's demand for as long as the calling scope lives. */
  readonly register: (id: string, demand: MaybeRefOrGetter<BackfillDemand | undefined>) => void;
  /** Fetches the missing prices of one registered chart at the manual pace. */
  readonly fetchMissing: (id: string) => void;
  /** Stops the current run; automatic mode resumes when its conditions next change. */
  readonly stop: () => void;
  readonly automatic: ComputedRef<boolean>;
  readonly running: Readonly<Ref<boolean>>;
  /** The chart a manual run is fetching for, if one is. */
  readonly manualTarget: Readonly<Ref<string | undefined>>;
  /** Requests completed since the app started. */
  readonly completed: Readonly<Ref<number>>;
}

function requestKey(request: BackfillRequest): string {
  return `${request.asset}:${request.fromTimestamp}:${request.toTimestamp}:${request.interval}`;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetches the graphs' missing historic prices from the oracles, one small request at a time.
 *
 * @remarks
 * One queue serves every chart that registered a demand. Each step asks {@link planBackfill} for
 * the request most worth making (anchors first, then the gap whose price moved most) and waits
 * between requests: {@link nextPacing} sets the pace and backs off on rate limits.
 *
 * Two triggers share it. With the `historicPriceBackfill` setting on automatic it trickles in the
 * background, paused while the window is in the background or a sync or another price fetch runs.
 * `fetchMissing` runs it for one chart at the faster manual pace, whatever the setting.
 *
 * Prices it gets go to the price series store, so every chart showing the asset sharpens. Times the
 * backend has no price for join `failedDailyPrices` and are not asked again this session.
 */
export const usePriceBackfill = createSharedComposable((): UsePriceBackfillReturn => {
  const { t } = useI18n({ useScope: 'global' });
  const mode = useSetting('historicPriceBackfill');
  const currencySymbol = useSetting('currencySymbol');
  const store = usePriceSeriesStore();
  const { mainPrices, usdPrices } = storeToRefs(store);
  const { failedDailyPrices } = useHistoricPriceCache();
  const { queryHistoricalAssetPrices } = useStatisticsApi();
  const { cancelByPrefix, submitTask } = useNativeTask();
  const { useIsActivePrefix } = useTaskCenter();
  const { getAssetField } = useAssetInfoRetrieval();
  const focused = useWindowFocus();

  const demands = shallowRef<ReadonlyMap<string, MaybeRefOrGetter<BackfillDemand | undefined>>>(new Map());
  const running = ref<boolean>(false);
  const manualTarget = ref<string>();
  const completed = ref<number>(0);
  const attempted = new Set<string>();
  let generation = 0;
  let backoff = 0;

  const automatic = computed<boolean>(() => get(mode) === HistoricPriceBackfill.AUTOMATIC);
  const syncing = useIsActivePrefix(ActivityKind.HISTORY_SYNC);
  const fetchingDaily = useIsActivePrefix(ActivityKind.PRICES, ActivityPart.DAILY);
  const canTrickle = computed<boolean>(() => get(automatic) && get(focused) && !get(syncing) && !get(fetchingDaily));

  function backfillAssets(demand: BackfillDemand): BackfillAsset[] {
    const failed = get(failedDailyPrices);
    const usdToMain = get(mainPrices).USD;
    const currency = get(currencySymbol);
    return demand.holdings.filter(({ asset }) => asset !== currency).map(({ asset, heldValue }) => ({
      asset,
      failed: failed[asset]?.noPricesTimestamps ?? [],
      heldValue,
      known: knownPrices({ direct: get(mainPrices)[asset] ?? [], usdToMain, viaUsd: get(usdPrices)[asset] }),
    }));
  }

  function nextRequest(): BackfillRequest | undefined {
    const target = get(manualTarget);
    const candidates: BackfillRequest[] = [];
    for (const [id, source] of get(demands)) {
      const demand = toValue(source);
      if (!demand || (target && id !== target))
        continue;
      const fresh = planBackfill(backfillAssets(demand), demand.range, PLAN_LOOKAHEAD)
        .find(request => !attempted.has(requestKey(request)));
      if (fresh)
        candidates.push(fresh);
    }
    return candidates.sort((a, b) => b.score - a.score)[0];
  }

  function recordFailures(asset: string, response: HistoricalAssetPriceResponse): void {
    if (response.noPricesTimestamps.length === 0)
      return;
    const current = get(failedDailyPrices);
    const previous = current[asset];
    set(failedDailyPrices, {
      ...current,
      [asset]: {
        noPricesTimestamps: [...new Set([...(previous?.noPricesTimestamps ?? []), ...response.noPricesTimestamps])],
        rateLimitedPricesTimestamps: response.rateLimitedPricesTimestamps,
      },
    });
  }

  async function runRequest(request: BackfillRequest, manual: boolean): Promise<RequestResult> {
    const subject = {
      asset: request.asset,
      fromTimestamp: request.fromTimestamp,
      interval: request.interval,
      toTimestamp: request.toTimestamp,
    };
    const outcome = await submitTask<HistoricalAssetPriceResponse>({
      id: priceBackfillActivity.id(subject),
      kind: priceBackfillActivity.kind,
      run: async ({ runTask }) => mapResult(
        await runTask<HistoricalAssetPriceResponse>(async () => queryHistoricalAssetPrices({
          ...subject,
          excludeTimestamps: request.excludeTimestamps,
        })),
        result => HistoricalAssetPriceResponse.parse(result),
      ),
      subtitle: activityLabelFor(msg.$t('task_center.activity.prices.backfill'), { asset: getAssetField(request.asset, 'name') }),
      title: t('task_center.group.prices'),
      userStarted: manual,
    });

    if (!outcome.ok) {
      logger.error(outcome.error.message);
      return 'rate-limited';
    }
    const response = outcome.value;
    store.addPrices(PricePair.MAIN, request.asset, Object.entries(response.prices)
      .filter(([, price]) => price.gt(0))
      .map(([time, price]) => ({ price, time: Number(time) })));
    recordFailures(request.asset, response);
    set(completed, get(completed) + 1);
    return response.rateLimitedPricesTimestamps.length > 0 ? 'rate-limited' : 'ok';
  }

  /** Whether `run` is still the live loop; `stop` and a new manual run retire older ones. */
  function isCurrent(run: number): boolean {
    return run === generation;
  }

  async function loop(run: number): Promise<void> {
    const startedManual = isDefined(manualTarget);
    while (isCurrent(run)) {
      const manual = isDefined(manualTarget);
      const request = manual || get(canTrickle) ? nextRequest() : undefined;
      if (!request)
        break;
      const key = requestKey(request);
      attempted.add(key);
      const result = await runRequest(request, manual);
      if (result === 'rate-limited')
        attempted.delete(key);
      const pacing = nextPacing(manual, result === 'rate-limited', backoff);
      backoff = pacing.backoff;
      await sleep(pacing.delay);
    }
    if (!isCurrent(run))
      return;
    set(running, false);
    set(manualTarget, undefined);
    if (startedManual)
      wake();
  }

  function wake(): void {
    if (get(running) || (!isDefined(manualTarget) && !get(canTrickle)))
      return;
    set(running, true);
    startPromise(loop(++generation));
  }

  function stop(): void {
    generation += 1;
    set(running, false);
    set(manualTarget, undefined);
    cancelByPrefix(priceBackfillActivity.kind, ...priceBackfillActivity.partsWithin([]));
  }

  function register(id: string, demand: MaybeRefOrGetter<BackfillDemand | undefined>): void {
    set(demands, new Map([...get(demands), [id, demand]]));
    tryOnScopeDispose(() => {
      const next = new Map(get(demands));
      next.delete(id);
      set(demands, next);
      if (get(manualTarget) === id)
        stop();
    });
  }

  function fetchMissing(id: string): void {
    if (get(running) && !isDefined(manualTarget))
      stop();
    set(manualTarget, id);
    wake();
  }

  const demandValues = computed<(BackfillDemand | undefined)[]>(() => Array.from(get(demands).values(), demand => toValue(demand)));

  watch([canTrickle, demandValues], wake);

  return {
    automatic,
    completed: readonly(completed),
    fetchMissing,
    manualTarget: readonly(manualTarget),
    register,
    running: readonly(running),
    stop,
  };
});
