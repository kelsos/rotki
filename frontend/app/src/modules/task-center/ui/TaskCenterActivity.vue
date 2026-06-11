<script setup lang="ts">
import type { RuiIcons } from '@rotki/ui-library';
import { INDETERMINATE } from '@/modules/task-center/core/status';
import { type Activity, ActivityStatus } from '@/modules/task-center/core/types';

const { activity } = defineProps<{
  activity: Activity;
}>();

const { t } = useI18n({ useScope: 'global' });

interface TerminalIcon {
  name: RuiIcons;
  color: 'success' | 'error' | 'secondary';
}

const TERMINAL_ICON: Partial<Record<ActivityStatus, TerminalIcon>> = {
  [ActivityStatus.CANCELLED]: { color: 'secondary', name: 'lu-circle-slash' },
  [ActivityStatus.COMPLETE]: { color: 'success', name: 'lu-circle-check' },
  [ActivityStatus.FAILED]: { color: 'error', name: 'lu-circle-alert' },
};

const inProgress = computed<boolean>(() =>
  activity.status === ActivityStatus.RUNNING || activity.status === ActivityStatus.PENDING);
const determinate = computed<boolean>(() => activity.percentage > INDETERMINATE);
const terminalIcon = computed<TerminalIcon | undefined>(() => TERMINAL_ICON[activity.status]);
const statusLabel = computed<string>(() => {
  const labels: Record<ActivityStatus, string> = {
    [ActivityStatus.CANCELLED]: t('task_center.status.cancelled'),
    [ActivityStatus.COMPLETE]: t('task_center.status.complete'),
    [ActivityStatus.FAILED]: t('task_center.status.failed'),
    [ActivityStatus.PENDING]: t('task_center.status.pending'),
    [ActivityStatus.RUNNING]: t('task_center.status.running'),
  };
  return labels[activity.status];
});
</script>

<template>
  <div
    class="flex items-center gap-3 py-2"
    data-testid="task-center-activity"
  >
    <div class="shrink-0 flex items-center justify-center w-6 h-6">
      <RuiProgress
        v-if="inProgress && determinate"
        :value="activity.percentage"
        color="primary"
        circular
        size="24"
        thickness="2"
      />
      <RuiProgress
        v-else-if="inProgress"
        variant="indeterminate"
        color="primary"
        circular
        size="24"
        thickness="2"
      />
      <RuiIcon
        v-else-if="terminalIcon"
        :name="terminalIcon.name"
        :color="terminalIcon.color"
        size="20"
      />
    </div>
    <div class="flex flex-col overflow-hidden grow leading-tight">
      <span class="text-body-2 font-medium truncate">{{ activity.title }}</span>
      <span
        v-if="activity.subtitle"
        class="text-caption text-rui-text-secondary truncate"
      >
        {{ activity.subtitle }}
      </span>
    </div>
    <span
      v-if="inProgress && determinate"
      class="shrink-0 text-caption text-rui-text-secondary tabular-nums"
    >
      {{ `${activity.percentage}%` }}
    </span>
    <span
      v-else
      class="shrink-0 text-caption text-rui-text-secondary"
    >
      {{ statusLabel }}
    </span>
  </div>
</template>
