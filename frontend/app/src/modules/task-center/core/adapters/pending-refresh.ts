import { INDETERMINATE } from '../status';
import { type Activity, ActivityKind, ActivitySourceType, ActivityStatus, makeActivityId, type TranslateFn } from '../types';

const BLOCKCHAIN_PREFIX = 'blockchain:';
const EXCHANGE_PREFIX = 'exchange:';

/**
 * Maps the history refresh-state `pendingKeys` (accounts/exchanges detected mid-refresh
 * and queued, but not yet started) into PENDING activities. This is the partial pending
 * view: it surfaces queued work the status stores can't see because it hasn't started.
 *
 * Ids are the canonical tx-sync / exchange-events ids, so once the queued work starts
 * and the sync adapter emits the same id as RUNNING, the assembler's dedup keeps the
 * live one (see `dedupeById`). Pending items are not cancellable (nothing to cancel
 * yet).
 */
export function pendingRefreshActivities(pendingKeys: string[], t: TranslateFn): Activity[] {
  return pendingKeys.map(key => toActivity(key, t)).filter((activity): activity is Activity => activity !== undefined);
}

function toActivity(key: string, t: TranslateFn): Activity | undefined {
  if (key.startsWith(BLOCKCHAIN_PREFIX)) {
    const [chain, address] = splitFirst(key.slice(BLOCKCHAIN_PREFIX.length));
    if (!chain || !address)
      return undefined;

    return {
      cancellable: false,
      id: makeActivityId(ActivityKind.TX_SYNC, chain, address),
      kind: ActivityKind.TX_SYNC,
      percentage: INDETERMINATE,
      rerunnable: false,
      source: { address, chain, type: ActivitySourceType.TX_SYNC },
      status: ActivityStatus.PENDING,
      subtitle: address,
      title: t('task_center.activity.tx_sync'),
    } satisfies Activity;
  }

  if (key.startsWith(EXCHANGE_PREFIX)) {
    const [location, name] = splitFirst(key.slice(EXCHANGE_PREFIX.length));
    if (!location || !name)
      return undefined;

    return {
      cancellable: false,
      id: makeActivityId(ActivityKind.EXCHANGE_EVENTS, location, name),
      kind: ActivityKind.EXCHANGE_EVENTS,
      percentage: INDETERMINATE,
      rerunnable: false,
      source: { location, name, type: ActivitySourceType.EXCHANGE_EVENTS },
      status: ActivityStatus.PENDING,
      subtitle: name,
      title: t('task_center.activity.exchange_events'),
    } satisfies Activity;
  }

  return undefined;
}

/** Splits on the first colon only — addresses/names never contain a leading colon. */
function splitFirst(value: string): [string, string] {
  const index = value.indexOf(':');
  if (index === -1)
    return [value, ''];

  return [value.slice(0, index), value.slice(index + 1)];
}
