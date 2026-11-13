import type { Component, ComputedRef, MaybeRef, MaybeRefOrGetter, Ref } from 'vue';
import type { AssetBalanceWithPrice } from '../balances';
import type { AssetInfoWithId } from '../data';
import type { BigNumber } from '../numbers';
import type { FrontendSettingsPayload, TimeUnit } from '../settings/frontend';
import type { Themes } from '../settings/themes';
import type {
  CommonQueryStatusData,
  FailedHistoricalAssetPriceResponse,
  HistoricalAssetPricePayload,
  HistoricalAssetPriceResponse,
  LocationData,
  NetValue,
  OwnedAssets,
  ResolvedPrice,
  TimedAssetBalances,
  TimedAssetHistoricalBalances,
  TimedBalances,
} from '../statistics';

export type ExclusionSource = 'exchange' | 'manual' | 'blockchain';

/** An asset's historic prices at the requested times, gaps filled and flagged by `quality`. */
export interface PriceSeriesApi {
  /** One entry per requested time, in the same order. */
  readonly prices: ComputedRef<readonly ResolvedPrice[]>;
}

/** What a chart needs priced: its range and the largest value of each asset it shows. */
export interface PriceBackfillDemand {
  /** Unix seconds. */
  readonly range: { readonly start: number; readonly end: number };
  /** Values in the main currency; they decide which assets are fetched first. */
  readonly holdings: readonly { readonly asset: string; readonly heldValue: BigNumber }[];
}

/**
 * The host's paced fetching of missing historic prices.
 *
 * @remarks
 * Prices it fetches reach every `priceSeries` of the asset. A registered demand is dropped when the
 * scope that registered it is disposed.
 */
export interface PriceBackfillApi {
  /** Whether the user lets the backfill run in the background. */
  readonly automatic: ComputedRef<boolean>;
  readonly running: Readonly<Ref<boolean>>;
  /** The demand a run started by `fetchMissing` is serving, if one is. */
  readonly manualTarget: Readonly<Ref<string | undefined>>;
  readonly register: (id: string, demand: MaybeRefOrGetter<PriceBackfillDemand | undefined>) => void;
  /** Fetches the missing prices of one registered demand now, at the faster manual pace. */
  readonly fetchMissing: (id: string) => void;
  readonly stop: () => void;
}

/** A net value series from history, one point per day, then now. */
export interface HistoryNetValue extends NetValue {
  /** Per point, whether its value rests on a stand-in price. */
  readonly estimated: readonly boolean[];
  /** Per point, whether nothing in it could be priced; `data` holds zero there. */
  readonly missing: readonly boolean[];
}

export interface HistoryNetValueApi {
  readonly data: ComputedRef<HistoryNetValue>;
  readonly loading: Readonly<Ref<boolean>>;
  /** Some events in the range are not processed yet, so the amounts may change. */
  readonly processingRequired: Readonly<Ref<boolean>>;
  readonly estimatedAssets: ComputedRef<string[]>;
  readonly missingAssets: ComputedRef<string[]>;
  /** The backfill demand id the series registered under, for `PriceBackfillApi.fetchMissing`. */
  readonly backfillId: string;
}

/** Which balances a page shows: queried from chains, exchanges and banks, or derived from history. */
export type BalanceViewMode = 'queried' | 'history';

/** The page's balance view, kept in its route query. */
export interface BalanceViewApi {
  /** The History view can be offered: premium with the accounting update on. */
  readonly available: ComputedRef<boolean>;
  readonly isHistory: ComputedRef<boolean>;
  readonly setView: (view: BalanceViewMode) => Promise<void>;
}

export interface StatisticsApi {
  assetValueDistribution: () => Promise<TimedAssetBalances>;
  locationValueDistribution: () => Promise<LocationData>;
  ownedAssets: () => Promise<OwnedAssets>;
  timedBalances: (asset: string, start: number, end: number, collectionId?: number) => Promise<TimedBalances>;
  timedHistoricalBalances: (asset: string, start: number, end: number, collectionId?: number) => Promise<TimedAssetHistoricalBalances>;
  netValue: (startingData: number) => Ref<NetValue>;
  isQueryingDailyPrices: ComputedRef<boolean>;
  failedDailyPrices: Ref<Record<string, FailedHistoricalAssetPriceResponse>>;
  queryHistoricalAssetPrices: (payload: HistoricalAssetPricePayload) => Promise<HistoricalAssetPriceResponse>;
  historicalDailyPriceStatus: Ref<CommonQueryStatusData | undefined>;
  cancelHistoricPriceTask: () => Promise<void>;
  cancelDailyHistoricPriceTask: () => Promise<void>;
  /** Call during setup: the series reads the price cache while the calling scope lives. */
  priceSeries: (asset: MaybeRefOrGetter<string>, times: MaybeRefOrGetter<readonly number[]>) => PriceSeriesApi;
  /** The USD to main currency rate at a time, for converting stored USD values. Call during setup. */
  usdRateAt: (timestamp: MaybeRefOrGetter<number>) => ComputedRef<ResolvedPrice>;
  /** The net value from history from `startingDate` (unix seconds) to now. Call during setup. */
  historyNetValue: (startingDate: MaybeRefOrGetter<number>) => HistoryNetValueApi;
  readonly priceBackfill: PriceBackfillApi;
}

export interface DateUtilities {
  epoch: () => number;
  epochStartSubtract: (amount: number, unit: TimeUnit) => number;
  convertToTimestamp: (date: string, dateFormat?: string) => number;
}

export interface BalancesApi {
  byLocation: Ref<Record<string, BigNumber>>;
  balances: (groupMultiChain?: boolean, exclude?: ExclusionSource[]) => ComputedRef<AssetBalanceWithPrice[]>;
  exchangeRate: (currency: string) => Ref<BigNumber>;
  queryOnlyCacheHistoricalRates: (asset: string, timestamp: number[]) => Promise<Record<number, BigNumber>>;
  assetPrice: (asset: string) => ComputedRef<BigNumber>;
  /** The current page's balance view. Call during setup, since it reads the route. */
  view: () => BalanceViewApi;
}

export interface AssetsApi {
  assetInfo: (identifier: MaybeRef<string>) => ComputedRef<AssetInfoWithId | null>;
  assetSymbol: (identifier: MaybeRef<string>) => ComputedRef<string>;
}

export interface DataUtilities {
  readonly assets: AssetsApi;
  readonly statistics: StatisticsApi;
  readonly balances: BalancesApi;
}

export interface UserSettingsApi {
  currencySymbol: Ref<string>;
  floatingPrecision: Ref<number>;
  decimalSeparator: Ref<string>;
  thousandSeparator: Ref<string>;
  subscriptDecimals: Ref<boolean>;
  shouldShowAmount: Ref<boolean>;
  scrambleData: Ref<boolean>;
  scrambleMultiplier: Ref<number>;
  graphZeroBased: Ref<boolean>;
  showGraphRangeSelector: Ref<boolean>;
  useHistoricalAssetBalances: Ref<boolean>;
}

export interface SettingsApi {
  update: (settings: FrontendSettingsPayload) => Promise<void>;
  defaultThemes: () => Themes;
  themes: () => Themes;
  isDark: ComputedRef<boolean>;
  user: UserSettingsApi;
  i18n: {
    t: (key: string, values?: Record<string, unknown>, choice?: number) => string;
  };
}

interface ColorStop {
  color: string;
  offset: number;
}

interface GradientColor {
  colorStops: ColorStop[];
  type: 'linear';
  x: number;
  x2: number;
  y: number;
  y2: number;
}

export interface GradientArea {
  color: GradientColor;
}

export interface NewGraphApi {
  baseColor: ComputedRef<string>;
  gradient: ComputedRef<GradientArea>;
  secondaryColor: ComputedRef<string>;
}

type GetGraphApi = () => NewGraphApi;

export interface LoggerApi {
  error: (...args: any[]) => void;
}

/** Host components the premium bundle can render, so shared controls look and behave the same. */
export interface HostComponents {
  /** The Live/History switch with its comparison popover; renders nothing where unavailable. */
  readonly BalanceViewPicker: Component;
}

export interface PremiumApi {
  readonly components: HostComponents;
  readonly date: DateUtilities;
  readonly data: DataUtilities;
  readonly settings: SettingsApi;
  readonly graphs: GetGraphApi;
  readonly logger: LoggerApi;
}
