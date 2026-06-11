import type { BalanceQueryQueueItem } from '@/modules/dashboard/progress/types';
import { TaskType } from '@/modules/core/tasks/task-type';
import { INDETERMINATE } from '../status';
import { type Activity, ActivityKind, ActivitySourceType, ActivityStatus, makeActivityId, type TranslateFn } from '../types';

/**
 * Maps the balance queue items into blockchain-balance and token-detection
 * activities. This is the source of the partial pending view for balances — queue
 * items are surfaced in their pending state, not only once running. Items carry no
 * per-item cancel path today, so they are modelled as non-cancellable; group-level
 * control is a Layer B concern.
 */
export function balanceActivities(items: BalanceQueryQueueItem[], t: TranslateFn): Activity[] {
  return items.map((item) => {
    const kind = item.type === TaskType.FETCH_DETECTED_TOKENS
      ? ActivityKind.TOKEN_DETECTION
      : ActivityKind.BLOCKCHAIN_BALANCES;
    const keyParts = item.address ? [item.chain, item.address] : [item.chain];
    const status = balanceStatus(item.status);
    return {
      cancellable: false,
      id: makeActivityId(kind, ...keyParts),
      kind,
      percentage: status === ActivityStatus.COMPLETE ? 100 : INDETERMINATE,
      rerunnable: false,
      source: { address: item.address, chain: item.chain, taskType: item.type, type: ActivitySourceType.BALANCE_QUERY },
      startedAt: item.addedAt,
      status,
      subtitle: item.address ?? item.chain,
      title: titleFor(kind, t),
    } satisfies Activity;
  });
}

function balanceStatus(status: BalanceQueryQueueItem['status']): ActivityStatus {
  switch (status) {
    case 'pending':
      return ActivityStatus.PENDING;
    case 'running':
      return ActivityStatus.RUNNING;
    case 'completed':
      return ActivityStatus.COMPLETE;
  }
}

function titleFor(kind: ActivityKind, t: TranslateFn): string {
  return kind === ActivityKind.TOKEN_DETECTION
    ? t('task_center.activity.token_detection')
    : t('task_center.activity.blockchain_balances');
}
