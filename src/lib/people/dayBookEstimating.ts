/**
 * The Day book's estimating strip (to-dos/day-book, PR 4, v2.3727).
 *
 * For one picked person over the range: the measures that mean something for a bid,
 * each against the same window before it ("was"). The person is compared only with
 * themselves; no column ever puts two estimators side by side. A hit rate on fewer than
 * five decided bids is not a rate — it shows its denominator and reads muted. Every
 * dollar figure arrives NULL when the viewer may not see money; the strip says "—".
 * Pure.
 */
import { formatDayBookUsd } from './dayBook'

export type EstimatingWindow = {
  sent_n: number
  sent_usd: number | string | null
  late_n: number
  unfollowed_n: number
  won_n: number
  lost_n: number
  won_usd: number | string | null
  lost_usd: number | string | null
  lost_no_reason_n: number
  hit_rate: number | string | null
  hit_decided_n: number
  rfq_asks_n: number
  rfq_median_days: number | string | null
  robot_runs_n: number
  robot_median_delta: number | string | null
  bid_hours: number | string | null
}

export type EstimatingPayload = {
  person: string
  money: boolean
  prev_from: string
  prev_to: string
  windows: { now?: Partial<EstimatingWindow> | null; was?: Partial<EstimatingWindow> | null } | null
}

export type EstimatingTile = {
  key: string
  label: string
  /** The figure, as drawn ("11", "38%", "2.4 d"). */
  value: string
  /** Under the figure: "$2.14M", "of 11", "by value · was 34%". */
  sub: string | null
  /** Too few to mean anything, or no money — drawn grey. */
  muted: boolean
}

/** Decided bids a hit rate needs before it reads as a rate. */
export const HIT_RATE_MIN_DECIDED = 5

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}
function count(v: unknown): number {
  return num(v) ?? 0
}
function usdShort(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`
  if (abs >= 10_000) return `$${Math.round(n / 1000)}k`
  return formatDayBookUsd(n)
}
function pct(r: number): string {
  return `${Math.round(r * 100)}%`
}

/** The nine tiles the strip draws, in order. `null` when the payload carries no strip. */
export function buildEstimatingStrip(est: EstimatingPayload | null | undefined): EstimatingTile[] | null {
  if (!est || !est.windows) return null
  const now = est.windows.now ?? {}
  const was = est.windows.was ?? {}
  const money = est.money === true
  const tiles: EstimatingTile[] = []

  const sentN = count(now.sent_n)
  const sentUsd = money ? num(now.sent_usd) : null
  tiles.push({ key: 'sent', label: 'Sent', value: String(sentN), sub: sentUsd !== null ? usdShort(sentUsd) : money ? null : 'amounts hidden', muted: sentN === 0 })

  tiles.push({ key: 'late', label: 'After due date', value: sentN > 0 ? `${count(now.late_n)} of ${sentN}` : '—', sub: null, muted: sentN === 0 })

  const wonN = count(now.won_n)
  const lostN = count(now.lost_n)
  const wonUsd = money ? num(now.won_usd) : null
  const lostUsd = money ? num(now.lost_usd) : null
  tiles.push({
    key: 'decided',
    label: 'Decided',
    value: wonN + lostN > 0 ? `${wonN} won · ${lostN} lost` : '—',
    sub: wonN + lostN > 0 && (wonUsd !== null || lostUsd !== null) ? `${wonUsd !== null ? usdShort(wonUsd) : '—'} · ${lostUsd !== null ? usdShort(lostUsd) : '—'}` : null,
    muted: wonN + lostN === 0,
  })

  const decided = count(now.hit_decided_n)
  const rate = num(now.hit_rate)
  const wasRate = num(was.hit_rate)
  const enough = decided >= HIT_RATE_MIN_DECIDED
  tiles.push({
    key: 'hit',
    label: 'Hit rate, 90 days',
    value: rate !== null && decided > 0 ? pct(rate) : '—',
    sub: decided > 0 ? `by value · ${decided} decided${wasRate !== null && count(was.hit_decided_n) >= HIT_RATE_MIN_DECIDED ? ` · was ${pct(wasRate)}` : ''}` : 'nothing decided',
    muted: !enough,
  })

  const noReason = count(now.lost_no_reason_n)
  tiles.push({ key: 'no-reason', label: 'Lost, no reason', value: String(noReason), sub: lostN > 0 ? `of ${lostN} lost` : null, muted: lostN === 0 })

  const unfollowed = count(now.unfollowed_n)
  tiles.push({ key: 'unfollowed', label: 'No follow-up in 7 days', value: sentN > 0 ? `${unfollowed} of ${sentN} sent` : '—', sub: null, muted: sentN === 0 })

  const asks = count(now.rfq_asks_n)
  const median = num(now.rfq_median_days)
  tiles.push({ key: 'rfq', label: 'Prices asked → in', value: asks > 0 && median !== null ? `${median.toFixed(1)} d median` : asks > 0 ? 'none back yet' : '—', sub: asks > 0 ? `${asks} ${asks === 1 ? 'ask' : 'asks'}` : null, muted: asks === 0 })

  const runs = count(now.robot_runs_n)
  const delta = num(now.robot_median_delta)
  tiles.push({ key: 'robot', label: 'Robot delta', value: runs > 0 && delta !== null ? `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${Math.abs(delta).toFixed(1)}% median` : '—', sub: runs > 0 ? `${runs} ${runs === 1 ? 'sealed run' : 'sealed runs'}` : null, muted: runs === 0 })

  const hours = num(now.bid_hours) ?? 0
  const per = money && sentUsd !== null && sentUsd > 0 && hours > 0 ? hours / (sentUsd / 100_000) : null
  const wasHours = num(was.bid_hours) ?? 0
  const wasSent = money ? num(was.sent_usd) : null
  const wasPer = wasSent !== null && wasSent > 0 && wasHours > 0 ? wasHours / (wasSent / 100_000) : null
  tiles.push({
    key: 'hours',
    label: 'Hours per $100k sent',
    value: per !== null ? per.toFixed(1) : hours > 0 ? `${hours.toFixed(1)}h on bids` : '—',
    sub: per !== null && wasPer !== null ? `was ${wasPer.toFixed(1)}` : per !== null ? `${hours.toFixed(1)}h on bids` : hours === 0 ? 'no bid hours clocked' : null,
    muted: per === null,
  })

  return tiles
}
