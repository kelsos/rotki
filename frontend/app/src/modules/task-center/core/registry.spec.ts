import { describe, expect, it } from 'vitest';
import { TaskType } from '@/modules/core/tasks/task-type';
import { ACTIVITY_ADAPTERS, type SourceContext } from './registry';
import { ActivityKind } from './types';

const t = (key: string): string => key;

function emptyContext(): SourceContext {
  return {
    balances: () => [],
    chains: () => [],
    decoding: () => [],
    historical: () => undefined,
    locations: () => [],
    pendingKeys: () => [],
    prices: () => ({ stats: {} }),
    protocolCache: () => [],
    reportProgress: () => ({ processingState: '', totalProgress: '' }),
    staking: () => undefined,
    tasks: () => [],
  };
}

function runAll(ctx: SourceContext): ActivityKind[] {
  return ACTIVITY_ADAPTERS.flatMap(descriptor => descriptor.run(ctx, t)).map(activity => activity.kind);
}

describe('activity adapter registry', () => {
  it('should have unique descriptor labels', () => {
    const labels = ACTIVITY_ADAPTERS.map(descriptor => descriptor.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('should produce nothing for an empty context', () => {
    expect(runAll(emptyContext())).toStrictEqual([]);
  });

  it('should wire the decoding source to the decoding adapter', () => {
    const ctx: SourceContext = { ...emptyContext(), decoding: () => [{ cancelled: false, chain: 'eth', processed: 1, progress: 50, total: 2 }] };
    expect(runAll(ctx)).toStrictEqual([ActivityKind.TX_DECODING]);
  });

  it('should wire the task source to both task-kinded and floor adapters', () => {
    const ctx: SourceContext = {
      ...emptyContext(),
      tasks: () => [
        { id: 1, meta: { title: 'kraken' }, time: 1, type: TaskType.QUERY_EXCHANGE_BALANCES },
        { id: 2, meta: { title: 'nfts' }, time: 2, type: TaskType.FETCH_NFTS },
      ],
    };
    const kinds = runAll(ctx);
    expect(kinds).toContain(ActivityKind.EXCHANGE_BALANCES);
    expect(kinds).toContain(ActivityKind.OTHER);
  });
});
