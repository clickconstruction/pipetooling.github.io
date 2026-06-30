import { useCallback, useState } from 'react'
import { applyScheduleProportionsToClockSession } from '../lib/applyScheduleProportionsToClockSession'
import type { DispatchScheduledJobForAssign } from '../lib/jobScheduleBlocks'
import type { TodaySessionStripRow } from './useDashboardMyTeamSectionState'
import { useToastContext } from '../contexts/ToastContext'

/**
 * Shared controller for "Apply Schedule %" on a clock-strip session. Owns the approved-session
 * confirmation flow once so every strip surface (People → Hours, Dashboard, Quickfill) behaves
 * identically: an unapproved session applies immediately; an approved session opens a confirm modal
 * first (splitting it removes payroll hours until re-approval).
 *
 * Usage: pass `requestApply` as `onApplyScheduleProportionsForSession` to
 * `DashboardTeamActiveClockStrip`, and render `<ApplyScheduleApprovedConfirmModal {...approvedConfirm} />`.
 */
export function useApplyScheduleProportions(options: {
  authUserId: string | undefined
  /** Refresh the strip after a successful apply (e.g. loadPending + parent table refresh). */
  onApplied: () => void
}): {
  requestApply: (session: TodaySessionStripRow, picks: DispatchScheduledJobForAssign[]) => void
  approvedConfirm: { open: boolean; busy: boolean; onConfirm: () => void; onCancel: () => void }
} {
  const { authUserId, onApplied } = options
  const { showToast } = useToastContext()
  const [pending, setPending] = useState<{
    session: TodaySessionStripRow
    picks: DispatchScheduledJobForAssign[]
  } | null>(null)
  const [busy, setBusy] = useState(false)

  const run = useCallback(
    async (session: TodaySessionStripRow, picks: DispatchScheduledJobForAssign[]) => {
      const res = await applyScheduleProportionsToClockSession(
        {
          id: session.id,
          clocked_in_at: session.clocked_in_at,
          clocked_out_at: session.clocked_out_at,
          notes: session.notes,
        },
        picks,
        { editingSelf: session.user_id === authUserId, nowTick: Date.now() },
      )
      if (res.ok) {
        showToast('Applied schedule split.', 'success')
        onApplied()
      } else {
        showToast(res.message, res.kind)
      }
    },
    [authUserId, showToast, onApplied],
  )

  const requestApply = useCallback(
    (session: TodaySessionStripRow, picks: DispatchScheduledJobForAssign[]) => {
      if (session.approved_at) {
        setPending({ session, picks })
        return
      }
      void run(session, picks)
    },
    [run],
  )

  const onConfirm = useCallback(() => {
    if (!pending) return
    setBusy(true)
    void run(pending.session, pending.picks).finally(() => {
      setBusy(false)
      setPending(null)
    })
  }, [pending, run])

  const onCancel = useCallback(() => {
    if (busy) return
    setPending(null)
  }, [busy])

  return {
    requestApply,
    approvedConfirm: { open: pending != null, busy, onConfirm, onCancel },
  }
}
