/**
 * When New Prospect and Edit prospect may close on Escape or the backdrop (v2.5582, punch list
 * #113): while nothing changed, at once; once something did, they ask (`useLeaveGuard`), as the
 * house's big windows have since v2.5530. The walk of 2026-10-16 found Escape did nothing on an
 * untouched New Prospect, and the backdrop threw away typing without a word.
 */

/** New Prospect is dirty when any box holds something: a non-blank string, or a true flag (a linked customer). */
export function anyTyped(values: Record<string, string | boolean | null | undefined>): boolean {
  return Object.values(values).some((v) => (typeof v === 'string' ? v.trim() !== '' : v === true))
}

/** Edit prospect is dirty when any box differs, trimmed, from what the window opened with. */
export function editDirty(now: Record<string, string>, openedWith: Record<string, string>): boolean {
  const keys = new Set([...Object.keys(now), ...Object.keys(openedWith)])
  for (const k of keys) {
    if ((now[k] ?? '').trim() !== (openedWith[k] ?? '').trim()) return true
  }
  return false
}
