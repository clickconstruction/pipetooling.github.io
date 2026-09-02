/**
 * Summary line for the Dashboard My Inbox "Waiting For" footer strip (v2.2650):
 * a task count plus a one-line peek at the first blocker so the collapsed strip
 * says something useful — `after "get measurment of foam thi…" — Robert`.
 */

export type WaitingForStripGroup = {
  blockerTitle: string
  blockerNames: string[]
  tasks: ReadonlyArray<unknown>
}

export type WaitingForStripSummary = {
  /** Total waiting tasks across all groups (the pill number). */
  count: number
  /** `after "<clipped blocker>" — <names or "not staffed yet">` for the first group. */
  peek: string
}

const BLOCKER_CLIP_CHARS = 44

export function clipWaitingForBlockerTitle(title: string, max = BLOCKER_CLIP_CHARS): string {
  const t = title.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max).trimEnd()}…`
}

export function buildWaitingForStripSummary(groups: ReadonlyArray<WaitingForStripGroup>): WaitingForStripSummary | null {
  if (groups.length === 0) return null
  const count = groups.reduce((n, g) => n + g.tasks.length, 0)
  const first = groups[0]
  if (!first) return null
  const who = first.blockerNames.length > 0 ? first.blockerNames.join(', ') : 'not staffed yet'
  return { count, peek: `after "${clipWaitingForBlockerTitle(first.blockerTitle)}" — ${who}` }
}
