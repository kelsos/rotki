import type { Task, TaskMeta } from '@/modules/core/tasks/types';
import { describe, expect, it } from 'vitest';
import { TaskType } from '@/modules/core/tasks/task-type';
import { ActivityKind, ActivitySourceType, ActivityStatus } from '../types';
import { exchangeBalanceActivities } from './exchange-balances';

const t = (key: string): string => key;

function task(id: number, type: TaskType, title = `task ${id}`): Task<TaskMeta> {
  return { id, meta: { title }, time: id * 1000, type };
}

describe('exchangeBalanceActivities', () => {
  it('should map an exchange-balance task to a running, cancellable activity', () => {
    const [activity] = exchangeBalanceActivities([task(2, TaskType.QUERY_EXCHANGE_BALANCES, 'Querying kraken')], t);
    expect(activity).toMatchObject({
      cancellable: true,
      id: 'exchange-balances:2',
      kind: ActivityKind.EXCHANGE_BALANCES,
      percentage: -1,
      rerunnable: false,
      source: { taskId: 2, taskType: TaskType.QUERY_EXCHANGE_BALANCES, type: ActivitySourceType.BACKEND_TASK },
      startedAt: 2000,
      status: ActivityStatus.RUNNING,
      subtitle: 'Querying kraken',
    });
  });

  it('should ignore tasks of other types', () => {
    const activities = exchangeBalanceActivities([
      task(1, TaskType.QUERY_BLOCKCHAIN_BALANCES),
      task(2, TaskType.QUERY_EXCHANGE_BALANCES),
      task(3, TaskType.FETCH_NFTS),
    ], t);
    expect(activities.map(a => a.id)).toStrictEqual(['exchange-balances:2']);
  });

  it('should return an empty list for no tasks', () => {
    expect(exchangeBalanceActivities([], t)).toStrictEqual([]);
  });
});
