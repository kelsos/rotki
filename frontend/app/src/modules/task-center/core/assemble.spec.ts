import { describe, expect, it } from 'vitest';
import { assembleActivityModel } from './assemble';
import { type Activity, type ActivityKind, ActivityPhase, ActivitySourceType, ActivityStatus, ActivityKind as Kind, makeActivityId } from './types';

const t = (key: string): string => key;

function activity(kind: ActivityKind, key: string, overrides: Partial<Activity> = {}): Activity {
  return {
    cancellable: true,
    id: makeActivityId(kind, key),
    kind,
    percentage: 0,
    rerunnable: true,
    source: { tag: key, type: ActivitySourceType.REQUEST_TAG },
    status: ActivityStatus.RUNNING,
    subtitle: key,
    title: `${kind}:${key}`,
    ...overrides,
  };
}

describe('assembleActivityModel', () => {
  it('should report an idle phase and zero overall when empty', () => {
    const model = assembleActivityModel([], t);
    expect(model.groups).toStrictEqual([]);
    expect(model.active).toStrictEqual([]);
    expect(model.pending).toStrictEqual([]);
    expect(model.current).toBeUndefined();
    expect(model.overall).toStrictEqual({ percentage: 0, phase: ActivityPhase.IDLE });
  });

  it('should group activities by kind and roll up percentage and status', () => {
    const model = assembleActivityModel([
      activity(Kind.TX_DECODING, 'eth', { percentage: 40 }),
      activity(Kind.TX_DECODING, 'gnosis', { percentage: 60 }),
    ], t);
    expect(model.groups).toHaveLength(1);
    expect(model.groups[0]).toMatchObject({
      kind: Kind.TX_DECODING,
      percentage: 50,
      status: ActivityStatus.RUNNING,
    });
    expect(model.groups[0].activities).toHaveLength(2);
  });

  it('should order groups by kind priority (balances before decoding)', () => {
    const model = assembleActivityModel([
      activity(Kind.TX_DECODING, 'eth'),
      activity(Kind.BLOCKCHAIN_BALANCES, 'eth'),
    ], t);
    expect(model.groups.map(g => g.kind)).toStrictEqual([Kind.BLOCKCHAIN_BALANCES, Kind.TX_DECODING]);
  });

  it('should pick current as the highest-priority running activity', () => {
    const model = assembleActivityModel([
      activity(Kind.TX_DECODING, 'eth'),
      activity(Kind.BLOCKCHAIN_BALANCES, 'eth'),
    ], t);
    expect(model.current?.kind).toBe(Kind.BLOCKCHAIN_BALANCES);
  });

  it('should fall back to a pending activity for current when nothing runs', () => {
    const model = assembleActivityModel([
      activity(Kind.TX_DECODING, 'eth', { status: ActivityStatus.PENDING }),
    ], t);
    expect(model.current?.status).toBe(ActivityStatus.PENDING);
    expect(model.overall.phase).toBe(ActivityPhase.WORKING);
  });

  it('should report a done phase when all activities are terminal', () => {
    const model = assembleActivityModel([
      activity(Kind.TX_DECODING, 'eth', { status: ActivityStatus.COMPLETE, percentage: 100 }),
      activity(Kind.TX_DECODING, 'gnosis', { status: ActivityStatus.CANCELLED, percentage: 100 }),
    ], t);
    expect(model.overall.phase).toBe(ActivityPhase.DONE);
    expect(model.active).toStrictEqual([]);
  });

  it('should dedupe activities sharing an id, keeping the most-live status', () => {
    const model = assembleActivityModel([
      activity(Kind.TX_SYNC, 'eth:0xabc', { status: ActivityStatus.PENDING }),
      activity(Kind.TX_SYNC, 'eth:0xabc', { status: ActivityStatus.RUNNING }),
    ], t);
    expect(model.groups[0].activities).toHaveLength(1);
    expect(model.groups[0].activities[0].status).toBe(ActivityStatus.RUNNING);
    expect(model.active).toHaveLength(1);
    expect(model.pending).toStrictEqual([]);
  });

  it('should split active and pending activities', () => {
    const model = assembleActivityModel([
      activity(Kind.TX_DECODING, 'eth', { status: ActivityStatus.RUNNING }),
      activity(Kind.TX_DECODING, 'gnosis', { status: ActivityStatus.PENDING }),
    ], t);
    expect(model.active.map(a => a.subtitle)).toStrictEqual(['eth']);
    expect(model.pending.map(a => a.subtitle)).toStrictEqual(['gnosis']);
  });
});
