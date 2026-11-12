/**
 * Counsel-only material and the dev seat (v2.6986). The owner opened it to the seat on 2026-11-11, "for now": the
 * restrictive policies still stand but ask `counsel_only_held_from_seat()`, which answers false, so the seat reads a
 * counsel-only record, its files and a counsel-only matter document as the dev it reads as. One migration that makes
 * the switch answer true puts the fence back.
 *
 * The seat cannot see which way the switch stands, so it names a hold from what it read: a definer's count of the
 * counsel-only items (`person_counsel_only_count`, `matter_counsel_only_count`) against how many of them came back.
 * With the switch open nothing is held; with it shut every one is, as before v2.6986.
 */

/** How many counsel-only items the count names that the seat's own reads did not hand back (never below 0). */
export function counselOnlyStillHeld(total: unknown, seen: number): number {
  const n = Number(Array.isArray(total) ? total[0] : total)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.max(0, Math.floor(n) - Math.max(0, seen))
}

/** The words of a hold, for `held` on get_person_file. */
export function counselOnlyHeldReason(n: number): string {
  return `${n} counsel-only record${n === 1 ? '' : 's'}, kept from the seat; a dev reads ${n === 1 ? 'it' : 'them'} on People → HR`
}
