import { describe, expect, it } from 'vitest';
import {
  AUTOMATIC_DELAY_MS,
  BACKOFF_MAX_MS,
  BACKOFF_START_MS,
  MANUAL_DELAY_MS,
  nextPacing,
} from '@/modules/statistics/pricing/backfill-pacing';

describe('modules/statistics/pricing/backfill-pacing', () => {
  it('should wait the trigger\'s normal pace after a request goes through', () => {
    expect(nextPacing(false, false, 0)).toEqual({ backoff: 0, delay: AUTOMATIC_DELAY_MS });
    expect(nextPacing(true, false, 0)).toEqual({ backoff: 0, delay: MANUAL_DELAY_MS });
  });

  it('should double the wait on each rate limit, for manual runs too, up to the cap', () => {
    expect(nextPacing(true, true, 0).delay).toBe(BACKOFF_START_MS);
    expect(nextPacing(true, true, BACKOFF_START_MS).delay).toBe(2 * BACKOFF_START_MS);
    expect(nextPacing(false, true, BACKOFF_MAX_MS).delay).toBe(BACKOFF_MAX_MS);
  });

  it('should reset the backoff once a request goes through', () => {
    expect(nextPacing(false, false, BACKOFF_MAX_MS).backoff).toBe(0);
  });
});
