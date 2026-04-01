export type DayEditorSession = {
  id: string
  clocked_in_at: string
  clocked_out_at: string | null
  work_date: string
  notes: string
  job_ledger_id: string | null
  bid_id: string | null
  approved_at: string | null
}

export const MIN_SEGMENT_MS = 0.01 * 3600 * 1000

/** Same ε as gap detection in the day timeline (ms). */
export const CLUSTER_CONTIGUITY_EPS_MS = 1000

/** UX snap radius when dragging/nudging a boundary toward original row joins (ms). */
export const ROW_JOIN_SNAP_MS = 60_000

/**
 * Original clock row join times inside a multi-session cluster (excludes strip start/end).
 * Use with snapBoundaryMs for My Time editor handles.
 */
export function internalRowJoinMs(c: DayEditorSession[], nowMs: number): number[] {
  const refs = clusterReferenceBoundaries(c, nowMs)
  if (refs.length < 3) return []
  return refs.slice(1, -1)
}

/** Snap ms to nearest join in `joinTargets` within radius, then clamp to [minSegAfterPrev, minSegBeforeNext]. */
export function snapBoundaryMs(
  ms: number,
  prevBound: number,
  nextBound: number,
  joinTargets: number[],
  snapRadiusMs: number
): number {
  const minMs = prevBound + MIN_SEGMENT_MS
  const maxMs = nextBound - MIN_SEGMENT_MS
  const clamped = Math.min(maxMs, Math.max(minMs, ms))
  let bestT: number | null = null
  let bestD = snapRadiusMs + 1
  for (const t of joinTargets) {
    const d = Math.abs(t - clamped)
    if (d <= snapRadiusMs && d < bestD) {
      bestD = d
      bestT = t
    }
  }
  if (bestT === null) return clamped
  return Math.min(maxMs, Math.max(minMs, bestT))
}

/** Strip tap: snap proposed split time to nearest row join if within radius (no segment min clamp). */
export function snapTapMsToNearestJoin(ms: number, joinTargets: number[], snapRadiusMs: number): number {
  let best: number | null = null
  let bestD = snapRadiusMs + 1
  for (const t of joinTargets) {
    const d = Math.abs(t - ms)
    if (d <= snapRadiusMs && d < bestD) {
      bestD = d
      best = t
    }
  }
  return best ?? ms
}

export function sameJobBid(a: DayEditorSession, b: DayEditorSession): boolean {
  return a.job_ledger_id === b.job_ledger_id && a.bid_id === b.bid_id
}

/**
 * Group consecutive sessions into contiguous blocks (same job/bid, next clock-in within ε of prev clock-out).
 * An open session (no clock-out) ends its cluster; nothing merges after it.
 */
export function groupContiguousSessionClusters(sortedSessions: DayEditorSession[]): DayEditorSession[][] {
  const clusters: DayEditorSession[][] = []
  for (const s of sortedSessions) {
    const cur = clusters[clusters.length - 1]
    const last = cur?.[cur.length - 1]
    if (last && last.clocked_out_at && sameJobBid(last, s)) {
      const lastEnd = new Date(last.clocked_out_at).getTime()
      const nextStart = new Date(s.clocked_in_at).getTime()
      if (nextStart <= lastEnd + CLUSTER_CONTIGUITY_EPS_MS) {
        cur.push(s)
        continue
      }
    }
    clusters.push([s])
  }
  return clusters
}

/**
 * Time-only contiguous clusters: merge when previous row is closed and next clock-in within ε of prev clock-out.
 * Ignores job/bid. An open session ends its cluster; nothing merges after it.
 */
export function groupTimeContiguousSessionClusters(sortedSessions: DayEditorSession[]): DayEditorSession[][] {
  const clusters: DayEditorSession[][] = []
  for (const s of sortedSessions) {
    const cur = clusters[clusters.length - 1]
    const last = cur?.[cur.length - 1]
    if (last && last.clocked_out_at) {
      const lastEnd = new Date(last.clocked_out_at).getTime()
      const nextStart = new Date(s.clocked_in_at).getTime()
      if (nextStart <= lastEnd + CLUSTER_CONTIGUITY_EPS_MS) {
        cur.push(s)
        continue
      }
    }
    clusters.push([s])
  }
  return clusters
}

/** Canonical boundary ms list for a cluster (matches `initialClusterSplitState`). */
export function clusterReferenceBoundaries(c: DayEditorSession[], nowMs: number): number[] {
  if (c.length === 0) return []
  if (c.length === 1) {
    const s = c[0]!
    const end = s.clocked_out_at ? new Date(s.clocked_out_at).getTime() : nowMs
    return [new Date(s.clocked_in_at).getTime(), end]
  }
  const boundaries: number[] = []
  boundaries.push(new Date(c[0]!.clocked_in_at).getTime())
  for (let i = 0; i < c.length - 1; i++) {
    const row = c[i]!
    const nextIn = new Date(c[i + 1]!.clocked_in_at).getTime()
    const out = row.clocked_out_at ? new Date(row.clocked_out_at).getTime() : nextIn
    boundaries.push(Math.max(out, nextIn))
  }
  const last = c[c.length - 1]!
  const lastEnd = last.clocked_out_at ? new Date(last.clocked_out_at).getTime() : nowMs
  boundaries.push(lastEnd)
  return boundaries
}

export function boundariesMatchOriginalRows(
  c: DayEditorSession[],
  split: SplitEditorState,
  nowMs: number,
  eps: number = CLUSTER_CONTIGUITY_EPS_MS
): boolean {
  const ref = clusterReferenceBoundaries(c, nowMs)
  if (split.boundaries.length !== ref.length) return false
  for (let i = 0; i < ref.length; i++) {
    if (Math.abs(split.boundaries[i]! - ref[i]!) > eps) return false
  }
  return true
}

export function clusterIsHomogeneousJobBid(c: DayEditorSession[]): boolean {
  if (c.length <= 1) return true
  const first = c[0]!
  return c.every((s) => sameJobBid(first, s))
}

/** Inclusive row interval in ms (open end uses nowMs). */
export function sessionRowIntervalMs(s: DayEditorSession, nowMs: number): { lo: number; hi: number } {
  const lo = new Date(s.clocked_in_at).getTime()
  const hi = s.clocked_out_at ? new Date(s.clocked_out_at).getTime() : nowMs
  return { lo, hi }
}

/** True if [segLo, segHi] is fully inside [rowLo, rowHi] (modulo ε). */
export function segmentContainedInRow(
  segLo: number,
  segHi: number,
  rowLo: number,
  rowHi: number,
  eps: number = CLUSTER_CONTIGUITY_EPS_MS
): boolean {
  return segLo >= rowLo - eps && segHi <= rowHi + eps
}

/** Stable key for editor state (chronological session ids). */
export function sessionClusterId(sessions: DayEditorSession[]): string {
  return sessions.map((x) => x.id).join('|')
}

export type TimelineGap = { type: 'gap'; startMs: number; endMs: number }
export type TimelineSessionClusterBlock = {
  type: 'sessionCluster'
  clusterId: string
  sessions: DayEditorSession[]
  startMs: number
  endMs: number
}
export type DayTimelineItem = TimelineGap | TimelineSessionClusterBlock

/** Gaps between clusters + one block per time-contiguous session strip (any job/bid). */
export function buildDayTimeline(sortedSessions: DayEditorSession[], nowMs: number): DayTimelineItem[] {
  const clusters = groupTimeContiguousSessionClusters(sortedSessions)
  const items: DayTimelineItem[] = []
  for (let i = 0; i < clusters.length; i++) {
    const c = clusters[i]!
    const first = c[0]!
    const last = c[c.length - 1]!
    const startMs = new Date(first.clocked_in_at).getTime()
    const endMs = last.clocked_out_at ? new Date(last.clocked_out_at).getTime() : nowMs
    if (i > 0) {
      const prev = clusters[i - 1]!
      const prevLast = prev[prev.length - 1]!
      const prevEnd = prevLast.clocked_out_at ? new Date(prevLast.clocked_out_at).getTime() : nowMs
      if (startMs > prevEnd + CLUSTER_CONTIGUITY_EPS_MS) {
        items.push({ type: 'gap', startMs: prevEnd, endMs: startMs })
      }
    }
    items.push({
      type: 'sessionCluster',
      clusterId: sessionClusterId(c),
      sessions: c,
      startMs,
      endMs,
    })
  }
  return items
}

export function daySpanMs(sortedSessions: DayEditorSession[], nowMs: number): { dayStartMs: number; dayEndMs: number } {
  if (sortedSessions.length === 0) return { dayStartMs: 0, dayEndMs: 1 }
  let lo = Infinity
  let hi = 0
  for (const s of sortedSessions) {
    const a = new Date(s.clocked_in_at).getTime()
    const b = s.clocked_out_at ? new Date(s.clocked_out_at).getTime() : nowMs
    lo = Math.min(lo, a)
    hi = Math.max(hi, b)
  }
  return { dayStartMs: lo, dayEndMs: Math.max(hi, lo + 1) }
}

/** User-chosen job/bid for a segment (overrides overlap inference until Save). */
export type SegmentJobOverride = {
  job_ledger_id: string | null
  bid_id: string | null
}

export type SplitEditorState = {
  boundaries: number[]
  notes: string[]
  /** Per-segment index; cleared on inner-boundary drag/nudge (v1). */
  segmentJobOverrides?: Partial<Record<number, SegmentJobOverride>>
}

export function cloneSplitState(split: SplitEditorState): SplitEditorState {
  const ov = split.segmentJobOverrides
  return {
    boundaries: [...split.boundaries],
    notes: [...split.notes],
    ...(ov && Object.keys(ov).length > 0 ? { segmentJobOverrides: { ...ov } } : {}),
  }
}

function pruneOverrides(o: Partial<Record<number, SegmentJobOverride>> | undefined) {
  if (!o) return undefined
  const next: Partial<Record<number, SegmentJobOverride>> = {}
  for (const [k, v] of Object.entries(o)) {
    const j = Number(k)
    if (Number.isFinite(j) && v != null) next[j] = v
  }
  return Object.keys(next).length > 0 ? next : undefined
}

/** Split segment `segIndex` into two; new segment at `segIndex + 1`. Shift override keys `j > segIndex`. */
function remapOverridesAfterSplitAtSegment(
  overrides: Partial<Record<number, SegmentJobOverride>> | undefined,
  segIndex: number
): Partial<Record<number, SegmentJobOverride>> | undefined {
  if (!overrides) return undefined
  const next: Partial<Record<number, SegmentJobOverride>> = {}
  for (const [keyStr, v] of Object.entries(overrides)) {
    const j = Number(keyStr)
    if (!Number.isFinite(j) || v == null) continue
    if (j <= segIndex) next[j] = v
    else next[j + 1] = v
  }
  return pruneOverrides(next)
}

/** Merge segments k-1 and k into k-1. */
function remapOverridesMergePrev(
  overrides: Partial<Record<number, SegmentJobOverride>> | undefined,
  k: number
): Partial<Record<number, SegmentJobOverride>> | undefined {
  if (!overrides) return undefined
  const next: Partial<Record<number, SegmentJobOverride>> = {}
  for (const [keyStr, v] of Object.entries(overrides)) {
    const j = Number(keyStr)
    if (!Number.isFinite(j) || v == null) continue
    if (j === k - 1 || j === k) continue
    if (j < k - 1) next[j] = v
    else next[j - 1] = v
  }
  return pruneOverrides(next)
}

/** Merge segments k and k+1 into k. */
function remapOverridesMergeNext(
  overrides: Partial<Record<number, SegmentJobOverride>> | undefined,
  k: number
): Partial<Record<number, SegmentJobOverride>> | undefined {
  if (!overrides) return undefined
  const next: Partial<Record<number, SegmentJobOverride>> = {}
  for (const [keyStr, v] of Object.entries(overrides)) {
    const j = Number(keyStr)
    if (!Number.isFinite(j) || v == null) continue
    if (j === k || j === k + 1) continue
    if (j < k) next[j] = v
    else next[j - 1] = v
  }
  return pruneOverrides(next)
}

export type SplitAction =
  | { type: 'init'; session: DayEditorSession; nowMs: number }
  | { type: 'setLastBoundary'; nowMs: number }
  | { type: 'drag'; index: number; ms: number }
  | { type: 'addSplit'; minSegmentMs: number }
  | { type: 'addSplitAt'; ms: number; epsilonMs?: number }
  | { type: 'addSplitMidInSegment'; segIndex: number; joinTargets: number[] }
  | { type: 'nudge'; index: number; deltaMs: number }
  | { type: 'setNote'; index: number; text: string }
  | {
      type: 'removeSegmentMergeWithPrev'
      segIndex: number
      /** Same clock as My Time strip (`nowTick`) for open-last duration checks. */
      nowMs: number
      /** True when cluster last session has no clock-out (matches `buildPayloads` last segment). */
      openLastCluster: boolean
    }
  | {
      type: 'removeSegmentMergeWithNext'
      segIndex: number
      nowMs: number
      openLastCluster: boolean
    }
  | {
      type: 'setSegmentJobOverride'
      segIndex: number
      job_ledger_id: string | null
      bid_id: string | null
    }

/** Split focus-note text into paragraphs (double-newline separated); trims each chunk. */
function focusNoteParagraphs(s: string): string[] {
  const parts = s.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length > 0)
  if (parts.length > 0) return parts
  const t = s.trim()
  return t.length > 0 ? [t] : []
}

/**
 * Merge removed segment note into absorber (absorber first, then removed).
 * Trims duplicate paragraphs (exact string match after trim); whole note equal → single copy.
 */
export function mergeSegmentNotes(absorber: string, removed: string): string {
  const a = absorber.trim()
  const b = removed.trim()
  if (!b) return absorber
  if (!a) return removed
  if (a === b) return a

  const ap = focusNoteParagraphs(absorber)
  const bp = focusNoteParagraphs(removed)
  if (ap.length === 0) return removed
  if (bp.length === 0) return absorber

  const seen = new Set<string>()
  const out: string[] = []
  for (const p of ap) {
    if (seen.has(p)) continue
    seen.add(p)
    out.push(p)
  }
  for (const p of bp) {
    if (seen.has(p)) continue
    seen.add(p)
    out.push(p)
  }
  return out.join('\n\n')
}

function segmentIntervalsMeetMinMs(
  boundaries: number[],
  nowMs: number,
  openLastCluster: boolean
): boolean {
  const nSeg = boundaries.length - 1
  if (nSeg < 1) return false
  for (let i = 0; i < nSeg; i++) {
    const lo = boundaries[i]!
    const hi = boundaries[i + 1]!
    const isLastSeg = i === nSeg - 1
    if (openLastCluster && isLastSeg) {
      if (nowMs - lo < MIN_SEGMENT_MS) return false
    } else if (hi - lo < MIN_SEGMENT_MS) {
      return false
    }
  }
  return true
}

/** One segment by default; user adds splits via strip tap or Form Split / addSplitAt. */
export function initialSplitState(session: DayEditorSession, nowMs: number): SplitEditorState {
  const inMs = new Date(session.clocked_in_at).getTime()
  const outMs = session.clocked_out_at ? new Date(session.clocked_out_at).getTime() : nowMs
  const n0 = session.notes?.trim() || ''
  return {
    boundaries: [inMs, outMs],
    notes: [n0],
  }
}

/**
 * Initial split state for a merged cluster: boundaries at each row boundary and segment notes from each row.
 * Single-session clusters use initialSplitState.
 */
export function initialClusterSplitState(sessions: DayEditorSession[], nowMs: number): SplitEditorState {
  if (sessions.length === 0) return { boundaries: [], notes: [] }
  if (sessions.length === 1) return initialSplitState(sessions[0]!, nowMs)

  const boundaries: number[] = []
  const notes: string[] = []
  boundaries.push(new Date(sessions[0]!.clocked_in_at).getTime())
  for (let i = 0; i < sessions.length - 1; i++) {
    const row = sessions[i]!
    const nextIn = new Date(sessions[i + 1]!.clocked_in_at).getTime()
    const out = row.clocked_out_at ? new Date(row.clocked_out_at).getTime() : nextIn
    boundaries.push(Math.max(out, nextIn))
    notes.push(row.notes?.trim() || '')
  }
  const last = sessions[sessions.length - 1]!
  const lastEnd = last.clocked_out_at ? new Date(last.clocked_out_at).getTime() : nowMs
  boundaries.push(lastEnd)
  notes.push(last.notes?.trim() || '')
  return { boundaries, notes }
}

export function splitReducer(state: SplitEditorState, action: SplitAction): SplitEditorState {
  switch (action.type) {
    case 'init':
      return initialSplitState(action.session, action.nowMs)
    case 'setLastBoundary': {
      if (state.boundaries.length < 2) return state
      const next = [...state.boundaries]
      next[next.length - 1] = action.nowMs
      return { ...state, boundaries: next }
    }
    case 'drag': {
      const { index, ms } = action
      const next = [...state.boundaries]
      const minMs = next[index - 1]! + MIN_SEGMENT_MS
      const maxMs = next[index + 1]! - MIN_SEGMENT_MS
      const clamped = Math.min(maxMs, Math.max(minMs, ms))
      next[index] = clamped
      // v1: inner-boundary moves invalidate job overrides (indices / overlap change).
      return { ...state, boundaries: next, segmentJobOverrides: undefined }
    }
    case 'nudge': {
      const { index, deltaMs } = action
      const next = [...state.boundaries]
      const ms = next[index]! + deltaMs
      const minMs = next[index - 1]! + MIN_SEGMENT_MS
      const maxMs = next[index + 1]! - MIN_SEGMENT_MS
      const clamped = Math.min(maxMs, Math.max(minMs, ms))
      next[index] = clamped
      return { ...state, boundaries: next, segmentJobOverrides: undefined }
    }
    case 'addSplit': {
      const { boundaries, notes } = state
      let bestI = 0
      let bestLen = 0
      for (let i = 0; i < boundaries.length - 1; i++) {
        const len = boundaries[i + 1]! - boundaries[i]!
        if (len > bestLen) {
          bestLen = len
          bestI = i
        }
      }
      if (bestLen < 2 * action.minSegmentMs) return state
      const mid = boundaries[bestI]! + bestLen / 2
      const newBounds = [...boundaries.slice(0, bestI + 1), mid, ...boundaries.slice(bestI + 1)]
      const newNotes = [...notes.slice(0, bestI + 1), notes[bestI]!, ...notes.slice(bestI + 1)]
      const newOv = remapOverridesAfterSplitAtSegment(state.segmentJobOverrides, bestI)
      return { ...state, boundaries: newBounds, notes: newNotes, segmentJobOverrides: newOv }
    }
    case 'addSplitAt': {
      const eps = action.epsilonMs ?? 1000
      const { ms } = action
      const { boundaries, notes } = state
      for (let i = 0; i < boundaries.length - 1; i++) {
        const lo = boundaries[i]!
        const hi = boundaries[i + 1]!
        if (ms <= lo + eps || ms >= hi - eps) continue
        if (hi - lo < 2 * MIN_SEGMENT_MS) continue
        if (ms - lo < MIN_SEGMENT_MS || hi - ms < MIN_SEGMENT_MS) continue
        const newBounds = [...boundaries.slice(0, i + 1), ms, ...boundaries.slice(i + 1)]
        const newNotes = [...notes.slice(0, i + 1), notes[i]!, ...notes.slice(i + 1)]
        const newOv = remapOverridesAfterSplitAtSegment(state.segmentJobOverrides, i)
        return { ...state, boundaries: newBounds, notes: newNotes, segmentJobOverrides: newOv }
      }
      return state
    }
    case 'addSplitMidInSegment': {
      const { segIndex, joinTargets } = action
      const { boundaries, notes } = state
      if (boundaries.length < 2 || segIndex < 0 || segIndex > boundaries.length - 2) return state
      const lo = boundaries[segIndex]!
      const hi = boundaries[segIndex + 1]!
      if (hi - lo < 2 * MIN_SEGMENT_MS) return state
      let ms = lo + (hi - lo) / 2
      if (joinTargets.length > 0) {
        ms = snapTapMsToNearestJoin(ms, joinTargets, ROW_JOIN_SNAP_MS)
      }
      const minMs = lo + MIN_SEGMENT_MS
      const maxMs = hi - MIN_SEGMENT_MS
      ms = Math.min(maxMs, Math.max(minMs, ms))
      if (ms - lo < MIN_SEGMENT_MS || hi - ms < MIN_SEGMENT_MS) return state
      const newBounds = [...boundaries.slice(0, segIndex + 1), ms, ...boundaries.slice(segIndex + 1)]
      const newNotes = [...notes.slice(0, segIndex + 1), notes[segIndex]!, ...notes.slice(segIndex + 1)]
      const newOv = remapOverridesAfterSplitAtSegment(state.segmentJobOverrides, segIndex)
      return { ...state, boundaries: newBounds, notes: newNotes, segmentJobOverrides: newOv }
    }
    case 'setNote': {
      const next = [...state.notes]
      next[action.index] = action.text
      return { ...state, notes: next }
    }
    case 'removeSegmentMergeWithPrev': {
      const k = action.segIndex
      const { boundaries, notes } = state
      if (boundaries.length < 3 || k < 1 || k >= notes.length) return state
      const nextBounds = [...boundaries.slice(0, k), ...boundaries.slice(k + 1)]
      // Allow collapsing to a single segment (2 boundaries). Former guard `nextBounds.length < 3`
      // blocked the common "split once → merge back" case while Merge UI still showed.
      if (nextBounds.length < 2) return state
      const nextNotes = [
        ...notes.slice(0, k - 1),
        mergeSegmentNotes(notes[k - 1]!, notes[k]!),
        ...notes.slice(k + 1),
      ]
      if (!segmentIntervalsMeetMinMs(nextBounds, action.nowMs, action.openLastCluster)) return state
      const newOv = remapOverridesMergePrev(state.segmentJobOverrides, k)
      return { ...state, boundaries: nextBounds, notes: nextNotes, segmentJobOverrides: newOv }
    }
    case 'removeSegmentMergeWithNext': {
      const k = action.segIndex
      const { boundaries, notes } = state
      if (boundaries.length < 3 || k < 0 || k >= notes.length - 1) return state
      const nextBounds = [...boundaries.slice(0, k + 1), ...boundaries.slice(k + 2)]
      if (nextBounds.length < 2) return state
      const nextNotes = [
        ...notes.slice(0, k),
        mergeSegmentNotes(notes[k + 1]!, notes[k]!),
        ...notes.slice(k + 2),
      ]
      if (!segmentIntervalsMeetMinMs(nextBounds, action.nowMs, action.openLastCluster)) return state
      const newOv = remapOverridesMergeNext(state.segmentJobOverrides, k)
      return { ...state, boundaries: nextBounds, notes: nextNotes, segmentJobOverrides: newOv }
    }
    case 'setSegmentJobOverride': {
      const { segIndex, job_ledger_id, bid_id } = action
      const nSeg = state.boundaries.length - 1
      if (segIndex < 0 || segIndex >= nSeg) return state
      const prev = state.segmentJobOverrides ?? {}
      return {
        ...state,
        segmentJobOverrides: { ...prev, [segIndex]: { job_ledger_id, bid_id } },
      }
    }
    default:
      return state
  }
}
