import type { RunEnvelope } from './runEnvelopes'
import { recipientMailed, type RunSendMethod } from './lienDeskRun'
import { runLaneOf, type RunLane } from './runEnvelopeStage'

/**
 * The checklist sheet, live (Run-1): the printed packet's page 1 has a row per envelope with three
 * boxes — stuffed, slip on, mailed — and a line for the number. Once the packet prints, the run
 * window draws the same rows so they can be ticked at the counter from a phone. The ticks are the
 * window's own state; this kernel gives each row its words, its box labels for its lane, and
 * whether it is done (its number typed, or who took it). Pure.
 */
export type RunChecklistRow = {
  n: number
  name: string
  address: string
  /** "878 owner, 258 owner" — what is inside, in the packet's words. */
  inside: string
  lane: RunLane
  method: RunSendMethod
  /** The three boxes' labels for this lane. */
  boxes: [string, string, string]
  /** The number box's placeholder: a certified number, a courier number, or who signed for it. */
  placeholder: string
  tracking: string
  /** Its number typed, or who took it named: the row is done and records. */
  done: boolean
}

export function runChecklistBoxes(lane: RunLane): [string, string, string] {
  if (lane === 'hand') return ['stuffed', 'in the truck', 'handed over']
  if (lane === 'courier') return ['stuffed', 'label on', 'picked up']
  return ['stuffed', 'slip on', 'mailed']
}

export function runChecklistPlaceholder(lane: RunLane): string {
  return lane === 'hand' ? 'who signed for it' : lane === 'courier' ? 'the courier’s number' : '9407 1118 …'
}

/** One row per paper envelope that printed; email copies go out when the run records and have no row. */
export function runChecklistRows(envelopes: ReadonlyArray<Pick<RunEnvelope, 'n' | 'name' | 'address' | 'method' | 'tracking' | 'contents'>>, printed: boolean): RunChecklistRow[] {
  if (!printed) return []
  return envelopes
    .filter((e) => e.method !== 'email')
    .map((e) => {
      const lane = runLaneOf(e.method)
      return {
        n: e.n,
        name: e.name,
        address: e.address,
        inside: e.contents.map((c) => `${c.notice.jobNumber} ${c.recipient.key === 'owner' ? 'owner' : 'GC'}`).join(', '),
        lane,
        method: e.method,
        boxes: runChecklistBoxes(lane),
        placeholder: runChecklistPlaceholder(lane),
        tracking: e.tracking,
        done: recipientMailed({ method: e.method, tracking: e.tracking }),
      }
    })
}

/** "2 of 3 have their number" / "Every envelope has its number" / "" with no rows. */
export function runChecklistWords(rows: ReadonlyArray<Pick<RunChecklistRow, 'done'>>): string {
  if (rows.length === 0) return ''
  const done = rows.filter((r) => r.done).length
  if (done === rows.length) return rows.length === 1 ? 'The envelope has its number' : 'Every envelope has its number'
  return `${done} of ${rows.length} ${done === 1 ? 'has' : 'have'} ${rows.length === 1 ? 'its' : 'their'} number`
}
