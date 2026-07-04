import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import {
  buildCustomerReviewRows,
  filterCustomerReviewRows,
  formatCustomerReviewHours,
  sumCustomerReviewRows,
  type CustomerReviewBidInput,
  type CustomerReviewBidHoursRow,
  type CustomerReviewJobHoursRow,
  type CustomerReviewRow,
} from '../../lib/bidBoardCustomerReview'
import { ModalShell } from './ModalShell'

/**
 * Bid Board → Customer review: per-customer bid counts by section plus total
 * reported team hours across estimating (bid clock sessions) and jobs.
 * Always all trades (ignores the page's service-type filter): customer
 * relationships and job hours span trades.
 */

const RPC_BID_IDS_CHUNK = 500

type RawBidRow = {
  id: string
  outcome: string | null
  bid_date_sent: string | null
  customer_id: string | null
  gc_builder_id: string | null
  customers: { id: string; name: string | null } | { id: string; name: string | null }[] | null
  bids_gc_builders: { id: string; name: string | null } | { id: string; name: string | null }[] | null
}

function firstOrNull<T>(v: T | T[] | null): T | null {
  return v == null ? null : Array.isArray(v) ? (v[0] ?? null) : v
}

const TH: CSSProperties = {
  padding: '0.4rem 0.5rem',
  borderBottom: '2px solid #e5e7eb',
  fontSize: '0.8rem',
  color: '#374151',
  textAlign: 'center',
  whiteSpace: 'nowrap',
}
const TD_NUM: CSSProperties = { padding: '0.4rem 0.5rem', borderBottom: '1px solid #f3f4f6', textAlign: 'center' }
const TD_NAME: CSSProperties = { padding: '0.4rem 0.5rem', borderBottom: '1px solid #f3f4f6', textAlign: 'left' }

function CountCell({ value, style }: { value: number; style?: CSSProperties }) {
  return <td style={{ ...TD_NUM, ...style }}>{value > 0 ? value : <span style={{ color: '#d1d5db' }}>—</span>}</td>
}

export function BidBoardCustomerReviewModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<CustomerReviewRow[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        // All trades on purpose — see module comment.
        const bidsRaw = await withSupabaseRetry(
          async () =>
            supabase
              .from('bids')
              .select('id, outcome, bid_date_sent, customer_id, gc_builder_id, customers(id, name), bids_gc_builders(id, name)'),
          'customer review: load bids',
        )
        const bids: CustomerReviewBidInput[] = ((bidsRaw ?? []) as unknown as RawBidRow[]).map((b) => {
          const customer = firstOrNull(b.customers)
          const gcBuilder = firstOrNull(b.bids_gc_builders)
          return {
            id: b.id,
            outcome: b.outcome,
            bid_date_sent: b.bid_date_sent,
            customerId: b.customer_id,
            customerName: customer?.name ?? null,
            gcBuilderId: b.gc_builder_id,
            gcBuilderName: gcBuilder?.name ?? null,
          }
        })

        const bidIds = bids.map((b) => b.id)
        const bidIdChunks: string[][] = []
        for (let i = 0; i < bidIds.length; i += RPC_BID_IDS_CHUNK) {
          bidIdChunks.push(bidIds.slice(i, i + RPC_BID_IDS_CHUNK))
        }

        const [bidHoursChunks, jobHoursRaw] = await Promise.all([
          Promise.all(
            bidIdChunks.map((chunk) =>
              withSupabaseRetry(
                async () => supabase.rpc('list_bid_estimators_all_time_hours', { p_bid_ids: chunk }),
                'customer review: bid hours RPC',
              ),
            ),
          ),
          withSupabaseRetry(
            async () => supabase.rpc('list_customer_review_job_hours'),
            'customer review: job hours RPC',
          ),
        ])
        const bidHours = bidHoursChunks.flatMap((c) => (c ?? []) as CustomerReviewBidHoursRow[])
        const jobHours = (jobHoursRaw ?? []) as CustomerReviewJobHoursRow[]

        if (cancelled) return
        setRows(buildCustomerReviewRows(bids, bidHours, jobHours))
      } catch (e: unknown) {
        if (!cancelled) setError(formatErrorMessage(e, 'Failed to load customer review'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const visibleRows = useMemo(() => filterCustomerReviewRows(rows, searchQuery), [rows, searchQuery])
  const totals = useMemo(() => sumCustomerReviewRows(visibleRows), [visibleRows])

  return (
    <ModalShell
      zIndex={1000}
      cardStyle={{
        background: 'white',
        padding: '1.5rem',
        borderRadius: 8,
        maxWidth: 1000,
        width: '95%',
        maxHeight: '85vh',
        overflow: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <h3 style={{ margin: 0 }}>Customer review</h3>
        <button
          type="button"
          onClick={onClose}
          style={{ padding: '0.35rem 0.9rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
        >
          Close
        </button>
      </div>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: '#6b7280' }}>
        All trades. Hours are reported team clock hours — estimating (clocked to the customer's bids) and jobs (clocked
        to the customer's jobs) — excluding rejected/revoked sessions.
      </p>
      <input
        type="text"
        placeholder="Search customers..."
        aria-label="Search customers in the Customer review"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box', marginBottom: '0.75rem' }}
      />
      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: '1rem', color: '#dc2626' }}>{error}</div>
      ) : visibleRows.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
          {rows.length === 0 ? 'No customers to show yet.' : 'No customers match your search.'}
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr>
              <th style={{ ...TH, textAlign: 'left' }}>Customer</th>
              <th style={TH}>Unsent / Working</th>
              <th style={TH}>Not yet won or lost</th>
              <th style={TH}>Won</th>
              <th style={TH}>Started or Complete</th>
              <th style={TH}>Lost</th>
              <th style={TH}>Estimating hrs</th>
              <th style={TH}>Job hrs</th>
              <th style={TH}>Total hrs</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.key}>
                <td style={TD_NAME}>{row.customerName}</td>
                <CountCell value={row.counts.unsent} />
                <CountCell value={row.counts.pending} />
                <CountCell value={row.counts.won} />
                <CountCell value={row.counts.startedOrComplete} />
                <CountCell value={row.counts.lost} />
                <td style={TD_NUM}>{formatCustomerReviewHours(row.estimatingHours)}</td>
                <td style={TD_NUM}>{formatCustomerReviewHours(row.jobHours)}</td>
                <td style={{ ...TD_NUM, fontWeight: 600 }}>{formatCustomerReviewHours(row.totalHours)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700 }}>
              <td style={{ ...TD_NAME, borderTop: '2px solid #e5e7eb' }}>
                Total ({visibleRows.length} customer{visibleRows.length === 1 ? '' : 's'})
              </td>
              <CountCell value={totals.counts.unsent} style={{ borderTop: '2px solid #e5e7eb' }} />
              <CountCell value={totals.counts.pending} style={{ borderTop: '2px solid #e5e7eb' }} />
              <CountCell value={totals.counts.won} style={{ borderTop: '2px solid #e5e7eb' }} />
              <CountCell value={totals.counts.startedOrComplete} style={{ borderTop: '2px solid #e5e7eb' }} />
              <CountCell value={totals.counts.lost} style={{ borderTop: '2px solid #e5e7eb' }} />
              <td style={{ ...TD_NUM, borderTop: '2px solid #e5e7eb' }}>{formatCustomerReviewHours(totals.estimatingHours)}</td>
              <td style={{ ...TD_NUM, borderTop: '2px solid #e5e7eb' }}>{formatCustomerReviewHours(totals.jobHours)}</td>
              <td style={{ ...TD_NUM, borderTop: '2px solid #e5e7eb' }}>{formatCustomerReviewHours(totals.totalHours)}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </ModalShell>
  )
}
