import type { BigNumber } from '@rotki/common';
import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue';
import type { NetValueChartData } from '@/modules/dashboard/graph/types';
import { useBalanceViewData } from '@/modules/balances/view/use-balance-view-data';
import { useHistoryNetValue } from '@/modules/dashboard/graph/use-history-net-value';
import { useStatisticsDataFetching } from '@/modules/statistics/use-statistics-data-fetching';
import { useStatisticsStore } from '@/modules/statistics/use-statistics-store';

interface UseDashboardNetValueReturn {
  /** The chart's series in the page's view. */
  readonly chartData: ComputedRef<NetValueChartData>;
  /** Net worth now in the page's view, the value the series ends on. */
  readonly netWorth: ComputedRef<BigNumber>;
  /** The History series is being fetched. */
  readonly loading: Readonly<Ref<boolean>>;
  /** Some points rest on a stand-in price or rate. */
  readonly hasEstimates: ComputedRef<boolean>;
  readonly estimatedAssets: ComputedRef<string[]>;
  readonly missingAssets: ComputedRef<string[]>;
  readonly processingRequired: Readonly<Ref<boolean>>;
  /** Why the series of the page's view could not be read, if it could not. */
  readonly chartError: ComputedRef<string | undefined>;
  /** Reads the series of the page's view again. */
  readonly retry: () => Promise<void>;
}

/**
 * The dashboard net value series for the page's view: snapshots of live balances in the Live view,
 * holdings derived from history in the History view.
 *
 * @param startingDate - first day of the selected timeframe, unix seconds
 * @param isHistory - whether the page shows the History view
 */
export function useDashboardNetValue(
  startingDate: MaybeRefOrGetter<number>,
  isHistory: ComputedRef<boolean>,
): UseDashboardNetValueReturn {
  const statisticsStore = useStatisticsStore();
  const { getNetValue } = statisticsStore;
  const { netValueError } = storeToRefs(statisticsStore);
  const { fetchNetValue } = useStatisticsDataFetching();
  const { netWorth } = useBalanceViewData(isHistory);
  const history = useHistoryNetValue(startingDate, isHistory, netWorth);

  const liveData = computed<NetValueChartData>(() => getNetValue(toValue(startingDate)));
  const chartData = computed<NetValueChartData>(() => (get(isHistory) ? get(history.chartData) : get(liveData)));
  const hasEstimates = computed<boolean>(() => get(chartData).estimated?.some(Boolean) === true);
  const chartError = computed<string | undefined>(() => (get(isHistory) ? get(history.error) : get(netValueError)));

  async function retry(): Promise<void> {
    if (get(isHistory))
      await history.refresh();
    else
      await fetchNetValue();
  }

  return {
    chartData,
    chartError,
    estimatedAssets: history.estimatedAssets,
    hasEstimates,
    loading: history.loading,
    missingAssets: history.missingAssets,
    netWorth,
    processingRequired: history.processingRequired,
    retry,
  };
}
