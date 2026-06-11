import type { HistoricalBalanceProcessingData } from '@/modules/core/messaging/types/status-types';
import { percentageFromSteps } from '../status';
import { type Activity, ActivityKind, ActivitySourceType, ActivityStatus, makeActivityId, type TranslateFn } from '../types';

/**
 * Maps the single historical-balance processing-progress item into an activity.
 * Informational, websocket-driven progress with no control path, so it carries an
 * INFO source and is neither cancellable nor rerunnable. Emitted only while there is
 * processing data (total > 0), mirroring the store's own `isProcessing` guard.
 */
export function historicalBalanceActivities(
  progress: HistoricalBalanceProcessingData | undefined,
  t: TranslateFn,
): Activity[] {
  if (!progress || progress.total === 0)
    return [];

  const complete = progress.processed >= progress.total;
  return [{
    cancellable: false,
    id: makeActivityId(ActivityKind.HISTORICAL_BALANCES),
    kind: ActivityKind.HISTORICAL_BALANCES,
    percentage: percentageFromSteps(progress.processed, progress.total),
    rerunnable: false,
    source: { key: 'historical-balances', type: ActivitySourceType.INFO },
    status: complete ? ActivityStatus.COMPLETE : ActivityStatus.RUNNING,
    steps: { current: progress.processed, total: progress.total },
    title: t('task_center.activity.historical_balances'),
  } satisfies Activity];
}
