/**
 * Date-only helpers for the batch cooking flow.
 *
 * `<input type="date">` values and the backend `date` column round-trip as
 * 'YYYY-MM-DD' strings. They must be parsed as LOCAL calendar days:
 * `new Date('YYYY-MM-DD')` parses as UTC midnight — the previous evening in
 * America/Chicago — which blocked today as a cooking date and shifted
 * recorded dates back a day. (Same UTC-midnight bug fixed in the meal-plan
 * builder via `toLocalDateKey` / `new Date(value + 'T00:00:00')`.)
 */

/** Parse a 'YYYY-MM-DD' string as a local calendar day (no TZ shift). */
export function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Format a Date as 'YYYY-MM-DD' from local parts (no UTC round-trip). */
export function toLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

/** Today's date as 'YYYY-MM-DD' in local time. */
export function todayLocalDateKey(): string {
  return toLocalDateKey(new Date());
}

/** True when a 'YYYY-MM-DD' string is today or later, comparing calendar days. */
export function isTodayOrFuture(dateString: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return parseLocalDate(dateString).getTime() >= today.getTime();
}
