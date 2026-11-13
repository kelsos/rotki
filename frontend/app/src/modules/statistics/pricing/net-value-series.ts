import { type BigNumber, Zero } from '@rotki/common';
import { isFallbackQuality, PriceQuality, type ResolvedPrice } from '@/modules/statistics/pricing/price-series';

/** Above this share of a point's value priced by a stand-in, the point is drawn as estimated. */
export const ESTIMATED_SHARE_THRESHOLD = 0.01;

export interface DailyAmounts {
  /** Day starts, unix seconds. */
  readonly times: readonly number[];
  /** Amount held per asset, one record per entry of `times`. */
  readonly amounts: readonly Readonly<Record<string, BigNumber>>[];
}

export interface NetValuePoint {
  readonly time: number;
  /** Null when nothing held that day could be priced: a gap, never zero. */
  readonly value: BigNumber | null;
  /** Share of `value` priced by a stand-in (carried, back-filled or current), 0 to 1. */
  readonly estimatedShare: number;
  /** Assets valued at a stand-in price that day. */
  readonly estimatedAssets: readonly string[];
  /** Assets held that day with no price at all, left out of `value`. */
  readonly missingAssets: readonly string[];
}

/** Whether a point should be drawn and labelled as estimated. */
export function isEstimatedPoint(point: NetValuePoint, threshold: number = ESTIMATED_SHARE_THRESHOLD): boolean {
  return point.missingAssets.length > 0 || point.estimatedShare > threshold;
}

interface DayTotals {
  value: BigNumber;
  estimatedValue: BigNumber;
  priced: number;
  readonly estimatedAssets: string[];
  readonly missingAssets: string[];
}

function addHolding(totals: DayTotals, asset: string, amount: BigNumber, resolved: ResolvedPrice | undefined): void {
  if (!resolved?.price || resolved.quality === PriceQuality.MISSING) {
    totals.missingAssets.push(asset);
    return;
  }
  const assetValue = amount.multipliedBy(resolved.price);
  totals.value = totals.value.plus(assetValue);
  totals.priced += 1;
  if (isFallbackQuality(resolved.quality)) {
    totals.estimatedValue = totals.estimatedValue.plus(assetValue.abs());
    totals.estimatedAssets.push(asset);
  }
}

/** Values one day's holdings, reading each asset's price for that day from `priceOf`. */
function valueDay(
  time: number,
  holdings: Readonly<Record<string, BigNumber>>,
  priceOf: (asset: string) => ResolvedPrice | undefined,
): NetValuePoint {
  const totals: DayTotals = { estimatedAssets: [], estimatedValue: Zero, missingAssets: [], priced: 0, value: Zero };
  for (const [asset, amount] of Object.entries(holdings)) {
    if (!amount.isZero())
      addHolding(totals, asset, amount, priceOf(asset));
  }

  const gross = totals.value.abs();
  return {
    estimatedAssets: totals.estimatedAssets,
    estimatedShare: gross.isZero() ? 0 : Math.min(1, totals.estimatedValue.dividedBy(gross).toNumber()),
    missingAssets: totals.missingAssets,
    time,
    value: totals.priced === 0 && totals.missingAssets.length > 0 ? null : totals.value,
  };
}

/**
 * Values each day's holdings at the resolved prices.
 *
 * @param daily - amounts per asset per day
 * @param prices - per asset, one resolved price per entry of `daily.times`
 */
export function buildNetValueSeries(
  daily: DailyAmounts,
  prices: ReadonlyMap<string, readonly ResolvedPrice[]>,
): NetValuePoint[] {
  return daily.times.map((time, index) =>
    valueDay(time, daily.amounts[index] ?? {}, asset => prices.get(asset)?.[index]));
}
