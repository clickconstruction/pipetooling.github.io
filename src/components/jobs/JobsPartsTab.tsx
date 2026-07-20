import { type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { useNavigate } from 'react-router-dom'
import { type UserRole } from '../../hooks/useAuth'
import { isSubcontractorLikeRole } from '../../lib/subcontractorLikeRole'
import { formatCurrency } from '../../lib/jobs/jobFormatting'
import { buildPartsPerPersonCostRows } from '../../lib/partsPerPersonCostSummary'
import type { TallyPartRow } from '../../types/tallyPart'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { MercuryJobAllocationWithAttributionRow } from '../../lib/fetchMercuryJobAllocationsWithAttributionForJob'

/**
 * Presentational Parts tab (jobs ledger "parts" view). The shared tally-parts data lives in the parent's
 * usePartsLedgerData hook, and the Mercury card-charge substrate is shared with the Job Summary tab, so all of
 * that state/handlers/modals stay in the parent and arrive here as props. Only the search box is tab-local.
 */
export type JobsPartsTabProps = {
  error: string | null
  authRole: UserRole | null
  myRole: string | null
  jobs: JobWithDetails[]
  /** From usePartsLedgerData (parent-owned; also consumed by the Job Summary tab). */
  tallyParts: TallyPartRow[]
  tallyPartsLoading: boolean
  invoiceAmountByJob: Record<string, number>
  deletingTallyPartId: string | null
  updatingFixtureCostId: string | null
  deleteTallyPart: (id: string) => void
  updateFixtureCost: (id: string, cost: number) => void
  /** Search lives in the parent because the editParts URL effect resets it. */
  tallyPartsSearch: string
  setTallyPartsSearch: (v: string) => void
  /** Filters/expansion live in the parent because parent effects/memos read them. */
  showMyJobsOnly: boolean
  setShowMyJobsOnly: (v: boolean) => void
  myJobIds: Set<string> | null
  expandedPartsJobIds: Set<string>
  setExpandedPartsJobIds: Dispatch<SetStateAction<Set<string>>>
  /** Mercury card-charge substrate, shared with the Job Summary tab. */
  mercuryCardChargesByJobId: Map<string, number>
  partsTabMercuryAllocationsByJobId: Map<string, MercuryJobAllocationWithAttributionRow[]>
  canAccessBankingForParts: boolean
  partsUnattribFlowJobIdRef: MutableRefObject<string | null>
  setPartsUnattribListJobId: (jobId: string | null) => void
  /** Parent renders the all-jobs unattributed modal; this just toggles it. */
  allJobsUnattributedOpen: boolean
  setAllJobsUnattributedOpen: (v: boolean) => void
}

export default function JobsPartsTab({
  error,
  authRole,
  myRole,
  jobs,
  tallyParts,
  tallyPartsLoading,
  invoiceAmountByJob,
  deletingTallyPartId,
  updatingFixtureCostId,
  deleteTallyPart,
  updateFixtureCost,
  tallyPartsSearch,
  setTallyPartsSearch,
  showMyJobsOnly,
  setShowMyJobsOnly,
  myJobIds,
  expandedPartsJobIds,
  setExpandedPartsJobIds,
  mercuryCardChargesByJobId,
  partsTabMercuryAllocationsByJobId,
  canAccessBankingForParts,
  partsUnattribFlowJobIdRef,
  setPartsUnattribListJobId,
  allJobsUnattributedOpen,
  setAllJobsUnattributedOpen,
}: JobsPartsTabProps) {
  const navigate = useNavigate()

  return (
    <div>
      {error && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error}</p>}
      <div
        style={{
          marginBottom: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
          width: '100%',
          minWidth: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', flex: '1 1 0', minWidth: 0 }}>
          <input
            type="search"
            placeholder="Search HCP, job name, fixture, part name…"
            value={tallyPartsSearch}
            onChange={(e) => setTallyPartsSearch(e.target.value)}
            style={{
              flex: '1 1 200px',
              minWidth: 200,
              maxWidth: '100%',
              padding: '0.5rem 0.75rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              fontSize: '0.875rem',
            }}
          />
          {!isSubcontractorLikeRole(authRole as UserRole) && !isSubcontractorLikeRole(myRole as UserRole) && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 400, fontSize: '0.875rem', cursor: 'pointer', flexShrink: 0 }}>
              <input
                type="checkbox"
                checked={showMyJobsOnly}
                onChange={(e) => setShowMyJobsOnly(e.target.checked)}
              />
              Show my jobs only
            </label>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            if (allJobsUnattributedOpen) setAllJobsUnattributedOpen(false)
            else setAllJobsUnattributedOpen(true)
          }}
          style={{
            fontSize: '0.875rem',
            fontWeight: 500,
            padding: '0.4rem 0.75rem',
            borderRadius: 4,
            border: `1px solid ${allJobsUnattributedOpen ? '#2563eb' : 'var(--border-strong)'}`,
            background: allJobsUnattributedOpen ? 'var(--bg-blue-tint)' : 'var(--surface)',
            color: allJobsUnattributedOpen ? 'var(--text-blue-700)' : 'var(--text-700)',
            cursor: 'pointer',
            flexShrink: 0,
            marginLeft: 'auto',
          }}
        >
          Unattributed
        </button>
      </div>
      {tallyPartsLoading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 4 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead style={{ background: 'var(--bg-subtle)' }}>
              <tr>
                <th style={{ padding: '0.75rem', width: 32, borderBottom: '1px solid var(--border)' }}></th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>HCP</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Job</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Parts from Tally</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Other job charges</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Invoices from Supply Houses</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Card charges</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Total Parts Cost</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Parts</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                let filtered = tallyParts
                if (showMyJobsOnly && myJobIds) {
                  filtered = filtered.filter((r) => myJobIds.has(r.job_id))
                }
                const q = tallyPartsSearch.trim().toLowerCase()
                if (q) {
                  filtered = filtered.filter((r) => {
                    const hcp = (r.hcp_number ?? '').toLowerCase()
                    const job = (r.job_name ?? '').toLowerCase()
                    const fixture = (r.fixture_name ?? '').toLowerCase()
                    const part = (r.part_name ?? '').toLowerCase()
                    const mfr = (r.part_manufacturer ?? '').toLowerCase()
                    return hcp.includes(q) || job.includes(q) || fixture.includes(q) || part.includes(q) || mfr.includes(q)
                  })
                }
                const byJob = new Map<string, TallyPartRow[]>()
                for (const r of filtered) {
                  const list = byJob.get(r.job_id) ?? []
                  list.push(r)
                  byJob.set(r.job_id, list)
                }
                const jobRowsFromTally = Array.from(byJob.entries()).map(([jobId, parts]) => {
                  const first = parts[0]
                  if (!first) return null
                  return { jobId, hcpNumber: first.hcp_number, jobName: first.job_name, parts }
                }).filter((r): r is NonNullable<typeof r> => r != null)
                const jobIdsFromTally = new Set(jobRowsFromTally.map((r) => r.jobId))
                const materialsOnlyJobs = jobs.filter(
                  (j) =>
                    (j.materials?.length ?? 0) > 0 &&
                    !jobIdsFromTally.has(j.id) &&
                    (!showMyJobsOnly || !myJobIds || myJobIds.has(j.id)) &&
                    (!q ||
                      (j.hcp_number ?? '').toLowerCase().includes(q) ||
                      (j.job_name ?? '').toLowerCase().includes(q))
                )
                const invoicesOnlyJobs = jobs.filter(
                  (j) =>
                    (invoiceAmountByJob[j.id] ?? 0) > 0 &&
                    !jobIdsFromTally.has(j.id) &&
                    (j.materials?.length ?? 0) === 0 &&
                    (!showMyJobsOnly || !myJobIds || myJobIds.has(j.id)) &&
                    (!q ||
                      (j.hcp_number ?? '').toLowerCase().includes(q) ||
                      (j.job_name ?? '').toLowerCase().includes(q))
                )
                const materialsOnlyRows = materialsOnlyJobs.map((j) => ({
                  jobId: j.id,
                  hcpNumber: j.hcp_number ?? null,
                  jobName: j.job_name ?? null,
                  parts: [] as TallyPartRow[],
                }))
                const invoicesOnlyRows = invoicesOnlyJobs.map((j) => ({
                  jobId: j.id,
                  hcpNumber: j.hcp_number ?? null,
                  jobName: j.job_name ?? null,
                  parts: [] as TallyPartRow[],
                }))
                const materialsOnlyJobIds = new Set(materialsOnlyJobs.map((j) => j.id))
                const invoicesOnlyJobIds = new Set(invoicesOnlyJobs.map((j) => j.id))
                const cardChargesOnlyJobs = jobs.filter(
                  (j) =>
                    (mercuryCardChargesByJobId.get(j.id) ?? 0) !== 0 &&
                    !jobIdsFromTally.has(j.id) &&
                    !materialsOnlyJobIds.has(j.id) &&
                    !invoicesOnlyJobIds.has(j.id) &&
                    (!showMyJobsOnly || !myJobIds || myJobIds.has(j.id)) &&
                    (!q ||
                      (j.hcp_number ?? '').toLowerCase().includes(q) ||
                      (j.job_name ?? '').toLowerCase().includes(q)),
                )
                const cardChargesOnlyRows = cardChargesOnlyJobs.map((j) => ({
                  jobId: j.id,
                  hcpNumber: j.hcp_number ?? null,
                  jobName: j.job_name ?? null,
                  parts: [] as TallyPartRow[],
                }))
                const jobRows = [...jobRowsFromTally, ...materialsOnlyRows, ...invoicesOnlyRows, ...cardChargesOnlyRows].sort((a, b) => {
                  const ha = (a.hcpNumber ?? '').trim()
                  const hb = (b.hcpNumber ?? '').trim()
                  return -ha.localeCompare(hb, undefined, { numeric: true })
                })
                if (jobRows.length === 0) {
                  return (
                    <tr>
                      <td colSpan={9} style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                        No tally parts yet. Subs can record parts via the Job Parts Tally flow on the Dashboard.
                      </td>
                    </tr>
                  )
                }
                return jobRows.flatMap(({ jobId, hcpNumber, jobName, parts }) => {
                  const expanded = expandedPartsJobIds.has(jobId)
                  const job = jobs.find((j) => j.id === jobId)
                  const billedMaterialsSum = (job?.materials ?? []).reduce((s, m) => s + Number(m.amount ?? 0), 0)
                  const cardCharges = mercuryCardChargesByJobId.get(jobId) ?? 0
                  const partsTotal = parts.reduce((sum, r) => {
                    if (r.part_id == null) {
                      return sum + (Number(r.fixture_cost ?? 0) * Number(r.quantity))
                    }
                    return sum + (Number(r.price_at_time ?? 0) * Number(r.quantity))
                  }, 0)
                  const hasUnpricedFixture = parts.some(
                    (r) => r.part_id == null && (r.fixture_cost == null || Number(r.fixture_cost) === 0)
                  )
                  const toggle = () => {
                    setExpandedPartsJobIds((prev) => {
                      const next = new Set(prev)
                      if (next.has(jobId)) next.delete(jobId)
                      else next.add(jobId)
                      return next
                    })
                  }
                  return [
                    <tr
                      key={jobId}
                      data-job-id={jobId}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        cursor: 'pointer',
                        background: hasUnpricedFixture ? '#fef2f2' : expanded ? 'var(--bg-subtle)' : undefined,
                      }}
                      onClick={toggle}
                    >
                      <td style={{ padding: '0.75rem', width: 32 }}>
                        {expanded ? '▼' : '▶'}
                      </td>
                      <td style={{ padding: '0.75rem' }}>{hcpNumber ?? '—'}</td>
                      <td style={{ padding: '0.75rem' }}>{jobName ?? '—'}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 500 }}>{formatCurrency(partsTotal)}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatCurrency(billedMaterialsSum)}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatCurrency(invoiceAmountByJob[jobId] ?? 0)}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatCurrency(cardCharges)}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 500 }}>
                        {formatCurrency(partsTotal + billedMaterialsSum + (invoiceAmountByJob[jobId] ?? 0) + cardCharges)}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>{parts.length}</td>
                    </tr>,
                    ...(expanded
                      ? [
                          <tr key={`${jobId}-parts`}>
                            <td colSpan={9} style={{ padding: 0, borderBottom: '1px solid var(--border)', background: 'var(--surface)', verticalAlign: 'top' }}>
                              {(() => {
                                const invAmt = invoiceAmountByJob[jobId] ?? 0
                                const needMercury = cardCharges > 0
                                const cardBreakdownNotReady = needMercury && !partsTabMercuryAllocationsByJobId.has(jobId)
                                if (cardBreakdownNotReady) {
                                  return (
                                    <div
                                      style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}
                                    >
                                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        Loading card breakdown…
                                      </p>
                                    </div>
                                  )
                                }
                                const mRows = needMercury
                                  ? (partsTabMercuryAllocationsByJobId.get(jobId) ?? [])
                                  : []
                                const { rows: pRows, footer: pFooter, sumsOk: pSumsOk } = buildPartsPerPersonCostRows({
                                  parts,
                                  billedMaterialsSum,
                                  invoiceJobTotal: invAmt,
                                  mercuryRows: mRows,
                                  parentCardTotal: cardCharges,
                                })
                                if (partsTotal + billedMaterialsSum + invAmt + cardCharges <= 0) return null
                                return (
                                  <div
                                    style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div
                                      style={{
                                        fontWeight: 600,
                                        fontSize: '0.8125rem',
                                        marginBottom: '0.5rem',
                                        color: 'var(--text-strong)',
                                      }}
                                    >
                                      Cost by person
                                    </div>
                                    <div style={{ overflowX: 'auto' }}>
                                      <table
                                        style={{
                                          width: '100%',
                                          maxWidth: 880,
                                          borderCollapse: 'collapse',
                                          fontSize: '0.75rem',
                                        }}
                                      >
                                        <thead>
                                          <tr style={{ background: 'var(--bg-muted)' }}>
                                            <th style={{ padding: '0.35rem 0.5rem', textAlign: 'left' }}>Person</th>
                                            <th style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>Parts from Tally</th>
                                            <th style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>Other job charges</th>
                                            <th style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>Invoices from Supply Houses</th>
                                            <th style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>Card charges</th>
                                            <th style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>Row total</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {pRows.map((row) => {
                                            const rt =
                                              row.partsFromTally +
                                              row.otherJobCharges +
                                              row.invoicesFromSupply +
                                              row.cardCharges
                                            return (
                                              <tr
                                                key={row.key}
                                                style={{ borderTop: '1px solid var(--border)' }}
                                              >
                                                <td style={{ padding: '0.35rem 0.5rem' }}>
                                                  {row.displayName === 'Unattributed' &&
                                                  row.cardCharges > 0 &&
                                                  canAccessBankingForParts ? (
                                                    <button
                                                      type="button"
                                                      onClick={(e) => {
                                                        e.stopPropagation()
                                                        partsUnattribFlowJobIdRef.current = jobId
                                                        setPartsUnattribListJobId(jobId)
                                                      }}
                                                      style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        padding: 0,
                                                        margin: 0,
                                                        font: 'inherit',
                                                        color: 'var(--text-link)',
                                                        cursor: 'pointer',
                                                        textDecoration: 'underline',
                                                        textUnderlineOffset: '2px',
                                                      }}
                                                    >
                                                      Unattributed — assign
                                                    </button>
                                                  ) : row.displayName === 'Unattributed' && row.cardCharges > 0 ? (
                                                    <span>
                                                      Unattributed{' '}
                                                      <span style={{ color: 'var(--text-faint)', fontSize: '0.7rem' }}>
                                                        (set on Banking)
                                                      </span>
                                                    </span>
                                                  ) : (
                                                    row.displayName
                                                  )}
                                                </td>
                                                <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>
                                                  ${formatCurrency(row.partsFromTally)}
                                                </td>
                                                <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>
                                                  ${formatCurrency(row.otherJobCharges)}
                                                </td>
                                                <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>
                                                  ${formatCurrency(row.invoicesFromSupply)}
                                                </td>
                                                <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>
                                                  ${formatCurrency(row.cardCharges)}
                                                </td>
                                                <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', fontWeight: 500 }}>
                                                  ${formatCurrency(rt)}
                                                </td>
                                              </tr>
                                            )
                                          })}
                                          <tr
                                            style={{
                                              borderTop: '1px solid var(--border)',
                                              fontWeight: 600,
                                              background: 'var(--bg-subtle)',
                                            }}
                                          >
                                            <td style={{ padding: '0.35rem 0.5rem' }}>Total</td>
                                            <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>
                                              ${formatCurrency(pFooter.partsFromTally)}
                                            </td>
                                            <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>
                                              ${formatCurrency(pFooter.otherJobCharges)}
                                            </td>
                                            <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>
                                              ${formatCurrency(pFooter.invoicesFromSupply)}
                                            </td>
                                            <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>
                                              ${formatCurrency(pFooter.cardCharges)}
                                            </td>
                                            <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>
                                              $
                                              {formatCurrency(
                                                pFooter.partsFromTally +
                                                  pFooter.otherJobCharges +
                                                  pFooter.invoicesFromSupply +
                                                  pFooter.cardCharges,
                                              )}
                                            </td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </div>
                                    <p
                                      style={{
                                        margin: '0.5rem 0 0 0',
                                        fontSize: '0.7rem',
                                        color: 'var(--text-muted)',
                                        lineHeight: 1.4,
                                        maxWidth: 880,
                                      }}
                                    >
                                      {`"Other job charges" and "Invoices from Supply Houses" are job-level in the data model (not split by who entered them). Card lines use the same Banking attribution you set on the Mercury transaction. Unattributed card amounts show under Unattributed.`}
                                    </p>
                                    {!pSumsOk && (
                                      <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.7rem', color: 'var(--text-amber-700)' }}>
                                        These totals do not match the main row. Try refreshing, or check Mercury access.
                                      </p>
                                    )}
                                  </div>
                                )
                              })()}
                              {parts.length > 0 && (
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                <thead>
                                  <tr style={{ background: 'var(--bg-muted)' }}>
                                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Fixture</th>
                                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Part</th>
                                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Qty</th>
                                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Price</th>
                                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Purchase Order</th>
                                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Entered by</th>
                                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Date</th>
                                    <th style={{ padding: '0.5rem 0.75rem', width: 1 }}></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {parts.map((r) => (
                                    <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
                                      <td style={{ padding: '0.5rem 0.75rem' }}>{r.fixture_name || '—'}</td>
                                      <td style={{ padding: '0.5rem 0.75rem' }}>
                                        {r.part_id == null ? (
                                          <span style={{ color: '#15803d', fontWeight: 500 }}>Fixture (sent for pricing)</span>
                                        ) : (
                                          <>
                                            {r.part_name ?? '—'}
                                            {r.part_manufacturer ? ` (${r.part_manufacturer})` : ''}
                                          </>
                                        )}
                                      </td>
                                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{Number(r.quantity)}</td>
                                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                                        {r.part_id == null ? (
                                          <input
                                            key={`${r.id}-${r.fixture_cost ?? ''}`}
                                            type="number"
                                            min={0}
                                            step={0.01}
                                            defaultValue={r.fixture_cost ?? ''}
                                            onBlur={(e) => {
                                              const v = parseFloat((e.target as HTMLInputElement).value)
                                              if (!Number.isNaN(v) && v >= 0) {
                                                updateFixtureCost(r.id, v)
                                              }
                                            }}
                                            disabled={updatingFixtureCostId === r.id}
                                            placeholder="Enter cost"
                                            style={{
                                              width: 80,
                                              padding: '0.25rem 0.5rem',
                                              fontSize: '0.8125rem',
                                              border: '1px solid var(--border-strong)',
                                              borderRadius: 4,
                                            }}
                                          />
                                        ) : r.purchase_order_id && r.price_at_time != null ? (
                                          <button
                                            type="button"
                                            onClick={() => navigate(`/materials?tab=purchase-orders&po=${r.purchase_order_id}`)}
                                            style={{
                                              background: 'none',
                                              border: 'none',
                                              padding: 0,
                                              cursor: 'pointer',
                                              color: 'var(--text-link)',
                                              textDecoration: 'underline',
                                              fontSize: 'inherit',
                                            }}
                                          >
                                            {formatCurrency(Number(r.price_at_time))}
                                          </button>
                                        ) : (
                                          '—'
                                        )}
                                      </td>
                                      <td style={{ padding: '0.5rem 0.75rem' }}>
                                        {r.purchase_order_name
                                          ? `${r.purchase_order_name}${r.purchase_order_status ? ` [${r.purchase_order_status === 'finalized' ? 'Finalized' : 'Draft'}]` : ''}`
                                          : '—'}
                                      </td>
                                      <td style={{ padding: '0.5rem 0.75rem' }}>{r.created_by_name ?? '—'}</td>
                                      <td style={{ padding: '0.5rem 0.75rem' }}>{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</td>
                                      <td style={{ padding: '0.5rem 0.75rem' }}>
                                        <button
                                          type="button"
                                          onClick={() => deleteTallyPart(r.id)}
                                          disabled={deletingTallyPartId === r.id}
                                          style={{
                                            padding: '0.25rem 0.5rem',
                                            fontSize: '0.75rem',
                                            background: 'var(--bg-red-100)',
                                            color: 'var(--text-red-800)',
                                            border: 'none',
                                            borderRadius: 4,
                                            cursor: deletingTallyPartId === r.id ? 'not-allowed' : 'pointer',
                                          }}
                                        >
                                          {deletingTallyPartId === r.id ? '…' : 'Delete'}
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              )}
                              {job && job.materials.length > 0 && (
                                <div style={{ padding: '0.75rem', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
                                  <div style={{ fontWeight: 500, fontSize: '0.8125rem', marginBottom: '0.5rem' }}>Other job charges</div>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                    <thead>
                                      <tr style={{ background: 'var(--bg-muted)' }}>
                                        <th style={{ padding: '0.35rem 0.5rem', textAlign: 'left' }}>Description</th>
                                        <th style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>Amount ($)</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {job.materials
                                        .filter((m) => (m.description ?? '').trim() || Number(m.amount) !== 0)
                                        .map((m) => (
                                          <tr key={m.id} style={{ borderTop: '1px solid var(--border)' }}>
                                            <td style={{ padding: '0.35rem 0.5rem' }}>{m.description?.trim() || 'Item'}</td>
                                            <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>{formatCurrency(Number(m.amount ?? 0))}</td>
                                          </tr>
                                        ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </td>
                          </tr>,
                        ]
                      : []),
                  ]
                })
              })()}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
