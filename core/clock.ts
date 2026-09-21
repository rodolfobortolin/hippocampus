/**
 * A span of seconds as hours and minutes: `3h07`, `12h`.
 *
 * Rounded to whole minutes *before* the hours are split off. Splitting first
 * and rounding the remainder is how 3h59m45s came out as "3h60" — on screen,
 * in what the model read back, and in the journal written from it.
 */
export function hoursAndMinutes(seconds: number): string {
  const total = Math.round(Math.max(0, seconds) / 60)
  return `${Math.floor(total / 60)}h${String(total % 60).padStart(2, '0')}`
}
