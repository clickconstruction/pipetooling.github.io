/**
 * Subs on the dispatch board (v2.2929): the Schedule → Dispatch hub reads sub
 * work orders beside its own blocks. A sub is a person, not a user, so nothing
 * here writes a schedule block — the order's dates ARE the schedule.
 *
 *  - a PICK (picked_start/end) is definite: it lands in the Subs lanes, badges
 *    the crew assigned to that job, and lists on the day view and the crew
 *    day email;
 *  - a WINDOW (the stage's span, else the order's proposed span) with no pick
 *    is a maybe: it shows only on the Subs lanes, striped, dashed while the
 *    offer is still out.
 * Pure.
 */
import { hubPersonDayKey } from '../scheduleDispatchHub'

export type SubDispatchOrder = {
  id: string
  personId: string
  personName: string
  jobId: string | null
  /** "#1004 · 2210 Goforth Rd" — whatever the caller can name the job. */
  jobLabel: string
  status: string
  pickedStart: string | null
  pickedEnd: string | null
  proposedStart: string | null
  proposedEnd: string | null
  windowStart: string | null
  windowEnd: string | null
  /** The stage's line-item name when the order fulfils one. */
  stageName: string | null
  recordId: string | null
}

export type SubDispatchSpan = { start: string; end: string; kind: 'pick' | 'window' | 'offered' }

const YMD = /^\d{4}-\d{2}-\d{2}$/
const span = (a: string | null | undefined, b: string | null | undefined): { start: string; end: string } | null => {
  const s = (a ?? '').trim(), e = (b ?? '').trim() || s
  return YMD.test(s) && YMD.test(e) && e >= s ? { start: s, end: e } : null
}

const LIVE = new Set(['offered', 'accepted', 'approved'])

/** Where the order sits in time, and how sure we are. Null = nothing dated, or a closed order. */
export function subDispatchSpan(o: SubDispatchOrder): SubDispatchSpan | null {
  if (!LIVE.has(o.status)) return null
  const pick = span(o.pickedStart, o.pickedEnd)
  if (pick && o.status !== 'offered') return { ...pick, kind: 'pick' }
  const win = span(o.windowStart, o.windowEnd) ?? span(o.proposedStart, o.proposedEnd)
  if (!win) return null
  return { ...win, kind: o.status === 'offered' ? 'offered' : 'window' }
}

export function subDispatchLabel(o: SubDispatchOrder): string {
  return o.stageName ? `${o.stageName} · ${o.jobLabel}` : o.jobLabel
}

export type SubLaneItem = { orderId: string; jobId: string | null; label: string; kind: SubDispatchSpan['kind']; title: string }
export type SubLane = { personId: string; name: string; cells: Map<string, SubLaneItem[]>; total: number }

/** One lane per sub with something dated inside `dayKeys`; sorted by name. */
export function buildSubLanes(orders: SubDispatchOrder[], dayKeys: readonly string[]): SubLane[] {
  const lanes = new Map<string, SubLane>()
  for (const o of orders) {
    const sp = subDispatchSpan(o)
    if (!sp) continue
    const days = dayKeys.filter((d) => d >= sp.start && d <= sp.end)
    if (days.length === 0) continue
    let lane = lanes.get(o.personId)
    if (!lane) {
      lane = { personId: o.personId, name: o.personName, cells: new Map(), total: 0 }
      lanes.set(o.personId, lane)
    }
    const label = subDispatchLabel(o)
    const item: SubLaneItem = { orderId: o.id, jobId: o.jobId, label, kind: sp.kind, title: `${o.personName} — ${label} · ${sp.start} → ${sp.end}${sp.kind === 'pick' ? ' · picked' : sp.kind === 'offered' ? ' · offer out, not answered' : ' · window, no pick yet'}` }
    for (const d of days) {
      const list = lane.cells.get(d) ?? []
      list.push(item)
      lane.cells.set(d, list)
    }
    lane.total += 1
  }
  return [...lanes.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export type SubBadge = { count: number; titles: string[] }

/**
 * "sub" badges for crew cells: a crew member assigned to a job (team member)
 * sees a badge on every day a sub is DEFINITELY on that job. Windows never badge.
 */
export function buildSubBadgesByCell(orders: SubDispatchOrder[], teamByJobId: ReadonlyMap<string, readonly string[]>, dayKeys: readonly string[]): Map<string, SubBadge> {
  const out = new Map<string, SubBadge>()
  for (const o of orders) {
    const sp = subDispatchSpan(o)
    if (!sp || sp.kind !== 'pick' || !o.jobId) continue
    const users = teamByJobId.get(o.jobId) ?? []
    if (users.length === 0) continue
    const title = subDispatchLabel(o).replace(o.jobLabel, o.jobLabel) + ` · ${o.personName}`
    for (const d of dayKeys) {
      if (d < sp.start || d > sp.end) continue
      for (const u of users) {
        const key = hubPersonDayKey(u, d)
        const b = out.get(key) ?? { count: 0, titles: [] }
        b.count += 1
        b.titles.push(title)
        out.set(key, b)
      }
    }
  }
  return out
}

export type SubsOnDayItem = { orderId: string; jobId: string | null; personName: string; label: string; span: SubDispatchSpan }

/** The subs on site (picks) and the maybes (windows) for one day, picks first. */
export function subsOnDay(orders: SubDispatchOrder[], dayKey: string): { definite: SubsOnDayItem[]; maybe: SubsOnDayItem[] } {
  const definite: SubsOnDayItem[] = [], maybe: SubsOnDayItem[] = []
  for (const o of orders) {
    const sp = subDispatchSpan(o)
    if (!sp || dayKey < sp.start || dayKey > sp.end) continue
    const item = { orderId: o.id, jobId: o.jobId, personName: o.personName, label: subDispatchLabel(o), span: sp }
    ;(sp.kind === 'pick' ? definite : maybe).push(item)
  }
  const byName = (a: SubsOnDayItem, b: SubsOnDayItem) => a.personName.localeCompare(b.personName) || a.label.localeCompare(b.label)
  return { definite: definite.sort(byName), maybe: maybe.sort(byName) }
}

/** Does the order touch the range at all? (the fetch's client-side filter) */
export function subOrderTouchesRange(o: SubDispatchOrder, startYmd: string, endYmd: string): boolean {
  const sp = subDispatchSpan(o)
  return !!sp && sp.start <= endYmd && sp.end >= startYmd
}

/** Every YMD from `start` to `end` inclusive (the hub's week columns). */
export function dayKeysBetween(start: string, end: string): string[] {
  if (!YMD.test(start) || !YMD.test(end) || end < start) return []
  const out: string[] = []
  const d = new Date(start + 'T00:00:00Z')
  for (let k = start; k <= end; ) {
    out.push(k)
    d.setUTCDate(d.getUTCDate() + 1)
    k = d.toISOString().slice(0, 10)
  }
  return out
}
