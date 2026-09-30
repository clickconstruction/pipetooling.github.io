/**
 * The dates block at the bottom of a Billed / Collections row's cell (v2.4168;
 * redrawn v2.4193 in the money legend's own grammar):
 *
 *   10 days left to send the notice
 *   [ used ][ notice ][            42 d left             ]      ← the time bar
 *   ● Billed Sep 23 .................... 12 d ago
 *   ● Expected Oct 4 .................... 1 d past      ← the click for They said…
 *       usually pays in 2–8 d · kept 0 of 5 dates
 *   ● Send the notice by Oct 15 ............ 10 d
 *   ○ Lien by Nov 16 ....................... 42 d
 *   ───────────────────────────────────────────────
 *   Send the notice                          10 d       ← the verdict, bold
 *
 * The bar is the money bar's twin for time: one segment per stretch between
 * the dates, sized by days, grey where time is used, the blue outline on the
 * segment today sits in, green for the room between the money and the lien,
 * a red hatch when the lien dies first. Rows read oldest to newest with *how
 * far from today* on the right; a promise replaces the Expected row rather
 * than joining it, so the block is the same height whatever happens. The
 * bold line under the hairline is the verdict — the room, or the one thing
 * to do. Pure: the money comes from `billedExpectedPayModel`, the deadlines
 * from `buildLienPayRunway`; this only arranges them.
 */
import { billedExpectedPayModel, billedReferenceYmd, daysBetweenYmd, formatYmdMonthDay, type ExpectedPayRowInput, type PaySpeedData, type PromisedPayDate } from './billedExpectedPay'
import { LIEN_RUNWAY_AMBER_DAYS, LIEN_RUNWAY_RED_DAYS, type LienPayRunway } from './lienPayRunway'

export type LedgerTone = 'done' | 'plain' | 'green' | 'amber' | 'red'
export type LedgerAction = 'they-said' | 'new-date' | 'lien-desk'
/** A filled dot is a fact behind us, the money, or the row that asks; a ring is a date still ahead. */
export type LedgerDot = 'filled' | 'ring'

export type LedgerRowKey = 'billed' | 'money' | 'notice' | 'notice-sent' | 'lien' | 'filed' | 'closed'

export type LedgerRow = {
  key: LedgerRowKey
  /** "Billed" · "Expected" · "They said" · "Send the notice" · "Notice sent" · "Lien" · "File the lien" · "Lien filed" · "Window closed". */
  label: string
  /** The words between the label and the date: '' · 'by' · 'for'. */
  joiner: string
  /** "Sep 23"; '' when there is none. */
  date: string
  /** The right column: "7 d ago" · "1 d past" · "in 4 d" · "16 d" · "today"; '' when there is none. */
  far: string
  tone: LedgerTone
  /** The row that asks for something — its value prints bold. */
  bold: boolean
  dot: LedgerDot
  action: LedgerAction | null
  title: string
  /** A quiet line under the row: the estimate a promise displaced. */
  sub: string
}

export type LedgerSegmentKind = 'wait' | 'room' | 'short' | 'notice' | 'closed'

export type LedgerSegment = {
  /** `<from>-<to>` by row key ('start' for a shell row's today). */
  key: string
  days: number
  /** How much of this stretch is behind us, 0–1. */
  usedFrac: number
  /** Today sits inside this stretch — it wears the money bar's live outline. */
  live: boolean
  kind: LedgerSegmentKind
  tone: LedgerTone
  /** "72 d of room" · "42 d left" · "notice" · "closed 14 d ago" · ''. Drawn only when it fits. */
  label: string
}

export type LedgerBar = {
  segments: LedgerSegment[]
  /** The line over the bar — what is left: "77 days left to file the lien" · "16 days left to send the notice" · "the lien window closed Sep 15". The dates themselves are the rows under it. */
  caption: string
}

export type LedgerVerdict = {
  /** "Room after they pay" · "Send the notice" · "File the lien first" · "File the lien" · "Ask for a date" · "Lien gone". */
  label: string
  /** "72 d" · "16 d" · "5 d short" · "12 d past" · ''. */
  value: string
  tone: LedgerTone
  action: LedgerAction | null
  title: string
}

export type BilledDatesLedger = {
  rows: LedgerRow[]
  /** Null when there is no deadline to run to (no runway, a filed lien, or no dates at all). */
  bar: LedgerBar | null
  /** The bold line under the rows; null when the rows say everything (a filed lien, no runway). */
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
}

const dWord = (n: number) => `${n} d`

/** "today" · "yesterday" · "7 d ago" for a date behind us; "in 4 d" · "16 d" ahead (`ahead` picks the form). */
function farWords(days: number, ahead: 'in' | 'bare'): string {
  if (days === 0) return 'today'
  if (days === -1) return 'yesterday'
  if (days < 0) return `${-days} d ago`
  return ahead === 'in' ? `in ${dWord(days)}` : dWord(days)
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

/** "77 days left to file the lien" · "1 day left to send the notice" · "today is the last day to file the lien". */
function leftWords(days: number, todo: string): string {
  if (days <= 0) return `today is the last day to ${todo}`
  return `${days} ${days === 1 ? 'day' : 'days'} left to ${todo}`
}

type Point = { key: LedgerRowKey | 'start'; ymd: string; tone: LedgerTone }

export function buildBilledDatesLedger({ todayYmd, row, data, promise, runway, inCollections }: BilledDatesLedgerInput): BilledDatesLedger {
  const rows: LedgerRow[] = []
  const points: Point[] = []

  // The bill
  const billedYmd = row ? billedReferenceYmd(row) : null
  if (billedYmd) {
    const ago = daysBetweenYmd(billedYmd, todayYmd) ?? 0
    rows.push({ key: 'billed', label: 'Billed', joiner: '', date: formatYmdMonthDay(billedYmd), far: farWords(-ago, 'bare'), tone: 'done', bold: false, dot: 'filled', action: null, title: `The bill went out ${formatYmdMonthDay(billedYmd)} — the day every clock below starts from`, sub: '' })
    points.push({ key: 'billed', ymd: billedYmd, tone: 'done' })
  }

  // The money — their word if they gave one, else the estimate from their pay history
  const stat = row ? billedExpectedPayModel(row, data, todayYmd, null) : null
  const promised = row && promise ? billedExpectedPayModel(row, data, todayYmd, promise) : null
  const moneyYmd = promised?.expectedYmd ?? stat?.expectedYmd ?? null
  const moneyTo = moneyYmd ? (daysBetweenYmd(todayYmd, moneyYmd) ?? 0) : null
  const moneyPast = moneyTo != null && moneyTo < 0
  const moneyAction: LedgerAction = promise ? 'new-date' : 'they-said'
  let moneyTone: LedgerTone = 'plain'
  if (moneyYmd && moneyTo != null) {
    moneyTone = inCollections ? 'red' : moneyPast ? 'amber' : 'green'
    rows.push({
      key: 'money',
      label: promised ? 'They said' : 'Expected',
      joiner: '',
      date: formatYmdMonthDay(moneyYmd),
      far: moneyPast ? `${-moneyTo} d past` : farWords(moneyTo, 'in'),
      tone: moneyTone,
      bold: false,
      dot: 'filled',
      action: moneyAction,
      title: promised?.title ?? stat?.title ?? '',
      sub: promised && stat ? `expected ${formatYmdMonthDay(stat.expectedYmd)} by their history` : '',
    })
    points.push({ key: 'money', ymd: moneyYmd, tone: moneyTone })
  }

  // The deadlines, from the runway's verdict
  let verdict: LedgerVerdict | null = null
  let caption = ''
  let lienRow: LedgerRow | null = null
  if (runway && runway.state !== 'none') {
    const lienDate = runway.lienByYmd ? formatYmdMonthDay(runway.lienByYmd) : ''
    const noticeDate = runway.noticeByYmd ? formatYmdMonthDay(runway.noticeByYmd) : ''
    if (runway.state === 'filed') {
      rows.push({ key: 'filed', label: 'Lien filed', joiner: '', date: runway.lines[0]?.replace(/^lien filed\s*/i, '') ?? '', far: '', tone: 'green', bold: false, dot: 'filled', action: 'lien-desk', title: runway.title, sub: '' })
    } else if (runway.state === 'closed') {
      const noticeClosed = /^notice/i.test(runway.lines[1] ?? '')
      const closedYmd = noticeClosed ? runway.noticeByYmd : runway.lienByYmd
      const closedDays = closedYmd ? (daysBetweenYmd(todayYmd, closedYmd) ?? 0) : 0
      rows.push({ key: 'closed', label: noticeClosed ? 'Notice window closed' : 'Window closed', joiner: '', date: closedYmd ? formatYmdMonthDay(closedYmd) : '', far: closedYmd ? farWords(closedDays, 'bare') : '', tone: 'done', bold: false, dot: 'filled', action: 'lien-desk', title: runway.title, sub: '' })
      if (closedYmd) points.push({ key: 'closed', ymd: closedYmd, tone: 'done' })
      verdict = { label: 'Lien gone', value: '', tone: 'red', action: 'lien-desk', title: runway.title }
      caption = closedYmd ? `the ${noticeClosed ? 'notice' : 'lien'} window closed ${formatYmdMonthDay(closedYmd)}` : ''
    } else {
      const notice = runway.marks?.notice
      if (runway.state === 'notice_due' && runway.daysToNotice != null && noticeDate) {
        const tone: LedgerTone = runway.daysToNotice <= LIEN_RUNWAY_RED_DAYS ? 'red' : 'amber'
        rows.push({ key: 'notice', label: 'Send the notice', joiner: 'by', date: noticeDate, far: farWords(runway.daysToNotice, 'bare'), tone, bold: true, dot: 'filled', action: 'lien-desk', title: runway.title, sub: '' })
        points.push({ key: 'notice', ymd: runway.noticeByYmd, tone })
        verdict = { label: 'Send the notice', value: dWord(runway.daysToNotice), tone, action: 'lien-desk', title: runway.title }
        caption = leftWords(runway.daysToNotice, 'send the notice')
      } else if (notice?.done && noticeDate) {
        rows.push({ key: 'notice-sent', label: 'Notice sent', joiner: 'for', date: noticeDate, far: '', tone: 'done', bold: false, dot: 'filled', action: 'lien-desk', title: 'The § 53.056 notice for this work month is recorded', sub: '' })
        points.push({ key: 'notice-sent', ymd: runway.noticeByYmd, tone: 'done' })
      }
      if (runway.daysToLien != null && lienDate) {
        const urgent = runway.state === 'file_first' || (runway.state === 'no_pay' && runway.daysToLien <= LIEN_RUNWAY_AMBER_DAYS)
        const tone: LedgerTone = runway.state === 'file_first' || runway.daysToLien <= LIEN_RUNWAY_RED_DAYS ? 'red' : urgent ? 'amber' : runway.state === 'room' ? 'green' : 'plain'
        const bold = urgent && runway.state !== 'notice_due'
        lienRow = { key: 'lien', label: bold ? 'File the lien' : 'Lien', joiner: 'by', date: lienDate, far: farWords(runway.daysToLien, 'bare'), tone, bold, dot: bold ? 'filled' : 'ring', action: 'lien-desk', title: runway.title, sub: '' }
        rows.push(lienRow)
        points.push({ key: 'lien', ymd: runway.lienByYmd, tone })
        if (!caption) caption = leftWords(runway.daysToLien, 'file the lien')
        if (!verdict) {
          const lienDays = moneyYmd ? daysBetweenYmd(moneyYmd, runway.lienByYmd) : null
          if (runway.state === 'file_first' && lienDays != null) {
            verdict = { label: 'File the lien first', value: `${-lienDays} d short`, tone: 'red', action: 'lien-desk', title: runway.title }
          } else if (moneyTo != null && !moneyPast && lienDays != null && lienDays >= 0) {
            verdict = { label: 'Room after they pay', value: dWord(lienDays), tone: runway.daysToLien <= LIEN_RUNWAY_RED_DAYS ? 'amber' : 'green', action: 'lien-desk', title: runway.title }
          } else if (bold) {
            verdict = { label: 'File the lien', value: dWord(runway.daysToLien), tone, action: 'lien-desk', title: runway.title }
          } else if (moneyPast && moneyTo != null) {
            verdict = { label: 'Ask for a date', value: `${-moneyTo} d past`, tone: inCollections ? 'red' : 'amber', action: moneyAction, title: `${promised?.title ?? stat?.title ?? ''} — the date has gone by with the balance still open` }
          } else {
            verdict = { label: 'Ask for a date', value: `${dWord(runway.daysToLien)} left`, tone, action: moneyAction, title: 'Nobody has said when this will be paid' }
          }
        }
      }
    }
  }

  // The bar: from the bill date (or today) to the farthest deadline, one segment per stretch.
  let bar: LedgerBar | null = null
  const hasDeadline = points.some((p) => p.key === 'notice' || p.key === 'notice-sent' || p.key === 'lien' || p.key === 'closed')
  if (hasDeadline) {
    const origin = billedYmd ?? todayYmd
    const todayDays = Math.max(0, daysBetweenYmd(origin, todayYmd) ?? 0)
    const dated = points
      .map((p) => ({ ...p, days: daysBetweenYmd(origin, p.ymd) }))
      .filter((p): p is Point & { days: number } => p.days != null && p.days >= 0)
      .sort((a, b) => a.days - b.days)
    if (dated.length > 0 && dated[0]!.days > 0) dated.unshift({ key: 'start', ymd: origin, tone: 'done', days: 0 })
    const moneyDays = moneyYmd ? (daysBetweenYmd(origin, moneyYmd) ?? null) : null
    const lienDays = runway?.lienByYmd ? (daysBetweenYmd(origin, runway.lienByYmd) ?? null) : null
    // Room when the money is still ahead and lands before the lien; short when it lands after.
    const gapKind: 'room' | 'short' | null = moneyDays != null && lienDays != null && moneyTo != null && !moneyPast ? (moneyDays <= lienDays ? 'room' : 'short') : null
    const segments: LedgerSegment[] = []
    for (let i = 1; i < dated.length; i++) {
      const from = dated[i - 1]!
      const to = dated[i]!
      const days = to.days - from.days
      if (days <= 0) continue
      let kind: LedgerSegmentKind = 'wait'
      if (to.key === 'notice') kind = 'notice'
      else if (to.key === 'closed') kind = 'closed'
      else if (to.key === 'lien' && gapKind === 'room' && moneyDays != null && from.days >= moneyDays) kind = 'room'
      else if (to.key === 'money' && gapKind === 'short' && from.key === 'lien') kind = 'short'
      const usedFrac = clamp01((todayDays - from.days) / days)
      const live = from.days <= todayDays && todayDays < to.days
      let label = ''
      if (kind === 'room' && lienDays != null && moneyDays != null) label = `${lienDays - moneyDays} d of room`
      else if (kind === 'notice') label = 'notice'
      else if (kind === 'closed') label = `closed ${-(daysBetweenYmd(todayYmd, to.ymd) ?? 0)} d ago`
      else if (kind === 'wait' && to.key === 'lien' && runway?.daysToLien != null && runway.daysToLien >= 0) label = `${runway.daysToLien} d left`
      const tone: LedgerTone = kind === 'room' ? 'green' : kind === 'short' ? 'red' : kind === 'closed' ? 'done' : to.key === 'lien' || to.key === 'notice' ? to.tone : 'plain'
      segments.push({ key: `${from.key}-${to.key}`, days, usedFrac, live, kind, tone, label })
    }
    if (segments.length > 0) {
      bar = { segments, caption }
    }
  }

  const full = rows
    .map((r) => [r.label, r.joiner, r.date, r.far ? `· ${r.far}` : ''].filter(Boolean).join(' '))
    .concat(verdict ? [[verdict.label, verdict.value ? `· ${verdict.value}` : ''].filter(Boolean).join(' ')] : [])
    .join(' · ')
  return { rows, bar, verdict, full }
}
