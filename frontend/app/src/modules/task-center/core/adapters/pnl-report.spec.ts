import { describe, expect, it } from 'vitest';
import { ActivityKind, ActivitySourceType, ActivityStatus } from '../types';
import { pnlReportActivities } from './pnl-report';

const t = (key: string): string => key;

describe('pnlReportActivities', () => {
  it('should map an in-progress report to a running info activity', () => {
    const [activity] = pnlReportActivities({ processingState: 'Processing events', totalProgress: '42.7' }, t);
    expect(activity).toMatchObject({
      cancellable: false,
      id: 'pnl-report',
      kind: ActivityKind.PNL_REPORT,
      percentage: 43,
      rerunnable: false,
      source: { key: 'pnl-report', type: ActivitySourceType.INFO },
      status: ActivityStatus.RUNNING,
      subtitle: 'Processing events',
    });
  });

  it('should emit nothing when the report is idle (empty processing state)', () => {
    expect(pnlReportActivities({ processingState: '', totalProgress: '' }, t)).toStrictEqual([]);
  });

  it('should be indeterminate when the progress is not a number', () => {
    const [activity] = pnlReportActivities({ processingState: 'Starting', totalProgress: '' }, t);
    expect(activity.percentage).toBe(-1);
  });

  it('should clamp the percentage to the 0-100 range', () => {
    const [over] = pnlReportActivities({ processingState: 'x', totalProgress: '150' }, t);
    const [under] = pnlReportActivities({ processingState: 'x', totalProgress: '-5' }, t);
    expect(over.percentage).toBe(100);
    expect(under.percentage).toBe(0);
  });
});
