import type { ComputedRef } from 'vue';
import { type HistoryNetValue, type HistoryNetValueApi, PriceQuality, type PriceSeriesApi, type ResolvedPrice, type StatisticsApi } from '@rotki/common';
import { CURRENCY_USD } from '@/modules/assets/amount-display/currencies';
import { useBalanceView } from '@/modules/balances/view/use-balance-view';
import { useBalanceViewData } from '@/modules/balances/view/use-balance-view-data';
import { useHistoryNetValue } from '@/modules/dashboard/graph/use-history-net-value';
import { usePriceBackfill } from '@/modules/statistics/pricing/use-price-backfill';
import { usePriceSeries } from '@/modules/statistics/pricing/use-price-series';

type PricingApi = Pick<StatisticsApi, 'historyNetValue' | 'priceBackfill' | 'priceSeries' | 'usdRateAt'>;

const MISSING: ResolvedPrice = { price: undefined, quality: PriceQuality.MISSING };

let premiumDemands = 0;

/**
 * The historic pricing the premium graphs share with the dashboard.
 *
 * @remarks
 * Everything here goes through `usePriceSeries` and `usePriceBackfill`, so a premium graph fills
 * gaps, flags estimates and fetches missing prices exactly as the dashboard does, and a price one
 * of them fetches sharpens the other.
 */
export function pricingApi(): PricingApi {
  const backfill = usePriceBackfill();

  return {
    historyNetValue: (startingDate): HistoryNetValueApi => {
      const { available } = useBalanceView();
      const { netWorth } = useBalanceViewData(computed<boolean>(() => true));
      const backfillId = `premium-net-value-${++premiumDemands}`;
      const history = useHistoryNetValue(startingDate, available, netWorth, backfillId);
      return {
        backfillId,
        data: computed<HistoryNetValue>(() => {
          const { data, estimated = [], missing = [], times } = get(history.chartData);
          return { data, estimated, missing, times };
        }),
        estimatedAssets: history.estimatedAssets,
        loading: history.loading,
        missingAssets: history.missingAssets,
        processingRequired: history.processingRequired,
      };
    },
    priceBackfill: {
      automatic: backfill.automatic,
      fetchMissing: backfill.fetchMissing,
      manualTarget: backfill.manualTarget,
      register: backfill.register,
      running: backfill.running,
      stop: backfill.stop,
    },
    priceSeries: (asset, times): PriceSeriesApi => {
      const { series } = usePriceSeries(() => [toValue(asset)], times);
      return { prices: computed<readonly ResolvedPrice[]>(() => get(series).get(toValue(asset)) ?? []) };
    },
    usdRateAt: (timestamp): ComputedRef<ResolvedPrice> => {
      const { series } = usePriceSeries([CURRENCY_USD], () => [toValue(timestamp)]);
      return computed<ResolvedPrice>(() => get(series).get(CURRENCY_USD)?.[0] ?? MISSING);
    },
  };
}
