import type { Task, TaskMeta } from '@/modules/core/tasks/types';
import { TaskType } from '@/modules/core/tasks/task-type';
import { INDETERMINATE } from '../status';
import { type Activity, ActivityKind, ActivitySourceType, ActivityStatus, makeActivityId, type TranslateFn } from '../types';

/**
 * Task types already surfaced by a dedicated, richer adapter. The floor skips these
 * so the same work is not shown twice. As specialized adapters land (balances,
 * prices, …) their task types are added here.
 */
const COVERED_TASK_TYPES: ReadonlySet<TaskType> = new Set([
  TaskType.TX,
  TaskType.TRANSACTIONS_DECODING,
  TaskType.ETH_BLOCK_EVENTS_DECODING,
  TaskType.QUERY_EXCHANGE_EVENTS,
  TaskType.QUERY_ONLINE_EVENTS,
  TaskType.QUERY_BLOCKCHAIN_BALANCES,
  TaskType.QUERY_EXCHANGE_BALANCES,
  TaskType.FETCH_DETECTED_TOKENS,
  TaskType.PROCESS_HISTORICAL_BALANCES,
  TaskType.QUERY_HISTORICAL_BALANCE_SERIES,
  TaskType.FETCH_DAILY_HISTORIC_PRICE,
  TaskType.TRADE_HISTORY,
]);

/**
 * The read-model floor: maps every in-flight backend task that has no richer adapter
 * into a generic running activity, so nothing running is ever invisible. Tasks in the
 * store are in-flight, hence always running; the backend task id is universally
 * cancellable via the tasks API.
 */
export function backendTaskActivities(tasks: Task<TaskMeta>[], t: TranslateFn): Activity[] {
  return tasks
    .filter(task => !COVERED_TASK_TYPES.has(task.type))
    .map(task => ({
      cancellable: true,
      id: makeActivityId(ActivityKind.OTHER, task.id),
      kind: ActivityKind.OTHER,
      percentage: INDETERMINATE,
      rerunnable: false,
      source: { taskId: task.id, taskType: task.type, type: ActivitySourceType.BACKEND_TASK },
      startedAt: task.time,
      status: ActivityStatus.RUNNING,
      subtitle: task.meta.description,
      title: task.meta.title || t('task_center.activity.background_task'),
    } satisfies Activity));
}
