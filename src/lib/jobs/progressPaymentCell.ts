/**
 * The Progress & payment cell (Where the Job Is, PR 4 — owner-approved 2026-09-14).
 *
 * One view model for every Pipeline row, whatever it knows:
 *
 *   mode `stages`  — the job has stages (Order rows, or recognized from the
 *                    line names, v2.3417): chips, then one bar whose segments
 *                    are the stages. The LIVE stage is where the crew is —
 *                    a stage report, else the money as a floor (what the
 *                    payments cover in order is done) with the crew on the
 *                    first stage after it — not the first unpaid draw.
 *   mode `lines`   — no stages: the priced line items in order (one line =
 *                    one segment), fill = the job's percent poured down them.
 *   mode `nobid`   — nothing priced: no bar; the words say what is missing.
 *
 * Every segment's top channel is WORK (fill = percent) and its 3 px bottom
 * channel is MONEY — paid, billed, done-not-billed — poured left to right:
 * a line an invoice names takes that invoice's money first, the rest pours
 * in order. A percent older than the last clock-in is not drawn; the live
 * segment says "on site Fri" instead and the words carry the date.
 *
 * Under the bar, one sentence: the live stage, who was on site and when, the
 * percent and its source, the money. Pure; the component measures.
 */
import type { StagesMoneyBarModel } from '../stagesMoneyBar'
import type { PipelineStageBar } from './pipelineStageBar'
import { crewShortName, newestPercent, percentIsStale, type JobCrewPosition, type PercentSource } from './jobCrewPosition'
import { formatUsdNoCents } from './jobFormatting'
import { formatWorkDateYmdMonthDayShort, formatWorkDateYmdWeekdayShortFriendly } from '../../utils/dateUtils'

export type ProgressPaymentMode = 'stages' | 'lines' | 'nobid'
export type ProgressPaymentTone = 'plain' | 'amber' | 'green' | 'red' | 'muted'

export type MoneyChannel = {
  /** Fractions of the segment's own amount, each 0–1, summing to ≤ 1. */
  paidFrac: number
  billedFrac: number
  unbilledFrac: number
}

export type ProgressPaymentSegment = {
  key: string
  name: string
  /** Stage number for chips (stages mode); null for lines. */
  number: number | null
  state: 'done' | 'live' | 'later'
  /** Share of the bar, 0–100 (after the minimum-width floor); sums to 100. */
  widthPct: number
  /** 0–100 — the work channel. */
  fillPct: number
  /** The label the segment may carry when wide enough (the component decides). */
  label: string | null
  /** The label reads on the fill (white) when the fill is wide enough; else on the track. */
  money: MoneyChannel
  /** Tooltip. */
  title: string
  amount: number
}

export type ProgressPaymentView = {
  mode: ProgressPaymentMode
  /** Stages mode only — the chips' source (`fitStageChips`), with `liveNumber` re-pointed to the evidence's live stage. */
  stageBar: PipelineStageBar | null
  /** Stages mode: the word after the live chip's name — "Behar", "today"; null = none. */
  liveChipSuffix: string | null
  segments: ProgressPaymentSegment[]
  /**
   * `text` is what the row PRINTS: the stage, the crew and the percent. It
   * deliberately leaves the money out — the legend under the bar already
   * prints Paid / Billed / Done, not billed / Not done, and repeating it made
   * the sentence outrun a 176 px column (v2.3447; 40 of 92 live rows clipped).
   * `full` adds the money clause for the tooltip and the bar's accessible
   * name, where there is room and no legend beside it. The money still sets
   * the `tone`.
   */
  words: { text: string; full: string; tone: ProgressPaymentTone }
  /** The percent on record predates the last clock-in: not drawn as a fill. */
  stale: boolean
  /** The percent the row shows, with its source and date, or null. */
  percent: { pct: number; source: PercentSource; at: string | null } | null
  /**
   * v2.3421 (the door): a job with two or more priced lines the dictionary did
   * not read as stages — offer *Set stages*, which opens Bill → ① Line Items.
   */
  offerSetStages: boolean
}

export type ProgressPaymentFixture = {
  id: string
  name: string | null
  count: number | null
  line_unit_price: number | null
  sequence_order: number | null
  invoice_id: string | null
}

export type ProgressPaymentInput = {
  money: StagesMoneyBarModel
  stageBar: PipelineStageBar | null
  fixtures: ReadonlyArray<ProgressPaymentFixture>
  invoices: ReadonlyArray<{ id: string; status: string }>
  crew: JobCrewPosition | null | undefined
  /** jobs_ledger.pct_complete. */
  pctComplete: number | null | undefined
  /** jobs_ledger.status — `paid` reads the words green. */
  status?: string | null
  todayYmd: string
}

const MIN_WIDTH_PCT = 10
const clampPct = (n: number) => Math.max(0, Math.min(100, n))
const round2 = (n: number) => Math.round(n * 100) / 100

// ── dates ──────────────────────────────────────────────────────────────────

const ymdMs = (ymd: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : NaN
}

/** "today" · "Fri" (within the last six days) · "Sep 12". */
export function dayWord(ymd: string, todayYmd: string): string {
  if (ymd === todayYmd) return 'today'
  const diff = Math.round((ymdMs(todayYmd) - ymdMs(ymd)) / 86_400_000)
  if (Number.isFinite(diff) && diff > 0 && diff <= 6) return formatWorkDateYmdWeekdayShortFriendly(ymd).split(',')[0] ?? formatWorkDateYmdMonthDayShort(ymd)
  return formatWorkDateYmdMonthDayShort(ymd)
}

// ── the sentence ───────────────────────────────────────────────────────────

/** "Behar & Malachi on site today" · "Behar's crew on site Fri" · "Texas Rooter on the sheet, no clock-ins" · "nobody clocked in". */
export function crewClause(crew: JobCrewPosition | null | undefined, todayYmd: string): string {
  if (!crew) return 'nobody clocked in'
  const name = crewShortName(crew)
  if (crew.lastWorkYmd) {
    const n = crew.lastDayPeople.length
    const who = n <= 2 && name ? name : n > 0 ? `${n} people` : name || 'crew'
    if (crew.onSiteToday) return n <= 2 && name ? `${name} on site today` : `${n} on site today`
    return `${who} on site ${dayWord(crew.lastWorkYmd, todayYmd)}`
  }
  if (crew.sheet && name) return `${name} on the sheet, no clock-ins`
  return 'nobody clocked in'
}

const PERCENT_SOURCE_WORD: Record<PercentSource, string> = { typed: 'typed', report: 'reported', seed: 'set' }

/** "80% typed Sep 3" · "12% reported Sep 11" · "40% set Aug 7" (the back-fill) · "40% typed" · "no % yet". */
export function percentClause(p: ProgressPaymentView['percent']): string {
  if (!p) return 'no % yet'
  const when = p.at ? ` ${formatWorkDateYmdMonthDayShort(p.at.slice(0, 10))}` : ''
  return `${p.pct}% ${PERCENT_SOURCE_WORD[p.source]}${when}`
}

/** "$24,359 paid, nothing billed" · "$32,108 billed, nothing paid" · "$13,412 paid · $11,770 billed · $6,818 done, not billed" · "paid in full". */
export function moneyClause(money: StagesMoneyBarModel): { text: string; tone: ProgressPaymentTone } {
  if (!money.hasBar) return { text: 'nothing to bill against', tone: 'muted' }
  if (money.paid >= money.total - 0.005) return { text: 'paid in full', tone: 'green' }
  const paid = money.paid > 0 ? `${formatUsdNoCents(money.paid)} paid` : ''
  const billed = money.billedUnpaid > 0 ? `${formatUsdNoCents(money.billedUnpaid)} billed` : ''
  let text: string
  let tone: ProgressPaymentTone = 'plain'
  if (paid && billed) text = `${paid} · ${billed}`
  else if (paid) text = `${paid}, nothing billed`
  else if (billed) {
    text = `${billed}, nothing paid`
    tone = 'amber'
  } else text = 'nothing billed'
  if (money.doneNotBilled != null && money.doneNotBilled > 0) {
    text += ` · ${formatUsdNoCents(money.doneNotBilled)} done, not billed`
    tone = 'amber'
  }
  return { text, tone }
}

// ── money poured over segments ─────────────────────────────────────────────

type Pool = { paid: number; billed: number; unbilled: number }

function pourMoney(
  amounts: ReadonlyArray<{ key: string; amount: number; invoiceStatus: string | null }>,
  money: StagesMoneyBarModel,
): Map<string, MoneyChannel> {
  const pool: Pool = { paid: Math.max(0, money.paid), billed: Math.max(0, money.billedUnpaid), unbilled: Math.max(0, money.doneNotBilled ?? 0) }
  const alloc = new Map<string, Pool>()
  for (const a of amounts) alloc.set(a.key, { paid: 0, billed: 0, unbilled: 0 })
  // 1. A line an invoice names takes that invoice's money first.
  for (const a of amounts) {
    if (a.amount <= 0 || !a.invoiceStatus) continue
    const slot = alloc.get(a.key)!
    if (a.invoiceStatus === 'paid') {
      const take = Math.min(a.amount, pool.paid)
      slot.paid = take
      pool.paid -= take
    } else if (a.invoiceStatus === 'billed') {
      const take = Math.min(a.amount, pool.billed)
      slot.billed = take
      pool.billed -= take
    }
  }
  // 2. The rest pours in order: paid, then billed, then done-not-billed.
  for (const kind of ['paid', 'billed', 'unbilled'] as const) {
    for (const a of amounts) {
      if (pool[kind] <= 0) break
      const slot = alloc.get(a.key)!
      const room = a.amount - slot.paid - slot.billed - slot.unbilled
      if (room <= 0) continue
      const take = Math.min(room, pool[kind])
      slot[kind] += take
      pool[kind] -= take
    }
  }
  const out = new Map<string, MoneyChannel>()
  for (const a of amounts) {
    const s = alloc.get(a.key)!
    out.set(a.key, a.amount > 0 ? { paidFrac: s.paid / a.amount, billedFrac: s.billed / a.amount, unbilledFrac: s.unbilled / a.amount } : { paidFrac: 0, billedFrac: 0, unbilledFrac: 0 })
  }
  return out
}

/** Widths after the minimum floor, summing to 100. */
function widthsOf(amounts: ReadonlyArray<number>): number[] {
  const total = amounts.reduce((s, a) => s + Math.max(0, a), 0)
  const shares = amounts.map((a) => (total > 0 ? (Math.max(0, a) / total) * 100 : 100 / Math.max(1, amounts.length)))
  const floored = shares.map((s) => Math.max(MIN_WIDTH_PCT, s))
  const sum = floored.reduce((a, b) => a + b, 0)
  return floored.map((w) => (w / sum) * 100)
}

// ── the view ───────────────────────────────────────────────────────────────

export function buildProgressPaymentView(input: ProgressPaymentInput): ProgressPaymentView {
  const { money, stageBar, crew, todayYmd } = input
  const percent = newestPercent(crew, input.pctComplete)
  const stale = percentIsStale(crew, input.pctComplete)
  const invoiceStatus = new Map(input.invoices.map((i) => [i.id, i.status]))
  const statusOf = (invoiceId: string | null) => (invoiceId ? invoiceStatus.get(invoiceId) ?? null : null)

  if (!money.hasBar) {
    const cc = crew && (crew.lastWorkYmd || crew.sheet) ? crewClause(crew, todayYmd) : null
    const onSiteNow = !!crew?.onSiteToday
    const text = onSiteNow ? `${cc} · no lines on the job · nothing to bill against` : cc ? `no lines on the job · ${cc}` : 'no lines on the job · nothing to bill against'
    // No bar and no money in the legend to repeat: the whole sentence prints.
    return { mode: 'nobid', stageBar: null, liveChipSuffix: null, segments: [], words: { text, full: text, tone: onSiteNow ? 'red' : 'muted' }, stale, percent, offerSetStages: false }
  }

  const paidInFull = input.status === 'paid' || money.paid >= money.total - 0.005
  const mc = moneyClause(money)

  if (stageBar && stageBar.segments.length > 0) {
    const segs = stageBar.segments
    const fixtureById = new Map(input.fixtures.map((f) => [f.id, f]))
    // Money as a floor: what the payments cover in order (a paid invoice on a
    // stage covers that stage outright) is done.
    const covered = segs.map((s) => {
      const st = statusOf(fixtureById.get(s.fixtureId)?.invoice_id ?? null)
      return st === 'paid' || s.state === 'done'
    })
    let pool = Math.max(0, money.paid)
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i]!
      if (covered[i]) {
        pool = Math.max(0, pool - s.amount)
        continue
      }
      if (s.amount > 0 && pool >= s.amount - 0.005) {
        covered[i] = true
        pool -= s.amount
      } else break
    }
    const floor = covered.findIndex((c) => !c)
    const hasStageReport = segs.some((s) => s.state !== 'done' && s.workSource === 'stage')
    const planLiveIdx = stageBar.liveNumber != null ? stageBar.liveNumber - 1 : segs.length
    // The crew's stage: a stage report says so; else the first stage after the money floor.
    const liveIdx = floor === -1 ? -1 : hasStageReport ? Math.max(planLiveIdx, floor) : floor
    const shares = segs.map((s) => s.sharePct)
    const doneShare = segs.reduce((acc, _s, i) => (liveIdx !== -1 && i < liveIdx ? acc + shares[i]! : liveIdx === -1 ? acc + shares[i]! : acc), 0)
    const pour = pourMoney(
      segs.map((s) => ({ key: s.fixtureId, amount: s.amount, invoiceStatus: statusOf(fixtureById.get(s.fixtureId)?.invoice_id ?? null) })),
      money,
    )
    const crewName = crewShortName(crew)
    const liveSuffix = crew?.onSiteToday ? 'today' : crewName || null
    const segments: ProgressPaymentSegment[] = segs.map((s, i) => {
      const state: ProgressPaymentSegment['state'] = liveIdx === -1 || i < liveIdx ? 'done' : i === liveIdx ? 'live' : 'later'
      let fill = 0
      let label: string | null = null
      if (state === 'done') {
        fill = 100
        label = '✓'
      } else if (state === 'live') {
        if (s.workSource === 'stage' && s.workPct > 0) fill = s.workPct
        else if (percent && !stale && shares[i]! > 0) fill = clampPct(((percent.pct - doneShare) / shares[i]!) * 100)
        fill = Math.round(fill)
        if (fill > 0) label = `${fill}%`
        else if (crew?.lastWorkYmd) label = crew.onSiteToday ? `${crew.lastDayPeople.length || ''} on site today`.trim() : `on site ${dayWord(crew.lastWorkYmd, todayYmd)}`
      }
      const m = pour.get(s.fixtureId) ?? { paidFrac: 0, billedFrac: 0, unbilledFrac: 0 }
      const moneyWord = m.paidFrac >= 0.995 ? 'paid' : m.billedFrac > 0 ? 'billed' : m.paidFrac > 0 ? `${Math.round(m.paidFrac * 100)}% paid` : 'nothing billed'
      return {
        key: s.fixtureId,
        name: s.name,
        number: s.number,
        state,
        widthPct: s.widthPct,
        fillPct: fill,
        label,
        money: m,
        title: `${s.number}. ${s.name} · ${state === 'done' ? 'done' : state === 'live' ? `the crew is here${fill > 0 ? ` · ${fill}%` : ''}` : 'later'} · ${formatUsdNoCents(s.amount)} · ${moneyWord}`,
        amount: s.amount,
      }
    })
    const live = liveIdx === -1 ? null : segs[liveIdx]!
    const head = live ? live.name : `All ${segs.length} stages done`
    const text = live ? `${head} · ${crewClause(crew, todayYmd)} · ${percentClause(percent)}` : head
    const full = `${text} · ${mc.text}`
    const tone: ProgressPaymentTone = paidInFull ? 'green' : mc.tone === 'amber' || stageBar.captionTone === 'amber' ? 'amber' : 'plain'
    const view: ProgressPaymentView = {
      mode: 'stages',
      stageBar: { ...stageBar, liveNumber: live ? live.number : null, segments: segs.map((s, i) => ({ ...s, state: segments[i]!.state, workPct: segments[i]!.fillPct })) },
      liveChipSuffix: live ? liveSuffix : null,
      segments,
      words: { text, full, tone },
      stale,
      percent,
      offerSetStages: false,
    }
    return view
  }

  // Lines: the priced line items in order; a single line is one segment.
  const priced = [...input.fixtures]
    .filter((f) => (Number(f.count) || 0) * (Number(f.line_unit_price) || 0) > 0)
    .sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))
  const lines = priced.length > 0 ? priced.map((f) => ({ key: f.id, name: (f.name ?? '').trim() || 'Line item', amount: round2((Number(f.count) || 0) * (Number(f.line_unit_price) || 0)), invoiceStatus: statusOf(f.invoice_id) })) : [{ key: 'job', name: 'Job', amount: money.total, invoiceStatus: null }]
  const widths = widthsOf(lines.map((l) => l.amount))
  const shares = (() => {
    const t = lines.reduce((s, l) => s + Math.max(0, l.amount), 0)
    return lines.map((l) => (t > 0 ? (Math.max(0, l.amount) / t) * 100 : 100 / lines.length))
  })()
  const pour = pourMoney(lines, money)
  const pct = percent && !stale ? percent.pct : null
  let poured = 0
  const segments: ProgressPaymentSegment[] = lines.map((l, i) => {
    let fill = 0
    if (pct != null && shares[i]! > 0) {
      fill = Math.round(clampPct(((pct - poured) / shares[i]!) * 100))
      poured += shares[i]!
    }
    const state: ProgressPaymentSegment['state'] = fill >= 100 ? 'done' : fill > 0 || i === 0 ? 'live' : 'later'
    const m = pour.get(l.key) ?? { paidFrac: 0, billedFrac: 0, unbilledFrac: 0 }
    const label = lines.length === 1 ? (fill > 0 ? `${l.name} · ${fill}%` : l.name) : fill >= 100 ? `${l.name} ✓` : fill > 0 ? `${l.name} ${fill}%` : l.name
    return {
      key: l.key,
      name: l.name,
      number: null,
      state,
      widthPct: widths[i]!,
      fillPct: fill,
      label,
      money: m,
      title: `${l.name} · ${formatUsdNoCents(l.amount)}${fill > 0 ? ` · ${fill}% done` : ''}${m.paidFrac >= 0.995 ? ' · paid' : m.billedFrac > 0 ? ' · billed' : m.paidFrac > 0 ? ` · ${Math.round(m.paidFrac * 100)}% paid` : ''}`,
      amount: l.amount,
    }
  })
  const text = `${crewClause(crew, todayYmd)} · ${percentClause(percent)}`
  const tone: ProgressPaymentTone = paidInFull ? 'green' : mc.tone
  return { mode: 'lines', stageBar: null, liveChipSuffix: null, segments, words: { text, full: `${text} · ${mc.text}`, tone }, stale, percent, offerSetStages: priced.length >= 2 && !paidInFull }
}
