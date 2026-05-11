import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { useToastContext } from '../../contexts/ToastContext'
import { formatBidLedgerNumberLabel, resolveBidLedgerPrefix } from '../../lib/ledgerDisplayPrefixes'
import type { Database } from '../../types/database'

type BidWorkingColumn = Database['public']['Tables']['bid_working_board_columns']['Row']
type BidWorkingPlacement = Database['public']['Tables']['bid_working_board_placements']['Row']

type BidWorkingBoardArchivedModalProps = {
  open: boolean
  onClose: () => void
  userId: string
  archivedBids: BidWithBuilder[]
  /** When true, resolve column labels from Estimator/Account Man placements (dev org-wide list). */
  orgWideColumnLabels?: boolean
  onUnarchived: () => void
  onOpenPreviewBid?: (bid: BidWithBuilder) => void
}

export function BidWorkingBoardArchivedModal({
  open,
  onClose,
  userId,
  archivedBids,
  orgWideColumnLabels = false,
  onUnarchived,
  onOpenPreviewBid,
}: BidWorkingBoardArchivedModalProps) {
  const { showToast } = useToastContext()
  const ledgerPrefixMap = useLedgerPrefixMap()
  const [columnTitleById, setColumnTitleById] = useState<Record<string, string>>({})
  const [placementColumnByBidId, setPlacementColumnByBidId] = useState<Record<string, string>>({})
  const [loadingPlacements, setLoadingPlacements] = useState(false)
  const [busyBidId, setBusyBidId] = useState<string | null>(null)

  const sortedBids = useMemo(() => {
    return [...archivedBids].sort((a, b) => {
      const an = (a.project_name ?? '').toLowerCase()
      const bn = (b.project_name ?? '').toLowerCase()
      if (an !== bn) return an.localeCompare(bn)
      return a.id.localeCompare(b.id)
    })
  }, [archivedBids])

  const loadPlacementLabels = useCallback(async () => {
    if (!open || archivedBids.length === 0) {
      setPlacementColumnByBidId({})
      setColumnTitleById({})
      return
    }
    setLoadingPlacements(true)
    try {
      const bidIds = archivedBids.map((b) => b.id)

      if (!orgWideColumnLabels) {
        const [colsRaw, plRaw] = await Promise.all([
          withSupabaseRetry(
            async () => supabase.from('bid_working_board_columns').select('id, title').eq('user_id', userId),
            'archived modal load columns',
          ),
          withSupabaseRetry(
            async () =>
              supabase.from('bid_working_board_placements').select('bid_id, column_id').eq('user_id', userId).in('bid_id', bidIds),
            'archived modal load placements',
          ),
        ])
        const cols = ((colsRaw ?? []) as Pick<BidWorkingColumn, 'id' | 'title'>[]).slice()
        const titleById: Record<string, string> = {}
        for (const c of cols) {
          titleById[c.id] = c.title
        }
        setColumnTitleById(titleById)
        const pl = ((plRaw ?? []) as Pick<BidWorkingPlacement, 'bid_id' | 'column_id'>[]).slice()
        const byBid: Record<string, string> = {}
        for (const row of pl) {
          byBid[row.bid_id] = row.column_id
        }
        setPlacementColumnByBidId(byBid)
        return
      }

      const placements =
        (await withSupabaseRetry(
          async () =>
            supabase.from('bid_working_board_placements').select('bid_id, column_id, user_id').in('bid_id', bidIds),
          'archived modal load placements org',
        )) ?? []

      const plTyped = (placements as Pick<BidWorkingPlacement, 'bid_id' | 'column_id' | 'user_id'>[]).slice()
      const byBidId = new Map<string, typeof plTyped>()
      for (const row of plTyped) {
        const arr = byBidId.get(row.bid_id) ?? []
        arr.push(row)
        byBidId.set(row.bid_id, arr)
      }
      const chosenColumnByBid: Record<string, string> = {}
      for (const bid of archivedBids) {
        const rows = byBidId.get(bid.id) ?? []
        let pick = rows.find((r) => bid.estimator_id != null && r.user_id === bid.estimator_id)
        if (!pick) pick = rows.find((r) => bid.account_manager_id != null && r.user_id === bid.account_manager_id)
        if (!pick && rows.length > 0) pick = rows[0]
        if (pick) chosenColumnByBid[bid.id] = pick.column_id
      }
      const colIds = [...new Set(Object.values(chosenColumnByBid))]
      const titleById: Record<string, string> = {}
      if (colIds.length > 0) {
        const cols =
          (await withSupabaseRetry(
            async () => supabase.from('bid_working_board_columns').select('id, title').in('id', colIds),
            'archived modal load columns org',
          )) ?? []
        for (const c of (cols as Pick<BidWorkingColumn, 'id' | 'title'>[]).slice()) {
          titleById[c.id] = c.title
        }
      }
      setColumnTitleById(titleById)
      setPlacementColumnByBidId(chosenColumnByBid)
    } catch {
      setPlacementColumnByBidId({})
      setColumnTitleById({})
    } finally {
      setLoadingPlacements(false)
    }
  }, [open, userId, archivedBids, orgWideColumnLabels])

  useEffect(() => {
    void loadPlacementLabels()
  }, [loadPlacementLabels])

  async function unarchive(bidId: string) {
    setBusyBidId(bidId)
    try {
      await withSupabaseRetry(
        async () =>
          supabase
            .from('bids')
            .update({ working_board_archived_at: null, working_board_archived_by: null })
            .eq('id', bidId),
        'unarchive working board bid',
      )
      onUnarchived()
    } catch (e: unknown) {
      showToast(formatErrorMessage(e, 'Failed to un-archive bid'), 'error')
    } finally {
      setBusyBidId(null)
    }
  }

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
        padding: '1rem',
      }}
      role="dialog"
      aria-modal
      aria-labelledby="bid-working-archived-modal-title"
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 8,
          maxWidth: 560,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
          <h2 id="bid-working-archived-modal-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
            Archived (Unsent/Working)
          </h2>
          <button type="button" onClick={onClose} style={{ padding: '0.35rem 0.65rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#f9fafb', cursor: 'pointer' }}>
            Close
          </button>
        </div>
        <div style={{ padding: '0.75rem 1.25rem 1.25rem', overflow: 'auto', flex: 1 }}>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
            {orgWideColumnLabels
              ? 'Bids hidden from Unsent/Working lists and clock quick picks. Column shows each team member\'s working-board column when available. Un-archive or send/decide the bid to clear archive.'
              : 'Bids hidden from your Working board and clock quick picks. Column placement is kept until you un-archive or the bid is sent or decided.'}
          </p>
          {loadingPlacements ? <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Loading columns…</p> : null}
          {sortedBids.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>No archived working bids.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {sortedBids.map((bid) => {
                const bidNum = bid.bid_number
                  ? formatBidLedgerNumberLabel(resolveBidLedgerPrefix(bid.service_type_id, ledgerPrefixMap), bid.bid_number)
                  : '—'
                const colId = placementColumnByBidId[bid.id]
                const columnLabel = colId ? columnTitleById[colId] ?? '—' : '—'
                const cust = bid.customers?.name?.trim() || bid.bids_gc_builders?.name?.trim() || '—'
                const busy = busyBidId === bid.id
                return (
                  <li
                    key={bid.id}
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 6,
                      padding: '0.65rem 0.75rem',
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: '1 1 12rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{bid.project_name?.trim() || '—'}</div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.2rem' }}>
                        {bidNum} · {cust}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.15rem' }}>
                        Column: {columnLabel}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                      {onOpenPreviewBid ? (
                        <button
                          type="button"
                          onClick={() => onOpenPreviewBid(bid)}
                          style={{ fontSize: '0.75rem', padding: '0.35rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
                        >
                          Preview
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void unarchive(bid.id)}
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.35rem 0.65rem',
                          border: 'none',
                          borderRadius: 4,
                          background: '#2563eb',
                          color: '#fff',
                          cursor: busy ? 'wait' : 'pointer',
                          opacity: busy ? 0.7 : 1,
                        }}
                      >
                        {busy ? '…' : 'Un-archive'}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
