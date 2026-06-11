import { INDETERMINATE } from '../status';
import { type Activity, ActivityKind, ActivitySourceType, ActivityStatus, makeActivityId, type TranslateFn } from '../types';

/** The PnL report progress shape from the reports store (both fields are strings). */
export interface PnlReportProgress {
  processingState: string;
  totalProgress: string;
}

/**
 * Maps the PnL report generation progress into an activity. Emitted only while a
 * report is generating (a non-empty `processingState`); the store resets to empty
 * strings when idle. Informational, no control path → INFO source,
 * non-cancellable/non-rerunnable. `totalProgress` is a numeric percentage string.
 */
export function pnlReportActivities(progress: PnlReportProgress, t: TranslateFn): Activity[] {
  if (progress.processingState === '')
    return [];

  return [{
    cancellable: false,
    id: makeActivityId(ActivityKind.PNL_REPORT),
    kind: ActivityKind.PNL_REPORT,
    percentage: parsePercentage(progress.totalProgress),
    rerunnable: false,
    source: { key: 'pnl-report', type: ActivitySourceType.INFO },
    status: ActivityStatus.RUNNING,
    subtitle: progress.processingState,
    title: t('task_center.activity.pnl_report'),
  } satisfies Activity];
}

function parsePercentage(value: string): number {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed))
    return INDETERMINATE;

  return Math.min(100, Math.max(0, Math.round(parsed)));
}
