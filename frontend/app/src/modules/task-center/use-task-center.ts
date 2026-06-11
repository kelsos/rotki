import type { ComputedRef } from 'vue';
import { useBalanceQueue } from '@/modules/balances/use-balance-queue';
import { useTaskStore } from '@/modules/core/tasks/use-task-store';
import { useSyncProgress } from '@/modules/shell/sync-progress/use-sync-progress';
import { backendTaskActivities } from './core/adapters/backend-task';
import { balanceActivities } from './core/adapters/balances';
import { decodingActivities } from './core/adapters/decoding';
import { exchangeEventsActivities } from './core/adapters/exchange-events';
import { protocolCacheActivities } from './core/adapters/protocol-cache';
import { txSyncActivities } from './core/adapters/tx-sync';
import { assembleActivityModel } from './core/assemble';
import { type Activity, type ActivityModel, ActivityPhase, type TranslateFn } from './core/types';

interface UseTaskCenterReturn {
  model: ComputedRef<ActivityModel>;
  active: ComputedRef<Activity[]>;
  pending: ComputedRef<Activity[]>;
  current: ComputedRef<Activity | undefined>;
  isActive: ComputedRef<boolean>;
}

/**
 * Reactive shell over the pure read model. The only Vue file in the read layer: it
 * wires each source into its pure adapter via a dedicated computed (so a burst on one
 * source only recomputes that source) and assembles the result. All logic lives in
 * the pure core; this file is wiring.
 */
export const useTaskCenter = createSharedComposable((): UseTaskCenterReturn => {
  const { t } = useI18n({ useScope: 'global' });
  const translate: TranslateFn = (key, params) => params ? t(key, params) : t(key);

  const { chains, decoding, locations, protocolCache } = useSyncProgress();
  const { queueItems } = useBalanceQueue();
  const taskStore = useTaskStore();

  // One computed per source (perf): only the changed source's Activity[] recomputes.
  const balances = computed<Activity[]>(() => balanceActivities(get(queueItems), translate));
  const txSync = computed<Activity[]>(() => txSyncActivities(get(chains), translate));
  const decode = computed<Activity[]>(() => decodingActivities(get(decoding), translate));
  const events = computed<Activity[]>(() => exchangeEventsActivities(get(locations), translate));
  const protocol = computed<Activity[]>(() => protocolCacheActivities(get(protocolCache), translate));
  const backend = computed<Activity[]>(() => backendTaskActivities(taskStore.tasks, translate));

  const model = computed<ActivityModel>(() => assembleActivityModel(
    [get(balances), get(txSync), get(decode), get(events), get(protocol), get(backend)].flat(),
    translate,
  ));

  const active = computed<Activity[]>(() => get(model).active);
  const pending = computed<Activity[]>(() => get(model).pending);
  const current = computed<Activity | undefined>(() => get(model).current);
  const isActive = computed<boolean>(() => get(model).overall.phase !== ActivityPhase.IDLE);

  return { active, current, isActive, model, pending };
});
