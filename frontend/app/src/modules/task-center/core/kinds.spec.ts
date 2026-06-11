import { describe, expect, it } from 'vitest';
import { groupTitle, kindRank } from './kinds';
import { type Activity, ActivityKind, ActivitySourceType, ActivityStatus, makeActivityId } from './types';

const t = (key: string): string => key;

function activity(title: string): Activity {
  return {
    cancellable: false,
    id: makeActivityId(ActivityKind.OTHER, title),
    kind: ActivityKind.OTHER,
    percentage: -1,
    rerunnable: false,
    source: { key: 'test', type: ActivitySourceType.INFO },
    status: ActivityStatus.RUNNING,
    title,
  };
}

describe('kindRank', () => {
  it('should rank balances above transaction sync above decoding', () => {
    expect(kindRank(ActivityKind.BLOCKCHAIN_BALANCES)).toBeLessThan(kindRank(ActivityKind.TX_SYNC));
    expect(kindRank(ActivityKind.TX_SYNC)).toBeLessThan(kindRank(ActivityKind.TX_DECODING));
  });

  it('should rank OTHER last among known kinds', () => {
    expect(kindRank(ActivityKind.OTHER)).toBeGreaterThan(kindRank(ActivityKind.HISTORICAL_BALANCES));
  });

  it('should rank an unlisted kind (deferred db-upgrade) last', () => {
    expect(kindRank(ActivityKind.DB_UPGRADE)).toBeGreaterThanOrEqual(kindRank(ActivityKind.OTHER));
  });
});

describe('groupTitle', () => {
  it('should resolve a static title key for a known kind', () => {
    expect(groupTitle(ActivityKind.TX_DECODING, [], t)).toBe('task_center.group.tx_decoding');
  });

  it('should fall back to the first activity title for an unlisted kind', () => {
    expect(groupTitle(ActivityKind.DB_UPGRADE, [activity('Upgrading database')], t)).toBe('Upgrading database');
  });

  it('should fall back to the kind itself when there is no activity', () => {
    expect(groupTitle(ActivityKind.DB_UPGRADE, [], t)).toBe(ActivityKind.DB_UPGRADE);
  });
});
