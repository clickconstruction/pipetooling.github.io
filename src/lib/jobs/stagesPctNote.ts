/**
 * Stages "% complete" note rules. Setting a job's percent from the Stages
 * activity panel also posts a thread note with the percent baked in. A note is
 * required for anything under 100% (100% is self-explanatory: the work is done).
 */

/** A note is required unless the job is being marked 100% complete. */
export function pctNoteRequired(value: number): boolean {
  return value !== 100
}

/** The thread-note body: "45% complete — <note>", or just "100% complete" when no note. */
export function composePctCompleteNoteBody(value: number, note: string): string {
  const trimmed = note.trim()
  return trimmed ? `${value}% complete — ${trimmed}` : `${value}% complete`
}

/**
 * Auto-note body for the quick % inputs (Pipeline inline "% done", Edit Job)
 * that historically wrote pct_complete SILENTLY — every change now leaves a
 * thread-note trail even without user note text. Clearing composes a body the
 * baseline parser deliberately ignores (it doesn't start with "N% complete").
 */
export function composePctAutoNoteBody(value: number | null, previous: number | null): string {
  if (value != null) return composePctCompleteNoteBody(value, '')
  return previous != null ? `Cleared % complete — was ${previous}%` : 'Cleared % complete'
}

export type PctCommitValidation = { ok: true } | { ok: false; error: string }

/** Gate a commit: block a sub-100% set that has no note. */
export function validatePctCommit(value: number, note: string): PctCommitValidation {
  if (pctNoteRequired(value) && note.trim() === '') {
    return { ok: false, error: 'Add a note for anything under 100%.' }
  }
  return { ok: true }
}
