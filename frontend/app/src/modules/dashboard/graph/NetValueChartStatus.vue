<script setup lang="ts">
import { HISTORY_NET_VALUE_DEMAND } from '@/modules/dashboard/graph/use-history-net-value';
import { HistoricPriceBackfill } from '@/modules/settings/types/frontend-settings';
import { useSettingsOperations } from '@/modules/settings/use-settings-operations';
import { usePriceBackfill } from '@/modules/statistics/pricing/use-price-backfill';

const {
  estimatedCount = 0,
  hasEstimates = false,
  isHistory = false,
  missingCount = 0,
  processingRequired = false,
  viewAvailable = false,
} = defineProps<{
  /** The History view is showing. */
  isHistory?: boolean;
  /** The Live/History switch is offered, so the chart says which view it plots. */
  viewAvailable?: boolean;
  hasEstimates?: boolean;
  /** Assets valued at a stand-in price somewhere in the History series. */
  estimatedCount?: number;
  /** Assets with no price at all somewhere in the History series. */
  missingCount?: number;
  processingRequired?: boolean;
}>();

const { t } = useI18n({ useScope: 'global' });

const { automatic, fetchMissing, manualTarget, running, stop } = usePriceBackfill();
const { updateFrontendSetting } = useSettingsOperations();

const fetching = computed<boolean>(() => get(running) && get(manualTarget) === HISTORY_NET_VALUE_DEMAND);

async function fetchAutomatically(): Promise<void> {
  await updateFrontendSetting({ historicPriceBackfill: HistoricPriceBackfill.AUTOMATIC });
}
</script>

<template>
  <div class="flex flex-col gap-1 px-2 text-xs text-rui-text-secondary">
    <p
      v-if="viewAvailable"
      class="flex items-center gap-1"
      data-testid="net-value-status-view"
    >
      <RuiIcon
        name="lu-info"
        size="14"
      />
      {{ isHistory ? t('balance_view.chart_history') : t('balance_view.chart_live') }}
    </p>
    <template v-if="isHistory">
      <div
        v-if="hasEstimates"
        class="flex flex-wrap items-center gap-x-2 gap-y-1"
        data-testid="net-value-status-estimated"
      >
        <span>{{ t('net_value_status.estimated_prices', { count: estimatedCount }, estimatedCount) }}</span>
        <template v-if="fetching">
          <span data-testid="net-value-status-fetching">{{ t('net_value_status.fetching') }}</span>
          <RuiButton
            size="sm"
            variant="text"
            class="-my-1 px-1!"
            data-testid="net-value-status-stop"
            @click="stop()"
          >
            {{ t('net_value_status.stop') }}
          </RuiButton>
        </template>
        <RuiButton
          v-else
          size="sm"
          variant="text"
          color="primary"
          class="-my-1 px-1!"
          data-testid="net-value-status-fetch"
          @click="fetchMissing(HISTORY_NET_VALUE_DEMAND)"
        >
          {{ t('net_value_status.fetch_missing') }}
        </RuiButton>
        <RuiButton
          v-if="!automatic"
          size="sm"
          variant="text"
          class="-my-1 px-1!"
          data-testid="net-value-status-automatic"
          @click="fetchAutomatically()"
        >
          {{ t('net_value_status.fetch_automatically') }}
        </RuiButton>
      </div>
      <p
        v-if="missingCount > 0"
        data-testid="net-value-status-missing"
      >
        {{ t('net_value_status.missing_prices', { count: missingCount }, missingCount) }}
      </p>
      <p
        v-if="processingRequired"
        data-testid="net-value-status-processing"
      >
        {{ t('net_value_status.processing_required') }}
      </p>
    </template>
    <p
      v-else-if="hasEstimates"
      data-testid="net-value-status-estimated-rate"
    >
      {{ t('net_value_status.estimated_rate') }}
    </p>
  </div>
</template>
