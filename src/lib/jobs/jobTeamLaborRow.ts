import type { TeamLaborBreakdownEntry } from '../../utils/teamLabor'

/**
 * The Team labor row on the Job window's cost block (v2.3178).
 *
 * Owner ask (2026-09-08): a salaried tech's whole day sat in the Cost Timeline
 * (the 👷 marker) but nothing on the Job tab ever *named* the number — the
 * accordions above the chart list parts only. This kernel turns the per-job
 * team-labor breakdown (`fetchTeamLaborBreakdownForJob`, the same math as the
 * chart and Job Summary) into one row: total, hours, who, and — once costing
 * counts recorded time — how much of it still awaits approval.
 */

export type JobTeamLaborRowPerson = {
  personName: string
  hours: number
  cost: number
}

export type JobTeamLaborRowModel = {
  /** Sum of every person's allocated cost, dollars. */
  totalCost: number
  /** Sum of allocated hours. */
  totalHours: number
  /** People with any allocated hours, largest cost first. */
  people: JobTeamLaborRowPerson[]
  /** "8.0 h · Malachi" / "277.5 h · 7 people" — the row's sub-line. */
  summaryLabel: string
  /** Hours on this job that are closed but not yet approved (0 when unknown). */
  pendingHours: number
  /** "includes 8.0 h awaiting approval" or null. */
  pendingLabel: string | null
}

export function roundHoursLabel(hours: number): string {
  const r = Math.round(hours * 10) / 10
  return `${r.toFixed(1)} h`
}

export function buildJobTeamLaborRow(
  breakdown: readonly TeamLaborBreakdownEntry[],
  pendingHours = 0,
): JobTeamLaborRowModel {
  const people: JobTeamLaborRowPerson[] = breakdown
    .filter((b) => b.hours > 0 || b.cost > 0)
    .map((b) => ({ personName: b.personName, hours: b.hours, cost: b.cost }))
    .sort((a, b) => b.cost - a.cost || b.hours - a.hours || a.personName.localeCompare(b.personName))
  const totalCost = people.reduce((s, p) => s + p.cost, 0)
  const totalHours = people.reduce((s, p) => s + p.hours, 0)
  const who =
    people.length === 0 ? 'no one yet' : people.length === 1 ? people[0]!.personName : `${people.length} people`
  const summaryLabel = people.length === 0 ? 'no recorded time' : `${roundHoursLabel(totalHours)} · ${who}`
  const pending = Math.max(0, pendingHours)
  const pendingLabel = pending >= 0.05 ? `includes ${roundHoursLabel(pending)} awaiting approval` : null
  return { totalCost, totalHours, people, summaryLabel, pendingHours: pending, pendingLabel }
}

/**
 * Sum closed, not-rejected, not-revoked, not-yet-approved session hours — the
 * slice of recorded time a reviewer has not signed yet.
 */
export function pendingSessionHours(
  sessions: ReadonlyArray<{
    clocked_in_at: string
    clocked_out_at: string | null
    approved_at: string | null
    rejected_at: string | null
    revoked_at: string | null
  }>,
): number {
  let total = 0
  for (const s of sessions) {
    if (!s.clocked_out_at || s.approved_at || s.rejected_at || s.revoked_at) continue
    const ms = new Date(s.clocked_out_at).getTime() - new Date(s.clocked_in_at).getTime()
    if (Number.isFinite(ms) && ms > 0) total += ms / 36e5
  }
  return total
}
