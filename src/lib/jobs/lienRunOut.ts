/**
 * The run's third step, **Out the door** (punch list #362, step 8; the mock-up's D, the owner's pick of 2026-11-16):
 * what the run has printed and what is left to mail and file, with the presses that exist.
 *
 *   - **Mail.** The run's printed notices, still to mail: their mail numbers are typed in the run window's own
 *     *Record the mailing* step, which is the press here (`LIEN_RUN_ACT.record`, *Enter mail numbers*).
 *   - **File.** The run's printed affidavits, by the county clerk they are filed with, in the order the batch prints
 *     them (`lienAffidavitClerkOrder`: by county, then as the desk listed them). Each is signed before a notary first,
 *     then filed, and the filing is recorded on its job in the Lien window: the press on each line opens it there.
 *   - **The tally.** Printed, to mail, to file, left out, changed since printed.
 *
 * A notice that is mailed and an affidavit that is filed leave the run (`lienRunPapers` counts the papers still to
 * send or file), so the card says what is left, not what was done: *mailed a of b* would need a record of the run
 * that nothing keeps. The copies owed to each owner after a filing are the liens' fourth step, drawn and not approved
 * (punch list #366, counsel's), and are not here.
 *
 * Pure: the checklist as the strip's second pass drew it, the printed affidavits and each one's county in, the card
 * out. Nothing here writes.
 */
import { val } from '../valuesInPlace'
import type { LienGetItRight, LienRunLine } from './lienGetItRight'
import { lienRunActLabel } from './lienRunWords'

/** The words the card, its smokes and the guide share. */
export const LIEN_RUN_OUT_WORDS = {
  head: 'Out the door',
  mail: 'Mail',
  mailLead: 'One trip to the counter. Type each envelope’s number from the receipt, or scan it, in the run window.',
  file: 'File',
  fileLead: 'Signed before a notary first. Then one stop a clerk. Record each filing on its job once the clerk stamps it.',
  filePress: 'Record the filing ›',
  /** A paper whose county is not on it: the clerk cannot be named. */
  clerkUnknown: 'County not named on the paper',
} as const

/** One county clerk's stop: the papers filed with that clerk, in the run's order. */
export type LienRunOutClerk = {
  /** The county as the paper names it; '' when it does not. */
  county: string
  /** *Marlow County clerk*; the words for an unnamed county otherwise. */
  label: string
  lines: LienRunLine[]
}

export type LienRunOut = {
  /** Something of the run is printed: the card is drawn. */
  show: boolean
  /** The printed notices still to mail, and the press that opens the run window on recording. */
  mail: { count: number; lines: LienRunLine[]; press: string }
  /** The printed affidavits still to file, a stop a clerk. */
  file: { count: number; clerks: LienRunOutClerk[] }
  /** *Printed ⟪6⟫ · ⟪4⟫ to mail · ⟪2⟫ to file · ⟪1⟫ left out · ⟪1⟫ changed since printed*, each value marked. */
  tally: string
}

export type LienRunOutInput = {
  /** The checklist, with the print's facts (`lienGetItRightWithFacts`). */
  run: Pick<LienGetItRight, 'right' | 'counts'>
  /** Right affidavits that printed and say the same today, or that stand as printed: the ones out the door's. */
  printedAffidavitJobIds: ReadonlySet<string>
  /** The county an affidavit is filed in, as its paper names it; null or '' when the paper does not. */
  countyOf: (jobId: string) => string | null | undefined
  /** Printed papers of the run that would say another thing today (`lienRunPrinted`'s `changed`). */
  changed: number
}

const count = (n: number) => val('count', String(n))

/** *Marlow County clerk*; a county that already says *County* takes *clerk* alone. */
export function lienRunOutClerkLabel(county: string): string {
  const c = county.trim()
  if (!c) return LIEN_RUN_OUT_WORDS.clerkUnknown
  return /\bcounty$/i.test(c) ? `${c} clerk` : `${c} County clerk`
}

export function buildLienRunOut(input: LienRunOutInput): LienRunOut {
  const { run } = input
  const mailLines = run.right.filter((l) => l.kind === 'notice' && l.stageKey === 'in_mail')
  const fileLines = run.right.filter((l) => l.kind === 'affidavit' && input.printedAffidavitJobIds.has(l.jobId))

  // By county, as the batch lies in the stack; a paper with no county last, under its own head.
  const byCounty = new Map<string, LienRunOutClerk>()
  for (const l of fileLines) {
    const county = (input.countyOf(l.jobId) ?? '').trim()
    const key = county.toLowerCase()
    const clerk = byCounty.get(key) ?? { county, label: lienRunOutClerkLabel(county), lines: [] }
    clerk.lines.push(l)
    byCounty.set(key, clerk)
  }
  const clerks = [...byCounty.values()].sort((a, b) => (a.county === '' ? 1 : 0) - (b.county === '' ? 1 : 0) || a.county.toLowerCase().localeCompare(b.county.toLowerCase()))

  const printed = mailLines.length + fileLines.length
  const tally = [
    `Printed ${count(printed)}`,
    mailLines.length > 0 ? `${count(mailLines.length)} to mail` : '',
    fileLines.length > 0 ? `${count(fileLines.length)} to file` : '',
    run.counts.leftOut > 0 ? `${count(run.counts.leftOut)} left out` : '',
    input.changed > 0 ? `${count(input.changed)} changed since printed` : '',
  ]
    .filter(Boolean)
    .join(' · ')

  return {
    show: printed > 0,
    mail: { count: mailLines.length, lines: mailLines, press: lienRunActLabel('record', mailLines.length) },
    file: { count: fileLines.length, clerks },
    tally,
  }
}
