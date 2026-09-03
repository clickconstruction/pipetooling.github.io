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
import type { CategoryTagRow } from '../banking/categoryTags'
import type { VehicleArrangement } from './wheels'

/** Wheels on Labor (v2.2735): a person's vehicle deal and the $/field-hour it implies (90-day, override wins). */
export type TeamReviewVehicle = { arrangement: VehicleArrangement; rate: number | null; truckName: string | null; note: string }

export type TeamLedgerRow = { id: string; hcp_number: string; click_number?: string; job_name: string; job_address: string; revenue: number | null; pct_complete: number | null; service_type_id: string | null }
/**
 * Sub-labor sheet line. `labor_rate` (per-line override) and
 * `direct_labor_amount` (a flat $ line) are honored by `laborJobSubCost`, the
 * same costing the Jobs page uses — Review used to ignore both (v2.2686).
 */
export type TeamLaborItem = {
  count: number
  hrs_per_unit: number
  is_fixed: boolean
  labor_rate?: number | null
  direct_labor_amount?: number | null
}
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
  /** Mercury debit-card purchases allocated to jobs (abs amounts) — canonical parts composition includes this bucket. */
  cardChargesByJobId: Map<string, number>
  /**
   * Slices of `cardChargesByJobId` by bank-category tag (abs amounts), for
   * tags flagged `show_as_cost_line` only: job id → (tag id → $). A charge
   * belongs to its accounting label's tag, else its bank category's tag
   * (`lib/mercuryTagSplit`). v2.2725 — generalises the v2.2700 fuel slice.
   */
  tagChargesByJobId: Map<string, ReadonlyMap<string, number>>
  /** The cost-line tags, in manager order — the drawer / verdict draw one line per tag. */
  costLineTags: CategoryTagRow[]
  /**
   * People with a vehicle deal (arrangement ≠ none), by pay-config name. Their
   * fuel-tag card charges are kept OUT of the job card sums above — the deal
   * prices them per field hour instead (own vehicle → labor side, company
   * truck → burden side). Empty when Wheels could not load.
   */
  vehicleByPersonName: Record<string, TeamReviewVehicle>
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
