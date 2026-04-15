import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { Tables } from '../types/database'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { useToastContext } from '../contexts/ToastContext'
import { pageUnderlineTabStyle } from '../lib/pageUnderlineTabStyle'

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
  'id' | 'project_name' | 'address' | 'bid_number' | 'bid_value' | 'bid_date_sent' | 'outcome' | 'updated_at'
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

function bidProposalCountsTooltip(lines: Array<{ fixture: string; count: number }>): string {
  if (lines.length === 0) return ''
  return lines
    .map((l) => {
      const f = (l.fixture ?? '').trim() || '—'
      return `${f} × ${l.count}`
    })
    .join('\n')
}

function bidProposalCountsPreview(lines: Array<{ fixture: string; count: number }>, maxLines: number): string {
  if (lines.length === 0) return '—'
  const parts = lines.slice(0, maxLines).map((l) => {
    const f = (l.fixture ?? '').trim() || '—'
    const short = f.length > 28 ? `${f.slice(0, 26)}…` : f
    return `${short} × ${l.count}`
  })
  const more = lines.length > maxLines ? ` (+${lines.length - maxLines})` : ''
  return `${lines.length} line${lines.length !== 1 ? 's' : ''}: ${parts.join('; ')}${more}`
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

function DocumentsEstimatesLedger() {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const [rows, setRows] = useState<LedgerEstimateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

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

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const bidList = await withSupabaseRetry(
        async () =>
          await supabase
            .from('bids')
            .select(
              'id, project_name, address, bid_number, bid_value, bid_date_sent, outcome, updated_at, customers(name, address), service_type:service_types(name)',
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

  if (!user?.id) {
    return <p style={{ color: '#6b7280' }}>Sign in to view the ledger.</p>
  }

  return (
    <div>
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
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Title</th>
                <th style={thStyle}>Job</th>
                <th style={thStyle}>Counts</th>
                <th style={thStyle}>Customer</th>
                <th style={thStyle}>Status</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
                <th style={thStyle}>Service Type</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => {
                const cx = bidProposalCustomerLines(r)
                const lines = countRowsByBidId.get(r.id) ?? []
                const coverHref = `/bids?bidId=${encodeURIComponent(r.id)}&tab=${COVER_LETTER_TAB}`
                const addr = (r.address ?? '').trim()
                const bidNum = r.bid_number != null && String(r.bid_number).trim() !== '' ? String(r.bid_number).trim() : null
                const titleBase = (r.project_name ?? '').trim() || 'Untitled'
                const titleDisplay = bidNum ? `B${bidNum} | ${titleBase}` : titleBase
                return (
                  <tr key={r.id}>
                    <td style={tdStyle}>
                      <Link to={coverHref} style={{ color: '#2563eb', fontWeight: 500 }}>
                        {titleDisplay}
                      </Link>
                    </td>
                    <td style={tdStyle}>
                      {addr ? <div>{addr}</div> : <span style={{ color: '#6b7280' }}>—</span>}
                    </td>
                    <td style={tdStyle}>
                      <span title={lines.length > 0 ? bidProposalCountsTooltip(lines) : undefined}>
                        {bidProposalCountsPreview(lines, 3)}
                      </span>
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
                    <td style={tdStyle}>{(r.service_type?.name ?? '').trim() || '—'}</td>
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
  const [searchParams, setSearchParams] = useSearchParams()
  const mainTabRaw = searchParams.get('tab')
  const mainTab = mainTabRaw === 'upload' ? 'upload' : 'ledger'
  const ledgerRaw = searchParams.get('ledger')
  const ledgerTab = ledgerRaw === 'bid-proposals' ? 'bid-proposals' : 'estimates'

  function setMainTab(next: 'ledger' | 'upload') {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('tab', next)
    if (next === 'ledger') {
      if (!nextParams.get('ledger')) nextParams.set('ledger', 'estimates')
    } else {
      nextParams.delete('ledger')
    }
    setSearchParams(nextParams, { replace: true })
  }

  function setLedgerTab(next: string) {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('tab', 'ledger')
    nextParams.set('ledger', next)
    setSearchParams(nextParams, { replace: true })
  }

  return (
    <div style={{ padding: '1rem 1.25rem', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 1rem' }}>Documents</h1>

      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button type="button" style={pageUnderlineTabStyle(mainTab === 'ledger')} onClick={() => setMainTab('ledger')}>
          Ledger
        </button>
        <button type="button" style={pageUnderlineTabStyle(mainTab === 'upload')} onClick={() => setMainTab('upload')}>
          Upload
        </button>
      </div>

      {mainTab === 'upload' ? (
        <p style={{ color: '#6b7280', margin: 0 }}>Upload coming soon.</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              style={pageUnderlineTabStyle(ledgerTab === 'estimates')}
              onClick={() => setLedgerTab('estimates')}
            >
              Estimates
            </button>
            <button
              type="button"
              style={pageUnderlineTabStyle(ledgerTab === 'bid-proposals')}
              onClick={() => setLedgerTab('bid-proposals')}
            >
              Bid proposals
            </button>
          </div>
          {ledgerTab === 'estimates' ? <DocumentsEstimatesLedger /> : null}
          {ledgerTab === 'bid-proposals' ? <DocumentsBidProposalsLedger /> : null}
        </>
      )}
    </div>
  )
}
