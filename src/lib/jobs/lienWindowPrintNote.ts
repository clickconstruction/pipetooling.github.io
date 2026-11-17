import type { LienTimelineNoticeState } from './lienTimeline'

/**
 * The Lien window's § 53.056 tab, on a job whose approved notice waits on the Lien desk (v2.7516).
 *
 * The tab builds its own notice from the job and prints one unsigned set, to photocopy for the second envelope. The
 * desk's notice for the same job is the draft the leader approved, and the desk prints it with his signature, counsel's
 * letter and a set of pages for each envelope (`lienRunOne.ts`). Printing from the tab while the desk holds the
 * approved paper sends out a different, unsigned notice beside a desk that says signed, which is what happened on
 * 2026-11-16. The tab keeps its Print, since a job can be opened here with no desk queue at hand, and says which
 * paper to print when the opener knows where the desk's notice stands.
 *
 * Pure. Null for every state but the two an approved notice has: `ready` (approved, to print) and `printed`
 * (printed, its mail numbers owed). The sentences keep to `plainWords.ts`.
 */
export type LienWindowPrintNote = { lead: string; words: string; press: string }

export const LIEN_WINDOW_PRINT_NOTE_PRESS = 'Open it on the Lien desk ›'

export function lienWindowPrintNote(state: LienTimelineNoticeState | null | undefined): LienWindowPrintNote | null {
  if (state === 'ready') {
    return {
      lead: 'The Lien desk holds this job’s approved notice.',
      words: 'Print that one from the desk, under Just this one. The desk’s print carries the leader’s signature and a set of pages for each envelope. A print from this tab is a new copy with no signature.',
      press: LIEN_WINDOW_PRINT_NOTE_PRESS,
    }
  }
  if (state === 'printed') {
    return {
      lead: 'The Lien desk has printed this job’s notice.',
      words: 'It waits on its mail numbers. Enter them on the desk. A print from this tab is a new copy with no signature.',
      press: LIEN_WINDOW_PRINT_NOTE_PRESS,
    }
  }
  return null
}
