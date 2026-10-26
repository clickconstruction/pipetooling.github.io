/**
 * The Bridge's calls (link PR 2): Monday names the link and the moves on it,
 * each with an owner; Friday asks whether it moved. The record is
 * `bridge_calls`; this file holds the pure reading of it — which call stands
 * for a week, the streak, the scorecard's then → now from the snapshot taken
 * at call time, the verdict, the consequence sentence, the Friday ask — and
 * the three client calls (load, record, answer) at the bottom.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { STAGE_META, STAGE_ORDER, type StageId } from './stageFlow'

export type CallLink = StageId | 'decision' | 'capital' | 'talent'

export const CALL_LINK_NAMES: Record<CallLink, string> = {
  market: 'Market',
  sales: 'Sales',
  build: 'Build',
  bill: 'Bill',
  collect: 'Collect',
  decision: 'Decision',
  capital: 'Capital',
  talent: 'Talent',
}

export function isStageLink(link: CallLink): link is StageId {
  return (STAGE_ORDER as ReadonlyArray<string>).includes(link)
}

/** The numbers behind a move, keyed so the scorecard can read them again later. */
export type MoveKey = 'bill' | 'chase' | 'approve' | 'price' | 'pct' | 'other'

export type CallMove = {
  key: MoveKey
  title: string
  /** Who owns it, in the caller's words; empty when nobody was named. */
  who: string
  /** The number behind it at call time, in the key's unit; null for a move with no number. */
  then: number | null
}

export type CallMeasures = {
  /** The link's weeks to clear at call time; null for a resource or an unread stage. */
  linkWeeks: number | null
  /** The link's pile at call time, in dollars; the verdict reads it beside the weeks. Missing on calls recorded before v2.5872. */
  linkPileUsd?: number | null
  stageWeeks: Partial<Record<StageId, number | null>>
  /** The numbers behind the move keys: dollars for bill and chase, hours for approve, counts for price and pct. */
  keys: Partial<Record<MoveKey, number | null>>
}

export type CallOutcome = 'moved' | 'did_not_move'

export type BridgeCall = {
  id: string
  weekStart: string
  calledOn: string
  calledByName: string
  link: CallLink
  moves: CallMove[]
  measures: CallMeasures
  note: string | null
  outcome: CallOutcome | null
  outcomeAt: string | null
  outcomeNote: string | null
}

/** Today's reading of the same numbers, for then → now. */
export type CallReadingNow = {
  stageWeeks: Partial<Record<StageId, number | null>>
  /** Today's pile per stage, in dollars, read beside the weeks by the verdict. */
  stagePilesUsd?: Partial<Record<StageId, number | null>>
  keys: Partial<Record<MoveKey, number | null>>
}

const byNewest = (a: BridgeCall, b: BridgeCall): number => (a.weekStart === b.weekStart ? (a.calledOn < b.calledOn ? 1 : -1) : a.weekStart < b.weekStart ? 1 : -1)

/** The call that stands for a pay week: the newest row with that week. */
export function callForWeek(calls: ReadonlyArray<BridgeCall>, weekStart: string): BridgeCall | null {
  return [...calls].filter((c) => c.weekStart === weekStart).sort(byNewest)[0] ?? null
}

/** The newest call on any week before this one. */
export function lastCallBefore(calls: ReadonlyArray<BridgeCall>, weekStart: string): BridgeCall | null {
  return [...calls].filter((c) => c.weekStart < weekStart).sort(byNewest)[0] ?? null
}

/** The call the scorecard reads: this week's if made, else the newest before it. */
export function scoreCall(calls: ReadonlyArray<BridgeCall>, weekStart: string): BridgeCall | null {
  return callForWeek(calls, weekStart) ?? lastCallBefore(calls, weekStart)
}

/** How many weeks running the same link has been called, counting this call's week; 1 for a first call. */
export function streakFor(calls: ReadonlyArray<BridgeCall>, call: BridgeCall): number {
  const weeks = [...new Set(calls.map((c) => c.weekStart))].sort((a, b) => (a < b ? 1 : -1))
  let n = 0
  let started = false
  for (const w of weeks) {
    if (w > call.weekStart) continue
    const c = callForWeek(calls, w)
    if (!started) started = true
    if (c && c.link === call.link) n += 1
    else break
  }
  return Math.max(1, n)
}

export const shortUsd = (n: number): string => `$${Math.abs(n) >= 100_000 ? `${Math.round(Math.abs(n) / 1000)}k` : Math.abs(n) >= 1000 ? `${(Math.abs(n) / 1000).toFixed(1).replace(/\.0$/, '')}k` : `${Math.round(Math.abs(n))}`}`

export function measureText(key: MoveKey, v: number | null): string {
  if (v == null) return '—'
  if (key === 'bill' || key === 'chase') return shortUsd(v)
  if (key === 'approve') return `${Math.round(v)}h`
  if (key === 'price' || key === 'pct') return `${Math.round(v)} ${Math.round(v) === 1 ? 'job' : 'jobs'}`
  return String(Math.round(v))
}

export type MoveDone = 'yes' | 'part' | 'no' | 'unknown'

/** A move counts as done when its number fell by half or more; part when it fell at all. */
export function moveDone(then: number | null, now: number | null): MoveDone {
  if (then == null || now == null) return 'unknown'
  if (then <= 0) return now <= 0 ? 'yes' : 'no'
  if (now <= then * 0.5) return 'yes'
  if (now < then) return 'part'
  return 'no'
}

export type CallVerdict = 'moved' | 'did_not_move' | 'open'

/**
 * The link moved when its weeks to clear fell by a tenth or more — and, when both readings carry the
 * pile, only when the pile fell too: weeks also fall when the 8-week window rolls a strong week in,
 * and a shrinking pile is the real move. A recorded answer overrides the numbers.
 */
export function callVerdict(call: BridgeCall, now: CallReadingNow): CallVerdict {
  if (call.outcome) return call.outcome
  if (!isStageLink(call.link)) return 'open'
  const then = call.measures.linkWeeks
  const cur = now.stageWeeks[call.link]
  if (then == null || cur == null) return 'open'
  if (cur > then * 0.9) return 'did_not_move'
  const pileThen = call.measures.linkPileUsd
  const pileNow = now.stagePilesUsd?.[call.link]
  if (pileThen != null && pileNow != null && pileNow >= pileThen) return 'did_not_move'
  return 'moved'
}

/** Friday asks: the week is at its fifth day or past, and nobody has answered. */
export function fridayAsks(call: BridgeCall, todayYmd: string): boolean {
  if (call.outcome) return false
  const fifth = new Date(Date.parse(`${call.weekStart}T00:00:00Z`) + 5 * 86_400_000).toISOString().slice(0, 10)
  return todayYmd >= fifth
}

const ordinal = (n: number): string => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`)

export type Scorecard = {
  linkName: string
  calledLabel: string
  streakText: string
  verdict: CallVerdict
  verdictText: string
  moves: Array<{ title: string; who: string; thenText: string; nowText: string; done: MoveDone }>
  measure: { then: string; now: string } | null
  consequence: string
  fridayAsks: boolean
}

export function buildScorecard(input: { call: BridgeCall; calls: ReadonlyArray<BridgeCall>; now: CallReadingNow; todayYmd: string; dayLabel: (ymd: string) => string }): Scorecard {
  const { call, now } = input
  const streak = streakFor(input.calls, call)
  const verdict = callVerdict(call, now)
  const name = CALL_LINK_NAMES[call.link]
  const moves = call.moves.map((m) => {
    const cur = m.key === 'other' ? null : (now.keys[m.key] ?? null)
    return { title: m.title, who: m.who || '—', thenText: measureText(m.key, m.then), nowText: m.key === 'other' ? '—' : measureText(m.key, cur), done: m.key === 'other' ? ('unknown' as const) : moveDone(m.then, cur) }
  })
  const pileThen = isStageLink(call.link) ? (call.measures.linkPileUsd ?? null) : null
  const pileNow = isStageLink(call.link) ? (now.stagePilesUsd?.[call.link] ?? null) : null
  const measure =
    isStageLink(call.link) && call.measures.linkWeeks != null
      ? {
          then: `${call.measures.linkWeeks.toFixed(1)} weeks${pileThen != null ? ` · ${shortUsd(pileThen)} pile` : ''}`,
          now: now.stageWeeks[call.link] != null ? `${(now.stageWeeks[call.link] as number).toFixed(1)} weeks${pileNow != null ? ` · ${shortUsd(pileNow)} pile` : ''}` : '—',
        }
      : null
  const oneOwner = call.moves.length > 0 && new Set(call.moves.map((m) => m.who.trim().toLowerCase()).filter(Boolean)).size <= 1
  let consequence: string
  if (verdict === 'moved') consequence = streak >= 2 ? `${name} moved after ${streak} weeks on it. Monday names the next link.` : `${name} moved. Monday names the next link.`
  else if (verdict === 'open') consequence = call.moves.length ? 'The week is open. Friday asks whether the link moved.' : 'No moves were named. Friday has nothing to check.'
  else if (streak >= 3) consequence = `${streak} weeks on ${name} with nothing moved. Exploiting has not worked. This week, elevate: spend on it, or change the call.`
  else if (streak === 2) consequence = `Second week on ${name} with nothing moved.${oneOwner ? ' The moves sat with one person.' : ''} This week either the moves get other owners, or the call changes.`
  else consequence = `First week on ${name} with nothing moved. Keep the call and move the moves.`
  return {
    linkName: name,
    calledLabel: `called ${input.dayLabel(call.calledOn)}${call.calledByName ? ` by ${call.calledByName}` : ''}`,
    streakText: streak === 1 ? 'first week on it' : `${ordinal(streak)} week running`,
    verdict,
    verdictText: verdict === 'moved' ? 'moved' : verdict === 'did_not_move' ? 'did not move' : 'open',
    moves,
    measure,
    consequence,
    fridayAsks: fridayAsks(call, input.todayYmd),
  }
}

/** The header chip: "last call: Bill · did not move", or Friday's question. */
export function callChip(card: Scorecard | null): { text: string; tone: 'red' | 'green' | 'amber' | 'muted' } | null {
  if (!card) return null
  if (card.fridayAsks) return { text: `Friday: did ${card.linkName} move?`, tone: 'amber' }
  if (card.verdict === 'moved') return { text: `last call: ${card.linkName} · moved`, tone: 'green' }
  if (card.verdict === 'did_not_move') return { text: `last call: ${card.linkName} · did not move`, tone: 'red' }
  return { text: `this week: ${card.linkName}`, tone: 'muted' }
}

export function deskStatus(input: { link: CallLink; nominatedId: StageId | null; linkId: StageId | null; heldStands: boolean; recorded: boolean }): string {
  if (input.recorded) return 'recorded as the link this week'
  if (input.linkId === input.link) return input.heldStands ? 'the call holds it this week' : 'nominated by the page: the most weeks to clear what is already waiting'
  if (!isStageLink(input.link)) return 'a resource; it throttles a link or shows its symptom'
  return 'not the link today, by the page’s reading'
}

export const stageKindOf = (link: CallLink): string => (isStageLink(link) ? STAGE_META[link].kind : link === 'decision' ? 'bottlenecks at the leadership level' : link === 'capital' ? 'not enough money' : 'not enough people')

// ── client ─────────────────────────────────────────────────────────────────

type CallRow = {
  id: string
  week_start: string
  called_on: string
  called_by_name: string | null
  link: string
  moves: unknown
  measures: unknown
  note: string | null
  outcome: string | null
  outcome_at: string | null
  outcome_note: string | null
}

function rowToCall(r: CallRow): BridgeCall {
  const moves = Array.isArray(r.moves) ? (r.moves as Array<Partial<CallMove>>).map((m) => ({ key: (m.key ?? 'other') as MoveKey, title: String(m.title ?? ''), who: String(m.who ?? ''), then: typeof m.then === 'number' ? m.then : null })) : []
  const ms = (r.measures && typeof r.measures === 'object' ? r.measures : {}) as Partial<CallMeasures>
  return {
    id: r.id,
    weekStart: r.week_start,
    calledOn: r.called_on,
    calledByName: r.called_by_name ?? '',
    link: r.link as CallLink,
    moves,
    measures: { linkWeeks: typeof ms.linkWeeks === 'number' ? ms.linkWeeks : null, linkPileUsd: typeof ms.linkPileUsd === 'number' ? ms.linkPileUsd : null, stageWeeks: ms.stageWeeks ?? {}, keys: ms.keys ?? {} },
    note: r.note,
    outcome: r.outcome === 'moved' || r.outcome === 'did_not_move' ? r.outcome : null,
    outcomeAt: r.outcome_at,
    outcomeNote: r.outcome_note,
  }
}

export async function loadBridgeCalls(limit = 26): Promise<BridgeCall[]> {
  const rows = (await withSupabaseRetry(
    async () => supabase.from('bridge_calls').select('id, week_start, called_on, called_by_name, link, moves, measures, note, outcome, outcome_at, outcome_note').order('week_start', { ascending: false }).order('created_at', { ascending: false }).limit(limit),
    'bridge calls',
  )) as CallRow[] | null
  return (rows ?? []).map(rowToCall)
}

export async function recordBridgeCall(input: { weekStart: string; calledOn: string; calledByName: string; link: CallLink; moves: CallMove[]; measures: CallMeasures; note: string | null }): Promise<void> {
  const { error } = await supabase.from('bridge_calls').insert({
    week_start: input.weekStart,
    called_on: input.calledOn,
    called_by_name: input.calledByName,
    link: input.link,
    moves: input.moves,
    measures: input.measures,
    note: input.note,
  })
  if (error) throw new Error(error.message)
}

export async function answerBridgeCall(id: string, outcome: CallOutcome, note: string | null): Promise<void> {
  const { error } = await supabase
    .from('bridge_calls')
    .update({ outcome, outcome_at: new Date().toISOString(), outcome_note: note })
    .eq('id', id)
  if (error) throw new Error(error.message)
}
