// Shared types for the Team Review union dataset.
//
// `TeamReviewUnion` is the team-wide dataset fetched once by
// `loadTeamReviewUnion()` in the People Review tab and then sliced
// per-person by the pure `derivePersonTeamSummary()` kernel. These were
// previously declared inline inside `People.tsx`; they're relocated here
// so both the component (which builds the union) and the lib kernel
// (which consumes it) can share one definition.

import type {
  CrewJobAssignment,
  CrewBidAssignment,
  CrewJobRow,
} from '../../utils/teamLabor'

export type TeamLedgerRow = { id: string; hcp_number: string; job_name: string; job_address: string; revenue: number | null; pct_complete: number | null; service_type_id: string | null }
export type TeamLaborItem = { count: number; hrs_per_unit: number; is_fixed: boolean }
export type TeamPeriodLaborRow = { id: string; job_date: string | null; address: string; job_number: string | null; labor_rate: number | null; distance_miles: number | null; assigned_to_name: string | null }
export type TeamReviewUnion = {
  periodLaborRows: TeamPeriodLaborRow[]
  periodCrewRows: Array<{ work_date: string; person_name: string; job_assignments: CrewJobAssignment[] }>
  /**
   * Period bid crew rows, used **only** by the Hours-breakdown modal so it
   * can show days where someone clocked into a bid as `(pct) B{n} | Project`
   * instead of "No crew assignment". Revenue / profit math intentionally
   * stays job-only — bid hours are already counted in the overhead pool.
   */
  periodCrewBidRows: Array<{ work_date: string; person_name: string; bid_assignments: CrewBidAssignment[] }>
  periodHoursRows: Array<{ person_name: string; work_date: string; hours: number }>
  mileageCost: number
  timePerMile: number
  jobsById: Map<string, TeamLedgerRow>
  /** Bid id -> display fields, used by the Hours-breakdown modal only. */
  bidsById: Map<string, { bid_number: string; project_name: string; address: string }>
  jobIdByHcp: Map<string, string>
  laborItemsByJobId: Map<string, TeamLaborItem[]>
  laborCostByHcp: Map<string, number>
  teamLaborCostByJobId: Map<string, number>
  partsCostByJobId: Map<string, number>
  invoiceAmountByJob: Record<string, number>
  billedMaterialsByJobId: Map<string, number>
  hoursMap: Record<string, number>
  crewByDatePerson: Record<string, CrewJobRow>
  overheadHoursByPerson: Record<string, { office: number; bid: number }>
  /** `${personName}:${work_date}` -> approved office+bid clock hours that day. */
  overheadHoursByPersonByDate: Record<string, number>
  /**
   * Per-person, period-only approved office + bid clock sessions, used by
   * the Overhead-hours-breakdown modal to render Office / Bids sections
   * hierarchically (Day -> indented session lines). Bid `bid_id` is
   * resolved against `bidsById` at render time inside
   * `derivePersonTeamSummary`.
   */
  overheadSessionsByPerson: Record<string, Array<{
    sessionId: string
    workDate: string
    bucket: 'office' | 'bid'
    clockedInIso: string
    clockedOutIso: string
    hours: number
    bidId: string | null
  }>>
  officeJobLedgerId: string | null
}
