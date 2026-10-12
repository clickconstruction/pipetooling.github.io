import type { RunEnvelopeStageState } from './runEnvelopeStage'

/**
 * The journey across the top of the run (Run-1): six nodes, a count under each, the blocker drawn
 * on the node it blocks, the fill as far as every envelope has come. Built from the envelopes'
 * stage states, so it says the same thing the cards say. Pure.
 */
export type RunJourneyKey = 'built' | 'signed' | 'sent' | 'mailed' | 'recorded' | 'delivered'

export type RunJourneyNode = {
  key: RunJourneyKey
  label: string
  /** "2 of 3" */
  count: string
  done: boolean
  /** done · now (the first not done) · blocked (the first not done, and something waits there) · todo */
  state: 'done' | 'now' | 'blocked' | 'todo'
  /** The blocker's words on its node, like "2 wait on Robert"; null elsewhere. */
  note: string | null
}

export type RunJourney = { nodes: RunJourneyNode[]; /** 0 to 1: how far the fill runs between the first and the last node. */ fillRatio: number; total: number }

const LABELS: Record<RunJourneyKey, string> = { built: 'Built', signed: 'Signed', sent: 'Sent', mailed: 'In the mail', recorded: 'Recorded', delivered: 'Delivered' }

export function runJourney(states: ReadonlyArray<RunEnvelopeStageState>, opts: { leaderName?: string | null } = {}): RunJourney {
  const total = states.length
  const stageDone = (s: RunEnvelopeStageState, key: string) => s.stages.find((x) => x.key === key)?.done ?? false
  const builtOk = states.filter((s) => stageDone(s, 'checked')).length
  const signed = states.filter((s) => stageDone(s, 'signed')).length
  const sent = states.filter((s) => stageDone(s, 'printed')).length
  const mailed = states.filter((s) => stageDone(s, 'mailed')).length
  const recorded = states.filter((s) => stageDone(s, 'recorded')).length
  const delivered = states.filter((s) => stageDone(s, 'delivered')).length
  const unsigned = states.filter((s) => !stageDone(s, 'signed')).length
  const unchecked = states.filter((s) => !stageDone(s, 'checked')).length
  const leader = (opts.leaderName ?? '').trim() || 'the leader'
  const raw: Array<{ key: RunJourneyKey; n: number; note: string | null }> = [
    { key: 'built', n: builtOk, note: unchecked ? `${unchecked} ${unchecked === 1 ? 'has' : 'have'} no address` : null },
    { key: 'signed', n: signed, note: unsigned ? `${unsigned} wait${unsigned === 1 ? 's' : ''} on ${leader}` : null },
    { key: 'sent', n: sent, note: null },
    { key: 'mailed', n: mailed, note: null },
    { key: 'recorded', n: recorded, note: null },
    { key: 'delivered', n: delivered, note: null },
  ]
  let nowSet = false
  const nodes: RunJourneyNode[] = raw.map((r) => {
    const done = total > 0 && r.n === total && r.key !== 'delivered'
    let state: RunJourneyNode['state'] = done ? 'done' : 'todo'
    if (!done && !nowSet && total > 0) {
      state = r.note ? 'blocked' : 'now'
      nowSet = true
    }
    return { key: r.key, label: LABELS[r.key], count: `${r.n} of ${total}`, done, state, note: r.note }
  })
  const doneCount = nodes.filter((n) => n.done).length
  const fillRatio = total === 0 ? 0 : Math.max(0, doneCount - 1) / (nodes.length - 1)
  return { nodes, fillRatio, total }
}
