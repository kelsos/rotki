import type { Task, TaskMeta } from '@/modules/core/tasks/types';
import { describe, expect, it } from 'vitest';
import { TaskType } from '@/modules/core/tasks/task-type';
import { ActivityKind, ActivitySourceType, ActivityStatus } from '../types';
import { backendTaskActivities } from './backend-task';

const t = (key: string): string => key;

function task(id: number, type: TaskType, meta: Partial<TaskMeta> = {}): Task<TaskMeta> {
  return { id, meta: { title: `task ${id}`, ...meta }, time: id * 1000, type };
}

describe('backendTaskActivities', () => {
  it('should map an uncovered task to a generic running activity', () => {
    const [activity] = backendTaskActivities([task(7, TaskType.FETCH_NFTS, { description: 'NFTs' })], t);
    expect(activity).toMatchObject({
      cancellable: true,
      id: 'other:7',
      kind: ActivityKind.OTHER,
      percentage: -1,
      rerunnable: false,
      source: { taskId: 7, taskType: TaskType.FETCH_NFTS, type: ActivitySourceType.BACKEND_TASK },
      startedAt: 7000,
      status: ActivityStatus.RUNNING,
      subtitle: 'NFTs',
      title: 'task 7',
    });
  });

  it('should exclude task types already covered by richer adapters', () => {
    const activities = backendTaskActivities([
      task(1, TaskType.TX),
      task(2, TaskType.TRANSACTIONS_DECODING),
      task(3, TaskType.QUERY_EXCHANGE_EVENTS),
      task(4, TaskType.FETCH_NFTS),
    ], t);
    expect(activities.map(a => a.source)).toStrictEqual([
      { taskId: 4, taskType: TaskType.FETCH_NFTS, type: ActivitySourceType.BACKEND_TASK },
    ]);
  });

  it('should fall back to a generic title when meta title is empty', () => {
    const [activity] = backendTaskActivities([task(9, TaskType.FETCH_NFTS, { title: '' })], t);
    expect(activity.title).toBe('task_center.activity.background_task');
  });

  it('should return an empty list for no tasks', () => {
    expect(backendTaskActivities([], t)).toStrictEqual([]);
  });
});
