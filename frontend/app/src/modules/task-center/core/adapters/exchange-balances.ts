import type { Task, TaskMeta } from '@/modules/core/tasks/types';
import { TaskType } from '@/modules/core/tasks/task-type';
import { INDETERMINATE } from '../status';
import { type Activity, ActivityKind, ActivitySourceType, ActivityStatus, makeActivityId, type TranslateFn } from '../types';

/**
 * Maps in-flight exchange-balance query tasks into activities. Exchange balances have
 * no richer status store, so this reads the task store directly and gives them the
 * proper kind plus a cancellable backend-task source (unlike the generic floor, which
 * would render them as OTHER). No per-query progress is reported, so percentage is
 * indeterminate.
 */
export function exchangeBalanceActivities(tasks: Task<TaskMeta>[], t: TranslateFn): Activity[] {
  return tasks
    .filter(task => task.type === TaskType.QUERY_EXCHANGE_BALANCES)
    .map(task => ({
      cancellable: true,
      id: makeActivityId(ActivityKind.EXCHANGE_BALANCES, task.id),
      kind: ActivityKind.EXCHANGE_BALANCES,
      percentage: INDETERMINATE,
      rerunnable: false,
      source: { taskId: task.id, taskType: task.type, type: ActivitySourceType.BACKEND_TASK },
      startedAt: task.time,
      status: ActivityStatus.RUNNING,
      subtitle: task.meta.title,
      title: t('task_center.activity.exchange_balances'),
    } satisfies Activity));
}
