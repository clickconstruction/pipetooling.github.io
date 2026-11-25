/**
 * Changed since printed, on the run (punch list #362, step 7; the owner's answer of 2026-11-25: *every statement the
 * paper makes*). The run's printed papers, each set beside what it would say today.
 *
 * `lienPrintSworn.ts` is the compare and `lienPrintsIo.ts` the read. This kernel puts them over the run:
 *
 *   - **A printed notice** (the Board's *Approved · to mail*). Today's notice is the stored paper with the money the
 *     desk would draw now, so a bill corrected after the print counts though nobody redrew the notice.
 *   - **An affidavit that is right.** Today's affidavit is the one the batch would print now. Until this step
 *     nothing recorded an affidavit's print, so after a reload a printed one still counted as to print. One whose
 *     newest print says the same today is now *printed*: the run does not print it again.
 *
 * A print filed before v2.8589 kept no values. For an affidavit that is `unread`: it counts as to print, as before.
 * For a notice the stored paper stands in for what printed, which is right unless the notice was redrawn since, and
 * the line says a stand-in was read.
 *
 * Pure: the run's lines, its notices, its affidavit papers and the newest prints in, the standings out.
 */
import { demandDate } from '../jobsDocuments/demandDate'
import type { LienAffidavitFields } from '../jobsDocuments/lienAffidavitFieldsType'
import type { LienNoticeFields } from '../jobsDocuments/lienNoticeFieldsType'
import { val } from '../valuesInPlace'
import type { LienNoticeMoney } from './lienNoticeParted'
import { lienPrintStandsFor, type LienPrintStandsRow } from './lienPrintStands'
import { LIEN_SWORN_FIELDS, lienAffidavitPrintFields, lienChangedSincePrint, lienNoticePrintFields, lienPrintChangeKey, lienPrintKey, lienPrintStanding, type LienPrintChange, type LienPrintFact, type LienPrintFields, type LienPrintPaperKind, type LienSwornAs } from './lienPrintSworn'

/** A notice of the run, as much of it as this reads. */
export type LienRunPrintedNotice = { jobId: string; /** The notice's desk item: the run window opens on it. */ itemId?: string; fields: LienNoticeFields; printedAt?: string | null; printedBy?: string | null; moneyNow?: LienNoticeMoney | null }

/** An affidavit of the run as the batch would print it now. */
export type LienRunPrintedAffidavit = { jobId: string; fields: LienAffidavitFields }

/** A line of the run that is right: the paper, and whether the Board holds it as printed. */
export type LienRunPrintedLine = { kind: LienPrintPaperKind; jobId: string; label: string; title: string; printed: boolean }

/** One change as the screen says it: the values in the paper's own words. */
export type LienRunChange = { key: string; label: string; printed: string; now: string; /** *The claim: printed ⟪$18,400.00⟫, now ⟪$6,150.00⟫.* */ words: string }

export type LienRunChangedPaper = {
  /** `notice:<jobId>` or `affidavit:<jobId>`, as the run's line names the paper. */
  key: string
  kind: LienPrintPaperKind
  jobId: string
  label: string
  title: string
  /** When the paper printed, as its row keeps it; '' when nothing says. */
  printedAt: string
  printedBy: string
  changes: LienRunChange[]
  /** The print kept no values: the notice as stored was read in its place. */
  standIn: boolean
  /** The key of this difference (`lienPrintChangeKey`): an answer that it stands is kept under it. */
  changeKey: string
  /** The filed print it is read against; null when the stored notice stood in. */
  copyId: string | null
  /** A notice's desk item, for the run window; null for an affidavit or when the builder gave none. */
  itemId: string | null
}

/** A changed paper a person said stands as printed, with that answer. */
export type LienRunStoodPaper = LienRunChangedPaper & { stand: LienPrintStandsRow }

export type LienRunPrinted = {
  /** The printed papers a statement of which has moved and nobody has answered for, in the run's order. */
  changed: LienRunChangedPaper[]
  /** The changed papers a person said stand as printed through this very difference. */
  stood: LienRunStoodPaper[]
  /** The affidavits among those: the run does not print them again. */
  stoodAffidavits: ReadonlySet<string>
  /** The affidavits whose newest print says the same today: the run does not print them again. */
  printedSame: ReadonlySet<string>
  /** The affidavits printed before a print kept its values: nothing to compare, so they count as to print. */
  unread: number
}

export const LIEN_RUN_PRINTED_NONE: LienRunPrinted = { changed: [], stood: [], stoodAffidavits: new Set(), printedSame: new Set(), unread: 0 }

/** A notice as it would print today: the stored paper, with the money the desk would draw now over it. */
export function lienNoticeNowFields(n: Pick<LienRunPrintedNotice, 'fields' | 'moneyNow'>): LienPrintFields {
  const now = lienNoticePrintFields(n.fields)
  const m = n.moneyNow
  if (!m) return now
  // A § 53.057 form gives the claim alone: a value the builder did not give is left as the paper has it.
  if (m.claimAmount !== undefined) now.claimAmount = m.claimAmount
  if (m.claimSplit !== undefined) now.claimSplit = m.claimSplit
  if (m.retainageIncluded !== undefined) now.retainageIncluded = m.retainageIncluded
  return now
}

const usd = (cents: number): string => (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })

/** A flag's two readings, by field: a paper says a thing or does not. */
const FLAG_WORDS: Readonly<Record<string, readonly [yes: string, no: string]>> = {
  homesteadStatement: ['printed', 'not printed'],
  homestead: ['printed', 'not printed'],
  includeNoticesSworn: ['sworn', 'left out'],
  isSub: ['yes', 'no'],
  form: ['the short form', 'the earlier form'],
}

/** A value as a person reads it: money with its sign, a day in words, a tick as what it does, a blank as *nothing*. */
function shown(key: string, as: LienSwornAs, raw: string): string {
  const v = raw.trim()
  const flag = FLAG_WORDS[key]
  if (flag) return v ? flag[0] : flag[1]
  if (!v) return as === 'money' ? 'none' : 'nothing'
  if (as === 'money') {
    const n = Number(v.replace(/[$,\s]/g, ''))
    return Number.isFinite(n) ? usd(Math.round(n * 100)) : v
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? demandDate(v) : v
}

/** The compare's changes in the screen's words. */
export function lienRunChanges(kind: LienPrintPaperKind, changes: ReadonlyArray<LienPrintChange>): LienRunChange[] {
  const asOf = new Map(LIEN_SWORN_FIELDS[kind].map((f) => [f.key, f.as]))
  return changes.map((c) => {
    const as = asOf.get(c.key) ?? 'text'
    const printed = shown(c.key, as, c.printed)
    const now = shown(c.key, as, c.now)
    const label = c.label.charAt(0).toUpperCase() + c.label.slice(1)
    return { key: c.key, label, printed, now, words: `${label}: printed ${val('was', printed)}, now ${val('now', now)}.` }
  })
}

export type LienRunPrintedInput = {
  /** The run's right papers, in the run's order. */
  lines: ReadonlyArray<LienRunPrintedLine>
  notices: ReadonlyArray<LienRunPrintedNotice>
  affidavits: ReadonlyArray<LienRunPrintedAffidavit>
  /** Each job's newest filed print (`loadLienNewestPrints`), or null when it is not read: then nothing is said. */
  prints: ReadonlyMap<string, LienPrintFact> | null
  /** The answers that stand (`readLienPrintStands`); absent or empty = none, and every changed paper asks. */
  stands?: ReadonlyArray<LienPrintStandsRow>
}

/** The run's printed papers against today. With the prints not read it answers nothing: never "nothing printed". */
export function lienRunPrinted(input: LienRunPrintedInput): LienRunPrinted {
  const { prints } = input
  if (!prints) return LIEN_RUN_PRINTED_NONE
  const noticeOf = new Map(input.notices.map((n) => [n.jobId, n]))
  const affidavitOf = new Map(input.affidavits.map((a) => [a.jobId, a]))
  const changed: LienRunChangedPaper[] = []
  const stood: LienRunStoodPaper[] = []
  const stoodAffidavits = new Set<string>()
  const printedSame = new Set<string>()
  let unread = 0
  const stands = input.stands ?? []
  // A changed paper goes to one list: the ones a person answered for through this very difference, or the ones that ask.
  const place = (paper: Omit<LienRunChangedPaper, 'changeKey' | 'changes'>, raw: ReadonlyArray<LienPrintChange>) => {
    const whole: LienRunChangedPaper = { ...paper, changes: lienRunChanges(paper.kind, raw), changeKey: lienPrintChangeKey(paper.kind, raw) }
    const stand = lienPrintStandsFor(stands, paper.kind, paper.jobId, whole.changeKey)
    if (!stand) return void changed.push(whole)
    stood.push({ ...whole, stand })
    if (paper.kind === 'affidavit') stoodAffidavits.add(paper.jobId)
  }

  for (const line of input.lines) {
    const base = { key: `${line.kind}:${line.jobId}`, kind: line.kind, jobId: line.jobId, label: line.label, title: line.title }
    const fact = prints.get(lienPrintKey(line.kind, line.jobId))
    if (line.kind === 'notice') {
      const n = noticeOf.get(line.jobId)
      // A notice not yet printed prints as it stands: nothing has left the printer to compare.
      if (!n || !line.printed) continue
      const now = lienNoticeNowFields(n)
      const standing = lienPrintStanding('notice', fact, now)
      if (standing.state === 'changed') {
        place({ ...base, printedAt: standing.fact.printedAt, printedBy: standing.fact.printedBy, standIn: false, copyId: standing.fact.copyId, itemId: n.itemId ?? null }, standing.changes)
      } else if (standing.state !== 'printed') {
        // The print kept no values (it is older, or one paper spoke for several jobs): the stored notice stands in.
        const changes = lienChangedSincePrint('notice', lienNoticePrintFields(n.fields), now)
        if (changes.length > 0) place({ ...base, printedAt: n.printedAt ?? fact?.printedAt ?? '', printedBy: n.printedBy ?? fact?.printedBy ?? '', standIn: true, copyId: null, itemId: n.itemId ?? null }, changes)
      }
      continue
    }
    const a = affidavitOf.get(line.jobId)
    if (!a) continue
    const standing = lienPrintStanding('affidavit', fact, lienAffidavitPrintFields(a.fields))
    if (standing.state === 'printed') printedSame.add(line.jobId)
    else if (standing.state === 'unread') unread += 1
    else if (standing.state === 'changed') place({ ...base, printedAt: standing.fact.printedAt, printedBy: standing.fact.printedBy, standIn: false, copyId: standing.fact.copyId, itemId: null }, standing.changes)
  }
  return { changed, stood, stoodAffidavits, printedSame, unread }
}

/** The words the card, its smokes and the guide share. */
export const LIEN_RUN_PRINTED_WORDS = {
  head: 'Changed since printed',
  lead: 'Each paper here left the printer saying one thing. It would say another today.',
  standIn: 'This print kept no values, so the notice as stored was read in its place.',
  /** What happens next to a changed paper, by kind. */
  affidavitNext: 'A changed affidavit prints again with the run, unless someone says it stands.',
  noticeNext: 'A changed notice is taken back and printed again in the run window.',
  /** Under the print press, when the newest prints could not be read. */
  failed: 'What printed before could not be read. Every right affidavit counts as to print.',
  retry: 'Read again',
} as const

/** Under the print press: *⟪3⟫ affidavits printed already and say the same today. They do not print again here.* '' with none. */
export function lienRunPrintedSameWords(n: number): string {
  if (n <= 0) return ''
  return `${val('count', String(n))} ${n === 1 ? 'affidavit' : 'affidavits'} printed already and ${n === 1 ? 'says' : 'say'} the same today. ${n === 1 ? 'It does' : 'They do'} not print again here. The Board’s Print for notarization press still prints ${n === 1 ? 'it' : 'them'}.`
}

/** Under that: *⟪2⟫ affidavits printed before the desk kept what a paper said. They print again.* '' with none. */
export function lienRunPrintedUnreadWords(n: number): string {
  if (n <= 0) return ''
  return `${val('count', String(n))} ${n === 1 ? 'affidavit' : 'affidavits'} printed before the desk kept what a paper said. ${n === 1 ? 'It prints' : 'They print'} again.`
}

/** A changed paper's head: *Printed ⟪Nov 25, 10:02 AM⟫ by ⟪Rosa⟫.* The caller words the instant. */
export function lienRunPrintedByWords(p: Pick<LienRunChangedPaper, 'printedBy'>, whenWords: string): string {
  const who = p.printedBy.trim()
  if (!whenWords && !who) return 'Printed.'
  return `Printed${whenWords ? ` ${val('when', whenWords)}` : ''}${who ? ` by ${val('who', who)}` : ''}.`
}
