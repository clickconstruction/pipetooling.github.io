/**
 * The dates block at the bottom of a Billed / Collections row's cell (v2.4168;
 * redrawn in the money legend's grammar v2.4189/v2.4193; rows and one bold
 * line, one deadline at a time, v2.4205):
 *
 *   ● Billed Sep 23 ..................... 12d ago
 *   ● Expected Oct 4 ..................... 1d past      ← the click for They said…
 *       Pays in 2–8d · keeps 0 of 5
 *   ● Lien notice by Oct 15 ................. 10d       ← bold: the one thing to do
 *
 *   ● Billed Sep 29 ....................... today
 *   ● Expected Oct 4 ....................... in 5d
 *   ○ Lien by Dec 15 ......................... 77d
 *   ───────────────────────────────────────────────
 *   Can run late                              72d       ← the verdict, only when it adds
 *
 * Rows read oldest to newest with *how far from today* on the right, the
 * number and its d written together (*12d ago*, v2.4315) like the pay line
 * under them (*Pays in 9–41d*). A
 * promise replaces the Expected row rather than joining it. There is ONE
 * deadline row: on a sub job the § 53.056 notice until it is recorded (nothing
 * can be filed before it), then the lien date with *notice sent* under it; on
 * a direct job the lien date from the start. The bold line under the hairline
 * appears only when it says something the rows do not — the slack (*Can run
 * late · 72d*), a comparison (*Money lands too late · 4d short*), an ask (*Ask
 * for a date*); when the deadline row is itself the to-do it is bold and
 * nothing repeats it. Pure: the money comes from `billedExpectedPayModel`, the
 * deadlines from `buildLienPayRunway`; this only arranges them.
 *
 * Since v2.7043 (punch list #325) the deadline row's WORDS are the next act on
 * the lien path when the Lien desk has one for the job (`lienActFor`, handed
 * in as `lienState.act`): *Find the owner by Oct 15*, *Draft the affidavit by
 * Nov 16*. The day, the count, the dot, the weight and the colour stay the
 * runway's, so the row and the Lien calendar never show two days. With no act
 * the row keeps the deadline's own name. A closed window is one line, *Lien
 * gone Oct 15*, and a filed lien whose copies are not served asks *Serve the
 * affidavit* by its fifth day. Since v2.7047 the row follows the Lien window
 * on two clocks: a notice window closed with the affidavit's day still ahead
 * is *Send the late notice by* that day, not *Lien gone*, and the serve day
 * comes with the runway, so it shows before the Lien desk is ever opened.
 */
import { billedReferenceYmd, daysBetweenYmd, formatYmdMonthDay, type ExpectedPayPaceInput, type PaySpeedData, type PromisedPayDate } from './billedExpectedPay'
import { billedPayModel, type BilledPayRowInput } from './billedDuePay'
import { usuallyLandsShort, usuallyLandsWords, type PayCalendarArg } from './payCalendar'
import { LIEN_RUNWAY_AMBER_DAYS, LIEN_RUNWAY_RED_DAYS, type LienPayRunway } from './lienPayRunway'
import { claimHow, claimOpen, claimStale, daysSinceClaim, staleWords, type PaidClaim } from './paidClaims'
import { LIEN_LATE_NOTICE_ACT, LIEN_ROW_PRESS_SENTENCE, lienActFor, lienDayGuessSentence, lienRowTip, type LienAct } from './lienActWords'
import { lienLineStep, type LienLineTab } from './lienLineStep'

export type LedgerTone = 'done' | 'plain' | 'green' | 'amber' | 'red' | 'blue'
export type LedgerAction = 'they-said' | 'new-date' | 'lien-desk'
/** A filled dot is a fact behind us, the money, or the row that asks; a ring is a deadline still ahead. */
export type LedgerDot = 'filled' | 'ring'

export type LedgerRowKey = 'billed' | 'money' | 'claim' | 'inkind' | 'notice' | 'lien' | 'retainage' | 'filed' | 'closed'

export type LedgerRow = {
  key: LedgerRowKey
  /** "Billed" · "Expected" · "Due" (the payer's Pay calendar, v2.7025) · "They said" · "They say paid" · "Lien notice" · "Lien" · "File the affidavit" · the next act ("Draft the affidavit", `lienActFor`) · "Lien filed" · "Lien gone". */
  label: string
  /** The words between the label and the date: '' · 'by'. */
  joiner: string
  /** "Sep 23"; '' when there is none. */
  date: string
  /** The right column: "7d ago" · "1d past" · "in 4d" · "16d" · "today"; '' when there is none. */
  far: string
  tone: LedgerTone
  /** The row that asks for something — its words and value print bold. */
  bold: boolean
  dot: LedgerDot
  action: LedgerAction | null
  title: string
  /** A quiet line under the row: the estimate a promise displaced, or "notice sent" under the lien date — or, since v2.5491, the notice's state in the desk's words. */
  sub: string
  /** The sub-line's ink when it carries a state (v2.5491); muted when absent. */
  subTone?: LedgerTone
  /** The sub-line's hover: the whole sentence behind a few words (v2.5491). */
  subTitle?: string
}

/** The Lien window's tab a lien line opens on (v2.7046): the paper the line names. */
export type LedgerLienTab = LienLineTab

/**
 * The notice's state under the ledger's lien row (v2.5491): the AR chip's words and tone, from `lienArChipFor`.
 * Since v2.7042 (punch list #325) the chip's parts come too, so the line never says the row's day and count again:
 * `lead` is the words with no day after them, `dueOn` the day the chip names, `paper` the paper it is about and
 * `action` the Do now move it stands for. A reader that passes none of them gets the words as written.
 */
export type LedgerLienState = {
  words: string
  tone: LedgerTone
  title?: string
  lead?: string
  dueOn?: string | null
  paper?: string
  action?: string | null
  /** The next act on the lien path (v2.7043, `lienActFor`): its words take the lien line, and the clock keeps the day. */
  act?: LienAct | null
  /** A closed window someone wrote down on the desk: the *Lien gone* line turns plain. */
  noted?: boolean
}

export type LedgerVerdict = {
  /** "Can run late" · "Money lands too late" · "Ask for a date" · "Nothing landed". */
  label: string
  /** "72d" · "4d short" · ''. */
  value: string
  tone: LedgerTone
  action: LedgerAction | null
  title: string
}

export type BilledDatesLedger = {
  rows: LedgerRow[]
  /** The bold line under the rows; null when the rows already say everything. */
  verdict: LedgerVerdict | null
  /** The whole block as one sentence (the accessible name). */
  full: string
  /**
   * The paper the lien line names (v2.7046, punch list #325, PR 3): the Lien window opens on its tab, where it opened
   * on Demand letter whatever the row said. A notice row, a late notice and a closed notice window open § 53.056
   * notice; the affidavit, its service and a closed lien window open the lien's tab; null with no lien row.
   */
  lienTab: LedgerLienTab | null
}

export type BilledDatesLedgerInput = {
  todayYmd: string
  /** Null on a job-shell row (no bill line). */
  row: BilledPayRowInput | null
  data: PaySpeedData | null
  /** The GC facts and the GC pace here for this bill (v2.6034, `paceInputFor`); null or absent reads the payer as one that is not a GC. */
  pace?: ExpectedPayPaceInput | null
  promise: PromisedPayDate | null
  /** The job's lien runway (`buildLienPayRunway`); null while the clocks load. */
  runway: LienPayRunway | null
  inCollections: boolean
  /** Given up on (Uncollectible, punch list #94): no money row — nobody expects the money, and a promise line would contradict "not owed". */
  uncollectible?: boolean
  /** Where the job's lien paper stands, in the desk's words (v2.5491): the line under the lien row. Null or absent: the old "notice sent" line, when the runway knows one. */
  lienState?: LedgerLienState | null
  /**
   * The customer's word that they already paid (v2.6695, punch list #129): the job's open paid claim from
   * `list_paid_claims` (`openClaimByJob`). It takes the money row's place as **They say paid** with the day they named,
   * green for `STALE_AFTER_DAYS` and amber with *nothing landed in N days* after; its press is the same sheet. A claim
   * something landed against is not open and draws nothing. Null or absent: the money row as before.
   */
  claim?: LedgerPaidClaim | null
  /**
   * An in-kind deal pays this job (v2.6834, punch list #301): the money row is **Scheduled in kind** with no day, since
   * no pay history says when a credit comes, and nobody is asked for a date. The lien rows stand: a credit does not
   * move a deadline.
   */
  inKind?: boolean
  /**
   * The row's Pay calendar (punch list #323, `calendarFor`): the money row reads **Due** with the day the contract
   * makes the bill due, and the line under it says when their money usually lands. The lien rows still read the
   * expected day, the due day plus their usual lateness, since a deadline is weighed against when money really comes.
   * Null or absent: the money row as before.
   */
  calendar?: PayCalendarArg
}

/** What the ledger reads of a paid claim. */
export type LedgerPaidClaim = Pick<PaidClaim, 'paidYmd' | 'method' | 'amount' | 'saidBy' | 'customerName' | 'heardByName' | 'landedSince'>

const dWord = (n: number) => `${n}d`

/** "today" · "yesterday" · "7d ago" for a date behind us; "in 4d" · "16d" ahead (`ahead` picks the form). */
function farWords(days: number, ahead: 'in' | 'bare'): string {
  if (days === 0) return 'today'
  if (days === -1) return 'yesterday'
  if (days < 0) return `${dWord(-days)} ago`
  return ahead === 'in' ? `in ${dWord(days)}` : dWord(days)
}

export function buildBilledDatesLedger({ todayYmd, row, data, pace = null, promise, runway, inCollections, uncollectible = false, lienState = null, claim = null, inKind = false, calendar = null }: BilledDatesLedgerInput): BilledDatesLedger {
  const rows: LedgerRow[] = []
  /**
   * The state line under a lien row (v2.5491), when the desk has one. Since v2.7042 (punch list #325) it says nothing
   * the row above it says: it is left out when the row asks for the very act it names (*File the affidavit* over
   * *File the affidavit*), and it drops its own day and count when they are the row's, or when it is about the row's
   * own paper, whose day is the clock's to give. A line about another paper (a retainage notice, service) keeps its day.
   */
  const stateUnder = (rowPaper: 'notice' | 'affidavit' | null, rowYmd: string, rowAsksToFile: boolean): { sub: string; subTone?: LedgerTone; subTitle?: string } | null => {
    if (!lienState) return null
    if (rowAsksToFile && lienState.action === 'file_affidavit') return { sub: '' }
    const sayItOnce = lienState.lead != null && ((lienState.dueOn != null && lienState.dueOn === rowYmd) || (rowPaper != null && lienState.paper === rowPaper))
    return { sub: sayItOnce ? lienState.lead! : lienState.words, subTone: lienState.tone, subTitle: lienState.title ?? lienState.words }
  }

  // The bill
  const billedYmd = row ? billedReferenceYmd(row) : null
  if (billedYmd) {
    const ago = daysBetweenYmd(billedYmd, todayYmd) ?? 0
    rows.push({ key: 'billed', label: 'Billed', joiner: '', date: formatYmdMonthDay(billedYmd), far: farWords(-ago, 'bare'), tone: 'done', bold: false, dot: 'filled', action: null, title: `The bill went out ${formatYmdMonthDay(billedYmd)} — the day the pay estimate below counts from`, sub: '' })
  }

  // The money — their word if they gave one, else the estimate from their pay history; none on a bill the office gave up on.
  // A word that they already paid (v2.6695) takes the row: nobody expects a day once the customer says the money is on its way.
  const said = row && claim && !uncollectible && claimOpen(claim) ? claim : null
  const saidStale = said ? claimStale(said, todayYmd) : false
  const scheduledInKind = inKind && !uncollectible && !said
  const stat = row && !uncollectible && !said && !scheduledInKind ? billedPayModel(row, data, todayYmd, null, pace, calendar) : null
  const promised = row && promise && !uncollectible && !said && !scheduledInKind ? billedPayModel(row, data, todayYmd, promise, pace, calendar) : null
  const moneyYmd = promised?.expectedYmd ?? stat?.expectedYmd ?? null
  const moneyTo = moneyYmd ? (daysBetweenYmd(todayYmd, moneyYmd) ?? 0) : null
  const moneyPast = moneyTo != null && moneyTo < 0
  const moneyAhead = moneyTo != null && !moneyPast
  const moneyAction: LedgerAction = promise ? 'new-date' : 'they-said'
  const moneyTitle = promised?.title ?? stat?.title ?? ''
  if (said) {
    const who = said.saidBy || said.customerName || 'They'
    const since = daysSinceClaim(said, todayYmd)
    const how = `${claimHow(said)}${said.amount != null ? ` · $${said.amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : ''}`
    rows.push({
      key: 'claim',
      label: 'They say paid',
      joiner: '',
      date: formatYmdMonthDay(said.paidYmd),
      far: since < 0 ? farWords(-since, 'in') : farWords(-since, 'bare'),
      tone: inCollections ? 'red' : saidStale ? 'amber' : 'green',
      bold: false,
      dot: 'filled',
      action: 'they-said',
      title: `${who} ${who === 'They' ? 'say' : 'says'} they paid ${formatYmdMonthDay(said.paidYmd)}, ${claimHow(said)}${said.heardByName ? `, heard by ${said.heardByName}` : ''}. ${saidStale ? `Nothing has landed on the job since; ask before chasing.` : 'The office pairs it with the deposit when it lands.'}`,
      sub: saidStale ? staleWords(said, todayYmd) : how,
      subTone: saidStale ? 'amber' : undefined,
      subTitle: saidStale ? `${how} · ${staleWords(said, todayYmd)}` : undefined,
    })
  }
  if (scheduledInKind) {
    rows.push({
      key: 'inkind',
      label: 'Scheduled in kind',
      joiner: '',
      date: '',
      far: '',
      tone: 'green',
      bold: false,
      dot: 'filled',
      action: null,
      title: 'An in kind arrangement pays this bill. It is not chased, and it is not money coming.',
      sub: '',
    })
  }
  // A Pay calendar (v2.7025): the row says the day the contract makes the bill due, and the line under it says when
  // their money usually lands. Everything below still weighs the expected day (`moneyYmd`), never the due day.
  const dueYmd = !promised && stat?.source === 'terms' ? stat.dueYmd : null
  if (dueYmd && stat) {
    const dueTo = daysBetweenYmd(todayYmd, dueYmd) ?? 0
    const duePast = dueTo < 0
    rows.push({
      key: 'money',
      label: 'Due',
      joiner: '',
      date: formatYmdMonthDay(dueYmd),
      far: duePast ? `${dWord(-dueTo)} past` : farWords(dueTo, 'in'),
      tone: inCollections ? 'red' : duePast ? 'amber' : 'green',
      bold: false,
      dot: 'filled',
      action: moneyAction,
      title: moneyTitle,
      // The day leads: the row is narrow and cuts the tail. The hover carries the math.
      sub: usuallyLandsShort(dueYmd, stat.lateness) ?? 'No payment on record yet',
      subTitle: usuallyLandsWords(dueYmd, stat.lateness) ?? 'No payment of theirs is measured yet, so the due day is the best guess there is.',
    })
  } else if (moneyYmd && moneyTo != null) {
    const tone: LedgerTone = inCollections ? 'red' : moneyPast ? 'amber' : 'green'
    rows.push({
      key: 'money',
      label: promised ? 'They said' : 'Expected',
      joiner: '',
      date: formatYmdMonthDay(moneyYmd),
      far: moneyPast ? `${dWord(-moneyTo)} past` : farWords(moneyTo, 'in'),
      tone,
      bold: false,
      dot: 'filled',
      action: moneyAction,
      title: moneyTitle,
      sub: promised && promised.dueYmd ? `due ${formatYmdMonthDay(promised.dueYmd)} by their pay calendar` : promised && stat ? `expected ${formatYmdMonthDay(stat.expectedYmd)} by their history` : '',
    })
  }

  // The one deadline: its day, dot, weight and colour from the runway (the clock), its words from the
  // desk's next act when the desk has one (the paper) — v2.7043, punch list #325.
  let verdict: LedgerVerdict | null = null
  let lienTab: LedgerLienTab | null = null
  /** The money's own ask, when no lien line is pressing: their word that they paid, a day gone by, or no day at all. */
  const moneyAsk = (): LedgerVerdict | null => {
    if (said) return saidStale ? { label: 'Nothing landed', value: dWord(daysSinceClaim(said, todayYmd)), tone: 'amber', action: 'they-said', title: `They said they paid ${formatYmdMonthDay(said.paidYmd)} and nothing has landed on the job since — ask whether it went out` } : null
    // No count beside it (v2.7042): the Expected row two lines up already says how far past the day is.
    if (moneyPast && moneyTo != null) return { label: 'Ask for a date', value: '', tone: inCollections ? 'red' : 'amber', action: moneyAction, title: `${moneyTitle} — the date has gone by with the balance still open` }
    if (scheduledInKind) return null // a credit comes as it comes: nobody is asked for a date
    return { label: 'Ask for a date', value: '', tone: 'plain', action: moneyAction, title: 'Nobody has said when this will be paid' }
  }
  // A notice window that closed with the affidavit's own day still ahead (v2.7047, punch list #325, PR 4): the Lien
  // window and the desk read v2.4708's rule, that a late notice can still carry the lien, and the row follows them.
  // The clock says so itself since v2.7198 (punch list #335, row 4) (`late_notice`), so `closed` here is closed for good.
  // Which paper's day the line races and whether the desk's act names it: one reading with the phone's chip (punch list #335, row 5).
  const step = lienLineStep(todayYmd, runway, lienState)
  if (runway && runway.state !== 'none') {
    const guess = lienDayGuessSentence(runway)
    if (runway.state === 'filed') {
      lienTab = 'affidavit'
      const filedDate = runway.lines[0]?.replace(/^lien filed\s*/i, '') ?? ''
      // The copy's last day: the runway's (v2.7047, read with the clocks, so the row asks without the Lien desk open), else the desk's own row.
      const serveBy = runway.serveByYmd || (lienState?.action === 'record_service' && lienState.dueOn ? lienState.dueOn : '')
      const serveDays = serveBy ? daysBetweenYmd(todayYmd, serveBy) : null
      const serveAct = lienActFor({ paper: 'affidavit', action: 'record_service' })
      if (serveBy && serveDays != null && serveAct) {
        // The copies are not served: five days is the shortest clock on the path, so the act takes the line and the filing day sits under it.
        rows.push({ key: 'filed', label: serveAct.words, joiner: 'by', date: formatYmdMonthDay(serveBy), far: serveDays < 0 ? `${dWord(-serveDays)} late` : farWords(serveDays, 'bare'), tone: 'red', bold: true, dot: 'filled', action: 'lien-desk', title: lienRowTip({ why: serveAct.why, dayWords: formatYmdMonthDay(serveBy) }), sub: filedDate ? `Filed ${filedDate}` : '' })
      } else {
        // Served: the runway knows the day without the desk; the desk's chip says the same once it is read.
        const served = runway.servedYmd ? { sub: `served ${formatYmdMonthDay(runway.servedYmd)}`, subTone: 'green' as const } : null
        rows.push({ key: 'filed', label: 'Lien filed', joiner: '', date: filedDate, far: '', tone: 'green', bold: false, dot: 'filled', action: 'lien-desk', title: lienRowTip({ why: 'The lien affidavit is on file. The money is still owed.', dayWords: '' }), sub: '', ...(served ?? stateUnder('affidavit', '', false)) })
      }
    } else if (runway.state === 'closed') {
      const noticeClosed = /^notice/i.test(runway.lines[1] ?? '')
      const closedYmd = noticeClosed ? runway.noticeByYmd : runway.lienByYmd
      const closedDays = closedYmd ? (daysBetweenYmd(todayYmd, closedYmd) ?? 0) : 0
      // One short line (v2.7043): *Lien window closed Oct 15* over *Lien gone* said it twice and was cut to dots at the
      // column's width. Red until someone writes the closed window down on the desk, plain after.
      lienTab = noticeClosed ? 'notice' : 'affidavit'
      const noted = lienState?.noted === true
      const closedWords = closedYmd ? formatYmdMonthDay(closedYmd) : ''
      rows.push({
        key: 'closed',
        label: 'Lien gone',
        joiner: '',
        date: closedWords,
        far: closedYmd ? farWords(closedDays, 'bare') : '',
        tone: noted ? 'plain' : 'red',
        bold: !noted,
        dot: 'filled',
        action: 'lien-desk',
        title: lienRowTip({ why: `${noticeClosed ? 'The notice window' : 'The lien window'} closed${closedWords ? ` ${closedWords}` : ''} with nothing ${noticeClosed ? 'sent' : 'filed'}. The lien is gone. The money is still owed.`, dayWords: '' }),
        sub: '',
      })
    } else if (step) {
      const { noticeFirst, lateNotice, own, deadlineYmd, deadlineDays, lineAct } = step
      lienTab = step.tab
      if (lineAct && !lineAct.dated) {
        // No lien can attach, so there is no day to race: the fact, and who to ask.
        rows.push({ key: noticeFirst ? 'notice' : 'lien', label: lineAct.words, joiner: '', date: '', far: '', tone: 'amber', bold: true, dot: 'filled', action: 'lien-desk', title: lienRowTip({ why: lineAct.why, dayWords: '' }), sub: lineAct.under, subTone: 'amber', subTitle: lineAct.why })
        verdict = moneyAsk()
      } else if (deadlineYmd && deadlineDays != null) {
        /** + when the money lands before the deadline, − when after. */
        const slack = moneyYmd ? daysBetweenYmd(moneyYmd, deadlineYmd) : null
        const short = moneyAhead && slack != null && slack < 0
        // The row is the to-do when the money is not landing before it: expected after it, already
        // past, or never named. A notice is cheap and preserves the lien, so it asks at any distance;
        // a lien asks inside three weeks.
        const urgent = short || ((moneyPast || moneyTo == null) && ((noticeFirst && !own) || lateNotice || deadlineDays <= LIEN_RUNWAY_AMBER_DAYS))
        const tone: LedgerTone = short || deadlineDays <= LIEN_RUNWAY_RED_DAYS ? 'red' : urgent ? 'amber' : moneyAhead && slack != null && slack >= 0 ? 'green' : 'plain'
        const dayWords = formatYmdMonthDay(deadlineYmd)
        const quietWhy = noticeFirst ? 'A notice to the owner and the GC is owed for this work.' : lateNotice ? LIEN_LATE_NOTICE_ACT.why : 'The lien affidavit is the next paper on this job.'
        rows.push({
          key: own ? 'retainage' : noticeFirst ? 'notice' : 'lien',
          // The paper is the affidavit everywhere a person meets it: the Lien window's header and the desk say *File the affidavit* (v2.7042).
          label: lineAct ? lineAct.words : noticeFirst ? 'Lien notice' : lateNotice ? LIEN_LATE_NOTICE_ACT.words : urgent ? 'File the affidavit' : 'Lien',
          joiner: 'by',
          date: dayWords,
          far: farWords(deadlineDays, 'bare'),
          tone,
          bold: urgent,
          dot: urgent ? 'filled' : 'ring',
          action: 'lien-desk',
          title: lienRowTip({ why: lineAct ? lineAct.why : quietWhy, dayWords, guess }),
          sub: !lineAct && !noticeFirst && runway.noticeSent ? 'notice sent' : '',
          // The act is the line, so nothing sits under it but what the act itself carries (a hold's reason).
          ...(lineAct ? (lineAct.under ? { sub: lineAct.under, subTone: lienState?.tone, subTitle: lienState?.title ?? lineAct.under } : {}) : stateUnder(noticeFirst ? 'notice' : 'affidavit', deadlineYmd, !noticeFirst && urgent)),
        })
        if (short && slack != null) {
          // The row above names the act, so this line speaks of the money alone (v2.7042; it read *Notice first* / *File the lien first*).
          verdict = { label: 'Money lands too late', value: `${dWord(-slack)} short`, tone: 'red', action: 'lien-desk', title: `The money is expected ${-slack} ${slack === -1 ? 'day' : 'days'} after the last day. Act before ${dayWords}. ${LIEN_ROW_PRESS_SENTENCE}` }
        } else if (moneyAhead && slack != null) {
          verdict = { label: 'Can run late', value: dWord(slack), tone: deadlineDays <= LIEN_RUNWAY_RED_DAYS ? 'amber' : 'green', action: 'lien-desk', title: `${moneyTitle ? `${moneyTitle} ` : ''}The money can land ${slack} ${slack === 1 ? 'day' : 'days'} later than expected before the ${noticeFirst && !own ? 'notice has to go' : own ? 'retainage notice has to go' : 'lien window closes'}. ${LIEN_ROW_PRESS_SENTENCE}` }
        } else if (urgent) {
          verdict = null // the deadline row is the to-do; nothing repeats it
        } else {
          verdict = moneyAsk()
        }
      }
    }
  }


  const full = rows
    .map((r) => [r.label, r.joiner, r.date, r.far ? `· ${r.far}` : ''].filter(Boolean).join(' '))
    .concat(verdict ? [[verdict.label, verdict.value ? `· ${verdict.value}` : ''].filter(Boolean).join(' ')] : [])
    .join(' · ')
  return { rows, verdict, full, lienTab }
}
