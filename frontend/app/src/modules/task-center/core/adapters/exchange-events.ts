import { type LocationProgress, LocationStatus } from '@/modules/shell/sync-progress/types';
import { INDETERMINATE } from '../status';
import { type Activity, ActivityKind, ActivitySourceType, ActivityStatus, makeActivityId, type TranslateFn } from '../types';

/**
 * Maps the `LocationProgress` items already computed by `useSyncProgress` into
 * exchange-events activities. Location queries carry no numeric progress, so the
 * percentage is binary (complete vs indeterminate); status conveys the rest.
 * Consumes the sync module's output, keeping the history percentage authoritative
 * there.
 */
export function exchangeEventsActivities(locations: LocationProgress[], t: TranslateFn): Activity[] {
  return locations.map((item) => {
    const status = eventsStatus(item.status);
    return {
      cancellable: status === ActivityStatus.RUNNING,
      id: makeActivityId(ActivityKind.EXCHANGE_EVENTS, item.location, item.name),
      kind: ActivityKind.EXCHANGE_EVENTS,
      percentage: status === ActivityStatus.COMPLETE ? 100 : INDETERMINATE,
      rerunnable: true,
      source: { location: item.location, name: item.name, type: ActivitySourceType.EXCHANGE_EVENTS },
      status,
      subtitle: item.name,
      title: t('task_center.activity.exchange_events'),
    } satisfies Activity;
  });
}

function eventsStatus(status: LocationStatus): ActivityStatus {
  switch (status) {
    case LocationStatus.CANCELLED:
      return ActivityStatus.CANCELLED;
    case LocationStatus.COMPLETE:
      return ActivityStatus.COMPLETE;
    case LocationStatus.PENDING:
      return ActivityStatus.PENDING;
    case LocationStatus.QUERYING:
      return ActivityStatus.RUNNING;
  }
}
