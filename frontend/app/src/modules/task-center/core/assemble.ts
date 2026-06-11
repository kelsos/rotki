import { INDETERMINATE, rollupPercentage, rollupStatus } from './status';
import { type Activity, type ActivityGroup, type ActivityKind, type ActivityModel, type ActivityPhase, ActivityStatus, ActivityKind as Kind, ActivityPhase as Phase, type TranslateFn } from './types';

/**
 * Display + selection priority for kinds (highest first). Drives group ordering and
 * which running activity the header bar labels (`current`). Mirrors the existing
 * `use-unified-progress` precedence (balances before history).
 */
const KIND_PRIORITY: readonly ActivityKind[] = [
  Kind.BLOCKCHAIN_BALANCES,
  Kind.TOKEN_DETECTION,
  Kind.EXCHANGE_BALANCES,
  Kind.TX_SYNC,
  Kind.TX_DECODING,
  Kind.EXCHANGE_EVENTS,
  Kind.ONLINE_EVENTS,
  Kind.PROTOCOL_CACHE,
  Kind.PRICES,
  Kind.PNL_REPORT,
  Kind.HISTORICAL_BALANCES,
  Kind.DB_UPGRADE,
  Kind.DATA_MIGRATION,
  Kind.OTHER,
];

function kindRank(kind: ActivityKind): number {
  const index = KIND_PRIORITY.indexOf(kind);
  return index === -1 ? KIND_PRIORITY.length : index;
}

/** Stable ordering: by kind priority, then by start time, then by id. */
function compareActivities(a: Activity, b: Activity): number {
  const byKind = kindRank(a.kind) - kindRank(b.kind);
  if (byKind !== 0)
    return byKind;

  const byStart = (a.startedAt ?? 0) - (b.startedAt ?? 0);
  if (byStart !== 0)
    return byStart;

  return a.id.localeCompare(b.id);
}

/**
 * Per-kind group title resolvers. Each calls `t` with a STATIC literal key (no
 * dynamic i18n keys — see CLAUDE.md). Kinds absent here fall back to the first
 * activity's title so a group is never blank. Entries are added as adapters land.
 */
const GROUP_TITLE: Partial<Record<ActivityKind, (t: TranslateFn) => string>> = {
  [Kind.BLOCKCHAIN_BALANCES]: t => t('task_center.group.blockchain_balances'),
  [Kind.EXCHANGE_EVENTS]: t => t('task_center.group.exchange_events'),
  [Kind.HISTORICAL_BALANCES]: t => t('task_center.group.historical_balances'),
  [Kind.OTHER]: t => t('task_center.group.other'),
  [Kind.PRICES]: t => t('task_center.group.prices'),
  [Kind.PROTOCOL_CACHE]: t => t('task_center.group.protocol_cache'),
  [Kind.TOKEN_DETECTION]: t => t('task_center.group.token_detection'),
  [Kind.TX_DECODING]: t => t('task_center.group.tx_decoding'),
  [Kind.TX_SYNC]: t => t('task_center.group.tx_sync'),
};

function groupTitle(kind: ActivityKind, activities: Activity[], t: TranslateFn): string {
  return GROUP_TITLE[kind]?.(t) ?? activities[0]?.title ?? kind;
}

function toGroup(kind: ActivityKind, activities: Activity[], t: TranslateFn): ActivityGroup {
  const sorted = [...activities].sort(compareActivities);
  return {
    activities: sorted,
    kind,
    percentage: rollupPercentage(sorted.map(a => a.percentage)),
    status: rollupStatus(sorted.map(a => a.status)),
    title: groupTitle(kind, sorted, t),
  };
}

function phaseOf(activities: Activity[]): ActivityPhase {
  if (activities.length === 0)
    return Phase.IDLE;
  if (activities.some(a => a.status === ActivityStatus.RUNNING || a.status === ActivityStatus.PENDING))
    return Phase.WORKING;

  return Phase.DONE;
}

/**
 * Pure assembly of the flat activity list into the render model: groups (ordered by
 * kind priority), the active/pending splits, the overall rollup + phase, and the
 * single `current` activity the header bar labels. No Vue, no stores — unit-tested
 * with literal inputs.
 */
export function assembleActivityModel(activities: Activity[], t: TranslateFn): ActivityModel {
  const byKind = new Map<ActivityKind, Activity[]>();
  for (const activity of activities) {
    const bucket = byKind.get(activity.kind) ?? [];
    bucket.push(activity);
    byKind.set(activity.kind, bucket);
  }

  const groups = [...byKind.entries()]
    .map(([kind, group]) => toGroup(kind, group, t))
    .sort((a, b) => kindRank(a.kind) - kindRank(b.kind));

  const ordered = [...activities].sort(compareActivities);
  const active = ordered.filter(a => a.status === ActivityStatus.RUNNING);
  const pending = ordered.filter(a => a.status === ActivityStatus.PENDING);

  const overallPercentage = rollupPercentage(groups.map(g => g.percentage));
  const current = active[0] ?? pending[0];

  return {
    active,
    current,
    groups,
    overall: {
      percentage: overallPercentage === INDETERMINATE ? 0 : overallPercentage,
      phase: phaseOf(activities),
    },
    pending,
  };
}
