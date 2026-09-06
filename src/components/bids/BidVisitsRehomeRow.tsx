/**
 * T5-04 (J15-F10): once a job opened from this bid exists, offer to move the visits dispatch
 * scheduled against the BID onto the job — never automatically. Reads the still-anchored blocks,
 * shows "N scheduled visits still sit on the bid (M upcoming)." + "Move them to J1007", confirms,
 * calls `move_bid_schedule_blocks_to_job`, toasts the moved count, and re-reads (the row disappears).
 * Roles: the schedule-dispatch edit set — the same predicate the RPC checks server-side.
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useToastContext } from '../../contexts/ToastContext'
import { CAN_USE_SCHEDULE_DISPATCH_EDIT_ROLES } from '../../lib/scheduleDispatchEditRoles'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { rehomeDoneToast, rehomeOffer, summarizeBidVisits, type BidVisitRow } from '../../lib/bids/rehomeBidVisits'

export function BidVisitsRehomeRow({ bidId, jobId, jobLabel }: { bidId: string; jobId: string; jobLabel: string }) {
  const { role } = useAuth()
  const confirmDialog = useConfirmDialog()
  const { showToast } = useToastContext()
  const [rows, setRows] = useState<BidVisitRow[] | null>(null)
  const [busy, setBusy] = useState(false)
  const canMove = role != null && CAN_USE_SCHEDULE_DISPATCH_EDIT_ROLES.has(role)

  const load = useCallback(async () => {
    const { data } = await supabase.from('job_schedule_blocks').select('work_date').eq('bid_id', bidId).is('job_id', null)
    setRows(((data ?? []) as BidVisitRow[]).filter((r) => typeof r.work_date === 'string'))
  }, [bidId])

  useEffect(() => {
    if (!canMove) return
    void load()
  }, [canMove, load])

  if (!canMove || !rows) return null
  const offer = rehomeOffer(summarizeBidVisits(rows, todayYmdInAppTz()), jobLabel)
  if (!offer) return null

  const move = async () => {
    if (busy) return
    const ok = await confirmDialog({ message: offer.confirm, confirmLabel: offer.button })
    if (!ok) return
    setBusy(true)
    const { data, error } = await supabase.rpc('move_bid_schedule_blocks_to_job' as never, {
      p_bid_id: bidId,
      p_job_id: jobId,
    } as never)
    setBusy(false)
    if (error) {
      showToast(error.message, 'error')
      return
    }
    showToast(rehomeDoneToast(typeof data === 'number' ? data : rows.length, jobLabel), 'success')
    void load()
  }

  return (
    <div
      data-testid="bid-visits-rehome"
      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8125rem', color: 'var(--text-700)', flexBasis: '100%' }}
    >
      <span>{offer.line}</span>
      <button
        type="button"
        onClick={() => void move()}
        disabled={busy}
        style={{
          padding: '0.3rem 0.65rem',
          fontSize: '0.8125rem',
          fontFamily: 'inherit',
          fontWeight: 600,
          background: 'var(--surface)',
          color: 'var(--text-700)',
          border: '1px solid var(--border-strong)',
          borderRadius: 6,
          cursor: busy ? 'wait' : 'pointer',
        }}
      >
        {busy ? 'Moving…' : offer.button}
      </button>
    </div>
  )
}
