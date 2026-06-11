import { describe, expect, it } from 'vitest';
import { ActivityKind, ActivitySourceType, ActivityStatus } from '../types';
import { pendingRefreshActivities } from './pending-refresh';

const t = (key: string): string => key;

describe('pendingRefreshActivities', () => {
  it('should map a blockchain pending key to a pending tx-sync activity with the canonical id', () => {
    const [activity] = pendingRefreshActivities(['blockchain:eth:0xabc'], t);
    expect(activity).toMatchObject({
      cancellable: false,
      id: 'tx-sync:eth:0xabc',
      kind: ActivityKind.TX_SYNC,
      source: { address: '0xabc', chain: 'eth', type: ActivitySourceType.TX_SYNC },
      status: ActivityStatus.PENDING,
      subtitle: '0xabc',
    });
  });

  it('should map an exchange pending key to a pending exchange-events activity', () => {
    const [activity] = pendingRefreshActivities(['exchange:kraken:main'], t);
    expect(activity).toMatchObject({
      id: 'exchange-events:kraken:main',
      kind: ActivityKind.EXCHANGE_EVENTS,
      source: { location: 'kraken', name: 'main', type: ActivitySourceType.EXCHANGE_EVENTS },
      status: ActivityStatus.PENDING,
      subtitle: 'main',
    });
  });

  it('should ignore keys with an unknown prefix or missing parts', () => {
    expect(pendingRefreshActivities(['weird:eth:0x', 'blockchain:onlychain', 'exchange:'], t)).toStrictEqual([]);
  });

  it('should return an empty list for no keys', () => {
    expect(pendingRefreshActivities([], t)).toStrictEqual([]);
  });
});
