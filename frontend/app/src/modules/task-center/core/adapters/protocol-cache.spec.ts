import type { ProtocolCacheProgress } from '@/modules/shell/sync-progress/types';
import { describe, expect, it } from 'vitest';
import { ActivityKind, ActivitySourceType, ActivityStatus } from '../types';
import { protocolCacheActivities } from './protocol-cache';

const t = (key: string): string => key;

function progress(overrides: Partial<ProtocolCacheProgress> = {}): ProtocolCacheProgress {
  return { cancelled: false, chain: 'eth', processed: 3, progress: 30, protocol: 'curve', total: 10, ...overrides };
}

describe('protocolCacheActivities', () => {
  it('should map an in-progress entry to a running, non-cancellable, non-rerunnable activity', () => {
    const [activity] = protocolCacheActivities([progress()], t);
    expect(activity).toMatchObject({
      cancellable: false,
      id: 'protocol-cache:eth:curve',
      kind: ActivityKind.PROTOCOL_CACHE,
      percentage: 30,
      rerunnable: false,
      source: { chain: 'eth', protocol: 'curve', type: ActivitySourceType.PROTOCOL_CACHE },
      status: ActivityStatus.RUNNING,
      steps: { current: 3, total: 10 },
      subtitle: 'curve',
    });
  });

  it('should map a fully processed entry to complete', () => {
    const [activity] = protocolCacheActivities([progress({ processed: 10, progress: 100 })], t);
    expect(activity.status).toBe(ActivityStatus.COMPLETE);
  });

  it('should map a cancelled entry to cancelled regardless of progress', () => {
    const [activity] = protocolCacheActivities([progress({ cancelled: true })], t);
    expect(activity.status).toBe(ActivityStatus.CANCELLED);
  });

  it('should produce a deterministic id per chain and protocol', () => {
    const activities = protocolCacheActivities([
      progress({ chain: 'eth', protocol: 'curve' }),
      progress({ chain: 'eth', protocol: 'convex' }),
    ], t);
    expect(activities.map(a => a.id)).toStrictEqual(['protocol-cache:eth:curve', 'protocol-cache:eth:convex']);
  });

  it('should return an empty list for no entries', () => {
    expect(protocolCacheActivities([], t)).toStrictEqual([]);
  });
});
