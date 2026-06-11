import { checkIfDevelopment } from '@shared/utils';

/**
 * Master switch for the Task Center surface (header indicator + panel). While the
 * feature is being built out it is enabled only in development/test builds so it can be
 * exercised without shipping to production. This is the single toggle point: flip it to
 * a constant, or wire a frontend setting here, to change the rollout.
 */
export function isTaskCenterEnabled(): boolean {
  return checkIfDevelopment();
}
