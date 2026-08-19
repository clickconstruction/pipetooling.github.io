import { useEffect, useState, type CSSProperties } from 'react'
import {
  dispatchModeAddDays,
  dispatchModeAgendaHeading,
  fetchDispatchModeDayBlocks,
  type DispatchModeAgendaBlock,
} from '../../lib/dispatchModeSchedule'
import {
  formatBlockDurationMinutes,
  formatDispatchQuickTimeLabel,
  timeInputToMinutesSafe,
  dispatchMinutesToHHmm,
} from '../../lib/dispatchAddBlockTime'
import { RIBBON_GUIDE_TICK_MINUTES, ribbonSpanPct, ribbonTickLeftPct } from '../../lib/quickAssignFreeWindows'
import { computeManageDaySummary, crewNamesByGroup } from '../../lib/dispatchManagePersonDay'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { saveEditedScheduleBlockTimes } from '../../lib/scheduleDispatchAddBlockSave'
import { nudgeScheduleBlockTimes, type PersonDayNudgeAction } from '../../lib/personDayBlockNudge'
import { deleteJobScheduleBlock, updateJobScheduleBlock } from '../../lib/jobScheduleBlocks'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { buildServiceTypeTradePill } from '../../lib/serviceTypeTradePill'
import { denverCalendarDayKey } from '../../utils/dateUtils'
import { useToastContext } from '../../contexts/ToastContext'

const chipStyle: CSSProperties = {
  flexShrink: 0,
  padding: '0.25rem 0.6rem',
  fontSize: '0.8125rem',
  fontWeight: 600,
  border: '1px solid var(--border-strong)',
  borderRadius: 999,
  background: 'var(--surface)',
  color: 'var(--text-700)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const iconButtonStyle: CSSProperties = {
  width: 28,
  height: 28,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--surface)',
  cursor: 'pointer',
  fontSize: '0.8125rem',
  color: 'var(--text-700)',
  flexShrink: 0,
}

type EditDraft = {
  blockId: string
  timeStart: string
  timeEnd: string
  note: string
  workDate: string
  /** Linked blocks only: apply the change to the whole crew or unlink this leg first. */
  scope: 'crew' | 'person'
}

/**
 * Manage day (Assign work sheet → tap a person's name): one person's schedule
 * blocks for a day, stacked above the sheet, with edit (times / note / day
 * move) and remove. Reuses the dispatch page's save path — linked-crew edits
 * apply to every leg unless the user picks "this person only", which unlinks
 * the leg first. Any successful mutation fires `onChanged` so the sheet can
 * refresh its availability ribbons.
 */
export default function ManagePersonDayModal({
  open,
  personUserId,
  personName,
  initialYmd,
  onClose,
  onChanged,
  onPickForAssignment,
  pickedForAssignment,
  onAssignMoreWork,
  dispatchLinkTo,
}: {
  open: boolean
  personUserId: string
  personName: string
  initialYmd: string
  onClose: () => void
  onChanged?: () => void
  /** When set, the footer offers "Select <name> for this assignment". */
  onPickForAssignment?: (userId: string) => void
  pickedForAssignment?: boolean
  /** Standalone (clock strip) context, v2.1600: footer "+ Assign more work" opens the Assign work sheet for this person. */
  onAssignMoreWork?: () => void
  /** Standalone context: quiet "Open full Dispatch board →" link at the foot (preserves the old blue-icon navigation). */
  dispatchLinkTo?: string
}) {
  const { showToast } = useToastContext()
  const todayYmd = denverCalendarDayKey(Date.now())
  const [ymd, setYmd] = useState(initialYmd)
  const [blocks, setBlocks] = useState<DispatchModeAgendaBlock[]>([])
  const [loading, setLoading] = useState(false)
  const [edit, setEdit] = useState<EditDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [removeBusy, setRemoveBusy] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  /** groupId → crew member names, for the linked-crew chips (v2.1601). Best-effort. */
  const [crewNames, setCrewNames] = useState<ReadonlyMap<string, string[]>>(() => new Map())
  /** Block id mid-nudge (v2.1817) — disables the ±30 chips while one saves. */
  const [nudgingId, setNudgingId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setYmd(initialYmd)
    setEdit(null)
    setEditError(null)
    setRemoveId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    void fetchDispatchModeDayBlocks(ymd, personUserId).then(({ data }) => {
      if (cancelled) return
      setBlocks(data)
      setLoading(false)
      // Crew names for the linked-crew chips: one query covering every group
      // on the day. Best-effort — a failure just leaves the chips nameless.
      const groupIds = Array.from(new Set(data.map((b) => b.sharedBlockGroupId).filter((g): g is string => g != null)))
      if (groupIds.length === 0) {
        setCrewNames(new Map())
        return
      }
      void (async () => {
        try {
          const legs = await withSupabaseRetry<Array<{ shared_block_group_id: string | null; users: { name: string | null } | null }>>(
            async () =>
              supabase
                .from('job_schedule_blocks')
                .select('shared_block_group_id, users!job_schedule_blocks_assignee_user_id_fkey(name)')
                .in('shared_block_group_id', groupIds),
            'load linked-crew names',
          )
          if (cancelled) return
          setCrewNames(crewNamesByGroup((legs ?? []).map((l) => ({ shared_block_group_id: l.shared_block_group_id, name: l.users?.name ?? null }))))
        } catch {
          if (!cancelled) setCrewNames(new Map())
        }
      })()
    })
    return () => {
      cancelled = true
    }
  }, [open, ymd, personUserId, reloadKey])

  if (!open) return null

  const summary = computeManageDaySummary(blocks)
  const heading = dispatchModeAgendaHeading(ymd, todayYmd)

  const mutated = () => {
    setReloadKey((k) => k + 1)
    onChanged?.()
  }

  const shiftDay = (delta: number) => {
    setYmd((d) => dispatchModeAddDays(d, delta))
    setEdit(null)
    setEditError(null)
    setRemoveId(null)
  }

  const startEdit = (b: DispatchModeAgendaBlock) => {
    setEdit({
      blockId: b.id,
      timeStart: b.timeStart.slice(0, 5),
      timeEnd: b.timeEnd.slice(0, 5),
      note: b.note ?? '',
      workDate: ymd,
      scope: 'crew',
    })
    setEditError(null)
    setRemoveId(null)
  }

  const saveEdit = async (b: DispatchModeAgendaBlock) => {
    if (!edit) return
    setSaving(true)
    setEditError(null)
    let groupId = b.sharedBlockGroupId
    if (groupId && edit.scope === 'person') {
      // "This person only": unlink the leg, then edit it as a solo block. If
      // the edit below fails the leg stays unlinked with its old times — a
      // visible, recoverable state (re-edit or remove), never a crew change.
      const { error: unlinkErr } = await updateJobScheduleBlock(b.id, { shared_block_group_id: null })
      if (unlinkErr) {
        setSaving(false)
        setEditError(unlinkErr)
        return
      }
      groupId = null
    }
    const res = await saveEditedScheduleBlockTimes({
      blockId: b.id,
      jobId: b.jobId,
      assigneeUserId: b.assigneeUserId,
      workDate: ymd,
      sharedBlockGroupId: groupId,
      timeStart: edit.timeStart,
      timeEnd: edit.timeEnd,
      note: edit.note,
      newWorkDate: edit.workDate,
    })
    setSaving(false)
    if (!res.ok) {
      setEditError(res.error)
      return
    }
    const moved = edit.workDate !== ymd
    showToast(moved ? `Moved to ${dispatchModeAgendaHeading(edit.workDate, todayYmd)}.` : 'Block updated.', 'success')
    setEdit(null)
    mutated()
  }

  /**
   * One-tap ±30 nudges (v2.1817) — the common "running behind / job ran long"
   * edits without opening the form. Same save path as Edit with the linked
   * default: a linked block's whole crew moves together (unlinking stays an
   * Edit-flow decision; one-tap actions never ask questions).
   */
  const quickNudge = async (b: DispatchModeAgendaBlock, action: PersonDayNudgeAction) => {
    if (nudgingId || saving) return
    const next = nudgeScheduleBlockTimes(b.timeStart, b.timeEnd, action)
    if (!next.ok) {
      showToast(next.error, 'info')
      return
    }
    setNudgingId(b.id)
    const res = await saveEditedScheduleBlockTimes({
      blockId: b.id,
      jobId: b.jobId,
      assigneeUserId: b.assigneeUserId,
      workDate: ymd,
      sharedBlockGroupId: b.sharedBlockGroupId,
      timeStart: next.timeStart,
      timeEnd: next.timeEnd,
      note: b.note ?? '',
      newWorkDate: ymd,
    })
    setNudgingId(null)
    if (!res.ok) {
      showToast(res.error, 'error')
      return
    }
    showToast(
      `${formatDispatchQuickTimeLabel(next.timeStart)}–${formatDispatchQuickTimeLabel(next.timeEnd)}${
        b.sharedBlockGroupId ? ' — whole crew' : ''
      }`,
      'success',
    )
    mutated()
  }

  const confirmRemove = async (b: DispatchModeAgendaBlock) => {
    setRemoveBusy(true)
    const { error } = await deleteJobScheduleBlock(b.id)
    setRemoveBusy(false)
    setRemoveId(null)
    if (error) {
      showToast(error, 'error')
      return
    }
    showToast(`Removed ${personName}'s block.`, 'success')
    mutated()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1006,
        padding: '1rem',
      }}
      onClick={(e) => {
        e.stopPropagation()
        if (!saving && !removeBusy) onClose()
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Manage ${personName}'s schedule for ${heading}`}
        style={{
          background: 'var(--surface)',
          borderRadius: 12,
          width: '96%',
          maxWidth: 480,
          maxHeight: '84vh',
          overflowY: 'auto',
          padding: '0.85rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--text-strong)' }}>
              {personName} — {heading}
            </h3>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 1 }}>
              {summary.count === 0
                ? 'Nothing scheduled'
                : `${summary.count} ${summary.count === 1 ? 'block' : 'blocks'} · ${formatBlockDurationMinutes(summary.totalMinutes)}${
                    summary.freeAfterMin != null
                      ? ` · free after ${formatDispatchQuickTimeLabel(dispatchMinutesToHHmm(summary.freeAfterMin))}`
                      : ''
                  }`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <button type="button" onClick={() => shiftDay(-1)} aria-label="Previous day" style={chipStyle}>
              ‹
            </button>
            <button type="button" onClick={() => shiftDay(1)} aria-label="Next day" style={chipStyle}>
              ›
            </button>
            <button type="button" onClick={onClose} aria-label={`Close manage ${personName}`} style={chipStyle}>
              ✕
            </button>
          </div>
        </div>

        {/* Day timeline — same 6 AM–6 PM scale as the sheet's availability ribbons. */}
        <div>
          <div
            aria-hidden
            style={{
              position: 'relative',
              height: 22,
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border)',
              borderRadius: 5,
              overflow: 'hidden',
            }}
          >
            {/* 4-hour guide ticks (8a · 12p · 4p) — under the block fills. */}
            {RIBBON_GUIDE_TICK_MINUTES.map((m) => {
              const left = ribbonTickLeftPct(m)
              return left != null ? (
                <span
                  key={m}
                  style={{
                    position: 'absolute',
                    left: `${left}%`,
                    top: 0,
                    bottom: 0,
                    width: 1,
                    background: 'var(--border-strong)',
                  }}
                />
              ) : null
            })}
            {blocks.map((b) => {
              const span = ribbonSpanPct({
                startMin: timeInputToMinutesSafe(b.timeStart),
                endMin: timeInputToMinutesSafe(b.timeEnd),
              })
              return span ? (
                <span
                  key={b.id}
                  style={{
                    position: 'absolute',
                    left: `${span.leftPct}%`,
                    width: `${span.widthPct}%`,
                    top: 3,
                    bottom: 3,
                    borderRadius: 3,
                    background: 'var(--bg-blue-200)',
                    border: '1px solid #2563eb',
                    boxSizing: 'border-box',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {/* Job number in the bar (v2.1600, owner request) — clipped, never wraps. */}
                  <span
                    aria-hidden
                    style={{
                      fontSize: '0.5625rem',
                      fontWeight: 700,
                      lineHeight: 1,
                      color: 'var(--text-blue-800)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'clip',
                      padding: '0 2px',
                    }}
                  >
                    {effectiveJobLedgerNumber(b.hcpNumber, b.clickNumber) || ''}
                  </span>
                </span>
              ) : null
            })}
          </div>
          <div
            aria-hidden
            style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.5625rem', color: 'var(--text-faint)', padding: '1px 2px 0' }}
          >
            <span>6 AM</span>
            <span>12 PM</span>
            <span>6 PM</span>
          </div>
        </div>

        {loading ? (
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Loading…</p>
        ) : blocks.length === 0 ? (
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Nothing scheduled this day.</p>
        ) : (
          blocks.map((b) => {
            const pill = buildServiceTypeTradePill(b.serviceTypeName)
            const num = effectiveJobLedgerNumber(b.hcpNumber, b.clickNumber) || '—'
            const durMin = Math.max(0, timeInputToMinutesSafe(b.timeEnd) - timeInputToMinutesSafe(b.timeStart))
            const isEditing = edit?.blockId === b.id
            const isRemoving = removeId === b.id
            return (
              <div key={b.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.45rem' }}>
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                  <span style={{ flexShrink: 0, width: 64, fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)' }}>
                    {formatDispatchQuickTimeLabel(b.timeStart)}
                    <span style={{ display: 'block', fontWeight: 400, color: 'var(--text-faint)', fontSize: '0.75rem' }}>
                      {formatBlockDurationMinutes(durMin)}
                    </span>
                  </span>
                  <span style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      {pill ? <span style={{ ...pill.style, marginTop: 0, flexShrink: 0 }}>{pill.label}</span> : null}
                      <span
                        style={{
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          color: 'var(--text-strong)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {num} · {b.jobName}
                      </span>
                    </span>
                    {b.note?.trim() ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.note.trim()}</span>
                    ) : null}
                    {b.sharedBlockGroupId ? (
                      <span
                        style={{
                          alignSelf: 'flex-start',
                          fontSize: '0.65rem',
                          color: '#7c3aed',
                          background: 'var(--bg-subtle)',
                          borderRadius: 999,
                          padding: '1px 7px',
                        }}
                      >
                        ⛓ linked crew
                        {(() => {
                          const names = crewNames.get(b.sharedBlockGroupId)
                          return names && names.length > 0 ? ` — ${names.join(', ')}` : ''
                        })()}
                      </span>
                    ) : null}
                  </span>
                  {!isEditing && !isRemoving ? (
                    <span style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button type="button" onClick={() => startEdit(b)} aria-label={`Edit ${num} block`} style={iconButtonStyle}>
                        ✎
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRemoveId(b.id)
                          setEdit(null)
                        }}
                        aria-label={`Remove ${num} block`}
                        style={{ ...iconButtonStyle, color: 'var(--text-red-600)' }}
                      >
                        🗑
                      </button>
                    </span>
                  ) : null}
                </div>

                {!isEditing && !isRemoving ? (
                  <div style={{ marginTop: '0.35rem', display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {(
                      [
                        ['shift-back', '⇤ −30', 'Shift the whole block 30 minutes earlier'],
                        ['shift-fwd', '+30 ⇥', 'Shift the whole block 30 minutes later'],
                        ['end-back', 'end −30', 'End 30 minutes earlier'],
                        ['end-fwd', 'end +30', 'End 30 minutes later'],
                      ] as const
                    ).map(([action, label, tip]) => (
                      <button
                        key={action}
                        type="button"
                        disabled={nudgingId != null || saving}
                        title={b.sharedBlockGroupId ? `${tip} — whole crew moves together` : tip}
                        aria-label={`${tip} for ${num}`}
                        onClick={() => void quickNudge(b, action)}
                        style={{
                          padding: '0.2rem 0.55rem',
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          fontVariantNumeric: 'tabular-nums',
                          border: '1px solid var(--border-strong)',
                          borderRadius: 999,
                          background: 'var(--surface)',
                          color: nudgingId === b.id ? 'var(--text-faint)' : 'var(--text-700)',
                          cursor: nudgingId != null || saving ? 'default' : 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ) : null}

                {isRemoving ? (
                  <div
                    style={{
                      marginTop: '0.4rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      flexWrap: 'wrap',
                      fontSize: '0.75rem',
                      color: 'var(--text-700)',
                    }}
                  >
                    <span>
                      Remove this block?
                      {b.sharedBlockGroupId ? ` Only ${personName}'s leg — the rest of the crew keeps theirs.` : ''}
                    </span>
                    <button
                      type="button"
                      disabled={removeBusy}
                      onClick={() => void confirmRemove(b)}
                      style={{
                        padding: '0.25rem 0.7rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: removeBusy ? 'var(--bg-200)' : '#b91c1c',
                        color: removeBusy ? 'var(--text-muted)' : '#fff',
                        border: 'none',
                        borderRadius: 4,
                        cursor: removeBusy ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {removeBusy ? 'Removing…' : 'Remove'}
                    </button>
                    <button
                      type="button"
                      disabled={removeBusy}
                      onClick={() => setRemoveId(null)}
                      style={{ ...chipStyle, padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : null}

                {isEditing && edit ? (
                  <div
                    style={{
                      marginTop: '0.45rem',
                      background: 'var(--bg-blue-tint)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '0.55rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <label style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', width: 34, flexShrink: 0 }}>Time</label>
                      <input
                        type="time"
                        value={edit.timeStart}
                        onChange={(e) => setEdit({ ...edit, timeStart: e.target.value })}
                        aria-label="Start time"
                        style={{ fontSize: '0.8125rem', padding: '0.2rem 0.3rem' }}
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>to</span>
                      <input
                        type="time"
                        value={edit.timeEnd}
                        onChange={(e) => setEdit({ ...edit, timeEnd: e.target.value })}
                        aria-label="End time"
                        style={{ fontSize: '0.8125rem', padding: '0.2rem 0.3rem' }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <label style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', width: 34, flexShrink: 0 }}>Day</label>
                      <input
                        type="date"
                        value={edit.workDate}
                        onChange={(e) => setEdit({ ...edit, workDate: e.target.value })}
                        aria-label="Work day (change to move the block)"
                        style={{ fontSize: '0.8125rem', padding: '0.2rem 0.3rem' }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <label style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', width: 34, flexShrink: 0 }}>Note</label>
                      <input
                        type="text"
                        value={edit.note}
                        onChange={(e) => setEdit({ ...edit, note: e.target.value })}
                        aria-label="Block note"
                        placeholder="Job instructions…"
                        style={{ flex: 1, minWidth: 120, fontSize: '0.8125rem', padding: '0.25rem 0.4rem' }}
                      />
                    </div>
                    {b.sharedBlockGroupId ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', flexWrap: 'wrap', fontSize: '0.75rem', color: '#7c3aed' }}>
                        <span aria-hidden>⛓</span>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name={`manage-scope-${b.id}`}
                            checked={edit.scope === 'crew'}
                            onChange={() => setEdit({ ...edit, scope: 'crew' })}
                          />
                          Whole linked crew
                        </label>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name={`manage-scope-${b.id}`}
                            checked={edit.scope === 'person'}
                            onChange={() => setEdit({ ...edit, scope: 'person' })}
                          />
                          {personName} only (unlinks)
                        </label>
                      </div>
                    ) : null}
                    {editError ? (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-red-600)' }}>{editError}</div>
                    ) : null}
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void saveEdit(b)}
                        style={{
                          padding: '0.3rem 0.9rem',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          background: saving ? 'var(--bg-200)' : '#2563eb',
                          color: saving ? 'var(--text-muted)' : '#fff',
                          border: 'none',
                          borderRadius: 6,
                          cursor: saving ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => {
                          setEdit(null)
                          setEditError(null)
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8125rem', cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })
        )}

        {onPickForAssignment && !pickedForAssignment ? (
          <button
            type="button"
            onClick={() => onPickForAssignment(personUserId)}
            style={{
              border: '1px dashed #2563eb',
              color: 'var(--text-link)',
              background: 'none',
              borderRadius: 6,
              padding: '0.4rem 0.8rem',
              fontSize: '0.8125rem',
              cursor: 'pointer',
              marginTop: '0.2rem',
            }}
          >
            + Select {personName} for this assignment
          </button>
        ) : null}
        {onAssignMoreWork ? (
          <button
            type="button"
            onClick={onAssignMoreWork}
            style={{
              border: '1px dashed #2563eb',
              color: 'var(--text-link)',
              background: 'none',
              borderRadius: 6,
              padding: '0.4rem 0.8rem',
              fontSize: '0.8125rem',
              cursor: 'pointer',
              marginTop: '0.2rem',
            }}
          >
            + Assign more work
          </button>
        ) : null}
        {dispatchLinkTo ? (
          <a
            href={dispatchLinkTo}
            style={{
              textAlign: 'center',
              fontSize: '0.75rem',
              color: 'var(--text-link)',
              marginTop: '0.1rem',
            }}
          >
            Open full Dispatch board →
          </a>
        ) : null}
      </div>
    </div>
  )
}
