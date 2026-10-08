/**
 * GC mode, the real build, Owner Billing's O2b: asking the customer for the days (G-141), moved word for word from the GC mode
 * prototype (branch spike/gc-mode, `gcTimeExtension.ts`).
 */
import { addDays } from './building'
import { changeOrderDays, projectChangeOrders } from './ownerBilling'
import { ownerFinishRisk } from './ownerBillingFinish'
import { CUSTOMER_WHY } from './schedule/customerSchedule'
import { daysBetween, scheduleLinesOf, substantialCompletionOn } from './schedule/schedule'
import type { ScheduleMove, ScheduleMoveReason } from './schedule/types'
import type { ChangeOrder, ChangeOrderReason, GcProject, GcState } from './types'
import { money, shortDate, weekdayDate } from './words'

/** The reasons a time extension asks for: the customer's own decision, or a change to the plans. A move for a change order belongs to that order. */
const ASK_REASONS = new Set<ScheduleMoveReason>(['customer', 'plans'])

/** One move a time extension asks for. */
export interface TimeExtensionMove {
  id: string
  lineId: string
  /** "Trim": the bar as the customer's What changed names it, never a company. */
  label: string
  /** Days it put on the job's finish. */
  days: number
  reason: ScheduleMoveReason
  /** Ours, never the customer's. */
  note: string
  on: string
  undoneOn: string | null
}

/** What the press drafts. */
export interface TimeExtensionAsk {
  /** Every day the moves put on the finish: what the time extension asks for. */
  days: number
  moves: TimeExtensionMove[]
  reason: ChangeOrderReason
  /** The customer's words: "A time extension for the restroom tile decision we asked you for on Sep 28". */
  description: string
  /** The rule, in their words: "5 days, the days your decision moved the finish." */
  rule: string
  /** Substantial completion now, and once it is signed. Null: no substantial completion milestone. */
  contract: { from: string; to: string } | null
  /** The late days it covers, at the contract's fee. Null: no fee typed. Ours only. */
  saves: number | null
  /** Days it leaves to spare past today's late days. */
  spare: number
}

const daysWords = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`

function andList(words: string[]): string {
  if (words.length <= 1) return words[0] ?? ''
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

/** Set on a change order: a time extension for days on the chart already. */
export function isTimeExtension(co: ChangeOrder): boolean {
  return co.daysOnChart !== undefined
}

/** The moves the time extensions in these states ask for. */
export function askedMoveIds(project: GcProject, statuses: ChangeOrder['status'][]): Set<string> {
  return new Set(projectChangeOrders(project).flatMap((co) => (isTimeExtension(co) && statuses.includes(co.status) ? (co.daysOnChart ?? []) : [])))
}

function barLabel(project: GcProject, lineId: string): string {
  const a = project.schedule?.activities.find((x) => x.lineId === lineId)
  if (a?.inspection) return a.inspection.label
  if (a?.added) return a.added.label
  const pkg = a ? project.packages.find((k) => k.id === a.packageId) : undefined
  return (pkg ? scheduleLinesOf(pkg).find((l) => l.lineId === lineId)?.label : undefined) ?? 'The work'
}

function askMove(project: GcProject, m: ScheduleMove): TimeExtensionMove {
  return { id: m.id, lineId: m.lineId, label: barLabel(project, m.lineId), days: daysBetween(m.finishFrom, m.finishTo), reason: m.reason, note: m.note, on: m.on, undoneOn: m.undoneOn ?? null }
}

/** Standing moves at the customer's door that put days on the finish, with no draft, sent or signed ask holding them. A declined ask lets its moves go. */
export function openAskMoves(project: GcProject): TimeExtensionMove[] {
  const asked = askedMoveIds(project, ['draft', 'sent', 'signed'])
  return (project.schedule?.moves ?? [])
    .filter((m) => !m.undoneOn && !m.changeOrderId && ASK_REASONS.has(m.reason) && !asked.has(m.id) && daysBetween(m.finishFrom, m.finishTo) !== 0)
    .map((m) => askMove(project, m))
}

/** "the restroom tile" and "Restroom tile decision" both read "restroom tile", for "the restroom tile decision". */
function decisionName(title: string): string {
  const bare = title.trim().replace(/^the\s+/i, '').replace(/\s+decision$/i, '')
  const first = bare.split(/\s+/)[0] ?? ''
  return first.length > 1 && first === first.toUpperCase() ? bare : bare.charAt(0).toLowerCase() + bare.slice(1)
}

/**
 * The one decision the customer owes that holds every moved bar (the waits record, G-92): the ask
 * names it and the day we asked (G-141's pick). Null: a change to the plans among them, or not
 * exactly one decision.
 */
function decisionOf(project: GcProject, moves: TimeExtensionMove[]): { name: string; askedOn: string | null } | null {
  if (moves.length === 0 || moves.some((m) => m.reason !== 'customer')) return null
  const decisions = (project.waits ?? []).filter((w) => w.kind === 'decision' && moves.every((m) => w.lineIds.includes(m.lineId)))
  const [one] = decisions
  return decisions.length === 1 && one ? { name: decisionName(one.title), askedOn: one.askedOn } : null
}

function descriptionOf(project: GcProject, moves: TimeExtensionMove[]): string {
  const decision = decisionOf(project, moves)
  if (decision) return `A time extension for the ${decision.name} decision${decision.askedOn ? ` we asked you for on ${shortDate(decision.askedOn)}` : ''}`
  return `A time extension for ${andList([...new Set(moves.map((m) => CUSTOMER_WHY[m.reason]).filter(Boolean))])}`
}

/** "5 days, the days your decision moved the finish." */
function ruleOf(project: GcProject, days: number, moves: TimeExtensionMove[]): string {
  const reasons = new Set(moves.map((m) => m.reason))
  const several = moves.length > 1 && !decisionOf(project, moves)
  const whose = reasons.has('plans')
    ? reasons.has('customer')
      ? 'your decisions and the changes to the plans'
      : several
        ? 'the changes to the plans'
        : 'the change to the plans'
    : several
      ? 'your decisions'
      : 'your decision'
  return `${daysWords(days)}, the ${days === 1 ? 'day' : 'days'} ${whose} moved the finish.`
}

/** What days of contract time are worth: the late days they cover at the contract's fee, and the days left to spare. `already`: days the contract has moved for them, once signed. */
function worth(state: GcState, project: GcProject, days: number, already: number): { saves: number | null; spare: number; perDay: number | null } {
  const risk = ownerFinishRisk(state, project)
  const late = Math.max(0, (risk.past ?? 0) + already)
  return { saves: risk.perDay ? Math.min(late, days) * risk.perDay : null, spare: Math.max(0, days - late), perDay: risk.perDay }
}

/** The time extension the moves not asked for yet would make. Null: no such moves, or their days add to none. */
export function timeExtensionAsk(state: GcState, project: GcProject): TimeExtensionAsk | null {
  const moves = openAskMoves(project)
  const days = moves.reduce((sum, m) => sum + m.days, 0)
  if (days <= 0) return null
  const contract = substantialCompletionOn(project)
  const { saves, spare } = worth(state, project, days, 0)
  return {
    days,
    moves,
    reason: moves.every((m) => m.reason === 'plans') ? 'plans' : 'owner',
    description: descriptionOf(project, moves),
    rule: ruleOf(project, days, moves),
    contract: contract ? { from: contract.on, to: addDays(contract.on, days) } : null,
    saves,
    spare,
  }
}

function movesOf(project: GcProject, co: ChangeOrder): TimeExtensionMove[] {
  return (co.daysOnChart ?? []).flatMap((id) => {
    const m = project.schedule?.moves?.find((x) => x.id === id)
    return m ? [askMove(project, m)] : []
  })
}

/** The rule on a time extension, in the customer's words, for its row and their portal card. Empty: not a time extension. */
export function timeExtensionRule(project: GcProject, co: ChangeOrder): string {
  return isTimeExtension(co) ? ruleOf(project, changeOrderDays(co), movesOf(project, co)) : ''
}

/**
 * A time extension's lines on its row, ours: the rule, each move with our note, what it is worth at
 * the contract's fee, and the contract's day. A move undone since says so, so the office sees the
 * ask is now too big. Empty: not a time extension.
 */
export function timeExtensionLines(state: GcState, project: GcProject, co: ChangeOrder): string[] {
  if (!isTimeExtension(co)) return []
  const days = changeOrderDays(co)
  const lines = [timeExtensionRule(project, co)]
  for (const m of movesOf(project, co)) {
    lines.push(m.undoneOn ? `${m.label}'s move of ${weekdayDate(m.on)} was undone ${weekdayDate(m.undoneOn)}.` : `${m.label} moved ${weekdayDate(m.on)} and put ${daysWords(m.days)} on the finish. Our note: “${m.note}”`)
  }
  if (co.status === 'declined') return lines
  const signed = co.status === 'signed'
  const { saves, spare, perDay } = worth(state, project, days, signed ? days : 0)
  if (saves !== null && perDay) {
    lines.push(
      saves > 0
        ? `At the contract's ${money(perDay)} a day, it saves ${money(saves)}${spare > 0 ? ` and leaves ${daysWords(spare)} to spare` : ''}.`
        : `At the contract's ${money(perDay)} a day, it saves nothing today and leaves ${daysWords(spare)} to spare.`,
    )
  }
  const contract = substantialCompletionOn(project)
  if (contract) {
    lines.push(
      signed
        ? `Substantial completion moved from ${weekdayDate(addDays(contract.on, -days))} to ${weekdayDate(contract.on)}.`
        : `Substantial completion moves from ${weekdayDate(contract.on)} to ${weekdayDate(addDays(contract.on, days))}.`,
    )
  }
  return lines
}
