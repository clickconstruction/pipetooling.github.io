import type { RunEnvelope } from './runEnvelopes'
import { recipientMailed, runNoticeProblems, type RunSendMethod } from './lienDeskRun'

/**
 * One envelope's place on its way out (the run shown not told, Run-1 — `docs/DOCSMIT_LIEN_RUN_PLAN.md`,
 * section *The run, shown not told*). The run's envelope cards draw it: the lane the envelope
 * travels, its stages in order with each one done or not, the first stage not yet done, why it
 * waits when it does, and the glyph — an envelope open, sealed, postmarked or delivered. Pure:
 * the envelope and three facts the window knows (printed, recorded, delivered) in, the state out.
 */
export type RunLane = 'certified' | 'courier' | 'hand' | 'email'

export type RunStageKey = 'built' | 'checked' | 'signed' | 'printed' | 'mailed' | 'recorded' | 'delivered'

export type RunStage = { key: RunStageKey; label: string; done: boolean }

export type RunGlyph = 'open' | 'sealed' | 'postmarked' | 'delivered'

export type RunEnvelopeFacts = {
  /** The packet (or this envelope) printed. */
  printed: boolean
  /** The notices inside were recorded on their jobs. */
  recorded?: boolean
  /** A delivery scan came back (a provider's news; none today). */
  delivered?: boolean
}

export type RunEnvelopeStageState = {
  lane: RunLane
  stages: RunStage[]
  /** The first stage not done, or `done` when every stage is. */
  current: RunStageKey | 'done'
  /** Why the envelope cannot move: the first problem the run names, or null. */
  waiting: string | null
  glyph: RunGlyph
}

export function runLaneOf(method: RunSendMethod): RunLane {
  return method === 'traceable_courier' ? 'courier' : method === 'hand' ? 'hand' : method === 'email' ? 'email' : 'certified'
}

/** The stage labels per lane: paper goes printed, mailed, recorded; a hand delivery is handed over; an email is sent when the run is recorded. */
export function runStageLabels(lane: RunLane): Record<RunStageKey, string> {
  return {
    built: 'Built',
    checked: 'Checked',
    signed: 'Signed',
    printed: 'Printed',
    mailed: lane === 'hand' ? 'Handed over' : lane === 'email' ? 'Emailed' : 'Mailed',
    recorded: 'Recorded',
    delivered: 'Delivered',
  }
}

/** The problems the run names for this envelope's copies: a notice-wide problem, or one naming this recipient. */
export function runEnvelopeProblems(env: Pick<RunEnvelope, 'contents'>): string[] {
  const out: string[] = []
  for (const c of env.contents) {
    for (const p of runNoticeProblems(c.notice)) {
      // A problem that names a recipient ("Owner of record: no mailing address") belongs to that recipient's envelope; the rest ("Unsigned: …") to every envelope the notice is in.
      const namesOther = c.notice.recipients.some((r) => r.key !== c.recipient.key && p.startsWith(`${r.label}:`))
      if (!namesOther) {
        if (!out.includes(p)) out.push(p)
      }
    }
  }
  return out
}

/** Every notice inside carries a signature, or says nothing about one (a builder that never looked is not a hold). */
export function runEnvelopeSigned(env: Pick<RunEnvelope, 'contents'>): boolean {
  return env.contents.every((c) => c.notice.signature !== null)
}

export function runEnvelopeStage(env: Pick<RunEnvelope, 'method' | 'tracking' | 'address' | 'contents'>, facts: RunEnvelopeFacts): RunEnvelopeStageState {
  const lane = runLaneOf(env.method)
  const labels = runStageLabels(lane)
  const problems = runEnvelopeProblems(env)
  const signed = runEnvelopeSigned(env)
  const checked = env.address.trim().length > 0 || lane === 'email'
  const printed = facts.printed
  const recorded = Boolean(facts.recorded)
  // Mailed: a paper envelope once it carries its number (or a hand delivery once it names who took it); an email once the run records it.
  const mailed = lane === 'email' ? recorded : printed && recipientMailed({ method: env.method, tracking: env.tracking })
  const delivered = Boolean(facts.delivered)
  const stages: RunStage[] = [
    { key: 'built', label: labels.built, done: true },
    { key: 'checked', label: labels.checked, done: checked },
    { key: 'signed', label: labels.signed, done: signed },
    // An email copy is never printed: it goes out when the run records, so its lane has no Printed stage.
    ...(lane === 'email' ? [] : [{ key: 'printed' as const, label: labels.printed, done: printed }]),
    { key: 'mailed', label: labels.mailed, done: mailed },
    { key: 'recorded', label: labels.recorded, done: recorded },
  ]
  if (facts.delivered !== undefined) stages.push({ key: 'delivered', label: labels.delivered, done: delivered })
  const first = stages.find((s) => !s.done)
  const waiting = problems[0] ?? null
  const glyph: RunGlyph = delivered ? 'delivered' : mailed ? 'postmarked' : printed && lane !== 'email' ? 'sealed' : 'open'
  return { lane, stages, current: first ? first.key : 'done', waiting, glyph }
}
