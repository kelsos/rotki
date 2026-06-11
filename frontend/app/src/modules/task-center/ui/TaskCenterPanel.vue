<script setup lang="ts">
import TaskCenterGroup from '@/modules/task-center/ui/TaskCenterGroup.vue';
import { useTaskCenter } from '@/modules/task-center/use-task-center';

const display = defineModel<boolean>({ required: true });

const { t } = useI18n({ useScope: 'global' });

const { model } = useTaskCenter();

const groups = computed(() => get(model).groups);
const isEmpty = computed<boolean>(() => get(groups).length === 0);

function close(): void {
  set(display, false);
}
</script>

<template>
  <RuiNavigationDrawer
    v-model="display"
    width="400px"
    position="right"
    temporary
  >
    <div class="h-full overflow-hidden flex flex-col">
      <div class="flex justify-between items-center p-2 pl-4">
        <div class="text-h6">
          {{ t('task_center.panel.title') }}
        </div>
        <RuiButton
          variant="text"
          icon
          :aria-label="t('task_center.panel.close')"
          data-testid="task-center-close"
          @click="close()"
        >
          <RuiIcon name="lu-x" />
        </RuiButton>
      </div>

      <div
        v-if="isEmpty"
        class="flex flex-col items-center justify-center flex-1 gap-2 px-6 text-center"
        data-testid="task-center-empty"
      >
        <RuiIcon
          size="64px"
          color="primary"
          name="lu-list-checks"
        />
        <div class="text-rui-text text-lg mt-2">
          {{ t('task_center.panel.empty') }}
        </div>
        <div class="text-rui-text-secondary text-body-2">
          {{ t('task_center.panel.empty_subtitle') }}
        </div>
      </div>
      <div
        v-else
        class="flex flex-col gap-4 p-4 overflow-y-auto"
      >
        <TaskCenterGroup
          v-for="group in groups"
          :key="group.kind"
          :group="group"
        />
      </div>
    </div>
  </RuiNavigationDrawer>
</template>
