/** Jobs → Job Summary tab: per-job cost rollup ledger with team-labor / parts / Mercury drilldowns.
 * Presentational — all data/state/loaders/modals live in the parent (Jobs.tsx) and arrive as props. */
import { Fragment, type CSSProperties, type Dispatch, type KeyboardEvent, type ReactNode, type SetStateAction } from 'react'
import {
  formatCurrency,
  formatJobSummaryDurationMinutes,
  formatJobSummaryInvoiceDate,
  formatJobSummaryMercuryPostedAt,
  formatJobSummarySessionDateTime,
  formatJobSummarySessionTimeOnly,
  jobSummaryPartsCostIsZero,
  personMatchesJobSummaryBreakdownFilter,
} from '../../lib/jobs/jobFormatting'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { supplyHouseWebsitePortalHref } from '../../lib/supplyHouseWebsite'
import { formatDecimalWorkHoursToHhMm } from '../../lib/formatDecimalWorkHoursHhMm'
import { laborJobSubCost } from '../../lib/jobs/subLaborCost'
import { formatMercuryDebitCardIdCompact, mercuryDebitCardIdFromRaw } from '../../lib/mercuryRawDebitCard'
import { formatWorkDateYmdWeekdayLongFriendly } from '../../utils/dateUtils'
import { writeJobSummaryMinHcpExclusiveToStorage } from '../../lib/jobSummaryHcpFilter'
import {
  buildJobSummaryPersonSummaryRows,
  partitionUnattributedFromJobSummaryPersonRows,
} from '../../lib/jobSummaryPersonSummaryTable'
import {
  buildJobSummaryTeamLaborWorkDateTableRows,
  isJobSummaryNoWorkDateKey,
} from '../../lib/jobSummaryTeamLaborWorkDateTable'
import {
  buildPartsPerPersonCostRows,
  type PartsPerPersonCostRow,
  type TallyLineForPersonRollup,
} from '../../lib/partsPerPersonCostSummary'
import { normalizePersonNameKey } from '../../lib/personNameKey'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import {
  filterJobSummaryMercuryRowsForPersonName,
  filterJobSummaryMercuryRowsForPersonNames,
  filterJobSummaryMercuryRowsUnattributed,
} from '../../lib/jobSummaryDrilldownMercuryFilter'
import {
  JobSummaryDrilldownMercuryTable,
  JobSummaryDrilldownTeamLaborByWorkDate,
} from './JobSummaryCostCellDrilldownModal'
import type { TallyPartRow } from '../../types/tallyPart'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { LaborJob } from '../../types/laborJob'
import type { TeamLaborRow } from '../../utils/teamLabor'
import type {
  JobSummaryClockSessionRow,
  JobSummaryInvoiceAllocationLine,
  JobSummaryMercuryAllocationRow,
} from '../../types/jobSummary'


function jobSummaryDrilldownCellKeyboard(
  e: KeyboardEvent<HTMLTableCellElement>,
  onOpen: () => void,
) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    e.stopPropagation()
    onOpen()
  }
}

function jobSummaryBreakdownInteractiveClass(
  interactive: boolean,
  variant: 'primary' | 'muted' = 'primary',
): string | undefined {
  if (!interactive) return undefined
  return variant === 'muted' ? 'jobSummaryBreakdownInteractiveMuted' : 'jobSummaryBreakdownInteractive'
}

/** Job Summary: supply-house invoice line table or loading / empty (shared by Parts details and top section). */
function renderJobSummarySupplyHouseInvoiceTableContent(
  invoiceLoaded: boolean,
  invoiceRows: JobSummaryInvoiceAllocationLine[],
  invoicesFromSupplyHouses: number,
): ReactNode {
  if (!invoiceLoaded) {
    return <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>Loading…</p>
  }
  if (invoiceRows.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>
        {invoicesFromSupplyHouses > 0
          ? 'No invoice allocation lines returned for this job.'
          : 'No allocated supply house invoices.'}
      </p>
    )
  }
  return (
    <table style={{ width: '100%', maxWidth: 560, borderCollapse: 'collapse', fontSize: '0.75rem' }}>
      <thead>
        <tr style={{ background: '#f3f4f6' }}>
          <th style={{ padding: '0.25rem 0.4rem', textAlign: 'left' }}>Supply house</th>
          <th style={{ padding: '0.25rem 0.4rem', textAlign: 'left' }}>Invoice</th>
          <th style={{ padding: '0.25rem 0.4rem', textAlign: 'left' }}>Date</th>
          <th style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}>Allocated</th>
        </tr>
      </thead>
      <tbody>
        {invoiceRows.map((row) => {
          const portalHref =
            supplyHouseWebsitePortalHref(row.invoice_link) ?? supplyHouseWebsitePortalHref(row.website_url)
          return (
            <tr key={`${row.invoice_id}-${row.job_id}`} style={{ borderTop: '1px solid #e5e7eb' }}>
              <td style={{ padding: '0.25rem 0.4rem' }}>{row.supply_house_name || '—'}</td>
              <td style={{ padding: '0.25rem 0.4rem' }}>
                {portalHref ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      openInExternalBrowser(portalHref)
                    }}
                    style={{
                      margin: 0,
                      padding: 0,
                      border: 'none',
                      background: 'none',
                      font: 'inherit',
                      fontSize: '0.75rem',
                      color: '#2563eb',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {row.invoice_number}
                  </button>
                ) : (
                  row.invoice_number
                )}
              </td>
              <td style={{ padding: '0.25rem 0.4rem' }}>{formatJobSummaryInvoiceDate(row.invoice_date)}</td>
              <td style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}>${formatCurrency(row.allocated_amount)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

const jobSummaryPartsCostDetailsBoxStyle: CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  padding: '0.35rem 0.5rem',
  background: 'white',
}

const jobSummaryPartsCostFlatRowStyle: CSSProperties = {
  fontWeight: 600,
  fontSize: '0.8125rem',
  color: '#374151',
}

/** Indents Job Summary cost breakdown section bodies under their headings. */
const jobSummaryCostSectionBodyStyle: CSSProperties = {
  paddingLeft: '0.75rem',
  borderLeft: '2px solid #e5e7eb',
}

/** One ledger row of the Job Summary tab; produced by the parent's jobSummaryData memo. */
export type JobSummaryRow = {
  job: JobWithDetails
  subLaborCost: number
  teamLaborCost: number
  partsCost: number
  totalBill: number
  profit: number
  partsFromTally: number
  invoicesFromSupplyHouses: number
  billedMaterialsSum: number
  cardCharges: number
  teamLaborRow: TeamLaborRow | undefined
  subLaborJobs: LaborJob[]
  tallyPartsForJob: TallyPartRow[]
}

export type JobsJobSummaryTabProps = {
  error: string | null
  jobSummaryLedgerError: string | null
  jobSummaryLedgerLoading: boolean
  jobSummaryLedgerJobs: JobWithDetails[] | null
  jobSummaryLedgerAllJobs: JobWithDetails[] | null
  jobSummaryMinHcpExclusive: number
  setJobSummaryMinHcpExclusive: (n: number) => void
  jobSummaryData: JobSummaryRow[]
  jobSummarySearch: string
  setJobSummarySearch: (v: string) => void
  expandedJobSummaryJobIds: Set<string>
  setExpandedJobSummaryJobIds: Dispatch<SetStateAction<Set<string>>>
  jobSummaryTeamLaborPersonExpandedKeys: Set<string>
  setJobSummaryTeamLaborPersonExpandedKeys: Dispatch<SetStateAction<Set<string>>>
  jobSummaryBreakdownPersonSearchByJobId: Record<string, string>
  setJobSummaryBreakdownPersonSearchByJobId: Dispatch<SetStateAction<Record<string, string>>>
  jobSummaryClockSessionsByJobId: Map<string, JobSummaryClockSessionRow[]>
  jobSummaryInvoiceLinesByJobId: Map<string, JobSummaryInvoiceAllocationLine[]>
  jobSummaryMercuryAllocationsByJobId: Map<string, JobSummaryMercuryAllocationRow[]>
  setJobSummaryCostDrilldown: (v: { title: string; body: ReactNode } | null) => void
  printCostBreakdownJobId: string | null
  setPrintCostBreakdownJobId: (v: string | null) => void
  canAccessBankingForParts: boolean
  nicknameByDebitCard: Record<string, string>
  tallyPartsLoading: boolean
  laborJobsLoading: boolean
  driveMileageCost: number | null
  driveTimePerMile: number | null
  loadJobSummaryInvoiceLinesForJob: (jobId: string) => void
  loadJobSummaryMercuryAllocationsForJob: (jobId: string, force?: boolean) => void
  handleJobSummaryMercuryReassignFromDrilldown: (mercuryTransactionId: string, sourceJobId: string) => void
  printJobSummaryCostBreakdown: (opts: {
    job: JobWithDetails
    teamLaborRow: TeamLaborRow | null
    teamLaborCost: number
    subLaborJobs: LaborJob[]
    partsFromTally: number
    billedMaterialsSum: number
    invoicesFromSupplyHouses: number
    cardCharges: number
    totalBill: number
    profit: number
    tallyPartsForJob: TallyPartRow[]
    mileageCost: number
    timePerMile: number
  }) => Promise<void>
}

export default function JobsJobSummaryTab({
  error,
  jobSummaryLedgerError,
  jobSummaryLedgerLoading,
  jobSummaryLedgerJobs,
  jobSummaryLedgerAllJobs,
  jobSummaryMinHcpExclusive,
  setJobSummaryMinHcpExclusive,
  jobSummaryData,
  jobSummarySearch,
  setJobSummarySearch,
  expandedJobSummaryJobIds,
  setExpandedJobSummaryJobIds,
  jobSummaryTeamLaborPersonExpandedKeys,
  setJobSummaryTeamLaborPersonExpandedKeys,
  jobSummaryBreakdownPersonSearchByJobId,
  setJobSummaryBreakdownPersonSearchByJobId,
  jobSummaryClockSessionsByJobId,
  jobSummaryInvoiceLinesByJobId,
  jobSummaryMercuryAllocationsByJobId,
  setJobSummaryCostDrilldown,
  printCostBreakdownJobId,
  setPrintCostBreakdownJobId,
  canAccessBankingForParts,
  nicknameByDebitCard,
  tallyPartsLoading,
  laborJobsLoading,
  driveMileageCost,
  driveTimePerMile,
  loadJobSummaryInvoiceLinesForJob,
  loadJobSummaryMercuryAllocationsForJob,
  handleJobSummaryMercuryReassignFromDrilldown,
  printJobSummaryCostBreakdown,
}: JobsJobSummaryTabProps) {
  return (
        <div>
          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
          {jobSummaryLedgerError && (
            <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{jobSummaryLedgerError}</p>
          )}
          <div style={{ marginBottom: '1rem' }}>
            <input
              type="search"
              placeholder="Search HCP, job name, address…"
              value={jobSummarySearch}
              onChange={(e) => setJobSummarySearch(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
            />
          </div>
          {/* Job Summary uses jobSummaryLedgerJobs, not the Stages/Billing/Parts jobs list — do not gate on jobsListLoading or it stays true when users open this tab first. */}
          {tallyPartsLoading || laborJobsLoading || (jobSummaryLedgerJobs === null && jobSummaryLedgerLoading) ? (
            <p style={{ color: '#6b7280' }}>Loading…</p>
          ) : jobSummaryData.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No billing jobs yet. Add jobs in Billing to see the summary.</p>
          ) : (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>HCP #</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Name</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Address</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Team Labor</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Sub Labor</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Parts Cost</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Total Bill</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Revenue before Overhead</th>
                  </tr>
                </thead>
                <tbody>
                  {jobSummaryData
                    .filter(({ job }) => {
                      const q = jobSummarySearch.trim().toLowerCase()
                      if (!q) return true
                      const hcp = (job.hcp_number ?? '').toLowerCase()
                      const name = (job.job_name ?? '').toLowerCase()
                      const addr = (job.job_address ?? '').toLowerCase()
                      return hcp.includes(q) || name.includes(q) || addr.includes(q)
                    })
                    .flatMap(
                      ({
                        job,
                        subLaborCost,
                        teamLaborCost,
                        partsCost,
                        totalBill,
                        profit,
                        partsFromTally,
                        invoicesFromSupplyHouses,
                        billedMaterialsSum,
                        cardCharges,
                        teamLaborRow,
                        subLaborJobs,
                        tallyPartsForJob,
                      }) => {
                        const expanded = expandedJobSummaryJobIds.has(job.id)
                        const mileageCost = driveMileageCost ?? 0.7
                        const timePerMile = driveTimePerMile ?? 0.02
                        const jobSummaryDetailClockSessions = jobSummaryClockSessionsByJobId.get(job.id)
                        const jobSummaryDetailClockLoaded = jobSummaryClockSessionsByJobId.has(job.id)
                        const breakdownPersonQ = jobSummaryBreakdownPersonSearchByJobId[job.id] ?? ''
                        const teamBreakdownFiltered =
                          teamLaborRow && teamLaborRow.breakdown.length > 0
                            ? teamLaborRow.breakdown
                                .map((b, i) => ({ b, i }))
                                .filter(({ b }) =>
                                  personMatchesJobSummaryBreakdownFilter(b.personName, breakdownPersonQ),
                                )
                            : []
                        const subLaborJobsFiltered = subLaborJobs.filter((lj) =>
                          personMatchesJobSummaryBreakdownFilter(lj.assigned_to_name, breakdownPersonQ),
                        )
                        const toggle = () => {
                          setExpandedJobSummaryJobIds((prev) => {
                            const next = new Set(prev)
                            if (next.has(job.id)) {
                              next.delete(job.id)
                              const prefix = `${job.id}::`
                              setJobSummaryTeamLaborPersonExpandedKeys((s) => {
                                const n = new Set<string>()
                                for (const k of s) {
                                  if (!k.startsWith(prefix)) n.add(k)
                                }
                                return n
                              })
                              setJobSummaryBreakdownPersonSearchByJobId((prev) => {
                                const { [job.id]: _removed, ...rest } = prev
                                return rest
                              })
                            } else next.add(job.id)
                            return next
                          })
                        }
                        const mainRow = (
                          <tr
                            key={job.id}
                            role="button"
                            tabIndex={0}
                            aria-expanded={expanded}
                            onClick={toggle}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                toggle()
                              }
                            }}
                            style={{
                              borderBottom: '1px solid #e5e7eb',
                              cursor: 'pointer',
                              background: expanded ? '#f9fafb' : undefined,
                            }}
                          >
                            <td style={{ padding: '0.75rem' }}>
                              <span style={{ marginRight: '0.35rem', color: '#6b7280', userSelect: 'none' }} aria-hidden>
                                {expanded ? '▼' : '▶'}
                              </span>
                              {effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—'}
                            </td>
                            <td style={{ padding: '0.75rem' }}>{job.job_name ?? '—'}</td>
                            <td style={{ padding: '0.75rem' }}>{job.job_address ?? '—'}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                              {teamLaborCost === 0 ? '—' : `$${formatCurrency(teamLaborCost)}`}
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                              {subLaborCost === 0 ? '—' : `$${formatCurrency(subLaborCost)}`}
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                              {partsCost === 0 ? '—' : `$${formatCurrency(partsCost)}`}
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                              {totalBill === 0 ? '—' : `$${formatCurrency(totalBill)}`}
                            </td>
                            <td
                              style={{
                                padding: '0.75rem',
                                textAlign: 'right',
                                fontWeight: 500,
                                color: profit >= 0 ? undefined : '#b91c1c',
                              }}
                            >
                              ${formatCurrency(profit)}
                            </td>
                          </tr>
                        )
                        if (!expanded) return [mainRow]
                        const detailRow = (
                          <tr key={`${job.id}-summary-detail`}>
                            <td colSpan={8} style={{ padding: 0, borderBottom: '1px solid #e5e7eb', background: '#fafafa' }}>
                              <div style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem' }}>
                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '0.5rem',
                                  }}
                                >
                                  <div style={{ fontWeight: 600, color: '#374151' }}>Cost breakdown</div>
                                  <button
                                    type="button"
                                    aria-label="Print or save as PDF: cost breakdown (opens the browser print dialog)"
                                    aria-busy={printCostBreakdownJobId === job.id}
                                    disabled={printCostBreakdownJobId === job.id}
                                    onClick={async (e) => {
                                      e.stopPropagation()
                                      setPrintCostBreakdownJobId(job.id)
                                      try {
                                        await printJobSummaryCostBreakdown({
                                          job,
                                          teamLaborRow: teamLaborRow ?? null,
                                          teamLaborCost,
                                          subLaborJobs,
                                          partsFromTally,
                                          billedMaterialsSum,
                                          invoicesFromSupplyHouses,
                                          cardCharges,
                                          totalBill,
                                          profit,
                                          tallyPartsForJob,
                                          mileageCost,
                                          timePerMile,
                                        })
                                      } finally {
                                        setPrintCostBreakdownJobId(null)
                                      }
                                    }}
                                    style={{
                                      fontSize: '0.8125rem',
                                      padding: '0.25rem 0.6rem',
                                      border: '1px solid #d1d5db',
                                      borderRadius: 4,
                                      background: '#fff',
                                      cursor: printCostBreakdownJobId === job.id ? 'not-allowed' : 'pointer',
                                      opacity: printCostBreakdownJobId === job.id ? 0.75 : 1,
                                    }}
                                  >
                                    {printCostBreakdownJobId === job.id ? 'Preparing…' : 'Print / Save as PDF'}
                                  </button>
                                </div>
                                {(() => {
                                  const teamBreakdownLite = (teamLaborRow?.breakdown ?? []).map((b) => ({
                                    personName: b.personName,
                                    cost: b.cost,
                                    hours: b.hours,
                                  }))
                                  const needMercury = !jobSummaryPartsCostIsZero(cardCharges)
                                  const mLoaded = jobSummaryMercuryAllocationsByJobId.has(job.id)
                                  const cardColLoading = needMercury && !mLoaded
                                  const tallyRollup: TallyLineForPersonRollup[] = tallyPartsForJob.map((r) => ({
                                    part_id: r.part_id,
                                    quantity: r.quantity,
                                    price_at_time: r.price_at_time,
                                    fixture_cost: r.fixture_cost,
                                    created_by_user_id: r.created_by_user_id,
                                    created_by_name: r.created_by_name,
                                  }))
                                  const mRows = needMercury
                                    ? (jobSummaryMercuryAllocationsByJobId.get(job.id) ?? [])
                                    : []
                                  let ppRows: PartsPerPersonCostRow[] = []
                                  let ppPersonFooter: PartsPerPersonCostRow | null = null
                                  if (!cardColLoading) {
                                    const built = buildPartsPerPersonCostRows({
                                      parts: tallyRollup,
                                      billedMaterialsSum,
                                      invoiceJobTotal: invoicesFromSupplyHouses,
                                      mercuryRows: mRows,
                                      parentCardTotal: cardCharges,
                                    })
                                    ppRows = built.rows
                                    ppPersonFooter = built.footer
                                  }
                                  const personRows = buildJobSummaryPersonSummaryRows({
                                    teamBreakdown: teamBreakdownLite,
                                    ppRows,
                                  })
                                  const { rows: personRowsForTable, unattributedCard } =
                                    partitionUnattributedFromJobSummaryPersonRows(personRows)
                                  const filtered = personRowsForTable.filter((r) =>
                                    personMatchesJobSummaryBreakdownFilter(r.displayName, breakdownPersonQ),
                                  )
                                  const sumTeamF = filtered.reduce((s, r) => s + r.teamLabor, 0)
                                  const sumCardF = cardColLoading
                                    ? null
                                    : filtered.reduce((s, r) => s + r.card, 0)
                                  const personSummaryFooterTeam =
                                    breakdownPersonQ.trim() !== '' ? sumTeamF : teamLaborCost
                                  const personSummaryFooterCard = cardColLoading
                                    ? null
                                    : breakdownPersonQ.trim() !== ''
                                      ? (sumCardF ?? 0)
                                      : cardCharges
                                  const personSummaryFooterRowTotal =
                                    personSummaryFooterCard == null
                                      ? null
                                      : personSummaryFooterTeam +
                                        personSummaryFooterCard +
                                        Number(invoicesFromSupplyHouses ?? 0)
                                  const hasAnyPerson = personRowsForTable.length > 0
                                  const noRowsAfterFilter = filtered.length === 0
                                  const hasUnassignedRowContent =
                                    !jobSummaryPartsCostIsZero(invoicesFromSupplyHouses) ||
                                    !jobSummaryPartsCostIsZero(unattributedCard)
                                  return (
                                    <section style={{ marginBottom: '0.75rem' }}>
                                      {!hasAnyPerson && !cardColLoading && !hasUnassignedRowContent ? (
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>
                                          No per-person team labor or card data.
                                        </p>
                                      ) : cardColLoading && !hasAnyPerson && !hasUnassignedRowContent ? (
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>Loading…</p>
                                      ) : noRowsAfterFilter && breakdownPersonQ.trim() !== '' && !hasUnassignedRowContent ? (
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>
                                          No people match your search.
                                        </p>
                                      ) : (
                                        <div style={{ overflowX: 'auto' }}>
                                          {breakdownPersonQ.trim() !== '' ? (
                                            <p
                                              style={{
                                                margin: '0 0 0.35rem',
                                                fontSize: '0.72rem',
                                                color: '#6b7280',
                                                lineHeight: 1.45,
                                              }}
                                            >
                                              Totals include everyone; table rows are filtered.
                                            </p>
                                          ) : null}
                                          <table
                                            style={{
                                              width: '100%',
                                              maxWidth: 780,
                                              borderCollapse: 'collapse',
                                              fontSize: '0.75rem',
                                            }}
                                          >
                                            <thead>
                                              <tr style={{ background: '#f3f4f6' }}>
                                                <th
                                                  style={{ padding: '0.25rem 0.4rem', textAlign: 'left' }}
                                                  title="Click a cell in this column for a breakdown"
                                                >
                                                  Name
                                                </th>
                                                <th
                                                  style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}
                                                  title="Click a cell in this column for a breakdown"
                                                >
                                                  Hours
                                                </th>
                                                <th
                                                  style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}
                                                  title="Click a cell in this column for a breakdown"
                                                >
                                                  Team Labor Cost
                                                </th>
                                                <th
                                                  style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}
                                                  title="Click a cell in this column for a breakdown"
                                                >
                                                  Card charges
                                                </th>
                                                <th
                                                  style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}
                                                  title="Click a cell in this column for a breakdown"
                                                >
                                                  Supply houses
                                                </th>
                                                <th
                                                  style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}
                                                  title="Click a cell in this column for a breakdown"
                                                >
                                                  Total
                                                </th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {filtered.map((r) => {
                                                const rowSum = r.teamLabor + r.card
                                                const laborEntry = teamLaborRow?.breakdown.find(
                                                  (b) =>
                                                    normalizePersonNameKey(b.personName) ===
                                                    normalizePersonNameKey(r.displayName),
                                                )
                                                const subMercury = filterJobSummaryMercuryRowsForPersonName(
                                                  mRows,
                                                  r.displayName,
                                                )
                                                const openName = () => {
                                                  setJobSummaryCostDrilldown({
                                                    title: `${r.displayName} — row summary`,
                                                    body: (
                                                      <div
                                                        style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', color: '#374151' }}
                                                      >
                                                        <p style={{ margin: 0 }}>
                                                          Hours: {formatDecimalWorkHoursToHhMm(r.hours)}
                                                        </p>
                                                        <p style={{ margin: 0 }}>
                                                          Team labor:{' '}
                                                          {jobSummaryPartsCostIsZero(r.teamLabor)
                                                            ? '—'
                                                            : `$${formatCurrency(r.teamLabor)}`}
                                                        </p>
                                                        <p style={{ margin: 0 }}>
                                                          Card:{' '}
                                                          {cardColLoading
                                                            ? 'Loading…'
                                                            : jobSummaryPartsCostIsZero(r.card)
                                                              ? '—'
                                                              : `$${formatCurrency(r.card)}`}
                                                        </p>
                                                        <p style={{ margin: 0, color: '#6b7280' }}>
                                                          Supply: job-level only (not per person).
                                                        </p>
                                                        <p style={{ margin: 0, fontWeight: 600 }}>
                                                          Line total:{' '}
                                                          {cardColLoading
                                                            ? '—'
                                                            : jobSummaryPartsCostIsZero(rowSum)
                                                              ? '—'
                                                              : `$${formatCurrency(rowSum)}`}
                                                        </p>
                                                      </div>
                                                    ),
                                                  })
                                                }
                                                const openHours = () => {
                                                  if (jobSummaryPartsCostIsZero(r.hours)) return
                                                  setJobSummaryCostDrilldown({
                                                    title: `Hours — ${r.displayName}`,
                                                    body: laborEntry ? (
                                                      <JobSummaryDrilldownTeamLaborByWorkDate
                                                        personName={r.displayName}
                                                        byWorkDate={laborEntry.byWorkDate}
                                                        formatWorkDate={formatWorkDateYmdWeekdayLongFriendly}
                                                        formatCurrency={formatCurrency}
                                                        formatHhMm={formatDecimalWorkHoursToHhMm}
                                                        totalCost={laborEntry.cost}
                                                        totalHours={laborEntry.hours}
                                                      />
                                                    ) : (
                                                      <p style={{ margin: 0, color: '#6b7280' }}>No work-date hours breakdown for this name.</p>
                                                    ),
                                                  })
                                                }
                                                const openTeam = () => {
                                                  if (jobSummaryPartsCostIsZero(r.teamLabor)) return
                                                  setJobSummaryCostDrilldown({
                                                    title: `Team labor — ${r.displayName}`,
                                                    body: laborEntry ? (
                                                      <JobSummaryDrilldownTeamLaborByWorkDate
                                                        personName={r.displayName}
                                                        byWorkDate={laborEntry.byWorkDate}
                                                        formatWorkDate={formatWorkDateYmdWeekdayLongFriendly}
                                                        formatCurrency={formatCurrency}
                                                        formatHhMm={formatDecimalWorkHoursToHhMm}
                                                        totalCost={laborEntry.cost}
                                                        totalHours={laborEntry.hours}
                                                      />
                                                    ) : (
                                                      <p style={{ margin: 0, color: '#6b7280' }}>
                                                        Team labor total ${formatCurrency(r.teamLabor)} (no per-date split in the model).
                                                      </p>
                                                    ),
                                                  })
                                                }
                                                const openCard = () => {
                                                  if (cardColLoading || jobSummaryPartsCostIsZero(r.card)) return
                                                  void loadJobSummaryMercuryAllocationsForJob(job.id)
                                                  setJobSummaryCostDrilldown({
                                                    title: `Card — ${r.displayName}`,
                                                    body: (
                                                      <JobSummaryDrilldownMercuryTable
                                                        rows={subMercury}
                                                        formatPosted={formatJobSummaryMercuryPostedAt}
                                                        formatCurrency={formatCurrency}
                                                        nicknameByDebitCard={nicknameByDebitCard}
                                                        canEditAllocations={canAccessBankingForParts}
                                                        onReassignJob={
                                                          canAccessBankingForParts
                                                            ? (txId) => {
                                                                void handleJobSummaryMercuryReassignFromDrilldown(txId, job.id)
                                                              }
                                                            : undefined
                                                        }
                                                      />
                                                    ),
                                                  })
                                                }
                                                const openLineTotal = () => {
                                                  if (cardColLoading || jobSummaryPartsCostIsZero(rowSum)) return
                                                  void loadJobSummaryMercuryAllocationsForJob(job.id)
                                                  setJobSummaryCostDrilldown({
                                                    title: `Team + card — ${r.displayName}`,
                                                    body: (
                                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                        {laborEntry ? (
                                                          <div>
                                                            <p style={{ margin: '0 0 0.35rem', fontWeight: 600 }}>Team labor (by work date)</p>
                                                            <JobSummaryDrilldownTeamLaborByWorkDate
                                                              personName={r.displayName}
                                                              byWorkDate={laborEntry.byWorkDate}
                                                              formatWorkDate={formatWorkDateYmdWeekdayLongFriendly}
                                                              formatCurrency={formatCurrency}
                                                              formatHhMm={formatDecimalWorkHoursToHhMm}
                                                              totalCost={laborEntry.cost}
                                                              totalHours={laborEntry.hours}
                                                            />
                                                          </div>
                                                        ) : (
                                                          <p style={{ margin: 0, color: '#6b7280' }}>
                                                            Team: ${formatCurrency(r.teamLabor)}
                                                          </p>
                                                        )}
                                                        <div>
                                                          <p style={{ margin: '0 0 0.35rem', fontWeight: 600 }}>Card (attributed to this name)</p>
                                                          <JobSummaryDrilldownMercuryTable
                                                            rows={subMercury}
                                                            formatPosted={formatJobSummaryMercuryPostedAt}
                                                            formatCurrency={formatCurrency}
                                                            nicknameByDebitCard={nicknameByDebitCard}
                                                            canEditAllocations={canAccessBankingForParts}
                                                            onReassignJob={
                                                              canAccessBankingForParts
                                                                ? (txId) => {
                                                                    void handleJobSummaryMercuryReassignFromDrilldown(txId, job.id)
                                                                  }
                                                                : undefined
                                                            }
                                                          />
                                                        </div>
                                                        <p style={{ margin: 0, fontWeight: 600 }}>Sum: ${formatCurrency(rowSum)}</p>
                                                      </div>
                                                    ),
                                                  })
                                                }
                                                const hoursPersonInteractive = !jobSummaryPartsCostIsZero(r.hours)
                                                const cardPersonInteractive = !cardColLoading && !jobSummaryPartsCostIsZero(r.card)
                                                const lineTotalPersonInteractive =
                                                  !cardColLoading && !jobSummaryPartsCostIsZero(rowSum)
                                                return (
                                                <tr key={r.normKey} style={{ borderTop: '1px solid #e5e7eb' }}>
                                                  <td
                                                    className="jobSummaryBreakdownInteractive"
                                                    style={{ padding: '0.25rem 0.4rem' }}
                                                    role="button"
                                                    tabIndex={0}
                                                    aria-label={`View summary for ${r.displayName}`}
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                      openName()
                                                    }}
                                                    onKeyDown={(e) => jobSummaryDrilldownCellKeyboard(e, openName)}
                                                  >
                                                    {r.displayName}
                                                  </td>
                                                  <td
                                                    className={jobSummaryBreakdownInteractiveClass(hoursPersonInteractive)}
                                                    style={{
                                                      padding: '0.25rem 0.4rem',
                                                      textAlign: 'right',
                                                    }}
                                                    role={hoursPersonInteractive ? 'button' : undefined}
                                                    tabIndex={hoursPersonInteractive ? 0 : -1}
                                                    aria-label={
                                                      hoursPersonInteractive
                                                        ? `View hours for ${r.displayName}`
                                                        : undefined
                                                    }
                                                    onClick={
                                                      hoursPersonInteractive
                                                        ? (e) => {
                                                            e.stopPropagation()
                                                            openHours()
                                                          }
                                                        : undefined
                                                    }
                                                    onKeyDown={
                                                      hoursPersonInteractive
                                                        ? (e) => jobSummaryDrilldownCellKeyboard(e, openHours)
                                                        : undefined
                                                    }
                                                  >
                                                    {jobSummaryPartsCostIsZero(r.hours)
                                                      ? '—'
                                                      : formatDecimalWorkHoursToHhMm(r.hours)}
                                                  </td>
                                                  <td
                                                    className={jobSummaryBreakdownInteractiveClass(
                                                      !jobSummaryPartsCostIsZero(r.teamLabor),
                                                    )}
                                                    style={{
                                                      padding: '0.25rem 0.4rem',
                                                      textAlign: 'right',
                                                    }}
                                                    role={jobSummaryPartsCostIsZero(r.teamLabor) ? undefined : 'button'}
                                                    tabIndex={jobSummaryPartsCostIsZero(r.teamLabor) ? -1 : 0}
                                                    aria-label={
                                                      jobSummaryPartsCostIsZero(r.teamLabor)
                                                        ? undefined
                                                        : `View team labor for ${r.displayName}`
                                                    }
                                                    onClick={
                                                      jobSummaryPartsCostIsZero(r.teamLabor)
                                                        ? undefined
                                                        : (e) => {
                                                            e.stopPropagation()
                                                            openTeam()
                                                          }
                                                    }
                                                    onKeyDown={
                                                      jobSummaryPartsCostIsZero(r.teamLabor)
                                                        ? undefined
                                                        : (e) => jobSummaryDrilldownCellKeyboard(e, openTeam)
                                                    }
                                                  >
                                                    {jobSummaryPartsCostIsZero(r.teamLabor)
                                                      ? '—'
                                                      : `$${formatCurrency(r.teamLabor)}`}
                                                  </td>
                                                  <td
                                                    className={jobSummaryBreakdownInteractiveClass(cardPersonInteractive)}
                                                    style={{
                                                      padding: '0.25rem 0.4rem',
                                                      textAlign: 'right',
                                                      color: cardColLoading ? '#6b7280' : undefined,
                                                    }}
                                                    role={cardPersonInteractive ? 'button' : undefined}
                                                    tabIndex={cardPersonInteractive ? 0 : -1}
                                                    aria-label={
                                                      cardPersonInteractive
                                                        ? `View card charges for ${r.displayName}`
                                                        : undefined
                                                    }
                                                    onClick={
                                                      cardPersonInteractive
                                                        ? (e) => {
                                                            e.stopPropagation()
                                                            openCard()
                                                          }
                                                        : undefined
                                                    }
                                                    onKeyDown={
                                                      cardPersonInteractive
                                                        ? (e) => jobSummaryDrilldownCellKeyboard(e, openCard)
                                                        : undefined
                                                    }
                                                  >
                                                    {cardColLoading
                                                      ? 'Loading…'
                                                      : jobSummaryPartsCostIsZero(r.card)
                                                        ? '—'
                                                        : `$${formatCurrency(r.card)}`}
                                                  </td>
                                                  <td
                                                    style={{
                                                      padding: '0.25rem 0.4rem',
                                                      textAlign: 'right',
                                                      color: '#6b7280',
                                                    }}
                                                  >
                                                    —
                                                  </td>
                                                  <td
                                                    className={jobSummaryBreakdownInteractiveClass(lineTotalPersonInteractive)}
                                                    style={{
                                                      padding: '0.25rem 0.4rem',
                                                      textAlign: 'right',
                                                    }}
                                                    role={lineTotalPersonInteractive ? 'button' : undefined}
                                                    tabIndex={lineTotalPersonInteractive ? 0 : -1}
                                                    aria-label={
                                                      lineTotalPersonInteractive
                                                        ? `View team and card for ${r.displayName}`
                                                        : undefined
                                                    }
                                                    onClick={
                                                      lineTotalPersonInteractive
                                                        ? (e) => {
                                                            e.stopPropagation()
                                                            openLineTotal()
                                                          }
                                                        : undefined
                                                    }
                                                    onKeyDown={
                                                      lineTotalPersonInteractive
                                                        ? (e) => jobSummaryDrilldownCellKeyboard(e, openLineTotal)
                                                        : undefined
                                                    }
                                                  >
                                                    {cardColLoading
                                                      ? '—'
                                                      : jobSummaryPartsCostIsZero(rowSum)
                                                        ? '—'
                                                        : `$${formatCurrency(rowSum)}`}
                                                  </td>
                                                </tr>
                                                )
                                              })}
                                              {hasUnassignedRowContent ? (
                                                (() => {
                                                  const unatRows = filterJobSummaryMercuryRowsUnattributed(mRows)
                                                  const openUnassignedCard = () => {
                                                    if (cardColLoading || jobSummaryPartsCostIsZero(unattributedCard)) return
                                                    void loadJobSummaryMercuryAllocationsForJob(job.id)
                                                    setJobSummaryCostDrilldown({
                                                      title: 'Unassigned — card (no Mercury attribution)',
                                                      body: (
                                                        <JobSummaryDrilldownMercuryTable
                                                          rows={unatRows}
                                                          formatPosted={formatJobSummaryMercuryPostedAt}
                                                          formatCurrency={formatCurrency}
                                                          nicknameByDebitCard={nicknameByDebitCard}
                                                          canEditAllocations={canAccessBankingForParts}
                                                          onReassignJob={
                                                            canAccessBankingForParts
                                                              ? (txId) => {
                                                                  void handleJobSummaryMercuryReassignFromDrilldown(txId, job.id)
                                                                }
                                                              : undefined
                                                          }
                                                        />
                                                      ),
                                                    })
                                                  }
                                                  const openUnassignedSupply = () => {
                                                    if (jobSummaryPartsCostIsZero(invoicesFromSupplyHouses)) return
                                                    void loadJobSummaryInvoiceLinesForJob(job.id)
                                                    setJobSummaryCostDrilldown({
                                                      title: 'Unassigned — supply house invoices',
                                                      body: renderJobSummarySupplyHouseInvoiceTableContent(
                                                        jobSummaryInvoiceLinesByJobId.has(job.id),
                                                        jobSummaryInvoiceLinesByJobId.get(job.id) ?? [],
                                                        invoicesFromSupplyHouses,
                                                      ),
                                                    })
                                                  }
                                                  const openUnassignedTotal = () => {
                                                    if (cardColLoading) return
                                                    void loadJobSummaryMercuryAllocationsForJob(job.id)
                                                    void loadJobSummaryInvoiceLinesForJob(job.id)
                                                    setJobSummaryCostDrilldown({
                                                      title: 'Unassigned — card + supply',
                                                      body: (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                          <div>
                                                            <p style={{ margin: '0 0 0.35rem', fontWeight: 600 }}>Card (unattributed)</p>
                                                            <JobSummaryDrilldownMercuryTable
                                                              rows={unatRows}
                                                              formatPosted={formatJobSummaryMercuryPostedAt}
                                                              formatCurrency={formatCurrency}
                                                              nicknameByDebitCard={nicknameByDebitCard}
                                                              canEditAllocations={canAccessBankingForParts}
                                                              onReassignJob={
                                                                canAccessBankingForParts
                                                                  ? (txId) => {
                                                                      void handleJobSummaryMercuryReassignFromDrilldown(txId, job.id)
                                                                    }
                                                                  : undefined
                                                              }
                                                            />
                                                          </div>
                                                          <div>
                                                            <p style={{ margin: '0 0 0.35rem', fontWeight: 600 }}>Supply houses</p>
                                                            {renderJobSummarySupplyHouseInvoiceTableContent(
                                                              jobSummaryInvoiceLinesByJobId.has(job.id),
                                                              jobSummaryInvoiceLinesByJobId.get(job.id) ?? [],
                                                              invoicesFromSupplyHouses,
                                                            )}
                                                          </div>
                                                        </div>
                                                      ),
                                                    })
                                                  }
                                                  return (
                                                <tr
                                                  key={`${job.id}::summary-unassigned`}
                                                  style={{ borderTop: '1px solid #e5e7eb' }}
                                                >
                                                  <td style={{ padding: '0.25rem 0.4rem' }}>Unassigned</td>
                                                  <td style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}>—</td>
                                                  <td style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}>—</td>
                                                  <td
                                                    className={jobSummaryBreakdownInteractiveClass(
                                                      !cardColLoading && !jobSummaryPartsCostIsZero(unattributedCard),
                                                    )}
                                                    style={{
                                                      padding: '0.25rem 0.4rem',
                                                      textAlign: 'right',
                                                      color: cardColLoading ? '#6b7280' : undefined,
                                                    }}
                                                    role={
                                                      cardColLoading || jobSummaryPartsCostIsZero(unattributedCard)
                                                        ? undefined
                                                        : 'button'
                                                    }
                                                    tabIndex={
                                                      cardColLoading || jobSummaryPartsCostIsZero(unattributedCard) ? -1 : 0
                                                    }
                                                    aria-label={
                                                      cardColLoading || jobSummaryPartsCostIsZero(unattributedCard)
                                                        ? undefined
                                                        : 'View unattributed card lines'
                                                    }
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                      openUnassignedCard()
                                                    }}
                                                    onKeyDown={(e) => {
                                                      if (!cardColLoading && !jobSummaryPartsCostIsZero(unattributedCard)) {
                                                        jobSummaryDrilldownCellKeyboard(e, openUnassignedCard)
                                                      }
                                                    }}
                                                  >
                                                    {cardColLoading
                                                      ? '—'
                                                      : jobSummaryPartsCostIsZero(unattributedCard)
                                                        ? '—'
                                                        : `$${formatCurrency(unattributedCard)}`}
                                                  </td>
                                                  <td
                                                    className={jobSummaryBreakdownInteractiveClass(
                                                      !jobSummaryPartsCostIsZero(invoicesFromSupplyHouses),
                                                      'muted',
                                                    )}
                                                    style={{
                                                      padding: '0.25rem 0.4rem',
                                                      textAlign: 'right',
                                                    }}
                                                    role={jobSummaryPartsCostIsZero(invoicesFromSupplyHouses) ? undefined : 'button'}
                                                    tabIndex={jobSummaryPartsCostIsZero(invoicesFromSupplyHouses) ? -1 : 0}
                                                    aria-label={
                                                      jobSummaryPartsCostIsZero(invoicesFromSupplyHouses)
                                                        ? undefined
                                                        : 'View supply invoice lines'
                                                    }
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                      openUnassignedSupply()
                                                    }}
                                                    onKeyDown={(e) => {
                                                      if (!jobSummaryPartsCostIsZero(invoicesFromSupplyHouses)) {
                                                        jobSummaryDrilldownCellKeyboard(e, openUnassignedSupply)
                                                      }
                                                    }}
                                                  >
                                                    {jobSummaryPartsCostIsZero(invoicesFromSupplyHouses)
                                                      ? '—'
                                                      : `$${formatCurrency(invoicesFromSupplyHouses)}`}
                                                  </td>
                                                  <td
                                                    className={jobSummaryBreakdownInteractiveClass(
                                                      !cardColLoading &&
                                                        !jobSummaryPartsCostIsZero(
                                                          unattributedCard + Number(invoicesFromSupplyHouses ?? 0),
                                                        ),
                                                    )}
                                                    style={{
                                                      padding: '0.25rem 0.4rem',
                                                      textAlign: 'right',
                                                    }}
                                                    role={
                                                      cardColLoading ||
                                                      jobSummaryPartsCostIsZero(
                                                        unattributedCard + Number(invoicesFromSupplyHouses ?? 0),
                                                      )
                                                        ? undefined
                                                        : 'button'
                                                    }
                                                    tabIndex={
                                                      cardColLoading ||
                                                      jobSummaryPartsCostIsZero(
                                                        unattributedCard + Number(invoicesFromSupplyHouses ?? 0),
                                                      )
                                                        ? -1
                                                        : 0
                                                    }
                                                    aria-label={
                                                      cardColLoading ||
                                                      jobSummaryPartsCostIsZero(
                                                        unattributedCard + Number(invoicesFromSupplyHouses ?? 0),
                                                      )
                                                        ? undefined
                                                        : 'View unassigned card and supply'
                                                    }
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                      openUnassignedTotal()
                                                    }}
                                                    onKeyDown={(e) => {
                                                      if (
                                                        !cardColLoading &&
                                                        !jobSummaryPartsCostIsZero(
                                                          unattributedCard + Number(invoicesFromSupplyHouses ?? 0),
                                                        )
                                                      ) {
                                                        jobSummaryDrilldownCellKeyboard(e, openUnassignedTotal)
                                                      }
                                                    }}
                                                  >
                                                    {cardColLoading
                                                      ? '—'
                                                      : jobSummaryPartsCostIsZero(
                                                            unattributedCard + Number(invoicesFromSupplyHouses ?? 0),
                                                          )
                                                        ? '—'
                                                        : `$${formatCurrency(
                                                            unattributedCard + Number(invoicesFromSupplyHouses ?? 0),
                                                          )}`}
                                                  </td>
                                                </tr>
                                                  )
                                                })()
                                              ) : null}
                                              {(() => {
                                                const isBreakdownFiltered = breakdownPersonQ.trim() !== ''
                                                const teamFooterAmt = isBreakdownFiltered ? sumTeamF : teamLaborCost
                                                const cardFooterAmt = isBreakdownFiltered ? (sumCardF ?? 0) : cardCharges
                                                const mRowsForFooterCard = isBreakdownFiltered
                                                  ? filterJobSummaryMercuryRowsForPersonNames(
                                                      mRows,
                                                      filtered.map((x) => x.displayName),
                                                    )
                                                  : mRows
                                                const openTotalRowLabel = () => {
                                                  setJobSummaryCostDrilldown({
                                                    title: 'Person summary — total row',
                                                    body: (
                                                      <div style={{ lineHeight: 1.5, color: '#374151' }}>
                                                        <p style={{ margin: '0 0 0.5rem' }}>
                                                          This row sums the job columns used in the person summary. Row labels match the
                                                          amounts above: team labor and (when a person search is active) card roll up
                                                          to the visible people; supply is always the full job allocation.
                                                        </p>
                                                        {isBreakdownFiltered ? (
                                                          <p style={{ margin: 0, fontSize: '0.8rem', color: '#6b7280' }}>
                                                            A person name filter is active: the table only lists matches, but hours in
                                                            the first column and supply stay full-job figures.
                                                          </p>
                                                        ) : null}
                                                      </div>
                                                    ),
                                                  })
                                                }
                                                const openFooterHours = () => {
                                                  if (!teamLaborRow) return
                                                  setJobSummaryCostDrilldown({
                                                    title: 'Total — hours (full job)',
                                                    body: (
                                                      <div style={{ lineHeight: 1.5, color: '#374151' }}>
                                                        <p style={{ margin: '0 0 0.75rem' }}>
                                                          These hours are the full team labor model total for the job. They are not
                                                          reduced when you filter the person name list.
                                                        </p>
                                                        {isBreakdownFiltered ? (
                                                          <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: '#6b7280' }}>
                                                            Filtered table rows:{' '}
                                                            {formatDecimalWorkHoursToHhMm(
                                                              filtered.reduce((s, r) => s + r.hours, 0),
                                                            )}{' '}
                                                            hours; footer: {formatDecimalWorkHoursToHhMm(teamLaborRow.manHours)}.
                                                          </p>
                                                        ) : null}
                                                        <table
                                                          style={{
                                                            width: '100%',
                                                            maxWidth: 520,
                                                            borderCollapse: 'collapse',
                                                            fontSize: '0.75rem',
                                                          }}
                                                        >
                                                          <thead>
                                                            <tr style={{ background: '#f3f4f6' }}>
                                                              <th style={{ padding: '0.25rem 0.4rem', textAlign: 'left' }}>Name</th>
                                                              <th style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}>Hours</th>
                                                              <th style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}>Team cost</th>
                                                            </tr>
                                                          </thead>
                                                          <tbody>
                                                            {teamLaborRow.breakdown.map((b) => (
                                                              <tr
                                                                key={normalizePersonNameKey(b.personName)}
                                                                style={{ borderTop: '1px solid #e5e7eb' }}
                                                              >
                                                                <td style={{ padding: '0.25rem 0.4rem' }}>{b.personName}</td>
                                                                <td style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}>
                                                                  {formatDecimalWorkHoursToHhMm(b.hours)}
                                                                </td>
                                                                <td style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}>
                                                                  ${formatCurrency(b.cost)}
                                                                </td>
                                                              </tr>
                                                            ))}
                                                          </tbody>
                                                        </table>
                                                        <p style={{ margin: '0.5rem 0 0', fontWeight: 600 }}>
                                                          Sum: {formatDecimalWorkHoursToHhMm(teamLaborRow.manHours)} hours
                                                        </p>
                                                      </div>
                                                    ),
                                                  })
                                                }
                                                const openFooterTeam = () => {
                                                  if (jobSummaryPartsCostIsZero(teamFooterAmt)) return
                                                  setJobSummaryCostDrilldown({
                                                    title: isBreakdownFiltered
                                                      ? 'Total — team labor (filter)'
                                                      : 'Total — team labor (full job)',
                                                    body: isBreakdownFiltered ? (
                                                      <div style={{ lineHeight: 1.5, color: '#374151' }}>
                                                        <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: '#6b7280' }}>
                                                          Sum of team labor for names matching the current filter. Footer total: $
                                                          {formatCurrency(teamFooterAmt)}.
                                                        </p>
                                                        <table
                                                          style={{
                                                            width: '100%',
                                                            maxWidth: 520,
                                                            borderCollapse: 'collapse',
                                                            fontSize: '0.75rem',
                                                          }}
                                                        >
                                                          <thead>
                                                            <tr style={{ background: '#f3f4f6' }}>
                                                              <th style={{ padding: '0.25rem 0.4rem', textAlign: 'left' }}>Name</th>
                                                              <th style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}>Hours</th>
                                                              <th style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}>Team labor</th>
                                                            </tr>
                                                          </thead>
                                                          <tbody>
                                                            {filtered.map((x) => (
                                                              <tr key={x.normKey} style={{ borderTop: '1px solid #e5e7eb' }}>
                                                                <td style={{ padding: '0.25rem 0.4rem' }}>{x.displayName}</td>
                                                                <td style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}>
                                                                  {formatDecimalWorkHoursToHhMm(x.hours)}
                                                                </td>
                                                                <td style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}>
                                                                  {jobSummaryPartsCostIsZero(x.teamLabor)
                                                                    ? '—'
                                                                    : `$${formatCurrency(x.teamLabor)}`}
                                                                </td>
                                                              </tr>
                                                            ))}
                                                          </tbody>
                                                        </table>
                                                      </div>
                                                    ) : teamLaborRow ? (
                                                      <div style={{ lineHeight: 1.5, color: '#374151' }}>
                                                        <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: '#6b7280' }}>
                                                          Full job team labor. Total: ${formatCurrency(teamLaborCost)}.
                                                        </p>
                                                        <table
                                                          style={{
                                                            width: '100%',
                                                            maxWidth: 520,
                                                            borderCollapse: 'collapse',
                                                            fontSize: '0.75rem',
                                                          }}
                                                        >
                                                          <thead>
                                                            <tr style={{ background: '#f3f4f6' }}>
                                                              <th style={{ padding: '0.25rem 0.4rem', textAlign: 'left' }}>Name</th>
                                                              <th style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}>Hours</th>
                                                              <th style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}>Team labor</th>
                                                            </tr>
                                                          </thead>
                                                          <tbody>
                                                            {teamLaborRow.breakdown.map((b) => (
                                                              <tr
                                                                key={normalizePersonNameKey(b.personName)}
                                                                style={{ borderTop: '1px solid #e5e7eb' }}
                                                              >
                                                                <td style={{ padding: '0.25rem 0.4rem' }}>{b.personName}</td>
                                                                <td style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}>
                                                                  {formatDecimalWorkHoursToHhMm(b.hours)}
                                                                </td>
                                                                <td style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}>
                                                                  ${formatCurrency(b.cost)}
                                                                </td>
                                                              </tr>
                                                            ))}
                                                          </tbody>
                                                        </table>
                                                      </div>
                                                    ) : (
                                                      <p style={{ margin: 0, color: '#6b7280' }}>No team labor data.</p>
                                                    ),
                                                  })
                                                }
                                                const openFooterCard = () => {
                                                  if (cardColLoading || jobSummaryPartsCostIsZero(cardFooterAmt)) return
                                                  void loadJobSummaryMercuryAllocationsForJob(job.id)
                                                  setJobSummaryCostDrilldown({
                                                    title: isBreakdownFiltered
                                                      ? 'Total — card (filter)'
                                                      : 'Total — card (full job)',
                                                    body: (
                                                      <div style={{ lineHeight: 1.5, color: '#374151' }}>
                                                        {isBreakdownFiltered ? (
                                                          <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: '#6b7280' }}>
                                                            Mercury lines attributed to names in the current filter. Unattributed
                                                            card is in the Unassigned row, not this footer.
                                                          </p>
                                                        ) : (
                                                          <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: '#6b7280' }}>
                                                            All job Mercury lines with job allocation. Total card charges: $
                                                            {formatCurrency(cardCharges)}.
                                                          </p>
                                                        )}
                                                        <JobSummaryDrilldownMercuryTable
                                                          rows={mRowsForFooterCard}
                                                          formatPosted={formatJobSummaryMercuryPostedAt}
                                                          formatCurrency={formatCurrency}
                                                          nicknameByDebitCard={nicknameByDebitCard}
                                                          canEditAllocations={canAccessBankingForParts}
                                                          onReassignJob={
                                                            canAccessBankingForParts
                                                              ? (txId) => {
                                                                  void handleJobSummaryMercuryReassignFromDrilldown(txId, job.id)
                                                                }
                                                              : undefined
                                                          }
                                                        />
                                                      </div>
                                                    ),
                                                  })
                                                }
                                                const openFooterSupply = () => {
                                                  if (jobSummaryPartsCostIsZero(invoicesFromSupplyHouses)) return
                                                  void loadJobSummaryInvoiceLinesForJob(job.id)
                                                  setJobSummaryCostDrilldown({
                                                    title: 'Total — supply houses (full job)',
                                                    body: (
                                                      <div style={{ lineHeight: 1.5, color: '#374151' }}>
                                                        <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: '#6b7280' }}>
                                                          Supply is allocated to the job, not to individual people. The Total row uses
                                                          the same figure whether or not a person name filter is active.
                                                        </p>
                                                        {renderJobSummarySupplyHouseInvoiceTableContent(
                                                          jobSummaryInvoiceLinesByJobId.has(job.id),
                                                          jobSummaryInvoiceLinesByJobId.get(job.id) ?? [],
                                                          invoicesFromSupplyHouses,
                                                        )}
                                                      </div>
                                                    ),
                                                  })
                                                }
                                                const openFooterGrand = () => {
                                                  if (personSummaryFooterRowTotal == null) return
                                                  if (jobSummaryPartsCostIsZero(personSummaryFooterRowTotal)) return
                                                  void loadJobSummaryMercuryAllocationsForJob(job.id)
                                                  void loadJobSummaryInvoiceLinesForJob(job.id)
                                                  setJobSummaryCostDrilldown({
                                                    title: 'Total — grand (footer)',
                                                    body: (
                                                      <div
                                                        style={{
                                                          display: 'flex',
                                                          flexDirection: 'column',
                                                          gap: '0.75rem',
                                                          lineHeight: 1.5,
                                                          color: '#374151',
                                                        }}
                                                      >
                                                        {isBreakdownFiltered ? (
                                                          <p style={{ margin: 0, fontSize: '0.8rem', color: '#6b7280' }}>
                                                            With a name filter, team and card in this total follow the table rows; supply
                                                            is the full job allocation. Hours and supply amounts are still full job.
                                                          </p>
                                                        ) : null}
                                                        <p style={{ margin: 0 }}>
                                                          <strong>Team labor:</strong> ${formatCurrency(personSummaryFooterTeam)} (
                                                          {isBreakdownFiltered ? 'filtered' : 'full job'}
                                                          ).
                                                        </p>
                                                        <p style={{ margin: 0 }}>
                                                          <strong>Card:</strong> ${formatCurrency(personSummaryFooterCard ?? 0)} (
                                                          {isBreakdownFiltered ? 'filtered' : 'full job'}
                                                          ).
                                                        </p>
                                                        <p style={{ margin: 0, color: '#6b7280' }}>
                                                          <strong>Supply houses:</strong> ${formatCurrency(
                                                            Number(invoicesFromSupplyHouses ?? 0),
                                                          )}{' '}
                                                          (full job; not per person)
                                                        </p>
                                                        <p style={{ margin: 0, fontWeight: 600, paddingTop: '0.25rem' }}>
                                                          Sum: ${formatCurrency(personSummaryFooterRowTotal)}
                                                        </p>
                                                        <div
                                                          style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #e5e7eb' }}
                                                        >
                                                          <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', fontWeight: 600 }}>Line lists</p>
                                                          <p style={{ margin: '0 0 0.35rem', fontSize: '0.8rem' }}>Card (for this total)</p>
                                                          <JobSummaryDrilldownMercuryTable
                                                            rows={mRowsForFooterCard}
                                                            formatPosted={formatJobSummaryMercuryPostedAt}
                                                            formatCurrency={formatCurrency}
                                                            nicknameByDebitCard={nicknameByDebitCard}
                                                            canEditAllocations={canAccessBankingForParts}
                                                            onReassignJob={
                                                              canAccessBankingForParts
                                                                ? (txId) => {
                                                                    void handleJobSummaryMercuryReassignFromDrilldown(txId, job.id)
                                                                  }
                                                                : undefined
                                                            }
                                                          />
                                                        </div>
                                                        <div>
                                                          <p style={{ margin: '0 0 0.35rem', fontSize: '0.8rem', fontWeight: 600 }}>Supply</p>
                                                          {renderJobSummarySupplyHouseInvoiceTableContent(
                                                            jobSummaryInvoiceLinesByJobId.has(job.id),
                                                            jobSummaryInvoiceLinesByJobId.get(job.id) ?? [],
                                                            invoicesFromSupplyHouses,
                                                          )}
                                                        </div>
                                                      </div>
                                                    ),
                                                  })
                                                }
                                                return (
                                              <tr style={{ borderTop: '1px solid #d1d5db', fontWeight: 600 }}>
                                                <td
                                                  className="jobSummaryBreakdownInteractive"
                                                  style={{ padding: '0.25rem 0.4rem' }}
                                                  role="button"
                                                  tabIndex={0}
                                                  aria-label="What the total row means"
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    openTotalRowLabel()
                                                  }}
                                                  onKeyDown={(e) => jobSummaryDrilldownCellKeyboard(e, openTotalRowLabel)}
                                                >
                                                  Total
                                                </td>
                                                <td
                                                  className={jobSummaryBreakdownInteractiveClass(!!teamLaborRow)}
                                                  style={{
                                                    padding: '0.25rem 0.4rem',
                                                    textAlign: 'right',
                                                  }}
                                                  role={teamLaborRow ? 'button' : undefined}
                                                  tabIndex={teamLaborRow ? 0 : -1}
                                                  aria-label={teamLaborRow ? 'View full job team labor hours' : undefined}
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    if (teamLaborRow) openFooterHours()
                                                  }}
                                                  onKeyDown={(e) => {
                                                    if (teamLaborRow) {
                                                      jobSummaryDrilldownCellKeyboard(e, openFooterHours)
                                                    }
                                                  }}
                                                >
                                                  {teamLaborRow
                                                    ? formatDecimalWorkHoursToHhMm(teamLaborRow.manHours)
                                                    : '—'}
                                                </td>
                                                <td
                                                  className={jobSummaryBreakdownInteractiveClass(
                                                    !jobSummaryPartsCostIsZero(teamFooterAmt),
                                                  )}
                                                  style={{
                                                    padding: '0.25rem 0.4rem',
                                                    textAlign: 'right',
                                                  }}
                                                  role={jobSummaryPartsCostIsZero(teamFooterAmt) ? undefined : 'button'}
                                                  tabIndex={jobSummaryPartsCostIsZero(teamFooterAmt) ? -1 : 0}
                                                  aria-label={
                                                    jobSummaryPartsCostIsZero(teamFooterAmt) ? undefined : 'View team labor total'
                                                  }
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    openFooterTeam()
                                                  }}
                                                  onKeyDown={(e) => {
                                                    if (!jobSummaryPartsCostIsZero(teamFooterAmt)) {
                                                      jobSummaryDrilldownCellKeyboard(e, openFooterTeam)
                                                    }
                                                  }}
                                                >
                                                  {jobSummaryPartsCostIsZero(teamFooterAmt)
                                                    ? '—'
                                                    : `$${formatCurrency(teamFooterAmt)}`}
                                                </td>
                                                <td
                                                  className={jobSummaryBreakdownInteractiveClass(
                                                    !cardColLoading && !jobSummaryPartsCostIsZero(cardFooterAmt),
                                                  )}
                                                  style={{
                                                    padding: '0.25rem 0.4rem',
                                                    textAlign: 'right',
                                                    color: cardColLoading ? '#6b7280' : undefined,
                                                  }}
                                                  role={cardColLoading || jobSummaryPartsCostIsZero(cardFooterAmt) ? undefined : 'button'}
                                                  tabIndex={cardColLoading || jobSummaryPartsCostIsZero(cardFooterAmt) ? -1 : 0}
                                                  aria-label={
                                                    cardColLoading || jobSummaryPartsCostIsZero(cardFooterAmt) ? undefined : 'View card total'
                                                  }
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    openFooterCard()
                                                  }}
                                                  onKeyDown={(e) => {
                                                    if (!cardColLoading && !jobSummaryPartsCostIsZero(cardFooterAmt)) {
                                                      jobSummaryDrilldownCellKeyboard(e, openFooterCard)
                                                    }
                                                  }}
                                                >
                                                  {cardColLoading
                                                    ? '—'
                                                    : jobSummaryPartsCostIsZero(cardFooterAmt)
                                                      ? '—'
                                                      : `$${formatCurrency(cardFooterAmt)}`}
                                                </td>
                                                <td
                                                  className={jobSummaryBreakdownInteractiveClass(
                                                    !jobSummaryPartsCostIsZero(invoicesFromSupplyHouses),
                                                    'muted',
                                                  )}
                                                  style={{
                                                    padding: '0.25rem 0.4rem',
                                                    textAlign: 'right',
                                                    fontWeight: 600,
                                                  }}
                                                  role={jobSummaryPartsCostIsZero(invoicesFromSupplyHouses) ? undefined : 'button'}
                                                  tabIndex={jobSummaryPartsCostIsZero(invoicesFromSupplyHouses) ? -1 : 0}
                                                  aria-label={
                                                    jobSummaryPartsCostIsZero(invoicesFromSupplyHouses) ? undefined : 'View supply total'
                                                  }
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    openFooterSupply()
                                                  }}
                                                  onKeyDown={(e) => {
                                                    if (!jobSummaryPartsCostIsZero(invoicesFromSupplyHouses)) {
                                                      jobSummaryDrilldownCellKeyboard(e, openFooterSupply)
                                                    }
                                                  }}
                                                >
                                                  {jobSummaryPartsCostIsZero(invoicesFromSupplyHouses)
                                                    ? '—'
                                                    : `$${formatCurrency(invoicesFromSupplyHouses)}`}
                                                </td>
                                                <td
                                                  className={jobSummaryBreakdownInteractiveClass(
                                                    personSummaryFooterRowTotal != null &&
                                                      !jobSummaryPartsCostIsZero(personSummaryFooterRowTotal),
                                                  )}
                                                  style={{
                                                    padding: '0.25rem 0.4rem',
                                                    textAlign: 'right',
                                                  }}
                                                  role={
                                                    personSummaryFooterRowTotal == null ||
                                                    jobSummaryPartsCostIsZero(personSummaryFooterRowTotal)
                                                      ? undefined
                                                      : 'button'
                                                  }
                                                  tabIndex={
                                                    personSummaryFooterRowTotal == null ||
                                                    jobSummaryPartsCostIsZero(personSummaryFooterRowTotal)
                                                      ? -1
                                                      : 0
                                                  }
                                                  aria-label={
                                                    personSummaryFooterRowTotal == null ||
                                                    jobSummaryPartsCostIsZero(personSummaryFooterRowTotal)
                                                      ? undefined
                                                      : 'View grand total'
                                                  }
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    openFooterGrand()
                                                  }}
                                                  onKeyDown={(e) => {
                                                    if (
                                                      personSummaryFooterRowTotal != null &&
                                                      !jobSummaryPartsCostIsZero(personSummaryFooterRowTotal)
                                                    ) {
                                                      jobSummaryDrilldownCellKeyboard(e, openFooterGrand)
                                                    }
                                                  }}
                                                >
                                                  {personSummaryFooterRowTotal == null
                                                    ? '—'
                                                    : jobSummaryPartsCostIsZero(personSummaryFooterRowTotal)
                                                      ? '—'
                                                      : `$${formatCurrency(personSummaryFooterRowTotal)}`}
                                                </td>
                                              </tr>
                                                )
                                              })()}
                                            </tbody>
                                          </table>
                                          {ppPersonFooter != null &&
                                          !cardColLoading &&
                                          !jobSummaryPartsCostIsZero(cardCharges) &&
                                          Math.abs((sumCardF ?? 0) + unattributedCard - cardCharges) > 0.02 &&
                                          breakdownPersonQ.trim() === '' ? (
                                            <p style={{ margin: '0.35rem 0 0', fontSize: '0.72rem', color: '#b45309' }}>
                                              Per-person card totals may not match job card total; check attributions.
                                            </p>
                                          ) : null}
                                        </div>
                                      )}
                                    </section>
                                  )
                                })()}
                                <div style={{ display: 'grid', gap: '1rem' }}>
                                  <section>
                                    <details style={jobSummaryPartsCostDetailsBoxStyle}>
                                      <summary
                                        style={{
                                          cursor: 'pointer',
                                          fontWeight: 600,
                                          fontSize: '0.8125rem',
                                          color: '#374151',
                                          userSelect: 'none',
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        Team Labor{' '}
                                        <span style={{ fontWeight: 400 }}>
                                          {teamLaborCost === 0 ? '—' : `$${formatCurrency(teamLaborCost)}`}
                                        </span>
                                      </summary>
                                      <div style={{ marginTop: '0.5rem' }}>
                                    <div style={jobSummaryCostSectionBodyStyle}>
                                    {teamLaborRow && teamLaborRow.breakdown.length > 0 ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '100%', maxWidth: 560 }}>
                                        <table
                                          style={{
                                            width: '100%',
                                            borderCollapse: 'collapse',
                                            fontSize: '0.8125rem',
                                          }}
                                        >
                                          <thead>
                                            <tr style={{ background: '#f3f4f6' }}>
                                              <th style={{ padding: '0.35rem 0.5rem', textAlign: 'left' }}>Person</th>
                                              <th style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>Hours</th>
                                            </tr>
                                          </thead>
                                          {teamBreakdownFiltered.length === 0 && breakdownPersonQ.trim() !== '' ? (
                                            <tbody>
                                              <tr>
                                                <td colSpan={2} style={{ padding: '0.35rem 0.5rem', color: '#6b7280' }}>
                                                  No people match your search.
                                                </td>
                                              </tr>
                                            </tbody>
                                          ) : (
                                            teamBreakdownFiltered.map(({ b, i }) => {
                                            const personKey = `${job.id}::${i}`
                                            const personExpanded = jobSummaryTeamLaborPersonExpandedKeys.has(personKey)
                                            const togglePerson = () => {
                                              setJobSummaryTeamLaborPersonExpandedKeys((prev) => {
                                                const next = new Set(prev)
                                                if (next.has(personKey)) next.delete(personKey)
                                                else next.add(personKey)
                                                return next
                                              })
                                            }
                                            const sessionsForPerson =
                                              jobSummaryDetailClockLoaded && jobSummaryDetailClockSessions
                                                ? jobSummaryDetailClockSessions.filter(
                                                    (s) =>
                                                      normalizePersonNameKey(s.users?.name ?? '') ===
                                                      normalizePersonNameKey(b.personName),
                                                  )
                                                : []
                                            return (
                                              <Fragment key={personKey}>
                                                <tbody>
                                                  <tr
                                                    role="button"
                                                    tabIndex={0}
                                                    aria-expanded={personExpanded}
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                      togglePerson()
                                                    }}
                                                    onKeyDown={(e) => {
                                                      e.stopPropagation()
                                                      if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault()
                                                        togglePerson()
                                                      }
                                                    }}
                                                    style={{
                                                      borderTop: '1px solid #e5e7eb',
                                                      cursor: 'pointer',
                                                      background: personExpanded ? '#f3f4f6' : undefined,
                                                    }}
                                                  >
                                                    <td style={{ padding: '0.35rem 0.5rem' }}>
                                                      <span
                                                        style={{ marginRight: '0.35rem', color: '#6b7280', userSelect: 'none' }}
                                                        aria-hidden
                                                      >
                                                        {personExpanded ? '▼' : '▶'}
                                                      </span>
                                                      {b.personName}
                                                    </td>
                                                    <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>
                                                      {formatCurrency(b.hours)}
                                                    </td>
                                                  </tr>
                                                </tbody>
                                                {personExpanded ? (
                                                  <tbody>
                                                    <tr>
                                                      <td
                                                        colSpan={2}
                                                        style={{
                                                          padding: 0,
                                                          borderTop: '1px solid #e5e7eb',
                                                          background: '#fafafa',
                                                          verticalAlign: 'top',
                                                        }}
                                                      >
                                                        <div style={{ padding: '0.5rem 0.75rem' }}>
                                                          {(() => {
                                                            const combinedRows = buildJobSummaryTeamLaborWorkDateTableRows(
                                                              b.byWorkDate,
                                                              sessionsForPerson,
                                                            )
                                                            const clockLoaded = jobSummaryDetailClockLoaded
                                                            const showClockLoadingFooter =
                                                              !clockLoaded && combinedRows.length > 0
                                                            if (combinedRows.length === 0) {
                                                              return clockLoaded ? (
                                                                <p style={{ margin: 0, color: '#6b7280', fontSize: '0.75rem' }}>
                                                                  No crew allocation or clock sessions for this person.
                                                                </p>
                                                              ) : (
                                                                <p style={{ margin: 0, color: '#6b7280', fontSize: '0.75rem' }}>
                                                                  Loading clock sessions…
                                                                </p>
                                                              )
                                                            }
                                                            const allocTableTotals = combinedRows.reduce(
                                                              (acc, r) => {
                                                                if (r.kind === 'alloc') {
                                                                  acc.hours += r.hours
                                                                  acc.cost += r.cost
                                                                }
                                                                return acc
                                                              },
                                                              { hours: 0, cost: 0 },
                                                            )
                                                            return (
                                                              <>
                                                                <table
                                                                  style={{
                                                                    width: '100%',
                                                                    maxWidth: 560,
                                                                    borderCollapse: 'collapse',
                                                                    fontSize: '0.75rem',
                                                                  }}
                                                                >
                                                                  <thead>
                                                                    <tr style={{ background: '#f3f4f6' }}>
                                                                      <th style={{ padding: '0.25rem 0.4rem', textAlign: 'left' }}>
                                                                        Work date
                                                                      </th>
                                                                      <th style={{ padding: '0.25rem 0.4rem', textAlign: 'left' }}>
                                                                        In
                                                                      </th>
                                                                      <th style={{ padding: '0.25rem 0.4rem', textAlign: 'left' }}>
                                                                        Out
                                                                      </th>
                                                                      <th style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}>
                                                                        Duration
                                                                      </th>
                                                                      <th style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}>
                                                                        Hrs
                                                                      </th>
                                                                      <th style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}>
                                                                        $
                                                                      </th>
                                                                    </tr>
                                                                  </thead>
                                                                  <tbody>
                                                                    {combinedRows.map((row, idx) => {
                                                                      if (row.kind === 'alloc') {
                                                                        return (
                                                                          <tr
                                                                            key={`alloc-${row.workDate}-${idx}`}
                                                                            style={{ borderTop: '1px solid #e5e7eb' }}
                                                                          >
                                                                            <td style={{ padding: '0.25rem 0.4rem' }}>
                                                                              {isJobSummaryNoWorkDateKey(row.workDate)
                                                                                ? '—'
                                                                                : formatWorkDateYmdWeekdayLongFriendly(
                                                                                    row.workDate,
                                                                                  )}
                                                                            </td>
                                                                            <td style={{ padding: '0.25rem 0.4rem', color: '#9ca3af' }}>
                                                                              —
                                                                            </td>
                                                                            <td style={{ padding: '0.25rem 0.4rem', color: '#9ca3af' }}>
                                                                              —
                                                                            </td>
                                                                            <td style={{ padding: '0.25rem 0.4rem', color: '#9ca3af' }}>
                                                                              —
                                                                            </td>
                                                                            <td
                                                                              style={{
                                                                                padding: '0.25rem 0.4rem',
                                                                                textAlign: 'right',
                                                                              }}
                                                                            >
                                                                              {formatCurrency(row.hours)}
                                                                            </td>
                                                                            <td
                                                                              style={{
                                                                                padding: '0.25rem 0.4rem',
                                                                                textAlign: 'right',
                                                                              }}
                                                                            >
                                                                              ${formatCurrency(row.cost)}
                                                                            </td>
                                                                          </tr>
                                                                        )
                                                                      }
                                                                      const s = row.session
                                                                      const dur =
                                                                        s.clocked_in_at && s.clocked_out_at
                                                                          ? formatJobSummaryDurationMinutes(
                                                                              new Date(s.clocked_out_at).getTime() -
                                                                                new Date(s.clocked_in_at).getTime(),
                                                                            )
                                                                          : '—'
                                                                      return (
                                                                        <tr
                                                                          key={`punch-${s.id}-${idx}`}
                                                                          style={{ borderTop: '1px solid #e5e7eb' }}
                                                                        >
                                                                          <td style={{ padding: '0.25rem 0.4rem' }}>
                                                                            {isJobSummaryNoWorkDateKey(row.workDate)
                                                                              ? '—'
                                                                              : formatWorkDateYmdWeekdayLongFriendly(row.workDate)}
                                                                          </td>
                                                                          <td style={{ padding: '0.25rem 0.4rem' }}>
                                                                            {formatJobSummarySessionTimeOnly(s.clocked_in_at)}
                                                                          </td>
                                                                          <td style={{ padding: '0.25rem 0.4rem' }}>
                                                                            {formatJobSummarySessionTimeOnly(s.clocked_out_at)}
                                                                          </td>
                                                                          <td
                                                                            style={{
                                                                              padding: '0.25rem 0.4rem',
                                                                              textAlign: 'right',
                                                                            }}
                                                                          >
                                                                            {dur}
                                                                          </td>
                                                                          <td
                                                                            style={{
                                                                              padding: '0.25rem 0.4rem',
                                                                              textAlign: 'right',
                                                                              color: '#9ca3af',
                                                                            }}
                                                                          >
                                                                            —
                                                                          </td>
                                                                          <td
                                                                            style={{
                                                                              padding: '0.25rem 0.4rem',
                                                                              textAlign: 'right',
                                                                              color: '#9ca3af',
                                                                            }}
                                                                          >
                                                                            —
                                                                          </td>
                                                                        </tr>
                                                                      )
                                                                    })}
                                                                  </tbody>
                                                                  <tfoot>
                                                                    <tr
                                                                      style={{
                                                                        borderTop: '1px solid #d1d5db',
                                                                        fontWeight: 600,
                                                                        background: '#f9fafb',
                                                                      }}
                                                                    >
                                                                      <td
                                                                        colSpan={4}
                                                                        style={{ padding: '0.25rem 0.4rem' }}
                                                                      >
                                                                        Total
                                                                      </td>
                                                                      <td
                                                                        style={{
                                                                          padding: '0.25rem 0.4rem',
                                                                          textAlign: 'right',
                                                                        }}
                                                                      >
                                                                        {formatCurrency(allocTableTotals.hours)}
                                                                      </td>
                                                                      <td
                                                                        style={{
                                                                          padding: '0.25rem 0.4rem',
                                                                          textAlign: 'right',
                                                                        }}
                                                                      >
                                                                        ${formatCurrency(allocTableTotals.cost)}
                                                                      </td>
                                                                    </tr>
                                                                  </tfoot>
                                                                </table>
                                                                {showClockLoadingFooter ? (
                                                                  <p
                                                                    style={{
                                                                      margin: '0.35rem 0 0',
                                                                      color: '#6b7280',
                                                                      fontSize: '0.72rem',
                                                                    }}
                                                                  >
                                                                    Loading clock sessions…
                                                                  </p>
                                                                ) : null}
                                                              </>
                                                            )
                                                          })()}
                                                        </div>
                                                      </td>
                                                    </tr>
                                                  </tbody>
                                                ) : null}
                                              </Fragment>
                                            )
                                          })
                                          )}
                                          <tbody>
                                            <tr style={{ borderTop: '1px solid #d1d5db', fontWeight: 600 }}>
                                              <td style={{ padding: '0.35rem 0.5rem' }}>Total</td>
                                              <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>
                                                {formatCurrency(teamLaborRow.manHours)}
                                              </td>
                                            </tr>
                                          </tbody>
                                        </table>
                                        {(() => {
                                          const clockSessions = jobSummaryDetailClockSessions ?? []
                                          const clockLoaded = jobSummaryDetailClockLoaded
                                          if (!clockLoaded || teamLaborRow.breakdown.length === 0) return null
                                          const nameKeys = new Set(
                                            teamLaborRow.breakdown.map((x) => normalizePersonNameKey(x.personName)),
                                          )
                                          let orphan = clockSessions.filter((s) => {
                                            const kn = normalizePersonNameKey(s.users?.name ?? '')
                                            if (!kn) return true
                                            return !nameKeys.has(kn)
                                          })
                                          if (breakdownPersonQ.trim() !== '') {
                                            orphan = orphan.filter((s) =>
                                              personMatchesJobSummaryBreakdownFilter(s.users?.name, breakdownPersonQ),
                                            )
                                          }
                                          if (orphan.length === 0) return null
                                          return (
                                            <div
                                              style={{
                                                border: '1px solid #fde68a',
                                                borderRadius: 6,
                                                padding: '0.5rem 0.75rem',
                                                background: '#fffbeb',
                                              }}
                                            >
                                              <div style={{ fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.8125rem' }}>
                                                Sessions not matched to a name above
                                              </div>
                                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                                                <thead>
                                                  <tr style={{ background: '#fef3c7' }}>
                                                    <th style={{ padding: '0.25rem 0.4rem', textAlign: 'left' }}>User</th>
                                                    <th style={{ padding: '0.25rem 0.4rem', textAlign: 'left' }}>Work date</th>
                                                    <th style={{ padding: '0.25rem 0.4rem', textAlign: 'left' }}>In</th>
                                                    <th style={{ padding: '0.25rem 0.4rem', textAlign: 'left' }}>Out</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {orphan.map((s) => (
                                                    <tr key={s.id} style={{ borderTop: '1px solid #fde68a' }}>
                                                      <td style={{ padding: '0.25rem 0.4rem' }}>{s.users?.name ?? '—'}</td>
                                                      <td style={{ padding: '0.25rem 0.4rem' }}>
                                                        {s.work_date
                                                          ? formatWorkDateYmdWeekdayLongFriendly(s.work_date)
                                                          : '—'}
                                                      </td>
                                                      <td style={{ padding: '0.25rem 0.4rem' }}>
                                                        {formatJobSummarySessionDateTime(s.clocked_in_at)}
                                                      </td>
                                                      <td style={{ padding: '0.25rem 0.4rem' }}>
                                                        {formatJobSummarySessionDateTime(s.clocked_out_at)}
                                                      </td>
                                                    </tr>
                                                  ))}
                                                </tbody>
                                              </table>
                                            </div>
                                          )
                                        })()}
                                      </div>
                                    ) : teamLaborCost === 0 ? (
                                      <p style={{ margin: 0, color: '#6b7280' }}>No team labor for this job.</p>
                                    ) : (
                                      <p style={{ margin: 0, color: '#6b7280' }}>Team labor total ${formatCurrency(teamLaborCost)} (no per-person breakdown).</p>
                                    )}
                                    </div>
                                      </div>
                                    </details>
                                  </section>
                                  <section>
                                    <details style={jobSummaryPartsCostDetailsBoxStyle}>
                                      <summary
                                        style={{
                                          cursor: 'pointer',
                                          fontWeight: 600,
                                          fontSize: '0.8125rem',
                                          color: '#374151',
                                          userSelect: 'none',
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        Sub Labor{' '}
                                        <span style={{ fontWeight: 400 }}>
                                          {subLaborCost === 0 ? '—' : `$${formatCurrency(subLaborCost)}`}
                                        </span>
                                      </summary>
                                      <div style={{ marginTop: '0.5rem' }}>
                                    <div style={jobSummaryCostSectionBodyStyle}>
                                    {subLaborJobs.length > 0 ? (
                                      subLaborJobsFiltered.length === 0 && breakdownPersonQ.trim() !== '' ? (
                                        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.8125rem' }}>
                                          No people match your search.
                                        </p>
                                      ) : (
                                        <ul style={{ margin: 0, paddingLeft: '1.1rem', color: '#374151' }}>
                                          {subLaborJobsFiltered.map((lj) => {
                                            const c = laborJobSubCost(lj, mileageCost, timePerMile)
                                            return (
                                              <li key={lj.id} style={{ marginBottom: '0.25rem' }}>
                                                {lj.assigned_to_name ?? 'Contractor'}
                                                {lj.job_date ? ` · ${lj.job_date}` : ''}
                                                : ${formatCurrency(c)}
                                              </li>
                                            )
                                          })}
                                        </ul>
                                      )
                                    ) : (
                                      <p style={{ margin: 0, color: '#6b7280' }}>No sub labor for this HCP.</p>
                                    )}
                                    </div>
                                      </div>
                                    </details>
                                  </section>
                                  <section>
                                    <details style={jobSummaryPartsCostDetailsBoxStyle}>
                                      <summary
                                        style={{
                                          cursor: 'pointer',
                                          fontWeight: 600,
                                          fontSize: '0.8125rem',
                                          color: '#374151',
                                          userSelect: 'none',
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        Parts Cost{' '}
                                        <span style={{ fontWeight: 400 }}>
                                          {partsCost === 0 ? '—' : `$${formatCurrency(partsCost)}`}
                                        </span>
                                      </summary>
                                      <div style={{ marginTop: '0.5rem' }}>
                                    <div style={jobSummaryCostSectionBodyStyle}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                      {jobSummaryPartsCostIsZero(partsFromTally) ? (
                                        <div style={jobSummaryPartsCostFlatRowStyle}>
                                          Parts from Tally{' '}
                                          <span style={{ fontWeight: 400 }}>${formatCurrency(partsFromTally)}</span>
                                        </div>
                                      ) : (
                                        <details style={jobSummaryPartsCostDetailsBoxStyle}>
                                          <summary
                                            style={{
                                              cursor: 'pointer',
                                              fontWeight: 600,
                                              fontSize: '0.8125rem',
                                              color: '#374151',
                                              userSelect: 'none',
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            Parts from Tally{' '}
                                            <span style={{ fontWeight: 400 }}>${formatCurrency(partsFromTally)}</span>
                                          </summary>
                                          <div style={{ marginTop: '0.5rem' }}>
                                            {tallyPartsForJob.length > 0 ? (
                                              <table style={{ width: '100%', maxWidth: 560, borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                                                <thead>
                                                  <tr style={{ background: '#f3f4f6' }}>
                                                    <th style={{ padding: '0.25rem 0.4rem', textAlign: 'left' }}>Fixture / Part</th>
                                                    <th style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}>Qty</th>
                                                    <th style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}>Line cost</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {tallyPartsForJob.map((r) => {
                                                    const lineCost =
                                                      r.part_id == null
                                                        ? Number(r.fixture_cost ?? 0) * Number(r.quantity)
                                                        : Number(r.price_at_time ?? 0) * Number(r.quantity)
                                                    const label =
                                                      r.part_id == null
                                                        ? r.fixture_name || 'Fixture'
                                                        : [r.part_name, r.fixture_name].filter(Boolean).join(' · ') || 'Part'
                                                    return (
                                                      <tr key={r.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                                                        <td style={{ padding: '0.25rem 0.4rem' }}>{label}</td>
                                                        <td style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}>{r.quantity}</td>
                                                        <td style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}>${formatCurrency(lineCost)}</td>
                                                      </tr>
                                                    )
                                                  })}
                                                </tbody>
                                              </table>
                                            ) : partsFromTally > 0 ? (
                                              <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>
                                                Total reflects tally data; no line rows for this job in the current view.
                                              </p>
                                            ) : (
                                              <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>No tally parts.</p>
                                            )}
                                          </div>
                                        </details>
                                      )}
                                      {jobSummaryPartsCostIsZero(billedMaterialsSum) ? (
                                        <div style={jobSummaryPartsCostFlatRowStyle}>
                                          Other job charges{' '}
                                          <span style={{ fontWeight: 400 }}>${formatCurrency(billedMaterialsSum)}</span>
                                        </div>
                                      ) : (
                                      <details style={jobSummaryPartsCostDetailsBoxStyle}>
                                        <summary
                                          style={{
                                            cursor: 'pointer',
                                            fontWeight: 600,
                                            fontSize: '0.8125rem',
                                            color: '#374151',
                                            userSelect: 'none',
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          Other job charges{' '}
                                          <span style={{ fontWeight: 400 }}>${formatCurrency(billedMaterialsSum)}</span>
                                        </summary>
                                        <div style={{ marginTop: '0.5rem' }}>
                                          {(() => {
                                            const matRows = [...(job.materials ?? [])].sort(
                                              (a, b) => a.sequence_order - b.sequence_order,
                                            )
                                            if (matRows.length > 0) {
                                              return matRows.map((m) => (
                                                <div
                                                  key={m.id}
                                                  style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    gap: '0.5rem',
                                                    fontSize: '0.75rem',
                                                    padding: '0.25rem 0',
                                                    borderTop: '1px solid #f3f4f6',
                                                  }}
                                                >
                                                  <span style={{ color: '#374151' }}>{m.description?.trim() || '—'}</span>
                                                  <span style={{ whiteSpace: 'nowrap' }}>${formatCurrency(Number(m.amount ?? 0))}</span>
                                                </div>
                                              ))
                                            }
                                            if (billedMaterialsSum > 0) {
                                              return (
                                                <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>
                                                  No material line items on file for this job.
                                                </p>
                                              )
                                            }
                                            return (
                                              <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>No other job charges.</p>
                                            )
                                          })()}
                                        </div>
                                      </details>
                                      )}
                                      {jobSummaryPartsCostIsZero(invoicesFromSupplyHouses) ? (
                                        <div style={jobSummaryPartsCostFlatRowStyle}>
                                          Invoices from Supply Houses{' '}
                                          <span style={{ fontWeight: 400 }}>${formatCurrency(invoicesFromSupplyHouses)}</span>
                                        </div>
                                      ) : (
                                      <details
                                        style={jobSummaryPartsCostDetailsBoxStyle}
                                        onToggle={(e) => {
                                          if (!e.currentTarget.open) return
                                          void loadJobSummaryInvoiceLinesForJob(job.id)
                                        }}
                                      >
                                        <summary
                                          style={{
                                            cursor: 'pointer',
                                            fontWeight: 600,
                                            fontSize: '0.8125rem',
                                            color: '#374151',
                                            userSelect: 'none',
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          Invoices from Supply Houses{' '}
                                          <span style={{ fontWeight: 400 }}>${formatCurrency(invoicesFromSupplyHouses)}</span>
                                        </summary>
                                        <div style={{ marginTop: '0.5rem' }}>
                                          {renderJobSummarySupplyHouseInvoiceTableContent(
                                            jobSummaryInvoiceLinesByJobId.has(job.id),
                                            jobSummaryInvoiceLinesByJobId.get(job.id) ?? [],
                                            invoicesFromSupplyHouses,
                                          )}
                                        </div>
                                      </details>
                                      )}
                                      {jobSummaryPartsCostIsZero(cardCharges) ? (
                                        <div style={jobSummaryPartsCostFlatRowStyle}>
                                          Card charges{' '}
                                          <span style={{ fontWeight: 400 }}>${formatCurrency(cardCharges)}</span>
                                        </div>
                                      ) : (
                                      <details
                                        style={jobSummaryPartsCostDetailsBoxStyle}
                                        onToggle={(e) => {
                                          if (!e.currentTarget.open) return
                                          void loadJobSummaryMercuryAllocationsForJob(job.id)
                                        }}
                                      >
                                        <summary
                                          style={{
                                            cursor: 'pointer',
                                            fontWeight: 600,
                                            fontSize: '0.8125rem',
                                            color: '#374151',
                                            userSelect: 'none',
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          Card charges <span style={{ fontWeight: 400 }}>${formatCurrency(cardCharges)}</span>
                                        </summary>
                                        <div style={{ marginTop: '0.5rem' }}>
                                          {(() => {
                                            const mLoaded = jobSummaryMercuryAllocationsByJobId.has(job.id)
                                            const mRows = jobSummaryMercuryAllocationsByJobId.get(job.id) ?? []
                                            if (!mLoaded) {
                                              return (
                                                <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>Loading…</p>
                                              )
                                            }
                                            if (mRows.length === 0) {
                                              return (
                                                <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>
                                                  {cardCharges > 0
                                                    ? 'No card allocation rows returned (check access).'
                                                    : 'No Mercury card allocations for this job.'}
                                                </p>
                                              )
                                            }
                                            return (
                                              <table style={{ width: '100%', maxWidth: 760, borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                                                <thead>
                                                  <tr style={{ background: '#f3f4f6' }}>
                                                    <th style={{ padding: '0.25rem 0.4rem', textAlign: 'left' }}>Posted</th>
                                                    <th style={{ padding: '0.25rem 0.4rem', textAlign: 'left' }}>Counterparty</th>
                                                    <th style={{ padding: '0.25rem 0.4rem', textAlign: 'left' }}>User</th>
                                                    <th style={{ padding: '0.25rem 0.4rem', textAlign: 'left' }}>Debit Card</th>
                                                    <th style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}>Allocated</th>
                                                    <th style={{ padding: '0.25rem 0.4rem', textAlign: 'left' }}>Note</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {mRows.map((row) => {
                                                    const tx = row.mercury_transactions
                                                    const posted = tx?.posted_at
                                                      ? formatJobSummaryMercuryPostedAt(tx.posted_at)
                                                      : '—'
                                                    const allocAbs = Math.abs(Number(row.amount ?? 0))
                                                    const debitCardId = mercuryDebitCardIdFromRaw(tx?.raw ?? null)
                                                    const debitCardLabel =
                                                      debitCardId != null
                                                        ? nicknameByDebitCard[debitCardId] ??
                                                          formatMercuryDebitCardIdCompact(debitCardId)
                                                        : '—'
                                                    return (
                                                      <tr key={row.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                                                        <td style={{ padding: '0.25rem 0.4rem' }}>{posted}</td>
                                                        <td style={{ padding: '0.25rem 0.4rem' }}>{tx?.counterparty_name ?? '—'}</td>
                                                        <td style={{ padding: '0.25rem 0.4rem' }}>
                                                          {row.attributionDisplayName ?? '—'}
                                                        </td>
                                                        <td style={{ padding: '0.25rem 0.4rem' }}>{debitCardLabel}</td>
                                                        <td style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}>
                                                          ${formatCurrency(allocAbs)}
                                                        </td>
                                                        <td style={{ padding: '0.25rem 0.4rem', color: '#4b5563' }}>
                                                          {[row.note, tx?.note, tx?.external_memo].filter(Boolean).join(' · ') || '—'}
                                                        </td>
                                                      </tr>
                                                    )
                                                  })}
                                                </tbody>
                                              </table>
                                            )
                                          })()}
                                        </div>
                                      </details>
                                      )}
                                      {(!jobSummaryPartsCostIsZero(partsFromTally) || !jobSummaryPartsCostIsZero(cardCharges)) && (
                                        <details
                                          style={jobSummaryPartsCostDetailsBoxStyle}
                                          onToggle={(e) => {
                                            if (!e.currentTarget.open) return
                                            if (!jobSummaryPartsCostIsZero(cardCharges)) {
                                              void loadJobSummaryMercuryAllocationsForJob(job.id)
                                            }
                                          }}
                                        >
                                          <summary
                                            style={{
                                              cursor: 'pointer',
                                              fontWeight: 600,
                                              fontSize: '0.8125rem',
                                              color: '#374151',
                                              userSelect: 'none',
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            Cost by person (tally & card)
                                          </summary>
                                          <div style={{ marginTop: '0.5rem' }}>
                                            <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.45 }}>
                                              Other job charges and supply house invoices are job-level only (not split by person), same as
                                              the Parts tab.
                                            </p>
                                            {(() => {
                                              const tallyRollup: TallyLineForPersonRollup[] = tallyPartsForJob.map((r) => ({
                                                part_id: r.part_id,
                                                quantity: r.quantity,
                                                price_at_time: r.price_at_time,
                                                fixture_cost: r.fixture_cost,
                                                created_by_user_id: r.created_by_user_id,
                                                created_by_name: r.created_by_name,
                                              }))
                                              const needMercury = !jobSummaryPartsCostIsZero(cardCharges)
                                              const mLoaded = jobSummaryMercuryAllocationsByJobId.has(job.id)
                                              if (needMercury && !mLoaded) {
                                                return (
                                                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>Loading…</p>
                                                )
                                              }
                                              const mRows = needMercury
                                                ? (jobSummaryMercuryAllocationsByJobId.get(job.id) ?? [])
                                                : []
                                              const { rows: ppRows, footer: ppFooter, sumsOk: ppSumsOk } =
                                                buildPartsPerPersonCostRows({
                                                  parts: tallyRollup,
                                                  billedMaterialsSum,
                                                  invoiceJobTotal: invoicesFromSupplyHouses,
                                                  mercuryRows: mRows,
                                                  parentCardTotal: cardCharges,
                                                })
                                              const ppRowsFiltered = ppRows.filter((row) =>
                                                personMatchesJobSummaryBreakdownFilter(row.displayName, breakdownPersonQ),
                                              )
                                              if (
                                                ppRows.length === 0 &&
                                                jobSummaryPartsCostIsZero(ppFooter.partsFromTally) &&
                                                jobSummaryPartsCostIsZero(ppFooter.cardCharges)
                                              ) {
                                                return (
                                                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>
                                                    No per-person tally or card amounts for this job.
                                                  </p>
                                                )
                                              }
                                              return (
                                                <div style={{ overflowX: 'auto' }}>
                                                  {breakdownPersonQ.trim() !== '' ? (
                                                    <p
                                                      style={{
                                                        margin: '0 0 0.5rem',
                                                        fontSize: '0.72rem',
                                                        color: '#6b7280',
                                                        lineHeight: 1.45,
                                                      }}
                                                    >
                                                      Totals include everyone; table rows are filtered.
                                                    </p>
                                                  ) : null}
                                                  <table
                                                    style={{
                                                      width: '100%',
                                                      maxWidth: 560,
                                                      borderCollapse: 'collapse',
                                                      fontSize: '0.75rem',
                                                    }}
                                                  >
                                                    <thead>
                                                      <tr style={{ background: '#f3f4f6' }}>
                                                        <th style={{ padding: '0.25rem 0.4rem', textAlign: 'left' }}>Person</th>
                                                        <th style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}>
                                                          Parts from Tally
                                                        </th>
                                                        <th style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}>Card charges</th>
                                                        <th style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}>Row total</th>
                                                      </tr>
                                                    </thead>
                                                    <tbody>
                                                      {ppRowsFiltered.length === 0 && breakdownPersonQ.trim() !== '' ? (
                                                        <tr>
                                                          <td
                                                            colSpan={4}
                                                            style={{
                                                              padding: '0.25rem 0.4rem',
                                                              color: '#6b7280',
                                                              borderTop: '1px solid #e5e7eb',
                                                            }}
                                                          >
                                                            No people match your search.
                                                          </td>
                                                        </tr>
                                                      ) : (
                                                        ppRowsFiltered.map((row) => {
                                                          const rt = row.partsFromTally + row.cardCharges
                                                          return (
                                                            <tr key={row.key} style={{ borderTop: '1px solid #e5e7eb' }}>
                                                              <td style={{ padding: '0.25rem 0.4rem' }}>{row.displayName}</td>
                                                              <td style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}>
                                                                {jobSummaryPartsCostIsZero(row.partsFromTally)
                                                                  ? '—'
                                                                  : `$${formatCurrency(row.partsFromTally)}`}
                                                              </td>
                                                              <td style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}>
                                                                {jobSummaryPartsCostIsZero(row.cardCharges)
                                                                  ? '—'
                                                                  : `$${formatCurrency(row.cardCharges)}`}
                                                              </td>
                                                              <td style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}>
                                                                {jobSummaryPartsCostIsZero(rt) ? '—' : `$${formatCurrency(rt)}`}
                                                              </td>
                                                            </tr>
                                                          )
                                                        })
                                                      )}
                                                      <tr style={{ borderTop: '1px solid #d1d5db', fontWeight: 600 }}>
                                                        <td style={{ padding: '0.25rem 0.4rem' }}>{ppFooter.displayName}</td>
                                                        <td style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}>
                                                          ${formatCurrency(ppFooter.partsFromTally)}
                                                        </td>
                                                        <td style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}>
                                                          ${formatCurrency(ppFooter.cardCharges)}
                                                        </td>
                                                        <td style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}>
                                                          $
                                                          {formatCurrency(ppFooter.partsFromTally + ppFooter.cardCharges)}
                                                        </td>
                                                      </tr>
                                                    </tbody>
                                                  </table>
                                                  {(billedMaterialsSum > 0 || invoicesFromSupplyHouses > 0) && (
                                                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.72rem', color: '#6b7280' }}>
                                                      Job-level (not in table above): other job charges $
                                                      {formatCurrency(billedMaterialsSum)} · supply invoices $
                                                      {formatCurrency(invoicesFromSupplyHouses)}
                                                    </p>
                                                  )}
                                                  {!ppSumsOk && (
                                                    <p style={{ margin: '0.35rem 0 0', fontSize: '0.72rem', color: '#b45309' }}>
                                                      Row totals may not match job-level parts totals; check attributions and line items.
                                                    </p>
                                                  )}
                                                </div>
                                              )
                                            })()}
                                          </div>
                                        </details>
                                      )}
                                    </div>
                                    </div>
                                      </div>
                                    </details>
                                  </section>
                                  <section>
                                    <details style={jobSummaryPartsCostDetailsBoxStyle}>
                                      <summary
                                        style={{
                                          cursor: 'pointer',
                                          fontWeight: 600,
                                          fontSize: '0.8125rem',
                                          color: '#374151',
                                          userSelect: 'none',
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        Total Bill{' '}
                                        <span style={{ fontWeight: 400 }}>
                                          {totalBill === 0 ? '—' : `$${formatCurrency(totalBill)}`}
                                        </span>
                                      </summary>
                                      <div style={{ marginTop: '0.5rem' }}>
                                        <div style={jobSummaryCostSectionBodyStyle}>
                                          <p style={{ margin: 0, color: '#374151' }}>
                                            Revenue (billing):{' '}
                                            {totalBill === 0 ? '—' : `$${formatCurrency(totalBill)}`}
                                          </p>
                                        </div>
                                      </div>
                                    </details>
                                  </section>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )
                        return [mainRow, detailRow]
                      })}
                </tbody>
              </table>
            </div>
          )}
          <div
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1rem',
              border: '1px solid #e5e7eb',
              borderRadius: 4,
              background: '#f9fafb',
              fontSize: '0.875rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
            }}
          >
            <label
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                color: '#374151',
              }}
            >
              <span>Only include jobs with HCP # greater than</span>
              <input
                type="number"
                min={-1}
                step={1}
                value={jobSummaryMinHcpExclusive}
                onChange={(e) => {
                  const v = e.target.valueAsNumber
                  if (e.target.value === '' || Number.isNaN(v) || v < -1) return
                  setJobSummaryMinHcpExclusive(v)
                  writeJobSummaryMinHcpExclusiveToStorage(v)
                }}
                style={{ width: '5.5rem', padding: '0.35rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
              />
            </label>
            {jobSummaryLedgerAllJobs != null && jobSummaryLedgerJobs != null && (
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>
                Showing {jobSummaryLedgerJobs.length} of {jobSummaryLedgerAllJobs.length} jobs after filter.
              </p>
            )}
            <p
              style={{
                margin: jobSummaryLedgerAllJobs != null && jobSummaryLedgerJobs != null ? '0.35rem 0 0 0' : '0.5rem 0 0 0',
                maxWidth: '42rem',
                fontSize: '0.8125rem',
                color: '#6b7280',
              }}
            >
              Jobs with no HCP # (or a non-numeric HCP) are always included. Set to −1 to include every HCP #.
            </p>
          </div>
        </div>
  )
}
