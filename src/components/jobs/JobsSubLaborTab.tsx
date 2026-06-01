import { useState } from 'react'
import { formatCurrency } from '../../lib/jobs/jobFormatting'
import { laborItemsSubtotal, lineLaborCost } from '../../lib/peopleLaborJobItemLineCost'
import { normalizeUrl } from '../../lib/projectsForecastStageLineItems'
import type {
  LaborJob,
  SubLaborBackchargeTarget,
  SubLaborPaymentTarget,
} from '../../types/laborJob'

export type JobsSubLaborTabProps = {
  error: string | null
  subLaborSearch: string
  onSubLaborSearchChange: (value: string) => void
  laborJobs: LaborJob[]
  laborJobsLoading: boolean
  laborJobNamesByHcp: Record<string, string>
  subLaborDueTotal: number
  myRole: string | null
  onNewLaborJob: () => void
  onEditLaborJob: (job: LaborJob) => void
  /** Load mileage/drive settings (parent-owned) then open the Drive Settings modal. */
  onOpenDriveSettings: () => void
  /** Load the default labor rate (parent-owned) then open its modal. Dev only. */
  onOpenDefaultLaborRate: () => void
  onPrintJobSubSheet: (job: LaborJob) => void
  onUpdateLaborJobDate: (id: string, date: string | null) => void
  /** Seed + open the parent-owned Make Payment modal. */
  onOpenMakePayment: (target: SubLaborPaymentTarget, defaultAmount: string) => void
  /** Seed + open the parent-owned Backcharge modal. */
  onOpenBackcharge: (target: SubLaborBackchargeTarget) => void
}

export default function JobsSubLaborTab({
  error,
  subLaborSearch,
  onSubLaborSearchChange,
  laborJobs,
  laborJobsLoading,
  laborJobNamesByHcp,
  subLaborDueTotal,
  myRole,
  onNewLaborJob,
  onEditLaborJob,
  onOpenDriveSettings,
  onOpenDefaultLaborRate,
  onPrintJobSubSheet,
  onUpdateLaborJobDate,
  onOpenMakePayment,
  onOpenBackcharge,
}: JobsSubLaborTabProps) {
  const [expandedSubLaborJobIds, setExpandedSubLaborJobIds] = useState<Set<string>>(new Set())

  return (
    <div>
      {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="search"
          placeholder="Search contractor, HCP, address…"
          value={subLaborSearch}
          onChange={(e) => onSubLaborSearchChange(e.target.value)}
          style={{ flex: '1 1 200px', minWidth: 200, maxWidth: 400, padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
        />
        <button
          type="button"
          onClick={onNewLaborJob}
          style={{ padding: '0.35rem 0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
        >
          New Sub Labor
        </button>
        <button
          type="button"
          onClick={onOpenDriveSettings}
          style={{ padding: '0.35rem 0.75rem', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
        >
          Drive Settings
        </button>
        {myRole === 'dev' && (
          <button
            type="button"
            onClick={onOpenDefaultLaborRate}
            style={{ padding: '0.35rem 0.75rem', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
          >
            Default Labor Rate
          </button>
        )}
        </div>
        <div style={{ fontSize: '1rem', fontWeight: 600 }}>
          Sub Labor Due: ${formatCurrency(subLaborDueTotal)}
        </div>
      </div>
      {laborJobsLoading ? (
        <p style={{ color: '#6b7280' }}>Loading sub sheet ledger…</p>
      ) : laborJobs.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No jobs yet. Click New Sub Labor to add one.</p>
      ) : (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'auto', WebkitOverflowScrolling: 'touch', minWidth: 0 }}>
          <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead style={{ background: '#f9fafb' }}>
              <tr>
                <th style={{ padding: '0.75rem', width: 32, borderBottom: '1px solid #e5e7eb' }} />
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Contractor</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Job</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Total cost</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Due</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Sub Sheet</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Date</th>
                <th style={{ padding: '0.75rem', width: 80, borderBottom: '1px solid #e5e7eb' }} />
              </tr>
            </thead>
            <tbody>
              {laborJobs
                .filter((job) => {
                  const q = subLaborSearch.trim().toLowerCase()
                  if (!q) return true
                  const contractor = (job.assigned_to_name ?? '').toLowerCase()
                  const hcp = (job.job_number ?? '').toLowerCase()
                  const addr = (job.address ?? '').toLowerCase()
                  const jobName = laborJobNamesByHcp[(job.job_number ?? '').trim().toLowerCase()]?.toLowerCase() ?? ''
                  return contractor.includes(q) || hcp.includes(q) || addr.includes(q) || jobName.includes(q)
                })
                .flatMap((job) => {
                const jobRate = job.labor_rate ?? 0
                const laborTotal = laborItemsSubtotal(job.items, jobRate)
                let totalCost = laborTotal
                const jobPayments = job.payments ?? []
                const paid = jobPayments.filter((p) => Number(p.amount) >= 0).reduce((s, p) => s + Number(p.amount), 0)
                const backcharges = jobPayments.filter((p) => Number(p.amount) < 0).reduce((s, p) => s + Math.abs(Number(p.amount)), 0)
                if (totalCost === 0 && (paid > 0 || backcharges > 0)) {
                  totalCost = paid + backcharges
                }
                const balance = totalCost - paid - backcharges
                const dateInputValue = job.job_date ?? (job.created_at ? job.created_at.slice(0, 10) : '')
                const expanded = expandedSubLaborJobIds.has(job.id)
                const toggle = () => {
                  setExpandedSubLaborJobIds((prev) => {
                    const next = new Set(prev)
                    if (next.has(job.id)) next.delete(job.id)
                    else next.add(job.id)
                    return next
                  })
                }
                return [
                  <tr
                    key={job.id}
                    style={{ borderBottom: '1px solid #e5e7eb', cursor: 'pointer', background: expanded ? '#f9fafb' : undefined }}
                    onClick={toggle}
                  >
                    <td style={{ padding: '0.75rem', width: 32 }}>{expanded ? '▼' : '▶'}</td>
                    <td style={{ padding: '0.75rem' }}>{job.assigned_to_name}</td>
                    <td style={{ padding: '0.75rem', maxWidth: 220 }}>
                      <div style={{ lineHeight: 1.4 }}>
                        <div style={{ fontWeight: 500 }}>
                          {job.job_number ?? '—'}
                          {laborJobNamesByHcp[(job.job_number ?? '').trim().toLowerCase()] ? (
                            <> | {laborJobNamesByHcp[(job.job_number ?? '').trim().toLowerCase()]}</>
                          ) : null}
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 2 }}>
                          {job.address ? (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: '#2563eb', textDecoration: 'none' }}
                              title={job.address}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {job.address}
                            </a>
                          ) : (
                            '—'
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>{totalCost > 0 ? `$${formatCurrency(totalCost)}` : '—'}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.8125rem' }}>
                      {totalCost > 0 ? (
                        balance > 0 ? (
                          <span style={{ color: '#b91c1c' }}>${formatCurrency(balance)} due</span>
                        ) : balance < 0 ? (
                          <span style={{ color: '#059669' }}>Over ${formatCurrency(-balance)}</span>
                        ) : (
                          <span style={{ color: '#059669' }}>Paid</span>
                        )
                      ) : '—'}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <button type="button" onClick={() => onPrintJobSubSheet(job)} style={{ padding: '0.25rem 0.5rem', background: '#6b7280', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem' }}>
                        Print
                      </button>
                    </td>
                    <td style={{ padding: '0.75rem' }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="date"
                        value={dateInputValue}
                        onChange={(e) => onUpdateLaborJobDate(job.id, e.target.value || null)}
                        style={{ padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
                      />
                    </td>
                    <td style={{ padding: '0.75rem', verticalAlign: 'middle' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'stretch' }}>
                        <button
                          type="button"
                          onClick={() => onOpenMakePayment({ id: job.id, contractor: job.assigned_to_name, hcp: job.job_number ?? '—', totalCost, paid, outstanding: Math.max(0, balance) }, balance > 0 ? String(balance) : '')}
                          style={{ padding: '0.25rem 0.5rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem' }}
                        >
                          Payment
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenBackcharge({ id: job.id, contractor: job.assigned_to_name, hcp: job.job_number ?? '—', totalCost, paid })}
                          style={{ padding: '0.25rem 0.5rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem' }}
                        >
                          Backcharge
                        </button>
                        <button type="button" onClick={() => onEditLaborJob(job)} style={{ padding: '0.25rem 0.5rem', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem' }}>
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>,
                  ...(expanded
                    ? [
                        <tr key={`${job.id}-expand`}>
                          <td colSpan={8} style={{ padding: 0, borderBottom: '1px solid #e5e7eb', background: '#fff', verticalAlign: 'top' }}>
                            <div onClick={(e) => e.stopPropagation()} style={{ padding: '1rem' }}>
                              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', fontWeight: 500 }}>
                                Total cost: ${formatCurrency(totalCost)} · Paid: ${formatCurrency(paid)} · Backcharges: ${formatCurrency(backcharges)}
                              </p>
                              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem' }}>Invoice link</h4>
                              {job.invoice_link?.trim() ? (
                                <p style={{ margin: '0 0 1rem', fontSize: '0.875rem' }}>
                                  <a
                                    href={normalizeUrl(job.invoice_link)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: '#2563eb', textDecoration: 'none' }}
                                  >
                                    {job.invoice_link}
                                  </a>
                                </p>
                              ) : (
                                <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#9ca3af' }}>No invoice linked.</p>
                              )}
                              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem' }}>Specific Work (Line Items)</h4>
                              <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden', marginBottom: '1rem' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                  <thead style={{ background: '#f9fafb' }}>
                                    <tr>
                                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Fixture</th>
                                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Count</th>
                                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>hrs/unit</th>
                                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Labor Hours</th>
                                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Rate</th>
                                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Cost</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(job.items ?? []).map((i, idx) => {
                                      const hrs = Number(i.hrs_per_unit) || 0
                                      const laborHrs = (i.is_fixed ?? false) ? hrs : (Number(i.count) || 0) * hrs
                                      const rate = i.labor_rate != null ? Number(i.labor_rate) : jobRate
                                      const cost = lineLaborCost(i, jobRate)
                                      const isDirect =
                                        i.direct_labor_amount != null && Number.isFinite(Number(i.direct_labor_amount))
                                      return (
                                        <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                          <td style={{ padding: '0.5rem 0.75rem' }}>{i.fixture ?? '—'}</td>
                                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>{isDirect ? '—' : Number(i.count)}</td>
                                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>{isDirect ? '—' : hrs.toFixed(2)}</td>
                                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>{isDirect ? '—' : laborHrs.toFixed(2)}</td>
                                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{isDirect ? '—' : `$${rate.toFixed(2)}`}</td>
                                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>${formatCurrency(cost)}</td>
                                        </tr>
                                      )
                                    })}
                                    {(job.items ?? []).length === 0 && (
                                      <tr><td colSpan={6} style={{ padding: '0.75rem', color: '#9ca3af', fontSize: '0.875rem' }}>No line items yet</td></tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem' }}>Payments</h4>
                              <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                  <thead style={{ background: '#f9fafb' }}>
                                    <tr>
                                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Date</th>
                                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Type</th>
                                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Amount</th>
                                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Memo</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(job.payments ?? []).map((p) => (
                                      <tr key={p.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                        <td style={{ padding: '0.5rem 0.75rem' }}>{p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}</td>
                                        <td style={{ padding: '0.5rem 0.75rem', color: Number(p.amount) < 0 ? '#dc2626' : undefined }}>{Number(p.amount) < 0 ? 'Backcharge' : 'Payment'}</td>
                                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: Number(p.amount) < 0 ? '#dc2626' : undefined }}>${formatCurrency(Number(p.amount))}</td>
                                        <td style={{ padding: '0.5rem 0.75rem' }}>{p.memo?.trim() ? p.memo : '—'}</td>
                                      </tr>
                                    ))}
                                    {(job.payments ?? []).length === 0 && (
                                      <tr><td colSpan={4} style={{ padding: '0.75rem', color: '#9ca3af', fontSize: '0.875rem' }}>No payments yet</td></tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>,
                      ]
                    : []),
                ]
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
