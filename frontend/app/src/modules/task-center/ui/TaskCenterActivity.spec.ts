import { mount, type VueWrapper } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { type Activity, ActivityKind, ActivitySourceType, ActivityStatus, makeActivityId } from '@/modules/task-center/core/types';
import TaskCenterActivity from './TaskCenterActivity.vue';

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    cancellable: false,
    id: makeActivityId(ActivityKind.TX_SYNC, 'eth', '0xabc'),
    kind: ActivityKind.TX_SYNC,
    percentage: 40,
    rerunnable: false,
    source: { address: '0xabc', chain: 'eth', type: ActivitySourceType.TX_SYNC },
    status: ActivityStatus.RUNNING,
    subtitle: '0xabc',
    title: 'Syncing transactions',
    ...overrides,
  };
}

function createWrapper(value: Activity): VueWrapper {
  return mount(TaskCenterActivity, { props: { activity: value } });
}

describe('taskCenterActivity', () => {
  it('should render the title, subtitle and percentage for determinate progress', () => {
    const wrapper = createWrapper(activity());
    expect(wrapper.text()).toContain('Syncing transactions');
    expect(wrapper.text()).toContain('0xabc');
    expect(wrapper.text()).toContain('40%');
  });

  it('should show the status label instead of a percentage when indeterminate', () => {
    const wrapper = createWrapper(activity({ percentage: -1 }));
    expect(wrapper.text()).not.toContain('%');
    expect(wrapper.text()).toContain('task_center.status.running');
  });

  it('should show the status label for a terminal activity', () => {
    const wrapper = createWrapper(activity({ percentage: -1, status: ActivityStatus.FAILED }));
    expect(wrapper.text()).toContain('task_center.status.failed');
  });
});
