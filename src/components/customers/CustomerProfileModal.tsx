import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToastContext } from '../../contexts/ToastContext'
import { useJobDetailModal } from '../../contexts/JobDetailModalContext'
import { useBidPreview } from '../../contexts/BidPreviewModalContext'
import { useEditCustomerModal } from '../../contexts/EditCustomerModalContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { denverWorkDateToday } from '../../lib/salaryScheduleSync'
import { extractContactFromCustomer } from '../../lib/jobs/jobFormCustomerDisplay'
import { jobsLedgerStatusDotColor, labelJobsLedgerStatusForDashboard } from '../../lib/jobsLedgerStatusPipeline'
import { bidOutcomeDotColor } from '../../lib/bidOutcomeDotColor'
import { estimateStatusDotColor } from '../../lib/estimateStatusDotColor'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { customerDaysToPay, customerMoneyStats, profileJobRowMoney, sortProfileJobsForList } from '../../lib/customers/customerProfileStats'
import {
  bidClock,
  bidDisplayValue,
  bidOutcomeSummary,
  estimateStatusShortLabel,
  sortProfileBids,
} from '../../lib/customers/customerProfileRails'
import { fetchCustomerProfile, type CustomerProfileData } from '../../lib/customers/fetchCustomerProfile'
import { fetchJobActivityEventsForJobLedger } from '../../lib/fetchJobActivityEventsForJobLedger'
import type { JobActivityEventRpcRow } from '../../lib/jobActivityEventsFromRpc'
import GcHardHatIcon from '../icons/GcHardHatIcon'

/**
 * Customer profile modal (v2.1322): everything the app knows about one
 * customer, opened from the Stages row customer icon (and reusable anywhere
 * via CustomerProfileModalContext). Contact band (tel:/mailto:/maps), the
 * money strip (open balance + aging chip, lifetime collected, median
 * days-to-pay), and informative work LISTS (v2.2002 — owner: pills of bare
 * numbers weren't informative): money-first jobs, projects with their current
 * step, chase-first bids (value + address + due/sent clock), estimates with
 * dollars. Every row opens the EXISTING surface (Job Detail modal, workflow
 * route, Bid Preview, estimate page).
 *
 * The money strip renders for every role that can open the modal — today the
 * opener lives on the Stages board, whose viewers are exactly the office set
 * that already sees these dollars on the board itself.
 */

const money = (n: number) =>
  `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`

const capStyle: CSSProperties = {
  fontSize: '0.68rem',
  fontWeight: 700,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  color: 'var(--text-faint)',
  width: 72,
  flexShrink: 0,
}

function Dot({ color }: { color: string }) {
  return <span aria-hidden style={{ width: 8, height: 8, borderRadius: 9999, flexShrink: 0, background: color }} />
}

const JOBS_LIST_COLLAPSE_COUNT = 4
const BIDS_LIST_COLLAPSE_COUNT = 3

export default function CustomerProfileModal({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const navigate = useNavigate()
  const { showToast } = useToastContext()
  const jobDetail = useJobDetailModal()
  const bidPreview = useBidPreview()
  const editCustomer = useEditCustomerModal()

  const [data, setData] = useState<CustomerProfileData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [jobsExpanded, setJobsExpanded] = useState(false)
  const [bidsExpanded, setBidsExpanded] = useState(false)
  /** Recent activity across their newest jobs (v2.1985) — best-effort, loads after the profile. */
  const [activity, setActivity] = useState<Array<JobActivityEventRpcRow & { jobLabel: string }> | null>(null)

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(null)
    fetchCustomerProfile(customerId)
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(formatErrorMessage(e, 'Could not load customer'))
      })
    return () => {
      cancelled = true
    }
  }, [customerId])

  useEffect(() => {
    if (!data) return
    let cancelled = false
    // Latest few events across the newest 4 jobs (the per-job RPC applies
    // role gating server-side; a whole-customer feed would need a new RPC).
    const recent = data.jobs.slice(0, 4)
    if (recent.length === 0) {
      setActivity([])
      return
    }
    void Promise.all(recent.map((j) => fetchJobActivityEventsForJobLedger(j.id))).then((results) => {
      if (cancelled) return
      const merged = results.flatMap(({ data: rows }, i) => {
        const j = recent[i]!
        const jobLabel = effectiveJobLedgerNumber(j.hcp_number, j.click_number) || (j.job_name ?? '').trim() || 'job'
        return rows.map((r) => ({ ...r, jobLabel }))
      })
      merged.sort((a, b) => (b.occurred_at ?? '').localeCompare(a.occurred_at ?? ''))
      setActivity(merged.slice(0, 4))
    })
    return () => {
      cancelled = true
    }
  }, [data])

  const todayYmd = denverWorkDateToday()
  const stats = useMemo(() => (data ? customerMoneyStats(data.jobs, todayYmd) : null), [data, todayYmd])
  const daysToPay = useMemo(() => (data ? customerDaysToPay(data.jobs, todayYmd) : null), [data, todayYmd])

  const contact = data ? extractContactFromCustomer(data.customer) : { phone: '', email: '' }
  const address = (data?.customer.address ?? '').trim()
  const sinceLabel = useMemo(() => {
    const dm = (data?.customer.date_met ?? data?.customer.created_at ?? '').slice(0, 10)
    if (!dm) return null
    const d = new Date(`${dm}T12:00:00Z`)
    if (Number.isNaN(d.getTime())) return null
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
  }, [data])

  const agingChip = useMemo(() => {
    if (!stats) return null
    if (stats.aging.count90 > 0)
      return { label: `${stats.aging.count90} · ${money(stats.aging.sum90)} at 90+ days`, bg: 'var(--bg-red-tint)', fg: 'var(--text-red-600)' }
    if (stats.aging.count30_90 > 0)
      return { label: `${stats.aging.count30_90} · ${money(stats.aging.sum30_90)} at 30–90 days`, bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)' }
    if (stats.openBalance > 0.005) return { label: 'none 30+ days', bg: 'var(--bg-green-tint)', fg: 'var(--text-green-600)' }
    return null
  }, [stats])

  /** Jobs list (v2.1985): money-first order, per-row money on the openBalance basis. */
  const sortedJobs = useMemo(() => (data ? sortProfileJobsForList(data.jobs, todayYmd) : []), [data, todayYmd])
  const jobRowMoney = useMemo(
    () => new Map(sortedJobs.map((j) => [j.id, profileJobRowMoney(j, todayYmd)])),
    [sortedJobs, todayYmd],
  )
  const sortedBids = useMemo(() => (data ? sortProfileBids(data.bids, todayYmd) : []), [data, todayYmd])
  const visibleJobs = jobsExpanded ? sortedJobs : sortedJobs.slice(0, JOBS_LIST_COLLAPSE_COUNT)
  const hiddenJobs = sortedJobs.length - visibleJobs.length
  const hiddenOpenSum = sortedJobs.slice(visibleJobs.length).reduce((s, j) => s + (jobRowMoney.get(j.id)?.openBilled ?? 0), 0)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Customer profile"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70, padding: '1rem' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, width: 'min(660px, 100%)', maxHeight: '88vh', overflow: 'auto' }}
      >
        {error ? (
          <div style={{ padding: '1.25rem' }}>
            <p style={{ color: 'var(--text-red-600)', fontSize: '0.875rem', margin: 0 }}>{error}</p>
            <button type="button" onClick={onClose} style={{ marginTop: 12, padding: '0.4rem 0.9rem', border: '1px solid var(--border-strong)', borderRadius: 5, background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }}>
              Close
            </button>
          </div>
        ) : !data || !stats ? (
          <p style={{ padding: '1.25rem', color: 'var(--text-muted)', fontSize: '0.875rem' }} role="status">
            Loading customer…
          </p>
        ) : (
          <>
            {/* header */}
            <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-strong)' }}>{(data.customer.name ?? '').trim() || '—'}</h2>
                {data.customer.customer_type ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 9px', borderRadius: 9999, fontSize: '0.68rem', fontWeight: 700, background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)' }}>
                    {data.customer.customer_type === 'commercial' ? 'Commercial' : 'Residential'}
                  </span>
                ) : null}
                {data.gcJobCount > 0 ? (
                  <span
                    title="This customer is the GC/Builder on jobs"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 20, padding: '0 9px', borderRadius: 9999, fontSize: '0.68rem', fontWeight: 700, background: 'var(--bg-violet-100)', color: 'var(--text-violet-800)' }}
                  >
                    <GcHardHatIcon size={10} />
                    GC on {data.gcJobCount} job{data.gcJobCount === 1 ? '' : 's'}
                  </span>
                ) : null}
                {data.customer.archived_at ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 9px', borderRadius: 9999, fontSize: '0.68rem', fontWeight: 700, background: 'var(--bg-muted)', color: 'var(--text-muted)' }}>
                    Archived
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)', padding: 4 }}
                >
                  ×
                </button>
              </div>
              {sinceLabel || data.gcLastStatementSentAt ? (
                <div style={{ marginTop: 3, fontSize: '0.75rem', color: 'var(--text-faint)' }}>
                  {sinceLabel ? `Customer since ${sinceLabel}` : ''}
                  {sinceLabel && data.gcLastStatementSentAt ? ' · ' : ''}
                  {data.gcLastStatementSentAt
                    ? `statement last sent ${new Date(data.gcLastStatementSentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                    : ''}
                </div>
              ) : null}
            </div>

            {/* contact band */}
            {(contact.phone || contact.email || address || data.contactPersons.length > 0) && (
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', padding: '10px 20px', borderBottom: '1px solid var(--border)', fontSize: '0.83rem', alignItems: 'center' }}>
                {contact.phone && (
                  <a href={`tel:${contact.phone.replace(/[^+\d]/g, '')}`} style={{ color: 'var(--text-link)', textDecoration: 'none' }}>
                    📞 {contact.phone}
                  </a>
                )}
                {contact.email && (
                  <a href={`mailto:${contact.email}`} style={{ color: 'var(--text-link)', textDecoration: 'none' }}>
                    ✉ {contact.email}
                  </a>
                )}
                {address && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--text-link)', textDecoration: 'none' }}
                  >
                    📍 {address}
                  </a>
                )}
                {data.contactPersons.length > 0 && (
                  <span style={{ color: 'var(--text-faint)', fontSize: '0.75rem' }}>
                    · contact{data.contactPersons.length > 1 ? 's' : ''}: {data.contactPersons.map((c) => c.name).join(', ')}
                  </span>
                )}
              </div>
            )}

            {/* money strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', borderBottom: '1px solid var(--border)' }}>
              <div style={{ padding: '12px 16px', borderRight: '1px solid var(--border)' }}>
                <div style={capStyle}>Open balance</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: stats.openBalance > 0.005 ? 'var(--text-amber-800)' : 'var(--text-strong)' }}>
                  {money(stats.openBalance)}
                </div>
                {agingChip ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', height: 17, padding: '0 8px', borderRadius: 9999, fontSize: '0.66rem', fontWeight: 700, background: agingChip.bg, color: agingChip.fg, marginTop: 3 }}>
                    {agingChip.label}
                  </span>
                ) : null}
              </div>
              <div style={{ padding: '12px 16px', borderRight: '1px solid var(--border)' }}>
                <div style={capStyle}>Lifetime collected</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-strong)' }}>{money(stats.lifetimeCollected)}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  across {stats.jobCount} job{stats.jobCount === 1 ? '' : 's'}
                </div>
              </div>
              <div style={{ padding: '12px 16px' }}>
                <div style={capStyle}>Pays in</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: daysToPay ? 'var(--text-green-600)' : 'var(--text-faint)' }}>
                  {daysToPay ? `~${daysToPay.medianDays} day${daysToPay.medianDays === 1 ? '' : 's'}` : '—'}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  {daysToPay ? `median, last ${daysToPay.samples} payment${daysToPay.samples === 1 ? '' : 's'}` : 'no billed→paid history yet'}
                </div>
              </div>
            </div>

            {/* work rails */}
            <div style={{ padding: '14px 20px 6px' }}>
              {/* Jobs: money-aware list (v2.1985) — rows reconcile with the open balance. */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                  <span style={capStyle}>Jobs</span>
                  {sortedJobs.length > 0 && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-faint)' }}>click one to open Job Detail on top</span>
                  )}
                </div>
                {sortedJobs.length === 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>None yet.</span>}
                {visibleJobs.map((j) => {
                  const m = jobRowMoney.get(j.id)!
                  const stage = labelJobsLedgerStatusForDashboard(j.status ?? 'working')
                  // Money-first meta: an open bill describes ITSELF (billed <date> · age),
                  // whatever stage the job sits in; the status dot still shows the stage.
                  const meta = m.openBilled > 0.005
                    ? m.noBillDate
                      ? 'billed · no date'
                      : `billed ${m.oldestOpenBillYmd ? new Date(`${m.oldestOpenBillYmd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : ''}${m.ageDays != null ? ` · ${m.ageDays}d` : ''}`
                    : m.unbilled > 0.005
                      ? `${stage} · unbilled`
                      : stage
                  const metaColor = m.openBilled > 0.005 && m.ageDays != null && m.ageDays >= 90
                    ? 'var(--text-red-600)'
                    : m.openBilled > 0.005 && m.noBillDate
                      ? 'var(--text-amber-800)'
                      : 'var(--text-muted)'
                  return (
                    <div
                      key={j.id}
                      style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 10px', padding: '5px 2px', borderTop: '1px solid var(--border-job-row)', fontSize: '0.8125rem' }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <Dot color={jobsLedgerStatusDotColor(j.status ?? 'working')} />
                        <button
                          type="button"
                          onClick={() => jobDetail?.openJobDetail({ jobId: j.id })}
                          title="Open Job Detail on top"
                          style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', font: 'inherit', fontWeight: 600, color: 'var(--text-link)', textDecoration: 'underline', textUnderlineOffset: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '15rem' }}
                        >
                          {[effectiveJobLedgerNumber(j.hcp_number, j.click_number), (j.job_name ?? '').trim()].filter(Boolean).join(' · ') || 'Job'}
                        </button>
                      </span>
                      <span style={{ fontSize: '0.72rem', color: metaColor, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta}</span>
                      <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', fontWeight: m.ageDays != null && m.ageDays >= 90 ? 700 : 400, color: m.openBilled > 0.005 ? 'var(--text-strong)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {m.openBilled > 0.005 ? money(m.openBilled) : m.unbilled > 0.005 ? money(m.unbilled) : '—'}
                      </span>
                    </div>
                  )
                })}
                {hiddenJobs > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 2px', borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span style={{ fontStyle: 'italic' }}>
                      + {hiddenJobs} more{hiddenOpenSum > 0.005 ? ` · ${money(hiddenOpenSum)} open` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => setJobsExpanded(true)}
                      style={{ marginLeft: 'auto', padding: 0, border: 'none', background: 'none', cursor: 'pointer', font: 'inherit', fontSize: '0.75rem', color: 'var(--text-link)', textDecoration: 'underline', textUnderlineOffset: '2px' }}
                    >
                      show all
                    </button>
                  </div>
                )}
              </div>
              {/* Projects: full names + current step (v2.2002) */}
              {data.projects.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ ...capStyle, width: 'auto', marginBottom: 2 }}>Projects</div>
                  {data.projects.map((p) => {
                    const flag = p.attention?.flags[0]
                    const flagText = flag
                      ? flag.kind === 'waiting'
                        ? `waiting on ${flag.assignee} · ${flag.days}d`
                        : flag.kind === 'rejected'
                          ? 'step rejected'
                          : flag.kind === 'unassigned-current'
                            ? 'step unassigned'
                            : 'no schedule'
                      : null
                    return (
                      <div key={p.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 10px', padding: '5px 2px', borderTop: '1px solid var(--border-job-row)', fontSize: '0.8125rem' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <Dot color={p.attention?.current ? '#E87600' : 'var(--border-400)'} />
                          <button
                            type="button"
                            onClick={() => {
                              onClose()
                              navigate(`/workflows/${p.id}`)
                            }}
                            title="Open workflow"
                            style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', font: 'inherit', fontWeight: 600, color: 'var(--text-link)', textDecoration: 'underline', textUnderlineOffset: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '16rem' }}
                          >
                            {(p.name ?? '').trim() || 'Project'}
                          </button>
                        </span>
                        {p.attention?.current && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            step {p.attention.current.position}/{p.attention.total} · {p.attention.current.name}
                            {p.attention.current.assignee ? ` · ${p.attention.current.assignee}` : ''}
                          </span>
                        )}
                        {flagText && <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-amber-800)', whiteSpace: 'nowrap' }}>{flagText}</span>}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Bids: outcome summary + chase-first two-line rows (v2.2002) */}
              {data.bids.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
                    <span style={capStyle}>Bids</span>
                    {(() => {
                      const s = bidOutcomeSummary(data.bids)
                      return (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {s.total} total · <span style={{ color: 'var(--text-green-600)', fontWeight: 600 }}>{s.won} won</span> ·{' '}
                          <span style={{ color: 'var(--text-red-600)', fontWeight: 600 }}>{s.lost} lost</span> ·{' '}
                          <span style={{ color: 'var(--text-700)', fontWeight: 600 }}>{s.undecided} undecided</span>
                        </span>
                      )
                    })()}
                  </div>
                  {(bidsExpanded ? sortedBids : sortedBids.slice(0, BIDS_LIST_COLLAPSE_COUNT)).map((b) => {
                    const clock = bidClock(b, todayYmd)
                    const value = bidDisplayValue(b)
                    const clockColor =
                      clock.tone === 'due' || clock.tone === 'overdue'
                        ? 'var(--text-amber-800)'
                        : clock.tone === 'won'
                          ? 'var(--text-green-600)'
                          : clock.tone === 'lost'
                            ? 'var(--text-red-600)'
                            : 'var(--text-muted)'
                    return (
                      <div key={b.id} style={{ padding: '5px 2px', borderTop: '1px solid var(--border-job-row)', fontSize: '0.8125rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <Dot color={bidOutcomeDotColor(b.outcome)} />
                          <button
                            type="button"
                            onClick={() => bidPreview?.openBidPreview(b.id)}
                            title="Open bid preview"
                            style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', font: 'inherit', fontWeight: 600, color: 'var(--text-link)', textDecoration: 'underline', textUnderlineOffset: '2px', whiteSpace: 'nowrap' }}
                          >
                            {(b.bid_number ?? '').trim() || 'Bid'}
                          </button>
                          <span style={{ color: 'var(--text-muted)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {(b.project_name ?? '').trim()}
                          </span>
                          <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', fontWeight: clock.tone === 'won' ? 600 : 400, color: clock.tone === 'won' ? 'var(--text-green-600)' : 'var(--text-strong)', whiteSpace: 'nowrap' }}>
                            {value != null ? money(value) : '—'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, paddingLeft: 18, fontSize: '0.7rem', color: 'var(--text-faint)', minWidth: 0 }}>
                          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(b.address ?? '').trim()}</span>
                          <span style={{ marginLeft: 'auto', color: clockColor, fontWeight: clock.tone === 'due' || clock.tone === 'overdue' ? 600 : 400, whiteSpace: 'nowrap' }}>
                            {clock.text}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                  {!bidsExpanded && sortedBids.length > BIDS_LIST_COLLAPSE_COUNT && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 2px', borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span style={{ fontStyle: 'italic' }}>+ {sortedBids.length - BIDS_LIST_COLLAPSE_COUNT} more</span>
                      <button
                        type="button"
                        onClick={() => setBidsExpanded(true)}
                        style={{ marginLeft: 'auto', padding: 0, border: 'none', background: 'none', cursor: 'pointer', font: 'inherit', fontSize: '0.75rem', color: 'var(--text-link)', textDecoration: 'underline', textUnderlineOffset: '2px' }}
                      >
                        show all
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Estimates: number, title, status, dollars (v2.2002) */}
              {data.estimates.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ ...capStyle, width: 'auto', marginBottom: 2 }}>Estimates</div>
                  {data.estimates.map((est) => (
                    <div key={est.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 10px', padding: '5px 2px', borderTop: '1px solid var(--border-job-row)', fontSize: '0.8125rem' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <Dot color={estimateStatusDotColor(est.status)} />
                        <button
                          type="button"
                          onClick={() => {
                            onClose()
                            navigate(`/estimates/${est.estimate_number}`)
                          }}
                          title={`Open estimate #${est.estimate_number}`}
                          style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', font: 'inherit', fontWeight: 600, color: 'var(--text-link)', textDecoration: 'underline', textUnderlineOffset: '2px', whiteSpace: 'nowrap' }}
                        >
                          #{est.estimate_number}
                        </button>
                        <span style={{ color: 'var(--text-muted)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '13rem' }}>
                          {(est.title ?? '').trim()}
                        </span>
                      </span>
                      <span style={{ fontSize: '0.7rem', color: est.status === 'customer_accepted' ? 'var(--text-green-600)' : est.status === 'declined' ? 'var(--text-red-600)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {estimateStatusShortLabel(est.status)}
                      </span>
                      <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {est.total_cents > 0 ? money(est.total_cents / 100) : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* recent activity across their newest jobs (v2.1985) */}
            {activity && activity.length > 0 && (
              <div style={{ padding: '4px 20px 12px' }}>
                <div style={{ ...capStyle, width: 'auto', marginBottom: 4 }}>Recent activity</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', lineHeight: 1.45 }}>
                  {activity.map((ev) => (
                    <div key={ev.id} style={{ minWidth: 0 }}>
                      <span style={{ color: 'var(--text-faint)' }}>
                        {ev.occurred_at
                          ? new Date(ev.occurred_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          : ''}
                      </span>{' '}
                      <strong style={{ color: 'var(--text-700)' }}>{ev.actor_name || '—'}</strong>{' '}
                      <span style={{ color: 'var(--text-faint)' }}>on {ev.jobLabel} |</span>{' '}
                      <span style={{ color: 'var(--text-muted)' }}>{ev.summary || ev.event_type}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* footer */}
            <div style={{ display: 'flex', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border)', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  if (!editCustomer) {
                    showToast('Customer editing is not available here.', 'error')
                    return
                  }
                  editCustomer.openEditCustomerModal(customerId)
                }}
                style={{ height: 30, padding: '0 0.8rem', border: '1px solid var(--border-strong)', borderRadius: 5, background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
              >
                ✎ Edit customer
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose()
                  navigate(`/projects?customer=${customerId}`)
                }}
                style={{ height: 30, padding: '0 0.8rem', border: '1px solid var(--border-strong)', borderRadius: 5, background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Their projects
              </button>
              {/* Public page (owner-planned, ships last): slot reserved so the layout won't shift. */}
              <button
                type="button"
                disabled
                title="The customer's public page is coming — planned as the last piece of this modal"
                style={{ height: 30, padding: '0 0.8rem', border: '1px dashed var(--border-400)', borderRadius: 5, background: 'transparent', color: 'var(--text-faint)', fontSize: '0.78rem', fontWeight: 600, cursor: 'default', marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                Public page
                <span style={{ padding: '1px 6px', fontSize: '0.6rem', fontWeight: 700, borderRadius: 9999, background: 'var(--bg-muted)', color: 'var(--text-muted)' }}>soon</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
