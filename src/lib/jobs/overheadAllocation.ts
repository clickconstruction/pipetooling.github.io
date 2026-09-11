import type { JobDayLedger, JobDayLedgerDay, JobOverheadDayLine, JobOverheadShare } from './jobDayLedger'
import { ymdToDayNumber } from './jobRunningTimeline'

/**
 * Overhead allocation (v2.3258): how each day's office pool lands on jobs.
 *
 * Three constants, owner-approved 2026-09-10 after the Overhead Dials study on
 * the real 12-month ledger:
 *
 *  - `smoothDays` (N): each day's pool is shared by the FIELD HOURS worked over
 *    the following N days (the activity slice) and by the OPEN-JOB counts over
 *    those days (the carry slice). Spreading over hours, not over calendar
 *    days, is what keeps a one-hour Saturday from receiving a full day's pool.
 *  - `carryShare` (α): the slice of the pool open jobs carry equally per day
 *    just for being open. The rest follows field hours.
 *  - `idleCapDays`: an open job stops carrying after this many days with no
 *    field time (a fresh job gets the same grace from its start).
 *
 * At 1 day · 0% · no cap this reproduces the original day-share to the cent.
 * Whatever the settings, the pool reconciles exactly: pool in the window +
 * carried in from before = charged by hours + charged as carry + nobody to
 * charge + in flight past the window's end.
 *
 * Pure. The ledger's optional `leadDays` (the days before the window, loaded
 * so a spread that began before the window lands correctly) are consumed here
 * and nowhere else.
 */
export type OverheadOpenDefinition = 'status' | 'worked'

export type OverheadAllocationSettings = {
  /** 1–60. 1 = each day's pool lands on that day only. */
  smoothDays: number
  /** 0–1. Share of the pool open jobs carry equally per day. */
  carryShare: number
  /** Days with no field time before an open job stops carrying; null = never. */
  idleCapDays: number | null
  /** What "open" means for carry: the Working → Billed status span, or first → last field day. */
  openDef: OverheadOpenDefinition
}

/** Exactly the pre-v2.3258 day-share. The app default until a dev sets one. */
export const OVERHEAD_ALLOCATION_LEGACY: OverheadAllocationSettings = { smoothDays: 1, carryShare: 0, idleCapDays: null, openDef: 'status' }
/** The Overhead Dials recommendation (2026-09-10). */
export const OVERHEAD_ALLOCATION_RECOMMENDED: OverheadAllocationSettings = { smoothDays: 30, carryShare: 0.2, idleCapDays: 14, openDef: 'status' }
export const OVERHEAD_SMOOTH_DAYS_MAX = 60
/**
 * The first day office cost exists in the ledger (verified against the live pool 2026-09-10:
 * $31 of office parts on Feb 19, office labor from March). A per-job overhead window has
 * nothing to find before it. Move it earlier only if office history is backfilled.
 */
export const OVERHEAD_POOL_FIRST_YMD = '2026-02-19'
/** Days loaded before a ledger window so the spread has its lead-in; equals the slider's ceiling. */
export const JOB_DAY_LEDGER_LEAD_DAYS = OVERHEAD_SMOOTH_DAYS_MAX
export const OVERHEAD_IDLE_CAP_OPTIONS: ReadonlyArray<{ key: number | null; label: string; title: string }> = [
  { key: null, label: 'none', title: 'An open job carries every day until it is billed' },
  { key: 7, label: '7d', title: 'Stops carrying after 7 days with no field time' },
  { key: 14, label: '14d', title: 'Stops carrying after 14 days with no field time' },
  { key: 30, label: '30d', title: 'Stops carrying after 30 days with no field time' },
]
export const OVERHEAD_OPEN_DEFINITIONS: ReadonlyArray<{ key: OverheadOpenDefinition; label: string; title: string }> = [
  { key: 'status', label: 'Working → Billed', title: 'Open from the Working status move (or the first field day) to the Billed or Paid move' },
  { key: 'worked', label: 'first → last work', title: 'Open from the first approved field day to the last (to today while still open)' },
]

const clampInt = (v: unknown, lo: number, hi: number, dflt: number): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  if (!Number.isFinite(n)) return dflt
  return Math.min(hi, Math.max(lo, Math.round(n)))
}

/** Parse any stored or user-supplied shape into valid settings; anything unreadable falls back field by field to legacy. */
export function normalizeOverheadAllocationSettings(raw: unknown): OverheadAllocationSettings {
  let o: Record<string, unknown> = {}
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') o = parsed as Record<string, unknown>
    } catch {
      o = {}
    }
  } else if (raw && typeof raw === 'object') o = raw as Record<string, unknown>
  const carryRaw = typeof o.carryShare === 'number' ? o.carryShare : typeof o.carryShare === 'string' ? Number(o.carryShare) : NaN
  const carryShare = Number.isFinite(carryRaw) ? Math.min(1, Math.max(0, Math.round(carryRaw * 100) / 100)) : OVERHEAD_ALLOCATION_LEGACY.carryShare
  const idle = o.idleCapDays
  return {
    smoothDays: clampInt(o.smoothDays, 1, OVERHEAD_SMOOTH_DAYS_MAX, OVERHEAD_ALLOCATION_LEGACY.smoothDays),
    carryShare,
    idleCapDays: idle == null || idle === '' ? null : clampInt(idle, 1, 365, 14),
    openDef: o.openDef === 'worked' ? 'worked' : 'status',
  }
}

export function overheadAllocationSettingsEqual(a: OverheadAllocationSettings, b: OverheadAllocationSettings): boolean {
  return a.smoothDays === b.smoothDays && a.carryShare === b.carryShare && a.idleCapDays === b.idleCapDays && a.openDef === b.openDef
}

export function isLegacyOverheadAllocation(s: OverheadAllocationSettings): boolean {
  return overheadAllocationSettingsEqual(s, OVERHEAD_ALLOCATION_LEGACY)
}

/** "1 day · no carry" · "30 days · 20% carry · 14-day idle cap". */
export function overheadAllocationLabel(s: OverheadAllocationSettings): string {
  const parts = [s.smoothDays === 1 ? '1 day' : `${s.smoothDays} days`, s.carryShare > 0 ? `${Math.round(s.carryShare * 100)}% carry` : 'no carry']
  if (s.carryShare > 0 && s.idleCapDays != null) parts.push(`${s.idleCapDays}-day idle cap`)
  return parts.join(' · ')
}

export function overheadAllocationSettingsKey(s: OverheadAllocationSettings): string {
  return `${s.smoothDays}|${s.carryShare}|${s.idleCapDays ?? ''}|${s.openDef}`
}

export type OverheadAllocationDay = {
  ymd: string
  /** What the office spent that day (the ledger's pool). */
  rawPoolUsd: number
  /** What landed on that day's jobs after the spread: activity + carry. */
  landedUsd: number
  activityUsd: number
  carryUsd: number
  /** Landed dollars with nobody to charge that day. */
  unallocatedUsd: number
  fieldHours: number
  workedJobs: number
  openJobs: number
  /** Activity $ per field hour that day (0 when no field hours). */
  activityPerHourUsd: number
  /** Carry $ per open job that day (0 when no open jobs). */
  carryPerOpenJobUsd: number
  /** Per job: what it received that day. */
  byJob: Map<string, { hours: number; activityUsd: number; carryUsd: number }>
}

export type OverheadAllocationJob = JobOverheadShare & {
  carryUsd: number
  activityUsd: number
  /** Days in the window the job was charged carry for being open. */
  openDays: number
}

export type OverheadAllocationTotals = {
  poolUsd: number
  chargedUsd: number
  activityUsd: number
  carryUsd: number
  unallocatedUsd: number
  unallocatedDays: number
  /** Pool from window days that spreads past the window's end (lands as days arrive). */
  inFlightUsd: number
  /** Pool from before the window that landed inside it. */
  carriedInUsd: number
}

export type OverheadAllocation = {
  settings: OverheadAllocationSettings
  days: OverheadAllocationDay[]
  dayByYmd: Map<string, OverheadAllocationDay>
  perJob: Map<string, OverheadAllocationJob>
  totals: OverheadAllocationTotals
}

type JobOpenSpan = { startN: number; endN: number; workN: number[] }

const isFinished = (status: string | null | undefined): boolean => status === 'billed' || status === 'paid'

/** Per job: when it counts as open under each definition, plus its sorted field days (lead + window). */
function buildOpenSpans(ledger: JobDayLedger, allDays: readonly JobDayLedgerDay[], endN: number, openDef: OverheadOpenDefinition): Map<string, JobOpenSpan> {
  const workByJob = new Map<string, number[]>()
  for (const d of allDays) {
    const n = ymdToDayNumber(d.ymd)
    for (const [id, jd] of d.byJob) if (jd.hours > 0) (workByJob.get(id) ?? workByJob.set(id, []).get(id)!).push(n)
  }
  const out = new Map<string, JobOpenSpan>()
  for (const [id, workN] of workByJob) {
    workN.sort((a, b) => a - b)
    const firstN = workN[0]!
    const lastN = workN[workN.length - 1]!
    const status = ledger.jobLabels.get(id)?.status
    const span = ledger.statusSpansByJob.get(id)
    const spanEndN = span?.endYmd ? ymdToDayNumber(span.endYmd) : null
    let startN: number
    let end: number
    if (openDef === 'worked') {
      startN = firstN
      end = isFinished(status) || spanEndN != null ? lastN : endN
    } else {
      const spanStartN = span ? ymdToDayNumber(span.startYmd) : null
      startN = spanStartN == null ? firstN : Math.min(spanStartN, firstN)
      end = spanEndN != null ? Math.max(spanEndN, lastN) : isFinished(status) ? lastN : endN
    }
    out.set(id, { startN, endN: end, workN })
  }
  return out
}

function lastWorkOnOrBefore(workN: readonly number[], n: number): number {
  let lo = 0
  let hi = workN.length - 1
  let ans = -1
  while (lo <= hi) {
    const m = (lo + hi) >> 1
    if (workN[m]! <= n) {
      ans = workN[m]!
      lo = m + 1
    } else hi = m - 1
  }
  return ans
}

function isOpenOn(span: JobOpenSpan, n: number, idleCapDays: number | null): boolean {
  if (n < span.startN || n > span.endN) return false
  if (idleCapDays == null) return true
  const lw = lastWorkOnOrBefore(span.workN, n)
  const sinceWork = lw < 0 ? Number.POSITIVE_INFINITY : n - lw
  return sinceWork <= idleCapDays || n - span.startN <= idleCapDays
}

const cache = new WeakMap<JobDayLedger, Map<string, OverheadAllocation>>()

/** Memoized per ledger + settings: enrich calls this once per row, so the spread must not rerun 400 times. */
export function buildOverheadAllocation(ledger: JobDayLedger, settings: OverheadAllocationSettings = OVERHEAD_ALLOCATION_LEGACY): OverheadAllocation {
  const key = overheadAllocationSettingsKey(settings)
  let byKey = cache.get(ledger)
  if (!byKey) {
    byKey = new Map()
    cache.set(ledger, byKey)
  }
  const hit = byKey.get(key)
  if (hit) return hit
  const built = computeOverheadAllocation(ledger, settings)
  byKey.set(key, built)
  return built
}

function computeOverheadAllocation(ledger: JobDayLedger, settings: OverheadAllocationSettings): OverheadAllocation {
  const N = Math.max(1, Math.round(settings.smoothDays))
  const carryShare = Math.min(1, Math.max(0, settings.carryShare))
  const lead = ledger.leadDays ?? []
  const all: JobDayLedgerDay[] = [...lead, ...ledger.days]
  const n = all.length
  const iS = lead.length
  const iE = n - 1
  const endN = ledger.days.length > 0 ? ymdToDayNumber(ledger.endYmd) : 0
  const spans = buildOpenSpans(ledger, all, endN, settings.openDef)
  const dayN = all.map((d) => ymdToDayNumber(d.ymd))
  const hoursByIdx = all.map((d) => d.fieldHours)
  const openIdsByIdx: string[][] = all.map((_, i) => {
    const ids: string[] = []
    for (const [id, span] of spans) if (isOpenOn(span, dayN[i]!, settings.idleCapDays)) ids.push(id)
    return ids
  })
  const openCount = openIdsByIdx.map((ids) => ids.length)

  // Spread every source day's pool over its window, weighted by hours (activity) and open counts (carry).
  const landedAct = new Array<number>(n).fill(0)
  const landedCarry = new Array<number>(n).fill(0)
  let inFlightUsd = 0
  let carriedInUsd = 0
  let unallocatedAtSource = 0
  /** Window days whose pool found nobody to charge, at the source or after landing. */
  const unallocatedDayIdx = new Set<number>()
  const inWin = (t: number) => t >= iS && t <= iE
  for (let i = 0; i < n; i++) {
    const P = all[i]!.poolUsd
    if (!(P > 0)) continue
    const srcIn = inWin(i)
    const lo = i
    const hi = i + N - 1
    let H = 0
    let O = 0
    let outside = 0
    for (let t = lo; t <= hi; t++) {
      if (t >= n) outside += 1
      else {
        H += hoursByIdx[t]!
        O += openCount[t]!
      }
    }
    // The part of the window past the data's end cannot see its hours: it leaves evenly and lands when those days load.
    const past = P * (outside / N)
    if (srcIn) inFlightUsd += past
    const Pin = P - past
    let a = Pin * (1 - carryShare)
    let c = Pin * carryShare
    // No takers on one side hands that slice to the other. Activity only becomes carry when carry is switched on;
    // at 0% carry an open job is never charged, which is what keeps 1 day · 0% identical to the original day-share.
    if (H <= 0 && O > 0 && carryShare > 0) {
      c += a
      a = 0
    }
    if (O <= 0 && H > 0) {
      a += c
      c = 0
    }
    if (H <= 0 && a > 0) {
      if (srcIn) {
        unallocatedAtSource += a
        unallocatedDayIdx.add(i)
      }
      a = 0
    }
    if (O <= 0 && c > 0) {
      if (srcIn) {
        unallocatedAtSource += c
        unallocatedDayIdx.add(i)
      }
      c = 0
    }
    for (let t = lo; t <= Math.min(n - 1, hi); t++) {
      let share = 0
      if (a > 0 && hoursByIdx[t]! > 0) {
        const s = (a * hoursByIdx[t]!) / H
        landedAct[t]! += s
        share += s
      }
      if (c > 0 && openCount[t]! > 0) {
        const s = (c * openCount[t]!) / O
        landedCarry[t]! += s
        share += s
      }
      if (share > 0 && !srcIn && inWin(t)) carriedInUsd += share
    }
  }

  // Land each window day's dollars on its jobs.
  const perJob = new Map<string, OverheadAllocationJob>()
  const jobRec = (id: string): OverheadAllocationJob => {
    let r = perJob.get(id)
    if (!r) {
      r = { overheadUsd: 0, lines: [], hoursInWindow: 0, daysInWindow: 0, carryUsd: 0, activityUsd: 0, openDays: 0 }
      perJob.set(id, r)
    }
    return r
  }
  const days: OverheadAllocationDay[] = []
  const dayByYmd = new Map<string, OverheadAllocationDay>()
  const totals: OverheadAllocationTotals = { poolUsd: 0, chargedUsd: 0, activityUsd: 0, carryUsd: 0, unallocatedUsd: unallocatedAtSource, unallocatedDays: 0, inFlightUsd, carriedInUsd }
  for (let i = iS; i <= iE; i++) {
    const d = all[i]!
    totals.poolUsd += d.poolUsd
    const worked: Array<[string, number]> = []
    let fieldHours = 0
    for (const [id, jd] of d.byJob) {
      if (!(jd.hours > 0)) continue
      worked.push([id, jd.hours])
      fieldHours += jd.hours
    }
    const open = openIdsByIdx[i]!
    let carry = landedCarry[i]!
    let act = landedAct[i]!
    if (open.length === 0 && worked.length > 0) {
      act += carry
      carry = 0
    }
    if (worked.length === 0 && open.length > 0 && carryShare > 0) {
      carry += act
      act = 0
    }
    const carryEach = open.length > 0 ? carry / open.length : 0
    const actPerHour = fieldHours > 0 ? act / fieldHours : 0
    const byJob = new Map<string, { hours: number; activityUsd: number; carryUsd: number }>()
    let chargedCarry = 0
    let chargedAct = 0
    if (open.length > 0 && carryEach > 0) {
      for (const id of open) {
        byJob.set(id, { hours: 0, activityUsd: 0, carryUsd: carryEach })
        chargedCarry += carryEach
      }
    }
    if (fieldHours > 0 && actPerHour > 0) {
      for (const [id, h] of worked) {
        const e = byJob.get(id) ?? { hours: 0, activityUsd: 0, carryUsd: 0 }
        e.hours = h
        e.activityUsd += actPerHour * h
        byJob.set(id, e)
        chargedAct += actPerHour * h
      }
    } else if (fieldHours > 0) {
      // Zero dollars landed but the job still worked that day: keep its hours on the record.
      for (const [id, h] of worked) {
        const e = byJob.get(id) ?? { hours: 0, activityUsd: 0, carryUsd: 0 }
        e.hours = h
        byJob.set(id, e)
      }
    }
    const landed = act + carry
    const charged = chargedAct + chargedCarry
    const unallocated = Math.max(0, landed - charged)
    if (unallocated > 1e-6) {
      totals.unallocatedUsd += unallocated
      unallocatedDayIdx.add(i)
    }
    totals.chargedUsd += charged
    totals.activityUsd += chargedAct
    totals.carryUsd += chargedCarry
    for (const [id, e] of byJob) {
      const r = jobRec(id)
      const line: JobOverheadDayLine = { ymd: d.ymd, jobHours: e.hours, fieldHours, poolUsd: landed, shareUsd: e.activityUsd + e.carryUsd, activityUsd: e.activityUsd, carryUsd: e.carryUsd, openJobs: open.length }
      r.lines.push(line)
      r.overheadUsd += line.shareUsd
      r.activityUsd += e.activityUsd
      r.carryUsd += e.carryUsd
      if (e.hours > 0) {
        r.hoursInWindow += e.hours
        r.daysInWindow += 1
      }
      if (e.carryUsd > 0) r.openDays += 1
    }
    const row: OverheadAllocationDay = { ymd: d.ymd, rawPoolUsd: d.poolUsd, landedUsd: landed, activityUsd: act, carryUsd: carry, unallocatedUsd: unallocated, fieldHours, workedJobs: worked.length, openJobs: open.length, activityPerHourUsd: actPerHour, carryPerOpenJobUsd: carryEach, byJob }
    days.push(row)
    dayByYmd.set(d.ymd, row)
  }
  totals.unallocatedDays = unallocatedDayIdx.size
  return { settings, days, dayByYmd, perJob, totals }
}

const EMPTY_SHARE: OverheadAllocationJob = { overheadUsd: 0, lines: [], hoursInWindow: 0, daysInWindow: 0, carryUsd: 0, activityUsd: 0, openDays: 0 }

/** One job's share under the settings (empty when the job has nothing in the window). */
export function jobOverheadAllocation(ledger: JobDayLedger, jobId: string, settings: OverheadAllocationSettings = OVERHEAD_ALLOCATION_LEGACY): OverheadAllocationJob {
  return buildOverheadAllocation(ledger, settings).perJob.get(jobId) ?? EMPTY_SHARE
}

/** The reconciliation the toolbar shows: it must tie to the cent under every setting. */
export function overheadAllocationReconciles(t: OverheadAllocationTotals, toleranceUsd = 0.01): boolean {
  return Math.abs(t.poolUsd + t.carriedInUsd - (t.chargedUsd + t.unallocatedUsd + t.inFlightUsd)) <= toleranceUsd
}

