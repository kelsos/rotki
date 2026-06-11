import type { DecodingProgress } from '@/modules/shell/sync-progress/types';
import { type Activity, ActivityKind, ActivitySourceType, ActivityStatus, makeActivityId, type TranslateFn } from '../types';

/**
 * Maps the `DecodingProgress` items already computed by `useSyncProgress` into
 * decoding activities. Per the read-model boundary rule, this consumes the sync
 * module's output rather than the raw decoding store, so the history percentage
 * stays authoritative there.
 */
export function decodingActivities(items: DecodingProgress[], t: TranslateFn): Activity[] {
  return items.map((item) => {
    const status = decodingStatus(item);
    return {
      cancellable: status === ActivityStatus.RUNNING,
      id: makeActivityId(ActivityKind.TX_DECODING, item.chain),
      kind: ActivityKind.TX_DECODING,
      percentage: item.progress,
      rerunnable: true,
      source: { chain: item.chain, type: ActivitySourceType.DECODING },
      status,
      steps: { current: item.processed, total: item.total },
      subtitle: item.chain,
      title: t('task_center.activity.tx_decoding'),
    } satisfies Activity;
  });
}

function decodingStatus(item: DecodingProgress): Activity['status'] {
  if (item.cancelled)
    return ActivityStatus.CANCELLED;
  if (item.total > 0 && item.processed >= item.total)
    return ActivityStatus.COMPLETE;

  return ActivityStatus.RUNNING;
}
