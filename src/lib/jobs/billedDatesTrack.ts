/**
 * The Billed row's dates as a track (v2.6139, punch list #217, jobs-pipeline-1): the ledger's
 * rows (`buildBilledDatesLedger`) laid on one axis against today, the way the Lien desk's
 * Deadlines board draws a job, at row height. The bill is a filled dot. The pay date is a dashed
 * ring marked *guessed* with the pace behind it as a tag (*guessed · ~30 d over 6 payments*) and
 * the pay-speeds breakdown as the tag's door, or a solid blue ring marked *their word* on a
 * promise. The one deadline is a flag at its day. The room between the pay date and the flag is a
 * green band labelled with the days, red when it runs short; with no pay date the band reads
 * *Ask for a date*. Today is a line. Pure: it arranges the ledger, which already decided every
 * word, tone and door; the Words view draws the same ledger as lines.
 */
import type { BilledDatesLedger, LedgerAction, LedgerRow, LedgerTone } from './billedDatesLedger'
import { daysBetweenYmd, formatYmdMonthDay } from './billedExpectedPay'

export type TrackGlyph = 'dot' | 'ring_dashed' | 'ring_solid' | 'flag' | 'check' | 'today'

export type BilledTrackMark = {
  /** The ledger row's key, or 'today'. */
  key: LedgerRow['key'] | 'today'
  pct: number
  ymd: string
  /** The bold words: "Billed" · "~Nov 8" · "Nov 20" · "today" · "Lien by Dec 15" · "File the lien by Nov 16" · "Lien filed". */
  label: string
  /** The quiet words under them: "Oct 9" · "guessed" · "their word" · "Oct 30" · "46d". */
  sub: string
  /** The bill and the pay date sit above the axis; today and the deadline below. */
  side: 'up' | 'down'
  /** A label near an edge hangs inward so it stays on the track. */
  align: 'left' | 'center' | 'right'
  glyph: TrackGlyph
  tone: LedgerTone
  bold: boolean
  action: LedgerAction | null
  title: string
}

export type BilledTrackBandKind = 'room' | 'short' | 'ask' | 'due' | 'gone'

export type BilledTrackBand = {
  fromPct: number
  toPct: number
  /** 'room' green between the pay date and the flag · 'short' red, the pay date past the flag · 'ask' dotted to the flag with no pay date · 'due' the flag is the to-do · 'gone' a red wash past the closed window. */
  kind: BilledTrackBandKind
  /** "37d of room" · "4d short" · "Ask for a date" · "12d to file" · "Lien gone". */
  label: string
  tone: LedgerTone
  action: LedgerAction | null
  title: string
}

export type BilledTrackTag = {
  kind: 'guess' | 'promise'
  /** "guessed · ~30 d over 6 payments" · "their word · Nov 20". */
  words: string
  title: string
  /** The guess opens the pay-speeds breakdown; a promise opens New date…. */
  action: 'pay-speeds' | 'new-date' | null
}

export type BilledDatesTrack = {
  startYmd: string
  endYmd: string
  marks: BilledTrackMark[]
  band: BilledTrackBand | null
  tag: BilledTrackTag | null
  /** The notice's state under the deadline (v2.5491), as a chip. */
  state: { words: string; tone: LedgerTone; title: string } | null
  /** The whole track in one sentence (the accessible name). */
  full: string
}

/** The axis keeps this much room at each end so a label on the first or last mark stays inside. */
const PAD_PCT = 7
/** A track shorter than this many days is drawn at this length, so one day is never the whole width. */
const MIN_SPAN_DAYS = 14
/** A mark past this percent hangs its label to the left; before `100 - EDGE_PCT`, to the right. */
const EDGE_PCT = 82

function alignFor(pct: number): BilledTrackMark['align'] {
  return pct >= EDGE_PCT ? 'right' : pct <= 100 - EDGE_PCT ? 'left' : 'center'
}

function guessWords(row: LedgerRow): string {
  const p = row.pace
  if (!p) return 'guessed'
  const d = `~${p.medianDays} d`
  if (p.source === 'customer') return `guessed · ${d} over ${p.samples} ${p.samples === 1 ? 'payment' : 'payments'}`
  if (p.source === 'gc') return `guessed · the GC pace ${d}${p.payers > 0 ? ` over ${p.payers} ${p.payers === 1 ? 'payer' : 'payers'}` : ''}`
  if (p.source === 'segment') return `guessed · ${p.paceWords.replace(/~(\d+)d/, '~$1 d')}`
  return `guessed · company avg ${d}`
}

export function buildBilledDatesTrack(ledger: BilledDatesLedger, todayYmd: string): BilledDatesTrack | null {
  const dated = ledger.rows.filter((r) => r.ymd !== '')
  if (dated.length === 0) return null
  const ymds = [...dated.map((r) => r.ymd), todayYmd].sort()
  const startYmd = ymds[0]!
  let endYmd = ymds[ymds.length - 1]!
  let span = daysBetweenYmd(startYmd, endYmd) ?? 0
  if (span < MIN_SPAN_DAYS) {
    span = MIN_SPAN_DAYS
    const d = new Date(`${startYmd}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + MIN_SPAN_DAYS)
    endYmd = d.toISOString().slice(0, 10)
  }
  const pct = (ymd: string) => {
    const d = daysBetweenYmd(startYmd, ymd) ?? 0
    return Math.round(10 * (PAD_PCT + ((100 - 2 * PAD_PCT) * Math.max(0, Math.min(span, d))) / span)) / 10
  }

  const marks: BilledTrackMark[] = []
  let money: LedgerRow | null = null
  let deadline: LedgerRow | null = null
  for (const r of dated) {
    const p = pct(r.ymd)
    if (r.key === 'billed') {
      marks.push({ key: r.key, pct: p, ymd: r.ymd, label: 'Billed', sub: r.date, side: 'up', align: alignFor(p), glyph: 'dot', tone: r.tone, bold: false, action: null, title: r.title })
    } else if (r.key === 'money') {
      money = r
      const promise = r.label === 'They said'
      marks.push({ key: r.key, pct: p, ymd: r.ymd, label: promise ? r.date : `~${r.date}`, sub: promise ? 'their word' : 'guessed', side: 'up', align: alignFor(p), glyph: promise ? 'ring_solid' : 'ring_dashed', tone: promise ? 'blue' : r.tone, bold: false, action: r.action, title: r.title })
    } else if (r.key === 'filed') {
      marks.push({ key: r.key, pct: p, ymd: r.ymd, label: 'Lien filed', sub: r.date, side: 'down', align: alignFor(p), glyph: 'check', tone: 'green', bold: false, action: r.action, title: r.title })
    } else if (r.key === 'closed') {
      deadline = r
      marks.push({ key: r.key, pct: p, ymd: r.ymd, label: r.label, sub: r.date, side: 'down', align: alignFor(p), glyph: 'flag', tone: 'red', bold: false, action: r.action, title: r.title })
    } else {
      deadline = r
      marks.push({ key: r.key, pct: p, ymd: r.ymd, label: `${r.label} by ${r.date}`, sub: r.far, side: 'down', align: alignFor(p), glyph: 'flag', tone: r.tone, bold: r.bold, action: r.action, title: r.title })
    }
  }
  const todayPct = pct(todayYmd)
  marks.push({ key: 'today', pct: todayPct, ymd: todayYmd, label: 'today', sub: formatYmdMonthDay(todayYmd), side: 'down', align: alignFor(todayPct), glyph: 'today', tone: 'blue', bold: false, action: null, title: `Today, ${formatYmdMonthDay(todayYmd)}` })
  marks.sort((a, b) => a.pct - b.pct)

  // The band: the verdict already chose the words; the band is where they sit on the axis.
  let band: BilledTrackBand | null = null
  const v = ledger.verdict
  if (deadline) {
    const dp = pct(deadline.ymd)
    const mp = money ? pct(money.ymd) : null
    if (deadline.key === 'closed') {
      band = { fromPct: dp, toPct: 100, kind: 'gone', label: v?.label ?? 'Lien gone', tone: 'red', action: v?.action ?? deadline.action, title: v?.title ?? deadline.title }
    } else if (v && /short$/.test(v.value) && mp != null) {
      band = { fromPct: Math.min(dp, mp), toPct: Math.max(dp, mp), kind: 'short', label: v.value, tone: 'red', action: v.action, title: v.title }
    } else if (v && v.label === 'Can run late' && mp != null) {
      band = { fromPct: Math.min(mp, dp), toPct: Math.max(mp, dp), kind: 'room', label: `${v.value} of room`, tone: v.tone, action: v.action, title: v.title }
    } else if (v && v.label === 'Ask for a date') {
      band = { fromPct: Math.min(todayPct, dp), toPct: Math.max(todayPct, dp), kind: 'ask', label: v.value ? `${v.label} · ${v.value}` : v.label, tone: v.tone, action: v.action, title: v.title }
    } else if (!v && deadline.bold) {
      const days = daysBetweenYmd(todayYmd, deadline.ymd) ?? 0
      const verb = deadline.key === 'notice' ? 'send the notice' : 'file'
      band = { fromPct: Math.min(todayPct, dp), toPct: Math.max(todayPct, dp), kind: 'due', label: days < 0 ? `${-days}d past` : days === 0 ? `${verb} today` : `${days}d to ${verb}`, tone: deadline.tone, action: deadline.action, title: deadline.title }
    }
  }

  let tag: BilledTrackTag | null = null
  if (money) {
    tag = money.label === 'They said'
      ? { kind: 'promise', words: `their word · ${money.date}${money.sub ? ` · ${money.sub}` : ''}`, title: money.title, action: money.action === 'new-date' ? 'new-date' : null }
      : { kind: 'guess', words: guessWords(money), title: money.title, action: 'pay-speeds' }
  }
  const state = deadline && deadline.sub && deadline.subTone ? { words: deadline.sub, tone: deadline.subTone, title: deadline.subTitle ?? deadline.sub } : null

  const full = marks
    .map((m) => `${m.label}${m.sub ? ` · ${m.sub}` : ''}`)
    .concat(tag ? [tag.words] : [], band ? [band.label] : [], state ? [state.words] : [])
    .join(' · ')
  return { startYmd, endYmd, marks, band, tag, state, full }
}
