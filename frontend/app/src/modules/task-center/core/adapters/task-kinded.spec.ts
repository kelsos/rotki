import type { Task, TaskMeta } from '@/modules/core/tasks/types';
import { describe, expect, it } from 'vitest';
import { TaskType } from '@/modules/core/tasks/task-type';
import { ActivityKind, ActivitySourceType, ActivityStatus } from '../types';
import { TASK_KINDED_TYPES, taskKindedActivities } from './task-kinded';

const t = (key: string): string => key;

function task(id: number, type: TaskType, title = `task ${id}`): Task<TaskMeta> {
  return { id, meta: { title }, time: id * 1000, type };
}

describe('taskKindedActivities', () => {
  it('should map exchange-balance, repulling and CSV-import tasks to their kinds', () => {
    const activities = taskKindedActivities([
      task(1, TaskType.QUERY_EXCHANGE_BALANCES, 'kraken'),
      task(2, TaskType.REPULLING_TXS, 'repull'),
      task(3, TaskType.IMPORT_CSV, 'import'),
    ], t);
    expect(activities.map(a => [a.kind, a.id])).toStrictEqual([
      [ActivityKind.EXCHANGE_BALANCES, 'exchange-balances:1'],
      [ActivityKind.REPULLING, 'repulling:2'],
      [ActivityKind.CSV_IMPORT, 'csv-import:3'],
    ]);
  });

  it('should produce a running, cancellable backend-task source with the task meta as subtitle', () => {
    const [activity] = taskKindedActivities([task(7, TaskType.REPULLING_TXS, 'Re-pulling eth')], t);
    expect(activity).toMatchObject({
      cancellable: true,
      percentage: -1,
      rerunnable: false,
      source: { taskId: 7, taskType: TaskType.REPULLING_TXS, type: ActivitySourceType.BACKEND_TASK },
      startedAt: 7000,
      status: ActivityStatus.RUNNING,
      subtitle: 'Re-pulling eth',
    });
  });

  it('should ignore tasks of unmapped types', () => {
    expect(taskKindedActivities([task(1, TaskType.FETCH_NFTS)], t)).toStrictEqual([]);
  });

  it('should expose its claimed types so the floor can exclude them', () => {
    expect(TASK_KINDED_TYPES.has(TaskType.QUERY_EXCHANGE_BALANCES)).toBe(true);
    expect(TASK_KINDED_TYPES.has(TaskType.REPULLING_TXS)).toBe(true);
    expect(TASK_KINDED_TYPES.has(TaskType.IMPORT_CSV)).toBe(true);
    expect(TASK_KINDED_TYPES.has(TaskType.FETCH_NFTS)).toBe(false);
  });

  it('should return an empty list for no tasks', () => {
    expect(taskKindedActivities([], t)).toStrictEqual([]);
  });
});
