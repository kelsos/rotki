import type { TaskResult } from '@/modules/core/tasks/use-task-handler';
import { err, ok } from 'plainfp/result';
import { describe, expect, it } from 'vitest';
import {
  BackendCancelled,
  Cancelled,
  fromTaskResult,
  isActionable,
  isCancellation,
  Skipped,
  TaskFailed,
} from './task-result-adapter';

describe('fromTaskResult', () => {
  it('should map a success to ok with the unwrapped value', () => {
    expect(fromTaskResult<number>({ result: 42, success: true })).toStrictEqual(ok(42));
  });

  it('should map a user cancellation to a Cancelled error', () => {
    expect(fromTaskResult({
      backendCancelled: false,
      cancelled: true,
      message: 'stopped',
      skipped: false,
      success: false,
    })).toStrictEqual(err(Cancelled({ message: 'stopped' })));
  });

  it('should map a backend cancellation to a BackendCancelled error', () => {
    expect(fromTaskResult({
      backendCancelled: true,
      cancelled: false,
      message: 'backend stopped',
      skipped: false,
      success: false,
    })).toStrictEqual(err(BackendCancelled({ message: 'backend stopped' })));
  });

  it('should map a guard skip to a Skipped error', () => {
    expect(fromTaskResult({
      backendCancelled: false,
      cancelled: false,
      message: 'duplicate',
      skipped: true,
      success: false,
    })).toStrictEqual(err(Skipped({ message: 'duplicate' })));
  });

  it('should map a plain failure to an actionable TaskFailed error carrying the cause', () => {
    const cause = new Error('boom');
    const failure: TaskResult<never> = {
      backendCancelled: false,
      cancelled: false,
      error: cause,
      message: 'failed',
      skipped: false,
      success: false,
    };
    expect(fromTaskResult(failure)).toStrictEqual(err(TaskFailed({ cause, message: 'failed' })));
  });
});

describe('error predicates', () => {
  it('should treat user and backend cancellations as cancellation', () => {
    expect(isCancellation(Cancelled({ message: 'x' }))).toBe(true);
    expect(isCancellation(BackendCancelled({ message: 'x' }))).toBe(true);
    expect(isCancellation(Skipped({ message: 'x' }))).toBe(false);
    expect(isCancellation(TaskFailed({ message: 'x' }))).toBe(false);
  });

  it('should treat only TaskFailed as actionable', () => {
    expect(isActionable(TaskFailed({ message: 'x' }))).toBe(true);
    expect(isActionable(Cancelled({ message: 'x' }))).toBe(false);
    expect(isActionable(Skipped({ message: 'x' }))).toBe(false);
  });
});
