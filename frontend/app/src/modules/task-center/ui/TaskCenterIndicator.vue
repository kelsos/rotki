<script setup lang="ts">
import { INDETERMINATE } from '@/modules/task-center/core/status';
import { useTaskCenter } from '@/modules/task-center/use-task-center';

const emit = defineEmits<{
  click: [];
}>();

const { t } = useI18n({ useScope: 'global' });

const { current, isActive, overall } = useTaskCenter();

const label = computed<string>(() => get(current)?.title ?? t('task_center.indicator.working'));
const subtitle = computed<string | undefined>(() => get(current)?.subtitle);
const percentage = computed<number>(() => get(overall).percentage);
const determinate = computed<boolean>(() => get(percentage) > INDETERMINATE && get(percentage) > 0);
</script>

<template>
  <RuiButton
    v-if="isActive"
    variant="text"
    size="sm"
    class="gap-2 max-w-[16rem]"
    data-testid="task-center-indicator"
    @click="emit('click')"
  >
    <RuiProgress
      v-if="determinate"
      :value="percentage"
      color="primary"
      circular
      size="20"
      thickness="2"
    />
    <RuiProgress
      v-else
      variant="indeterminate"
      color="primary"
      circular
      size="20"
      thickness="2"
    />
    <div class="flex flex-col items-start overflow-hidden text-left leading-tight">
      <span class="text-caption font-medium truncate w-full">{{ label }}</span>
      <span
        v-if="subtitle"
        class="text-caption text-rui-text-secondary truncate w-full"
      >
        {{ subtitle }}
      </span>
    </div>
  </RuiButton>
</template>
