import type { CommonQueryStatusData } from '@rotki/common';
import type { Ref } from 'vue';
import type { PnlReportProgress } from './core/adapters/pnl-report';
import type { HistoricalBalanceProcessingData } from '@/modules/core/messaging/types/status-types';
import type { Task, TaskMeta } from '@/modules/core/tasks/types';
import type { BalanceQueryQueueItem } from '@/modules/dashboard/progress/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskType } from '@/modules/core/tasks/task-type';
import { AddressStatus, AddressSubtype, type ChainProgress, type DecodingProgress, type LocationProgress, type ProtocolCacheProgress } from '@/modules/shell/sync-progress/types';
import { ActivityKind, type ActivityModel, ActivityPhase } from './core/types';

interface MockData {
  balances: BalanceQueryQueueItem[];
  chains: ChainProgress[];
  decoding: DecodingProgress[];
  historical: HistoricalBalanceProcessingData | undefined;
  prices: CommonQueryStatusData | undefined;
  pnl: PnlReportProgress;
  locations: LocationProgress[];
  protocolCache: ProtocolCacheProgress[];
  tasks: Task<TaskMeta>[];
}

interface SyncProgressSources {
  chains: Ref<ChainProgress[]>;
  decoding: Ref<DecodingProgress[]>;
  locations: Ref<LocationProgress[]>;
  protocolCache: Ref<ProtocolCacheProgress[]>;
}

const data = vi.hoisted((): MockData => ({
  balances: [],
  chains: [],
  decoding: [],
  historical: undefined,
  prices: undefined,
  pnl: { processingState: '', totalProgress: '' },
  locations: [],
  protocolCache: [],
  tasks: [],
}));

vi.mock('@/modules/shell/sync-progress/use-sync-progress', async () => {
  const { ref } = await import('vue');
  return {
    useSyncProgress: (): SyncProgressSources => ({
      chains: ref(data.chains),
      decoding: ref(data.decoding),
      locations: ref(data.locations),
      protocolCache: ref(data.protocolCache),
    }),
  };
});

vi.mock('@/modules/balances/use-balance-queue', async () => {
  const { ref } = await import('vue');
  return {
    useBalanceQueue: (): { queueItems: Ref<BalanceQueryQueueItem[]> } => ({
      queueItems: ref(data.balances),
    }),
  };
});

vi.mock('@/modules/history/balances/use-historical-balances-store', () => ({
  useHistoricalBalancesStore: (): { processingProgress: HistoricalBalanceProcessingData | undefined } => ({
    get processingProgress(): HistoricalBalanceProcessingData | undefined {
      return data.historical;
    },
  }),
}));

vi.mock('@/modules/assets/prices/use-historic-cache-price-store', () => ({
  useHistoricCachePriceStore: (): { historicalDailyPriceStatus: CommonQueryStatusData | undefined } => ({
    get historicalDailyPriceStatus(): CommonQueryStatusData | undefined {
      return data.prices;
    },
  }),
}));

vi.mock('@/modules/reports/use-reports-store', () => ({
  useReportsStore: (): { reportProgress: PnlReportProgress } => ({
    get reportProgress(): PnlReportProgress {
      return data.pnl;
    },
  }),
}));

vi.mock('@/modules/core/tasks/use-task-store', () => ({
  useTaskStore: (): { tasks: Task<TaskMeta>[] } => ({
    get tasks(): Task<TaskMeta>[] {
      return data.tasks;
    },
  }),
}));

async function buildModel(): Promise<ActivityModel> {
  vi.resetModules();
  const { useTaskCenter } = await import('./use-task-center');
  return get(useTaskCenter().model);
}

describe('useTaskCenter', () => {
  beforeEach(() => {
    data.balances = [];
    data.chains = [];
    data.decoding = [];
    data.historical = undefined;
    data.prices = undefined;
    data.pnl = { processingState: '', totalProgress: '' };
    data.locations = [];
    data.protocolCache = [];
    data.tasks = [];
  });

  it('should be idle with no current activity when nothing is happening', async () => {
    const model = await buildModel();
    expect(model.overall.phase).toBe(ActivityPhase.IDLE);
    expect(model.current).toBeUndefined();
    expect(model.groups).toStrictEqual([]);
  });

  it('should surface a running decoding activity from the sync source', async () => {
    data.decoding = [{ cancelled: false, chain: 'eth', processed: 5, progress: 50, total: 10 }];
    const model = await buildModel();
    expect(model.overall.phase).toBe(ActivityPhase.WORKING);
    expect(model.current?.kind).toBe(ActivityKind.TX_DECODING);
    expect(model.groups.map(g => g.kind)).toStrictEqual([ActivityKind.TX_DECODING]);
  });

  it('should surface balance queue items and prioritise them as current', async () => {
    data.balances = [{ addedAt: 1, chain: 'eth', id: 'eth', status: 'running', type: TaskType.QUERY_BLOCKCHAIN_BALANCES }];
    data.decoding = [{ cancelled: false, chain: 'eth', processed: 5, progress: 50, total: 10 }];
    const model = await buildModel();
    expect(model.groups.map(g => g.kind)).toStrictEqual([ActivityKind.BLOCKCHAIN_BALANCES, ActivityKind.TX_DECODING]);
    expect(model.current?.kind).toBe(ActivityKind.BLOCKCHAIN_BALANCES);
  });

  it('should surface historical balance processing from the store', async () => {
    data.historical = { processed: 2, total: 8 };
    const model = await buildModel();
    expect(model.groups.map(g => g.kind)).toStrictEqual([ActivityKind.HISTORICAL_BALANCES]);
    expect(model.current?.kind).toBe(ActivityKind.HISTORICAL_BALANCES);
  });

  it('should surface daily historic price querying from the price store', async () => {
    data.prices = { processed: 1, total: 4 };
    const model = await buildModel();
    expect(model.groups.map(g => g.kind)).toStrictEqual([ActivityKind.PRICES]);
  });

  it('should surface PnL report generation from the reports store', async () => {
    data.pnl = { processingState: 'Processing events', totalProgress: '30' };
    const model = await buildModel();
    expect(model.groups.map(g => g.kind)).toStrictEqual([ActivityKind.PNL_REPORT]);
    expect(model.current?.kind).toBe(ActivityKind.PNL_REPORT);
  });

  it('should surface uncovered backend tasks through the floor adapter', async () => {
    data.tasks = [{ id: 3, meta: { title: 'Fetching NFTs' }, time: 1000, type: TaskType.FETCH_NFTS }];
    const model = await buildModel();
    expect(model.groups.map(g => g.kind)).toStrictEqual([ActivityKind.OTHER]);
    expect(model.active[0].title).toBe('Fetching NFTs');
  });

  it('should exclude backend tasks already covered by a richer adapter', async () => {
    data.tasks = [{ id: 1, meta: { title: 'tx' }, time: 1000, type: TaskType.TX }];
    const model = await buildModel();
    expect(model.groups).toStrictEqual([]);
    expect(model.overall.phase).toBe(ActivityPhase.IDLE);
  });

  it('should order balances before decoding and pick the highest-priority current', async () => {
    data.chains = [{
      addresses: [{ address: '0xabc', status: AddressStatus.QUERYING, subtype: AddressSubtype.EVM }],
      cancelled: 0,
      chain: 'eth',
      completed: 0,
      inProgress: 1,
      pending: 0,
      progress: 0,
      total: 1,
    }];
    data.decoding = [{ cancelled: false, chain: 'eth', processed: 5, progress: 50, total: 10 }];
    const model = await buildModel();
    expect(model.groups.map(g => g.kind)).toStrictEqual([ActivityKind.TX_SYNC, ActivityKind.TX_DECODING]);
    expect(model.current?.kind).toBe(ActivityKind.TX_SYNC);
  });
});
