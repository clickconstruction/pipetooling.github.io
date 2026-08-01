/**
 * Sub Board lane math (RUN_SUBS_PLAN Phase 4, PR 4.5). Pure: takes work-order
 * commitments (with their dates) and a visible window, returns one lane per
 * sub with positioned bars and overlap flags — "who's booked when, and where
 * am I about to double-book someone."
 *
 * A bar's dates are the STEP's expected dates when set (the accept flow
 * maintains them), else the offer's proposed window. Undated commitments
 * don't bar (counted so the UI can say so). Offered-but-unanswered bars are
 * ghosts; any two bars in a lane whose ranges intersect both flag overlap.
 */

export type SubBoardCommitmentInput = {
  id: string
  person_id: string
  display_name: string
  status: string
  amount: number
  proposed_start: string | null
  proposed_end: string | null
  stepStart: string | null
  stepEnd: string | null
  stepName: string | null
  projectName: string | null
  projectId: string | null
}

export type SubBoardBar = {
  commitmentId: string
  label: string
  title: string
  startYmd: string
  endYmd: string
  ghost: boolean
  overlapping: boolean
  /** Percent geometry within the window (clamped). */
  startPct: number
  widthPct: number
  projectId: string | null
}

export type SubBoardLane = { key: string; name: string; bars: SubBoardBar[] }

export type SubBoardResult = {
  lanes: SubBoardLane[]
  undatedCount: number
}

const BAR_STATUSES = new Set(['offered', 'accepted', 'approved'])

function dayIndex(ymd: string): number | null {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return null
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000)
}

export function buildSubBoardLanes(
  commitments: SubBoardCommitmentInput[],
  windowStartYmd: string,
  windowEndYmd: string,
): SubBoardResult {
  const winStart = dayIndex(windowStartYmd)
  const winEnd = dayIndex(windowEndYmd)
  if (winStart == null || winEnd == null || winEnd <= winStart) return { lanes: [], undatedCount: 0 }
  const winDays = winEnd - winStart + 1

  const laneMap = new Map<string, SubBoardLane>()
  let undatedCount = 0

  for (const c of commitments) {
    if (!BAR_STATUSES.has(c.status)) continue
    const startYmd = c.stepStart ?? c.proposed_start
    const endYmd = c.stepEnd ?? c.proposed_end ?? startYmd
    const effStart = startYmd ?? endYmd
    if (!effStart || !endYmd) {
      undatedCount += 1
      continue
    }
    const s = dayIndex(effStart)
    const e = dayIndex(endYmd)
    if (s == null || e == null) {
      undatedCount += 1
      continue
    }
    const end = Math.max(s, e)
    if (end < winStart || s > winEnd) continue

    const clampedStart = Math.max(s, winStart)
    const clampedEnd = Math.min(end, winEnd)
    const label = c.projectName ? `${c.stepName ?? 'Step'} @ ${c.projectName}` : c.stepName ?? 'Step'
    const bar: SubBoardBar = {
      commitmentId: c.id,
      label,
      title: `${c.display_name} — ${label} (${effStart} → ${endYmd})${c.status === 'offered' ? ' · awaiting answer' : ''}`,
      startYmd: effStart,
      endYmd,
      ghost: c.status === 'offered',
      overlapping: false,
      startPct: ((clampedStart - winStart) / winDays) * 100,
      widthPct: Math.max(((clampedEnd - clampedStart + 1) / winDays) * 100, 1.5),
      projectId: c.projectId,
    }
    const key = c.person_id
    const lane = laneMap.get(key) ?? { key, name: c.display_name, bars: [] }
    lane.bars.push(bar)
    laneMap.set(key, lane)
  }

  for (const lane of laneMap.values()) {
    lane.bars.sort((a, b) => a.startYmd.localeCompare(b.startYmd))
    for (let i = 0; i < lane.bars.length; i++) {
      for (let j = i + 1; j < lane.bars.length; j++) {
        const a = lane.bars[i]!
        const b = lane.bars[j]!
        if (a.startYmd <= b.endYmd && b.startYmd <= a.endYmd) {
          a.overlapping = true
          b.overlapping = true
        }
      }
    }
  }

  return {
    lanes: [...laneMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
    undatedCount,
  }
}
