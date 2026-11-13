import { mount, type VueWrapper } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NetValueChartStatus from '@/modules/dashboard/graph/NetValueChartStatus.vue';
import { HISTORY_NET_VALUE_DEMAND } from '@/modules/dashboard/graph/use-history-net-value';
import { HistoricPriceBackfill } from '@/modules/settings/types/frontend-settings';

const { backfill, updateFrontendSetting } = await vi.hoisted(async () => {
  const { ref } = await import('vue');
  return {
    backfill: {
      automatic: ref<boolean>(false),
      fetchMissing: vi.fn<(id: string) => void>(),
      manualTarget: ref<string>(),
      running: ref<boolean>(false),
      stop: vi.fn<() => void>(),
    },
    updateFrontendSetting: vi.fn<(settings: object) => Promise<void>>(async () => {}),
  };
});

vi.mock('@/modules/statistics/pricing/use-price-backfill', () => ({
  usePriceBackfill: (): typeof backfill => backfill,
}));

vi.mock('@/modules/settings/use-settings-operations', () => ({
  useSettingsOperations: (): { updateFrontendSetting: typeof updateFrontendSetting } => ({ updateFrontendSetting }),
}));

type Props = InstanceType<typeof NetValueChartStatus>['$props'];

function createWrapper(props: Props): VueWrapper<InstanceType<typeof NetValueChartStatus>> {
  return mount(NetValueChartStatus, {
    global: { stubs: { RuiButton: { template: '<button v-bind="$attrs"><slot /></button>' } } },
    props,
  });
}

describe('netValueChartStatus', () => {
  beforeEach(() => {
    set(backfill.automatic, false);
    set(backfill.manualTarget, undefined);
    set(backfill.running, false);
    backfill.fetchMissing.mockClear();
    backfill.stop.mockClear();
    updateFrontendSetting.mockClear();
  });

  it('should say which view the chart plots only when the switch is offered', () => {
    expect(createWrapper({ isHistory: true, viewAvailable: false }).find('[data-testid=net-value-status-view]').exists()).toBe(false);
    expect(createWrapper({ isHistory: true, viewAvailable: true }).find('[data-testid=net-value-status-view]').text())
      .toContain('balance_view.chart_history');
  });

  it('should fetch the History chart\'s missing prices when asked', async () => {
    const wrapper = createWrapper({ estimatedCount: 3, hasEstimates: true, isHistory: true });
    await wrapper.find('[data-testid=net-value-status-fetch]').trigger('click');
    expect(backfill.fetchMissing).toHaveBeenCalledWith(HISTORY_NET_VALUE_DEMAND);
  });

  it('should offer to stop instead while that fetch runs', async () => {
    set(backfill.running, true);
    set(backfill.manualTarget, HISTORY_NET_VALUE_DEMAND);
    const wrapper = createWrapper({ estimatedCount: 3, hasEstimates: true, isHistory: true });

    expect(wrapper.find('[data-testid=net-value-status-fetch]').exists()).toBe(false);
    await wrapper.find('[data-testid=net-value-status-stop]').trigger('click');
    expect(backfill.stop).toHaveBeenCalledOnce();
  });

  it('should turn on automatic backfill from the chart, and not offer it once on', async () => {
    const wrapper = createWrapper({ estimatedCount: 1, hasEstimates: true, isHistory: true });
    await wrapper.find('[data-testid=net-value-status-automatic]').trigger('click');
    expect(updateFrontendSetting).toHaveBeenCalledWith({ historicPriceBackfill: HistoricPriceBackfill.AUTOMATIC });

    set(backfill.automatic, true);
    await nextTick();
    expect(wrapper.find('[data-testid=net-value-status-automatic]').exists()).toBe(false);
  });

  it('should list assets left out and unprocessed events in the History view', () => {
    const wrapper = createWrapper({ isHistory: true, missingCount: 2, processingRequired: true });
    expect(wrapper.find('[data-testid=net-value-status-missing]').exists()).toBe(true);
    expect(wrapper.find('[data-testid=net-value-status-processing]').exists()).toBe(true);
    expect(wrapper.find('[data-testid=net-value-status-estimated]').exists()).toBe(false);
  });

  it('should only explain the estimated rate in the Live view, with no fetch action', () => {
    const wrapper = createWrapper({ hasEstimates: true, isHistory: false });
    expect(wrapper.find('[data-testid=net-value-status-estimated-rate]').exists()).toBe(true);
    expect(wrapper.find('[data-testid=net-value-status-fetch]').exists()).toBe(false);
  });
});
