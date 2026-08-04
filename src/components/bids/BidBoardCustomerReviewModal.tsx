import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
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
import {
  buildCustomerReviewDetail,
  contributorInitials,
  formatContributorShare,
  formatSessionDay,
  formatSessionTimeRange,
  parseCustomerReviewGroupKey,
  type CustomerReviewDetail,
  type CustomerReviewSessionRow,
  type CustomerReviewTargetGroup,
} from '../../lib/bidBoardCustomerReviewDetail'
import { useNarrowViewport660 } from '../../hooks/useNarrowViewport660'
import { ModalShell } from './ModalShell'

/**
 * Bid Board → Customer review: per-customer bid counts by section plus total
 * reported team hours across estimating (bid clock sessions) and jobs.
 * Always all trades (ignores the page's service-type filter): customer
 * relationships and job hours span trades.
 *
 * Clicking a row (v2.1382) drills into that customer's detail: a contributor
 * leaderboard (who logged the hours, estimating vs jobs split) and the hours
 * grouped by bid/job, each expandable to the individual clock sessions.
 * Esc backs out one layer at a time: detail → list → closed.
 */

const RPC_BID_IDS_CHUNK = 500

// Saturated accent pair for the estimating/jobs split (stay literal per theme rules).
const ESTIMATING_COLOR = '#ea580c'
const JOB_COLOR = '#3b82f6'

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
  padding: '0.4rem 0.55rem',
  borderBottom: '2px solid var(--border)',
  fontSize: '0.78rem',
  color: 'var(--text-700)',
  textAlign: 'right',
  whiteSpace: 'nowrap',
  position: 'sticky',
  top: 0,
  background: 'var(--surface)',
  zIndex: 1,
}
const TD_NUM: CSSProperties = {
  padding: '0.4rem 0.55rem',
  borderBottom: '1px solid var(--border)',
  textAlign: 'right',
  whiteSpace: 'nowrap',
  fontVariantNumeric: 'tabular-nums',
}
const TD_NAME: CSSProperties = { padding: '0.4rem 0.55rem', borderBottom: '1px solid var(--border)', textAlign: 'left', fontWeight: 500 }

function CountCell({ value, style }: { value: number; style?: CSSProperties }) {
  return <td style={{ ...TD_NUM, ...style }}>{value > 0 ? value : <span style={{ color: 'var(--text-faint-300)' }}>—</span>}</td>
}

function HoursCell({ hours, style }: { hours: number; style?: CSSProperties }) {
  return (
    <td style={{ ...TD_NUM, ...style }}>
      {hours > 0 ? formatCustomerReviewHours(hours) : <span style={{ color: 'var(--text-faint-300)' }}>—</span>}
    </td>
  )
}

export function BidBoardCustomerReviewModal({ onClose }: { onClose: () => void }) {
  const narrow = useNarrowViewport660()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<CustomerReviewRow[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)

  const [selected, setSelected] = useState<CustomerReviewRow | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detail, setDetail] = useState<CustomerReviewDetail | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const detailCache = useRef(new Map<string, CustomerReviewDetail>())

  // Esc peels one layer at a time: detail → list, then list → closed.
  const selectedRef = useRef(selected)
  selectedRef.current = selected
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (selectedRef.current) {
        e.stopPropagation()
        setSelected(null)
      } else {
        onClose()
      }
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

  // Fetch the clicked customer's sessions (cached per row key for the modal's lifetime).
  useEffect(() => {
    if (!selected) return
    const cached = detailCache.current.get(selected.key)
    if (cached) {
      setDetail(cached)
      setDetailError(null)
      setDetailLoading(false)
      const firstCached = cached.groups[0]
      setExpandedGroups(new Set(firstCached ? [firstCached.key] : []))
      return
    }
    let cancelled = false
    void (async () => {
      setDetailLoading(true)
      setDetailError(null)
      setDetail(null)
      try {
        const { customerId, gcBuilderId } = parseCustomerReviewGroupKey(selected.key)
        // Not in the generated types until the next regen — established
        // `(supabase as any).rpc(...)` precedent (see useQuickfillNoncardAttribution).
        const raw = await withSupabaseRetry(
          async () =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase as any).rpc('list_customer_review_customer_sessions', {
              p_customer_id: customerId,
              p_gc_builder_id: gcBuilderId,
            }),
          'customer review: session detail RPC',
        )
        if (cancelled) return
        const built = buildCustomerReviewDetail((raw ?? []) as CustomerReviewSessionRow[])
        detailCache.current.set(selected.key, built)
        setDetail(built)
        const firstGroup = built.groups[0]
        setExpandedGroups(new Set(firstGroup ? [firstGroup.key] : []))
      } catch (e: unknown) {
        if (!cancelled) setDetailError(formatErrorMessage(e, 'Failed to load customer sessions'))
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selected])

  const visibleRows = useMemo(() => filterCustomerReviewRows(rows, searchQuery), [rows, searchQuery])
  const totals = useMemo(() => sumCustomerReviewRows(visibleRows), [visibleRows])
  const maxTotalHours = useMemo(() => visibleRows.reduce((m, r) => Math.max(m, r.totalHours), 0), [visibleRows])

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <ModalShell
      zIndex={1000}
      cardStyle={{
        background: 'var(--surface)',
        padding: '1.5rem',
        borderRadius: 8,
        maxWidth: 1000,
        width: '95%',
        maxHeight: '85vh',
        overflow: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', gap: '0.75rem' }}>
        {selected ? (
          <button
            type="button"
            onClick={() => setSelected(null)}
            style={{ background: 'none', border: 'none', color: 'var(--text-link)', cursor: 'pointer', padding: 0, fontSize: '0.9rem' }}
          >
            ‹ All customers
          </button>
        ) : (
          <h3 style={{ margin: 0 }}>Customer review</h3>
        )}
        <button
          type="button"
          onClick={onClose}
          style={{ padding: '0.35rem 0.9rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
        >
          Close
        </button>
      </div>

      {selected ? (
        <CustomerReviewDetailView
          row={selected}
          detail={detail}
          loading={detailLoading}
          error={detailError}
          narrow={narrow}
          expandedGroups={expandedGroups}
          onToggleGroup={toggleGroup}
        />
      ) : (
        <>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            All trades. Hours are reported team clock hours — estimating (clocked to the customer's bids) and jobs (clocked
            to the customer's jobs) — excluding rejected/revoked sessions. Click a customer to see who logged the hours.
          </p>
          <input
            type="text"
            placeholder="Search customers..."
            aria-label="Search customers in the Customer review"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box', marginBottom: '0.75rem' }}
          />
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
          ) : error ? (
            <div style={{ padding: '1rem', color: 'var(--text-red-600)' }}>{error}</div>
          ) : visibleRows.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              {rows.length === 0 ? 'No customers to show yet.' : 'No customers match your search.'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
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
                    <th style={{ ...TH, width: 18 }} aria-hidden="true" />
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => {
                    const hovered = hoveredKey === row.key
                    const rowBg = hovered ? { background: 'var(--bg-blue-tint)' } : undefined
                    return (
                      <tr
                        key={row.key}
                        onClick={() => setSelected(row)}
                        onMouseEnter={() => setHoveredKey(row.key)}
                        onMouseLeave={() => setHoveredKey((k) => (k === row.key ? null : k))}
                        style={{ cursor: 'pointer' }}
                        title={`See who logged hours for ${row.customerName}`}
                      >
                        <td style={{ ...TD_NAME, ...rowBg }}>{row.customerName}</td>
                        <CountCell value={row.counts.unsent} style={rowBg} />
                        <CountCell value={row.counts.pending} style={rowBg} />
                        <CountCell value={row.counts.won} style={rowBg} />
                        <CountCell value={row.counts.startedOrComplete} style={rowBg} />
                        <CountCell value={row.counts.lost} style={rowBg} />
                        <HoursCell hours={row.estimatingHours} style={rowBg} />
                        <HoursCell hours={row.jobHours} style={rowBg} />
                        <td style={{ ...TD_NUM, fontWeight: 600, ...rowBg }}>
                          {formatCustomerReviewHours(row.totalHours)}
                          {maxTotalHours > 0 && row.totalHours > 0 && (
                            <span
                              aria-hidden="true"
                              style={{
                                display: 'block',
                                height: 3,
                                borderRadius: 2,
                                background: JOB_COLOR,
                                width: `${Math.max(4, Math.round((row.totalHours / maxTotalHours) * 100))}%`,
                                marginLeft: 'auto',
                                marginTop: 2,
                              }}
                            />
                          )}
                        </td>
                        <td style={{ ...TD_NUM, color: hovered ? 'var(--text-blue-500)' : 'var(--text-faint-300)', ...rowBg }}>›</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 700 }}>
                    <td style={{ ...TD_NAME, borderTop: '2px solid var(--border)' }}>
                      Total ({visibleRows.length} customer{visibleRows.length === 1 ? '' : 's'})
                    </td>
                    <CountCell value={totals.counts.unsent} style={{ borderTop: '2px solid var(--border)' }} />
                    <CountCell value={totals.counts.pending} style={{ borderTop: '2px solid var(--border)' }} />
                    <CountCell value={totals.counts.won} style={{ borderTop: '2px solid var(--border)' }} />
                    <CountCell value={totals.counts.startedOrComplete} style={{ borderTop: '2px solid var(--border)' }} />
                    <CountCell value={totals.counts.lost} style={{ borderTop: '2px solid var(--border)' }} />
                    <td style={{ ...TD_NUM, borderTop: '2px solid var(--border)' }}>{formatCustomerReviewHours(totals.estimatingHours)}</td>
                    <td style={{ ...TD_NUM, borderTop: '2px solid var(--border)' }}>{formatCustomerReviewHours(totals.jobHours)}</td>
                    <td style={{ ...TD_NUM, borderTop: '2px solid var(--border)' }}>{formatCustomerReviewHours(totals.totalHours)}</td>
                    <td style={{ ...TD_NUM, borderTop: '2px solid var(--border)' }} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </ModalShell>
  )
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.9rem', minWidth: 96 }}>
      <div style={{ fontSize: '1.15rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</div>
    </div>
  )
}

function CustomerReviewDetailView({
  row,
  detail,
  loading,
  error,
  narrow,
  expandedGroups,
  onToggleGroup,
}: {
  row: CustomerReviewRow
  detail: CustomerReviewDetail | null
  loading: boolean
  error: string | null
  narrow: boolean
  expandedGroups: Set<string>
  onToggleGroup: (key: string) => void
}) {
  return (
    <div>
      <h3 style={{ margin: '0 0 0.6rem', fontSize: '1.2rem' }}>{row.customerName}</h3>
      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading sessions…</div>
      ) : error ? (
        <div style={{ padding: '1rem', color: 'var(--text-red-600)' }}>{error}</div>
      ) : !detail ? null : detail.totalHours <= 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No clock sessions recorded for this customer yet.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <StatTile value={formatCustomerReviewHours(detail.totalHours)} label="Total hrs" />
            <StatTile value={formatCustomerReviewHours(detail.estimatingHours)} label="Estimating hrs" />
            <StatTile value={formatCustomerReviewHours(detail.jobHours)} label="Job hrs" />
            {row.totalBids > 0 && <StatTile value={String(row.totalBids)} label={row.totalBids === 1 ? 'Bid' : 'Bids'} />}
            <StatTile value={String(detail.peopleCount)} label={detail.peopleCount === 1 ? 'Person' : 'People'} />
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: narrow ? '1fr' : 'minmax(0, 5fr) minmax(0, 7fr)',
              gap: '1.25rem',
              alignItems: 'start',
            }}
          >
            <div>
              <h4 style={{ margin: '0 0 0.35rem', fontSize: '0.8rem', color: 'var(--text-700)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Top contributors
              </h4>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                share of {formatCustomerReviewHours(detail.totalHours)} hrs —
                <span aria-hidden="true" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: ESTIMATING_COLOR, margin: '0 0.3rem 0 0.6rem' }} />
                estimating
                <span aria-hidden="true" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: JOB_COLOR, margin: '0 0.3rem 0 0.6rem' }} />
                jobs
              </div>
              {detail.contributors.map((c, i) => (
                <div
                  key={c.userId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    padding: '0.4rem 0',
                    borderBottom: i < detail.contributors.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <div
                    aria-hidden="true"
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      background: 'var(--bg-blue-tint)',
                      color: 'var(--text-blue-700)',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {contributorInitials(c.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                    <div style={{ height: 5, borderRadius: 3, background: 'var(--bg-200)', marginTop: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', display: 'flex', width: `${Math.max(2, Math.round(c.share * 100))}%` }}>
                        {c.totalHours > 0 && (
                          <>
                            <span style={{ background: ESTIMATING_COLOR, width: `${Math.round((c.estimatingHours / c.totalHours) * 100)}%` }} />
                            <span style={{ background: JOB_COLOR, flex: 1 }} />
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: '0.88rem' }}>{formatCustomerReviewHours(c.totalHours)}</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', width: 36, textAlign: 'right' }}>{formatContributorShare(c.share)}</div>
                </div>
              ))}
            </div>
            <div>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: 'var(--text-700)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Hours by bid &amp; job
              </h4>
              {detail.groups.map((g) => (
                <TargetGroupCard key={g.key} group={g} expanded={expandedGroups.has(g.key)} onToggle={() => onToggleGroup(g.key)} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function TargetGroupCard({ group, expanded, onToggle }: { group: CustomerReviewTargetGroup; expanded: boolean; onToggle: () => void }) {
  const isBid = group.kind === 'bid'
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: '0.6rem', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          padding: '0.5rem 0.75rem',
          background: 'var(--bg-muted)',
          border: 'none',
          width: '100%',
          cursor: 'pointer',
          textAlign: 'left',
          font: 'inherit',
        }}
      >
        <span
          style={{
            fontSize: '0.66rem',
            fontWeight: 700,
            padding: '0.1rem 0.45rem',
            borderRadius: 999,
            background: isBid ? 'var(--bg-orange-100)' : 'var(--bg-blue-200)',
            color: isBid ? 'var(--text-orange-700)' : 'var(--text-blue-700)',
            flexShrink: 0,
          }}
        >
          {isBid ? 'BID' : 'JOB'}
        </span>
        <span style={{ flex: 1, fontWeight: 600, fontSize: '0.87rem', minWidth: 0 }}>
          {isBid && group.bidNumber ? `${group.bidNumber} · ` : ''}
          {group.label}
        </span>
        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {group.sessions.length} session{group.sessions.length === 1 ? '' : 's'}
        </span>
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: '0.87rem', whiteSpace: 'nowrap' }}>
          {formatCustomerReviewHours(group.hours)} h
        </span>
        <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <tbody>
            {group.sessions.map((s, i) => (
              <tr key={s.sessionId}>
                <td style={{ padding: '0.3rem 0.75rem', borderBottom: i < group.sessions.length - 1 ? '1px solid var(--border)' : 'none', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {formatSessionDay(s.clockedInAt)}
                </td>
                <td style={{ padding: '0.3rem 0.75rem', borderBottom: i < group.sessions.length - 1 ? '1px solid var(--border)' : 'none' }}>{s.userName}</td>
                <td style={{ padding: '0.3rem 0.75rem', borderBottom: i < group.sessions.length - 1 ? '1px solid var(--border)' : 'none', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {formatSessionTimeRange(s.clockedInAt, s.clockedOutAt)}
                </td>
                <td style={{ padding: '0.3rem 0.75rem', borderBottom: i < group.sessions.length - 1 ? '1px solid var(--border)' : 'none', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {s.hours >= 10 ? formatCustomerReviewHours(s.hours) : s.hours.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
