import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import HistoricPriceBackfillSetting from '@/modules/settings/HistoricPriceBackfillSetting.vue';
import { HistoricPriceBackfill } from '@/modules/settings/types/frontend-settings';

describe('historicPriceBackfillSetting', () => {
  it('should offer manual and automatic for the historicPriceBackfill setting, manual first', () => {
    const wrapper = mount(HistoricPriceBackfillSetting, {
      global: {
        stubs: {
          SettingSelect: {
            name: 'SettingSelect',
            props: ['setting', 'options', 'control'],
            template: '<div />',
          },
        },
      },
    });
    const select = wrapper.findComponent({ name: 'SettingSelect' });
    expect(select.props()).toMatchObject({
      control: 'radio',
      options: [HistoricPriceBackfill.MANUAL, HistoricPriceBackfill.AUTOMATIC],
      setting: 'historicPriceBackfill',
    });
  });
});
