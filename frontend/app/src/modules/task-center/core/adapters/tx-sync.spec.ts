import { describe, expect, it } from 'vitest';
import { type AddressProgress, AddressStatus, AddressSubtype, type ChainProgress } from '@/modules/shell/sync-progress/types';
import { ActivityKind, ActivitySourceType, ActivityStatus } from '../types';
import { txSyncActivities } from './tx-sync';

const t = (key: string): string => key;

function address(overrides: Partial<AddressProgress> = {}): AddressProgress {
  return { address: '0xabc', status: AddressStatus.QUERYING, subtype: AddressSubtype.EVM, ...overrides };
}

function chain(chainName: string, addresses: AddressProgress[]): ChainProgress {
  return { addresses, cancelled: 0, chain: chainName, completed: 0, inProgress: 0, pending: 0, progress: 0, total: addresses.length };
}

describe('txSyncActivities', () => {
  it('should map a querying address to a running, cancellable per-address activity', () => {
    const [activity] = txSyncActivities([chain('eth', [address()])], t);
    expect(activity).toMatchObject({
      cancellable: true,
      id: 'tx-sync:eth:0xabc',
      kind: ActivityKind.TX_SYNC,
      rerunnable: true,
      source: { address: '0xabc', chain: 'eth', type: ActivitySourceType.TX_SYNC },
      status: ActivityStatus.RUNNING,
      subtitle: '0xabc',
    });
  });

  it('should treat decoding step as running', () => {
    const [activity] = txSyncActivities([chain('eth', [address({ status: AddressStatus.DECODING })])], t);
    expect(activity.status).toBe(ActivityStatus.RUNNING);
  });

  it('should map pending, complete and cancelled statuses', () => {
    const activities = txSyncActivities([chain('eth', [
      address({ address: '0x1', status: AddressStatus.PENDING }),
      address({ address: '0x2', status: AddressStatus.COMPLETE }),
      address({ address: '0x3', status: AddressStatus.CANCELLED }),
    ])], t);
    expect(activities.map(a => a.status)).toStrictEqual([
      ActivityStatus.PENDING,
      ActivityStatus.COMPLETE,
      ActivityStatus.CANCELLED,
    ]);
    expect(activities.every(a => !a.cancellable)).toBe(true);
  });

  it('should use periodProgress for percentage when present', () => {
    const [activity] = txSyncActivities([chain('eth', [address({ periodProgress: 42.6 })])], t);
    expect(activity.percentage).toBe(43);
  });

  it('should be indeterminate while running without a known period progress', () => {
    const [activity] = txSyncActivities([chain('eth', [address()])], t);
    expect(activity.percentage).toBe(-1);
  });

  it('should report 100 percent for a completed address with no period progress', () => {
    const [activity] = txSyncActivities([chain('eth', [address({ status: AddressStatus.COMPLETE })])], t);
    expect(activity.percentage).toBe(100);
  });

  it('should flatten addresses across chains into deterministic ids', () => {
    const activities = txSyncActivities([
      chain('eth', [address({ address: '0xa' })]),
      chain('gnosis', [address({ address: '0xb' })]),
    ], t);
    expect(activities.map(a => a.id)).toStrictEqual(['tx-sync:eth:0xa', 'tx-sync:gnosis:0xb']);
  });

  it('should return an empty list for no chains', () => {
    expect(txSyncActivities([], t)).toStrictEqual([]);
  });
});
