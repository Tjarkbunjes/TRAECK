import { describe, it, expect } from 'vitest';
import { CURSOR_OVERLAP_MS, advanceCursor, effectiveCursor, isNewer, pickNewer } from './merge';

const t0 = '2026-09-10T10:00:00.000Z';
const t1 = '2026-09-10T10:00:01.000Z';

describe('pickNewer', () => {
  it('takes remote when there is no local row', () => {
    const remote = { id: 'a', updated_at: t0 };
    expect(pickNewer(undefined, remote)).toBe(remote);
  });

  it('takes whichever updated_at is newer', () => {
    const local = { id: 'a', updated_at: t0, v: 'local' };
    const remote = { id: 'a', updated_at: t1, v: 'remote' };
    expect(pickNewer(local, remote).v).toBe('remote');
    expect(pickNewer(remote, local).v).toBe('remote');
  });

  it('keeps local on a tie', () => {
    const local = { id: 'a', updated_at: t0, v: 'local' };
    const remote = { id: 'a', updated_at: t0, v: 'remote' };
    expect(pickNewer(local, remote).v).toBe('local');
  });
});

describe('cursor handling', () => {
  it('isNewer compares instants, not strings', () => {
    expect(isNewer('2026-09-10T12:00:00+02:00', '2026-09-10T10:00:00Z')).toBe(false);
    expect(isNewer('2026-09-10T12:00:01+02:00', '2026-09-10T10:00:00Z')).toBe(true);
  });

  it('advanceCursor returns the max and keeps the previous value for empty batches', () => {
    expect(advanceCursor(t0, [])).toBe(t0);
    expect(advanceCursor(t0, [t1, t0])).toBe(t1);
    expect(advanceCursor(t1, [t0])).toBe(t1);
  });

  it('effectiveCursor subtracts the overlap and clamps at epoch', () => {
    expect(effectiveCursor(undefined)).toBe('1970-01-01T00:00:00.000Z');
    expect(effectiveCursor('not a date')).toBe('1970-01-01T00:00:00.000Z');
    expect(Date.parse(effectiveCursor(t1))).toBe(Date.parse(t1) - CURSOR_OVERLAP_MS);
    expect(effectiveCursor('1970-01-01T00:00:01.000Z')).toBe('1970-01-01T00:00:00.000Z');
  });
});
