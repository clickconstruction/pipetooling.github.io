import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useEditCustomerModal } from '../contexts/EditCustomerModalContext'
import { useJobDetailModal } from '../contexts/JobDetailModalContext'
import { formatErrorMessage } from '../utils/errorHandling'
import { denverWorkDateToday } from '../lib/salaryScheduleSync'
import { extractContactFromCustomer } from '../lib/jobs/jobFormCustomerDisplay'
import {
  jobsLedgerStatusDotColor,
  labelJobsLedgerStatusForDashboard,
  normalizeJobsLedgerStatus,
} from '../lib/jobsLedgerStatusPipeline'
import { effectiveJobLedgerNumber } from '../lib/ledgerDisplayPrefixes'
import { estimateStatusDotColor } from '../lib/estimateStatusDotColor'
import {
  customerDaysToPay,
  customerEstimateOutcomes,
  customerMoneyStats,
} from '../lib/customers/customerProfileStats'
import { fetchCustomerProfile, type CustomerProfileData } from '../lib/customers/fetchCustomerProfile'
import {
  buildCustomerActivityFeed,
  filterActivityFeed,
  type ActivityEvent,
  type ActivityFamily,
} from '../lib/customers/customerActivityFeed'
import { fetchCustomerActivityInputs } from '../lib/customers/fetchCustomerActivity'
import { buildCustomerInvoiceRows, type CustomerInvoiceRow } from '../lib/customers/customerInvoiceRows'
import { appliedByInvoiceId, openBillRowsForJob } from '../lib/billing/billTruth'
import { legacyFooterLifetime, legacyHubOpenBalance, reportBillTruthShadow } from '../lib/billing/billTruthShadow'
import { fetchCustomerInvoices, type CustomerInvoicesData } from '../lib/customers/fetchCustomerInvoices'

/**
 * Customer Hub — the dedicated page per customer at /customers/:id.
 * Landing tab is Profile: identity header, contact band, the money strip
 * (lifetime value, open balance + aging, pays-in, estimates won), and the
 * open-jobs panel. Further tabs (Estimates / Jobs / Invoices) ship on this
 * same shell; the tab lives in the URL (?tab=) so views are linkable.
 *
 * The quick-peek CustomerProfileModal stays for board surfaces — both share
 * fetchCustomerProfile + customerProfileStats so the numbers can't diverge.
 */

const money = (n: number) =>
  `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`

export type CustomerDetailTab = 'profile' | 'estimates' | 'jobs' | 'invoices'

const TAB_LABELS: Record<CustomerDetailTab, string> = {
  profile: 'Profile',
  estimates: 'Estimates',
  jobs: 'Jobs',
  invoices: 'Invoices',
}
const TABS: CustomerDetailTab[] = ['profile', 'estimates', 'jobs', 'invoices']

function parseTab(raw: string | null): CustomerDetailTab {
  return TABS.includes(raw as CustomerDetailTab) ? (raw as CustomerDetailTab) : 'profile'
}

const capStyle: CSSProperties = {
  fontSize: '0.66rem',
  fontWeight: 700,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  color: 'var(--text-faint)',
}

function MoneyCell({ cap, children, sub, last }: { cap: string; children: ReactNode; sub?: ReactNode; last?: boolean }) {
  return (
    <div style={{ padding: '12px 16px', borderRight: last ? 'none' : '1px solid var(--border)' }}>
      <div style={capStyle}>{cap}</div>
      <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>
        {children}
      </div>
      {sub ? <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div> : null}
    </div>
  )
}

const FEED_PAGE = 25

/** Feed event icon + tint per kind: money green, jobs blue, notes gray, estimates amber. */
function eventBadge(kind: ActivityEvent['kind']): { glyph: string; bg: string; fg: string } {
  switch (kind) {
    case 'payment':
      return { glyph: '$', bg: 'var(--bg-green-tint)', fg: 'var(--text-green-600)' }
    case 'invoice_billed':
      return { glyph: '➤', bg: 'var(--bg-green-tint)', fg: 'var(--text-green-600)' }
    case 'estimate':
      return { glyph: '✓', bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)' }
    case 'status':
      return { glyph: '◆', bg: 'var(--bg-blue-tint)', fg: 'var(--text-blue-800)' }
    case 'job_created':
      return { glyph: '＋', bg: 'var(--bg-blue-tint)', fg: 'var(--text-blue-800)' }
    case 'dispatch':
      return { glyph: '📌', bg: 'var(--bg-blue-tint)', fg: 'var(--text-blue-800)' }
    case 'note':
    case 'contact':
      return { glyph: '✎', bg: 'var(--bg-muted)', fg: 'var(--text-muted)' }
  }
}

function feedDateLabel(atIso: string): string {
  const d = new Date(atIso.length === 10 ? `${atIso}T12:00:00Z` : atIso)
  if (Number.isNaN(d.getTime())) return atIso
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) })
}

const INVOICE_STATUS_CHIP: Record<CustomerInvoiceRow['status'], { label: string; bg: string; fg: string }> = {
  draft: { label: 'Draft', bg: 'var(--bg-muted)', fg: 'var(--text-muted)' },
  billed: { label: 'Billed', bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)' },
  partial: { label: 'Partial', bg: 'var(--bg-blue-tint)', fg: 'var(--text-blue-800)' },
  paid: { label: 'Paid', bg: 'var(--bg-green-tint)', fg: 'var(--text-green-600)' },
}

function estimateStatusLabel(s: string): string {
  switch (s) {
    case 'draft':
      return 'Draft'
    case 'sent':
      return 'Sent'
    case 'customer_accepted':
      return 'Accepted'
    case 'declined':
      return 'Declined'
    case 'superseded':
      return 'Superseded'
    default:
      return s
  }
}

const FEED_FILTERS: Array<{ key: ActivityFamily | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'money', label: 'Money' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'notes', label: 'Notes' },
]

function TypeChip({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 20,
        padding: '0 9px',
        borderRadius: 9999,
        fontSize: '0.68rem',
        fontWeight: 700,
        background: bg,
        color: fg,
      }}
    >
      {label}
    </span>
  )
}

export default function CustomerDetail() {
  const { id: customerId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const editCustomer = useEditCustomerModal()
  const jobDetail = useJobDetailModal()

  const [data, setData] = useState<CustomerProfileData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [feed, setFeed] = useState<ActivityEvent[] | null>(null)
  const [feedError, setFeedError] = useState<string | null>(null)
  const [feedFilter, setFeedFilter] = useState<ActivityFamily | 'all'>('all')
  const [feedLimit, setFeedLimit] = useState(FEED_PAGE)
  const [invoicesData, setInvoicesData] = useState<CustomerInvoicesData | null>(null)
  const [invoicesError, setInvoicesError] = useState<string | null>(null)

  const activeTab = parseTab(searchParams.get('tab'))

  const load = useCallback(() => {
    if (!customerId) return
    fetchCustomerProfile(customerId)
      .then(setData)
      .catch((e: unknown) => setError(formatErrorMessage(e, 'Could not load customer')))
    fetchCustomerActivityInputs(customerId)
      .then((inputs) => setFeed(buildCustomerActivityFeed(inputs)))
      .catch((e: unknown) => setFeedError(formatErrorMessage(e, 'Could not load activity')))
    fetchCustomerInvoices(customerId)
      .then(setInvoicesData)
      .catch((e: unknown) => setInvoicesError(formatErrorMessage(e, 'Could not load invoices')))
  }, [customerId])

  useEffect(() => {
    setData(null)
    setError(null)
    setFeed(null)
    setFeedError(null)
    setFeedLimit(FEED_PAGE)
    setInvoicesData(null)
    setInvoicesError(null)
    load()
  }, [load])

  const todayYmd = denverWorkDateToday()
  const stats = useMemo(() => (data ? customerMoneyStats(data.jobs, todayYmd) : null), [data, todayYmd])
  const daysToPay = useMemo(() => (data ? customerDaysToPay(data.jobs, todayYmd) : null), [data, todayYmd])
  const estimateOutcomes = useMemo(() => (data ? customerEstimateOutcomes(data.estimates) : null), [data])

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

  const openJobs = useMemo(
    () => (data ? data.jobs.filter((j) => normalizeJobsLedgerStatus(j.status) !== 'paid') : []),
    [data],
  )

  const invoiceView = useMemo(
    () =>
      invoicesData
        ? buildCustomerInvoiceRows(invoicesData.invoices, invoicesData.payments, invoicesData.jobs, todayYmd)
        : null,
    [invoicesData, todayYmd],
  )

  // Bill-truth shadow (one release, journey J34-F1/N6): the footer used to skip the job-shell
  // arm the strip counted, and the strip's open balance used to net over-paid shells. Log-only —
  // this page has no auth hook; the Dashboard / Quickfill beacons carry the user row.
  useEffect(() => {
    if (!stats || !data) return
    const rows = data.jobs.flatMap((j) =>
      openBillRowsForJob(j, j.invoices.map((i) => ({ ...i, job_id: j.id })), appliedByInvoiceId(j.payments)),
    )
    reportBillTruthShadow({ surface: 'customer-hub-open-balance', legacy: legacyHubOpenBalance(rows), kernel: stats.openBalance })
    if (invoiceView && invoicesData) {
      reportBillTruthShadow({
        surface: 'customer-hub-lifetime',
        legacy: legacyFooterLifetime(invoicesData.invoices),
        kernel: invoiceView.totals.billedTotal,
      })
    }
  }, [stats, data, invoiceView, invoicesData])

  if (!customerId) {
    return <p style={{ color: 'var(--text-red-700)' }}>No customer id in the URL.</p>
  }
  if (error) {
    return (
      <div>
        <p style={{ color: 'var(--text-red-700)' }}>{error}</p>
        <Link to="/customers">← Back to Customers</Link>
      </div>
    )
  }
  if (!data || !stats) {
    return (
      <p role="status" style={{ color: 'var(--text-muted)' }}>
        Loading customer…
      </p>
    )
  }

  const customer = data.customer

  return (
    <div>
      <div style={{ marginBottom: '0.4rem' }}>
        <Link to="/customers" style={{ fontSize: '0.8rem', color: 'var(--text-link)', textDecoration: 'none' }}>
          ← Customers
        </Link>
      </div>

      {/* identity header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: '1.45rem', color: 'var(--text-strong)' }}>{(customer.name ?? '').trim() || '—'}</h1>
        {customer.customer_type === 'commercial' ? (
          <TypeChip label="Commercial" bg="var(--bg-blue-tint)" fg="var(--text-blue-800)" />
        ) : customer.customer_type === 'residential' ? (
          <TypeChip label="Residential" bg="var(--bg-blue-tint)" fg="var(--text-blue-800)" />
        ) : null}
        {customer.archived_at ? <TypeChip label="Archived" bg="var(--bg-muted)" fg="var(--text-muted)" /> : null}
        {sinceLabel ? <span style={{ fontSize: '0.78rem', color: 'var(--text-faint)' }}>Customer since {sinceLabel}</span> : null}
        <div style={{ marginLeft: 'auto' }}>
          <button
            type="button"
            onClick={() =>
              editCustomer?.openEditCustomerModal(customerId, {
                onSaved: load,
                onDeleted: () => navigate('/customers'),
                onMerged: ({ survivorId, removedId }) => {
                  if (removedId === customerId) navigate(`/customers/${survivorId}`, { replace: true })
                  else load()
                },
              })
            }
            style={{
              height: 30,
              padding: '0 0.8rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 5,
              background: 'var(--surface)',
              color: 'var(--text-700)',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ✎ Edit customer
          </button>
        </div>
      </div>

      {/* contact band */}
      {(contact.phone || contact.email || address || data.extraAddresses.length > 0 || data.contactPersons.length > 0) && (
        <div
          style={{
            display: 'flex',
            gap: 14,
            flexWrap: 'wrap',
            alignItems: 'center',
            padding: '8px 0 12px',
            borderBottom: '1px solid var(--border)',
            fontSize: '0.85rem',
          }}
        >
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
          {data.extraAddresses.map((a) => (
            <a
              key={a.id}
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--text-link)', textDecoration: 'none' }}
            >
              📍 {a.address}
              {(a.note ?? '').trim() ? (
                <span style={{ color: 'var(--text-faint)', fontSize: '0.78rem' }}> ({a.note})</span>
              ) : null}
            </a>
          ))}
          {data.contactPersons.length > 0 && (
            <span style={{ color: 'var(--text-faint)', fontSize: '0.78rem' }}>
              · contact{data.contactPersons.length > 1 ? 's' : ''}: {data.contactPersons.map((c) => c.name).join(', ')}
            </span>
          )}
        </div>
      )}

      {/* tab strip */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid var(--border)', margin: '10px 0 16px' }}>
        {TABS.map((tab) => {
          const on = tab === activeTab
          const count =
            tab === 'estimates'
              ? data.estimates.length
              : tab === 'jobs'
                ? data.jobs.length
                : tab === 'invoices'
                  ? (invoiceView?.totals.count ?? 0)
                  : null
          return (
            <button
              key={tab}
              type="button"
              aria-pressed={on}
              onClick={() =>
                setSearchParams((p) => {
                  const n = new URLSearchParams(p)
                  if (tab === 'profile') n.delete('tab')
                  else n.set('tab', tab)
                  return n
                })
              }
              style={{
                fontSize: '0.87rem',
                fontWeight: 600,
                padding: '6px 14px 8px',
                color: on ? 'var(--text-link)' : 'var(--text-muted)',
                border: 'none',
                borderBottom: on ? '2px solid var(--text-link)' : '2px solid transparent',
                marginBottom: -2,
                background: 'none',
                cursor: 'pointer',
              }}
            >
              {TAB_LABELS[tab]}
              {count != null && count > 0 ? (
                <span style={{ fontSize: '0.68rem', color: 'var(--text-faint)', fontWeight: 600, marginLeft: 4 }}>{count}</span>
              ) : null}
            </button>
          )
        })}
      </div>

      {activeTab === 'profile' ? (
        <>
          {/* money strip */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              border: '1px solid var(--border)',
              borderRadius: 8,
              overflow: 'hidden',
              marginBottom: 16,
              background: 'var(--surface)',
            }}
          >
            <MoneyCell
              cap="Lifetime value"
              sub={`billed across ${stats.jobCount} job${stats.jobCount === 1 ? '' : 's'} · ${money(stats.lifetimeCollected)} collected`}
            >
              <span style={{ color: 'var(--text-green-600)' }}>{money(stats.lifetimeBilled)}</span>
            </MoneyCell>
            <MoneyCell
              cap="Open balance"
              sub={
                agingChip ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      height: 17,
                      padding: '0 8px',
                      borderRadius: 9999,
                      fontSize: '0.66rem',
                      fontWeight: 700,
                      background: agingChip.bg,
                      color: agingChip.fg,
                    }}
                  >
                    {agingChip.label}
                  </span>
                ) : undefined
              }
            >
              <span style={{ color: stats.openBalance > 0.005 ? 'var(--text-amber-800)' : 'var(--text-strong)' }}>
                {money(stats.openBalance)}
              </span>
            </MoneyCell>
            <MoneyCell
              cap="Pays in"
              sub={daysToPay ? `median, last ${daysToPay.samples} payment${daysToPay.samples === 1 ? '' : 's'}` : 'no billed→paid history yet'}
            >
              {daysToPay ? `~${daysToPay.medianDays} day${daysToPay.medianDays === 1 ? '' : 's'}` : '—'}
            </MoneyCell>
            <MoneyCell
              cap="Estimates won"
              sub={estimateOutcomes ? 'accepted of decided estimates' : 'no decided estimates yet'}
              last
            >
              {estimateOutcomes ? `${estimateOutcomes.accepted} / ${estimateOutcomes.decided}` : '—'}
            </MoneyCell>
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* open jobs */}
          <div style={{ flex: '1 1 400px', minWidth: 0, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '9px 13px',
                borderBottom: '1px solid var(--border)',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: 'var(--text-strong)',
              }}
            >
              Open jobs
              <Link
                to={`/jobs?customer=${customerId}`}
                style={{ marginLeft: 'auto', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-link)', textDecoration: 'none' }}
              >
                View all {data.jobs.length} in Pipeline →
              </Link>
            </div>
            {openJobs.length === 0 ? (
              <p style={{ margin: 0, padding: '10px 13px', fontSize: '0.82rem', color: 'var(--text-faint)' }}>
                No open jobs — {data.jobs.length === 0 ? 'no jobs yet.' : 'everything is paid.'}
              </p>
            ) : (
              openJobs.map((j, idx) => {
                const paid = Number(j.payments_made ?? 0)
                const revenue = Number(j.revenue ?? 0)
                return (
                  <div
                    key={j.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 13px',
                      borderBottom: idx === openJobs.length - 1 ? 'none' : '1px solid var(--border)',
                      fontSize: '0.84rem',
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 9999,
                        flexShrink: 0,
                        background: jobsLedgerStatusDotColor(j.status ?? 'working'),
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => jobDetail?.openJobDetail({ jobId: j.id })}
                      title="Open job detail"
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        font: 'inherit',
                        fontWeight: 700,
                        color: 'var(--text-link)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {effectiveJobLedgerNumber(j.hcp_number, j.click_number) || 'Job'}
                    </button>
                    <span
                      style={{
                        color: 'var(--text-700)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        minWidth: 0,
                        flex: 1,
                      }}
                    >
                      {(j.job_name ?? '').trim()}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {labelJobsLedgerStatusForDashboard(j.status ?? 'working')}
                    </span>
                    <span
                      style={{
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: 600,
                        color: 'var(--text-strong)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {revenue > 0 ? money(revenue) : '—'}
                      {paid > 0 && revenue > 0 ? (
                        <span style={{ color: 'var(--text-faint)', fontWeight: 500 }}> · {money(paid)} paid</span>
                      ) : null}
                    </span>
                  </div>
                )
              })
            )}
          </div>

          {/* activity feed */}
          <div
            style={{
              flex: '1 1 320px',
              minWidth: 0,
              maxWidth: 480,
              border: '1px solid var(--border)',
              borderRadius: 8,
              background: 'var(--surface)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 13px',
                borderBottom: '1px solid var(--border)',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: 'var(--text-strong)',
              }}
            >
              Activity
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                {FEED_FILTERS.map((f) => {
                  const on = feedFilter === f.key
                  return (
                    <button
                      key={f.key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        setFeedFilter(f.key)
                        setFeedLimit(FEED_PAGE)
                      }}
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 9999,
                        border: on ? '1px solid var(--text-link)' : '1px solid var(--border-strong)',
                        background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
                        color: on ? 'var(--text-link)' : 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      {f.label}
                    </button>
                  )
                })}
              </span>
            </div>
            {feedError ? (
              <p style={{ margin: 0, padding: '10px 13px', fontSize: '0.8rem', color: 'var(--text-red-600)' }}>{feedError}</p>
            ) : feed == null ? (
              <p role="status" style={{ margin: 0, padding: '10px 13px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Loading activity…
              </p>
            ) : (
              (() => {
                const filtered = filterActivityFeed(feed, feedFilter)
                const visible = filtered.slice(0, feedLimit)
                if (filtered.length === 0) {
                  return (
                    <p style={{ margin: 0, padding: '10px 13px', fontSize: '0.8rem', color: 'var(--text-faint)' }}>
                      Nothing here yet.
                    </p>
                  )
                }
                return (
                  <div style={{ padding: '4px 0' }}>
                    {visible.map((ev) => {
                      const badge = eventBadge(ev.kind)
                      return (
                        <div key={ev.key} style={{ display: 'flex', gap: 10, padding: '6px 13px', fontSize: '0.78rem' }}>
                          <span
                            aria-hidden
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 6,
                              flexShrink: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.7rem',
                              background: badge.bg,
                              color: badge.fg,
                            }}
                          >
                            {badge.glyph}
                          </span>
                          <span style={{ minWidth: 0 }}>
                            <span style={{ color: 'var(--text-strong)', fontWeight: 600 }}>
                              {ev.jobId ? (
                                <button
                                  type="button"
                                  onClick={() => jobDetail?.openJobDetail({ jobId: ev.jobId! })}
                                  title="Open job detail"
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: 0,
                                    font: 'inherit',
                                    color: 'var(--text-link)',
                                    cursor: 'pointer',
                                  }}
                                >
                                  {ev.title}
                                </button>
                              ) : (
                                ev.title
                              )}
                            </span>
                            {ev.detail && ev.detail !== ev.title ? (
                              <span style={{ color: 'var(--text-700)' }}> — {ev.detail}</span>
                            ) : null}
                            <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-faint)' }}>
                              {feedDateLabel(ev.atIso)}
                              {ev.actorName ? ` · ${ev.actorName}` : ''}
                            </span>
                          </span>
                        </div>
                      )
                    })}
                    {filtered.length > visible.length ? (
                      <button
                        type="button"
                        onClick={() => setFeedLimit((n) => n + FEED_PAGE)}
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '8px 13px',
                          border: 'none',
                          borderTop: '1px solid var(--border)',
                          background: 'var(--bg-subtle)',
                          color: 'var(--text-link)',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          textAlign: 'center',
                        }}
                      >
                        Show older ({filtered.length - visible.length} more)
                      </button>
                    ) : null}
                  </div>
                )
              })()
            )}
          </div>
          </div>
        </>
      ) : activeTab === 'estimates' ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', overflowX: 'auto' }}>
          {data.estimates.length === 0 ? (
            <p style={{ margin: 0, padding: '12px 14px', fontSize: '0.85rem', color: 'var(--text-faint)' }}>
              No estimates for this customer yet.
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  {['#', 'Title', 'Status', 'Total', 'Sent', 'Updated'].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: h === 'Total' ? 'right' : 'left',
                        fontSize: '0.66rem',
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        color: 'var(--text-faint)',
                        padding: '8px 12px',
                        borderBottom: '2px solid var(--border)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.estimates.map((est) => (
                  <tr key={est.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                      <Link
                        to={`/estimates/${est.estimate_number}`}
                        style={{ fontWeight: 700, color: 'var(--text-link)', textDecoration: 'none' }}
                      >
                        #{est.estimate_number}
                      </Link>
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-700)' }}>{(est.title ?? '').trim() || '—'}</td>
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span
                          aria-hidden
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 9999,
                            background: estimateStatusDotColor(est.status),
                          }}
                        />
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-700)' }}>{estimateStatusLabel(est.status)}</span>
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '8px 12px',
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: 600,
                        color: 'var(--text-strong)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {money(est.total_cents / 100)}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {est.sent_at ? feedDateLabel(est.sent_at) : '—'}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {est.updated_at ? feedDateLabel(est.updated_at) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : activeTab === 'jobs' ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', overflowX: 'auto' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '9px 13px',
              borderBottom: '1px solid var(--border)',
              fontSize: '0.8rem',
              fontWeight: 700,
              color: 'var(--text-strong)',
            }}
          >
            All jobs — full history including paid
            <Link
              to={`/jobs?customer=${customerId}`}
              style={{ marginLeft: 'auto', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-link)', textDecoration: 'none' }}
            >
              Open in Pipeline →
            </Link>
          </div>
          {data.jobs.length === 0 ? (
            <p style={{ margin: 0, padding: '12px 14px', fontSize: '0.85rem', color: 'var(--text-faint)' }}>
              No jobs for this customer yet.
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  {['Job', 'Name', 'Status', 'Progress & payment', 'Created'].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: 'left',
                        fontSize: '0.66rem',
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        color: 'var(--text-faint)',
                        padding: '8px 12px',
                        borderBottom: '2px solid var(--border)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.jobs.map((j) => {
                  const revenue = Number(j.revenue ?? 0)
                  const paid = Number(j.payments_made ?? 0)
                  const pct = revenue > 0 ? Math.min(100, Math.round((paid / revenue) * 100)) : 0
                  const status = normalizeJobsLedgerStatus(j.status) ?? 'working'
                  return (
                    <tr key={j.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => jobDetail?.openJobDetail({ jobId: j.id })}
                          title="Open job detail"
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            font: 'inherit',
                            fontWeight: 700,
                            color: 'var(--text-link)',
                            cursor: 'pointer',
                          }}
                        >
                          {effectiveJobLedgerNumber(j.hcp_number, j.click_number) || 'Job'}
                        </button>
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-700)', maxWidth: 320 }}>
                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {(j.job_name ?? '').trim() || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span
                            aria-hidden
                            style={{ width: 8, height: 8, borderRadius: 9999, background: jobsLedgerStatusDotColor(status) }}
                          />
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-700)' }}>
                            {labelJobsLedgerStatusForDashboard(status)}
                          </span>
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', minWidth: 190 }}>
                        {revenue > 0 ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span
                              aria-hidden
                              style={{
                                flex: 1,
                                height: 6,
                                borderRadius: 3,
                                background: 'var(--bg-muted)',
                                position: 'relative',
                                minWidth: 60,
                              }}
                            >
                              <span
                                style={{
                                  position: 'absolute',
                                  top: 0,
                                  bottom: 0,
                                  left: 0,
                                  width: `${pct}%`,
                                  borderRadius: 3,
                                  background: 'var(--text-green-600)',
                                }}
                              />
                            </span>
                            <span
                              style={{
                                fontSize: '0.74rem',
                                color: 'var(--text-muted)',
                                whiteSpace: 'nowrap',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {status === 'paid' ? money(revenue) : `${money(paid)} / ${money(revenue)}`}
                            </span>
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-faint)' }}>not billed</span>
                        )}
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {j.created_at ? feedDateLabel(j.created_at) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : activeTab === 'invoices' ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', overflowX: 'auto' }}>
          {invoicesError ? (
            <p style={{ margin: 0, padding: '12px 14px', fontSize: '0.85rem', color: 'var(--text-red-600)' }}>{invoicesError}</p>
          ) : invoiceView == null ? (
            <p role="status" style={{ margin: 0, padding: '12px 14px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Loading invoices…
            </p>
          ) : invoiceView.rows.length === 0 ? (
            <p style={{ margin: 0, padding: '12px 14px', fontSize: '0.85rem', color: 'var(--text-faint)' }}>
              No invoices for this customer yet.
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  {['Job', 'Channel', 'Status', 'Amount', 'Billed', 'Last paid'].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: h === 'Amount' ? 'right' : 'left',
                        fontSize: '0.66rem',
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        color: 'var(--text-faint)',
                        padding: '8px 12px',
                        borderBottom: '2px solid var(--border)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoiceView.rows.map((row) => {
                  const chip = INVOICE_STATUS_CHIP[row.status]
                  return (
                    <tr key={row.key} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => jobDetail?.openJobDetail({ jobId: row.jobId })}
                          title="Open job detail"
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            font: 'inherit',
                            fontWeight: 700,
                            color: 'var(--text-link)',
                            cursor: 'pointer',
                          }}
                        >
                          {row.jobLabel}
                          {row.partLabel ? (
                            <span style={{ color: 'var(--text-faint)', fontWeight: 500 }}> {row.partLabel}</span>
                          ) : null}
                        </button>
                      </td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: 'var(--text-700)' }}>
                        {row.hostedInvoiceUrl ? (
                          <a
                            href={row.hostedInvoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--text-link)' }}
                            title="Open hosted Stripe invoice"
                          >
                            {row.channel} ↗
                          </a>
                        ) : (
                          row.channel
                        )}
                      </td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            height: 20,
                            padding: '0 9px',
                            borderRadius: 9999,
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            background: chip.bg,
                            color: chip.fg,
                          }}
                        >
                          {chip.label}
                          {row.agingDays != null && row.agingDays >= 30 ? ` · ${row.agingDays}d` : ''}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: '8px 12px',
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: 600,
                          color: 'var(--text-strong)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {money(row.amount)}
                        {row.status === 'partial' ? (
                          <span style={{ color: 'var(--text-faint)', fontWeight: 500 }}> · {money(row.applied)} in</span>
                        ) : null}
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {row.billedAtIso ? feedDateLabel(row.billedAtIso) : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {row.lastPaidOnIso ? feedDateLabel(row.lastPaidOnIso) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--bg-subtle)' }}>
                  <td colSpan={3} style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text-strong)' }}>
                    Lifetime
                  </td>
                  <td
                    style={{
                      padding: '8px 12px',
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: 700,
                      color: 'var(--text-strong)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {money(invoiceView.totals.billedTotal)}
                  </td>
                  <td colSpan={2} style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-green-600)', whiteSpace: 'nowrap' }}>
                    {money(invoiceView.totals.collectedTotal)} collected
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      ) : null}
    </div>
  )
}
