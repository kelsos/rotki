import type { CommonQueryStatusData } from '@rotki/common';
import { describe, expect, it } from 'vitest';
import { ActivityKind, ActivitySourceType, ActivityStatus } from '../types';
import { priceActivities } from './prices';

const t = (key: string): string => key;

function status(overrides: Partial<CommonQueryStatusData> = {}): CommonQueryStatusData {
  return { processed: 4, total: 10, ...overrides };
}

describe('priceActivities', () => {
  it('should map in-progress status to a running prices info activity', () => {
    const [activity] = priceActivities(status(), t);
    expect(activity).toMatchObject({
      cancellable: false,
      id: 'prices',
      kind: ActivityKind.PRICES,
      percentage: 40,
      rerunnable: false,
      source: { key: 'prices', type: ActivitySourceType.INFO },
      status: ActivityStatus.RUNNING,
      steps: { current: 4, total: 10 },
    });
  });

  it('should map fully processed status to complete', () => {
    const [activity] = priceActivities(status({ processed: 10 }), t);
    expect(activity.status).toBe(ActivityStatus.COMPLETE);
    expect(activity.percentage).toBe(100);
  });

  it('should emit nothing when there is no status', () => {
    expect(priceActivities(undefined, t)).toStrictEqual([]);
  });

  it('should emit nothing when total is zero', () => {
    expect(priceActivities(status({ processed: 0, total: 0 }), t)).toStrictEqual([]);
  });
});
