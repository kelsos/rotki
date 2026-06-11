import type { Task, TaskMeta } from '@/modules/core/tasks/types';
import { TaskType } from '@/modules/core/tasks/task-type';
import { INDETERMINATE } from '../status';
import { type Activity, type ActivityKind, ActivitySourceType, ActivityStatus, ActivityKind as Kind, makeActivityId, type TranslateFn } from '../types';

interface KindedTask {
  kind: ActivityKind;
  title: (t: TranslateFn) => string;
}

/**
 * In-flight backend tasks that have no richer status store but DO map to a meaningful
 * kind (so they shouldn't fall through to the generic OTHER floor). Title resolvers use
 * static i18n keys (no dynamic keys — see CLAUDE.md). The task id is universally
 * cancellable via the tasks API.
 */
const TASK_KINDS: Partial<Record<TaskType, KindedTask>> = {
  [TaskType.IMPORT_CSV]: { kind: Kind.CSV_IMPORT, title: t => t('task_center.activity.csv_import') },
  [TaskType.QUERY_EXCHANGE_BALANCES]: { kind: Kind.EXCHANGE_BALANCES, title: t => t('task_center.activity.exchange_balances') },
  [TaskType.REPULLING_TXS]: { kind: Kind.REPULLING, title: t => t('task_center.activity.repulling') },
};

/**
 * Maps in-flight tasks of a known {@link TASK_KINDS} type into activities with their
 * proper kind and a cancellable backend-task source. No per-task progress is reported,
 * so percentage is indeterminate.
 */
export function taskKindedActivities(tasks: Task<TaskMeta>[], t: TranslateFn): Activity[] {
  return tasks.flatMap((task) => {
    const kinded = TASK_KINDS[task.type];
    if (!kinded)
      return [];

    return [{
      cancellable: true,
      id: makeActivityId(kinded.kind, task.id),
      kind: kinded.kind,
      percentage: INDETERMINATE,
      rerunnable: false,
      source: { taskId: task.id, taskType: task.type, type: ActivitySourceType.BACKEND_TASK },
      startedAt: task.time,
      status: ActivityStatus.RUNNING,
      subtitle: task.meta.title,
      title: kinded.title(t),
    } satisfies Activity];
  });
}

/** The task types this adapter claims, so the floor can exclude them (keep in sync). */
export const TASK_KINDED_TYPES: ReadonlySet<TaskType> = new Set([
  TaskType.IMPORT_CSV,
  TaskType.QUERY_EXCHANGE_BALANCES,
  TaskType.REPULLING_TXS,
]);
