/**
 * The dates block at the bottom of a Billed / Collections row's cell (v2.4168):
 * a numbered track over a ledger.
 *
 *   ①──────②▲────────⚑③──────────────⚑④
 *   ① Billed Sep 23 ............ 7 d ago
 *   ② Expected Oct 4 ........... 1 d past      ← the click for They said…
 *     keeps 0 of 5
 *   ③ Send the notice by Oct 15 ... 16 d       ← bold: the one thing to do
 *   ④ Lien by Nov 16 ............. 48 d
 *
 * The track is the bill's clock from the day we billed; each marker's number
 * heads its row, so the shape and the facts match without a label ever touching
 * another. Rows read oldest to newest; the right column is always "how far from
 * today"; the row that asks for something is the bold one, and when nothing is
 * asked the slot under the rows is the green room line. A promise replaces the
 * Expected row rather than joining it, so the block is the same height whatever
 * happens. Pure: the money comes from `billedExpectedPayModel`, the deadlines
 * from `buildLienPayRunway`; this only arranges them.
 */
import { billedExpectedPayModel, billedReferenceYmd, daysBetweenYmd, formatYmdMonthDay, type ExpectedPayRowInput, type PaySpeedData, type PromisedPayDate } from './billedExpectedPay'
import { LIEN_RUNWAY_AMBER_DAYS, LIEN_RUNWAY_RED_DAYS, type LienPayRunway } from './lienPayRunway'

export type LedgerTone = 'done' | 'plain' | 'green' | 'amber' | 'red'
export type LedgerAction = 'they-said' | 'new-date' | 'lien-desk'

export type LedgerRow = {
  key: 'billed' | 'money' | 'notice' | 'notice-sent' | 'lien' | 'filed' | 'closed'
  /** The marker's number on the track; 0 when the row has no marker (a closed window, a filed lien). */
  n: number
  /** "Billed" · "Expected" · "They said" · "Send the notice" · "Lien" · "File the lien" · "Lien filed" · "Lien gone". */
  label: string
  /** The words between the label and the date: '' · 'by'. */
  joiner: string
  /** "Sep 23"; '' when there is none. */
  date: string
  /** The right column: "7 d ago" · "1 d past" · "in 4 d" · "16 d" · "today"; '' when there is none. */
  far: string
  tone: LedgerTone
  /** The action row — bold, with the ›. */
  bold: boolean
  action: LedgerAction | null
  title: string
  /** A quiet line under the row: the estimate a promise displaced, or what closed the window. */
  sub: string
}

export type LedgerMarker = { n: number; pct: number; tone: LedgerTone; kind: 'dot' | 'flag' }

export type LedgerTrack = {
  markers: LedgerMarker[]
  /** Today, as percent along the track; the grey fill runs from the left edge to here. */
  todayPct: number
  /** The green run (room) or the red one (the lien dies first); null when there is neither. */
  gap: { fromPct: number; toPct: number; kind: 'room' | 'short' } | null
}

export type BilledDatesLedger = {
  rows: LedgerRow[]
  /** Null when there is nothing to draw (one row, or no dates at all). */
  track: LedgerTrack | null
  /** The green line under the rows when nothing is asked: "72 d of room after they pay". */
  roomLine: string | null
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

export function buildBilledDatesLedger({ todayYmd, row, data, promise, runway, inCollections }: BilledDatesLedgerInput): BilledDatesLedger {
  const rows: LedgerRow[] = []
  const points: Array<{ n: number; ymd: string; tone: LedgerTone; kind: 'dot' | 'flag' }> = []
  let n = 0
  const next = () => ++n

  // ① the bill
  const billedYmd = row ? billedReferenceYmd(row) : null
  if (billedYmd) {
    const ago = daysBetweenYmd(billedYmd, todayYmd) ?? 0
    const k = next()
    rows.push({ key: 'billed', n: k, label: 'Billed', joiner: '', date: formatYmdMonthDay(billedYmd), far: farWords(-ago, 'bare'), tone: 'done', bold: false, action: null, title: `The bill went out ${formatYmdMonthDay(billedYmd)} — the day every clock below starts from`, sub: '' })
    points.push({ n: k, ymd: billedYmd, tone: 'done', kind: 'dot' })
  }

  // ② the money — their word if they gave one, else the estimate from their pay history
  const stat = row ? billedExpectedPayModel(row, data, todayYmd, null) : null
  const promised = row && promise ? billedExpectedPayModel(row, data, todayYmd, promise) : null
  const moneyYmd = promised?.expectedYmd ?? stat?.expectedYmd ?? null
  if (moneyYmd) {
    const to = daysBetweenYmd(todayYmd, moneyYmd) ?? 0
    const past = to < 0
    const tone: LedgerTone = inCollections ? 'red' : past ? 'amber' : 'green'
    const k = next()
    const sub = promised && stat ? `expected ${formatYmdMonthDay(stat.expectedYmd)} by their history` : ''
    rows.push({
      key: 'money',
      n: k,
      label: promised ? 'They said' : 'Expected',
      joiner: '',
      date: formatYmdMonthDay(moneyYmd),
      far: past ? `${-to} d past` : farWords(to, 'in'),
      tone,
      bold: false,
      action: promise ? 'new-date' : 'they-said',
      title: promised?.title ?? stat?.title ?? '',
      sub,
    })
    points.push({ n: k, ymd: moneyYmd, tone, kind: 'dot' })
  }

  // ③ ④ the deadlines, from the runway's verdict
  let roomLine: string | null = null
  let gapKind: 'room' | 'short' | null = null
  if (runway && runway.state !== 'none') {
    const lienDate = runway.lienByYmd ? formatYmdMonthDay(runway.lienByYmd) : ''
    const noticeDate = runway.noticeByYmd ? formatYmdMonthDay(runway.noticeByYmd) : ''
    if (runway.state === 'filed') {
      rows.push({ key: 'filed', n: 0, label: 'Lien filed', joiner: '', date: runway.lines[0]?.replace(/^lien filed\s*/i, '') ?? '', far: '', tone: 'green', bold: false, action: 'lien-desk', title: runway.title, sub: '' })
    } else if (runway.state === 'closed') {
      rows.push({ key: 'closed', n: 0, label: 'Lien gone', joiner: '', date: '', far: '', tone: 'red', bold: true, action: 'lien-desk', title: runway.title, sub: runway.lines[1] ?? '' })
    } else {
      const notice = runway.marks?.notice
      if (runway.state === 'notice_due' && runway.daysToNotice != null && noticeDate) {
        const k = next()
        const tone: LedgerTone = runway.daysToNotice <= LIEN_RUNWAY_RED_DAYS ? 'red' : 'amber'
        rows.push({ key: 'notice', n: k, label: 'Send the notice', joiner: 'by', date: noticeDate, far: farWords(runway.daysToNotice, 'bare'), tone, bold: true, action: 'lien-desk', title: runway.title, sub: '' })
        points.push({ n: k, ymd: runway.noticeByYmd, tone, kind: 'flag' })
      } else if (notice?.done && noticeDate) {
        const k = next()
        rows.push({ key: 'notice-sent', n: k, label: 'Notice sent', joiner: 'for', date: noticeDate, far: '', tone: 'done', bold: false, action: 'lien-desk', title: 'The § 53.056 notice for this work month is recorded', sub: '' })
        points.push({ n: k, ymd: runway.noticeByYmd, tone: 'done', kind: 'flag' })
      }
      if (runway.daysToLien != null && lienDate) {
        const k = next()
        const urgent = runway.state === 'file_first' || (runway.state === 'no_pay' && runway.daysToLien <= LIEN_RUNWAY_AMBER_DAYS)
        const tone: LedgerTone = runway.state === 'file_first' || runway.daysToLien <= LIEN_RUNWAY_RED_DAYS ? 'red' : urgent ? 'amber' : runway.state === 'room' ? 'green' : 'plain'
        const bold = urgent && runway.state !== 'notice_due'
        rows.push({ key: 'lien', n: k, label: bold ? 'File the lien' : 'Lien', joiner: 'by', date: lienDate, far: farWords(runway.daysToLien, 'bare'), tone, bold, action: 'lien-desk', title: runway.title, sub: runway.state === 'file_first' ? 'the money is expected after the window closes — file first' : '' })
        points.push({ n: k, ymd: runway.lienByYmd, tone, kind: 'flag' })
      }
      if (runway.state === 'room' && runway.lines[1]) roomLine = `${runway.lines[1]} after they pay`
      gapKind = runway.marks?.gap?.kind ?? null
    }
  }

  // The track: from the bill date (or today) to a little past the farthest point.
  let track: LedgerTrack | null = null
  if (points.length >= 2) {
    const origin = billedYmd ?? todayYmd
    const spans = points.map((p) => daysBetweenYmd(origin, p.ymd) ?? 0)
    const farthest = Math.max(...spans, daysBetweenYmd(origin, todayYmd) ?? 0, 1)
    const total = Math.max(Math.ceil(farthest * 1.08), farthest + 2)
    const pct = (days: number) => Math.round((1000 * Math.max(0, Math.min(total, days))) / total) / 10
    const markers = points.map((p, i) => ({ n: p.n, pct: pct(spans[i]!), tone: p.tone, kind: p.kind }))
    const todayPct = pct(daysBetweenYmd(origin, todayYmd) ?? 0)
    let gap: LedgerTrack['gap'] = null
    if (gapKind) {
      const money = markers.find((m) => points[markers.indexOf(m)]!.kind === 'dot' && rows.find((r) => r.n === m.n)?.key === 'money')
      const lien = markers.find((m) => rows.find((r) => r.n === m.n)?.key === 'lien')
      if (money && lien) gap = gapKind === 'room' ? { fromPct: money.pct, toPct: lien.pct, kind: 'room' } : { fromPct: lien.pct, toPct: money.pct, kind: 'short' }
    }
    track = { markers, todayPct, gap }
  }

  const full = rows
    .map((r) => [r.label, r.joiner, r.date, r.far ? `· ${r.far}` : ''].filter(Boolean).join(' '))
    .concat(roomLine ? [roomLine] : [])
    .join(' · ')
  return { rows, track, roomLine, full }
}
