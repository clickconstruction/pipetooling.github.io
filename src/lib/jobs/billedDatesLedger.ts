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
 * late · 72d*), a comparison (*Notice first · 4d short*), an ask (*Ask for a
 * date · 12d past*) or a loss (*Lien gone*); when the deadline row is itself
 * the to-do it is bold and nothing repeats it. Pure: the money comes from
 * `billedExpectedPayModel`, the deadlines from `buildLienPayRunway`; this only
 * arranges them.
 */
import { billedExpectedPayModel, billedReferenceYmd, daysBetweenYmd, formatYmdMonthDay, type ExpectedPayRowInput, type PaySpeedData, type PromisedPayDate } from './billedExpectedPay'
import { LIEN_RUNWAY_AMBER_DAYS, LIEN_RUNWAY_RED_DAYS, type LienPayRunway } from './lienPayRunway'

export type LedgerTone = 'done' | 'plain' | 'green' | 'amber' | 'red'
export type LedgerAction = 'they-said' | 'new-date' | 'lien-desk'
/** A filled dot is a fact behind us, the money, or the row that asks; a ring is a deadline still ahead. */
export type LedgerDot = 'filled' | 'ring'

export type LedgerRowKey = 'billed' | 'money' | 'notice' | 'lien' | 'filed' | 'closed'

export type LedgerRow = {
  key: LedgerRowKey
  /** "Billed" · "Expected" · "They said" · "Lien notice" · "Lien" · "File the lien" · "Lien filed" · "Lien window closed" · "Notice window closed". */
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
  /** A quiet line under the row: the estimate a promise displaced, or "notice sent" under the lien date. */
  sub: string
}

export type LedgerVerdict = {
  /** "Can run late" · "Notice first" · "File the lien first" · "Ask for a date" · "Lien gone". */
  label: string
  /** "72d" · "4d short" · "12d past" · ''. */
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
}

export type BilledDatesLedgerInput = {
  todayYmd: string
  /** Null on a job-shell row (no bill line). */
  row: ExpectedPayRowInput | null
  data: PaySpeedData | null
  promise: PromisedPayDate | null
  /** The job's lien runway (`buildLienPayRunway`); null while the clocks load. */
  runway: LienPayRunway | null
  inCollections: boolean
  /** Given up on (Uncollectible, punch list #94): no money row — nobody expects the money, and a promise line would contradict "not owed". */
  uncollectible?: boolean
}

const dWord = (n: number) => `${n}d`

/** "today" · "yesterday" · "7d ago" for a date behind us; "in 4d" · "16d" ahead (`ahead` picks the form). */
function farWords(days: number, ahead: 'in' | 'bare'): string {
  if (days === 0) return 'today'
  if (days === -1) return 'yesterday'
  if (days < 0) return `${dWord(-days)} ago`
  return ahead === 'in' ? `in ${dWord(days)}` : dWord(days)
}

export function buildBilledDatesLedger({ todayYmd, row, data, promise, runway, inCollections, uncollectible = false }: BilledDatesLedgerInput): BilledDatesLedger {
  const rows: LedgerRow[] = []

  // The bill
  const billedYmd = row ? billedReferenceYmd(row) : null
  if (billedYmd) {
    const ago = daysBetweenYmd(billedYmd, todayYmd) ?? 0
    rows.push({ key: 'billed', label: 'Billed', joiner: '', date: formatYmdMonthDay(billedYmd), far: farWords(-ago, 'bare'), tone: 'done', bold: false, dot: 'filled', action: null, title: `The bill went out ${formatYmdMonthDay(billedYmd)} — the day the pay estimate below counts from`, sub: '' })
  }

  // The money — their word if they gave one, else the estimate from their pay history; none on a bill the office gave up on
  const stat = row && !uncollectible ? billedExpectedPayModel(row, data, todayYmd, null) : null
  const promised = row && promise && !uncollectible ? billedExpectedPayModel(row, data, todayYmd, promise) : null
  const moneyYmd = promised?.expectedYmd ?? stat?.expectedYmd ?? null
  const moneyTo = moneyYmd ? (daysBetweenYmd(todayYmd, moneyYmd) ?? 0) : null
  const moneyPast = moneyTo != null && moneyTo < 0
  const moneyAhead = moneyTo != null && !moneyPast
  const moneyAction: LedgerAction = promise ? 'new-date' : 'they-said'
  const moneyTitle = promised?.title ?? stat?.title ?? ''
  if (moneyYmd && moneyTo != null) {
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
      sub: promised && stat ? `expected ${formatYmdMonthDay(stat.expectedYmd)} by their history` : '',
    })
  }

  // The one deadline, from the runway's verdict
  let verdict: LedgerVerdict | null = null
  if (runway && runway.state !== 'none') {
    if (runway.state === 'filed') {
      rows.push({ key: 'filed', label: 'Lien filed', joiner: '', date: runway.lines[0]?.replace(/^lien filed\s*/i, '') ?? '', far: '', tone: 'green', bold: false, dot: 'filled', action: 'lien-desk', title: runway.title, sub: '' })
    } else if (runway.state === 'closed') {
      const noticeClosed = /^notice/i.test(runway.lines[1] ?? '')
      const closedYmd = noticeClosed ? runway.noticeByYmd : runway.lienByYmd
      const closedDays = closedYmd ? (daysBetweenYmd(todayYmd, closedYmd) ?? 0) : 0
      rows.push({ key: 'closed', label: noticeClosed ? 'Notice window closed' : 'Lien window closed', joiner: '', date: closedYmd ? formatYmdMonthDay(closedYmd) : '', far: closedYmd ? farWords(closedDays, 'bare') : '', tone: 'done', bold: false, dot: 'filled', action: 'lien-desk', title: runway.title, sub: '' })
      verdict = { label: 'Lien gone', value: '', tone: 'red', action: 'lien-desk', title: runway.title }
    } else {
      // On a sub job the notice comes first; nothing can be filed before it goes.
      const noticeFirst = runway.state === 'notice_due' && runway.daysToNotice != null && runway.noticeByYmd !== ''
      const deadlineYmd = noticeFirst ? runway.noticeByYmd : runway.lienByYmd
      const deadlineDays = noticeFirst ? runway.daysToNotice! : runway.daysToLien
      if (deadlineYmd && deadlineDays != null) {
        /** + when the money lands before the deadline, − when after. */
        const slack = moneyYmd ? daysBetweenYmd(moneyYmd, deadlineYmd) : null
        const short = moneyAhead && slack != null && slack < 0
        // The row is the to-do when the money is not landing before it: expected after it, already
        // past, or never named. A notice is cheap and preserves the lien, so it asks at any distance;
        // a lien asks inside three weeks.
        const urgent = short || ((moneyPast || moneyTo == null) && (noticeFirst || deadlineDays <= LIEN_RUNWAY_AMBER_DAYS))
        const tone: LedgerTone = short || deadlineDays <= LIEN_RUNWAY_RED_DAYS ? 'red' : urgent ? 'amber' : moneyAhead && slack != null && slack >= 0 ? 'green' : 'plain'
        rows.push({
          key: noticeFirst ? 'notice' : 'lien',
          label: noticeFirst ? 'Lien notice' : urgent ? 'File the lien' : 'Lien',
          joiner: 'by',
          date: formatYmdMonthDay(deadlineYmd),
          far: farWords(deadlineDays, 'bare'),
          tone,
          bold: urgent,
          dot: urgent ? 'filled' : 'ring',
          action: 'lien-desk',
          title: runway.title,
          sub: !noticeFirst && runway.noticeSent ? 'notice sent' : '',
        })
        if (short && slack != null) {
          verdict = { label: noticeFirst ? 'Notice first' : 'File the lien first', value: `${dWord(-slack)} short`, tone: 'red', action: 'lien-desk', title: runway.title }
        } else if (moneyAhead && slack != null) {
          verdict = { label: 'Can run late', value: dWord(slack), tone: deadlineDays <= LIEN_RUNWAY_RED_DAYS ? 'amber' : 'green', action: 'lien-desk', title: `${moneyTitle ? `${moneyTitle} ` : ''}The money can land ${slack} ${slack === 1 ? 'day' : 'days'} later than expected before the ${noticeFirst ? 'notice has to go' : 'lien window closes'}.` }
        } else if (urgent) {
          verdict = null // the deadline row is the to-do; nothing repeats it
        } else if (moneyPast && moneyTo != null) {
          verdict = { label: 'Ask for a date', value: `${dWord(-moneyTo)} past`, tone: inCollections ? 'red' : 'amber', action: moneyAction, title: `${moneyTitle} — the date has gone by with the balance still open` }
        } else {
          verdict = { label: 'Ask for a date', value: '', tone: 'plain', action: moneyAction, title: 'Nobody has said when this will be paid' }
        }
      }
    }
  }

  const full = rows
    .map((r) => [r.label, r.joiner, r.date, r.far ? `· ${r.far}` : ''].filter(Boolean).join(' '))
    .concat(verdict ? [[verdict.label, verdict.value ? `· ${verdict.value}` : ''].filter(Boolean).join(' ')] : [])
    .join(' · ')
  return { rows, verdict, full }
}
