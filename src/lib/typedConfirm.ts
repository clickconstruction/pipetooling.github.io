/**
 * Typed confirms (punch list #188, the **confirm** rows 72–79, v2.6765): a door the owner opened wider than a dev keeps a
 * pause in front of it — the person types a word the window names, the shape Delete customer and Delete project have
 * used for the customer's and the project's name. The act stays reversible or audited (Recently deleted, the audited
 * delete path), so the gate is a pause, not a wall.
 *
 * Pure: no React, no supabase. The prompt that asks for the word is `useTypedConfirm` (`src/hooks/useTypedConfirm.ts`).
 */

/** The word a person types: trimmed, inner spaces folded, case ignored. */
function folded(s: string | null | undefined): string {
  return (s ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

/** True when what was typed is the word the window asked for. An empty word never matches. */
export function typedWordMatches(expected: string, typed: string | null | undefined): boolean {
  const want = folded(expected)
  return want !== '' && folded(typed) === want
}

/** The window's sentence: what typing the word does. */
export function typedConfirmMessage(act: string, word: string): string {
  return `Type ${word} to ${act}. Anything else keeps it.`
}

/** The toast when the word did not match: nothing happened. */
export function typedConfirmMissWords(word: string): string {
  return `That was not ${word}, so nothing changed.`
}

/** A pay report's word (row 78): the period's last day as month/day, `2026-11-08` → `11/8`. */
export function payReportPeriodWord(periodEnd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(periodEnd)
  if (!m) return periodEnd
  return `${Number(m[2])}/${Number(m[3])}`
}

/** A count's word (rows 74, 75, 77): the number of rows the sweep will touch. */
export function countWord(n: number): string {
  return String(Math.max(0, Math.trunc(n)))
}
