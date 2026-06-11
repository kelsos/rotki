import type { CommonQueryStatusData } from '@rotki/common';
import { percentageFromSteps } from '../status';
import { type Activity, ActivityKind, ActivitySourceType, ActivityStatus, makeActivityId, type TranslateFn } from '../types';

/**
 * Maps the daily historic-price query status into a prices activity. Informational,
 * websocket-driven progress with no control path, so it carries an INFO source and is
 * neither cancellable nor rerunnable. Emitted only while there is status data
 * (total > 0).
 */
export function priceActivities(status: CommonQueryStatusData | undefined, t: TranslateFn): Activity[] {
  if (!status || status.total === 0)
    return [];

  const complete = status.processed >= status.total;
  return [{
    cancellable: false,
    id: makeActivityId(ActivityKind.PRICES),
    kind: ActivityKind.PRICES,
    percentage: percentageFromSteps(status.processed, status.total),
    rerunnable: false,
    source: { key: 'prices', type: ActivitySourceType.INFO },
    status: complete ? ActivityStatus.COMPLETE : ActivityStatus.RUNNING,
    steps: { current: status.processed, total: status.total },
    title: t('task_center.activity.prices'),
  } satisfies Activity];
}
