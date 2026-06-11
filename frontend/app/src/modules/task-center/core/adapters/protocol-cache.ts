import type { ProtocolCacheProgress } from '@/modules/shell/sync-progress/types';
import { type Activity, ActivityKind, ActivitySourceType, ActivityStatus, makeActivityId, type TranslateFn } from '../types';

/**
 * Maps the `ProtocolCacheProgress` items already computed by `useSyncProgress` into
 * protocol-cache activities. Protocol cache refresh is an informational sub-activity
 * of decoding with no standalone cancel/rerun path, so it is neither cancellable nor
 * rerunnable here. Consumes the sync module's output, keeping the history percentage
 * authoritative there.
 */
export function protocolCacheActivities(items: ProtocolCacheProgress[], t: TranslateFn): Activity[] {
  return items.map(item => ({
    cancellable: false,
    id: makeActivityId(ActivityKind.PROTOCOL_CACHE, item.chain, item.protocol),
    kind: ActivityKind.PROTOCOL_CACHE,
    percentage: item.progress,
    rerunnable: false,
    source: { chain: item.chain, protocol: item.protocol, type: ActivitySourceType.PROTOCOL_CACHE },
    status: protocolCacheStatus(item),
    steps: { current: item.processed, total: item.total },
    subtitle: item.protocol,
    title: t('task_center.activity.protocol_cache'),
  } satisfies Activity));
}

function protocolCacheStatus(item: ProtocolCacheProgress): ActivityStatus {
  if (item.cancelled)
    return ActivityStatus.CANCELLED;
  if (item.total > 0 && item.processed >= item.total)
    return ActivityStatus.COMPLETE;

  return ActivityStatus.RUNNING;
}
