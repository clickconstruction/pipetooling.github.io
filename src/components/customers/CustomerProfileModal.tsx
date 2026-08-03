import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
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
import { customerDaysToPay, customerMoneyStats } from '../../lib/customers/customerProfileStats'
import { fetchCustomerProfile, type CustomerProfileData } from '../../lib/customers/fetchCustomerProfile'

/**
 * Customer profile modal (v2.1322): everything the app knows about one
 * customer, opened from the Stages row customer icon (and reusable anywhere
 * via CustomerProfileModalContext). Contact band (tel:/mailto:/maps), the
 * money strip (open balance + aging chip, lifetime collected, median
 * days-to-pay), and work rails whose pills open the EXISTING surfaces
 * (Job Detail modal, workflow route, Bid Preview, estimate page).
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

const pillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 24,
  padding: '0 10px',
  border: '1px solid var(--border-strong)',
  borderRadius: 9999,
  background: 'var(--bg-subtle)',
  color: 'var(--text-link)',
  fontSize: '0.75rem',
  fontWeight: 600,
  cursor: 'pointer',
  maxWidth: 220,
}

function Dot({ color }: { color: string }) {
  return <span aria-hidden style={{ width: 8, height: 8, borderRadius: 9999, flexShrink: 0, background: color }} />
}

function Rail({ cap, children }: { cap: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
      <span style={capStyle}>{cap}</span>
      {children}
    </div>
  )
}

const RAIL_COLLAPSE_COUNT = 6

export default function CustomerProfileModal({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const navigate = useNavigate()
  const { showToast } = useToastContext()
  const jobDetail = useJobDetailModal()
  const bidPreview = useBidPreview()
  const editCustomer = useEditCustomerModal()

  const [data, setData] = useState<CustomerProfileData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [jobsExpanded, setJobsExpanded] = useState(false)

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

  const visibleJobs = data ? (jobsExpanded ? data.jobs : data.jobs.slice(0, RAIL_COLLAPSE_COUNT)) : []
  const hiddenJobs = data ? data.jobs.length - visibleJobs.length : 0

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
              {sinceLabel ? (
                <div style={{ marginTop: 3, fontSize: '0.75rem', color: 'var(--text-faint)' }}>Customer since {sinceLabel}</div>
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
              <Rail cap="Jobs">
                {data.jobs.length === 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>None yet.</span>}
                {visibleJobs.map((j) => (
                  <button
                    key={j.id}
                    type="button"
                    onClick={() => jobDetail?.openJobDetail({ jobId: j.id })}
                    title={`Open job detail — ${labelJobsLedgerStatusForDashboard(j.status ?? 'working')}`}
                    style={pillStyle}
                  >
                    <Dot color={jobsLedgerStatusDotColor(j.status ?? 'working')} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {effectiveJobLedgerNumber(j.hcp_number, j.click_number) || (j.job_name ?? '').trim() || 'Job'}
                    </span>
                  </button>
                ))}
                {hiddenJobs > 0 && (
                  <button type="button" onClick={() => setJobsExpanded(true)} style={{ ...pillStyle, color: 'var(--text-700)' }}>
                    +{hiddenJobs} more
                  </button>
                )}
              </Rail>
              <Rail cap="Projects">
                {data.projects.length === 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>None yet.</span>}
                {data.projects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onClose()
                      navigate(`/workflows/${p.id}`)
                    }}
                    title="Open workflow"
                    style={pillStyle}
                  >
                    {p.attention?.current ? <Dot color="#E87600" /> : null}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(p.name ?? '').trim() || 'Project'}
                      {p.attention?.current ? ` · step ${p.attention.current.position}/${p.attention.total}` : ''}
                    </span>
                  </button>
                ))}
              </Rail>
              <Rail cap="Bids">
                {data.bids.length === 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>None yet.</span>}
                {data.bids.map((b) => (
                  <button key={b.id} type="button" onClick={() => bidPreview?.openBidPreview(b.id)} title="Open bid preview" style={pillStyle}>
                    <Dot color={bidOutcomeDotColor(b.outcome)} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(b.bid_number ?? '').trim() || (b.project_name ?? '').trim() || 'Bid'}
                    </span>
                  </button>
                ))}
              </Rail>
              <Rail cap="Estimates">
                {data.estimates.length === 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>None yet.</span>}
                {data.estimates.map((est) => (
                  <button
                    key={est.id}
                    type="button"
                    onClick={() => {
                      onClose()
                      navigate(`/estimates/${est.estimate_number}`)
                    }}
                    title={`Open estimate #${est.estimate_number} — ${est.status}`}
                    style={pillStyle}
                  >
                    <Dot color={estimateStatusDotColor(est.status)} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(est.title ?? '').trim() || `#${est.estimate_number}`}
                    </span>
                  </button>
                ))}
              </Rail>
            </div>

            {/* footer */}
            <div style={{ display: 'flex', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border)', alignItems: 'center' }}>
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
            </div>
          </>
        )}
      </div>
    </div>
  )
}
