/**
 * *It stands as printed* (punch list #362, step 7; the owner's answer of 2026-11-25: *on record, in a table of its
 * own*, with who, when and what had changed, and *a second change asks again*).
 *
 * A printed lien paper that would say another thing today has three answers: print it again, take it out of the run,
 * or say it stands. The third is kept as a row of `lien_print_stands`, under the key of the difference it was given
 * for (`lienPrintChangeKey`). It answers for that difference alone: when a statement moves again the key is another,
 * no live row matches, and the desk asks again.
 *
 * Pure: the rows and a paper's difference in, the answer that stands out. The read and the write are
 * `lienPrintStandsIo.ts`.
 */
import { val } from '../valuesInPlace'
import type { LienPrintPaperKind } from './lienPrintSworn'

/** One change as the row keeps it, in words. */
export type LienPrintStandsChange = { key: string; label: string; printed: string; now: string }

export type LienPrintStandsRow = {
  id: string
  jobId: string
  paper: LienPrintPaperKind
  changeKey: string
  changes: LienPrintStandsChange[]
  sentDocumentId: string | null
  stoodBy: string
  stoodAt: string
}

/** The standing answer for this paper and this difference, or null: an answer for another difference does not stand in. */
export function lienPrintStandsFor(rows: ReadonlyArray<LienPrintStandsRow>, paper: LienPrintPaperKind, jobId: string, changeKey: string): LienPrintStandsRow | null {
  if (!changeKey) return null
  return rows.find((r) => r.paper === paper && r.jobId === jobId && r.changeKey === changeKey) ?? null
}

/** The words the card, its smokes and the guide share. */
export const LIEN_PRINT_STANDS_WORDS = {
  /** The three presses on a changed paper. */
  reprint: 'Reprint this one',
  reprintNotice: 'Reprint in the run window ›',
  stands: 'It stands as printed',
  takeOut: 'Take it out of the run',
  /** On a paper that stands: the way back. */
  takeBack: 'Take back',
  /** Over the papers that stand. */
  stoodHead: 'Stands as printed',
  stoodLead: 'Someone read each change below and said the printed paper is still good. Another change asks again.',
  notStood: 'The answer was not kept.',
  notTakenBack: 'The answer was not taken back.',
} as const

/** Who said it stands and when: *Stands as printed, by ⟪Rosa⟫ on ⟪Nov 25⟫.* A person the desk cannot name reads *someone in the office*. */
export function lienPrintStandsByWords(row: Pick<LienPrintStandsRow, 'stoodBy'>, userName: (userId: string) => string | null | undefined, dayWords: string): string {
  const name = userName(row.stoodBy)?.trim()
  return `Stands as printed, by ${name ? val('who', name) : 'someone in the office'}${dayWords ? ` on ${val('day', dayWords)}` : ''}.`
}

/** Under the print press: *⟪1⟫ affidavit stands as printed. It does not print again here.* '' with none. */
export function lienPrintStoodWords(n: number): string {
  if (n <= 0) return ''
  return `${val('count', String(n))} ${n === 1 ? 'affidavit stands' : 'affidavits stand'} as printed. ${n === 1 ? 'It does' : 'They do'} not print again here.`
}
