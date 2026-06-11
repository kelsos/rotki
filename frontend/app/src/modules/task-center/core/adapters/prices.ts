import type { CommonQueryStatusData } from '@rotki/common';
import type { StatsPriceQueryData } from '@/modules/core/messaging/types';
import { percentageFromSteps } from '../status';
import { type Activity, ActivityKind, ActivitySourceType, ActivityStatus, makeActivityId, type TranslateFn } from '../types';

/** The three price-query progress streams the historic-cache price store tracks. */
export interface PriceSources {
  /** Daily historic price query (HISTORICAL_PRICE_QUERY_STATUS). */
  daily?: CommonQueryStatusData;
  /** Multiple/historical price query (MULTIPLE_PRICES_QUERY_STATUS). */
  historical?: CommonQueryStatusData;
  /** Per-counterparty stats price queries (STATS_PRICE_QUERY). */
  stats: Record<string, StatsPriceQueryData>;
}

/**
 * Maps the price-query progress streams into prices activities. Each stream becomes a
 * distinct activity (distinct id) under the PRICES kind: daily, multiple/historical and
 * one per stats counterparty. Informational, websocket-driven progress with no control
 * path → INFO source, non-cancellable/non-rerunnable. Streams with no data (total 0)
 * are omitted.
 */
export function priceActivities(sources: PriceSources, t: TranslateFn): Activity[] {
  const title = t('task_center.activity.prices');
  const activities: Activity[] = [];

  const daily = toPriceActivity('daily', sources.daily, undefined, title);
  if (daily)
    activities.push(daily);

  const historical = toPriceActivity('historical', sources.historical, undefined, title);
  if (historical)
    activities.push(historical);

  for (const [counterparty, status] of Object.entries(sources.stats)) {
    const stat = toPriceActivity(`stats:${counterparty}`, status, counterparty, title);
    if (stat)
      activities.push(stat);
  }

  return activities;
}

function toPriceActivity(
  idKey: string,
  status: CommonQueryStatusData | undefined,
  subtitle: string | undefined,
  title: string,
): Activity | undefined {
  if (!status || status.total === 0)
    return undefined;

  const complete = status.processed >= status.total;
  return {
    cancellable: false,
    id: makeActivityId(ActivityKind.PRICES, idKey),
    kind: ActivityKind.PRICES,
    percentage: percentageFromSteps(status.processed, status.total),
    rerunnable: false,
    source: { key: `prices:${idKey}`, type: ActivitySourceType.INFO },
    status: complete ? ActivityStatus.COMPLETE : ActivityStatus.RUNNING,
    steps: { current: status.processed, total: status.total },
    subtitle,
    title,
  } satisfies Activity;
}
