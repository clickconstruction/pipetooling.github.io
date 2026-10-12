/**
 * One person on their flow as the step card and the nudges take them (`flows/nudges.ts`'s `PersonFlow`), from the rows
 * the app keeps: their flow rows (`flow_rows`, read by `load.ts`), the holds and the reminders sent (`nudge_holds`,
 * `nudge_sent`), their step notes (team lines in `messages` with a `step_key`), and their thread's last lines. Pure.
 */
import type { PaperId } from './facts'
import { flowStampsFor, type FlowRows } from './load'
import type { NudgeMark, PersonFlow, StepNote } from './nudges'
import { quietDays as quietDaysOf, readFlow, type FlowDef } from './state'

/** `nudge_holds`, standing or let go. */
export type HoldRow = { step_key: string; project_id: string | null; until_on: string; released_at: string | null }
/** `nudge_sent`: a reminder a person or the app sent. */
export type SentRow = { step_key: string; project_id: string | null; sent_at: string }
/** A step's team note: a `messages` line with its `step_key`. */
export type StepNoteRow = { step_key: string; project_id: string | null; who_user_id: string | null; body: string; at: string }
/** The least of a thread line the card reads: whose it is and when. */
export type ThreadLineRow = { direction: 'in' | 'out' | 'team'; at: string }

export type PersonInputs = {
  /** The contact's id. */
  id: string
  /** What we call them (the spine's `firstName`). */
  first: string
  flow: FlowDef
  rows: FlowRows
  now: Date
  holds?: readonly HoldRow[]
  sent?: readonly SentRow[]
  notes?: readonly StepNoteRow[]
  lines?: readonly ThreadLineRow[]
  /** We owe them (cluster 2's `contact_owed`); false until that read is wired. */
  owe?: boolean
}

/** `gc_paper_sends.paper` in the flow's paper words. */
const SENT_PAPER: Readonly<Record<string, PaperId>> = { msa: 'msa', sow: 'sow', insurance: 'coi', w9: 'w9', waiver: 'waiver' }

const newestAt = <T extends { at: string }>(xs: readonly T[]): T | null => xs.reduce<T | null>((b, x) => (!b || x.at > b.at ? x : b), null)

/** Each step's Hold until and its last reminder, one mark per step and job. */
export function marksFrom(holds: readonly HoldRow[], sent: readonly SentRow[]): NudgeMark[] {
  const marks = new Map<string, NudgeMark>()
  const at = (stepId: string, jobId: string | null) => {
    const key = `${stepId}|${jobId ?? ''}`
    const m = marks.get(key) ?? { stepId, jobId }
    marks.set(key, m)
    return m
  }
  for (const h of holds) if (!h.released_at) at(h.step_key, h.project_id).holdUntil = h.until_on
  for (const s of sent) {
    const m = at(s.step_key, s.project_id)
    if (!m.nudgedAt || s.sent_at > m.nudgedAt) m.nudgedAt = s.sent_at
  }
  return [...marks.values()]
}

/** Each paper of ours that went to them, its sends in order, the first and then each reminder. */
export function sendsFrom(rows: FlowRows): Partial<Record<PaperId, readonly string[]>> {
  const out: Partial<Record<PaperId, string[]>> = {}
  for (const s of rows.paperSends ?? []) {
    const paper = SENT_PAPER[s.paper]
    if (!paper) continue
    ;(out[paper] ??= []).push(s.created_at || s.sent_on)
  }
  for (const k of Object.keys(out) as PaperId[]) out[k]?.sort()
  return out
}

/** Whose court their thread is in: ours after their last word, theirs after ours, nobody's with no line yet. */
export function courtFrom(lines: readonly ThreadLineRow[]): 'ours' | 'theirs' | null {
  const lastIn = newestAt(lines.filter((l) => l.direction === 'in'))
  const lastOut = newestAt(lines.filter((l) => l.direction === 'out'))
  if (!lastIn && !lastOut) return null
  if (!lastOut || (lastIn && lastIn.at > lastOut.at)) return 'ours'
  return 'theirs'
}

/** One person on their flow, for the panel, the card and the nudges. */
export function personFlowFrom(i: PersonInputs): PersonFlow {
  const reading = readFlow(i.flow, flowStampsFor(i.flow.kind, i.rows, i.now), i.now)
  const names = i.rows.userNames ?? {}
  const lines = i.lines ?? []
  const notes: StepNote[] = (i.notes ?? []).map((n) => ({
    stepId: n.step_key,
    jobId: n.project_id,
    by: (n.who_user_id && names[n.who_user_id]) || '',
    text: n.body,
    at: n.at,
  }))
  const jobs: Partial<Record<string, string>> = {}
  for (const p of i.rows.projects ?? []) {
    const name = (p as { name?: string | null }).name
    if (name) jobs[p.project_id] = name
  }
  return {
    id: i.id,
    first: i.first,
    flow: i.flow,
    reading,
    quietDays: quietDaysOf(lines, i.now),
    lastOutAt: newestAt(lines.filter((l) => l.direction === 'out'))?.at ?? null,
    court: courtFrom(lines),
    owe: i.owe ?? false,
    marks: marksFrom(i.holds ?? [], i.sent ?? []),
    notes,
    jobs,
    sends: sendsFrom(i.rows),
    portal: null,
  }
}
