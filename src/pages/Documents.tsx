import { Fragment, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { Tables } from '../types/database'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { useToastContext } from '../contexts/ToastContext'
import { pageTabStyle } from '../lib/pageTabStyle'
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
import DocumentsJobBilledInvoiceModal from '../components/documents/DocumentsJobBilledInvoiceModal'
import { billingTypeLabel } from '../components/jobs/HostedStripeBillPanel'
import { useLedgerPrefixMap } from '../contexts/LedgerDisplayPrefixContext'
import { formatBidLedgerDocTitle, formatJobLedgerDocTitle } from '../lib/ledgerDisplayPrefixes'

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
  | 'service_type_id'
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
  borderBottom: '2px solid var(--border)',
  fontWeight: 600,
  color: 'var(--text-700)',
}
const tdStyle: CSSProperties = {
  padding: '0.6rem 0.75rem',
  borderBottom: '1px solid var(--border)',
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
  color: 'var(--text-700)',
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
  border: '1px dashed var(--border)',
  borderRadius: 4,
}

const documentsLedgerSearchInputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '0.5rem 0.65rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  fontSize: '0.9rem',
}

/** Screen-reader-only page title (no visible Documents heading). */
const documentsPageVisuallyHiddenH1Style: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  borderWidth: 0,
}

type DocumentsLedgerEmbedProps = { embedSearch?: string }

const documentsLedgerEmbedHintStyle: CSSProperties = { color: 'var(--text-muted)', margin: 0 }

function DocumentsEstimatesLedger({ embedSearch }: DocumentsLedgerEmbedProps = {}) {
  const embedded = embedSearch !== undefined
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

  const effectiveSearch = embedded ? embedSearch : search
  const filteredRows = useMemo(() => {
    if (!effectiveSearch.trim()) {
      if (embedded) return []
      return rows
    }
    return rows.filter((r) => documentsLedgerRowMatchesSearch(r, effectiveSearch))
  }, [rows, effectiveSearch, embedded])

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
    return <p style={{ color: 'var(--text-muted)' }}>Sign in to view the ledger.</p>
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
      {!embedded && !loading && rows.length > 0 ? (
        <div style={{ marginBottom: '0.75rem' }}>
          <input
            id="documents-estimates-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Title, customer, job, status, total…"
            autoComplete="off"
            aria-label="Search estimates in ledger"
            style={documentsLedgerSearchInputStyle}
          />
        </div>
      ) : null}
      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No estimates in this ledger.</p>
      ) : embedded && !embedSearch.trim() ? (
        <p style={documentsLedgerEmbedHintStyle}>Results appear when you type a search above.</p>
      ) : filteredRows.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No estimates match your search.</p>
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
                      <Link to={`/estimates/${String(r.estimate_number)}`} style={{ color: 'var(--text-link)', fontWeight: 500 }}>
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
                            return <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{jn}</div>
                          })()}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={tdStyle}>
                      <div>{cx.primary}</div>
                      {cx.secondary ? (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{cx.secondary}</div>
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
  | 'service_type_id'
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

type DocumentsJobLedgerInvoiceRow = Tables<'jobs_ledger_invoices'>

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

type SupplyHouseInvoiceLedgerAllocation = {
  job_id: string
  pct: number
  jobs_ledger: {
    id: string
    hcp_number: string | null
    job_name: string | null
    job_address: string | null
    service_type_id: string | null
  } | null
}

type SupplyHouseInvoiceLedgerRow = Tables<'supply_house_invoices'> & {
  supply_houses: { name: string } | { name: string }[] | null
  supply_house_invoice_job_allocations?: SupplyHouseInvoiceLedgerAllocation[] | null
}

function supplyHouseInvoiceLedgerHouseName(r: SupplyHouseInvoiceLedgerRow): string {
  const sh = r.supply_houses
  if (Array.isArray(sh)) return (sh[0]?.name ?? '').trim() || '—'
  return (sh?.name ?? '').trim() || '—'
}

function supplyHouseInvoiceLedgerAllocations(r: SupplyHouseInvoiceLedgerRow): SupplyHouseInvoiceLedgerAllocation[] {
  const raw = r.supply_house_invoice_job_allocations
  if (!raw || !Array.isArray(raw)) return []
  return [...raw].sort((a, b) => Number(b.pct) - Number(a.pct))
}

function formatSupplyInvoiceDateYmd(ymd: string): string {
  const t = ymd.trim()
  if (!t) return '—'
  const d = new Date(`${t}T12:00:00`)
  return Number.isNaN(d.getTime()) ? t : d.toLocaleDateString(undefined, { dateStyle: 'medium' })
}

function documentsSupplyInvoiceRowMatchesSearch(r: SupplyHouseInvoiceLedgerRow, query: string): boolean {
  const t = query.trim().toLowerCase()
  if (!t) return true
  if ((r.invoice_number ?? '').toLowerCase().includes(t)) return true
  if ((r.purchase_order_number ?? '').toLowerCase().includes(t)) return true
  if (supplyHouseInvoiceLedgerHouseName(r).toLowerCase().includes(t)) return true
  if (formatSupplyInvoiceDateYmd(r.invoice_date).toLowerCase().includes(t)) return true
  if (formatJobRevenueUsd(Number(r.amount)).toLowerCase().includes(t)) return true
  if (String(r.amount ?? '').toLowerCase().includes(t)) return true
  if (t.includes('paid') && r.is_paid) return true
  if ((t.includes('unpaid') || t.includes('open')) && !r.is_paid) return true
  for (const a of supplyHouseInvoiceLedgerAllocations(r)) {
    const jl = a.jobs_ledger
    const hcp = (jl?.hcp_number ?? '').trim()
    const jn = (jl?.job_name ?? '').trim()
    const ja = (jl?.job_address ?? '').trim()
    if (hcp.toLowerCase().includes(t)) return true
    if (jn.toLowerCase().includes(t)) return true
    if (ja.toLowerCase().includes(t)) return true
    if (a.job_id.toLowerCase().includes(t)) return true
  }
  return false
}

function documentsJobInvoiceMatchesSearch(inv: DocumentsJobLedgerInvoiceRow, query: string): boolean {
  const t = query.trim().toLowerCase()
  if (!t) return true
  if (String(inv.sequence_order).includes(t)) return true
  if (billingTypeLabel(inv).toLowerCase().includes(t)) return true
  if (String(inv.amount ?? '').includes(t)) return true
  if (formatJobRevenueUsd(inv.amount).toLowerCase().includes(t)) return true
  const sent = (inv.sent_to_customer_at ?? '').trim().toLowerCase()
  if (sent && sent.includes(t)) return true
  const billed = (inv.billed_at ?? '').trim().toLowerCase()
  if (billed && billed.includes(t)) return true
  const ch = (inv.external_send_channel ?? '').trim().toLowerCase()
  if (ch && ch.includes(t)) return true
  return false
}

function documentsJobsRowMatchesSearch(
  r: LedgerJobRow,
  query: string,
  billedInvoices: DocumentsJobLedgerInvoiceRow[],
): boolean {
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
  for (const inv of billedInvoices) {
    if (documentsJobInvoiceMatchesSearch(inv, query)) return true
  }
  return false
}

function DocumentsJobsLedger({ embedSearch }: DocumentsLedgerEmbedProps = {}) {
  const embedded = embedSearch !== undefined
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const prefixMap = useLedgerPrefixMap()
  const [rows, setRows] = useState<LedgerJobRow[]>([])
  const [invoicesByJobId, setInvoicesByJobId] = useState<Map<string, DocumentsJobLedgerInvoiceRow[]>>(() => new Map())
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [addDriveLinkJob, setAddDriveLinkJob] = useState<{ id: string; title: string } | null>(null)
  const [billedInvoiceModal, setBilledInvoiceModal] = useState<DocumentsJobLedgerInvoiceRow | null>(null)

  const effectiveSearch = embedded ? embedSearch : search
  const filteredRows = useMemo(() => {
    if (!effectiveSearch.trim()) {
      if (embedded) return []
      return rows
    }
    return rows.filter((r) =>
      documentsJobsRowMatchesSearch(r, effectiveSearch, invoicesByJobId.get(r.id) ?? []),
    )
  }, [rows, effectiveSearch, embedded, invoicesByJobId])

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const data = await withSupabaseRetry(
        async () =>
          await supabase
            .from('jobs_ledger')
            .select(
              'id, hcp_number, service_type_id, job_name, job_address, status, revenue, google_drive_link, updated_at, customer_name, customer_email, customers(name, address)',
            )
            .order('updated_at', { ascending: false, nullsFirst: false })
            .limit(200),
        'load documents jobs ledger',
      )
      const jobList = (data ?? []) as LedgerJobRow[]
      setRows(jobList)

      const jobIds = jobList.map((r) => r.id)
      if (jobIds.length === 0) {
        setInvoicesByJobId(new Map())
        return
      }

      try {
        const invData = await withSupabaseRetry(
          async () =>
            await supabase
              .from('jobs_ledger_invoices')
              .select(
                'id, job_id, amount, sequence_order, external_send_channel, sent_to_customer_at, billed_at, estimated_bill_date, external_send_note, stripe_invoice_id, hosted_invoice_url, stripe_invoice_memo, stripe_invoice_footer, stripe_invoice_status, status, created_at',
              )
              .in('job_id', jobIds)
              .eq('status', 'billed')
              .order('sequence_order', { ascending: true })
              .order('created_at', { ascending: true }),
          'load documents jobs ledger invoices',
        )

        const byJob = new Map<string, DocumentsJobLedgerInvoiceRow[]>()
        for (const row of invData ?? []) {
          const inv = row as DocumentsJobLedgerInvoiceRow
          const jid = inv.job_id
          const arr = byJob.get(jid) ?? []
          arr.push(inv)
          byJob.set(jid, arr)
        }
        for (const arr of byJob.values()) {
          arr.sort((a, b) => {
            if (a.sequence_order !== b.sequence_order) return a.sequence_order - b.sequence_order
            return String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''))
          })
        }
        setInvoicesByJobId(byJob)
      } catch (invErr) {
        showToast(formatErrorMessage(invErr, 'Could not load job invoices'), 'error')
        setInvoicesByJobId(new Map())
      }
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not load jobs'), 'error')
      setRows([])
      setInvoicesByJobId(new Map())
    } finally {
      setLoading(false)
    }
  }, [user?.id, showToast])

  useEffect(() => {
    void load()
  }, [load])

  if (!user?.id) {
    return <p style={{ color: 'var(--text-muted)' }}>Sign in to view the ledger.</p>
  }

  return (
    <div>
      <DocumentsJobBilledInvoiceModal
        open={billedInvoiceModal != null}
        invoice={billedInvoiceModal}
        onClose={() => setBilledInvoiceModal(null)}
      />
      <DocumentsAddDriveLinkModal
        open={addDriveLinkJob != null}
        onClose={() => setAddDriveLinkJob(null)}
        title="Add customer files link"
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
      {!embedded && !loading && rows.length > 0 ? (
        <div style={{ marginBottom: '0.75rem' }}>
          <input
            id="documents-jobs-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="HCP, job, invoices, amount, channel…"
            autoComplete="off"
            aria-label="Search jobs in ledger"
            style={documentsLedgerSearchInputStyle}
          />
        </div>
      ) : null}
      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No jobs in this ledger.</p>
      ) : embedded && !embedSearch.trim() ? (
        <p style={documentsLedgerEmbedHintStyle}>Results appear when you type a search above.</p>
      ) : filteredRows.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No jobs match your search.</p>
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
                const titleText = hcp
                  ? formatJobLedgerDocTitle(prefixMap, r.service_type_id ?? null, hcp, jn)
                  : jn || '—'
                const addr = (r.job_address ?? '').trim()
                const filesLink = (r.google_drive_link ?? '').trim()
                const hasJobFiles = !!filesLink
                const jobInvoices = invoicesByJobId.get(r.id) ?? []
                return (
                  <Fragment key={r.id}>
                    <tr>
                      <td style={{ ...tdStyle, verticalAlign: 'middle' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          {hasJobFiles ? (
                            <button
                              type="button"
                              aria-label="Open customer files (Google Drive)"
                              style={docsIconButtonStyle}
                              onClick={() => openInExternalBrowser(filesLink)}
                            >
                              <LedgerBidProjectFolderIcon />
                            </button>
                          ) : null}
                          {!hasJobFiles ? (
                            <button
                              type="button"
                              aria-label="Add customer files link"
                              title="Add customer files link"
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
                        <Link to={`/jobs?edit=${encodeURIComponent(r.id)}`} style={{ color: 'var(--text-link)', fontWeight: 500 }}>
                          {titleText}
                        </Link>
                      </td>
                      <td style={tdStyle}>
                        {addr ? <div>{addr}</div> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td style={tdStyle}>
                        <div>{cx.primary}</div>
                        {cx.secondary ? (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{cx.secondary}</div>
                        ) : null}
                      </td>
                      <td style={tdStyle}>{documentsJobLedgerStatusLabel(r.status)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>{formatJobRevenueUsd(r.revenue)}</td>
                    </tr>
                    {jobInvoices.map((inv) => {
                      const sent = (inv.sent_to_customer_at ?? '').trim().slice(0, 10)
                      return (
                        <tr key={inv.id}>
                          <td colSpan={6} style={{ ...tdStyle, paddingLeft: '1.75rem', background: 'var(--bg-page)' }}>
                            <button
                              type="button"
                              onClick={() => setBilledInvoiceModal(inv)}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                padding: 0,
                                cursor: 'pointer',
                                textAlign: 'left',
                                font: 'inherit',
                                color: 'var(--text-blue-700)',
                                textDecoration: 'underline',
                              }}
                            >
                              Invoice #{inv.sequence_order}
                            </button>
                            <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>{billingTypeLabel(inv)}</span>
                            <span style={{ marginLeft: '0.5rem' }}>{formatJobRevenueUsd(inv.amount)}</span>
                            {sent ? (
                              <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem', fontSize: '0.85rem' }}>Sent {sent}</span>
                            ) : null}
                          </td>
                        </tr>
                      )
                    })}
                  </Fragment>
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

function DocumentsBidProposalsLedger({ embedSearch }: DocumentsLedgerEmbedProps = {}) {
  const embedded = embedSearch !== undefined
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const prefixMap = useLedgerPrefixMap()
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
              'id, project_name, address, bid_number, service_type_id, bid_value, bid_date_sent, outcome, updated_at, bid_submission_link, drive_link, customers(name, address), service_type:service_types(name)',
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

  const effectiveSearch = embedded ? embedSearch : search
  const filteredRows = useMemo(() => {
    if (!effectiveSearch.trim()) {
      if (embedded) return []
      return rows
    }
    return rows.filter((r) => {
      const lines = countRowsByBidId.get(r.id) ?? []
      return documentsBidProposalsRowMatchesSearch(r, lines, effectiveSearch)
    })
  }, [rows, effectiveSearch, embedded, countRowsByBidId])

  const tableRows = useMemo(() => {
    if (effectiveSearch.trim()) return filteredRows
    return filteredRows.filter((r) => r.outcome !== 'lost')
  }, [filteredRows, effectiveSearch])

  if (!user?.id) {
    return <p style={{ color: 'var(--text-muted)' }}>Sign in to view the ledger.</p>
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
      {!embedded && !loading && rows.length > 0 ? (
        <div style={{ marginBottom: '0.75rem' }}>
          <input
            id="documents-bid-proposals-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Title, site, customer, counts, status…"
            autoComplete="off"
            aria-label="Search bid proposals"
            style={documentsLedgerSearchInputStyle}
          />
        </div>
      ) : null}
      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No bid proposals in this ledger.</p>
      ) : embedded && !embedSearch.trim() ? (
        <p style={documentsLedgerEmbedHintStyle}>Results appear when you type a search above.</p>
      ) : filteredRows.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No bids match your search.</p>
      ) : tableRows.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>
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
                const titleText = bidNum
                  ? formatBidLedgerDocTitle(prefixMap, r.service_type_id ?? null, bidNum, titleBase)
                  : titleBase
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
                          color: 'var(--text-link)',
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
                      {addr ? <div>{addr}</div> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={tdStyle}>
                      <div>{cx.primary}</div>
                      {cx.secondary ? (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{cx.secondary}</div>
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

function DocumentsSupplyHouseInvoicesLedger({ embedSearch }: DocumentsLedgerEmbedProps = {}) {
  const embedded = embedSearch !== undefined
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const prefixMap = useLedgerPrefixMap()
  const [rows, setRows] = useState<SupplyHouseInvoiceLedgerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [addDriveLinkInvoice, setAddDriveLinkInvoice] = useState<{
    id: string
    invoiceNumber: string
    supplyHouseName: string
  } | null>(null)

  const effectiveSearch = embedded ? embedSearch : search
  const filteredRows = useMemo(() => {
    if (!effectiveSearch.trim()) {
      if (embedded) return []
      return rows
    }
    return rows.filter((r) => documentsSupplyInvoiceRowMatchesSearch(r, effectiveSearch))
  }, [rows, effectiveSearch, embedded])

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const data = await withSupabaseRetry(
        async () =>
          await supabase
            .from('supply_house_invoices')
            .select(
              `*,
              supply_houses(name),
              supply_house_invoice_job_allocations(
                job_id,
                pct,
                jobs_ledger(id, hcp_number, job_name, job_address, service_type_id)
              )`,
            )
            .order('invoice_date', { ascending: false })
            .limit(200),
        'load documents supply house invoices',
      )
      setRows((data ?? []) as SupplyHouseInvoiceLedgerRow[])
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not load supply house invoices'), 'error')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [user?.id, showToast])

  useEffect(() => {
    void load()
  }, [load])

  if (!user?.id) {
    return <p style={{ color: 'var(--text-muted)' }}>Sign in to view the ledger.</p>
  }

  return (
    <div>
      <DocumentsAddDriveLinkModal
        open={addDriveLinkInvoice != null}
        onClose={() => setAddDriveLinkInvoice(null)}
        title="Add supply house invoice document link"
        description={
          addDriveLinkInvoice
            ? `${addDriveLinkInvoice.supplyHouseName} · Invoice #${addDriveLinkInvoice.invoiceNumber}`
            : null
        }
        bidSaveColumn={null}
        bidNeedsTargetChoice={false}
        onSave={async (normalizedUrl, _bidTarget: DocumentsBidLinkColumn | null) => {
          if (!addDriveLinkInvoice) return
          await withSupabaseRetry(
            async () =>
              await supabase
                .from('supply_house_invoices')
                .update({ link: normalizedUrl })
                .eq('id', addDriveLinkInvoice.id),
            'documents save supply house invoice link',
          )
          showToast('Link saved', 'success')
          await load()
        }}
      />
      {!embedded && !loading && rows.length > 0 ? (
        <div style={{ marginBottom: '0.75rem' }}>
          <input
            id="documents-supply-invoices-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Invoice #, PO, supply house, job, amount…"
            autoComplete="off"
            aria-label="Search supply house invoices"
            style={documentsLedgerSearchInputStyle}
          />
        </div>
      ) : null}
      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No supply house invoices in this ledger.</p>
      ) : embedded && !embedSearch.trim() ? (
        <p style={documentsLedgerEmbedHintStyle}>Results appear when you type a search above.</p>
      ) : filteredRows.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No invoices match your search.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Docs</th>
                <th style={thStyle}>Job</th>
                <th style={thStyle}>
                  <span style={{ display: 'block' }}>Supply house</span>
                  <span
                    style={{
                      display: 'block',
                      marginTop: '0.15rem',
                      fontSize: '0.8rem',
                      fontWeight: 400,
                      color: 'var(--text-muted)',
                    }}
                  >
                    Invoice #
                  </span>
                </th>
                <th style={thStyle}>Purchase order</th>
                <th style={thStyle}>Date</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => {
                const docLink = (r.link ?? '').trim()
                const hasDocLink = !!docLink
                const house = supplyHouseInvoiceLedgerHouseName(r)
                const allocs = supplyHouseInvoiceLedgerAllocations(r)
                const allocTitle = allocs
                  .map((a) => {
                    const jl = a.jobs_ledger
                    const hcp = (jl?.hcp_number ?? '').trim()
                    const jn = (jl?.job_name ?? '').trim()
                    const ja = (jl?.job_address ?? '').trim()
                    const pct = Number(a.pct)
                    const pctStr = Number.isFinite(pct) && pct > 0 ? ` · ${pct}%` : ''
                    const line1 =
                      (hcp
                        ? formatJobLedgerDocTitle(prefixMap, jl?.service_type_id ?? null, hcp, jn)
                        : `— | ${jn || '—'}`) + pctStr
                    return ja ? `${line1} — ${ja}` : line1
                  })
                  .join('; ')
                return (
                  <tr key={r.id}>
                    <td style={{ ...tdStyle, verticalAlign: 'middle', width: '2.5rem' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        {hasDocLink ? (
                          <button
                            type="button"
                            aria-label="Open invoice document"
                            style={docsIconButtonStyle}
                            onClick={() => openInExternalBrowser(docLink)}
                          >
                            <LedgerDocIconFilled />
                          </button>
                        ) : null}
                        {!hasDocLink ? (
                          <button
                            type="button"
                            aria-label="Add invoice document link"
                            title="Add document link"
                            style={docsAddLinkButtonStyle}
                            onClick={() =>
                              setAddDriveLinkInvoice({
                                id: r.id,
                                invoiceNumber: (r.invoice_number ?? '').trim() || '—',
                                supplyHouseName: house,
                              })
                            }
                          >
                            +
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td style={tdStyle} title={allocTitle || undefined}>
                      {allocs.length === 0 ? (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {allocs.map((a) => {
                            const jl = a.jobs_ledger
                            const jid = jl?.id ?? a.job_id
                            const hcp = (jl?.hcp_number ?? '').trim()
                            const jn = (jl?.job_name ?? '').trim()
                            const ja = (jl?.job_address ?? '').trim()
                            const pct = Number(a.pct)
                            const pctStr = Number.isFinite(pct) && pct > 0 ? ` · ${pct}%` : ''
                            const line1 =
                      (hcp
                        ? formatJobLedgerDocTitle(prefixMap, jl?.service_type_id ?? null, hcp, jn)
                        : `— | ${jn || '—'}`) + pctStr
                            return (
                              <Link
                                key={`${r.id}-${a.job_id}-${a.pct}`}
                                to={`/jobs?edit=${encodeURIComponent(jid)}`}
                                style={{
                                  display: 'block',
                                  fontWeight: 500,
                                  color: '#15803d',
                                  textDecoration: 'none',
                                  maxWidth: '14rem',
                                }}
                              >
                                <span style={{ display: 'block' }}>{line1}</span>
                                <span
                                  title={ja || undefined}
                                  style={{
                                    display: 'block',
                                    marginTop: '0.1rem',
                                    fontSize: '0.8rem',
                                    fontWeight: 400,
                                    color: 'var(--text-muted)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {ja || '—'}
                                </span>
                              </Link>
                            )
                          })}
                        </div>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span>{house}</span>
                        <span>
                          <span style={{ fontWeight: 500 }}>{(r.invoice_number ?? '').trim() || '—'}</span>
                          {r.is_paid ? (
                            <span style={{ marginLeft: '0.35rem', fontSize: '0.75rem', color: '#15803d' }}>(Paid)</span>
                          ) : null}
                        </span>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      {(r.purchase_order_number ?? '').trim() ? (
                        <span>{(r.purchase_order_number ?? '').trim()}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={tdStyle}>{formatSupplyInvoiceDateYmd(r.invoice_date)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {formatJobRevenueUsd(Number(r.amount))}
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

const documentsUnifiedSectionHeadingStyle: CSSProperties = {
  fontSize: '1rem',
  fontWeight: 600,
  margin: '1.25rem 0 0.35rem',
}

function DocumentsUnifiedSearchTab() {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const q = query.trim()
  const filterQuery = q.length >= 2 ? query : ''

  if (!user?.id) {
    return <p style={{ color: 'var(--text-muted)', margin: 0 }}>Sign in to search documents.</p>
  }
  return (
    <div>
      <div style={{ marginBottom: '0.75rem' }}>
        <input
          id="documents-unified-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type at least 2 characters — estimates, bids, jobs, supply invoices…"
          autoComplete="off"
          aria-label="Search across document ledgers"
          style={documentsLedgerSearchInputStyle}
        />
        {q.length === 1 ? (
          <p style={{ color: 'var(--text-muted)', margin: '0.35rem 0 0', fontSize: '0.875rem' }}>
            Enter at least 2 characters to search.
          </p>
        ) : null}
      </div>
      <div>
        <h2 style={{ ...documentsUnifiedSectionHeadingStyle, marginTop: '0.35rem' }}>Estimates</h2>
        <DocumentsEstimatesLedger embedSearch={filterQuery} />
      </div>
      <div>
        <h2 style={documentsUnifiedSectionHeadingStyle}>Bid proposals</h2>
        <DocumentsBidProposalsLedger embedSearch={filterQuery} />
      </div>
      <div>
        <h2 style={documentsUnifiedSectionHeadingStyle}>Jobs</h2>
        <DocumentsJobsLedger embedSearch={filterQuery} />
      </div>
      <div>
        <h2 style={documentsUnifiedSectionHeadingStyle}>Supply invoices</h2>
        <DocumentsSupplyHouseInvoicesLedger embedSearch={filterQuery} />
      </div>
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
    <div style={{ position: 'relative', padding: '0.35rem 1.25rem 1rem', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={documentsPageVisuallyHiddenH1Style}>Documents</h1>

      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          style={pageTabStyle(documentsTab === 'search')}
          onClick={() => setDocumentsTab('search')}
        >
          Search
        </button>
        <button
          type="button"
          style={pageTabStyle(documentsTab === 'estimates')}
          onClick={() => setDocumentsTab('estimates')}
        >
          Estimates
        </button>
        <button
          type="button"
          style={pageTabStyle(documentsTab === 'bid-proposals')}
          onClick={() => setDocumentsTab('bid-proposals')}
        >
          Bid proposals
        </button>
        <button
          type="button"
          style={pageTabStyle(documentsTab === 'jobs')}
          onClick={() => setDocumentsTab('jobs')}
        >
          Jobs
        </button>
        <button
          type="button"
          style={pageTabStyle(documentsTab === 'supply-invoices')}
          onClick={() => setDocumentsTab('supply-invoices')}
        >
          Supply invoices
        </button>
        <button type="button" style={pageTabStyle(documentsTab === 'upload')} onClick={() => setDocumentsTab('upload')}>
          Upload
        </button>
      </div>

      {documentsTab === 'upload' ? (
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>Upload coming soon.</p>
      ) : null}
      {documentsTab === 'search' ? <DocumentsUnifiedSearchTab /> : null}
      {documentsTab === 'estimates' ? <DocumentsEstimatesLedger /> : null}
      {documentsTab === 'bid-proposals' ? <DocumentsBidProposalsLedger /> : null}
      {documentsTab === 'jobs' ? <DocumentsJobsLedger /> : null}
      {documentsTab === 'supply-invoices' ? <DocumentsSupplyHouseInvoicesLedger /> : null}
    </div>
  )
}
