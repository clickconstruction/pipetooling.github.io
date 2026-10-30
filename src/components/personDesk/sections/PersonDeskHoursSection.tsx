import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useToastContext } from '../../../contexts/ToastContext'
import { useConfirmDialog } from '../../../contexts/ConfirmDialogContext'
import { useLedgerPrefixMap } from '../../../contexts/LedgerDisplayPrefixContext'
import { canSeeHours, canWorkHours, type PersonDeskViewer } from '../../../lib/people/personDeskGates'
import { buildApprovalsQueue, formatFlagCounts, weekStartYmd } from '../../../lib/people/approvalsQueue'
import { fetchAllPendingClockSessions } from '../../../lib/people/fetchAllPendingClockSessions'
import { PERSON_DESK_HOURS_STRIP_KEY, PERSON_HOURS_STRIP_DAYS, firstOfLastDays, hoursStripDays, personHoursHeadChip, sessionHours, type HoursStripSession } from '../../../lib/people/hoursDayStrip'
import { formatHoursShort } from '../../../lib/myTeamApprovals'
import { shortJobOrBidLabelFromEmbeds } from '../../../types/clockSessions'
import type { ClockSessionRow } from '../../../types/clockSessions'
import { denverCalendarDayKey, formatDenverTimeOnly } from '../../../utils/dateUtils'
import { PeopleHoursApprovalsQueueModal } from '../../people/PeopleHoursApprovalsQueueModal'
import { ClockSessionEditSplitModal } from '../../ClockSessionEditSplitModal'
import { HoursStatementsSection } from '../../jobs/HoursStatementsSection'
import { ShapeSwitch, SideBySide, useShapeView } from '../../prototypes/SideBySide'
import { BTN_GREEN, BTN_QUIET, BTN_RED, Chip, DESK_EDITOR_Z, DeskEmpty, DeskRow, DeskSection, deskBtn, fmtDay } from '../personDeskShared'
import { formatErrorMessage } from '../../../utils/errorHandling'
import { PersonDeskHoursStrip } from './PersonDeskHoursStrip'

type OpenRow = { id: string; clocked_in_at: string; work_date: string | null; label: string | null }

/**
 * Hours & approvals on the person desk. Since punch list #217 (people-docs-6) a per-person
 * switch, **Show the strip**, draws the last fourteen days instead of the four lines — a dot per
 * approved day, an amber ring per day with a session waiting, the hours under each, a grey rule at
 * *reviewed through*, today outlined — with **Open approvals · N** at the strip's end; with
 * `?sbs=1` on the page a dev sees both, one above the other. The reads are the same either way.
 */
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
  const view = useShapeView(PERSON_DESK_HOURS_STRIP_KEY)
  const [pendingRows, setPendingRows] = useState<ClockSessionRow[] | null>(null)
  const [open, setOpen] = useState<OpenRow | null>(null)
  /** The last fourteen days' closed sessions (not rejected or revoked), approved or waiting: the week's hours and the strip's days. */
  const [daySessions, setDaySessions] = useState<HoursStripSession[] | null>(null)
  const [reviewedThrough, setReviewedThrough] = useState<string | null>(null)
  const [queueOpen, setQueueOpen] = useState(false)
  const [queueReload, setQueueReload] = useState(0)
  const [editSession, setEditSession] = useState<ClockSessionRow | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const todayYmd = denverCalendarDayKey(Date.now())
  const firstYmd = firstOfLastDays(todayYmd, PERSON_HOURS_STRIP_DAYS)
  const visible = canSeeHours(viewer)

  useEffect(() => {
    if (!userId || !visible) return
    let cancelled = false
    void (async () => {
      try {
        const [pending, { data: openRows }, { data: dayRows }, reviewed] = await Promise.all([
          fetchAllPendingClockSessions({ userId }),
          supabase
            .from('clock_sessions')
            .select('id, clocked_in_at, work_date, jobs_ledger!clock_sessions_job_ledger_id_fkey(hcp_number, click_number, job_name, job_address, service_type_id), bids!clock_sessions_bid_id_fkey(bid_number, project_name, address, service_type_id, customers(name))')
            .eq('user_id', userId)
            .is('clocked_out_at', null)
            .is('revoked_at', null)
            .limit(1),
          supabase
            .from('clock_sessions')
            .select('work_date, clocked_in_at, clocked_out_at, approved_at')
            .eq('user_id', userId)
            .gte('work_date', firstYmd)
            .lte('work_date', todayYmd)
            .not('clocked_out_at', 'is', null)
            .is('rejected_at', null)
            .is('revoked_at', null)
            .limit(500),
          payName ? supabase.from('hours_reviewed').select('end_date').eq('person_name', payName).order('end_date', { ascending: false }).limit(1) : Promise.resolve({ data: null }),
        ])
        if (cancelled) return
        setPendingRows(pending)
        const o = (openRows ?? [])[0] as (Record<string, unknown> & { id: string; clocked_in_at: string; work_date?: string | null }) | undefined
        setOpen(o ? { id: o.id, clocked_in_at: o.clocked_in_at, work_date: o.work_date ?? null, label: shortJobOrBidLabelFromEmbeds(o as never, prefixMap) } : null)
        setDaySessions(((dayRows ?? []) as Array<{ work_date: string; clocked_in_at: string; clocked_out_at: string | null; approved_at: string | null }>).map((r) => ({ ...r })))
        const rv = ((reviewed as { data: Array<{ end_date: string }> | null }).data ?? [])[0]
        setReviewedThrough(rv?.end_date ?? null)
        setError(null)
      } catch (e) {
        if (!cancelled) setError(formatErrorMessage(e, 'Could not load hours'))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId, payName, visible, changeKey, queueReload, todayYmd, firstYmd, prefixMap])

  const queue = useMemo(() => buildApprovalsQueue(pendingRows ?? [], { todayYmd }), [pendingRows, todayYmd])
  /** This week's closed hours, as the line read before the strip: every closed session since the week's Sunday. */
  const weekHours = useMemo(() => {
    if (daySessions == null) return null
    const weekStart = weekStartYmd(todayYmd)
    let h = 0
    for (const r of daySessions) if (r.work_date >= weekStart) h += sessionHours(r)
    return Math.round(h * 10) / 10
  }, [daySessions, todayYmd])
  const days = useMemo(
    () =>
      hoursStripDays(
        [...(daySessions ?? []), ...(open ? [{ work_date: open.work_date ?? todayYmd, clocked_in_at: open.clocked_in_at, clocked_out_at: null, approved_at: null }] : [])],
        { firstYmd, todayYmd },
      ),
    [daySessions, open, firstYmd, todayYmd],
  )

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
  const forceClockOutBtn =
    open && workable ? (
      <button type="button" style={deskBtn(BTN_RED, busy)} disabled={busy} onClick={() => void forceClockOut()}>
        Force clock out
      </button>
    ) : null
  const hoursGridLink = (
    <a href={`/people?tab=hours`} style={{ ...BTN_QUIET, textDecoration: 'none' }}>
      Hours grid
    </a>
  )

  const todayRows = (
    <div data-desk-hours-today>
      <DeskRow label="Now" actions={forceClockOutBtn}>
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
      <DeskRow label="This week" actions={hoursGridLink}>
        {weekHours == null ? <span style={{ color: 'var(--text-muted)' }}>—</span> : <span>{formatHoursShort(weekHours)} closed</span>}
      </DeskRow>
      <DeskRow label="Reviewed through">{reviewedThrough ? fmtDay(reviewedThrough) : <span style={{ color: 'var(--text-muted)' }}>never</span>}</DeskRow>
    </div>
  )

  const headChip = personHoursHeadChip(queue, open != null)
  const stripBlock = (
    <div data-desk-hours-strip style={{ display: 'grid', gap: '0.6rem', padding: '0.35rem 0 0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8125rem' }}>
        <Chip tone={headChip.tone === 'grey' ? 'gray' : headChip.tone}>{headChip.words}</Chip>
        {open ? (
          <span>
            on the clock since {formatDenverTimeOnly(new Date(open.clocked_in_at).getTime())}
            {open.label ? ` · ${open.label.replace(/\n/g, ' ')}` : ''}
          </span>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>not clocked in</span>
        )}
        {flagText ? <Chip tone="amber">⚠ {flagText}</Chip> : null}
      </div>
      {daySessions == null ? <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Loading…</span> : <PersonDeskHoursStrip days={days} reviewedThrough={reviewedThrough} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        {queue.count > 0 && workable ? (
          <button type="button" style={BTN_GREEN} onClick={() => setQueueOpen(true)}>
            Open approvals · {queue.count}
          </button>
        ) : null}
        {hoursGridLink}
        {forceClockOutBtn}
      </div>
    </div>
  )

  return (
    <DeskSection id="hours" title="Hours & approvals">
      {error ? <DeskEmpty>{error}</DeskEmpty> : null}
      {view.sideBySide ? null : (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.25rem' }}>
          <ShapeSwitch view={view} words={{ on: "Show today's look", off: 'Show the strip' }} />
        </div>
      )}
      {view.sideBySide ? <SideBySide testId="person-desk-hours-sbs" label="With the strip" today={todayRows} shape={stripBlock} /> : view.on ? stripBlock : todayRows}
      {/* The signed hours statements for the person (punch list #212, PR 2): the list and the window, the job picked instead of the person. */}
      <HoursStatementsSection scope={{ kind: 'person', userId, name: displayName }} zIndex={DESK_EDITOR_Z} canAccessPay={viewer.canAccessPay} desk />

      {queueOpen ? (
        <PeopleHoursApprovalsQueueModal
          pinUserId={userId}
          pinDisplayName={displayName}
          surface="desk-queue"
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
