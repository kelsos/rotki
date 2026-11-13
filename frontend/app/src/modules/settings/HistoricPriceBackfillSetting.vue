<script setup lang="ts">
import SettingSelect from '@/modules/settings/controls/SettingSelect.vue';
import { HistoricPriceBackfill } from '@/modules/settings/types/frontend-settings';

const { t } = useI18n({ useScope: 'global' });

const options = [HistoricPriceBackfill.MANUAL, HistoricPriceBackfill.AUTOMATIC];
</script>

<template>
  <SettingSelect
    control="radio"
    setting="historicPriceBackfill"
    class="flex flex-col"
    data-testid="historic-price-backfill-input"
    :options="options"
    :error-message="t('historic_price_backfill.error')"
    :success-message="t('historic_price_backfill.success')"
  >
    <template #option="{ option }">
      <template v-if="option === HistoricPriceBackfill.AUTOMATIC">
        {{ t('historic_price_backfill.automatic.label') }}
        <div class="text-sm text-rui-text-secondary mt-1">
          {{ t('historic_price_backfill.automatic.hint') }}
        </div>
      </template>
      <template v-else>
        {{ t('historic_price_backfill.manual.label') }}
        <div class="text-sm text-rui-text-secondary mt-1">
          {{ t('historic_price_backfill.manual.hint') }}
        </div>
      </template>
    </template>
  </SettingSelect>
</template>
