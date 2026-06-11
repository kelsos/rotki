import type { ComputedRef } from 'vue';
import { useHistoricCachePriceStore } from '@/modules/assets/prices/use-historic-cache-price-store';
import { useBalanceQueue } from '@/modules/balances/use-balance-queue';
import { useTaskStore } from '@/modules/core/tasks/use-task-store';
import { useHistoricalBalancesStore } from '@/modules/history/balances/use-historical-balances-store';
import { useHistoryRefreshStateStore } from '@/modules/history/use-history-refresh-state-store';
import { useReportsStore } from '@/modules/reports/use-reports-store';
import { useSyncProgress } from '@/modules/shell/sync-progress/use-sync-progress';
import { useLiquityStore } from '@/modules/staking/liquity/use-liquity-store';
import { assembleActivityModel } from './core/assemble';
import { ACTIVITY_ADAPTERS, type SourceContext } from './core/registry';
import { type Activity, type ActivityModel, type ActivityOverall, ActivityPhase, type TranslateFn } from './core/types';

interface UseTaskCenterReturn {
  model: ComputedRef<ActivityModel>;
  active: ComputedRef<Activity[]>;
  pending: ComputedRef<Activity[]>;
  current: ComputedRef<Activity | undefined>;
  overall: ComputedRef<ActivityOverall>;
  isActive: ComputedRef<boolean>;
}

/**
 * Reactive shell over the pure read model. The only Vue file in the read layer: it
 * builds the source context, then turns each adapter in {@link ACTIVITY_ADAPTERS} into a
 * dedicated computed (so a burst on one source only recomputes that source's adapter)
 * and assembles the result. All logic lives in the pure core; this file is wiring.
 */
export const useTaskCenter = createSharedComposable((): UseTaskCenterReturn => {
  const { t } = useI18n({ useScope: 'global' });
  const translate: TranslateFn = (key, params) => params ? t(key, params) : t(key);

  const { chains, decoding, locations, protocolCache } = useSyncProgress();
  const { queueItems } = useBalanceQueue();
  const historicalStore = useHistoricalBalancesStore();
  const priceStore = useHistoricCachePriceStore();
  const reportsStore = useReportsStore();
  const refreshStore = useHistoryRefreshStateStore();
  const liquityStore = useLiquityStore();
  const taskStore = useTaskStore();

  // Reactive sources as thunks; each adapter computed reads only the source it selects.
  const ctx: SourceContext = {
    balances: () => get(queueItems),
    chains: () => get(chains),
    decoding: () => get(decoding),
    historical: () => historicalStore.processingProgress,
    locations: () => get(locations),
    pendingKeys: () => [...refreshStore.pendingKeys],
    prices: () => ({
      daily: priceStore.historicalDailyPriceStatus,
      historical: priceStore.historicalPriceStatus,
      stats: priceStore.statsPriceQueryStatus,
    }),
    protocolCache: () => get(protocolCache),
    reportProgress: () => reportsStore.reportProgress,
    staking: () => liquityStore.stakingQueryStatus,
    tasks: () => taskStore.tasks,
  };

  const lists = ACTIVITY_ADAPTERS.map(descriptor => computed<Activity[]>(() => descriptor.run(ctx, translate)));
  const model = computed<ActivityModel>(() => assembleActivityModel(lists.flatMap(list => get(list)), translate));

  const active = computed<Activity[]>(() => get(model).active);
  const pending = computed<Activity[]>(() => get(model).pending);
  const current = computed<Activity | undefined>(() => get(model).current);
  const overall = computed<ActivityOverall>(() => get(model).overall);
  const isActive = computed<boolean>(() => get(model).overall.phase !== ActivityPhase.IDLE);

  return { active, current, isActive, model, overall, pending };
});
