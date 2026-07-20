/**
 * Projects → Forecast → Specific: stage detail modal.
 *
 * Opens when the user clicks a stage in the Specific tab's sparse-calendar Gantt. Shows
 * the same fields the Workflow page's stage card surfaces — status, assignee, expected
 * dates, actual timestamps, notes, inspector info, and rejection/skipped reasons —
 * and provides fast editors for the fields the user is most likely to want to change
 * without leaving the forecast page.
 *
 * Editors (gated to roles allowed by the `project_workflow_steps` UPDATE RLS — dev,
 * master_technician, assistant, superintendent):
 *
 *   - Step (plain text) — bundled into the Save button.
 *   - Assigned to (plain text) — bundled into the Save button.
 *   - Expected start + Expected end via `<input type="date">` + quick "Today",
 *     "+1 day", "+1 week", "+1 month" extend chips on the end date. The +N chips push
 *     the end date back by the indicated calendar days; "+1 month" uses a 30-day
 *     approximation (tooltip spells that out).
 *   - Length (days) — auto-couples to start/end exactly the way the Workflow page's
 *     Expected Dates modal does so users can hop between surfaces without re-learning.
 *   - "Also push the next stage's start" checkbox — same chained-update flow as the
 *     Workflow page; only rendered when this stage has a next sibling by
 *     `sequence_order`.
 *
 * Save path for the bundled fields: a single UPDATE against `project_workflow_steps`
 * for this row (name, assigned_to_name, scheduled_start_date, scheduled_end_date),
 * optionally followed by a second UPDATE on the next sibling. On failure the modal
 * stays open with an inline error; on success it refetches the row and the parent's
 * realtime channel on `project_workflow_steps` will refresh the underlying Gantt
 * within ~280ms.
 *
 * Notes (independent of the Save button — they persist on blur like the Workflow page):
 *   - Notes for Tech — collapsible textarea over `notes`; word count in the header.
 *   - Notes for Office — collapsible textarea over `private_notes` (gated to editor
 *     roles to mirror the Workflow page's `canSeePrivateNotesAndApprove` set).
 *
 * Line Items For Office — mounted via the dedicated
 * `ProjectsForecastStageLineItemsSection` component which owns the full
 * `workflow_step_line_items` CRUD UI (Memo / Date / Amount table, View PO / View
 * Invoice, Edit / Delete per row, "+ Add Line Item" inline form, "+ Add Supply House
 * Invoice" and "+ Add PO" pickers). Same gating as the Workflow page: visible to
 * editor roles, but the populated PO/invoice pickers only render for dev /
 * master_technician.
 *
 * Non-editor roles see the same readouts (notes / line items are hidden) but no
 * inputs — just an "Open in Workflow ↗" link to access the full editor.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { ymdAddDays, APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { forecastBarSwatch } from '../../lib/projectsForecastColors'
import {
  fetchForecastStageDetail,
  type ForecastStageDetail,
} from '../../lib/fetchForecastStageDetail'
import type { ResolvedStageBar } from '../../lib/projectsForecastStageResolver'
import { ProjectsForecastStageLineItemsSection } from './ProjectsForecastStageLineItemsSection'
import { parsePercentCompleteInput } from '../../lib/parsePercentCompleteInput'

type Props = {
  /** The clicked stage's bar data — used for the modal header (color swatch, name, seq,
   *  status) so we can render instantly without waiting on the detail fetch. */
  stage: ResolvedStageBar
  projectId: string
  /** Current user's role. Edit controls only render for the 4 roles allowed by the
   *  `project_workflow_steps` UPDATE policy. */
  myRole: string | null
  onClose: () => void
}

const EDITOR_ROLES = new Set([
  'dev',
  'master_technician',
  'assistant',
  'superintendent',
  'controller',
])

function canEditExpectedDates(role: string | null): boolean {
  return role != null && EDITOR_ROLES.has(role)
}

function todayYmdCentral(): string {
  // Match the Specific tab's todayYmdCentral: local-clock based "today" is fine because
  // the company calendar tz vs the browser tz differs by at most an hour for the only
  // production user, and a "Today" button is a UX nudge, not a payroll input.
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function ymdDaysBetween(startYmd: string, endYmd: string): number | null {
  if (!startYmd || !endYmd) return null
  const a = startYmd.split('-').map(Number)
  const b = endYmd.split('-').map(Number)
  if (a.length !== 3 || b.length !== 3 || a.some((n) => Number.isNaN(n)) || b.some((n) => Number.isNaN(n))) {
    return null
  }
  const [ay, am, ad] = a as [number, number, number]
  const [by, bm, bd] = b as [number, number, number]
  const start = new Date(ay, am - 1, ad)
  const end = new Date(by, bm - 1, bd)
  return Math.round((end.getTime() - start.getTime()) / 86400000)
}

function ymdFromDateLike(value: string | null | undefined): string {
  if (!value) return ''
  // `date` columns come back as YYYY-MM-DD; `timestamptz` columns include T+offset. Slice
  // the leading 10 chars in either case.
  return value.slice(0, 10)
}

const DATE_FMT_LONG = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_CALENDAR_TZ,
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

const DATETIME_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_CALENDAR_TZ,
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

function formatYmdLong(value: string | null | undefined): string {
  const ymd = ymdFromDateLike(value)
  if (!ymd) return '—'
  // Use noon Central to avoid DST/UTC drift dropping the date back a day.
  return DATE_FMT_LONG.format(new Date(`${ymd}T12:00:00`))
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return DATETIME_FMT.format(d)
}

function describeStatus(status: string | null): { label: string; bg: string; color: string; border: string } {
  switch (status) {
    case 'completed':
      return { label: 'Completed', bg: 'var(--bg-green-100)', color: 'var(--text-green-800)', border: '#86efac' }
    case 'approved':
      return { label: 'Approved', bg: 'var(--bg-green-100)', color: 'var(--text-green-800)', border: '#86efac' }
    case 'in_progress':
      return { label: 'In progress', bg: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', border: '#fcd34d' }
    case 'rejected':
      return { label: 'Previous work incomplete', bg: 'var(--bg-red-100)', color: 'var(--text-red-800)', border: '#fca5a5' }
    case 'skipped':
      return { label: 'Skipped', bg: 'var(--bg-muted)', color: 'var(--text-600)', border: 'var(--border-strong)' }
    case 'pending':
      return { label: 'Pending', bg: '#e0e7ff', color: '#3730a3', border: '#a5b4fc' }
    default:
      return { label: status ?? '—', bg: 'var(--bg-muted)', color: 'var(--text-600)', border: 'var(--border-strong)' }
  }
}

function actualDurationLabel(startedAt: string | null, endedAt: string | null): string | null {
  if (!startedAt) return null
  const start = new Date(startedAt)
  const end = endedAt ? new Date(endedAt) : new Date()
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  const days = Math.round((end.getTime() - start.getTime()) / 86400000)
  if (days < 0) return null
  const label = days === 1 ? '1 day' : `${days} days`
  return endedAt ? `${label} elapsed` : `${label} open`
}

function wordCount(text: string | null | undefined): number {
  if (!text) return 0
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function ProjectsForecastSpecificStageModal({ stage, projectId, myRole, onClose }: Props) {
  const { showToast } = useToastContext()
  const canEdit = canEditExpectedDates(myRole)

  const [detail, setDetail] = useState<ForecastStageDetail | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState<boolean>(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Editable form state — initialized from `detail` once it loads.
  const [startVal, setStartVal] = useState<string>('')
  const [endVal, setEndVal] = useState<string>('')
  const [lengthVal, setLengthVal] = useState<string>('')
  const [alsoPushNext, setAlsoPushNext] = useState<boolean>(false)
  const [nameVal, setNameVal] = useState<string>('')
  const [assignedToVal, setAssignedToVal] = useState<string>('')
  const [touched, setTouched] = useState<boolean>(false)

  // Notes section UI (independent of the bundled Save flow — these persist on blur).
  const [notesExpanded, setNotesExpanded] = useState<boolean | null>(null)
  const [privateNotesExpanded, setPrivateNotesExpanded] = useState<boolean | null>(null)
  const [savingNotes, setSavingNotes] = useState<boolean>(false)
  const [savingPrivateNotes, setSavingPrivateNotes] = useState<boolean>(false)
  // Header `Complete: [N] %` editor — saves on blur, independent of the bundled Save
  // button, same pattern the notes textareas use. Mirrors the Forecast Specific gutter
  // cell at `ProjectsForecastSpecificTab.tsx` so a user can flip between the gutter
  // and the modal header without re-learning the affordance.
  const [savingPercent, setSavingPercent] = useState<boolean>(false)
  // Bump to force the line-items section to refetch after the bundled Save (which may
  // have changed the step row; line items aren't actually affected but a refetch is
  // cheap and keeps everything consistent if a deletion happens elsewhere).
  const lineItemsRefreshNonceRef = useRef<number>(0)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const result = await fetchForecastStageDetail(stage.stageId)
      if (!result) {
        setDetail(null)
        setLoadError('This stage is no longer accessible — it may have been deleted.')
        return
      }
      setDetail(result)
    } catch (e) {
      setDetail(null)
      setLoadError(formatErrorMessage(e, 'Failed to load stage details'))
    } finally {
      setLoading(false)
    }
  }, [stage.stageId])

  useEffect(() => {
    void load()
  }, [load])

  // Seed editable state once detail loads. We deliberately only seed on the first
  // successful load (or after a save+refetch that resets `touched` to false) so a user
  // mid-edit doesn't get their inputs reset under them by realtime / refetches.
  useEffect(() => {
    if (!detail) return
    if (touched) return
    const start = ymdFromDateLike(detail.step.scheduled_start_date)
    const end = ymdFromDateLike(detail.step.scheduled_end_date)
    const len = start && end ? ymdDaysBetween(start, end) : null
    setStartVal(start)
    setEndVal(end)
    setLengthVal(len != null ? String(len) : '')
    setAlsoPushNext(false)
    setNameVal(detail.step.name ?? '')
    setAssignedToVal(detail.step.assigned_to_name ?? '')
    // Default the notes sections to expanded when there's existing content, collapsed
    // when blank — matches the Workflow page's `isSectionDefaultExpanded` behavior.
    setNotesExpanded((prev) => prev ?? wordCount(detail.step.notes) > 0)
    setPrivateNotesExpanded((prev) => prev ?? wordCount(detail.step.private_notes) > 0)
  }, [detail, touched])

  // ESC closes when not actively saving.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, saving])

  // Body scroll lock while the modal is open.
  useEffect(() => {
    if (typeof document === 'undefined') return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const lengthNum = lengthVal.trim() === '' ? null : Number(lengthVal)
  const lengthInvalid = lengthVal.trim() !== '' && (!Number.isFinite(lengthNum ?? NaN) || (lengthNum != null && lengthNum < 0))
  const between = startVal && endVal ? ymdDaysBetween(startVal, endVal) : null
  const endBeforeStart = between != null && between < 0

  const dirty = useMemo(() => {
    if (!detail) return false
    const origStart = ymdFromDateLike(detail.step.scheduled_start_date)
    const origEnd = ymdFromDateLike(detail.step.scheduled_end_date)
    const origName = detail.step.name ?? ''
    const origAssignee = detail.step.assigned_to_name ?? ''
    return (
      startVal !== origStart ||
      endVal !== origEnd ||
      nameVal !== origName ||
      assignedToVal !== origAssignee ||
      alsoPushNext
    )
  }, [detail, startVal, endVal, nameVal, assignedToVal, alsoPushNext])

  const nameInvalid = nameVal.trim() === ''
  const saveDisabled =
    saving || !dirty || lengthInvalid || endBeforeStart || (canEdit && nameInvalid)

  const handleStartChange = (value: string) => {
    setTouched(true)
    const len = lengthVal.trim()
    const lenNum = len === '' ? NaN : Number(len)
    if (value && len !== '' && Number.isFinite(lenNum) && lenNum >= 0) {
      setStartVal(value)
      setEndVal(ymdAddDays(value, lenNum))
      return
    }
    if (value && endVal) {
      const newLen = ymdDaysBetween(value, endVal)
      setStartVal(value)
      setLengthVal(newLen != null ? String(newLen) : '')
      return
    }
    setStartVal(value)
  }

  const handleEndChange = (value: string) => {
    setTouched(true)
    if (value && startVal) {
      const newLen = ymdDaysBetween(startVal, value)
      setEndVal(value)
      setLengthVal(newLen != null ? String(newLen) : '')
      return
    }
    setEndVal(value)
  }

  const handleLengthChange = (value: string) => {
    setTouched(true)
    const trimmed = value.trim()
    if (trimmed === '') {
      setLengthVal('')
      return
    }
    const num = Number(trimmed)
    if (!Number.isFinite(num)) {
      setLengthVal(value)
      return
    }
    if (startVal) {
      setLengthVal(value)
      setEndVal(ymdAddDays(startVal, num))
    } else {
      setLengthVal(value)
    }
  }

  const extendEndByDays = (days: number) => {
    setTouched(true)
    const anchor = endVal || startVal
    if (!anchor) {
      showToast('Set a start or end date first, then use a quick extend button.', 'info')
      return
    }
    const next = ymdAddDays(anchor, days)
    if (startVal) {
      const newLen = ymdDaysBetween(startVal, next)
      setEndVal(next)
      setLengthVal(newLen != null ? String(newLen) : '')
    } else {
      setEndVal(next)
    }
  }

  const setStartToToday = () => {
    handleStartChange(todayYmdCentral())
  }

  const setEndToToday = () => {
    handleEndChange(todayYmdCentral())
  }

  const handleSave = async () => {
    if (!detail) return
    if (lengthInvalid || endBeforeStart || nameInvalid) return
    setSaving(true)
    setSaveError(null)
    const startToWrite = startVal.trim() || null
    const endToWrite = endVal.trim() || null
    const nameToWrite = nameVal.trim()
    const assigneeToWrite = assignedToVal.trim() || null
    try {
      const { error } = await supabase
        .from('project_workflow_steps')
        .update({
          name: nameToWrite,
          assigned_to_name: assigneeToWrite,
          scheduled_start_date: startToWrite,
          scheduled_end_date: endToWrite,
        })
        .eq('id', detail.step.id)
      if (error) {
        setSaveError(`Failed to save: ${error.message}`)
        return
      }
      // Optionally chain into the next stage's expected start, matching the Workflow page's
      // "Also set the next stage's expected start to this stage's expected end" flow.
      if (alsoPushNext && detail.nextStage && endToWrite) {
        const { error: nextErr } = await supabase
          .from('project_workflow_steps')
          .update({ scheduled_start_date: endToWrite })
          .eq('id', detail.nextStage.id)
        if (nextErr) {
          showToast(
            `Saved this stage; failed to update next stage: ${nextErr.message}`,
            'error',
          )
        } else {
          showToast('Saved. Next stage start updated to match.', 'success')
        }
      } else {
        showToast('Stage saved.', 'success')
      }
      // Refetch to confirm the persisted state + pick up any realtime side effects.
      setTouched(false)
      lineItemsRefreshNonceRef.current += 1
      await load()
    } catch (e) {
      setSaveError(formatErrorMessage(e, 'Failed to save'))
    } finally {
      setSaving(false)
    }
  }

  // Persist Notes for Tech (`notes`) — fire-and-forget on textarea blur. Uses the
  // dedicated RPC the Workflow page uses (faster than a general UPDATE under the
  // table's RLS policies), with a fallback to a direct UPDATE when the RPC isn't
  // available in the linked project.
  const saveNotes = useCallback(
    async (value: string) => {
      if (!detail) return
      const trimmed = value.trim() || null
      const original = detail.step.notes ?? null
      if ((trimmed ?? '') === (original ?? '')) return
      setSavingNotes(true)
      try {
        let err = (await supabase.rpc('update_step_notes', {
          p_step_id: detail.step.id,
          p_notes: trimmed ?? '',
        })).error
        if (err?.message?.includes('Could not find the function')) {
          err = (
            await supabase
              .from('project_workflow_steps')
              .update({ notes: trimmed })
              .eq('id', detail.step.id)
          ).error
        }
        if (err) {
          showToast(`Failed to update notes: ${err.message}`, 'error')
          return
        }
        await load()
      } finally {
        setSavingNotes(false)
      }
    },
    [detail, load, showToast],
  )

  const savePrivateNotes = useCallback(
    async (value: string) => {
      if (!detail) return
      const trimmed = value.trim() || null
      const original = detail.step.private_notes ?? null
      if ((trimmed ?? '') === (original ?? '')) return
      setSavingPrivateNotes(true)
      try {
        let err = (await supabase.rpc('update_step_private_notes', {
          p_step_id: detail.step.id,
          p_private_notes: trimmed ?? '',
        })).error
        if (err?.message?.includes('Could not find the function')) {
          err = (
            await supabase
              .from('project_workflow_steps')
              .update({ private_notes: trimmed })
              .eq('id', detail.step.id)
          ).error
        }
        if (err) {
          showToast(`Failed to update private notes: ${err.message}`, 'error')
          return
        }
        await load()
      } finally {
        setSavingPrivateNotes(false)
      }
    },
    [detail, load, showToast],
  )

  // Persist `percent_complete` from the header editor. Skips when the new value equals
  // the current persisted value to avoid no-op writes (mirrors the gutter cell). Same
  // null-on-zero semantic as the shared `parsePercentCompleteInput` helper — typing 0
  // clears the cell. On failure we surface a toast and let the input re-key off the
  // unchanged persisted value (no inline error UI to keep the header compact).
  const savePercent = useCallback(
    async (next: number | null) => {
      if (!detail) return
      if (next === (detail.step.percent_complete ?? null)) return
      setSavingPercent(true)
      try {
        const { error } = await supabase
          .from('project_workflow_steps')
          .update({ percent_complete: next })
          .eq('id', detail.step.id)
        if (error) {
          showToast(`Failed to save %: ${error.message}`, 'error')
          return
        }
        await load()
      } catch (e) {
        showToast(formatErrorMessage(e, 'Failed to save %'), 'error')
      } finally {
        setSavingPercent(false)
      }
    },
    [detail, load, showToast],
  )

  const handleClearDates = async () => {
    if (!detail) return
    setSaving(true)
    setSaveError(null)
    try {
      const { error } = await supabase
        .from('project_workflow_steps')
        .update({ scheduled_start_date: null, scheduled_end_date: null })
        .eq('id', detail.step.id)
      if (error) {
        setSaveError(`Failed to clear expected dates: ${error.message}`)
        return
      }
      showToast('Cleared expected dates.', 'success')
      setTouched(false)
      await load()
    } catch (e) {
      setSaveError(formatErrorMessage(e, 'Failed to clear expected dates'))
    } finally {
      setSaving(false)
    }
  }

  const onBackdropClick = () => {
    if (saving) return
    if (dirty) {
      const ok = window.confirm('Discard your changes to expected dates?')
      if (!ok) return
    }
    onClose()
  }

  const openInWorkflow = () => {
    const url = `/workflows/${projectId}#step-${stage.stageId}`
    try {
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      window.location.href = url
    }
  }

  const swatch = forecastBarSwatch(stage.colorKey)
  const statusInfo = describeStatus(detail?.step.status ?? stage.status ?? null)
  const step = detail?.step ?? null
  const nextStage = detail?.nextStage ?? null
  const expectedStartReadable = formatYmdLong(step?.scheduled_start_date ?? null)
  const expectedEndReadable = formatYmdLong(step?.scheduled_end_date ?? null)
  const plannedLen = step?.scheduled_start_date && step?.scheduled_end_date
    ? ymdDaysBetween(ymdFromDateLike(step.scheduled_start_date), ymdFromDateLike(step.scheduled_end_date))
    : null
  const plannedLenLabel = plannedLen != null ? (plannedLen === 1 ? '1 day planned' : `${plannedLen} days planned`) : null
  const actualLabel = actualDurationLabel(step?.started_at ?? null, step?.ended_at ?? null)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Stage details for ${stage.name}`}
      onClick={onBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1005,
        padding: '1rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: 10,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          width: '100%',
          maxWidth: 640,
          maxHeight: 'calc(100vh - 2rem)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '1rem 1.25rem 0.75rem',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 28,
              height: 26,
              padding: '0 8px',
              borderRadius: 5,
              background: swatch.background,
              color: swatch.textColor,
              border: `1px solid ${swatch.borderColor}`,
              fontSize: '0.8125rem',
              fontWeight: 700,
              flexShrink: 0,
              marginTop: 2,
            }}
            aria-label={`Stage sequence ${stage.sequenceOrder}`}
          >
            {stage.sequenceOrder}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
            <h2
              style={{
                margin: 0,
                fontSize: '1.125rem',
                color: 'var(--text-slate-900)',
                lineHeight: 1.3,
                overflowWrap: 'break-word',
              }}
            >
              {stage.name}
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0.125rem 0.5rem',
                  borderRadius: 4,
                  background: statusInfo.bg,
                  color: statusInfo.color,
                  border: `1px solid ${statusInfo.border}`,
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                }}
              >
                {statusInfo.label}
              </span>
              {step?.step_type ? (
                <span
                  style={{
                    fontSize: '0.6875rem',
                    color: 'var(--text-muted)',
                    background: 'var(--bg-muted)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    padding: '0.125rem 0.5rem',
                  }}
                  title="Step type"
                >
                  {step.step_type}
                </span>
              ) : null}
              {step?.assigned_to_name && step.assigned_to_name.trim() ? (
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>
                  · {step.assigned_to_name}
                </span>
              ) : (
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-faint)', fontStyle: 'italic' }}>
                  · unassigned
                </span>
              )}
            </div>
          </div>
          {/* Header `Complete: [N] %` — placed top-right between the title block and
              the close button so the user can change progress without scrolling into
              the body editor. Only renders once `step` (i.e. `detail`) has loaded so
              we know whether `percent_complete` is null or a real number; before that
              the slot is empty and the close button sits at the right edge as before.
              Mirrors the Forecast Specific gutter cell at
              `ProjectsForecastSpecificTab.tsx`'s `StageGutterLabel` — typing 0 clears
              via the shared `parsePercentCompleteInput`, the input re-keys off the
              persisted value, and the visual blank covers the `0 -> null` no-op-commit
              case. */}
          {step ? (
            <HeaderPercentCompleteEditor
              stageId={stage.stageId}
              percentComplete={step.percent_complete ?? null}
              canEdit={canEdit}
              savingPercent={savingPercent}
              savePercent={savePercent}
            />
          ) : null}
          <button
            type="button"
            onClick={onBackdropClick}
            aria-label="Close"
            title="Close"
            style={{
              all: 'unset',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '1.25rem',
              color: 'var(--text-muted)',
              padding: '0.25rem 0.5rem',
              borderRadius: 4,
              flexShrink: 0,
            }}
            disabled={saving}
          >
            ×
          </button>
        </div>

        {/* Body — scrolls */}
        <div style={{ overflowY: 'auto', padding: '1rem 1.25rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {loadError ? (
            <div
              role="alert"
              style={{
                padding: '0.5rem 0.75rem',
                background: 'var(--bg-red-tint)',
                border: '1px solid #fecaca',
                borderRadius: 6,
                color: 'var(--text-red-800)',
                fontSize: '0.8125rem',
              }}
            >
              {loadError}
            </div>
          ) : loading ? (
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading stage details…</div>
          ) : null}

          {step ? (
            <>
              {/* Details readout (Stages-tab equivalents) */}
              <section
                aria-label="Stage details"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.75rem 1rem',
                  fontSize: '0.8125rem',
                }}
              >
                <DetailField label="Expected start" value={expectedStartReadable} />
                <DetailField label="Expected end" value={expectedEndReadable} />
                <DetailField
                  label="Planned length"
                  value={plannedLenLabel ?? '—'}
                />
                <DetailField
                  label="Actual"
                  value={
                    step.started_at
                      ? `${formatTimestamp(step.started_at)} → ${step.ended_at ? formatTimestamp(step.ended_at) : 'still open'}${actualLabel ? ` · ${actualLabel}` : ''}`
                      : 'Not started yet'
                  }
                />
                {step.inspector_name && step.inspector_name.trim() ? (
                  <DetailField label="Inspector" value={step.inspector_name} />
                ) : null}
                {step.approved_at ? (
                  <DetailField
                    label="Approved"
                    value={`${formatTimestamp(step.approved_at)}${step.approved_by ? ` · ${step.approved_by}` : ''}`}
                  />
                ) : null}
              </section>

              {step.rejection_reason || step.next_step_rejection_reason || step.skipped_reason ? (
                <section
                  aria-label="Status reasons"
                  style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8125rem' }}
                >
                  {step.rejection_reason ? (
                    <ReasonBlock title="Sent back" body={step.rejection_reason} />
                  ) : null}
                  {step.next_step_rejection_reason ? (
                    <ReasonBlock title="Next step sent back" body={step.next_step_rejection_reason} />
                  ) : null}
                  {step.skipped_reason ? (
                    <ReasonBlock title="Skipped" body={step.skipped_reason} />
                  ) : null}
                </section>
              ) : null}

              {step.inspection_notes && step.inspection_notes.trim() ? (
                <section aria-label="Inspection notes" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                    Inspection notes
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-strong)', whiteSpace: 'pre-wrap' }}>
                    {step.inspection_notes}
                  </div>
                </section>
              ) : null}

              {/* Editor section — only for roles that can write */}
              {canEdit ? (
                <section
                  aria-label="Edit stage"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    padding: '0.875rem 1rem',
                    background: 'var(--bg-slate-tint)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                  }}
                >
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-slate-600)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                    Adjust stage
                  </div>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-700)', fontWeight: 600 }}>
                      Step (plain text) <span style={{ color: 'var(--text-red-700)' }}>*</span>
                    </span>
                    <input
                      type="text"
                      value={nameVal}
                      onChange={(e) => {
                        setTouched(true)
                        setNameVal(e.target.value)
                      }}
                      disabled={saving}
                      placeholder="e.g. rough in, top out, trim"
                      style={dateInputStyle}
                      aria-invalid={nameInvalid}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-700)', fontWeight: 600 }}>
                      Assigned to{' '}
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                        · plain text (the Workflow page has a fuller picker)
                      </span>
                    </span>
                    <input
                      type="text"
                      value={assignedToVal}
                      onChange={(e) => {
                        setTouched(true)
                        setAssignedToVal(e.target.value)
                      }}
                      disabled={saving}
                      placeholder="Type a name, or leave blank to unassign"
                      style={dateInputStyle}
                    />
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-700)', fontWeight: 600 }}>Expected start</span>
                      <input
                        type="date"
                        value={startVal}
                        onChange={(e) => handleStartChange(e.target.value)}
                        disabled={saving}
                        style={dateInputStyle}
                      />
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={setStartToToday}
                          disabled={saving}
                          style={chipBtnStyle}
                          title="Set expected start to today"
                        >
                          Today
                        </button>
                      </div>
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-700)', fontWeight: 600 }}>Expected end</span>
                      <input
                        type="date"
                        value={endVal}
                        onChange={(e) => handleEndChange(e.target.value)}
                        disabled={saving}
                        style={dateInputStyle}
                      />
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={setEndToToday}
                          disabled={saving}
                          style={chipBtnStyle}
                          title="Set expected end to today"
                        >
                          Today
                        </button>
                        <button
                          type="button"
                          onClick={() => extendEndByDays(1)}
                          disabled={saving}
                          style={chipBtnPrimaryStyle}
                          title="Push the end date back by 1 day"
                        >
                          +1 day
                        </button>
                        <button
                          type="button"
                          onClick={() => extendEndByDays(7)}
                          disabled={saving}
                          style={chipBtnPrimaryStyle}
                          title="Push the end date back by 1 week (7 days)"
                        >
                          +1 week
                        </button>
                        <button
                          type="button"
                          onClick={() => extendEndByDays(30)}
                          disabled={saving}
                          style={chipBtnPrimaryStyle}
                          title="Push the end date back by 1 month (30 days)"
                        >
                          +1 month
                        </button>
                      </div>
                    </label>
                  </div>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 200 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-700)', fontWeight: 600 }}>
                      Length (days){' '}
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· auto-sets end from start</span>
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      placeholder="e.g. 5"
                      value={lengthVal}
                      onChange={(e) => handleLengthChange(e.target.value)}
                      disabled={saving}
                      style={dateInputStyle}
                    />
                  </label>

                  {nextStage ? (
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: '0.8125rem',
                        color: 'var(--text-gray-800)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={alsoPushNext}
                        onChange={(e) => {
                          setTouched(true)
                          setAlsoPushNext(e.target.checked)
                        }}
                        disabled={saving || !endVal.trim()}
                      />
                      Also push “{nextStage.name}” start to this stage’s expected end
                    </label>
                  ) : null}

                  {nameInvalid ? (
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-red-700)' }}>
                      Step name is required.
                    </p>
                  ) : null}
                  {lengthInvalid ? (
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-red-700)' }}>
                      Length must be a non-negative number.
                    </p>
                  ) : null}
                  {endBeforeStart ? (
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-red-700)' }}>
                      Expected end is before expected start.
                    </p>
                  ) : null}
                  {saveError ? (
                    <p role="alert" style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-red-700)' }}>
                      {saveError}
                    </p>
                  ) : null}
                </section>
              ) : (
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  You don’t have permission to edit this stage. Use the Workflow page link below
                  if you need to make changes.
                </p>
              )}

              {/* Notes for Tech — collapsible, save-on-blur. Visible to anyone who can
                  see the stage (RLS controls the SELECT); editor input only renders for
                  editor roles (server will reject the write otherwise). */}
              {canEdit ? (
                <NotesCollapsible
                  title="Notes for Tech"
                  words={wordCount(step.notes)}
                  expanded={notesExpanded ?? wordCount(step.notes) > 0}
                  onToggle={() => setNotesExpanded((v) => !(v ?? wordCount(step.notes) > 0))}
                  textareaKey={`notes-${step.id}-${step.notes ?? ''}`}
                  defaultValue={step.notes ?? ''}
                  onBlurSave={saveNotes}
                  saving={savingNotes}
                  placeholder="Add notes (visible to everyone who can see this stage, including the assigned technician)"
                  toneColor="#0f172a"
                  borderColor="#e5e7eb"
                />
              ) : null}

              {/* Notes for Office — gated to editor roles (same set as Workflow page's
                  `canSeePrivateNotesAndApprove`). Distinct styling so it visually reads
                  as "private". */}
              {canEdit ? (
                <NotesCollapsible
                  title="Notes for Office"
                  words={wordCount(step.private_notes)}
                  expanded={privateNotesExpanded ?? wordCount(step.private_notes) > 0}
                  onToggle={() =>
                    setPrivateNotesExpanded((v) => !(v ?? wordCount(step.private_notes) > 0))
                  }
                  textareaKey={`private-notes-${step.id}-${step.private_notes ?? ''}`}
                  defaultValue={step.private_notes ?? ''}
                  onBlurSave={savePrivateNotes}
                  saving={savingPrivateNotes}
                  placeholder="Add private notes visible to masters, assistants, and superintendents…"
                  toneColor="#0369a1"
                  borderColor="#bae6fd"
                />
              ) : null}

              {/* Line Items For Office — self-contained section with full Workflow-page
                  parity (table + Edit/Delete + View PO / View Invoice + Add line item /
                  Add SH Invoice / Add PO). Gating handled inside the component. */}
              {canEdit ? (
                <ProjectsForecastStageLineItemsSection
                  stepId={step.id}
                  stepName={step.name}
                  myRole={myRole}
                  refreshNonce={lineItemsRefreshNonceRef.current}
                />
              ) : null}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: '0.75rem 1.25rem',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-subtle)',
            flexWrap: 'wrap',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={openInWorkflow}
            style={{
              all: 'unset',
              fontSize: '0.8125rem',
              color: 'var(--text-link)',
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
            title="Open this stage on the Workflow page (new tab)"
          >
            Open in Workflow ↗
          </button>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {canEdit ? (
              <>
                <button
                  type="button"
                  onClick={handleClearDates}
                  disabled={
                    saving ||
                    !step ||
                    (!step.scheduled_start_date && !step.scheduled_end_date)
                  }
                  style={footerSecondaryStyle}
                  title="Remove the expected start and end from this stage"
                >
                  Clear dates
                </button>
                <button type="button" onClick={onBackdropClick} disabled={saving} style={footerSecondaryStyle}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saveDisabled}
                  style={{
                    ...footerPrimaryStyle,
                    opacity: saveDisabled ? 0.55 : 1,
                    cursor: saveDisabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </>
            ) : (
              <button type="button" onClick={onClose} style={footerPrimaryStyle}>
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Collapsible textarea section used for "Notes for Tech" and "Notes for Office".
 *
 * Uncontrolled textarea (defaultValue + key) — typing doesn't trigger React re-renders,
 * and the `key` forces a fresh DOM textarea whenever the persisted value changes (after
 * a successful save or a realtime refetch). The triangle / word-count header collapses
 * the textarea without unmounting it. Saves fire on blur, matching the Workflow page.
 */
function NotesCollapsible({
  title,
  words,
  expanded,
  onToggle,
  textareaKey,
  defaultValue,
  onBlurSave,
  saving,
  placeholder,
  toneColor,
  borderColor,
}: {
  title: string
  words: number
  expanded: boolean
  onToggle: () => void
  textareaKey: string
  defaultValue: string
  onBlurSave: (value: string) => void | Promise<void>
  saving: boolean
  placeholder: string
  toneColor: string
  borderColor: string
}) {
  return (
    <section
      aria-label={title}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        style={{
          all: 'unset',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          cursor: 'pointer',
          fontSize: '0.8125rem',
          fontWeight: 500,
          color: toneColor,
        }}
      >
        <span style={{ fontSize: '0.75rem', minWidth: 16, color: 'var(--text-strong)' }}>
          {expanded ? '\u25BC' : '\u25B6'}
        </span>
        <span>
          {title} ({words} {words === 1 ? 'word' : 'words'})
          {saving ? <span style={{ color: 'var(--text-muted)', marginLeft: 6, fontWeight: 400 }}>· saving…</span> : null}
        </span>
      </button>
      {expanded ? (
        <textarea
          key={textareaKey}
          defaultValue={defaultValue}
          onBlur={(e) => void onBlurSave(e.target.value)}
          placeholder={placeholder}
          rows={3}
          style={{
            width: '100%',
            padding: '0.45rem',
            fontSize: '0.8125rem',
            border: `1px solid ${borderColor}`,
            borderRadius: 4,
            resize: 'vertical',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />
      ) : null}
    </section>
  )
}

/**
 * Compact `Complete: [N] %` editor that lives in the modal header (top-right, between
 * the title block and the close button). Two modes:
 *
 *   - `canEdit === true`  — uncontrolled `<input type="number">` re-keyed off the
 *     persisted value so a realtime refresh or a save+reload swaps the visible value
 *     without forcing us into a controlled-value dance. Saves on blur via the parent's
 *     `savePercent`, which itself runs input through the shared
 *     `parsePercentCompleteInput` (the helper maps `0`, empty, negatives, and
 *     fractionals that round to `0` all to null, so typing `0` clears the cell). We
 *     also imperatively blank the DOM value when the parser returned null but the
 *     field still shows non-empty text — covers the case where the user typed `0`
 *     over a real value (input would briefly show "0" until the realtime re-key
 *     arrived) and the case where the user typed `0` into an already-null cell
 *     (the `next === persisted` early-return inside `savePercent` skips the commit,
 *     so without this the field would keep showing the stale "0").
 *
 *   - `canEdit === false` — renders a plain `45%` label when the value is non-null,
 *     and renders nothing when it is null (keeps the header compact for roles that
 *     can't change the value and aren't tracking it).
 *
 * `stopPropagation` on the click / mousedown / keydown handlers prevents typing from
 * bubbling up and triggering anything else that might be listening on the header
 * (e.g. focus-trap shortcuts), matching the gutter cell pattern.
 */
function HeaderPercentCompleteEditor({
  stageId,
  percentComplete,
  canEdit,
  savingPercent,
  savePercent,
}: {
  stageId: string
  percentComplete: number | null
  canEdit: boolean
  savingPercent: boolean
  savePercent: (next: number | null) => void | Promise<void>
}) {
  if (!canEdit) {
    if (percentComplete == null) return null
    return (
      <div style={headerPercentReadOnlyStyle} aria-label={`Percent complete: ${percentComplete}%`}>
        <span style={headerPercentLabelStyle}>Complete</span>
        <span style={headerPercentReadOnlyValueStyle}>{percentComplete}%</span>
      </div>
    )
  }

  return (
    <label style={headerPercentEditorStyle}>
      <span style={headerPercentLabelStyle}>
        Complete
        {savingPercent ? <span style={headerPercentSavingStyle}> · saving…</span> : null}
      </span>
      <span style={headerPercentInputRowStyle}>
        <input
          key={`pct-header-${stageId}-${percentComplete ?? 'null'}`}
          type="number"
          className="no-spinner"
          min={0}
          max={100}
          inputMode="numeric"
          defaultValue={percentComplete == null ? '' : String(percentComplete)}
          aria-label="Percent complete"
          title="Optional 0-100 progress estimate. Type 0 or leave empty to clear."
          disabled={savingPercent}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur()
          }}
          onBlur={(e) => {
            const next = parsePercentCompleteInput(e.currentTarget.value)
            if (next == null && e.currentTarget.value !== '') {
              e.currentTarget.value = ''
            }
            void savePercent(next)
          }}
          style={headerPercentInputStyle}
        />
        <span style={headerPercentSuffixStyle}>%</span>
      </span>
    </label>
  )
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.025em' }}>
        {label}
      </span>
      <span style={{ fontSize: '0.8125rem', color: 'var(--text-slate-900)', overflowWrap: 'break-word' }}>{value}</span>
    </div>
  )
}

function ReasonBlock({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        padding: '0.5rem 0.75rem',
        background: 'var(--bg-red-tint)',
        border: '1px solid #fecaca',
        borderRadius: 6,
      }}
    >
      <div style={{ fontSize: '0.6875rem', color: 'var(--text-red-800)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.025em' }}>
        {title}
      </div>
      <div style={{ fontSize: '0.8125rem', color: 'var(--text-red-900)', whiteSpace: 'pre-wrap' }}>{body}</div>
    </div>
  )
}

const dateInputStyle = {
  padding: '0.4rem 0.5rem',
  borderRadius: 6,
  border: '1px solid var(--border-strong)',
  fontSize: '0.875rem',
  color: 'var(--text-slate-900)',
  background: 'var(--surface)',
} as const

const chipBtnStyle = {
  padding: '0.25rem 0.55rem',
  borderRadius: 999,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-gray-800)',
  fontSize: '0.6875rem',
  fontWeight: 600,
  cursor: 'pointer',
} as const

const chipBtnPrimaryStyle = {
  ...chipBtnStyle,
  background: 'var(--bg-blue-tint)',
  borderColor: '#bfdbfe',
  color: 'var(--text-blue-700)',
} as const

const footerSecondaryStyle = {
  padding: '0.5rem 0.85rem',
  borderRadius: 6,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-gray-800)',
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: 'pointer',
} as const

const footerPrimaryStyle = {
  padding: '0.5rem 0.95rem',
  borderRadius: 6,
  border: '1px solid #1d4ed8',
  background: '#2563eb',
  color: '#ffffff',
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: 'pointer',
} as const

// Header `Complete: [N] %` editor styles — small, calm, and visually paired with the
// existing close button to its right. The label is uppercase mini-caps so it reads
// as a field hint rather than competing with the stage title; the input row uses the
// same light card chrome the body's "Adjust stage" editor uses so the two surfaces
// feel related.
const headerPercentEditorStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: 2,
  flexShrink: 0,
  marginTop: 2,
} as const

const headerPercentLabelStyle = {
  fontSize: '0.625rem',
  color: 'var(--text-slate-600)',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
} as const

const headerPercentSavingStyle = {
  color: 'var(--text-faint)',
  fontWeight: 400,
  textTransform: 'none',
  letterSpacing: 0,
} as const

const headerPercentInputRowStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 2,
  background: 'var(--surface)',
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
  padding: '0.1rem 0.35rem',
} as const

const headerPercentInputStyle = {
  width: 36,
  padding: 0,
  fontSize: '0.875rem',
  textAlign: 'right',
  border: 'none',
  background: 'transparent',
  color: 'var(--text-slate-900)',
  outline: 'none',
  fontWeight: 600,
} as const

const headerPercentSuffixStyle = {
  fontSize: '0.875rem',
  color: 'var(--text-slate-600)',
  fontWeight: 600,
} as const

const headerPercentReadOnlyStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: 2,
  flexShrink: 0,
  marginTop: 2,
} as const

const headerPercentReadOnlyValueStyle = {
  fontSize: '0.875rem',
  color: 'var(--text-slate-900)',
  fontWeight: 600,
} as const
