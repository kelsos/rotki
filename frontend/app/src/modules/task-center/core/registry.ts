import type { CommonQueryStatusData } from '@rotki/common';
import type { PnlReportProgress } from './adapters/pnl-report';
import type { PriceSources } from './adapters/prices';
import type { Activity, TranslateFn } from './types';
import type { HistoricalBalanceProcessingData } from '@/modules/core/messaging/types/status-types';
import type { Task, TaskMeta } from '@/modules/core/tasks/types';
import type { BalanceQueryQueueItem } from '@/modules/dashboard/progress/types';
import type { ChainProgress, DecodingProgress, LocationProgress, ProtocolCacheProgress } from '@/modules/shell/sync-progress/types';
import {
  backendTaskActivities,
  balanceActivities,
  decodingActivities,
  exchangeEventsActivities,
  historicalBalanceActivities,
  pendingRefreshActivities,
  pnlReportActivities,
  priceActivities,
  protocolCacheActivities,
  stakingActivities,
  taskKindedActivities,
  txSyncActivities,
} from './adapters';

/**
 * The reactive sources each adapter reads, as thunks. Thunks (not snapshots) preserve
 * per-source reactivity: a descriptor's `run` calls its `select` inside a computed, so
 * Vue tracks only the source that descriptor actually reads.
 */
export interface SourceContext {
  balances: () => BalanceQueryQueueItem[];
  tasks: () => Task<TaskMeta>[];
  chains: () => ChainProgress[];
  decoding: () => DecodingProgress[];
  locations: () => LocationProgress[];
  protocolCache: () => ProtocolCacheProgress[];
  historical: () => HistoricalBalanceProcessingData | undefined;
  prices: () => PriceSources;
  reportProgress: () => PnlReportProgress;
  staking: () => CommonQueryStatusData | undefined;
  pendingKeys: () => string[];
}

export interface AdapterDescriptor {
  /** Stable label for the per-source computed (debugging / tests). */
  label: string;
  run: (ctx: SourceContext, t: TranslateFn) => Activity[];
}

/** Bind a typed source selector to its adapter, erasing the input type. */
function defineAdapter<T>(
  label: string,
  select: (ctx: SourceContext) => T,
  adapter: (input: T, t: TranslateFn) => Activity[],
): AdapterDescriptor {
  return { label, run: (ctx, t) => adapter(select(ctx), t) };
}

/**
 * The adapter wiring table. Adding a read-model source is one entry here — no shell
 * edits. Note adapters are NOT kind-pure (task-kinded emits three kinds, pending-refresh
 * two), so kind ordering/titles live separately in {@link ./kinds}.
 */
export const ACTIVITY_ADAPTERS: readonly AdapterDescriptor[] = [
  defineAdapter('balances', ctx => ctx.balances(), balanceActivities),
  defineAdapter('task-kinded', ctx => ctx.tasks(), taskKindedActivities),
  defineAdapter('tx-sync', ctx => ctx.chains(), txSyncActivities),
  defineAdapter('decoding', ctx => ctx.decoding(), decodingActivities),
  defineAdapter('exchange-events', ctx => ctx.locations(), exchangeEventsActivities),
  defineAdapter('protocol-cache', ctx => ctx.protocolCache(), protocolCacheActivities),
  defineAdapter('historical-balances', ctx => ctx.historical(), historicalBalanceActivities),
  defineAdapter('prices', ctx => ctx.prices(), priceActivities),
  defineAdapter('pnl-report', ctx => ctx.reportProgress(), pnlReportActivities),
  defineAdapter('staking', ctx => ctx.staking(), stakingActivities),
  defineAdapter('pending-refresh', ctx => ctx.pendingKeys(), pendingRefreshActivities),
  defineAdapter('backend', ctx => ctx.tasks(), backendTaskActivities),
];
