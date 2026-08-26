/**
 * Roadmap "Next up" shortlist (v2.2129): pick, don't sort.
 *
 * Stage numbers stay put (they're identity + the owner's priority) and the
 * arrows only decide ELIGIBILITY (a locked stage is simply not on the list).
 * "Smart" is a short shortlist with reasons — two lanes of at most `limit`
 * open tasks, every pick carrying the reasons it was chosen:
 *
 *   eligible = task open, stage unlocked and not complete
 *   order    = ★ pinned (v2.2140; oldest pin first — the owner's override,
 *              exempt from the per-stage cap)
 *            → closes a stage (≤ CLOSES_STAGE_LEFT tasks left in its stage;
 *              fewer first — the same threshold as the chip, so the first
 *              sort key IS the first reason)
 *            → unlocks the most (open tasks, then stages, behind the stage's
 *              arrows)
 *            → your stage order → task order
 *   lanes    = "ready to go" (has an assignee) / "needs a person" (none)
 *   cap      = at most `perStageCap` picks per stage per lane, so five picks
 *              never all come from one ten-task stage
 *
 * Lexicographic, not weighted — there are no hidden weights to argue with.
 * Raw "tasks left" is deliberately NOT a sort key beyond the threshold: it
 * would make a small no-consequence stage beat a big stage that unlocks four,
 * and leave "unlocks the most" deciding nothing.
 * Pure; the Plan view renders it and the task card handles staffing.
 */

/** A stage with this many (or fewer) open tasks is "closing" — finishing it unlocks its arrows. */
export const CLOSES_STAGE_LEFT = 2

import type { TechTreeEdge } from './checklistTechTreeGraph'

export type NextUpTask = {
  id: string
  group_id: string
  completed_at: string | null
  assigneeIds: ReadonlyArray<string>
  /** ★ pin (v2.2140): when set, the task leads its lane (oldest pin first) and is exempt from the per-stage cap. */
  pinned_at?: string | null
}

export type NextUpReason =
  | { kind: 'pinned' }
  | { kind: 'closes_stage'; stageNumber: number; left: number }
  | { kind: 'unlocks'; feeds: string; stages: number; tasks: number }
  | { kind: 'priority'; stageNumber: number }
  | { kind: 'first_step'; stageTitle: string }
  | { kind: 'in_motion' }

export type NextUpPick = {
  taskId: string
  groupId: string
  stageNumber: number
  /** In display priority order; views typically show the first two. */
  reasons: NextUpReason[]
}

export type NextUpLanes = {
  ready: NextUpPick[]
  needsName: NextUpPick[]
  /** Eligible open tasks per lane before the cap — for "· N open" labels. */
  openReady: number
  openNeedsName: number
}

type Downstream = { stages: number; tasks: number; feeds: string | null }

/** Transitive successors of each stage: how many stages, how many open tasks wait behind it, and its first direct successor's title. */
function downstreamByGroup(
  groups: ReadonlyArray<{ id: string; title: string }>,
  edges: ReadonlyArray<TechTreeEdge>,
  remainingByGroup: ReadonlyMap<string, number>,
): Map<string, Downstream> {
  const order = new Map(groups.map((g, i) => [g.id, i]))
  const title = new Map(groups.map((g) => [g.id, g.title]))
  const out = new Map<string, string[]>()
  for (const e of edges) {
    if (!order.has(e.fromGroupId) || !order.has(e.toGroupId)) continue
    out.set(e.fromGroupId, [...(out.get(e.fromGroupId) ?? []), e.toGroupId])
  }
  const result = new Map<string, Downstream>()
  for (const g of groups) {
    const seen = new Set<string>()
    const stack = [...(out.get(g.id) ?? [])]
    while (stack.length) {
      const n = stack.pop()!
      if (seen.has(n)) continue
      seen.add(n)
      for (const s of out.get(n) ?? []) stack.push(s)
    }
    let tasks = 0
    for (const id of seen) tasks += remainingByGroup.get(id) ?? 0
    const direct = [...(out.get(g.id) ?? [])].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
    result.set(g.id, { stages: seen.size, tasks, feeds: direct[0] ? (title.get(direct[0]) ?? null) : null })
  }
  return result
}

const DAY_MS = 24 * 60 * 60 * 1000

export function nextUpPicks(args: {
  /** Roadmap stage order (sort_index) — stage #N = position N. */
  groups: ReadonlyArray<{ id: string; title: string }>
  /** Tasks per stage in task order. */
  tasksByGroup: ReadonlyMap<string, ReadonlyArray<NextUpTask>>
  edges: ReadonlyArray<TechTreeEdge>
  unlockedIds: ReadonlySet<string>
  completeIds: ReadonlySet<string>
  now?: Date
  limit?: number
  perStageCap?: number
  /** A stage counts as "in motion" when a task in it completed within this many days. */
  motionDays?: number
}): NextUpLanes {
  const { groups, tasksByGroup, edges, unlockedIds, completeIds, limit = 5, perStageCap = 2, motionDays = 14 } = args
  const now = args.now ?? new Date()

  const remainingByGroup = new Map<string, number>()
  const doneByGroup = new Map<string, number>()
  const lastDoneByGroup = new Map<string, number>()
  for (const g of groups) {
    const tasks = tasksByGroup.get(g.id) ?? []
    let remaining = 0
    let done = 0
    let last = -Infinity
    for (const t of tasks) {
      if (t.completed_at == null) remaining += 1
      else {
        done += 1
        const ts = new Date(t.completed_at).getTime()
        if (Number.isFinite(ts)) last = Math.max(last, ts)
      }
    }
    remainingByGroup.set(g.id, remaining)
    doneByGroup.set(g.id, done)
    lastDoneByGroup.set(g.id, last)
  }
  const downstream = downstreamByGroup(groups, edges, remainingByGroup)

  type Candidate = {
    taskId: string
    groupId: string
    stageNumber: number
    staffed: boolean
    pinned: boolean
    /** [pinned? 0:1, pin time, closing? 0:1, tasks left if closing, -downstream open tasks, -downstream stages, stage #, task index] */
    key: [number, number, number, number, number, number, number, number]
    reasons: NextUpReason[]
  }
  const candidates: Candidate[] = []
  groups.forEach((g, gi) => {
    if (!unlockedIds.has(g.id) || completeIds.has(g.id)) return
    const tasks = tasksByGroup.get(g.id) ?? []
    const remaining = remainingByGroup.get(g.id) ?? 0
    if (remaining === 0) return
    const stageNumber = gi + 1
    const ds = downstream.get(g.id) ?? { stages: 0, tasks: 0, feeds: null }
    const firstOpenId = tasks.find((t) => t.completed_at == null)?.id ?? null
    const inMotion = (lastDoneByGroup.get(g.id) ?? -Infinity) >= now.getTime() - motionDays * DAY_MS
    const closing = remaining <= CLOSES_STAGE_LEFT
    tasks.forEach((t, ti) => {
      if (t.completed_at != null) return
      const reasons: NextUpReason[] = []
      const pinTs = t.pinned_at ? new Date(t.pinned_at).getTime() : NaN
      const pinned = Number.isFinite(pinTs)
      if (pinned) reasons.push({ kind: 'pinned' })
      if (closing) reasons.push({ kind: 'closes_stage', stageNumber, left: remaining })
      if (ds.stages > 0 && ds.feeds) reasons.push({ kind: 'unlocks', feeds: ds.feeds, stages: ds.stages, tasks: ds.tasks })
      if (stageNumber <= 3) reasons.push({ kind: 'priority', stageNumber })
      if ((doneByGroup.get(g.id) ?? 0) === 0 && t.id === firstOpenId) reasons.push({ kind: 'first_step', stageTitle: g.title })
      if (inMotion) reasons.push({ kind: 'in_motion' })
      candidates.push({
        taskId: t.id,
        groupId: g.id,
        stageNumber,
        staffed: t.assigneeIds.length > 0,
        pinned,
        key: [pinned ? 0 : 1, pinned ? pinTs : 0, closing ? 0 : 1, closing ? remaining : 0, -ds.tasks, -ds.stages, stageNumber, ti],
        reasons,
      })
    })
  })

  candidates.sort((a, b) => {
    for (let i = 0; i < a.key.length; i++) {
      const d = a.key[i]! - b.key[i]!
      if (d !== 0) return d
    }
    return 0
  })

  const take = (staffed: boolean): { picks: NextUpPick[]; open: number } => {
    const perStage = new Map<string, number>()
    const picks: NextUpPick[] = []
    let open = 0
    for (const c of candidates) {
      if (c.staffed !== staffed) continue
      open += 1
      if (picks.length >= limit) continue
      const used = perStage.get(c.groupId) ?? 0
      // a pin is the owner saying "this one, now" — it never loses its slot to the per-stage cap
      if (!c.pinned && used >= perStageCap) continue
      perStage.set(c.groupId, used + 1)
      picks.push({ taskId: c.taskId, groupId: c.groupId, stageNumber: c.stageNumber, reasons: c.reasons })
    }
    return { picks, open }
  }

  const ready = take(true)
  const needsName = take(false)
  return { ready: ready.picks, needsName: needsName.picks, openReady: ready.open, openNeedsName: needsName.open }
}

/** Short human label for a reason chip — one phrase, no trailing period. */
export function nextUpReasonLabel(r: NextUpReason): string {
  switch (r.kind) {
    case 'pinned':
      return '★ pinned'
    case 'closes_stage':
      return r.left === 1 ? `last task in stage ${r.stageNumber}` : `closes stage ${r.stageNumber} · ${r.left} left`
    case 'unlocks':
      return `feeds ${r.feeds} · ${r.stages} stage${r.stages === 1 ? '' : 's'} wait`
    case 'priority':
      return `your #${r.stageNumber}`
    case 'first_step':
      return `first step of “${r.stageTitle}”`
    case 'in_motion':
      return 'in motion'
  }
}
