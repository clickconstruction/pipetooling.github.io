import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useToastContext } from '../../../contexts/ToastContext'
import { useConfirmDialog } from '../../../contexts/ConfirmDialogContext'
import { useLedgerPrefixMap } from '../../../contexts/LedgerDisplayPrefixContext'
import { canSeeHours, canWorkHours, type PersonDeskViewer } from '../../../lib/people/personDeskGates'
import { buildApprovalsQueue, formatFlagCounts, weekStartYmd } from '../../../lib/people/approvalsQueue'
import { fetchAllPendingClockSessions } from '../../../lib/people/fetchAllPendingClockSessions'
import { formatHoursShort } from '../../../lib/myTeamApprovals'
import { shortJobOrBidLabelFromEmbeds } from '../../../types/clockSessions'
import type { ClockSessionRow } from '../../../types/clockSessions'
import { denverCalendarDayKey, formatDenverTimeOnly } from '../../../utils/dateUtils'
import { PeopleHoursApprovalsQueueModal } from '../../people/PeopleHoursApprovalsQueueModal'
import { ClockSessionEditSplitModal } from '../../ClockSessionEditSplitModal'
import { BTN_GREEN, BTN_QUIET, BTN_RED, Chip, DESK_EDITOR_Z, DeskEmpty, DeskRow, DeskSection, deskBtn, fmtDay } from '../personDeskShared'

type OpenRow = { id: string; clocked_in_at: string; label: string | null }

export function PersonDeskHoursSection({
  userId,
  payName,
  displayName,
  viewer,
  viewerUserId,
  changeKey,
  onChanged,
}: {
  userId: string | null
  payName: string | null
  displayName: string
  viewer: PersonDeskViewer
  viewerUserId: string | null
  changeKey: number
  onChanged: () => void
}) {
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const prefixMap = useLedgerPrefixMap()
  const [pendingRows, setPendingRows] = useState<ClockSessionRow[] | null>(null)
  const [open, setOpen] = useState<OpenRow | null>(null)
  const [weekHours, setWeekHours] = useState<number | null>(null)
  const [reviewedThrough, setReviewedThrough] = useState<string | null>(null)
  const [queueOpen, setQueueOpen] = useState(false)
  const [queueReload, setQueueReload] = useState(0)
  const [editSession, setEditSession] = useState<ClockSessionRow | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const todayYmd = denverCalendarDayKey(Date.now())
  const visible = canSeeHours(viewer)

  useEffect(() => {
    if (!userId || !visible) return
    let cancelled = false
    void (async () => {
      try {
        const weekStart = weekStartYmd(todayYmd)
        const [pending, { data: openRows }, { data: weekRows }, reviewed] = await Promise.all([
          fetchAllPendingClockSessions({ userId }),
          supabase
            .from('clock_sessions')
            .select('id, clocked_in_at, jobs_ledger!clock_sessions_job_ledger_id_fkey(hcp_number, click_number, job_name, job_address, service_type_id), bids!clock_sessions_bid_id_fkey(bid_number, project_name, address, service_type_id, customers(name))')
            .eq('user_id', userId)
            .is('clocked_out_at', null)
            .is('revoked_at', null)
            .limit(1),
          supabase.from('clock_sessions').select('clocked_in_at, clocked_out_at').eq('user_id', userId).gte('work_date', weekStart).not('clocked_out_at', 'is', null).is('rejected_at', null).is('revoked_at', null),
          payName ? supabase.from('hours_reviewed').select('end_date').eq('person_name', payName).order('end_date', { ascending: false }).limit(1) : Promise.resolve({ data: null }),
        ])
        if (cancelled) return
        setPendingRows(pending)
        const o = (openRows ?? [])[0] as (Record<string, unknown> & { id: string; clocked_in_at: string }) | undefined
        setOpen(o ? { id: o.id, clocked_in_at: o.clocked_in_at, label: shortJobOrBidLabelFromEmbeds(o as never, prefixMap) } : null)
        let h = 0
        for (const r of (weekRows ?? []) as Array<{ clocked_in_at: string; clocked_out_at: string }>) h += (new Date(r.clocked_out_at).getTime() - new Date(r.clocked_in_at).getTime()) / 3_600_000
        setWeekHours(Math.round(h * 10) / 10)
        const rv = ((reviewed as { data: Array<{ end_date: string }> | null }).data ?? [])[0]
        setReviewedThrough(rv?.end_date ?? null)
        setError(null)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load hours')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId, payName, visible, changeKey, queueReload, todayYmd, prefixMap])

  const queue = useMemo(() => buildApprovalsQueue(pendingRows ?? [], { todayYmd }), [pendingRows, todayYmd])

  if (!visible) return null
  if (!userId) {
    return (
      <DeskSection id="hours" title="Hours & approvals">
        <DeskEmpty>Clock sessions need a login account.</DeskEmpty>
      </DeskSection>
    )
  }

  const workable = canWorkHours(viewer)

  async function forceClockOut() {
    if (!open) return
    const ok = await confirmDialog({ message: `Force clock out ${displayName}? The session closes now and waits for approval.`, confirmLabel: 'Force clock out' })
    if (!ok) return
    setBusy(true)
    const { error: e } = await supabase.from('clock_sessions').update({ clocked_out_at: new Date().toISOString() }).eq('id', open.id)
    setBusy(false)
    if (e) showToast(e.message, 'error')
    else {
      showToast('Session clocked out', 'success')
      onChanged()
    }
  }

  const flagText = formatFlagCounts(queue.flagCounts)

  return (
    <DeskSection id="hours" title="Hours & approvals">
      {error ? <DeskEmpty>{error}</DeskEmpty> : null}
      <DeskRow
        label="Now"
        actions={
          open && workable ? (
            <button type="button" style={deskBtn(BTN_RED, busy)} disabled={busy} onClick={() => void forceClockOut()}>
              Force clock out
            </button>
          ) : null
        }
      >
        {open ? (
          <>
            <Chip tone="green">On the clock</Chip>
            <span>
              {open.label ? `${open.label.replace(/\n/g, ' ')} · ` : ''}since {formatDenverTimeOnly(new Date(open.clocked_in_at).getTime())}
            </span>
          </>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>Not clocked in</span>
        )}
      </DeskRow>
      <DeskRow
        label="Waiting"
        actions={
          queue.count > 0 && workable ? (
            <button type="button" style={BTN_GREEN} onClick={() => setQueueOpen(true)}>
              Open approvals
            </button>
          ) : null
        }
      >
        {pendingRows == null ? (
          <span style={{ color: 'var(--text-muted)' }}>Loading…</span>
        ) : queue.count === 0 ? (
          <span style={{ color: 'var(--text-muted)' }}>Nothing waiting</span>
        ) : (
          <>
            <span style={{ fontWeight: 700, color: 'var(--text-strong)' }}>
              {queue.count} session{queue.count === 1 ? '' : 's'} · {formatHoursShort(queue.hours)}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>oldest {fmtDay(queue.oldestWorkDate ?? todayYmd)}</span>
            {flagText ? <Chip tone="amber">⚠ {flagText}</Chip> : null}
          </>
        )}
      </DeskRow>
      <DeskRow
        label="This week"
        actions={
          <a href={`/people?tab=hours`} style={{ ...BTN_QUIET, textDecoration: 'none' }}>
            Hours grid
          </a>
        }
      >
        {weekHours == null ? <span style={{ color: 'var(--text-muted)' }}>—</span> : <span>{formatHoursShort(weekHours)} closed</span>}
      </DeskRow>
      <DeskRow label="Reviewed through">{reviewedThrough ? fmtDay(reviewedThrough) : <span style={{ color: 'var(--text-muted)' }}>never</span>}</DeskRow>

      {queueOpen ? (
        <PeopleHoursApprovalsQueueModal
          pinUserId={userId}
          pinDisplayName={displayName}
          zIndex={DESK_EDITOR_Z}
          reloadKey={queueReload}
          authUserId={viewerUserId ?? undefined}
          onClose={() => setQueueOpen(false)}
          onChanged={() => {
            setQueueReload((k) => k + 1)
            onChanged()
          }}
          onEditSession={(s) => setEditSession(s)}
        />
      ) : null}
      {editSession ? (
        <ClockSessionEditSplitModal
          session={{
            id: editSession.id,
            user_id: editSession.user_id,
            clocked_in_at: editSession.clocked_in_at,
            clocked_out_at: editSession.clocked_out_at,
            work_date: editSession.work_date,
            notes: editSession.notes,
            job_ledger_id: editSession.job_ledger_id,
            bid_id: editSession.bid_id,
            approved_at: editSession.approved_at,
          }}
          zIndex={DESK_EDITOR_Z + 50}
          onClose={() => setEditSession(null)}
          onSaved={() => {
            setQueueReload((k) => k + 1)
            onChanged()
          }}
          showToast={(m, v) => showToast(m, v ?? 'success')}
        />
      ) : null}
    </DeskSection>
  )
}
