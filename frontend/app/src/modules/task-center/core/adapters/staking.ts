import type { CommonQueryStatusData } from '@rotki/common';
import { percentageFromSteps } from '../status';
import { type Activity, ActivityKind, ActivitySourceType, ActivityStatus, makeActivityId, type TranslateFn } from '../types';

/**
 * Maps the staking query status (currently fed by Liquity staking queries) into a
 * staking activity. Informational, websocket-driven progress with no control path →
 * INFO source, non-cancellable/non-rerunnable. Emitted only while there is status data
 * (total > 0).
 */
export function stakingActivities(status: CommonQueryStatusData | undefined, t: TranslateFn): Activity[] {
  if (!status || status.total === 0)
    return [];

  const complete = status.processed >= status.total;
  return [{
    cancellable: false,
    id: makeActivityId(ActivityKind.STAKING),
    kind: ActivityKind.STAKING,
    percentage: percentageFromSteps(status.processed, status.total),
    rerunnable: false,
    source: { key: 'staking', type: ActivitySourceType.INFO },
    status: complete ? ActivityStatus.COMPLETE : ActivityStatus.RUNNING,
    steps: { current: status.processed, total: status.total },
    title: t('task_center.activity.staking'),
  } satisfies Activity];
}
