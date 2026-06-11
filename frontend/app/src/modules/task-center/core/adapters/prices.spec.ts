import type { StatsPriceQueryData } from '@/modules/core/messaging/types';
import { describe, expect, it } from 'vitest';
import { ActivityKind, ActivitySourceType, ActivityStatus } from '../types';
import { priceActivities, type PriceSources } from './prices';

const t = (key: string): string => key;

function sources(overrides: Partial<PriceSources> = {}): PriceSources {
  return { stats: {}, ...overrides };
}

describe('priceActivities', () => {
  it('should map the daily stream to a running prices activity', () => {
    const [activity] = priceActivities(sources({ daily: { processed: 4, total: 10 } }), t);
    expect(activity).toMatchObject({
      cancellable: false,
      id: 'prices:daily',
      kind: ActivityKind.PRICES,
      percentage: 40,
      source: { key: 'prices:daily', type: ActivitySourceType.INFO },
      status: ActivityStatus.RUNNING,
      steps: { current: 4, total: 10 },
    });
  });

  it('should map daily, multiple and per-counterparty stats into distinct activities', () => {
    const stats: Record<string, StatsPriceQueryData> = {
      uniswap: { counterparty: 'uniswap', processed: 1, total: 2 },
    };
    const activities = priceActivities(sources({
      daily: { processed: 2, total: 4 },
      historical: { processed: 5, total: 5 },
      stats,
    }), t);
    expect(activities.map(a => a.id)).toStrictEqual(['prices:daily', 'prices:historical', 'prices:stats:uniswap']);
    expect(activities.find(a => a.id === 'prices:historical')?.status).toBe(ActivityStatus.COMPLETE);
    expect(activities.find(a => a.id === 'prices:stats:uniswap')?.subtitle).toBe('uniswap');
  });

  it('should omit streams with no data', () => {
    expect(priceActivities(sources({ daily: { processed: 0, total: 0 } }), t)).toStrictEqual([]);
  });

  it('should return an empty list when nothing is querying', () => {
    expect(priceActivities(sources(), t)).toStrictEqual([]);
  });
});
