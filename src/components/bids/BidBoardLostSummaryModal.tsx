import { createPortal } from 'react-dom'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { BidWithBuilder, EstimatorUser } from '../../types/bidWithBuilder'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/format'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { buildHourlyWageLookupByNormalizedName } from '../../lib/bidBoardWeeklyEstimatorLaborCost'
import { formatBidLedgerNumberLabel, resolveBidLedgerPrefix, type LedgerPrefixMap } from '../../lib/ledgerDisplayPrefixes'
import {
  aggregateLostBidLaborUsd,
  getLaborUsdForBid,
  type LostBidLaborAgg,
  type LostBidSessionRow,
} from '../../lib/bidLostSummaryLabor'

const MODAL_Z = 10040
const BID_ID_CHUNK = 80
const SESSION_PAGE_SIZE = 1000

function formatBidStaffDisplayName(u: EstimatorUser | EstimatorUser[] | null | undefined): string {
  if (u == null) return '—'
  const one = Array.isArray(u) ? u[0] ?? null : u
  if (!one) return '—'
  return (one.name?.trim() || one.email || '—').slice(0, 200)
}

function bidLedgerNumberCellLabel(bid: BidWithBuilder, prefixMap: LedgerPrefixMap): string {
  const num = bid.bid_number?.trim()
  if (!num) return '—'
  return formatBidLedgerNumberLabel(resolveBidLedgerPrefix(bid.service_type_id, prefixMap), num)
}

const th: CSSProperties = {
  padding: '0.5rem 0.65rem',
  textAlign: 'left',
  borderBottom: '1px solid #e5e7eb',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: '#374151',
  background: '#f9fafb',
}

const td: CSSProperties = {
  padding: '0.45rem 0.65rem',
  borderBottom: '1px solid #f3f4f6',
  fontSize: '0.8125rem',
  verticalAlign: 'top',
  wordBreak: 'break-word',
}

export type BidBoardLostSummaryModalProps = {
  open: boolean
  onClose: () => void
  lostBids: BidWithBuilder[]
  ledgerPrefixMap: LedgerPrefixMap
  showLaborColumn: boolean
  onOpenBid: (bid: BidWithBuilder) => void
  onPreviewBid: (bid: BidWithBuilder) => void
  onSaveLossReason: (bidId: string, lossReason: string) => Promise<void>
  /** When opening from a deep link, pre-select this staff tab (estimator / account manager user id). */
  initialStaffTabUserId?: string | null
}

type OpenBidRowHover = { bidId: string; line: 'edit' | 'preview' } | null

async function fetchSessionsForBidIds(bidIds: string[]): Promise<LostBidSessionRow[]> {
  const out: LostBidSessionRow[] = []
  for (let c = 0; c < bidIds.length; c += BID_ID_CHUNK) {
    const chunk = bidIds.slice(c, c + BID_ID_CHUNK)
    if (chunk.length === 0) continue
    let offset = 0
    for (;;) {
      const data = await withSupabaseRetry(
        async () =>
          supabase
            .from('clock_sessions')
            .select('bid_id, user_id, clocked_in_at, clocked_out_at, approved_at, rejected_at, revoked_at')
            .in('bid_id', chunk)
            .order('clocked_in_at', { ascending: true })
            .range(offset, offset + SESSION_PAGE_SIZE - 1),
        'bid board lost summary clock_sessions',
      )
      const rows = (data ?? []) as LostBidSessionRow[]
      out.push(...rows)
      if (rows.length < SESSION_PAGE_SIZE) break
      offset += SESSION_PAGE_SIZE
    }
  }
  return out
}

function laborCellDisplay(agg: LostBidLaborAgg): string {
  if (agg.laborUsd === null) return '—'
  return `$${formatCurrency(agg.laborUsd)}`
}

type LostSummaryTabKey = 'all' | string

type StaffTab = { userId: string; label: string }

function buildStaffTabsFromSortedBids(sortedBids: BidWithBuilder[]): StaffTab[] {
  const idSet = new Set<string>()
  for (const b of sortedBids) {
    if (b.estimator_id?.trim()) idSet.add(b.estimator_id)
    if (b.account_manager_id?.trim()) idSet.add(b.account_manager_id)
  }
  const tabs: StaffTab[] = []
  for (const userId of idSet) {
    const asEstimator = sortedBids.find((b) => b.estimator_id === userId)
    const bid = asEstimator ?? sortedBids.find((b) => b.account_manager_id === userId)
    if (!bid) continue
    const label =
      bid.estimator_id === userId ? formatBidStaffDisplayName(bid.estimator) : formatBidStaffDisplayName(bid.account_manager)
    tabs.push({ userId, label })
  }
  return tabs.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
}

export function BidBoardLostSummaryModal({
  open,
  onClose,
  lostBids,
  ledgerPrefixMap,
  showLaborColumn,
  onOpenBid,
  onPreviewBid,
  onSaveLossReason,
  initialStaffTabUserId = null,
}: BidBoardLostSummaryModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [laborByBid, setLaborByBid] = useState<Map<string, LostBidLaborAgg>>(() => new Map())
  const [activeTab, setActiveTab] = useState<LostSummaryTabKey>('all')
  const [openBidRowHover, setOpenBidRowHover] = useState<OpenBidRowHover>(null)
  const [editingLossBidId, setEditingLossBidId] = useState<string | null>(null)
  const [lossDraft, setLossDraft] = useState('')
  const [savingLossBidId, setSavingLossBidId] = useState<string | null>(null)
  const [lossSaveErrorBidId, setLossSaveErrorBidId] = useState<string | null>(null)
  const [lossSaveErrorMessage, setLossSaveErrorMessage] = useState<string | null>(null)

  const idsKey = useMemo(() => [...new Set(lostBids.map((b) => b.id))].sort().join(','), [lostBids])

  const sortedBids = useMemo(() => {
    return [...lostBids].sort((a, b) => {
      const pa = (a.project_name || '').localeCompare(b.project_name || '', undefined, { sensitivity: 'base' })
      if (pa !== 0) return pa
      const na = (a.bid_number || '').trim()
      const nb = (b.bid_number || '').trim()
      return na.localeCompare(nb, undefined, { sensitivity: 'base', numeric: true })
    })
  }, [lostBids])

  const staffTabs = useMemo(() => buildStaffTabsFromSortedBids(sortedBids), [sortedBids])

  const displayBids = useMemo(() => {
    if (activeTab === 'all') return sortedBids
    return sortedBids.filter((b) => b.estimator_id === activeTab || b.account_manager_id === activeTab)
  }, [sortedBids, activeTab])

  useEffect(() => {
    if (!editingLossBidId) return
    if (!displayBids.some((b) => b.id === editingLossBidId)) {
      setEditingLossBidId(null)
      setLossDraft('')
      setSavingLossBidId(null)
      setLossSaveErrorBidId(null)
      setLossSaveErrorMessage(null)
    }
  }, [displayBids, editingLossBidId])

  useEffect(() => {
    if (open) {
      setLaborByBid(new Map())
      setError(null)
      setOpenBidRowHover(null)
      setEditingLossBidId(null)
      setLossDraft('')
      setSavingLossBidId(null)
      setLossSaveErrorBidId(null)
      setLossSaveErrorMessage(null)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const uid = initialStaffTabUserId?.trim()
    const ok =
      Boolean(uid) &&
      sortedBids.some((b) => b.estimator_id === uid || b.account_manager_id === uid)
    setActiveTab(ok && uid ? uid : 'all')
  }, [open, initialStaffTabUserId, sortedBids])

  useEffect(() => {
    if (activeTab === 'all') return
    if (!staffTabs.some((t) => t.userId === activeTab)) {
      setActiveTab('all')
    }
  }, [activeTab, staffTabs])

  useEffect(() => {
    if (!open) {
      setError(null)
      setLoading(false)
      return
    }

    if (!showLaborColumn) {
      setLaborByBid(new Map())
      setError(null)
      setLoading(false)
      return
    }

    const bidIds = idsKey.length > 0 ? idsKey.split(',') : []
    if (bidIds.length === 0) {
      setLaborByBid(new Map())
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    void (async () => {
      try {
        const sessions = await fetchSessionsForBidIds(bidIds)
        const userIds = [...new Set(sessions.map((s) => s.user_id))]
        const [userList, payListNullable] = await Promise.all([
          userIds.length > 0
            ? withSupabaseRetry(
                async () => supabase.from('users').select('id, name').in('id', userIds),
                'bid board lost summary users',
              )
            : Promise.resolve([]),
          withSupabaseRetry(
            async () => supabase.from('people_pay_config').select('person_name, hourly_wage'),
            'bid board lost summary people_pay_config',
          ),
        ])

        if (cancelled) return

        const userRows = (userList ?? []) as { id: string; name: string | null }[]
        const userIdToDisplayName = new Map<string, string | null | undefined>()
        for (const u of userRows) {
          userIdToDisplayName.set(u.id, u.name)
        }

        const payRows = (payListNullable ?? []) as { person_name: string; hourly_wage: number | null }[]
        const wageByNormalizedName = buildHourlyWageLookupByNormalizedName(payRows)

        const aggregated = aggregateLostBidLaborUsd({
          sessions,
          userIdToDisplayName,
          wageByNormalizedName,
        })
        setLaborByBid(aggregated)
      } catch (e) {
        if (!cancelled) {
          setError(formatErrorMessage(e, 'Could not load labor data.'))
          setLaborByBid(new Map())
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, idsKey, showLaborColumn])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (editingLossBidId) {
        e.preventDefault()
        setEditingLossBidId(null)
        setLossDraft('')
        setLossSaveErrorBidId(null)
        setLossSaveErrorMessage(null)
        return
      }
      onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose, editingLossBidId])

  const target = typeof document !== 'undefined' ? document.body : null
  if (!open || !target) return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: MODAL_Z,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bid-board-lost-summary-title"
        style={{
          background: '#fff',
          borderRadius: 8,
          padding: '1rem 1.25rem',
          maxWidth: 1100,
          width: '100%',
          maxHeight: '92vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            marginBottom: '0.75rem',
          }}
        >
          <h2 id="bid-board-lost-summary-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
            Bid Tabs on Lost
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: 6,
              border: '1px solid #d1d5db',
              background: '#f9fafb',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Close
          </button>
        </div>
        {error ? (
          <div style={{ padding: '0.75rem', background: '#fef2f2', color: '#b91c1c', borderRadius: 6, marginBottom: '0.5rem' }}>
            {error}
          </div>
        ) : null}
        <div
          role="tablist"
          aria-label="Filter bids by account manager or estimator"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '0.35rem',
            marginBottom: '0.65rem',
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'all'}
            id="lost-summary-tab-all"
            aria-controls="lost-summary-table-panel"
            onClick={() => setActiveTab('all')}
            style={{
              padding: '0.35rem 0.65rem',
              fontSize: '0.8125rem',
              borderRadius: 6,
              border: activeTab === 'all' ? '1px solid #2563eb' : '1px solid #d1d5db',
              background: activeTab === 'all' ? '#eff6ff' : '#fff',
              cursor: 'pointer',
              color: activeTab === 'all' ? '#1d4ed8' : '#374151',
              fontWeight: activeTab === 'all' ? 600 : 400,
            }}
          >
            All
          </button>
          {staffTabs.map((t) => {
            const sel = activeTab === t.userId
            return (
              <button
                key={t.userId}
                type="button"
                role="tab"
                aria-selected={sel}
                id={`lost-summary-tab-${t.userId}`}
                aria-controls="lost-summary-table-panel"
                onClick={() => setActiveTab(t.userId)}
                style={{
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.8125rem',
                  borderRadius: 6,
                  border: sel ? '1px solid #2563eb' : '1px solid #d1d5db',
                  background: sel ? '#eff6ff' : '#fff',
                  cursor: 'pointer',
                  color: sel ? '#1d4ed8' : '#374151',
                  fontWeight: sel ? 600 : 400,
                  maxWidth: '14rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={t.label}
              >
                {t.label}
              </button>
            )
          })}
        </div>
        <div
          id="lost-summary-table-panel"
          role="tabpanel"
          aria-labelledby={activeTab === 'all' ? 'lost-summary-tab-all' : `lost-summary-tab-${activeTab}`}
          style={{ flex: 1, minHeight: 0, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 6 }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Bid / project</th>
                <th style={th}>Bid Tab / Reason for loss:</th>
                {showLaborColumn ? <th style={{ ...th, textAlign: 'right' }}>Labor</th> : null}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={showLaborColumn ? 3 : 2}
                    style={{ ...td, textAlign: 'center', color: '#6b7280', padding: '2rem' }}
                  >
                    Loading…
                  </td>
                </tr>
              ) : sortedBids.length === 0 ? (
                <tr>
                  <td
                    colSpan={showLaborColumn ? 3 : 2}
                    style={{ ...td, textAlign: 'center', color: '#6b7280', padding: '2rem' }}
                  >
                    No lost bids in this list.
                  </td>
                </tr>
              ) : displayBids.length === 0 ? (
                <tr>
                  <td
                    colSpan={showLaborColumn ? 3 : 2}
                    style={{ ...td, textAlign: 'center', color: '#6b7280', padding: '2rem' }}
                  >
                    No bids for this person in this list.
                  </td>
                </tr>
              ) : (
                displayBids.map((bid) => {
                  const loss = ((bid as { loss_reason?: string | null }).loss_reason ?? '').trim()
                  const missingLossReason = loss === ''
                  const tdRow: CSSProperties = {
                    ...td,
                    ...(missingLossReason ? { background: '#fef2f2' } : {}),
                  }
                  const ledgerLabel = bidLedgerNumberCellLabel(bid, ledgerPrefixMap)
                  const topLine = `${ledgerLabel} | ${formatBidStaffDisplayName(bid.account_manager)} | ${formatBidStaffDisplayName(bid.estimator)}`
                  const projectLine = (bid.project_name || '').trim() || '—'
                  const openBidAria = `Edit bid ${ledgerLabel} — ${projectLine}`.slice(0, 200)
                  const previewBidAria = `Open bid preview for ${ledgerLabel} — ${projectLine}`.slice(0, 200)
                  const lossReasonAriaLabel = `Reason for loss for ${ledgerLabel} — ${projectLine}`.slice(0, 200)
                  const isEditingLoss = editingLossBidId === bid.id
                  const isSavingLoss = savingLossBidId === bid.id
                  return (
                    <tr key={bid.id} title={missingLossReason ? 'Reason for loss not recorded' : undefined}>
                      <td style={tdRow}>
                        <button
                          type="button"
                          aria-label={openBidAria}
                          onClick={() => onOpenBid(bid)}
                          onMouseEnter={() => setOpenBidRowHover({ bidId: bid.id, line: 'edit' })}
                          onMouseLeave={() => setOpenBidRowHover((h) => (h?.bidId === bid.id && h.line === 'edit' ? null : h))}
                          style={{
                            display: 'block',
                            width: '100%',
                            textAlign: 'left',
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            margin: 0,
                            font: 'inherit',
                            cursor: 'pointer',
                            wordBreak: 'break-word',
                            textDecoration:
                              openBidRowHover?.bidId === bid.id && openBidRowHover.line === 'edit' ? 'underline' : undefined,
                          }}
                        >
                          <div
                            style={{
                              fontSize: '0.8125rem',
                              color: '#4b5563',
                              lineHeight: 1.35,
                              wordBreak: 'break-word',
                            }}
                          >
                            {topLine}
                          </div>
                        </button>
                        <button
                          type="button"
                          aria-label={previewBidAria}
                          onClick={() => onPreviewBid(bid)}
                          onMouseEnter={() => setOpenBidRowHover({ bidId: bid.id, line: 'preview' })}
                          onMouseLeave={() => setOpenBidRowHover((h) => (h?.bidId === bid.id && h.line === 'preview' ? null : h))}
                          style={{
                            display: 'block',
                            width: '100%',
                            textAlign: 'left',
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            margin: 0,
                            marginTop: '0.25rem',
                            font: 'inherit',
                            cursor: 'pointer',
                            wordBreak: 'break-word',
                            textDecoration:
                              openBidRowHover?.bidId === bid.id && openBidRowHover.line === 'preview' ? 'underline' : undefined,
                          }}
                        >
                          <div
                            style={{
                              fontSize: '0.875rem',
                              fontWeight: 600,
                              color: '#111827',
                              wordBreak: 'break-word',
                            }}
                          >
                            {projectLine}
                          </div>
                        </button>
                      </td>
                      <td style={tdRow}>
                        {isEditingLoss ? (
                          <div>
                            <textarea
                              aria-label={lossReasonAriaLabel}
                              value={lossDraft}
                              onChange={(e) => setLossDraft(e.target.value)}
                              disabled={isSavingLoss}
                              rows={3}
                              style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                fontSize: '0.8125rem',
                                padding: '0.35rem 0.5rem',
                                borderRadius: 4,
                                border: '1px solid #d1d5db',
                                resize: 'vertical',
                                fontFamily: 'inherit',
                              }}
                            />
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.4rem' }}>
                              <button
                                type="button"
                                disabled={isSavingLoss}
                                onClick={async () => {
                                  setLossSaveErrorBidId(null)
                                  setLossSaveErrorMessage(null)
                                  setSavingLossBidId(bid.id)
                                  try {
                                    await onSaveLossReason(bid.id, lossDraft)
                                    setEditingLossBidId(null)
                                    setLossDraft('')
                                  } catch (err) {
                                    setLossSaveErrorBidId(bid.id)
                                    setLossSaveErrorMessage(
                                      formatErrorMessage(err, 'Could not save reason for loss.'),
                                    )
                                  } finally {
                                    setSavingLossBidId(null)
                                  }
                                }}
                                style={{
                                  padding: '0.25rem 0.55rem',
                                  fontSize: '0.75rem',
                                  borderRadius: 4,
                                  border: '1px solid #2563eb',
                                  background: '#2563eb',
                                  color: '#fff',
                                  cursor: isSavingLoss ? 'not-allowed' : 'pointer',
                                }}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                disabled={isSavingLoss}
                                onClick={() => {
                                  setEditingLossBidId(null)
                                  setLossDraft('')
                                  setLossSaveErrorBidId(null)
                                  setLossSaveErrorMessage(null)
                                }}
                                style={{
                                  padding: '0.25rem 0.55rem',
                                  fontSize: '0.75rem',
                                  borderRadius: 4,
                                  border: '1px solid #d1d5db',
                                  background: '#f9fafb',
                                  cursor: isSavingLoss ? 'not-allowed' : 'pointer',
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                            {lossSaveErrorBidId === bid.id && lossSaveErrorMessage ? (
                              <div
                                style={{
                                  marginTop: '0.35rem',
                                  fontSize: '0.75rem',
                                  color: '#b91c1c',
                                  whiteSpace: 'pre-wrap',
                                }}
                              >
                                {lossSaveErrorMessage}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{ flex: '1 1 8rem', color: loss ? '#374151' : '#9ca3af' }}>
                              {loss || '—'}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setLossSaveErrorBidId(null)
                                setLossSaveErrorMessage(null)
                                setEditingLossBidId(bid.id)
                                setLossDraft(((bid as { loss_reason?: string | null }).loss_reason ?? '') as string)
                              }}
                              style={{
                                flexShrink: 0,
                                padding: '0.2rem 0.5rem',
                                fontSize: '0.75rem',
                                borderRadius: 4,
                                border: '1px solid #d1d5db',
                                background: '#fff',
                                cursor: 'pointer',
                              }}
                            >
                              Edit
                            </button>
                          </div>
                        )}
                      </td>
                      {showLaborColumn ? (
                        <td
                          style={{
                            ...td,
                            textAlign: 'right',
                            whiteSpace: 'nowrap',
                            ...(missingLossReason ? { background: '#fef2f2' } : {}),
                          }}
                        >
                          {laborCellDisplay(getLaborUsdForBid(laborByBid, bid.id))}
                        </td>
                      ) : null}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>,
    target,
  )
}
