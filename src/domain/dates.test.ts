import { describe, expect, it } from 'vitest';

import {
  addDays,
  dayRange,
  daysBetween,
  formatDay,
  monthOf,
  parseDayInput,
  startOfWeek,
  toDay,
} from './dates';

describe('Dates', () => {
  it('lit une date tapée à la française', () => {
    expect(parseDayInput('31/12/2026')).toBe('2026-12-31');
    expect(parseDayInput('1/2/27')).toBe('2027-02-01');
    expect(parseDayInput('05-06-2027')).toBe('2027-06-05');
  });

  it('refuse les dates qui n’existent pas', () => {
    expect(parseDayInput('31/02/2026')).toBeNull();
    expect(parseDayInput('00/12/2026')).toBeNull();
    expect(parseDayInput('demain')).toBeNull();
  });

  it('affiche une date à la française', () => {
    expect(formatDay('2026-12-31')).toBe('31/12/2026');
  });

  it('compte les jours, même d’une année sur l’autre', () => {
    expect(daysBetween('2026-12-25', '2027-01-01')).toBe(7);
    expect(daysBetween('2026-10-25', '2026-10-25')).toBe(0);
    expect(daysBetween('2026-10-25', '2026-10-20')).toBe(-5);
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('les semaines commencent le lundi', () => {
    expect(startOfWeek('2026-10-25')).toBe('2026-10-19'); // dimanche → lundi précédent
    expect(startOfWeek('2026-10-19')).toBe('2026-10-19'); // lundi
    expect(startOfWeek('2026-10-22')).toBe('2026-10-19'); // jeudi
    expect(monthOf('2026-10-25')).toBe('2026-10');
  });

  it('un jour local va de minuit à minuit (même le jour d’un changement d’heure)', () => {
    const { start, end } = dayRange('2026-10-25');
    expect(toDay(new Date(start))).toBe('2026-10-25');
    expect(toDay(new Date(end))).toBe('2026-10-26');
    expect(new Date(start).getHours()).toBe(0);
    expect(new Date(end).getHours()).toBe(0);
  });
});
