import type { NetValueChartData } from '@/modules/dashboard/graph/types';
import { BigNumber } from '@rotki/common';
import { withSetup } from '@test/utils/with-setup';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDashboardNetValue } from '@/modules/dashboard/graph/use-dashboard-net-value';
import { useStatisticsStore } from '@/modules/statistics/use-statistics-store';

const { fetchNetValue, history } = await vi.hoisted(async () => {
  const { computed: createComputed, ref: createRef } = await import('vue');
  const { BigNumber: Big } = await import('@rotki/common');
  return {
    fetchNetValue: vi.fn<() => Promise<void>>(async () => {}),
    history: {
      chartData: createComputed<NetValueChartData>(() => ({ data: [new Big(7)], estimated: [true], snapshotCount: 0, times: [1] })),
      error: createRef<string>('history failed'),
      estimatedAssets: createComputed<string[]>(() => ['BTC']),
      loading: createRef<boolean>(false),
      missingAssets: createComputed<string[]>(() => []),
      processingRequired: createRef<boolean>(false),
      refresh: vi.fn<() => Promise<void>>(async () => {}),
    },
  };
});

vi.mock('@/modules/dashboard/graph/use-history-net-value', () => ({
  useHistoryNetValue: (): typeof history => history,
}));

vi.mock('@/modules/statistics/use-statistics-data-fetching', () => ({
  useStatisticsDataFetching: (): { fetchNetValue: typeof fetchNetValue } => ({ fetchNetValue }),
}));

vi.mock('@/modules/balances/view/use-balance-view-data', async () => {
  const { computed: createComputed } = await import('vue');
  return { useBalanceViewData: (): { netWorth: ComputedRef<BigNumber> } => ({ netWorth: createComputed<BigNumber>(() => new BigNumber(0)) }) };
});

describe('modules/dashboard/graph/use-dashboard-net-value', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    fetchNetValue.mockClear();
    history.refresh.mockClear();
  });

  it('should plot snapshots, report their read error and re-read them in the Live view', async () => {
    useStatisticsStore().setNetValueError('snapshots failed');
    const { result } = withSetup(() => useDashboardNetValue(0, computed<boolean>(() => false)));

    expect(get(result.chartData).snapshotCount).toBe(0);
    expect(get(result.chartData).data.at(-1)?.toFixed()).toBe('0');
    expect(get(result.chartError)).toBe('snapshots failed');
    expect(get(result.hasEstimates)).toBe(false);

    await result.retry();
    expect(fetchNetValue).toHaveBeenCalledOnce();
    expect(history.refresh).not.toHaveBeenCalled();
  });

  it('should plot the history series, report its error and re-read it in the History view', async () => {
    const { result } = withSetup(() => useDashboardNetValue(0, computed<boolean>(() => true)));

    expect(get(result.chartData).data.map(value => value.toFixed())).toEqual(['7']);
    expect(get(result.chartError)).toBe('history failed');
    expect(get(result.hasEstimates)).toBe(true);

    await result.retry();
    expect(history.refresh).toHaveBeenCalledOnce();
    expect(fetchNetValue).not.toHaveBeenCalled();
  });
});
