/**
 * The words of the print bar at the top of the Affidavits list (the Lien desk, v2.7209). Pure.
 *
 * The bar grew a sentence at a time: the count, three tick boxes, the county with a paragraph under it, and the held
 * line, all in the same small grey. The owner, 2026-11-13: "I don't love how much text", and the held line "blends in
 * too much". So the bar says each thing once, short, and the one line that is a warning is drawn as a press:
 *
 *   **12 ready to print**   [ 2 held, not in this print › ]
 *   [ Print 12 for notarization ]
 *   Print with  [✓ Help sheet] [✓ Notice record] [ Notice copies, about 14 pages ]
 *   Signed in [ the notary writes it ] County (?)
 *
 * The counts are `lienAffidavitPrintPlan`'s, the button is `lienAffidavitPrintWords`' and the county's words are
 * `lienSigningCounty`'s. Nothing here decides what prints.
 */

const count = (n: number, one: string, many: string) => (n === 1 ? one : many.replace('#', String(n)))

export type LienAffidavitPrintBarHeld = {
  /** The amber press: *2 held, not in this print*. Pressing it narrows the list to the held papers. */
  press: string
  /** The whole fact, as the bar's old sentence said it: the press's tip. */
  tip: string
  /** Over the narrowed list: how many are shown, and that each row says why. */
  showing: string
  /** The way back to the whole list. */
  back: string
}

export type LienAffidavitPrintBarStatus = {
  /** *12 ready to print*: the papers this press prints. */
  ready: string
  /** The whole fact, as the bar's old sentence said it (the short form, ready to file): the status words' tip. */
  readyTip: string
  /** Null when no ready paper is held by a gate: the amber press is not drawn. */
  held: LienAffidavitPrintBarHeld | null
}

/** The way back from the held papers to the whole list. */
export const LIEN_PRINT_BAR_SHOW_EVERY_PAPER = 'Show every paper'

/**
 * The status line. `ready` is the short-form papers this print takes, `gated` the ready short-form papers a gate has
 * closed since they were approved (`lienAffidavitPrintPlan` → `gated`).
 */
export function lienAffidavitPrintBarStatus({ ready, gated }: { ready: number; gated: number }): LienAffidavitPrintBarStatus {
  return {
    ready: ready > 0 ? `${ready} ready to print` : 'None ready to print',
    readyTip: ready > 0 ? count(ready, '1 affidavit on the short form is ready to file.', '# affidavits on the short form are ready to file.') : 'None of the affidavits on the short form is ready to file.',
    held:
      gated > 0
        ? {
            press: `${gated} held, not in this print`,
            tip: count(gated, '1 ready affidavit is held by a gate and is left out. Its row says why.', '# ready affidavits are held by a gate and are left out. Each row says why.'),
            showing: count(gated, 'Showing the 1 held paper. Its row says why.', 'Showing the # held papers. Each row says why.'),
            back: LIEN_PRINT_BAR_SHOW_EVERY_PAPER,
          }
        : null,
  }
}

/** The small label over the three chips. */
export const LIEN_PRINT_WITH_LABEL = 'Print with'

export type LienPrintWithKey = 'help_sheet' | 'notice_record' | 'notice_copies'

export type LienPrintWithChip = { key: LienPrintWithKey; label: string }

/**
 * The pages that print in front of the stack, one chip each. `noticeCopyCount` is how many copies of notices the
 * batch would add (`lienAffidavitBatchNoticeCopyCount`): the copies' chip says what it costs, and is not drawn when
 * no paper's notice keeps its words.
 */
export function lienPrintWithChips(noticeCopyCount: number): LienPrintWithChip[] {
  const chips: LienPrintWithChip[] = [
    { key: 'help_sheet', label: 'Help sheet' },
    { key: 'notice_record', label: 'Notice record' },
  ]
  if (noticeCopyCount > 0) chips.push({ key: 'notice_copies', label: count(noticeCopyCount, 'Notice copies, 1 page', 'Notice copies, about # pages') })
  return chips
}
