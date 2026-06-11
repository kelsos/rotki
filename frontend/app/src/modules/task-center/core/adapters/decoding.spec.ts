import type { DecodingProgress } from '@/modules/shell/sync-progress/types';
import { describe, expect, it } from 'vitest';
import { ActivityKind, ActivitySourceType, ActivityStatus } from '../types';
import { decodingActivities } from './decoding';

const t = (key: string): string => key;

function progress(overrides: Partial<DecodingProgress> = {}): DecodingProgress {
  return { cancelled: false, chain: 'eth', processed: 5, progress: 50, total: 10, ...overrides };
}

describe('decodingActivities', () => {
  it('should map an in-progress entry to a running, cancellable activity', () => {
    const [activity] = decodingActivities([progress()], t);
    expect(activity).toMatchObject({
      cancellable: true,
      id: 'tx-decoding:eth',
      kind: ActivityKind.TX_DECODING,
      percentage: 50,
      rerunnable: true,
      source: { chain: 'eth', type: ActivitySourceType.DECODING },
      status: ActivityStatus.RUNNING,
      steps: { current: 5, total: 10 },
      subtitle: 'eth',
    });
  });

  it('should map a fully processed entry to complete and not cancellable', () => {
    const [activity] = decodingActivities([progress({ processed: 10, progress: 100 })], t);
    expect(activity.status).toBe(ActivityStatus.COMPLETE);
    expect(activity.cancellable).toBe(false);
  });

  it('should map a cancelled entry to cancelled regardless of progress', () => {
    const [activity] = decodingActivities([progress({ cancelled: true })], t);
    expect(activity.status).toBe(ActivityStatus.CANCELLED);
    expect(activity.cancellable).toBe(false);
  });

  it('should produce a deterministic id per chain', () => {
    const activities = decodingActivities([progress({ chain: 'eth' }), progress({ chain: 'gnosis' })], t);
    expect(activities.map(a => a.id)).toStrictEqual(['tx-decoding:eth', 'tx-decoding:gnosis']);
  });

  it('should return an empty list for no entries', () => {
    expect(decodingActivities([], t)).toStrictEqual([]);
  });
});
