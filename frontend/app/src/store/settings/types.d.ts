import {
  TIMEFRAME_SETTING,
  DEFI_SETUP_DONE,
  TIMEFRAME_PERIOD,
  TIMEFRAME_REMEMBER,
  LAST_KNOWN_TIMEFRAME,
  QUERY_PERIOD,
  PROFIT_LOSS_PERIOD,
  QUARTERS,
  THOUSAND_SEPARATOR,
  DECIMAL_SEPARATOR,
  CURRENCY_LOCATION,
  REFRESH_PERIOD,
  EXPLORERS,
  ITEMS_PER_PAGE
} from '@/store/settings/consts';
import { CurrencyLocation } from '@/typing/types';

export type TimeFramePeriod = typeof TIMEFRAME_PERIOD[number];
export type TimeFrameSetting = TimeFramePeriod | typeof TIMEFRAME_REMEMBER;

export type Quarter = typeof QUARTERS[number];

export type ProfitLossTimeframe = {
  readonly year: string;
  readonly quarter: Quarter;
};

export type RefreshPeriod = number;

export type ExplorerEndpoints = {
  readonly transaction?: string;
  readonly address?: string;
};

export type ExplorersSettings = {
  readonly ETC?: ExplorerEndpoints;
  readonly ETH?: ExplorerEndpoints;
  readonly BTC?: ExplorerEndpoints;
  readonly KSM?: ExplorerEndpoints;
};

export interface SettingsState {
  readonly [DEFI_SETUP_DONE]: boolean;
  readonly [TIMEFRAME_SETTING]: TimeFrameSetting;
  readonly [LAST_KNOWN_TIMEFRAME]: TimeFramePeriod;
  readonly [QUERY_PERIOD]: number;
  readonly [PROFIT_LOSS_PERIOD]: ProfitLossTimeframe;
  readonly [THOUSAND_SEPARATOR]: string;
  readonly [DECIMAL_SEPARATOR]: string;
  readonly [CURRENCY_LOCATION]: CurrencyLocation;
  readonly [REFRESH_PERIOD]: RefreshPeriod;
  readonly [EXPLORERS]: ExplorersSettings;
  readonly [ITEMS_PER_PAGE]: number;
}

export type FrontendSettingsPayload = {
  +readonly [P in keyof SettingsState]+?: SettingsState[P];
};
