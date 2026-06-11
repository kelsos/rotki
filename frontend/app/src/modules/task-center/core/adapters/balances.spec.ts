import type { BalanceQueryQueueItem } from '@/modules/dashboard/progress/types';
import { describe, expect, it } from 'vitest';
import { TaskType } from '@/modules/core/tasks/task-type';
import { ActivityKind, ActivitySourceType, ActivityStatus } from '../types';
import { balanceActivities } from './balances';

const t = (key: string): string => key;

function item(overrides: Partial<BalanceQueryQueueItem> = {}): BalanceQueryQueueItem {
  return { addedAt: 1000, chain: 'eth', id: 'eth', status: 'running', type: TaskType.QUERY_BLOCKCHAIN_BALANCES, ...overrides };
}

describe('balanceActivities', () => {
  it('should map a running blockchain-balance item', () => {
    const [activity] = balanceActivities([item()], t);
    expect(activity).toMatchObject({
      cancellable: false,
      id: 'blockchain-balances:eth',
      kind: ActivityKind.BLOCKCHAIN_BALANCES,
      percentage: -1,
      rerunnable: false,
      source: { address: undefined, chain: 'eth', taskType: TaskType.QUERY_BLOCKCHAIN_BALANCES, type: ActivitySourceType.BALANCE_QUERY },
      startedAt: 1000,
      status: ActivityStatus.RUNNING,
      subtitle: 'eth',
    });
  });

  it('should map a token-detection item with address into a token-detection activity', () => {
    const [activity] = balanceActivities([item({ address: '0xabc', type: TaskType.FETCH_DETECTED_TOKENS })], t);
    expect(activity.kind).toBe(ActivityKind.TOKEN_DETECTION);
    expect(activity.id).toBe('token-detection:eth:0xabc');
    expect(activity.subtitle).toBe('0xabc');
  });

  it('should surface pending items in their pending state', () => {
    const [activity] = balanceActivities([item({ status: 'pending' })], t);
    expect(activity.status).toBe(ActivityStatus.PENDING);
  });

  it('should map a completed item to 100 percent complete', () => {
    const [activity] = balanceActivities([item({ status: 'completed' })], t);
    expect(activity.status).toBe(ActivityStatus.COMPLETE);
    expect(activity.percentage).toBe(100);
  });

  it('should return an empty list for no items', () => {
    expect(balanceActivities([], t)).toStrictEqual([]);
  });
});
