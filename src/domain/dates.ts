/**
 * Dates : saisir, afficher et calculer.
 *
 * Deux formats sont utilisés dans la base :
 *   - un JOUR : « 2026-12-31 » (date de péremption, jour d'un rapport) ;
 *   - un MOMENT : « 2026-10-25T14:30:00.000Z » (heure exacte d'une vente, en temps universel).
 * À l'écran, on affiche toujours « 31/12/2026 » et l'heure locale de l'appareil.
 */

const pad = (value: number) => String(value).padStart(2, '0');

/** Le jour (« 2026-10-25 ») d'une date, à l'heure locale de l'appareil. */
export function toDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Aujourd'hui, à l'heure locale de l'appareil. */
export function today(): string {
  return toDay(new Date());
}

/** Le jour local d'un moment enregistré en base (« 2026-10-25T23:30:00Z » → jour local). */
export function dayOfMoment(iso: string): string {
  return toDay(new Date(iso));
}

/** Lit une date tapée « 31/12/2026 » (ou « 31-12-26 ») → « 2026-12-31 ». Null si invalide. */
export function parseDayInput(input: string): string | null {
  const match = /^(\d{1,2})[/.\-\s](\d{1,2})[/.\-\s](\d{2}|\d{4})$/.exec(input.trim());
  if (!match) {
    return null;
  }
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
  const date = new Date(year, month - 1, day);
  // Refuse les dates qui n'existent pas (31/02, 00/13…)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return toDay(date);
}

/** « 2026-12-31 » → « 31/12/2026 ». */
export function formatDay(day: string): string {
  const [year, month, date] = day.slice(0, 10).split('-');
  return `${date}/${month}/${year}`;
}

/** Un moment → « 25/10/2026 14:30 » (heure locale). */
export function formatMoment(iso: string): string {
  const date = new Date(iso);
  return `${formatDay(toDay(date))} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Un moment → « 14:30 » (heure locale). */
export function formatTime(iso: string): string {
  const date = new Date(iso);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function dayToUtcMs(day: string): number {
  const [year, month, date] = day.split('-').map(Number);
  return Date.UTC(year, month - 1, date);
}

/** Nombre de jours de « from » à « to » (positif si « to » est après). */
export function daysBetween(from: string, to: string): number {
  return Math.round((dayToUtcMs(to.slice(0, 10)) - dayToUtcMs(from.slice(0, 10))) / 86_400_000);
}

/** Ajoute des jours à un jour : addDays('2026-12-30', 3) → '2027-01-02'. */
export function addDays(day: string, days: number): string {
  const date = new Date(dayToUtcMs(day) + days * 86_400_000);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Le lundi de la semaine d'un jour (les semaines commencent le lundi). */
export function startOfWeek(day: string): string {
  const weekday = new Date(dayToUtcMs(day)).getUTCDay(); // 0 = dimanche
  return addDays(day, weekday === 0 ? -6 : 1 - weekday);
}

/** Le mois d'un jour : « 2026-10 ». */
export function monthOf(day: string): string {
  return day.slice(0, 7);
}

/** Le début (inclus) et la fin (exclue) d'un jour local, en moments universels pour la base. */
export function dayRange(day: string): { start: string; end: string } {
  const [year, month, date] = day.split('-').map(Number);
  return {
    start: new Date(year, month - 1, date).toISOString(),
    end: new Date(year, month - 1, date + 1).toISOString(),
  };
}
