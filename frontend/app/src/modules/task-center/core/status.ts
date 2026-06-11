import { type ActivityStatus, ActivityStatus as Status } from './types';

/** Sentinel percentage for work whose completion cannot be quantified. */
export const INDETERMINATE = -1;

/** True for statuses that represent finished work (no further progress expected). */
export function isTerminalStatus(status: ActivityStatus): boolean {
  return status === Status.COMPLETE || status === Status.CANCELLED || status === Status.FAILED;
}

/** Naive step percentage, rounded; {@link INDETERMINATE} when the total is unknown. */
export function percentageFromSteps(processed: number, total: number): number {
  return total > 0 ? Math.round((processed / total) * 100) : INDETERMINATE;
}

/**
 * Rolls a set of percentages into one, ignoring {@link INDETERMINATE} members.
 * Returns {@link INDETERMINATE} when nothing is quantifiable.
 */
export function rollupPercentage(percentages: number[]): number {
  const determinate = percentages.filter(p => p !== INDETERMINATE);
  if (determinate.length === 0)
    return INDETERMINATE;

  const sum = determinate.reduce((acc, p) => acc + p, 0);
  return Math.round(sum / determinate.length);
}

/**
 * Rolls a set of activity statuses into a single group/overall status, in priority
 * order: any running ⇒ running, else any pending ⇒ pending, else any failed ⇒
 * failed, else all cancelled ⇒ cancelled, else complete.
 */
export function rollupStatus(statuses: ActivityStatus[]): ActivityStatus {
  if (statuses.length === 0)
    return Status.COMPLETE;
  if (statuses.includes(Status.RUNNING))
    return Status.RUNNING;
  if (statuses.includes(Status.PENDING))
    return Status.PENDING;
  if (statuses.includes(Status.FAILED))
    return Status.FAILED;
  if (statuses.every(s => s === Status.CANCELLED))
    return Status.CANCELLED;

  return Status.COMPLETE;
}
