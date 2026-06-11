import { mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActivityKind, type ActivityModel, ActivityPhase, ActivitySourceType, ActivityStatus, makeActivityId } from '@/modules/task-center/core/types';
import TaskCenterPanel from './TaskCenterPanel.vue';

const { mockModel } = await vi.hoisted(async () => {
  const { ref } = await import('vue');
  const empty: ActivityModel = { active: [], groups: [], overall: { percentage: 0, phase: 'idle' }, pending: [] };
  return { mockModel: ref<ActivityModel>(empty) };
});

vi.mock('@/modules/task-center/use-task-center', () => ({
  useTaskCenter: vi.fn().mockReturnValue({ model: mockModel }),
}));

function populatedModel(): ActivityModel {
  const activity = {
    cancellable: false,
    id: makeActivityId(ActivityKind.TX_SYNC, 'eth', '0xabc'),
    kind: ActivityKind.TX_SYNC,
    percentage: 40,
    rerunnable: false,
    source: { address: '0xabc', chain: 'eth', type: ActivitySourceType.TX_SYNC } as const,
    status: ActivityStatus.RUNNING,
    subtitle: '0xabc',
    title: 'Syncing transactions',
  };
  return {
    active: [activity],
    current: activity,
    groups: [{ activities: [activity], kind: ActivityKind.TX_SYNC, percentage: 40, status: ActivityStatus.RUNNING, title: 'Transaction sync' }],
    overall: { percentage: 40, phase: ActivityPhase.WORKING },
    pending: [],
  };
}

const RuiNavigationDrawerStub = {
  name: 'RuiNavigationDrawer',
  template: '<div><slot /></div>',
};

function createWrapper(): VueWrapper {
  return mount(TaskCenterPanel, {
    global: { stubs: { RuiNavigationDrawer: RuiNavigationDrawerStub } },
    props: { modelValue: true },
  });
}

describe('taskCenterPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockModel.value = { active: [], groups: [], overall: { percentage: 0, phase: ActivityPhase.IDLE }, pending: [] };
  });

  it('should render the empty state when there are no groups', () => {
    const wrapper = createWrapper();
    expect(wrapper.find('[data-testid=task-center-empty]').exists()).toBe(true);
    expect(wrapper.find('[data-testid=task-center-group]').exists()).toBe(false);
  });

  it('should render a group per kind when active', () => {
    mockModel.value = populatedModel();
    const wrapper = createWrapper();
    expect(wrapper.find('[data-testid=task-center-empty]').exists()).toBe(false);
    expect(wrapper.findAll('[data-testid=task-center-group]')).toHaveLength(1);
    expect(wrapper.text()).toContain('Transaction sync');
  });

  it('should emit update:modelValue=false when closed', async () => {
    const wrapper = createWrapper();
    await wrapper.find('[data-testid=task-center-close]').trigger('click');
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false]);
  });
});
