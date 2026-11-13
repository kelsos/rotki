import { bigNumberify, PriceQuality, type ResolvedPrice } from '@rotki/common';
import { describe, expect, it } from 'vitest';
import { buildNetValueSeries, isEstimatedPoint } from '@/modules/statistics/pricing/net-value-series';

function priced(price: number, quality: ResolvedPrice['quality'] = PriceQuality.EXACT): ResolvedPrice {
  return { price: bigNumberify(price), quality };
}

const missing: ResolvedPrice = { price: undefined, quality: PriceQuality.MISSING };

describe('modules/statistics/pricing/net-value-series', () => {
  it('should sum each day\'s holdings at that day\'s prices', () => {
    const [day] = buildNetValueSeries(
      { amounts: [{ BTC: bigNumberify(2), ETH: bigNumberify(10) }], times: [100] },
      new Map([['BTC', [priced(30)]], ['ETH', [priced(2)]]]),
    );
    expect(day.value?.toFixed()).toBe('80');
    expect(day.estimatedShare).toBe(0);
    expect(isEstimatedPoint(day)).toBe(false);
  });

  it('should leave a missing asset out of the total and list it', () => {
    const [day] = buildNetValueSeries(
      { amounts: [{ BTC: bigNumberify(1), SPAM: bigNumberify(1000) }], times: [100] },
      new Map([['BTC', [priced(30)]], ['SPAM', [missing]]]),
    );
    expect(day.value?.toFixed()).toBe('30');
    expect(day.missingAssets).toEqual(['SPAM']);
    expect(isEstimatedPoint(day)).toBe(false);
  });

  it('should make a day with nothing priced a gap instead of zero', () => {
    const [day] = buildNetValueSeries(
      { amounts: [{ BTC: bigNumberify(1) }], times: [100] },
      new Map([['BTC', [missing]]]),
    );
    expect(day.value).toBeNull();
  });

  it('should value a day with no holdings at zero', () => {
    const [day] = buildNetValueSeries({ amounts: [{}], times: [100] }, new Map());
    expect(day.value?.toFixed()).toBe('0');
  });

  it('should report the share of value priced by a stand-in', () => {
    const [day] = buildNetValueSeries(
      { amounts: [{ BTC: bigNumberify(1), ETH: bigNumberify(1) }], times: [100] },
      new Map([['BTC', [priced(75)]], ['ETH', [priced(25, PriceQuality.CARRIED)]]]),
    );
    expect(day.estimatedShare).toBe(0.25);
    expect(day.estimatedAssets).toEqual(['ETH']);
  });

  it('should only call a point estimated above the threshold', () => {
    const [day] = buildNetValueSeries(
      { amounts: [{ BTC: bigNumberify(1), ETH: bigNumberify(1) }], times: [100] },
      new Map([['BTC', [priced(995)]], ['ETH', [priced(5, PriceQuality.CURRENT)]]]),
    );
    expect(isEstimatedPoint(day)).toBe(false);
    expect(isEstimatedPoint(day, 0.001)).toBe(true);
  });
});
