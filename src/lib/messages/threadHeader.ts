/**
 * The thread's compact header (v2.6505): one shape at every height. v2.6474 folded the header on a short window alone,
 * and a tall desk kept six rows down the left with the right half of the header empty, about 290 px over the lines
 * (Grace, 2026-11-04). Now the header is three rows across the width wherever the column is wide: who they are, with
 * their first address and their first number on the company line; whose move it is with the stamps sentence; their
 * jobs. The rest of their numbers and addresses wait behind the arrow the company line already had. A narrow column
 * (cut 10's fold, `isThreadFolded`) stacks the same facts: the company line cut to one, every number and address
 * behind the arrow, the chips in a strip, the sentence on its own line, the jobs in a strip.
 */

/** A row the header draws, in order. The desk's `status` row carries the sentence; a narrow column gives it `stamps`. */
export type ThreadHeaderRow = 'who' | 'reach' | 'status' | 'stamps' | 'jobs'

export interface ThreadHeaderFacts {
  /** The header folds for a narrow column or a phone (`isThreadFolded`). */
  folded: boolean
  /** Their numbers and addresses, in the thread's order. */
  channels: readonly { kind: string }[]
  /** The arrow: pressed open, pressed shut, or never pressed. */
  reachChosen: boolean | null
  /** Nobody has named this number or address: the unnamed words and *Who is this?* take the company line. */
  unknown: boolean
  /** The stamps sentence has words. */
  stamps: boolean
}

export interface ThreadHeaderPlan {
  rows: readonly ThreadHeaderRow[]
  /** Indexes into `channels` that ride the company line: the first address, then the first number, at a desk. */
  onLine: readonly number[]
  /** How many wait behind the arrow. Zero draws no arrow. */
  behind: number
  /** The arrow is open, so the `reach` row draws what waits behind it. */
  reachOpen: boolean
  /** The sentence keeps to one line, cut with an ellipsis, the whole in its title: the desk's status row. */
  stampsOneLine: boolean
  /** The jobs run in one strip that scrolls sideways; else they wrap under their label. */
  jobsStrip: boolean
}

/** The first channel of each kind that rides the company line, the address before the number. */
function onLineOf(f: ThreadHeaderFacts): number[] {
  if (f.folded || f.unknown) return []
  const first = (kind: string) => f.channels.findIndex((ch) => ch.kind === kind)
  return [first('email'), first('phone')].filter((i) => i >= 0)
}

/** The header's rows and what waits behind the arrow, from the column's fold and the person's facts. */
export function threadHeaderPlan(f: ThreadHeaderFacts): ThreadHeaderPlan {
  const onLine = onLineOf(f)
  // An unnamed number or address asks *Who is this?* in place of the arrow: its one channel is in the unnamed words.
  const behind = f.unknown ? 0 : f.channels.length - onLine.length
  const reachOpen = behind > 0 && (f.reachChosen ?? false)
  const rows: ThreadHeaderRow[] = ['who']
  if (reachOpen) rows.push('reach')
  rows.push('status')
  if (f.folded && f.stamps) rows.push('stamps')
  rows.push('jobs')
  return { rows, onLine, behind, reachOpen, stampsOneLine: !f.folded, jobsStrip: f.folded }
}
