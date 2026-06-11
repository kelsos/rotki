import { mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type Activity, ActivityKind, type ActivityOverall, ActivitySourceType, ActivityStatus, makeActivityId } from '@/modules/task-center/core/types';
import TaskCenterIndicator from './TaskCenterIndicator.vue';

const { mockCurrent, mockIsActive, mockOverall } = await vi.hoisted(async () => {
  const { ref } = await import('vue');
  return {
    mockCurrent: ref<Activity | undefined>(undefined),
    mockIsActive: ref<boolean>(false),
    mockOverall: ref<ActivityOverall>({ percentage: 0, phase: 'idle' }),
  };
});

vi.mock('@/modules/task-center/use-task-center', () => ({
  useTaskCenter: vi.fn().mockReturnValue({
    current: mockCurrent,
    isActive: mockIsActive,
    overall: mockOverall,
  }),
}));

function createWrapper(): VueWrapper {
  return mount(TaskCenterIndicator);
}

describe('taskCenterIndicator', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockCurrent.value = undefined;
    mockIsActive.value = false;
    mockOverall.value = { percentage: 0, phase: 'idle' };
  });

  it('should render nothing while idle', () => {
    const wrapper = createWrapper();
    expect(wrapper.find('[data-testid=task-center-indicator]').exists()).toBe(false);
  });

  it('should render the current activity label while active', () => {
    mockIsActive.value = true;
    mockOverall.value = { percentage: 40, phase: 'working' };
    mockCurrent.value = {
      cancellable: false,
      id: makeActivityId(ActivityKind.TX_SYNC, 'eth', '0xabc'),
      kind: ActivityKind.TX_SYNC,
      percentage: 40,
      rerunnable: false,
      source: { address: '0xabc', chain: 'eth', type: ActivitySourceType.TX_SYNC },
      status: ActivityStatus.RUNNING,
      subtitle: '0xabc',
      title: 'Syncing transactions',
    };
    const wrapper = createWrapper();
    const indicator = wrapper.find('[data-testid=task-center-indicator]');
    expect(indicator.exists()).toBe(true);
    expect(indicator.text()).toContain('Syncing transactions');
    expect(indicator.text()).toContain('0xabc');
  });

  it('should emit click when pressed', async () => {
    mockIsActive.value = true;
    mockCurrent.value = undefined;
    const wrapper = createWrapper();
    await wrapper.find('[data-testid=task-center-indicator]').trigger('click');
    expect(wrapper.emitted('click')).toHaveLength(1);
  });
});
