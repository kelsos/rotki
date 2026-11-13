import type { MaybeRefOrGetter } from 'vue';
import type { HistoricalNetValueResponse } from '@/modules/history/balances/types';
import type { BackfillDemand } from '@/modules/statistics/pricing/use-price-backfill';
import { BigNumber, PriceQuality, type ResolvedPrice } from '@rotki/common';
import { withSetup } from '@test/utils/with-setup';
import flushPromises from 'flush-promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HISTORY_NET_VALUE_DEMAND, useHistoryNetValue } from '@/modules/dashboard/graph/use-history-net-value';

const { fetchHistoricalNetValue, register, spam } = vi.hoisted(() => ({
  fetchHistoricalNetValue: vi.fn<(from: number, to: number) => Promise<HistoricalNetValueResponse>>(),
  register: vi.fn<(id: string, demand: MaybeRefOrGetter<BackfillDemand | undefined>) => void>(),
  spam: new Set<string>(['SPAM']),
}));

vi.mock('@/modules/balances/api/use-historical-balances-api', () => ({
  useHistoricalBalancesApi: (): { fetchHistoricalNetValue: typeof fetchHistoricalNetValue } => ({ fetchHistoricalNetValue }),
}));

vi.mock('@/modules/assets/use-asset-info-retrieval', () => ({
  useAssetInfoRetrieval: (): { getAssetInfo: (asset: string) => { isSpam: boolean } } => ({
    getAssetInfo: (asset: string): { isSpam: boolean } => ({ isSpam: spam.has(asset) }),
  }),
}));

vi.mock('@/modules/statistics/pricing/use-price-backfill', () => ({
  usePriceBackfill: (): { register: typeof register } => ({ register }),
}));

/** BTC is 100 on day one and carried on day two; ETH has no price at all. */
vi.mock('@/modules/statistics/pricing/use-price-series', async () => {
  const { computed } = await import('vue');
  return {
    usePriceSeries: (assets: MaybeRefOrGetter<readonly string[]>): { series: ComputedRef<ReadonlyMap<string, readonly ResolvedPrice[]>> } => ({
      series: computed(() => new Map(toValue(assets).map((asset): [string, ResolvedPrice[]] => [asset, asset === 'BTC'
        ? [{ price: new BigNumber(100), quality: PriceQuality.EXACT }, { price: new BigNumber(100), quality: PriceQuality.CARRIED }]
        : [{ price: undefined, quality: PriceQuality.MISSING }, { price: undefined, quality: PriceQuality.MISSING }]]))),
    }),
  };
});

const DAY = 86_400;

function amounts(values: Record<string, string>[]): HistoricalNetValueResponse['values'] {
  return values.map(day => Object.fromEntries(Object.entries(day).map(([asset, amount]) => [asset, new BigNumber(amount)])));
}

function registeredDemand(): BackfillDemand | undefined {
  const call = register.mock.calls.find(([id]) => id === HISTORY_NET_VALUE_DEMAND);
  return call ? toValue(call[1]) : undefined;
}

describe('modules/dashboard/graph/use-history-net-value', () => {
  beforeEach(() => {
    fetchHistoricalNetValue.mockReset();
    register.mockClear();
  });

  it('should fetch nothing while the History view is not showing', async () => {
    withSetup(() => useHistoryNetValue(DAY, false, new BigNumber(0)));
    await flushPromises();
    expect(fetchHistoricalNetValue).not.toHaveBeenCalled();
    expect(registeredDemand()).toBeUndefined();
  });

  it('should value each day, leave spam out and end on the History net worth now', async () => {
    fetchHistoricalNetValue.mockResolvedValue({
      processingRequired: true,
      times: [DAY, 2 * DAY],
      values: amounts([{ BTC: '1', SPAM: '1000' }, { BTC: '2', ETH: '5' }]),
    });
    const { result } = withSetup(() => useHistoryNetValue(DAY, true, new BigNumber(250)));
    await flushPromises();

    const data = get(result.chartData);
    expect(data.data.map(value => value.toFixed())).toEqual(['100', '200', '250']);
    expect(data.times.slice(0, 2)).toEqual([DAY, 2 * DAY]);
    expect(data.estimated).toEqual([false, true, false]);
    expect(data.snapshotCount).toBe(0);
    expect(get(result.estimatedAssets)).toEqual(['BTC']);
    expect(get(result.missingAssets)).toEqual(['ETH']);
    expect(get(result.processingRequired)).toBe(true);
  });

  it('should ask the backfill for the held assets, weighted by their largest value', async () => {
    fetchHistoricalNetValue.mockResolvedValue({ processingRequired: false, times: [DAY, 2 * DAY], values: amounts([{ BTC: '1' }, { BTC: '3' }]) });
    withSetup(() => useHistoryNetValue(DAY, true, new BigNumber(0)));
    await flushPromises();

    expect(registeredDemand()).toEqual({
      holdings: [{ asset: 'BTC', heldValue: new BigNumber(300) }],
      range: { end: 2 * DAY, start: DAY },
    });
  });

  it('should keep the error and clear it on a successful retry', async () => {
    fetchHistoricalNetValue.mockRejectedValueOnce(new Error('backend is down'));
    const { result } = withSetup(() => useHistoryNetValue(DAY, true, new BigNumber(0)));
    await flushPromises();
    expect(get(result.error)).toBe('backend is down');

    fetchHistoricalNetValue.mockResolvedValue({ processingRequired: false, times: [], values: [] });
    await result.refresh();
    expect(get(result.error)).toBeUndefined();
  });
});
