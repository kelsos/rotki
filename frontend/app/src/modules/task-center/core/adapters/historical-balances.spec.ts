import { describe, expect, it } from 'vitest';
import { ActivityKind, ActivitySourceType, ActivityStatus } from '../types';
import { historicalBalanceActivities } from './historical-balances';

const t = (key: string): string => key;

describe('historicalBalanceActivities', () => {
  it('should map in-progress data to a running info activity', () => {
    const [activity] = historicalBalanceActivities({ processed: 3, total: 10 }, t);
    expect(activity).toMatchObject({
      cancellable: false,
      id: 'historical-balances',
      kind: ActivityKind.HISTORICAL_BALANCES,
      percentage: 30,
      rerunnable: false,
      source: { key: 'historical-balances', type: ActivitySourceType.INFO },
      status: ActivityStatus.RUNNING,
      steps: { current: 3, total: 10 },
    });
  });

  it('should map fully processed data to complete', () => {
    const [activity] = historicalBalanceActivities({ processed: 10, total: 10 }, t);
    expect(activity.status).toBe(ActivityStatus.COMPLETE);
    expect(activity.percentage).toBe(100);
  });

  it('should emit nothing when there is no progress data', () => {
    expect(historicalBalanceActivities(undefined, t)).toStrictEqual([]);
  });

  it('should emit nothing when total is zero', () => {
    expect(historicalBalanceActivities({ processed: 0, total: 0 }, t)).toStrictEqual([]);
  });
});
