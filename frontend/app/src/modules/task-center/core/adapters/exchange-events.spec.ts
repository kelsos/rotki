import { describe, expect, it } from 'vitest';
import { type LocationProgress, LocationStatus } from '@/modules/shell/sync-progress/types';
import { ActivityKind, ActivitySourceType, ActivityStatus } from '../types';
import { exchangeEventsActivities } from './exchange-events';

const t = (key: string): string => key;

function location(overrides: Partial<LocationProgress> = {}): LocationProgress {
  return { location: 'kraken', name: 'main', status: LocationStatus.QUERYING, ...overrides };
}

describe('exchangeEventsActivities', () => {
  it('should map a querying location to a running, cancellable activity', () => {
    const [activity] = exchangeEventsActivities([location()], t);
    expect(activity).toMatchObject({
      cancellable: true,
      id: 'exchange-events:kraken:main',
      kind: ActivityKind.EXCHANGE_EVENTS,
      percentage: -1,
      rerunnable: true,
      source: { location: 'kraken', name: 'main', type: ActivitySourceType.EXCHANGE_EVENTS },
      status: ActivityStatus.RUNNING,
      subtitle: 'main',
    });
  });

  it('should map complete to 100 percent and not cancellable', () => {
    const [activity] = exchangeEventsActivities([location({ status: LocationStatus.COMPLETE })], t);
    expect(activity.status).toBe(ActivityStatus.COMPLETE);
    expect(activity.percentage).toBe(100);
    expect(activity.cancellable).toBe(false);
  });

  it('should map pending and cancelled statuses', () => {
    const activities = exchangeEventsActivities([
      location({ name: 'a', status: LocationStatus.PENDING }),
      location({ name: 'b', status: LocationStatus.CANCELLED }),
    ], t);
    expect(activities.map(a => a.status)).toStrictEqual([ActivityStatus.PENDING, ActivityStatus.CANCELLED]);
    expect(activities.map(a => a.percentage)).toStrictEqual([-1, -1]);
  });

  it('should produce a deterministic id per location and name', () => {
    const activities = exchangeEventsActivities([
      location({ location: 'kraken', name: 'main' }),
      location({ location: 'binance', name: 'sub' }),
    ], t);
    expect(activities.map(a => a.id)).toStrictEqual(['exchange-events:kraken:main', 'exchange-events:binance:sub']);
  });

  it('should return an empty list for no locations', () => {
    expect(exchangeEventsActivities([], t)).toStrictEqual([]);
  });
});
