/**
 * Temperature board kernel (v2.2813): every GC over the round threshold with
 * its account man, the current temperature read, a per-week trend over the
 * last N cert weeks, the last word, an expected pay date, and the guardrail —
 * contacted two weeks running with no statement in between. Cold first.
 * Pure: marks (any action, several weeks) + the round groups go in.
 */
import type { GcReviewGroup } from '../gcReviewRollup'
import { addDaysYmd } from '../emailSchedule/emailScheduleWeek'
import { isTemperature, temperatureRank, type RoundMarkRow, type Temperature } from './gcStatementRounds'

export type TemperatureBoardRow = {
  gcId: string
  gcName: string
  amount: number
  senderUserId: string | null
  /** newest temperature read on record within the loaded weeks, or null = no read */
  now: Temperature | null
  nowAt: string | null
  nowBy: string
  /** one slot per week, oldest first: the week's temperature, or null when nobody contacted them that week */
  trend: Array<Temperature | null>
  lastWord: { note: string; by: string; at: string; action: string } | null
  expectedPayBy: string | null
  /** newest statement send on record (sent mark or app email), or null */
  lastStatementAt: string | null
  /** set when the last 2+ consecutive weeks were contacted-only with no send since — the guardrail */
  contactedOnlyWeeks: number
}

/** The N Monday keys ending at `currentWeekStart`, oldest first. */
export function trailingWeekStarts(currentWeekStart: string, weeks: number): string[] {
  const out: string[] = []
  for (let i = weeks - 1; i >= 0; i--) out.push(addDaysYmd(currentWeekStart, -7 * i))
  return out
}

export function buildTemperatureBoard(input: {
  groups: readonly GcReviewGroup[]
  marks: readonly RoundMarkRow[]
  senders: ReadonlyMap<string, string>
  accountMen: ReadonlyMap<string, string>
  weekStarts: readonly string[]
  /** app-sent statement emails per GC (newest ISO), merged with sent marks for "last statement" */
  appLastSentByGc?: Record<string, string>
  threshold: number
}): TemperatureBoardRow[] {
  const byGc = new Map<string, RoundMarkRow[]>()
  for (const m of input.marks) {
    const list = byGc.get(m.gc_customer_id)
    if (list) list.push(m)
    else byGc.set(m.gc_customer_id, [m])
  }
  const rows: TemperatureBoardRow[] = []
  for (const g of input.groups) {
    if (g.isNoGc || !g.gcId || g.subtotal < input.threshold) continue
    const marks = (byGc.get(g.gcId) ?? []).slice().sort((a, b) => (a.acted_at < b.acted_at ? 1 : -1)) // newest first
    const tempMark = marks.find((m) => isTemperature(m.temperature))
    const wordMark = marks.find((m) => m.note?.trim())
    const payMark = marks.find((m) => m.expected_pay_by)
    const sentMark = marks.find((m) => m.action === 'sent')
    const appSent = input.appLastSentByGc?.[g.gcId] ?? null
    const lastStatementAt = [sentMark?.acted_at ?? null, appSent].filter((x): x is string => !!x).sort().pop() ?? null
    const trend = input.weekStarts.map((w) => {
      const wk = marks.find((m) => m.week_start === w && isTemperature(m.temperature))
      return wk && isTemperature(wk.temperature) ? wk.temperature : null
    })
    // Guardrail: count consecutive most-recent weeks whose mark is contacted, stopping at any week with a send.
    let contactedOnlyWeeks = 0
    for (let i = input.weekStarts.length - 1; i >= 0; i--) {
      const w = input.weekStarts[i]!
      const wk = marks.filter((m) => m.week_start === w)
      if (wk.some((m) => m.action === 'sent')) break
      if (wk.some((m) => m.action === 'contacted')) contactedOnlyWeeks += 1
      else break
    }
    if (appSent && sentMark == null && contactedOnlyWeeks > 0) {
      // An app send inside the streak breaks it too.
      const streakStart = input.weekStarts[Math.max(0, input.weekStarts.length - contactedOnlyWeeks)]!
      if (appSent.slice(0, 10) >= streakStart) contactedOnlyWeeks = 0
    }
    rows.push({
      gcId: g.gcId,
      gcName: g.gcName,
      amount: g.subtotal,
      senderUserId: input.senders.get(g.gcId) ?? input.accountMen.get(g.gcId) ?? null,
      now: tempMark && isTemperature(tempMark.temperature) ? tempMark.temperature : null,
      nowAt: tempMark?.acted_at ?? null,
      nowBy: tempMark?.acted_by_name ?? '',
      trend,
      lastWord: wordMark ? { note: wordMark.note!.trim(), by: wordMark.acted_by_name, at: wordMark.acted_at, action: wordMark.action } : null,
      expectedPayBy: payMark?.expected_pay_by ?? null,
      lastStatementAt,
      contactedOnlyWeeks,
    })
  }
  return rows.sort((a, b) => temperatureRank(a.now) - temperatureRank(b.now) || b.amount - a.amount)
}

/** Newest temperature per GC (any action) — the header pills and the chase sort read this. */
export function latestTemperatureByGc(marks: readonly RoundMarkRow[]): Map<string, { temperature: Temperature; at: string; by: string; note: string | null }> {
  const out = new Map<string, { temperature: Temperature; at: string; by: string; note: string | null }>()
  for (const m of marks) {
    if (!isTemperature(m.temperature)) continue
    const prev = out.get(m.gc_customer_id)
    if (!prev || m.acted_at > prev.at) out.set(m.gc_customer_id, { temperature: m.temperature, at: m.acted_at, by: m.acted_by_name, note: m.note })
  }
  return out
}
