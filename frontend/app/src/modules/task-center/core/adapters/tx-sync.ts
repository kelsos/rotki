import { type AddressProgress, AddressStatus, type ChainProgress } from '@/modules/shell/sync-progress/types';
import { INDETERMINATE } from '../status';
import { type Activity, ActivityKind, ActivitySourceType, ActivityStatus, makeActivityId, type TranslateFn } from '../types';

/**
 * Maps the `ChainProgress` items already computed by `useSyncProgress` into
 * per-address transaction-sync activities. Per-address (not per-chain) granularity so
 * the controller can cancel a single account; the per-kind group rollup gives the
 * chain-agnostic sync percentage. Consumes the sync module's output, keeping the
 * history percentage authoritative there.
 */
export function txSyncActivities(chains: ChainProgress[], t: TranslateFn): Activity[] {
  return chains.flatMap(chain =>
    chain.addresses.map((address) => {
      const status = syncStatus(address.status);
      return {
        cancellable: status === ActivityStatus.RUNNING,
        id: makeActivityId(ActivityKind.TX_SYNC, chain.chain, address.address),
        kind: ActivityKind.TX_SYNC,
        percentage: syncPercentage(address, status),
        rerunnable: true,
        source: { address: address.address, chain: chain.chain, type: ActivitySourceType.TX_SYNC },
        status,
        subtitle: address.address,
        title: t('task_center.activity.tx_sync'),
      } satisfies Activity;
    }),
  );
}

function syncStatus(status: AddressStatus): ActivityStatus {
  switch (status) {
    case AddressStatus.CANCELLED:
      return ActivityStatus.CANCELLED;
    case AddressStatus.COMPLETE:
      return ActivityStatus.COMPLETE;
    case AddressStatus.PENDING:
      return ActivityStatus.PENDING;
    case AddressStatus.DECODING:
    case AddressStatus.QUERYING:
      return ActivityStatus.RUNNING;
  }
}

function syncPercentage(address: AddressProgress, status: ActivityStatus): number {
  if (address.periodProgress !== undefined)
    return Math.round(address.periodProgress);
  if (status === ActivityStatus.COMPLETE)
    return 100;

  return INDETERMINATE;
}
