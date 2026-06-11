<script setup lang="ts">
import type { ActivityGroup } from '@/modules/task-center/core/types';
import { INDETERMINATE } from '@/modules/task-center/core/status';
import TaskCenterActivity from '@/modules/task-center/ui/TaskCenterActivity.vue';

const { group } = defineProps<{
  group: ActivityGroup;
}>();

const determinate = computed<boolean>(() => group.percentage > INDETERMINATE);
</script>

<template>
  <div
    class="flex flex-col"
    data-testid="task-center-group"
  >
    <div class="flex items-center justify-between gap-2 px-1">
      <span class="text-overline text-rui-text-secondary uppercase truncate">
        {{ group.title }}
      </span>
      <span
        v-if="determinate"
        class="shrink-0 text-caption text-rui-text-secondary tabular-nums"
      >
        {{ `${group.percentage}%` }}
      </span>
    </div>
    <RuiProgress
      v-if="determinate"
      :value="group.percentage"
      color="primary"
      class="mt-1"
      size="2"
    />
    <RuiProgress
      v-else
      variant="indeterminate"
      color="primary"
      class="mt-1"
      size="2"
    />
    <div class="flex flex-col divide-y divide-rui-grey-100 dark:divide-rui-grey-800">
      <TaskCenterActivity
        v-for="activity in group.activities"
        :key="activity.id"
        :activity="activity"
      />
    </div>
  </div>
</template>
