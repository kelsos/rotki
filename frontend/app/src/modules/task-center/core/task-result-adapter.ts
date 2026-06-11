import type { TaskResult } from '@/modules/core/tasks/use-task-handler';
import { err, ok, type Result } from 'plainfp/result';
import { hasTag, tag } from 'plainfp/tagged';

/**
 * Bridges the task layer's {@link TaskResult} discriminated union to a plainfp
 * {@link Result}, giving the task store, the controller and the (future) scheduler a
 * single vocabulary for outcomes. This is the ONLY place outside the scheduler that
 * imports plainfp — swap it out here if the dependency is ever dropped.
 */

/** User explicitly cancelled the task. */
export const Cancelled = tag('Cancelled');

/** Backend reported the task as cancelled. */
export const BackendCancelled = tag('BackendCancelled');

/** A guard skipped the task (e.g. duplicate of an in-flight unique task). */
export const Skipped = tag('Skipped');

/** An actual, actionable failure the consumer should surface. */
export const TaskFailed = tag('TaskFailed');

export type TaskError =
  | ReturnType<typeof Cancelled<{ message: string }>>
  | ReturnType<typeof BackendCancelled<{ message: string }>>
  | ReturnType<typeof Skipped<{ message: string }>>
  | ReturnType<typeof TaskFailed<{ message: string; cause?: unknown }>>;

/**
 * Maps a {@link TaskResult} to a `Result<R, TaskError>`. The failure branch is total:
 * cancellation, backend cancellation and guard-skips become distinct tags, and any
 * remaining failure is an actionable {@link TaskFailed}.
 */
export function fromTaskResult<R>(result: TaskResult<R>): Result<R, TaskError> {
  if (result.success)
    return ok(result.result);

  if (result.cancelled)
    return err(Cancelled({ message: result.message }));

  if (result.backendCancelled)
    return err(BackendCancelled({ message: result.message }));

  if (result.skipped)
    return err(Skipped({ message: result.message }));

  return err(TaskFailed({ cause: result.error, message: result.message }));
}

/** True when the error is any flavour of cancellation (user or backend). */
export function isCancellation(error: TaskError): boolean {
  return hasTag(error, 'Cancelled') || hasTag(error, 'BackendCancelled');
}

/** True when the error is an actionable failure (not a cancel or a skip). */
export function isActionable(error: TaskError): boolean {
  return hasTag(error, 'TaskFailed');
}
