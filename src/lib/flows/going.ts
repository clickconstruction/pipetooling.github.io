/**
 * How a flow is going (BUILD_PLAN.md cut 4, `MESSAGES_PLAN.md` piece 9, the prototype's v1.102), lifted from
 * `goingHtml` and `usualWords` in `to-dos/gc-mode/messages/prototype.html` on spike/gc-mode (v1.178): each step's
 * usual, the How it is going tab's one row per step, and the per-job lane as a funnel. The prototype wrote these
 * as fixed numbers (`FUNNEL`, `GOING_DONE`, `STICKS`, each step's `usual`). Here they are reads over the times a
 * company went through a step, so no target is ever typed. The office's to read; nothing in it is money.
 */
import { daysUntil } from '../gc/words'
import { boardLines, type BoardCompany, type BoardContext, type LineTone } from './board'
import { factById, FLOW_PAPERS, type FactId, type FlowKind } from './facts'
import { flat, type FlowDef } from './state'

/** One time a company went through a step: from the day it came on to the day it was done, null while still on it. */
export interface StepSpan {
  stepId: string
  contactId: string
  jobId: string | null
  from: string
  to: string | null
  /** The fact that turned true last and finished it, for where a step sticks. */
  lastFact: FactId | null
}

/** Under this many done in the last year a step has no usual yet. */
export const USUAL_MIN_DONE = 5
/** The usual reads the done ones over the last year. */
export const USUAL_WINDOW_DAYS = 365

const daysFrom = (from: string, to: string): number => daysUntil(to, from)

/** The middle of the numbers, rounded; the mean of the two middle ones for an even count. */
export function median(ns: readonly number[]): number | null {
  if (!ns.length) return null
  const xs = [...ns].sort((a, b) => a - b)
  const mid = Math.floor(xs.length / 2)
  const hi = xs[mid] ?? 0
  return Math.round(xs.length % 2 ? hi : ((xs[mid - 1] ?? hi) + hi) / 2)
}

/** The step's spans done in the last year. */
function doneInYear(spans: readonly StepSpan[], stepId: string, today: string): (StepSpan & { to: string })[] {
  return spans.filter((s): s is StepSpan & { to: string } => s.stepId === stepId && s.to != null && daysFrom(s.to, today) >= 0 && daysFrom(s.to, today) < USUAL_WINDOW_DAYS)
}

/** A step's usual in days: the middle of the done ones over the last year. Null under five done. */
export function usualDays(spans: readonly StepSpan[], stepId: string, today: string): number | null {
  const done = doneInYear(spans, stepId, today)
  return done.length < USUAL_MIN_DONE ? null : median(done.map((s) => daysFrom(s.from, s.to)))
}

/** Every step's usual, for the boards and the step card. */
export function usualByStep(flow: FlowDef, spans: readonly StepSpan[], today: string): Record<string, number | null> {
  return Object.fromEntries(flat(flow).map((s) => [s.id, usualDays(spans, s.id, today)]))
}

/**
 * The step card's bar against the usual (`usualWords`): how much of the usual is used, and how far past it a
 * second, red part runs, as percents of the usual, the overrun capped at 60.
 */
export function usualBar(days: number, usual: number): { pct: number; overPct: number } {
  const pct = Math.min(100, Math.round((100 * Math.min(days, usual)) / Math.max(usual, 1)))
  const overPct = days > usual ? Math.min(60, Math.round((100 * (days - usual)) / Math.max(usual, 1))) : 0
  return { pct, overPct }
}

/** The first day of today's quarter: Jan 1, Apr 1, Jul 1 or Oct 1. */
export function quarterStart(today: string): string {
  const [y, m] = today.split('-').map(Number)
  const first = Math.floor(((m ?? 1) - 1) / 3) * 3 + 1
  return `${y}-${String(first).padStart(2, '0')}-01`
}

export interface Sticks {
  factId: FactId
  /** How often it was the last to turn true. */
  times: number
  /** Out of how many done. */
  of: number
}

export interface GoingRow {
  stepId: string
  name: string
  /** Lines on it now, now or lapsed: the same count as the board's row. */
  onItNow: number
  usual: number | null
  /** The one on it longest now, with its line's tone: late, lapsed, waiting, over usual, or none. A day still ahead is on time. */
  longest: { contactId: string; name: string; days: number; tone: LineTone } | null
  doneThisQuarter: number
  /** Only on a step that waits on two facts or more, all of them: the one last to turn true most often. A fork has none. */
  sticks: Sticks | null
}

/** Where a step sticks: of its done ones in the last year, the fact last to turn true most often. Ties go to the first in the step's list. */
export function sticksOf(facts: readonly FactId[], spans: readonly StepSpan[], stepId: string, today: string): Sticks | null {
  if (facts.length < 2) return null
  const done = doneInYear(spans, stepId, today).filter((s) => s.lastFact)
  if (!done.length) return null
  let best: Sticks | null = null
  for (const factId of facts) {
    const times = done.filter((s) => s.lastFact === factId).length
    if (times && (!best || times > best.times)) best = { factId, times, of: done.length }
  }
  return best
}

/** A fact as a thing: the paper it reads, else the fact in words. */
const factNoun = (id: FactId): string => {
  const f = factById(id)
  return f?.paper ? FLOW_PAPERS[f.paper].name : (f?.text ?? id)
}

/** "their certificate of insurance, 7 of 9 times". */
export const sticksWords = (s: Sticks, noun: (factId: FactId) => string = factNoun): string => `${noun(s.factId)}, ${s.times} of ${s.of} times`

/** How it is going: one row per step in the flow's order. On it now and the longest read the board, so the two pages agree. */
export function goingRows(ctx: BoardContext, companies: readonly BoardCompany[], spans: readonly StepSpan[]): GoingRow[] {
  const q = quarterStart(ctx.today)
  return flat(ctx.flow).map((step) => {
    const lines = boardLines(ctx, companies, step)
    const usual = ctx.usual[step.id] ?? null
    const longest = lines.reduce<GoingRow['longest']>((best, l) => (l.days != null && (!best || l.days > best.days) ? { contactId: l.contactId, name: l.name, days: l.days, tone: l.tone } : best), null)
    return {
      stepId: step.id,
      name: step.name,
      onItNow: lines.length,
      usual,
      longest,
      doneThisQuarter: spans.filter((s) => s.stepId === step.id && s.to != null && s.to >= q && s.to <= ctx.today).length,
      // A fork ends on whichever fact turns true, so "last to turn true" says nothing there.
      sticks: step.join === 'and' ? sticksOf(step.facts, spans, step.id, ctx.today) : null,
    }
  })
}

// ---------------------------------------------------------------------------------------------------
// The funnel: the per-job lane as counts, with the fall-off between each and the ones that fell out.

/** One company's run through the per-job lane on one job, and the facts that turned true on it, once per round. */
export interface FunnelRun {
  contactId: string
  jobId: string
  /** The day it began: the ask, or the customer's first word. */
  from: string
  facts: readonly FactId[]
  /** It left the lane: lost, declined, or the job went on without them. */
  ended: boolean
}

export interface FunnelStage {
  label: string
  /** The fact a run must have to count; null counts every run. */
  fact: FactId | null
}

export interface FunnelDef {
  stages: readonly FunnelStage[]
  /** The ones that fell out: runs that reached the stage before `at` and ended without stage `at`. */
  out: { label: string; at: number } | null
  /** Rounds, not runs: each count is how many times the fact turned true, so it is no funnel and has no arrows. */
  rounds: boolean
}

export const FUNNELS: Partial<Record<FlowKind, FunnelDef>> = {
  trade: {
    stages: [
      { label: 'asked', fact: null },
      { label: 'quoted', fact: 'quote_in' },
      { label: 'carried', fact: 'carried' },
      { label: 'SOW signed', fact: 'sow_signed' },
    ],
    out: { label: 'not quoted', at: 1 },
    rounds: false,
  },
  customer: {
    stages: [
      { label: 'asked us', fact: null },
      { label: 'bid', fact: 'bid_sent' },
      { label: 'said yes', fact: 'said_yes' },
      { label: 'contract', fact: 'contract_signed' },
    ],
    out: { label: 'declined', at: 2 },
    rounds: false,
  },
  arch: {
    stages: [
      { label: 'plans in', fact: 'plans_in' },
      { label: 'questions', fact: 'question_answered' },
      { label: 'addenda', fact: 'addendum_filed' },
    ],
    out: null,
    rounds: true,
  },
}

export interface FunnelCount {
  label: string
  n: number
  /** The share of the stage before that reached this one, as a percent; null on the first and on a count of rounds. */
  pctOfPrev: number | null
}

export interface Funnel {
  stages: FunnelCount[]
  out: { label: string; n: number } | null
  rounds: boolean
}

/** The per-job lane this quarter as counts. Null for a kind with no funnel. */
export function funnel(kind: FlowKind, runs: readonly FunnelRun[], today: string): Funnel | null {
  const def = FUNNELS[kind]
  if (!def) return null
  const q = quarterStart(today)
  const inQuarter = runs.filter((r) => r.from >= q && r.from <= today)
  const reached = (r: FunnelRun, i: number): boolean => {
    const fact = def.stages[i]?.fact
    return fact == null || r.facts.includes(fact)
  }
  const stages = def.stages.map((s, i): FunnelCount => {
    const n = def.rounds ? inQuarter.reduce((sum, r) => sum + r.facts.filter((f) => f === s.fact).length, 0) : inQuarter.filter((r) => reached(r, i)).length
    return { label: s.label, n, pctOfPrev: null }
  })
  if (!def.rounds) {
    stages.forEach((s, i) => {
      const prev = stages[i - 1]
      if (prev && prev.n > 0) s.pctOfPrev = Math.round((100 * s.n) / prev.n)
    })
  }
  const outDef = def.out
  const out = outDef ? { label: outDef.label, n: inQuarter.filter((r) => r.ended && reached(r, outDef.at - 1) && !reached(r, outDef.at)).length } : null
  return { stages, out, rounds: def.rounds }
}
