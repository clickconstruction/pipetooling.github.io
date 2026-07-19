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

export type PctCommitValidation = { ok: true } | { ok: false; error: string }

/** Gate a commit: block a sub-100% set that has no note. */
export function validatePctCommit(value: number, note: string): PctCommitValidation {
  if (pctNoteRequired(value) && note.trim() === '') {
    return { ok: false, error: 'Add a note for anything under 100%.' }
  }
  return { ok: true }
}
