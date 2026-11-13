import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue';
import type { NetValueChartData } from '@/modules/dashboard/graph/types';
import { type BigNumber, type ResolvedPrice, Zero } from '@rotki/common';
import { useAssetInfoRetrieval } from '@/modules/assets/use-asset-info-retrieval';
import { useHistoricalBalancesApi } from '@/modules/balances/api/use-historical-balances-api';
import { millisecondsToSeconds } from '@/modules/core/common/data/date';
import { logger } from '@/modules/core/common/logging/logging';
import { buildNetValueSeries, type DailyAmounts, isEstimatedPoint, type NetValuePoint } from '@/modules/statistics/pricing/net-value-series';
import { DAY_SECONDS } from '@/modules/statistics/pricing/price-series';
import { type BackfillDemand, usePriceBackfill } from '@/modules/statistics/pricing/use-price-backfill';
import { usePriceSeries } from '@/modules/statistics/pricing/use-price-series';

/** The backfill demand id of the dashboard's History chart. */
export const HISTORY_NET_VALUE_DEMAND = 'net-value-history';

const EMPTY: DailyAmounts = { amounts: [], times: [] };

interface UseHistoryNetValueReturn {
  readonly chartData: ComputedRef<NetValueChartData>;
  readonly points: ComputedRef<readonly NetValuePoint[]>;
  /** Assets valued at a stand-in price on at least one estimated point. */
  readonly estimatedAssets: ComputedRef<string[]>;
  /** Assets with no price at all on at least one point, left out of it. */
  readonly missingAssets: ComputedRef<string[]>;
  readonly loading: Readonly<Ref<boolean>>;
  /** Some events in the range are not processed yet, so the amounts may change. */
  readonly processingRequired: Readonly<Ref<boolean>>;
  readonly error: Readonly<Ref<string | undefined>>;
  readonly refresh: () => Promise<void>;
}

function largestValue(daily: DailyAmounts, asset: string, prices: readonly ResolvedPrice[] | undefined): BigNumber {
  let largest = Zero;
  for (const [index, holdings] of daily.amounts.entries()) {
    const price = prices?.[index]?.price;
    const amount = holdings[asset];
    if (price && amount) {
      const value = amount.multipliedBy(price).abs();
      if (value.gt(largest))
        largest = value;
    }
  }
  return largest;
}

function unionOf(points: readonly NetValuePoint[], pick: (point: NetValuePoint) => readonly string[]): string[] {
  return [...new Set(points.flatMap(pick))];
}

/**
 * The dashboard net value chart for the History view: each day's holdings from processed history,
 * priced at that day's prices.
 *
 * @remarks
 * Amounts come from `/balances/historical/netvalue`, prices from {@link usePriceSeries}, so gaps
 * are filled and flagged the same way as everywhere else. Spam assets are left out. The last point
 * is the History net worth now, so the line ends where the headline does. History points are not
 * snapshots, so `snapshotCount` is zero and clicking one opens nothing.
 *
 * While enabled, the chart registers a backfill demand weighted by each asset's largest value in
 * the range, so the backfill refines the holdings that move the line most.
 *
 * @param startingDate - first day of the range, unix seconds
 * @param enabled - whether the History view is showing; nothing is fetched otherwise
 * @param currentNetWorth - the History net worth now, in the main currency
 * @param demandId - the backfill demand to register under; each chart showing at once needs its own
 */
export function useHistoryNetValue(
  startingDate: MaybeRefOrGetter<number>,
  enabled: MaybeRefOrGetter<boolean>,
  currentNetWorth: MaybeRefOrGetter<BigNumber>,
  demandId: string = HISTORY_NET_VALUE_DEMAND,
): UseHistoryNetValueReturn {
  const { fetchHistoricalNetValue } = useHistoricalBalancesApi();
  const { getAssetInfo } = useAssetInfoRetrieval();

  const daily = shallowRef<DailyAmounts>(EMPTY);
  const loading = shallowRef<boolean>(false);
  const processingRequired = shallowRef<boolean>(false);
  const error = ref<string>();
  let request = 0;

  /** The fetched amounts without spam, which is never priced or charted. */
  const holdings = computed<DailyAmounts>(() => {
    const { amounts, times } = get(daily);
    return {
      amounts: amounts.map(day => Object.fromEntries(Object.entries(day).filter(([asset]) => !getAssetInfo(asset)?.isSpam))),
      times,
    };
  });

  const assets = computed<string[]>(() => [...new Set(get(holdings).amounts.flatMap(day => Object.keys(day)))]);
  const times = computed<readonly number[]>(() => get(holdings).times);
  const { series } = usePriceSeries(assets, times);

  const points = computed<readonly NetValuePoint[]>(() => buildNetValueSeries(get(holdings), get(series)));

  const chartData = computed<NetValueChartData>(() => {
    const now = millisecondsToSeconds(Date.now());
    const current = toValue(currentNetWorth);
    const dayPoints = get(points);
    if (dayPoints.length === 0)
      return { data: [Zero, current], estimated: [false, false], missing: [false, false], snapshotCount: 0, times: [now - DAY_SECONDS, now] };
    return {
      data: [...dayPoints.map(point => point.value ?? Zero), current],
      estimated: [...dayPoints.map(point => isEstimatedPoint(point)), false],
      missing: [...dayPoints.map(point => point.value === null), false],
      snapshotCount: 0,
      times: [...dayPoints.map(point => point.time), now],
    };
  });

  const estimatedAssets = computed<string[]>(() => unionOf(get(points).filter(point => isEstimatedPoint(point)), point => point.estimatedAssets));
  const missingAssets = computed<string[]>(() => unionOf(get(points), point => point.missingAssets));

  const demand = computed<BackfillDemand | undefined>(() => {
    const dayTimes = get(times);
    if (!toValue(enabled) || dayTimes.length < 2)
      return undefined;
    const current = get(holdings);
    const resolved = get(series);
    return {
      holdings: get(assets).map(asset => ({ asset, heldValue: largestValue(current, asset, resolved.get(asset)) })),
      range: { end: dayTimes.at(-1) ?? 0, start: dayTimes[0] },
    };
  });

  usePriceBackfill().register(demandId, demand);

  async function refresh(): Promise<void> {
    if (!toValue(enabled))
      return;
    const current = ++request;
    set(loading, true);
    try {
      const response = await fetchHistoricalNetValue(toValue(startingDate), millisecondsToSeconds(Date.now()));
      if (current !== request)
        return;
      set(daily, { amounts: response.values, times: response.times });
      set(processingRequired, response.processingRequired);
      set(error, undefined);
    }
    catch (error_: unknown) {
      if (current !== request)
        return;
      logger.error(error_);
      set(error, error_ instanceof Error ? error_.message : String(error_));
    }
    finally {
      if (current === request)
        set(loading, false);
    }
  }

  watchImmediate([(): number => toValue(startingDate), (): boolean => toValue(enabled)], async () => refresh());

  return {
    chartData,
    error: readonly(error),
    estimatedAssets,
    loading: readonly(loading),
    missingAssets,
    points,
    processingRequired: readonly(processingRequired),
    refresh,
  };
}
