import type { TaskType } from '@/modules/core/tasks/task-type';
import { type Brand, make } from 'plainfp/brand';

/**
 * Injected translator. Adapters stay pure (no `useI18n`) by receiving this; the
 * reactive shell passes the real `t`, specs pass a fake one.
 */
export type TranslateFn = (key: string, params?: Record<string, unknown>) => string;

/**
 * Deterministic identity for an activity. Always derived from its source
 * (`${kind}:${sourceKey}`), never random — see {@link makeActivityId}. A stable id
 * keeps Vue `:key`s stable across re-renders, makes deduplication free (same work →
 * same id) and lets the controller target an item.
 */
export type ActivityId = Brand<string, 'ActivityId'>;

/**
 * The category of long-running work an activity represents. Enumerified as `const`
 * so there are no magic strings at any call site.
 */
export const ActivityKind = {
  BLOCKCHAIN_BALANCES: 'blockchain-balances',
  EXCHANGE_BALANCES: 'exchange-balances',
  TOKEN_DETECTION: 'token-detection',
  TX_SYNC: 'tx-sync',
  TX_DECODING: 'tx-decoding',
  EXCHANGE_EVENTS: 'exchange-events',
  ONLINE_EVENTS: 'online-events',
  PROTOCOL_CACHE: 'protocol-cache',
  PRICES: 'prices',
  HISTORICAL_BALANCES: 'historical-balances',
  PNL_REPORT: 'pnl-report',
  DB_UPGRADE: 'db-upgrade',
  DATA_MIGRATION: 'data-migration',
  OTHER: 'other',
} as const;

export type ActivityKind = (typeof ActivityKind)[keyof typeof ActivityKind];

export const ActivityStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETE: 'complete',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
} as const;

export type ActivityStatus = (typeof ActivityStatus)[keyof typeof ActivityStatus];

export const ActivityPhase = {
  IDLE: 'idle',
  WORKING: 'working',
  DONE: 'done',
} as const;

export type ActivityPhase = (typeof ActivityPhase)[keyof typeof ActivityPhase];

/**
 * Discriminant for {@link ActivitySource}. Enumerified so the read-model adapters
 * and the controller both `switch` on constants rather than literals.
 */
export const ActivitySourceType = {
  TX_SYNC: 'tx-sync',
  DECODING: 'decoding',
  EXCHANGE_EVENTS: 'exchange-events',
  PROTOCOL_CACHE: 'protocol-cache',
  BALANCE_QUERY: 'balance-query',
  BACKEND_TASK: 'backend-task',
  REQUEST_TAG: 'request-tag',
} as const;

export type ActivitySourceType = (typeof ActivitySourceType)[keyof typeof ActivitySourceType];

/**
 * Carries exactly what {@link useTaskController} needs to cancel/re-run an item.
 * A discriminated union: render and control both narrow on `type` with no casts.
 */
export type ActivitySource =
  | { type: typeof ActivitySourceType.TX_SYNC; chain: string; address: string }
  | { type: typeof ActivitySourceType.DECODING; chain: string }
  | { type: typeof ActivitySourceType.EXCHANGE_EVENTS; location: string; name: string }
  | { type: typeof ActivitySourceType.PROTOCOL_CACHE; chain: string; protocol: string }
  | { type: typeof ActivitySourceType.BALANCE_QUERY; taskType: TaskType; chain: string; address?: string }
  | { type: typeof ActivitySourceType.BACKEND_TASK; taskId: number; taskType: TaskType }
  | { type: typeof ActivitySourceType.REQUEST_TAG; tag: string };

/** Naive, step-based progress — the model already used by PnL and db-upgrade UIs. */
export interface ActivitySteps {
  current: number;
  total: number;
}

export interface Activity {
  readonly id: ActivityId;
  readonly kind: ActivityKind;
  /** i18n, human readable. */
  readonly title: string;
  /** Optional context, e.g. chain / address / location. */
  readonly subtitle?: string;
  readonly status: ActivityStatus;
  readonly steps?: ActivitySteps;
  /** Derived 0-100; `-1` for indeterminate kinds. */
  readonly percentage: number;
  /** Whether the controller knows how to cancel this item. */
  readonly cancellable: boolean;
  readonly rerunnable: boolean;
  readonly source: ActivitySource;
  readonly startedAt?: number;
}

export interface ActivityGroup {
  readonly kind: ActivityKind;
  readonly title: string;
  readonly activities: Activity[];
  /** Rolled up from {@link activities}. */
  readonly status: ActivityStatus;
  /** Rolled up 0-100; `-1` when indeterminate. */
  readonly percentage: number;
}

export interface ActivityOverall {
  readonly percentage: number;
  readonly phase: ActivityPhase;
}

export interface ActivityModel {
  readonly groups: ActivityGroup[];
  /** Flat, currently running. */
  readonly active: Activity[];
  /** Flat, waiting to start (partial until the Layer C scheduler lands). */
  readonly pending: Activity[];
  readonly overall: ActivityOverall;
  /** The single activity the header bar labels; see selection rule in the plan. */
  readonly current?: Activity;
}

const ACTIVITY_ID_SEPARATOR = ':';

/**
 * Builds a deterministic {@link ActivityId} from a kind and the parts that make the
 * underlying work unique (e.g. chain, address). The same work always yields the same
 * id, which is what makes dedup and stable rendering work.
 */
export function makeActivityId(kind: ActivityKind, ...keyParts: (string | number)[]): ActivityId {
  return make<string, 'ActivityId'>([kind, ...keyParts].join(ACTIVITY_ID_SEPARATOR));
}
