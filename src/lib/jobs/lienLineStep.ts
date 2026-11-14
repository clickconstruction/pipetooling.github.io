/**
 * The step a billed job's lien line stands on (v2.7184, punch list #335, row 5). Pure.
 *
 * The Pipeline's billed row worked this out inside `buildBilledDatesLedger`: which paper's day the
 * line races (the notice first on a sub job, a retainage notice when its day is nearer, else the
 * affidavit), whether a late notice is the step (v2.7047), and whether the Lien desk's next act
 * names the line (v2.7043). The phone's two-line row read none of it. Its chip came from the clock
 * alone, so it said *lien in 4 d* over a job whose desk row said *Answer the homestead question*.
 *
 * This is that reading, lifted out so the row and the phone chip take it from one place. The
 * money is not read here: whether the line asks in bold is still the ledger's call.
 */
import { daysBetweenYmd, type LienPayRunway } from './lienPayRunway'
import { LIEN_LATE_NOTICE_ACT, lienDayGuessSentence, type LienAct } from './lienActWords'
import { formatYmdMonthDay } from './billedExpectedPay'

/** What the step reads of the desk's word on the job (`LedgerLienState`, from `lienArChipFor`). */
export type LienLineDeskState = {
  /** The next act on the lien path (`lienActFor`); null when the desk's move is a reminder, or there is none. */
  act?: LienAct | null
  /** The paper the desk's move is about. */
  paper?: string
  /** That paper's last day. */
  dueOn?: string | null
}

/** The Lien window's tab a lien line opens on: the paper the line names. */
export type LienLineTab = 'notice' | 'affidavit'

export type LienLineStep = {
  /** On a sub job the notice comes first: nothing can be filed before it goes. */
  noticeFirst: boolean
  /** Every notice window closed with none sent, and the affidavit's own day is still ahead (v2.4708). */
  lateNotice: boolean
  /** A retainage notice due before the clock's own day takes the line, with its own day. */
  own: boolean
  /** The paper whose day the line races. */
  rowPaper: 'notice' | 'affidavit' | 'retainage'
  /** That day; '' when the clock has none. */
  deadlineYmd: string
  deadlineDays: number | null
  /** The desk's act when it is a step toward the line's own day; null when the line keeps the deadline's name. */
  lineAct: LienAct | null
  tab: LienLineTab
}

/**
 * A notice window that closed with the affidavit's own day still ahead (v2.7047): the Lien window and
 * the desk read v2.4708's rule, that a late notice can still carry the lien. The runway keeps its own
 * `closed`; its readers look past it here.
 */
export function lienLateNoticeOpen(runway: LienPayRunway | null | undefined): boolean {
  return !!runway && runway.state === 'closed' && runway.closedBy === 'notice' && runway.daysToLien != null && runway.daysToLien >= 0 && runway.lienByYmd !== ''
}

/**
 * The step for a job whose lien can still be perfected; null when there is no line to name a step on
 * (no clock, a lien on file, or a window that closed for good).
 */
export function lienLineStep(todayYmd: string, runway: LienPayRunway | null | undefined, desk: LienLineDeskState | null | undefined): LienLineStep | null {
  if (!runway || runway.state === 'none' || runway.state === 'filed') return null
  const lateOpen = lienLateNoticeOpen(runway)
  if (runway.state === 'closed' && !lateOpen) return null
  const act = desk?.act ?? null
  const noticeFirst = runway.state === 'notice_due' && runway.daysToNotice != null && runway.noticeByYmd !== ''
  // No notice went for any month: the late notice is the step. One that did go carries the affidavit, as the desk's gate reads it.
  const lateNotice = lateOpen && !runway.noticeMonths.some((m) => m.state === 'sent' || m.state === 'mailed')
  const clockYmd = noticeFirst ? runway.noticeByYmd : runway.lienByYmd
  const clockDays = noticeFirst ? runway.daysToNotice : runway.daysToLien
  // A retainage notice due before the clock's own day is the nearest paper: it takes the line, with its own day.
  const ownDays = act && desk?.paper === 'retainage' && desk.dueOn && clockYmd && desk.dueOn < clockYmd ? daysBetweenYmd(todayYmd, desk.dueOn) : null
  const own = ownDays != null && ownDays >= 0
  const rowPaper: LienLineStep['rowPaper'] = own ? 'retainage' : noticeFirst ? 'notice' : 'affidavit'
  // The act names the line when it is a step toward the line's own day: on the line's paper, or a notice that still has to go before the affidavit.
  const lineAct = act && (desk?.paper === rowPaper || (rowPaper === 'affidavit' && desk?.paper === 'notice')) ? act : null
  return {
    noticeFirst,
    lateNotice,
    own,
    rowPaper,
    deadlineYmd: own ? (desk?.dueOn ?? '') : clockYmd,
    deadlineDays: own ? ownDays : clockDays,
    lineAct,
    // A notice, a retainage notice and a notice that must go before the affidavit are all read on the window's notice tab.
    tab: rowPaper === 'affidavit' && !(lineAct && desk?.paper === 'notice') && !(lateNotice && !lineAct) ? 'affidavit' : 'notice',
  }
}

/** The phone chip's count: the clock's own short form, *4 d*. */
function chipDays(n: number): string {
  if (n < 0) return `${-n} d late`
  return n === 0 ? 'today' : `${n} d`
}

export type LienPhoneChipWords = {
  /** The chip: *Draft the affidavit · 4 d*, or the clock's own words when no step is named. */
  label: string
  /** The hover and the accessible name: where the paper stands, the last day, the tap. */
  title: string
  /** The Lien window's tab the chip opens on; null leaves the window on its first tab. */
  tab: LienLineTab | null
  /** True when the words are a step from the act table, false when they are the clock's. */
  step: boolean
}

export const LIEN_CHIP_TAP_SENTENCE = 'Tap to open the Lien window.'

/**
 * The phone row's lien chip (v2.7184, punch list #335, row 5). When the desk names the job's next step the
 * chip says it in the act table's words (`lienActWords.ts`), as the billed row does and as the
 * Accounts Receivable chip has since v2.7048, with the days left after it. A late notice that can
 * still go reads *Send the late notice*, never *lien gone*. With no step to name the chip keeps the
 * clock's words: *file first*, *12 d of room*, *lien gone*.
 */
export function lienPhoneChipWords(todayYmd: string, runway: LienPayRunway, desk: LienLineDeskState | null | undefined): LienPhoneChipWords {
  const step = lienLineStep(todayYmd, runway, desk)
  const act = step ? (step.lineAct ?? (step.lateNotice ? LIEN_LATE_NOTICE_ACT : null)) : null
  if (!step || !act) {
    const closedTab: LienLineTab | null = runway.state === 'closed' ? (runway.closedBy === 'notice' ? 'notice' : 'affidavit') : runway.state === 'filed' ? 'affidavit' : null
    return { label: runway.chipLabel, title: `${runway.title} ${LIEN_CHIP_TAP_SENTENCE}`, tab: step ? step.tab : closedTab, step: false }
  }
  const dated = act.dated && step.deadlineYmd !== '' && step.deadlineDays != null
  const label = dated ? `${act.words} · ${chipDays(step.deadlineDays!)}` : act.words
  const title = [act.why, dated ? `The last day is ${formatYmdMonthDay(step.deadlineYmd)}.` : '', act.under ? `${act.under}.` : '', LIEN_CHIP_TAP_SENTENCE, dated ? lienDayGuessSentence(runway) : ''].filter(Boolean).join(' ')
  return { label, title, tab: step.tab, step: true }
}
