import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { Tables } from '../types/database'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { useToastContext } from '../contexts/ToastContext'
import { pageUnderlineTabStyle } from '../lib/pageUnderlineTabStyle'
import { getBidServiceTypeTag } from '../utils/unifiedJobBidSearch'
import CustomerAcceptanceRecordModal from '../components/estimates/CustomerAcceptanceRecordModal'
import EstimateSentDocumentModal from '../components/estimates/EstimateSentDocumentModal'
import {
  LedgerBidProjectFolderIcon,
  LedgerDocIconFilled,
  LedgerDocIconOutline,
} from '../components/documents/DocumentsLedgerDocIcons'
import DocumentsAddDriveLinkModal, {
  type DocumentsBidLinkColumn,
} from '../components/documents/DocumentsAddDriveLinkModal'
import { openInExternalBrowser } from '../lib/openInExternalBrowser'
import { type DocumentsPageTab, parseDocumentsPageTabFromSearch } from '../lib/documentsPageTab'
import { labelJobsLedgerStatus, normalizeJobsLedgerStatus } from '../lib/jobsLedgerStatusPipeline'

type LedgerEstimateRow = Tables<'estimates'> & {
  customers: { name: string | null; address: string | null; contact_info: unknown } | null
  jobs_ledger?: { id: string; hcp_number: string; job_name: string } | null
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100)
}

/** Documents ledger: align labels with Estimates Stages buckets. */
function documentsLedgerStatusLabel(status: LedgerEstimateRow['status']): string {
  switch (status) {
    case 'draft':
      return 'Unsent'
    case 'sent':
      return 'Sent'
    case 'declined':
      return 'Declined'
    case 'customer_accepted':
      return 'Accepted'
    default:
      return String(status)
  }
}

function ledgerLinkedJobHcp(r: LedgerEstimateRow): string | null {
  const t = (r.jobs_ledger?.hcp_number ?? '').trim()
  return t || null
}

function documentsLedgerRowMatchesSearch(r: LedgerEstimateRow, query: string): boolean {
  const t = query.trim().toLowerCase()
  if (!t) return true
  if (String(r.estimate_number).toLowerCase().includes(t)) return true
  if ((r.title ?? '').toLowerCase().includes(t)) return true
  const cx = ledgerCustomerColumnLines(r)
  if (cx.primary.toLowerCase().includes(t)) return true
  if (cx.secondary && cx.secondary.toLowerCase().includes(t)) return true
  const hcp = ledgerLinkedJobHcp(r)
  if (hcp && hcp.toLowerCase().includes(t)) return true
  const jn = (r.jobs_ledger?.job_name ?? '').trim()
  if (jn.toLowerCase().includes(t)) return true
  if (documentsLedgerStatusLabel(r.status).toLowerCase().includes(t)) return true
  if (String(r.status).toLowerCase().includes(t)) return true
  if (formatMoney(r.total_cents ?? 0).toLowerCase().includes(t)) return true
  return false
}

/** Same compact $Nk style as Bids `formatCompactCurrency` (bid_value is dollars, not cents). */
function formatBidValueCompact(n: number | null): string {
  if (n == null) return '—'
  const k = n / 1000
  if (k % 1 === 0) return `$${k}k`
  return `$${k.toFixed(1)}k`
}

type LedgerBidRow = Pick<
  Tables<'bids'>,
  | 'id'
  | 'project_name'
  | 'address'
  | 'bid_number'
  | 'bid_value'
  | 'bid_date_sent'
  | 'outcome'
  | 'updated_at'
  | 'bid_submission_link'
  | 'drive_link'
> & {
  customers: { name: string | null; address: string | null } | null
  service_type: { name: string } | null
}

function documentsBidStatusLabel(b: LedgerBidRow): string {
  if (b.outcome === 'won') return 'Won'
  if (b.outcome === 'lost') return 'Lost'
  if (b.outcome === 'started_or_complete') return 'Started/Complete'
  if (!b.bid_date_sent) return 'Unsent'
  return 'Sent'
}

function bidProposalCustomerLines(r: LedgerBidRow): { primary: string; secondary: string | null } {
  const cust = r.customers
  if (cust) {
    const name = (cust.name ?? '').trim()
    const address = (cust.address ?? '').trim()
    if (name && address) return { primary: name, secondary: address }
    if (name) return { primary: name, secondary: null }
    if (address) return { primary: address, secondary: null }
  }
  return { primary: '—', secondary: null }
}

function documentsBidProposalsRowMatchesSearch(
  r: LedgerBidRow,
  countLines: Array<{ fixture: string; count: number }>,
  query: string,
): boolean {
  const t = query.trim().toLowerCase()
  if (!t) return true
  if ((r.project_name ?? '').toLowerCase().includes(t)) return true
  if ((r.address ?? '').toLowerCase().includes(t)) return true
  if (r.bid_number != null && String(r.bid_number).toLowerCase().includes(t)) return true
  const cx = bidProposalCustomerLines(r)
  if (cx.primary.toLowerCase().includes(t)) return true
  if (cx.secondary && cx.secondary.toLowerCase().includes(t)) return true
  if (documentsBidStatusLabel(r).toLowerCase().includes(t)) return true
  if (String(r.outcome ?? '').toLowerCase().includes(t)) return true
  if (formatBidValueCompact(r.bid_value != null ? Number(r.bid_value) : null).toLowerCase().includes(t)) return true
  const st = (r.service_type?.name ?? '').trim()
  if (st.toLowerCase().includes(t)) return true
  for (const l of countLines) {
    if ((l.fixture ?? '').toLowerCase().includes(t)) return true
    if (String(l.count).includes(t)) return true
  }
  return false
}

function ledgerCustomerColumnLines(r: LedgerEstimateRow): { primary: string; secondary: string | null } {
  const cust = r.customers
  if (cust) {
    const name = (cust.name ?? '').trim()
    const address = (cust.address ?? '').trim()
    if (name && address) return { primary: name, secondary: address }
    if (name) return { primary: name, secondary: null }
    if (address) return { primary: address, secondary: null }
  }
  const email = r.customer_email?.trim()
  if (email) return { primary: email, secondary: null }
  const addr = r.for_address?.trim()
  if (addr) return { primary: addr, secondary: null }
  return { primary: '—', secondary: null }
}

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.9rem',
}
const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '0.65rem 0.75rem',
  borderBottom: '2px solid #e5e7eb',
  fontWeight: 600,
  color: '#374151',
}
const tdStyle: CSSProperties = {
  padding: '0.6rem 0.75rem',
  borderBottom: '1px solid #f3f4f6',
  verticalAlign: 'top',
}

const docsIconButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0.15rem',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  color: '#374151',
  borderRadius: 4,
}

/** Soft “+” when no doc icon yet (Documents ledgers). */
const docsAddLinkButtonStyle: CSSProperties = {
  ...docsIconButtonStyle,
  minWidth: '1.75rem',
  minHeight: '1.75rem',
  fontSize: '1.15rem',
  lineHeight: 1,
  fontWeight: 300,
  color: '#c4c4c4',
  border: '1px dashed #e5e7eb',
  borderRadius: 4,
}

function DocumentsEstimatesLedger() {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const [rows, setRows] = useState<LedgerEstimateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [acceptanceRecordEstimateId, setAcceptanceRecordEstimateId] = useState<string | null>(null)
  const [sentPreviewEstimateId, setSentPreviewEstimateId] = useState<string | null>(null)
  const [addDriveLinkEstimate, setAddDriveLinkEstimate] = useState<{
    id: string
    estimateNumber: number
    title: string
  } | null>(null)

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows
    return rows.filter((r) => documentsLedgerRowMatchesSearch(r, search))
  }, [rows, search])

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const data = await withSupabaseRetry(
        async () =>
          await supabase
            .from('estimates')
            .select('*, customers(name, address, contact_info), jobs_ledger(id, hcp_number, job_name)')
            .in('status', ['draft', 'sent', 'declined', 'customer_accepted'])
            .order('updated_at', { ascending: false })
            .limit(200),
        'load documents estimates ledger',
      )
      setRows((data ?? []) as LedgerEstimateRow[])
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not load estimates'), 'error')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [user?.id, showToast])

  useEffect(() => {
    void load()
  }, [load])

  if (!user?.id) {
    return <p style={{ color: '#6b7280' }}>Sign in to view the ledger.</p>
  }

  return (
    <div>
      <DocumentsAddDriveLinkModal
        open={addDriveLinkEstimate != null}
        onClose={() => setAddDriveLinkEstimate(null)}
        title="Add estimate document link"
        description={
          addDriveLinkEstimate ?
            `Estimate #${addDriveLinkEstimate.estimateNumber} — ${addDriveLinkEstimate.title}`
          : null
        }
        bidSaveColumn={null}
        bidNeedsTargetChoice={false}
        onSave={async (normalizedUrl) => {
          if (!addDriveLinkEstimate) return
          const updated = await withSupabaseRetry(
            async () =>
              await supabase
                .from('estimates')
                .update({
                  customer_attachment_url: normalizedUrl,
                  customer_attachment_label: null,
                })
                .eq('id', addDriveLinkEstimate.id)
                .eq('status', 'draft')
                .select('id'),
            'documents save estimate attachment url',
          )
          if (!updated || updated.length === 0) {
            showToast('This estimate is no longer a draft. Open it on Estimates to add or change the link.', 'error')
            return
          }
          showToast('Link saved', 'success')
          await load()
        }}
      />
      <CustomerAcceptanceRecordModal
        open={acceptanceRecordEstimateId != null}
        onClose={() => setAcceptanceRecordEstimateId(null)}
        estimateId={acceptanceRecordEstimateId}
      />
      <EstimateSentDocumentModal
        open={sentPreviewEstimateId != null}
        onClose={() => setSentPreviewEstimateId(null)}
        estimateId={sentPreviewEstimateId}
      />
      {!loading && rows.length > 0 ? (
        <div style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="documents-estimates-search" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
            Search
          </label>
          <input
            id="documents-estimates-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Title, customer, job, status, total…"
            autoComplete="off"
            aria-label="Search estimates in ledger"
            style={{
              width: '100%',
              maxWidth: 420,
              boxSizing: 'border-box',
              padding: '0.5rem 0.65rem',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              fontSize: '0.9rem',
            }}
          />
        </div>
      ) : null}
      {loading ? (
        <p style={{ color: '#6b7280' }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No estimates in this ledger.</p>
      ) : filteredRows.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No estimates match your search.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Docs</th>
                <th style={thStyle}>Title</th>
                <th style={thStyle}>Job</th>
                <th style={thStyle}>Customer</th>
                <th style={thStyle}>Status</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => {
                const cx = ledgerCustomerColumnLines(r)
                return (
                  <tr key={r.id}>
                    <td style={{ ...tdStyle, verticalAlign: 'middle', width: '2.5rem' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        {r.status === 'customer_accepted' ? (
                          <button
                            type="button"
                            aria-label="View accepted estimate document"
                            style={docsIconButtonStyle}
                            onClick={() => setAcceptanceRecordEstimateId(r.id)}
                          >
                            <LedgerDocIconFilled />
                          </button>
                        ) : r.status === 'sent' ? (
                          <button
                            type="button"
                            aria-label="View sent estimate document"
                            style={docsIconButtonStyle}
                            onClick={() => setSentPreviewEstimateId(r.id)}
                          >
                            <LedgerDocIconOutline />
                          </button>
                        ) : null}
                        {r.status === 'draft' ? (
                          <button
                            type="button"
                            aria-label="Add customer document link"
                            title="Add document link"
                            style={docsAddLinkButtonStyle}
                            onClick={() =>
                              setAddDriveLinkEstimate({
                                id: r.id,
                                estimateNumber: r.estimate_number,
                                title: (r.title ?? '').trim() || 'Untitled',
                              })
                            }
                          >
                            +
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <Link to={`/estimates/${String(r.estimate_number)}`} style={{ color: '#2563eb', fontWeight: 500 }}>
                        {(r.title ?? '').trim() || 'Untitled'}
                      </Link>
                    </td>
                    <td style={tdStyle}>
                      {r.job_ledger_id ? (
                        <>
                          <Link
                            to={`/jobs?edit=${r.job_ledger_id}`}
                            style={{ fontWeight: 500, color: '#15803d' }}
                          >
                            {(() => {
                              const hcp = ledgerLinkedJobHcp(r)
                              if (hcp) return `Job #${hcp}`
                              const jn = (r.jobs_ledger?.job_name ?? '').trim()
                              return jn || 'Job linked'
                            })()}
                          </Link>
                          {(() => {
                            const hcp = ledgerLinkedJobHcp(r)
                            const jn = (r.jobs_ledger?.job_name ?? '').trim()
                            if (!jn || (hcp && jn === hcp)) return null
                            return <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{jn}</div>
                          })()}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={tdStyle}>
                      <div>{cx.primary}</div>
                      {cx.secondary ? (
                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{cx.secondary}</div>
                      ) : null}
                    </td>
                    <td style={tdStyle}>{documentsLedgerStatusLabel(r.status)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {formatMoney(r.total_cents ?? 0)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

type LedgerJobRow = Pick<
  Tables<'jobs_ledger'>,
  | 'id'
  | 'hcp_number'
  | 'job_name'
  | 'job_address'
  | 'status'
  | 'revenue'
  | 'google_drive_link'
  | 'updated_at'
  | 'customer_name'
  | 'customer_email'
> & {
  customers: { name: string | null; address: string | null } | null
}

function jobLedgerCustomerLines(r: LedgerJobRow): { primary: string; secondary: string | null } {
  const cust = r.customers
  if (cust) {
    const name = (cust.name ?? '').trim()
    const address = (cust.address ?? '').trim()
    if (name && address) return { primary: name, secondary: address }
    if (name) return { primary: name, secondary: null }
    if (address) return { primary: address, secondary: null }
  }
  const cn = (r.customer_name ?? '').trim()
  if (cn) return { primary: cn, secondary: null }
  const em = (r.customer_email ?? '').trim()
  if (em) return { primary: em, secondary: null }
  return { primary: '—', secondary: null }
}

function documentsJobLedgerStatusLabel(status: string | null | undefined): string {
  const n = normalizeJobsLedgerStatus(status)
  if (n) return labelJobsLedgerStatus(n)
  const raw = (status ?? '').trim().replace(/_/g, ' ')
  return raw || '—'
}

function formatJobRevenueUsd(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(n))
}

function documentsJobsRowMatchesSearch(r: LedgerJobRow, query: string): boolean {
  const t = query.trim().toLowerCase()
  if (!t) return true
  if ((r.hcp_number ?? '').toLowerCase().includes(t)) return true
  if ((r.job_name ?? '').toLowerCase().includes(t)) return true
  if ((r.job_address ?? '').toLowerCase().includes(t)) return true
  const cx = jobLedgerCustomerLines(r)
  if (cx.primary.toLowerCase().includes(t)) return true
  if (cx.secondary && cx.secondary.toLowerCase().includes(t)) return true
  if (documentsJobLedgerStatusLabel(r.status).toLowerCase().includes(t)) return true
  if (String(r.status ?? '').toLowerCase().includes(t)) return true
  if (formatJobRevenueUsd(r.revenue).toLowerCase().includes(t)) return true
  return false
}

function DocumentsJobsLedger() {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const [rows, setRows] = useState<LedgerJobRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [addDriveLinkJob, setAddDriveLinkJob] = useState<{ id: string; title: string } | null>(null)

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows
    return rows.filter((r) => documentsJobsRowMatchesSearch(r, search))
  }, [rows, search])

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const data = await withSupabaseRetry(
        async () =>
          await supabase
            .from('jobs_ledger')
            .select(
              'id, hcp_number, job_name, job_address, status, revenue, google_drive_link, updated_at, customer_name, customer_email, customers(name, address)',
            )
            .order('updated_at', { ascending: false, nullsFirst: false })
            .limit(200),
        'load documents jobs ledger',
      )
      setRows((data ?? []) as LedgerJobRow[])
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not load jobs'), 'error')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [user?.id, showToast])

  useEffect(() => {
    void load()
  }, [load])

  if (!user?.id) {
    return <p style={{ color: '#6b7280' }}>Sign in to view the ledger.</p>
  }

  return (
    <div>
      <DocumentsAddDriveLinkModal
        open={addDriveLinkJob != null}
        onClose={() => setAddDriveLinkJob(null)}
        title="Add job files link"
        description={addDriveLinkJob?.title ?? null}
        bidSaveColumn={null}
        bidNeedsTargetChoice={false}
        onSave={async (normalizedUrl) => {
          if (!addDriveLinkJob) return
          await withSupabaseRetry(
            async () =>
              await supabase
                .from('jobs_ledger')
                .update({ google_drive_link: normalizedUrl })
                .eq('id', addDriveLinkJob.id),
            'documents save job google_drive_link',
          )
          showToast('Link saved', 'success')
          await load()
        }}
      />
      {!loading && rows.length > 0 ? (
        <div style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="documents-jobs-search" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
            Search
          </label>
          <input
            id="documents-jobs-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="HCP, job, address, customer, status, total…"
            autoComplete="off"
            aria-label="Search jobs in ledger"
            style={{
              width: '100%',
              maxWidth: 420,
              boxSizing: 'border-box',
              padding: '0.5rem 0.65rem',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              fontSize: '0.9rem',
            }}
          />
        </div>
      ) : null}
      {loading ? (
        <p style={{ color: '#6b7280' }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No jobs in this ledger.</p>
      ) : filteredRows.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No jobs match your search.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Docs</th>
                <th style={thStyle}>Title</th>
                <th style={thStyle}>Job</th>
                <th style={thStyle}>Customer</th>
                <th style={thStyle}>Status</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => {
                const cx = jobLedgerCustomerLines(r)
                const hcp = (r.hcp_number ?? '').trim()
                const jn = (r.job_name ?? '').trim()
                const titleText = hcp ? `J${hcp} | ${jn || '—'}` : jn || '—'
                const addr = (r.job_address ?? '').trim()
                const filesLink = (r.google_drive_link ?? '').trim()
                const hasJobFiles = !!filesLink
                return (
                  <tr key={r.id}>
                    <td style={{ ...tdStyle, verticalAlign: 'middle' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        {hasJobFiles ? (
                          <button
                            type="button"
                            aria-label="Open job files (Google Drive)"
                            style={docsIconButtonStyle}
                            onClick={() => openInExternalBrowser(filesLink)}
                          >
                            <LedgerBidProjectFolderIcon />
                          </button>
                        ) : null}
                        {!hasJobFiles ? (
                          <button
                            type="button"
                            aria-label="Add job files link"
                            title="Add job files link"
                            style={docsAddLinkButtonStyle}
                            onClick={() =>
                              setAddDriveLinkJob({
                                id: r.id,
                                title: titleText,
                              })
                            }
                          >
                            +
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <Link to={`/jobs?edit=${encodeURIComponent(r.id)}`} style={{ color: '#2563eb', fontWeight: 500 }}>
                        {titleText}
                      </Link>
                    </td>
                    <td style={tdStyle}>
                      {addr ? <div>{addr}</div> : <span style={{ color: '#6b7280' }}>—</span>}
                    </td>
                    <td style={tdStyle}>
                      <div>{cx.primary}</div>
                      {cx.secondary ? (
                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{cx.secondary}</div>
                      ) : null}
                    </td>
                    <td style={tdStyle}>{documentsJobLedgerStatusLabel(r.status)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>{formatJobRevenueUsd(r.revenue)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const COVER_LETTER_TAB = 'cover-letter' as const

function DocumentsBidProposalsLedger() {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const [rows, setRows] = useState<LedgerBidRow[]>([])
  const [countRowsByBidId, setCountRowsByBidId] = useState<Map<string, Array<{ fixture: string; count: number }>>>(
    () => new Map(),
  )
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [addDriveLinkBid, setAddDriveLinkBid] = useState<{
    id: string
    title: string
    column: DocumentsBidLinkColumn | 'choose'
  } | null>(null)

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const bidList = await withSupabaseRetry(
        async () =>
          await supabase
            .from('bids')
            .select(
              'id, project_name, address, bid_number, bid_value, bid_date_sent, outcome, updated_at, bid_submission_link, drive_link, customers(name, address), service_type:service_types(name)',
            )
            .order('updated_at', { ascending: false, nullsFirst: false })
            .limit(200),
        'load documents bid proposals',
      )
      const list = (bidList ?? []) as LedgerBidRow[]
      setRows(list)

      const ids = list.map((b) => b.id)
      if (ids.length === 0) {
        setCountRowsByBidId(new Map())
        return
      }
      const countData = await withSupabaseRetry(
        async () =>
          await supabase
            .from('bids_count_rows')
            .select('bid_id, fixture, count')
            .in('bid_id', ids)
            .order('sequence_order', { ascending: true })
            .order('id', { ascending: true }),
        'load documents bid count rows',
      )
      const byBid = new Map<string, Array<{ fixture: string; count: number }>>()
      for (const r of countData ?? []) {
        const row = r as { bid_id: string; fixture: string; count: number }
        const arr = byBid.get(row.bid_id) ?? []
        arr.push({ fixture: row.fixture ?? '', count: Number(row.count) })
        byBid.set(row.bid_id, arr)
      }
      setCountRowsByBidId(byBid)
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not load bid proposals'), 'error')
      setRows([])
      setCountRowsByBidId(new Map())
    } finally {
      setLoading(false)
    }
  }, [user?.id, showToast])

  useEffect(() => {
    void load()
  }, [load])

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows
    return rows.filter((r) => {
      const lines = countRowsByBidId.get(r.id) ?? []
      return documentsBidProposalsRowMatchesSearch(r, lines, search)
    })
  }, [rows, search, countRowsByBidId])

  const tableRows = useMemo(() => {
    if (search.trim()) return filteredRows
    return filteredRows.filter((r) => r.outcome !== 'lost')
  }, [filteredRows, search])

  if (!user?.id) {
    return <p style={{ color: '#6b7280' }}>Sign in to view the ledger.</p>
  }

  return (
    <div>
      <DocumentsAddDriveLinkModal
        open={addDriveLinkBid != null}
        onClose={() => setAddDriveLinkBid(null)}
        title={
          addDriveLinkBid?.column === 'folder' ? 'Add bid project folder link'
          : addDriveLinkBid?.column === 'submission' ? 'Add bid submission document link'
          : 'Add bid link'
        }
        description={addDriveLinkBid?.title ?? null}
        bidSaveColumn={addDriveLinkBid?.column === 'choose' ? null : addDriveLinkBid?.column ?? null}
        bidNeedsTargetChoice={addDriveLinkBid?.column === 'choose'}
        onSave={async (normalizedUrl, bidTarget) => {
          if (!addDriveLinkBid) return
          const col = bidTarget
          if (!col) {
            showToast('Choose submission document or project folder.', 'error')
            return
          }
          const patch =
            col === 'submission' ? { bid_submission_link: normalizedUrl } : { drive_link: normalizedUrl }
          await withSupabaseRetry(
            async () => await supabase.from('bids').update(patch).eq('id', addDriveLinkBid.id),
            'documents save bid link',
          )
          showToast('Link saved', 'success')
          await load()
        }}
      />
      {!loading && rows.length > 0 ? (
        <div style={{ marginBottom: '0.75rem' }}>
          <label
            htmlFor="documents-bid-proposals-search"
            style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}
          >
            Search
          </label>
          <input
            id="documents-bid-proposals-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Title, site, customer, counts, status…"
            autoComplete="off"
            aria-label="Search bid proposals"
            style={{
              width: '100%',
              maxWidth: 420,
              boxSizing: 'border-box',
              padding: '0.5rem 0.65rem',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              fontSize: '0.9rem',
            }}
          />
        </div>
      ) : null}
      {loading ? (
        <p style={{ color: '#6b7280' }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No bid proposals in this ledger.</p>
      ) : filteredRows.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No bids match your search.</p>
      ) : tableRows.length === 0 ? (
        <p style={{ color: '#6b7280' }}>
          No bid proposals to show here. Lost bids are hidden unless you search.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Docs</th>
                <th style={thStyle}>Title</th>
                <th style={thStyle}>Job</th>
                <th style={thStyle}>Customer</th>
                <th style={thStyle}>Status</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r) => {
                const cx = bidProposalCustomerLines(r)
                const coverHref = `/bids?bidId=${encodeURIComponent(r.id)}&tab=${COVER_LETTER_TAB}`
                const submissionLink = (r.bid_submission_link ?? '').trim()
                const hasBidSubmissionLink = !!submissionLink
                const folderLink = (r.drive_link ?? '').trim()
                const hasProjectFolderLink = !!folderLink
                const showBidAddSubmission = !hasBidSubmissionLink
                const showBidAddFolder = !hasProjectFolderLink
                const showBidAddChoose = showBidAddSubmission && showBidAddFolder
                const addr = (r.address ?? '').trim()
                const bidNum = r.bid_number != null && String(r.bid_number).trim() !== '' ? String(r.bid_number).trim() : null
                const titleBase = (r.project_name ?? '').trim() || 'Untitled'
                const titleText = bidNum ? `B${bidNum} | ${titleBase}` : titleBase
                const serviceTag = getBidServiceTypeTag(r.service_type?.name)
                return (
                  <tr key={r.id}>
                    <td style={{ ...tdStyle, verticalAlign: 'middle' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        {hasBidSubmissionLink ? (
                          <button
                            type="button"
                            aria-label="Open bid submission document"
                            style={docsIconButtonStyle}
                            onClick={() => openInExternalBrowser(submissionLink)}
                          >
                            <LedgerDocIconFilled />
                          </button>
                        ) : null}
                        {hasProjectFolderLink ? (
                          <button
                            type="button"
                            aria-label="Open bid project folder"
                            style={docsIconButtonStyle}
                            onClick={() => openInExternalBrowser(folderLink)}
                          >
                            <LedgerBidProjectFolderIcon />
                          </button>
                        ) : null}
                        {showBidAddChoose ? (
                          <button
                            type="button"
                            aria-label="Add bid submission document or project folder link"
                            title="Add link"
                            style={docsAddLinkButtonStyle}
                            onClick={() => setAddDriveLinkBid({ id: r.id, title: titleText, column: 'choose' })}
                          >
                            +
                          </button>
                        ) : null}
                        {!showBidAddChoose && showBidAddSubmission ? (
                          <button
                            type="button"
                            aria-label="Add bid submission document link"
                            title="Add submission link"
                            style={docsAddLinkButtonStyle}
                            onClick={() => setAddDriveLinkBid({ id: r.id, title: titleText, column: 'submission' })}
                          >
                            +
                          </button>
                        ) : null}
                        {!showBidAddChoose && showBidAddFolder ? (
                          <button
                            type="button"
                            aria-label="Add bid project folder link"
                            title="Add folder link"
                            style={docsAddLinkButtonStyle}
                            onClick={() => setAddDriveLinkBid({ id: r.id, title: titleText, column: 'folder' })}
                          >
                            +
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <Link
                        to={coverHref}
                        style={{
                          color: '#2563eb',
                          fontWeight: 500,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                      >
                        {serviceTag ? (
                          <span
                            style={{
                              padding: '0.1rem 0.35rem',
                              fontSize: '0.65rem',
                              fontWeight: 500,
                              background: serviceTag.color,
                              color: '#fff',
                              borderRadius: 4,
                            }}
                          >
                            [{serviceTag.tag}]
                          </span>
                        ) : null}
                        {titleText}
                      </Link>
                    </td>
                    <td style={tdStyle}>
                      {addr ? <div>{addr}</div> : <span style={{ color: '#6b7280' }}>—</span>}
                    </td>
                    <td style={tdStyle}>
                      <div>{cx.primary}</div>
                      {cx.secondary ? (
                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{cx.secondary}</div>
                      ) : null}
                    </td>
                    <td style={tdStyle}>{documentsBidStatusLabel(r)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {formatBidValueCompact(r.bid_value != null ? Number(r.bid_value) : null)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function Documents() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const documentsTab = parseDocumentsPageTabFromSearch(location.search)

  function setDocumentsTab(next: DocumentsPageTab) {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('tab', next)
    nextParams.delete('ledger')
    setSearchParams(nextParams, { replace: true })
  }

  return (
    <div style={{ padding: '1rem 1.25rem', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 1rem' }}>Documents</h1>

      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          style={pageUnderlineTabStyle(documentsTab === 'estimates')}
          onClick={() => setDocumentsTab('estimates')}
        >
          Estimates
        </button>
        <button
          type="button"
          style={pageUnderlineTabStyle(documentsTab === 'bid-proposals')}
          onClick={() => setDocumentsTab('bid-proposals')}
        >
          Bid proposals
        </button>
        <button
          type="button"
          style={pageUnderlineTabStyle(documentsTab === 'jobs')}
          onClick={() => setDocumentsTab('jobs')}
        >
          Jobs
        </button>
        <button type="button" style={pageUnderlineTabStyle(documentsTab === 'upload')} onClick={() => setDocumentsTab('upload')}>
          Upload
        </button>
      </div>

      {documentsTab === 'upload' ? (
        <p style={{ color: '#6b7280', margin: 0 }}>Upload coming soon.</p>
      ) : null}
      {documentsTab === 'estimates' ? <DocumentsEstimatesLedger /> : null}
      {documentsTab === 'bid-proposals' ? <DocumentsBidProposalsLedger /> : null}
      {documentsTab === 'jobs' ? <DocumentsJobsLedger /> : null}
    </div>
  )
}
