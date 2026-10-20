import type { RunEnvelopeStageState } from './runEnvelopeStage'

/**
 * The one button at the foot of the run (Run-1): what the next thing is, with its count, and two
 * status lines — what pressing does, and what will not go. Built from the envelopes' stage states.
 * Everything that is not the next thing goes under More. Pure.
 */
export type RunFootKind = 'print' | 'record' | 'wait' | 'done' | 'nothing'

export type RunFootAction = {
  kind: RunFootKind
  /** The button's words, like "Print the packet · 2 envelopes ▸". */
  label: string
  count: number
  disabled: boolean
  /** The bold line: counts, like "2 print here · 1 waits on Robert". */
  line1: string
  /** The quiet line under it: what pressing does, or what to do first. */
  line2: string
}

const stageDone = (s: RunEnvelopeStageState, key: string) => s.stages.find((x) => x.key === key)?.done ?? false
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export function runFootAction(states: ReadonlyArray<RunEnvelopeStageState>, opts: { leaderName?: string | null } = {}): RunFootAction {
  const total = states.length
  const leader = (opts.leaderName ?? '').trim() || 'the leader'
  if (total === 0) return { kind: 'nothing', label: 'Nothing to send', count: 0, disabled: true, line1: 'Nothing is in this run.', line2: 'Approve a notice, or put one back in.' }
  const waits = states.filter((s) => s.waiting !== null)
  const movable = states.filter((s) => s.waiting === null)
  const toPrint = movable.filter((s) => !stageDone(s, 'printed') && s.lane !== 'email')
  const owe = movable.filter((s) => stageDone(s, 'printed') && !stageDone(s, 'mailed') && s.lane !== 'email')
  const recordable = movable.filter((s) => !stageDone(s, 'recorded') && (s.lane === 'email' || stageDone(s, 'mailed')))
  const recorded = states.filter((s) => stageDone(s, 'recorded'))
  const waitWords = waits.length ? ` · ${plural(waits.length, 'waits', 'wait')} on ${leader}` : ''
  if (recorded.length === total) {
    return { kind: 'done', label: 'Close the run', count: total, disabled: false, line1: `Done. ${plural(total, 'envelope', 'envelopes')} recorded.`, line2: 'Each notice is on its job with how it went and every month it covered.' }
  }
  if (toPrint.length) {
    const held = waits.length
    return {
      kind: 'print',
      label: `Print the packet · ${plural(toPrint.length, 'envelope', 'envelopes')} ▸`,
      count: toPrint.length,
      disabled: false,
      line1: `${plural(toPrint.length, 'prints', 'print')} here${waitWords}`,
      line2: held ? `The held ${held === 1 ? 'one joins' : 'ones join'} the next packet once ${leader} signs. The packet prints with its checklist page.` : 'The packet prints with its checklist page.',
    }
  }
  if (recordable.length) {
    const stay = owe.length + waits.length
    return {
      kind: 'record',
      label: `Record the mailing · ${recordable.length}${stay ? ` (${stay} ${stay === 1 ? 'stays' : 'stay'} in the pile)` : ''} ▸`,
      count: recordable.length,
      disabled: false,
      line1: `${recordable.length} ready to record${owe.length ? ` · ${plural(owe.length, 'still owes', 'still owe')} a number` : ''}${waitWords}`,
      line2: 'Recording writes each notice to its job with how it went and every month it covered.',
    }
  }
  if (owe.length) {
    return { kind: 'wait', label: `Record the mailing · 0 ▸`, count: 0, disabled: true, line1: `${plural(owe.length, 'envelope owes', 'envelopes owe')} a number${waitWords}`, line2: 'Type the numbers from the slips on the checklist above.' }
  }
  return { kind: 'wait', label: 'Nothing to do yet', count: 0, disabled: true, line1: `Every envelope waits on ${leader}`, line2: 'He signs from his phone, or press Sign here when he is beside you.' }
}
