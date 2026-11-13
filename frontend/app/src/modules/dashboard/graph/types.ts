import type { NetValue } from '@rotki/common';

export interface NetValueChartData extends NetValue {
  snapshotCount: number;
  /** Per point, whether its value rests on a stand-in price or rate; absent means none does. */
  estimated?: readonly boolean[];
  /** Per point, whether nothing in it could be priced, so the line breaks there; `data` holds zero. */
  missing?: readonly boolean[];
}
