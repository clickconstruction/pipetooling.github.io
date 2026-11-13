/**
 * The Lien desk's header on a phone (punch list #352, PR 1): one row with the way back, the title and **More**.
 *
 * Until this the phone header was the computer's, wrapped: the run, § Rules, the caller, the help key, Share and
 * *An owner asked for records* took four rows of presses 20 to 30 px tall, above the work, and *Put a GC on notice*
 * a fifth on Notices. On a phone they are rows
 * of one sheet, each a thumb tall, in the order below. The run comes first because it is the only one of them that
 * is work waiting; the More button wears its count so a run that is waiting is never out of sight.
 */

export type LienDeskMoreKey = 'run' | 'gc_notice' | 'rules' | 'caller' | 'legend' | 'share' | 'owner_records'

export type LienDeskMoreRow = {
  key: LienDeskMoreKey
  /** The door's own name, the one it has on a computer. */
  label: string
  /** What it opens, in a few words, under the name. */
  hint: string
  /** The run's count; null on every other row. */
  count: number | null
  /** The run is the sheet's one filled press. */
  primary: boolean
}

export type LienDeskMoreInput = {
  /** The run door as the header draws it on a computer: its words and its count. Null when nothing waits or the viewer cannot run. */
  run: { label: string; count: number; hint: string } | null
  /** Notices is open, the viewer is in the office and a GC has unpaid work to put on notice. */
  gcNotice: boolean
  /** The help key's own name on this desk (`LIEN_DESK_LEGEND.label`). */
  legendLabel: string
  /** Office seats get the caller's script. */
  caller: boolean
  /** The desk has its data, so there is something to share. */
  share: boolean
  /** The viewer may answer an owner's request for records. */
  ownerRecords: boolean
}

export function lienDeskMoreRows(input: LienDeskMoreInput): LienDeskMoreRow[] {
  const rows: LienDeskMoreRow[] = []
  const run = input.run && input.run.count > 0 ? input.run : null
  if (run) rows.push({ key: 'run', label: run.label, hint: run.hint, count: run.count, primary: true })
  if (input.gcNotice) rows.push({ key: 'gc_notice', label: 'Put a GC on notice…', hint: 'Every owner on every job with a failing GC, in one approved run', count: null, primary: false })
  rows.push({ key: 'rules', label: '§ Rules', hint: 'The Texas lien rules the app follows', count: null, primary: false })
  if (input.caller) rows.push({ key: 'caller', label: 'An owner is calling', hint: 'What to say, filled with the job', count: null, primary: false })
  rows.push({ key: 'legend', label: input.legendLabel, hint: 'Each part of the desk, in a line', count: null, primary: false })
  if (input.share) rows.push({ key: 'share', label: 'Share where the liens stand', hint: 'Who we are about to lien, for how much, and by when', count: null, primary: false })
  if (input.ownerRecords) rows.push({ key: 'owner_records', label: 'An owner asked for records', hint: 'What we billed and what was paid on their property', count: null, primary: false })
  return rows
}

/** The More button: its name for a screen reader, and the count it wears when a run waits. */
export function lienDeskMoreButton(run: { label: string; count: number } | null): { label: string; badge: number | null } {
  if (!run || run.count <= 0) return { label: 'More', badge: null }
  return { label: `More · ${run.label} · ${run.count}`, badge: run.count }
}
