import type { NetValueChartData } from '@/modules/dashboard/graph/types';
import { BigNumber, PriceQuality, type ResolvedPrice } from '@rotki/common';
import { withSetup } from '@test/utils/with-setup';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pricingApi } from '@/modules/premium/premium-pricing-apis';

interface SeriesCall {
  assets: readonly string[];
  times: readonly number[];
}

const { seriesCalls, historyCalls } = vi.hoisted(() => {
  const series: SeriesCall[] = [];
  const history: string[] = [];
  return { historyCalls: history, seriesCalls: series };
});

const exact = (price: string): ResolvedPrice => ({ price: new BigNumber(price), quality: PriceQuality.EXACT });

vi.mock('@/modules/statistics/pricing/use-price-series', async () => {
  const { computed: createComputed } = await import('vue');
  return {
    usePriceSeries: (assets: MaybeRefOrGetter<readonly string[]>, times: MaybeRefOrGetter<readonly number[]>): { series: ComputedRef<ReadonlyMap<string, readonly ResolvedPrice[]>> } => {
      seriesCalls.push({ assets: toValue(assets), times: toValue(times) });
      return {
        series: createComputed(() => new Map(toValue(assets).map((asset): [string, ResolvedPrice[]] => [asset, toValue(times).map(() => exact(asset === 'USD' ? '0.9' : '100'))]))),
      };
    },
  };
});

vi.mock('@/modules/dashboard/graph/use-history-net-value', async () => {
  const { computed: createComputed, ref: createRef } = await import('vue');
  return {
    useHistoryNetValue: (_start: unknown, _enabled: unknown, _netWorth: unknown, demandId: string): Record<string, unknown> => {
      historyCalls.push(demandId);
      return {
        chartData: createComputed<NetValueChartData>(() => ({ data: [new BigNumber(1)], estimated: [true], snapshotCount: 0, times: [10] })),
        estimatedAssets: createComputed<string[]>(() => []),
        loading: createRef<boolean>(false),
        missingAssets: createComputed<string[]>(() => []),
        processingRequired: createRef<boolean>(false),
      };
    },
  };
});

vi.mock('@/modules/balances/view/use-balance-view', async () => {
  const { computed: createComputed } = await import('vue');
  return { useBalanceView: (): { available: ComputedRef<boolean> } => ({ available: createComputed<boolean>(() => true) }) };
});

vi.mock('@/modules/balances/view/use-balance-view-data', async () => {
  const { computed: createComputed } = await import('vue');
  return { useBalanceViewData: (): { netWorth: ComputedRef<BigNumber> } => ({ netWorth: createComputed<BigNumber>(() => new BigNumber(0)) }) };
});

vi.mock('@/modules/statistics/pricing/use-price-backfill', () => ({
  usePriceBackfill: (): Record<string, unknown> => ({}),
}));

describe('modules/premium/premium-pricing-apis', () => {
  beforeEach(() => {
    seriesCalls.length = 0;
    historyCalls.length = 0;
  });

  it('should price one asset at the requested times through the shared price series', () => {
    const { result } = withSetup(() => pricingApi().priceSeries('ETH', [1, 2]));
    expect(seriesCalls).toEqual([{ assets: ['ETH'], times: [1, 2] }]);
    expect(get(result.prices)).toEqual([exact('100'), exact('100')]);
  });

  it('should give the USD rate at one time', () => {
    const { result } = withSetup(() => pricingApi().usdRateAt(5));
    expect(seriesCalls).toEqual([{ assets: ['USD'], times: [5] }]);
    expect(get(result)).toEqual(exact('0.9'));
  });

  it('should register each premium history chart under its own backfill demand', () => {
    const { result } = withSetup(() => {
      const api = pricingApi();
      return [api.historyNetValue(0), api.historyNetValue(0)];
    });
    const [first, second] = result;
    expect(first.backfillId).not.toBe(second.backfillId);
    expect(historyCalls).toEqual([first.backfillId, second.backfillId]);
    expect(get(first.data)).toEqual({ data: [new BigNumber(1)], estimated: [true], missing: [], times: [10] });
  });
});
