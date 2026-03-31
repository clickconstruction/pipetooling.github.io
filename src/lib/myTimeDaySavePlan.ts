import type { SplitClockSegmentPayload } from './splitOwnClockSessionSegments'
import {
  boundariesMatchOriginalRows,
  CLUSTER_CONTIGUITY_EPS_MS,
  sameJobBid,
  sessionRowIntervalMs,
  segmentContainedInRow,
  type DayEditorSession,
  type SplitEditorState,
} from './myTimeDayTimeline'

/** True when editor segments are not yet 1:1 with DB row boundaries; per-segment job assign must persist first. */
export function assignJobNeedsPersistedSplits(
  c: DayEditorSession[],
  split: SplitEditorState,
  nowMs: number
): boolean {
  if (split.boundaries.length <= 2) return false
  if (boundariesMatchOriginalRows(c, split, nowMs)) return false
  return true
}

const TIME_TIE_MS = 1

export const NO_JOB_BID_LINKED_LABEL = 'No job or bid linked'

/** True when merge should open job-choice modal (distinct allocations; not both trivially unassigned). */
export function mergeAllocChoiceRequired(a: string[], b: string[]): boolean {
  const onlyNoJob =
    a.length > 0 &&
    b.length > 0 &&
    a.every((x) => x === NO_JOB_BID_LINKED_LABEL) &&
    b.every((x) => x === NO_JOB_BID_LINKED_LABEL)
  if (onlyNoJob) return false
  const key = (xs: string[]) => [...xs].sort().join('\u0001')
  return key(a) !== key(b)
}

/** Effective job/bid for a segment (editor override wins). */
export function effectiveSegmentJobBid(
  c: DayEditorSession[],
  split: SplitEditorState,
  nowMs: number,
  segIdx: number
): { job_ledger_id: string | null; bid_id: string | null } {
  const o = split.segmentJobOverrides?.[segIdx]
  if (o) return { job_ledger_id: o.job_ledger_id, bid_id: o.bid_id }
  const aligned =
    boundariesMatchOriginalRows(c, split, nowMs) &&
    split.boundaries.length - 1 === c.length &&
    segIdx < c.length
  if (aligned) {
    const row = c[segIdx]!
    return { job_ledger_id: row.job_ledger_id, bid_id: row.bid_id }
  }
  const segLo = split.boundaries[segIdx]!
  const segHi = split.boundaries[segIdx + 1]!
  return allocationForSegmentInterval(c, nowMs, segLo, segHi)
}

export function isRowUnassigned(s: Pick<DayEditorSession, 'job_ledger_id' | 'bid_id'>): boolean {
  return !s.job_ledger_id && !s.bid_id
}

/** Clock session ids with no job/bid that overlap this segment (for assign UI). */
export function unassignedSessionIdsOverlappingSegment(
  c: DayEditorSession[],
  split: SplitEditorState,
  nowMs: number,
  segIdx: number
): string[] {
  const aligned =
    boundariesMatchOriginalRows(c, split, nowMs) &&
    split.boundaries.length - 1 === c.length &&
    segIdx < c.length
  if (aligned) {
    const row = c[segIdx]!
    return isRowUnassigned(row) ? [row.id] : []
  }
  const segLo = split.boundaries[segIdx]!
  const segHi = split.boundaries[segIdx + 1]!
  const ids: string[] = []
  const seen = new Set<string>()
  for (const s of c) {
    const { lo, hi } = sessionRowIntervalMs(s, nowMs)
    const ov = Math.min(segHi, hi) - Math.max(segLo, lo)
    if (ov <= TIME_TIE_MS || !isRowUnassigned(s) || seen.has(s.id)) continue
    seen.add(s.id)
    ids.push(s.id)
  }
  return ids
}

/**
 * Clock row to target for AssignSessionJobPopover when a segment shows a single job/bid allocation.
 * Matches allocation logic used for segment labels and save payloads.
 */
export function clockSessionRowForSegmentAssign(
  c: DayEditorSession[],
  split: SplitEditorState,
  nowMs: number,
  segIdx: number
): DayEditorSession | null {
  if (c.length === 0) return null
  const aligned =
    boundariesMatchOriginalRows(c, split, nowMs) &&
    split.boundaries.length - 1 === c.length &&
    segIdx < c.length
  if (aligned) return c[segIdx] ?? null

  const segLo = split.boundaries[segIdx]!
  const segHi = split.boundaries[segIdx + 1]!
  const alloc = allocationForSegmentInterval(c, nowMs, segLo, segHi)
  let best: DayEditorSession | null = null
  let bestOv = -1
  for (const s of c) {
    if (s.job_ledger_id !== alloc.job_ledger_id || s.bid_id !== alloc.bid_id) continue
    const { lo, hi } = sessionRowIntervalMs(s, nowMs)
    const ov = Math.min(segHi, hi) - Math.max(segLo, lo)
    if (ov > TIME_TIE_MS && ov > bestOv) {
      bestOv = ov
      best = s
    }
  }
  return best
}

export function labelForSession(
  s: DayEditorSession,
  jobLabels: Record<string, string>,
  bidLabels: Record<string, string>
): string | null {
  if (s.job_ledger_id && jobLabels[s.job_ledger_id]) return jobLabels[s.job_ledger_id]!
  if (s.bid_id && bidLabels[s.bid_id]) return bidLabels[s.bid_id]!
  if (s.job_ledger_id) return `Job ${s.job_ledger_id.slice(0, 8)}…`
  if (s.bid_id) return `Bid ${s.bid_id.slice(0, 8)}…`
  return null
}

/** Per-segment allocation for save payloads / labels when boundaries are not 1:1 with rows. */
export function allocationForSegmentInterval(
  c: DayEditorSession[],
  nowMs: number,
  segLo: number,
  segHi: number
): { job_ledger_id: string | null; bid_id: string | null } {
  type Sc = { s: DayEditorSession; ov: number }
  const scored: Sc[] = []
  for (const s of c) {
    const { lo, hi } = sessionRowIntervalMs(s, nowMs)
    const ov = Math.min(segHi, hi) - Math.max(segLo, lo)
    if (ov > TIME_TIE_MS) scored.push({ s, ov })
  }
  if (scored.length === 0) {
    const mid = (segLo + segHi) / 2
    for (const s of c) {
      const { lo, hi } = sessionRowIntervalMs(s, nowMs)
      if (mid >= lo - CLUSTER_CONTIGUITY_EPS_MS && mid <= hi + CLUSTER_CONTIGUITY_EPS_MS) {
        return { job_ledger_id: s.job_ledger_id, bid_id: s.bid_id }
      }
    }
    const first = c[0]!
    return { job_ledger_id: first.job_ledger_id, bid_id: first.bid_id }
  }
  scored.sort((a, b) => b.ov - a.ov || a.s.clocked_in_at.localeCompare(b.s.clocked_in_at))
  const s = scored[0]!.s
  return { job_ledger_id: s.job_ledger_id, bid_id: s.bid_id }
}

export function segmentAllocationLabel(
  c: DayEditorSession[],
  split: SplitEditorState,
  nowMs: number,
  segIdx: number,
  jobLabels: Record<string, string>,
  bidLabels: Record<string, string>
): string {
  const aligned =
    boundariesMatchOriginalRows(c, split, nowMs) &&
    split.boundaries.length - 1 === c.length &&
    segIdx < c.length
  if (aligned) {
    return labelForSession(c[segIdx]!, jobLabels, bidLabels) ?? NO_JOB_BID_LINKED_LABEL
  }
  const segLo = split.boundaries[segIdx]!
  const segHi = split.boundaries[segIdx + 1]!
  const allocKeys = new Set<string>()
  for (const s of c) {
    const { lo, hi } = sessionRowIntervalMs(s, nowMs)
    const ov = Math.min(segHi, hi) - Math.max(segLo, lo)
    if (ov > TIME_TIE_MS) {
      allocKeys.add(`${s.job_ledger_id ?? ''}\0${s.bid_id ?? ''}`)
    }
  }
  if (allocKeys.size > 1) return 'Mixed allocation'
  const alloc = allocationForSegmentInterval(c, nowMs, segLo, segHi)
  const pseudo: DayEditorSession = {
    id: '',
    clocked_in_at: '',
    clocked_out_at: null,
    work_date: '',
    notes: '',
    job_ledger_id: alloc.job_ledger_id,
    bid_id: alloc.bid_id,
    approved_at: null,
  }
  return labelForSession(pseudo, jobLabels, bidLabels) ?? NO_JOB_BID_LINKED_LABEL
}

/**
 * Distinct allocation labels for a segment, in session order, when overlapping multiple clock rows.
 * Single-element when aligned 1:1 with rows or only one allocation overlaps.
 */
export function segmentAllocationLabelsForOverlap(
  c: DayEditorSession[],
  split: SplitEditorState,
  nowMs: number,
  segIdx: number,
  jobLabels: Record<string, string>,
  bidLabels: Record<string, string>
): string[] {
  const override = split.segmentJobOverrides?.[segIdx]
  if (override) {
    const pseudo: DayEditorSession = {
      id: '',
      clocked_in_at: '',
      clocked_out_at: null,
      work_date: '',
      notes: '',
      job_ledger_id: override.job_ledger_id,
      bid_id: override.bid_id,
      approved_at: null,
    }
    return [labelForSession(pseudo, jobLabels, bidLabels) ?? NO_JOB_BID_LINKED_LABEL]
  }
  const aligned =
    boundariesMatchOriginalRows(c, split, nowMs) &&
    split.boundaries.length - 1 === c.length &&
    segIdx < c.length
  if (aligned) {
    return [labelForSession(c[segIdx]!, jobLabels, bidLabels) ?? NO_JOB_BID_LINKED_LABEL]
  }
  const segLo = split.boundaries[segIdx]!
  const segHi = split.boundaries[segIdx + 1]!
  const seen = new Set<string>()
  const labels: string[] = []
  for (const s of c) {
    const { lo, hi } = sessionRowIntervalMs(s, nowMs)
    const ov = Math.min(segHi, hi) - Math.max(segLo, lo)
    if (ov <= TIME_TIE_MS) continue
    const key = `${s.job_ledger_id ?? ''}\0${s.bid_id ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    labels.push(labelForSession(s, jobLabels, bidLabels) ?? NO_JOB_BID_LINKED_LABEL)
  }
  if (labels.length > 0) return labels
  const alloc = allocationForSegmentInterval(c, nowMs, segLo, segHi)
  const pseudo: DayEditorSession = {
    id: '',
    clocked_in_at: '',
    clocked_out_at: null,
    work_date: '',
    notes: '',
    job_ledger_id: alloc.job_ledger_id,
    bid_id: alloc.bid_id,
    approved_at: null,
  }
  return [labelForSession(pseudo, jobLabels, bidLabels) ?? NO_JOB_BID_LINKED_LABEL]
}

/** Strip aria label when cluster has multiple distinct allocations among rows. */
export function clusterHasMultipleAllocations(c: DayEditorSession[]): boolean {
  if (c.length <= 1) return false
  const first = c[0]!
  return c.some((s) => !sameJobBid(s, first))
}

export function attachAllocationsToPayloads(
  base: SplitClockSegmentPayload[],
  c: DayEditorSession[],
  split: SplitEditorState,
  nowMs: number
): SplitClockSegmentPayload[] {
  const aligned =
    boundariesMatchOriginalRows(c, split, nowMs) && base.length === c.length && split.notes.length === c.length
  return base.map((p, i) => {
    const o = split.segmentJobOverrides?.[i]
    if (o) {
      return { ...p, job_ledger_id: o.job_ledger_id, bid_id: o.bid_id }
    }
    if (aligned && i < c.length) {
      const row = c[i]!
      return {
        ...p,
        job_ledger_id: row.job_ledger_id,
        bid_id: row.bid_id,
      }
    }
    const segLo = split.boundaries[i]!
    const segHi = split.boundaries[i + 1]!
    const a = allocationForSegmentInterval(c, nowMs, segLo, segHi)
    return { ...p, job_ledger_id: a.job_ledger_id, bid_id: a.bid_id }
  })
}

export function everySegmentFullyInsideSomeRow(
  c: DayEditorSession[],
  split: SplitEditorState,
  nowMs: number,
  eps: number = CLUSTER_CONTIGUITY_EPS_MS
): boolean {
  const n = split.boundaries.length - 1
  for (let i = 0; i < n; i++) {
    const segLo = split.boundaries[i]!
    const segHi = split.boundaries[i + 1]!
    let ok = false
    for (const s of c) {
      const { lo, hi } = sessionRowIntervalMs(s, nowMs)
      if (segmentContainedInRow(segLo, segHi, lo, hi, eps)) {
        ok = true
        break
      }
    }
    if (!ok) return false
  }
  return true
}
