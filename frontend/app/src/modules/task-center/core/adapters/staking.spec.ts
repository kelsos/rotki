import { describe, expect, it } from 'vitest';
import { ActivityKind, ActivitySourceType, ActivityStatus } from '../types';
import { stakingActivities } from './staking';

const t = (key: string): string => key;

describe('stakingActivities', () => {
  it('should map in-progress status to a running staking info activity', () => {
    const [activity] = stakingActivities({ processed: 1, total: 5 }, t);
    expect(activity).toMatchObject({
      cancellable: false,
      id: 'staking',
      kind: ActivityKind.STAKING,
      percentage: 20,
      rerunnable: false,
      source: { key: 'staking', type: ActivitySourceType.INFO },
      status: ActivityStatus.RUNNING,
      steps: { current: 1, total: 5 },
    });
  });

  it('should map fully processed status to complete', () => {
    const [activity] = stakingActivities({ processed: 5, total: 5 }, t);
    expect(activity.status).toBe(ActivityStatus.COMPLETE);
    expect(activity.percentage).toBe(100);
  });

  it('should emit nothing when there is no status or total is zero', () => {
    expect(stakingActivities(undefined, t)).toStrictEqual([]);
    expect(stakingActivities({ processed: 0, total: 0 }, t)).toStrictEqual([]);
  });
});
