/**
 * The Pipeline row's money bar (v2.4351, progress bar pass 4 — owner-approved 2026-10-01,
 * canvas https://claude.ai/artifact/UfRpXq1vGyXioaeMyky9Wz, boards 9–11).
 *
 * The bar it replaces drew WORK as a blue fill and MONEY as a 3 px line under it, while
 * the legend under the bar (and the Bill tab's money card, v2.4307) used blue for billed.
 * Read on 134 live rows (2026-10-01): 36 bars were solid blue with the billed line blue on
 * blue, 40 were an empty track, and the money waiting to be billed was a hairline. Now one
 * meaning for each color, as on the Bill tab:
 *
 *   - each block is a line item (or a stage), sized by its price, and its MONEY fills it
 *     from the left: green paid · blue billed · amber done but not billed · grey not yet;
 *   - a dark TICK marks the job's % done — hollow when that % is older than the last day
 *     the crew worked (the old bar hid it, so the box said 40 and the bar said nothing);
 *   - on a stage job the stage names sit under their own blocks (the chip row above the
 *     bar wrapped onto two lines even at desktop width), the crew's stage in bold;
 *   - the % date goes beside the box: *30 % done · Aug 7*.
 *
 * Built over `buildProgressPaymentView` (the segments, their widths and shares, the money
 * poured over them, the percent and whether it is stale). Pure; the component measures.
 */
import type { ProgressPaymentSegment, ProgressPaymentView } from './progressPaymentCell'
import { formatUsdNoCents } from './jobFormatting'
import { formatWorkDateYmdMonthDayShort } from '../../utils/dateUtils'

export type MoneyBarTone = 'paid' | 'billed' | 'unbilled'

export type MoneyBarSlice = { tone: MoneyBarTone; pct: number }

export type MoneyBarBlock = {
  key: string
  /** Share of the bar's width, 0–100 (the view's floored widths). */
  widthPct: number
  /** Left to right inside the block, each 0–100 of the block; the rest is grey. */
  slices: MoneyBarSlice[]
  /** The hover: name, price and where its money stands. */
  title: string
}

export type MoneyBarTick = {
  /** 0–100 across the drawn bar. */
  leftPct: number
  /** The % is older than the last day worked. */
  hollow: boolean
  pct: number
}

export type MoneyBarName = {
  key: string
  widthPct: number
  /** "1" — what is left when the name does not fit. */
  number: string
  /** "Rough" — the stage's short name. */
  name: string
  done: boolean
  /** The crew's stage. */
  bold: boolean
}

export type MoneyBarDate = {
  /** "Aug 7" beside a typed %, "30% on a report, Aug 7" when the box is empty. */
  text: string
  /** Older than the last day worked: amber. */
  stale: boolean
  title: string
}

export type JobMoneyBar = {
  blocks: MoneyBarBlock[]
  tick: MoneyBarTick | null
  /** Stage jobs only. */
  names: MoneyBarName[] | null
  date: MoneyBarDate | null
}

const EPS = 0.0005

/** "paid" · "billed" · "$520 done, not billed" · "$4,879 paid · $2,000 billed" · "nothing billed". */
export function blockMoneyWords(seg: Pick<ProgressPaymentSegment, 'amount' | 'money'>): string {
  const { paidFrac, billedFrac, unbilledFrac } = seg.money
  if (paidFrac >= 1 - EPS) return 'paid'
  if (billedFrac >= 1 - EPS) return 'billed'
  if (paidFrac + billedFrac >= 1 - EPS && paidFrac > EPS) return `${formatUsdNoCents(paidFrac * seg.amount)} paid · ${formatUsdNoCents(billedFrac * seg.amount)} billed`
  const parts: string[] = []
  if (paidFrac > EPS) parts.push(`${formatUsdNoCents(paidFrac * seg.amount)} paid`)
  if (billedFrac > EPS) parts.push(`${formatUsdNoCents(billedFrac * seg.amount)} billed`)
  if (unbilledFrac > EPS) parts.push(`${formatUsdNoCents(unbilledFrac * seg.amount)} done, not billed`)
  return parts.length ? parts.join(' · ') : 'nothing billed'
}

/**
 * Where a job-level % lands on the drawn bar. Blocks are drawn with a minimum width, so a
 * small line is wider than its money share; the % walks the money shares and lands at the
 * same fraction of the block it falls in.
 */
export function tickLeftPct(segments: ReadonlyArray<Pick<ProgressPaymentSegment, 'widthPct' | 'sharePct'>>, pct: number): number {
  if (segments.length === 0) return 0
  const p = Math.max(0, Math.min(100, pct))
  if (p >= 100) return 100
  let share = 0
  let width = 0
  for (const s of segments) {
    if (s.sharePct > 0 && share + s.sharePct >= p - EPS) return width + ((p - share) / s.sharePct) * s.widthPct
    share += s.sharePct
    width += s.widthPct
  }
  return Math.min(100, width)
}

export function buildJobMoneyBar(view: ProgressPaymentView, opts: { pctComplete: number | null }): JobMoneyBar {
  if (view.mode === 'nobid' || view.segments.length === 0) {
    return { blocks: [], tick: null, names: null, date: dateOf(view, opts.pctComplete) }
  }
  const blocks: MoneyBarBlock[] = view.segments.map((s) => {
    const slices: MoneyBarSlice[] = []
    if (s.money.paidFrac > EPS) slices.push({ tone: 'paid', pct: s.money.paidFrac * 100 })
    if (s.money.billedFrac > EPS) slices.push({ tone: 'billed', pct: s.money.billedFrac * 100 })
    if (s.money.unbilledFrac > EPS) slices.push({ tone: 'unbilled', pct: s.money.unbilledFrac * 100 })
    return {
      key: s.key,
      widthPct: s.widthPct,
      slices,
      title: `${s.number != null ? `${s.number}. ` : ''}${s.name} · ${formatUsdNoCents(s.amount)} · ${blockMoneyWords(s)}`,
    }
  })
  const pct = view.percent?.pct ?? null
  const tick: MoneyBarTick | null = pct == null ? null : { leftPct: tickLeftPct(view.segments, pct), hollow: view.stale, pct }
  const stageSegs = view.mode === 'stages' && view.stageBar ? view.stageBar.segments : null
  const names: MoneyBarName[] | null = stageSegs
    ? view.segments.map((s, i) => ({
        key: s.key,
        widthPct: s.widthPct,
        number: String(s.number ?? i + 1),
        name: stageSegs[i]?.short || s.name,
        done: s.state === 'done',
        // The crew's stage — none once the job reads 100% (v2.4353: a billed Final read as where the crew is).
        bold: s.state === 'live' && !(pct != null && pct >= 100),
      }))
    : null
  return { blocks, tick, names, date: dateOf(view, opts.pctComplete) }
}

function dateOf(view: ProgressPaymentView, pctComplete: number | null): MoneyBarDate | null {
  const p = view.percent
  if (!p || !p.at) return null
  // A finished job's date says nothing the bill dates don't, unless the crew has worked since (v2.4353).
  if (p.pct >= 100 && !view.stale) return null
  const day = formatWorkDateYmdMonthDayShort(p.at.slice(0, 10))
  const source = p.source === 'report' ? 'reported' : p.source === 'seed' ? 'set' : 'typed'
  const staleWords = view.stale ? ' The crew has worked since, so the % may be behind.' : ''
  if (pctComplete == null) {
    return { text: `${p.pct}% on a report, ${day}`, stale: view.stale, title: `${p.pct}% reported ${day}.${staleWords}` }
  }
  return { text: day, stale: view.stale, title: `${p.pct}% ${source} ${day}.${staleWords}` }
}

export const MONEY_BAR_TONE: Record<MoneyBarTone, string> = {
  paid: '#16a34a',
  billed: '#2563eb',
  unbilled: '#f59e0b',
}

/** The grey of a block's part with no money on it — the legend's Not done swatch too. */
export const MONEY_BAR_TRACK = 'var(--bg-200)'

/** ~10.5px system font: an average glyph is a little under 6px. */
const namePx = (text: string) => Math.ceil(text.length * 5.9) + 4

/** "2 Top Out" when it fits its block, else "2"; a done stage keeps its check. */
export function stageNameLabel(n: MoneyBarName, blockPx: number | null): string {
  const full = `${n.number} ${n.name}${n.done ? ' ✓' : ''}`
  if (blockPx == null || namePx(full) <= blockPx) return full
  const short = `${n.number}${n.done ? ' ✓' : ''}`
  return short
}

/**
 * Which part of the bar a bill row's own bill is (v2.4353, pass 4) — only on a job with two
 * or more bills out or paid, where every bill row draws the same bar. A stage job whose
 * bill names one stage bolds that stage's name; any other job gets a bracket under the
 * bar from where the bill starts to where it ends. A bill that names line items spans
 * those blocks; a bill made by amount sits where the bills before it, in billing order,
 * leave off — the order the money is poured in.
 */
export type MoneyBarBillMark =
  | { kind: 'bracket'; leftPct: number; widthPct: number; title: string }
  | { kind: 'stage'; key: string; title: string }

export type MoneyBarBillInput = {
  billId: string
  fixtures: ReadonlyArray<{ id: string; invoice_id?: string | null }>
  invoices: ReadonlyArray<{ id: string; status: string; amount?: number | string | null; sequence_order?: number | null; billed_at?: string | null }>
}

export function billMarkFor(view: ProgressPaymentView, input: MoneyBarBillInput): MoneyBarBillMark | null {
  if (view.mode === 'nobid' || view.segments.length === 0) return null
  const bills = input.invoices.filter((i) => i.status === 'billed' || i.status === 'paid')
  if (bills.length < 2) return null
  const bill = bills.find((b) => b.id === input.billId)
  if (!bill) return null
  const amount = Math.max(0, Number(bill.amount ?? 0) || 0)
  const title = `This row's bill: ${formatUsdNoCents(amount)}`
  const named = new Set(input.fixtures.filter((f) => f.invoice_id === input.billId).map((f) => f.id))
  const namedIdx = view.segments.map((s, i) => (named.has(s.key) ? i : -1)).filter((i) => i >= 0)
  if (view.mode === 'stages' && namedIdx.length === 1) return { kind: 'stage', key: view.segments[namedIdx[0]!]!.key, title }
  let left: number
  let right: number
  if (namedIdx.length > 0) {
    const first = namedIdx[0]!
    const last = namedIdx[namedIdx.length - 1]!
    left = view.segments.slice(0, first).reduce((s, x) => s + x.widthPct, 0)
    right = view.segments.slice(0, last + 1).reduce((s, x) => s + x.widthPct, 0)
  } else {
    const total = view.segments.reduce((s, x) => s + Math.max(0, x.amount), 0)
    if (total <= 0) return null
    const ordered = [...bills].sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0) || String(a.billed_at ?? '').localeCompare(String(b.billed_at ?? '')))
    let before = 0
    for (const b of ordered) {
      if (b.id === input.billId) break
      before += Math.max(0, Number(b.amount ?? 0) || 0)
    }
    left = tickLeftPct(view.segments, (before / total) * 100)
    right = tickLeftPct(view.segments, Math.min(100, ((before + amount) / total) * 100))
  }
  if (!(right > left)) return null
  return { kind: 'bracket', leftPct: left, widthPct: Math.max(1.5, right - left), title }
}
