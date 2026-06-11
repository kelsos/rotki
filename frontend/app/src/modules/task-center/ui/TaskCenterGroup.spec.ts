import { mount, type VueWrapper } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { type Activity, type ActivityGroup, ActivityKind, ActivitySourceType, ActivityStatus, makeActivityId } from '@/modules/task-center/core/types';
import TaskCenterGroup from './TaskCenterGroup.vue';

function activity(id: string, percentage: number): Activity {
  return {
    cancellable: false,
    id: makeActivityId(ActivityKind.TX_SYNC, id),
    kind: ActivityKind.TX_SYNC,
    percentage,
    rerunnable: false,
    source: { address: id, chain: 'eth', type: ActivitySourceType.TX_SYNC },
    status: ActivityStatus.RUNNING,
    subtitle: id,
    title: `Syncing ${id}`,
  };
}

function group(overrides: Partial<ActivityGroup> = {}): ActivityGroup {
  return {
    activities: [activity('0xa', 30), activity('0xb', 50)],
    kind: ActivityKind.TX_SYNC,
    percentage: 40,
    status: ActivityStatus.RUNNING,
    title: 'Transaction sync',
    ...overrides,
  };
}

function createWrapper(value: ActivityGroup): VueWrapper {
  return mount(TaskCenterGroup, { props: { group: value } });
}

describe('taskCenterGroup', () => {
  it('should render the group title and rolled-up percentage', () => {
    const wrapper = createWrapper(group());
    expect(wrapper.text()).toContain('Transaction sync');
    expect(wrapper.text()).toContain('40%');
  });

  it('should render one row per activity', () => {
    const wrapper = createWrapper(group());
    expect(wrapper.findAll('[data-testid=task-center-activity]')).toHaveLength(2);
  });

  it('should omit the percentage when the group is indeterminate', () => {
    const wrapper = createWrapper(group({ activities: [activity('0xa', -1), activity('0xb', -1)], percentage: -1 }));
    expect(wrapper.text()).not.toContain('%');
  });
});
