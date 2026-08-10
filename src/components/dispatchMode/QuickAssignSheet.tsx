import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useJobFormModal } from '../../contexts/JobFormModalContext'
import { useToastContext } from '../../contexts/ToastContext'
import {
  ScheduleDispatchAssignJobPickerModal,
  type ScheduleDispatchAssignJobPickerRow,
} from '../schedule/ScheduleDispatchAssignJobPickerModal'
import {
  fetchJobsLedgerForScheduleDispatchHub,
  fetchUsersTabRosterForScheduleDispatchHub,
  fetchUserNamesForIds,
  formatScheduleDispatchHubJobTitle,
  sortJobPickerRowsFinishedLast,
  type ScheduleDispatchHubJobRow,
} from '../../lib/scheduleDispatchHub'
import {
  fetchJobSearchEvidence,
  jobSearchEvidenceModeForRole,
  type JobSearchEvidence,
} from '../../lib/jobSearchEvidence'
import {
  fetchDispatchSwimLanes,
  type DispatchSwimLanesData,
} from '../../lib/dispatchSwimLanes'
import {
  buildSwimLaneDisplaySections,
  filterSwimLaneSectionsByQuery,
  swimLaneAccentColor,
} from '../../lib/dispatchSwimLaneSections'
import { quickAssignDisabledReason } from '../../lib/dispatchQuickAssignDisabledReason'
import { compareJobsByCreatedAtDesc } from '../../lib/assignJobPickerOrder'
import { findJobsByNumber } from '../../lib/jobs/stagesJobNumberJump'
import {
  dispatchModeTwoWeekGrid,
  fetchDispatchModeDayBlocks,
  type DispatchModeAgendaBlock,
} from '../../lib/dispatchModeSchedule'
import {
  DISPATCH_ADD_BLOCK_SLOT_COUNT,
  dispatchMinutesToHHmm,
  dispatchMinutesToSlotIndex,
  dispatchSlotIndexToMinutes,
  formatBlockDurationMinutes,
  formatDispatchQuickTimeLabel,
  timeInputToMinutesSafe,
  timeInputToPg,
} from '../../lib/dispatchAddBlockTime'
import { DispatchAddBlockTimeRange } from '../schedule/DispatchAddBlockTimeRange'
import ManagePersonDayModal from './ManagePersonDayModal'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import {
  ribbonSpanPct,
  suggestCommonWindows,
  windowOverlapsBusy,
  type MinuteInterval,
} from '../../lib/quickAssignFreeWindows'
import {
  insertJobScheduleBlock,
  newJobScheduleSharedBlockGroupId,
} from '../../lib/jobScheduleBlocks'
import {
  denverCalendarDayKey,
  denverCalendarDaysBetweenInstantAndNow,
  formatDenverCalendarDayShort,
} from '../../utils/dateUtils'
import { buildServiceTypeTradePill } from '../../lib/serviceTypeTradePill'

/** Sunday-first, matching dispatchModeTwoWeekGrid (same row as the Schedule tab). */
const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

const chip = (active: boolean): CSSProperties => ({
  flexShrink: 0,
  padding: '0.3rem 0.75rem',
  fontSize: '0.8125rem',
  fontWeight: 600,
  border: active ? '1px solid #2563eb' : '1px solid var(--border-strong)',
  borderRadius: 999,
  background: active ? 'var(--bg-blue-tint)' : 'var(--surface)',
  color: active ? 'var(--text-blue-700)' : 'var(--text-700)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
})

function pickerSubline(r: ScheduleDispatchHubJobRow): string | undefined {
  const dt = (r.created_at ?? '').trim()
  let dateLabel = ''
  if (dt) {
    const d = new Date(dt)
    if (!Number.isNaN(d.getTime())) {
      dateLabel = `${denverCalendarDaysBetweenInstantAndNow(d.getTime())}d ${formatDenverCalendarDayShort(d.getTime())}`
    }
  }
  const address = (r.job_address ?? '').trim()
  if (dateLabel && address) return `${dateLabel} | ${address}`
  return dateLabel || address || undefined
}

type RosterPerson = { userId: string; displayName: string }

/**
 * Quick Assign: job → day → people (availability ribbons, swim-lane crews) →
 * time (common-free-window suggestions) → confirm. Writes plain
 * `job_schedule_blocks` rows, one per person, optionally linked as a crew via
 * a shared block group — the same shapes the People grid creates.
 */
export default function QuickAssignSheet({
  open,
  onClose,
  onScheduled,
  initialYmd,
  initialJob,
}: {
  open: boolean
  onClose: () => void
  /** Receives the day the blocks landed on, so callers can show that day. */
  onScheduled?: (scheduledYmd: string) => void
  /** Day the sheet starts on when opened (defaults to today). */
  initialYmd?: string
  /**
   * Job pre-picked by the caller (e.g. the Jobs Pipeline schedule quick
   * action): the sheet opens directly on the assign stage — day, people,
   * time — instead of the job picker. "Change job" still opens the picker.
   */
  initialJob?: ScheduleDispatchHubJobRow | null
}) {
  const { user: authUser, role } = useAuth()
  const { showToast } = useToastContext()
  const jobFormModal = useJobFormModal()

  const todayYmd = denverCalendarDayKey(Date.now())
  const [job, setJob] = useState<ScheduleDispatchHubJobRow | null>(null)
  const [jobPickerOpen, setJobPickerOpen] = useState(false)
  const [jobRows, setJobRows] = useState<ScheduleDispatchHubJobRow[]>([])
  const [pickerEvidence, setPickerEvidence] = useState<Map<string, JobSearchEvidence>>(() => new Map())
  const [jobSearch, setJobSearch] = useState('')
  const [jobNumberQuery, setJobNumberQuery] = useState('')
  const [selectedYmd, setSelectedYmd] = useState(todayYmd)
  const [roster, setRoster] = useState<RosterPerson[]>([])
  const [lanes, setLanes] = useState<DispatchSwimLanesData | null>(null)
  const [dayBlocks, setDayBlocks] = useState<DispatchModeAgendaBlock[]>([])
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [peopleSearch, setPeopleSearch] = useState('')
  const [windowSel, setWindowSel] = useState<MinuteInterval | null>(null)
  const [customOpen, setCustomOpen] = useState(false)
  const [customStart, setCustomStart] = useState('08:00')
  const [customEnd, setCustomEnd] = useState('16:00')
  const [linked, setLinked] = useState(true)
  const [instructions, setInstructions] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Long-press detail: who to show + label; null = closed. Lane headers only — person rows open the Manage day modal. */
  const [detail, setDetail] = useState<{ label: string; userIds: string[] } | null>(null)
  /** Manage day modal target (tap a person's name); null = closed. */
  const [managePerson, setManagePerson] = useState<{ userId: string; displayName: string } | null>(null)
  /** Bumped by Manage day mutations so the ribbons/free windows refetch. */
  const [dayBlocksReloadKey, setDayBlocksReloadKey] = useState(0)
  const pressStartRef = useRef<number | null>(null)
  const longPressFiredRef = useRef(false)

  // Long-press opens ON RELEASE (>=450ms held): opening mid-hold would put the
  // detail overlay under the pointer and the release-click would hit it.
  // `action` overrides the default read-only detail overlay — person rows pass
  // the Manage day modal so both press styles land on the same surface.
  const longPressHandlers = (label: string, userIds: string[], action?: () => void) => ({
    onPointerDown: () => {
      longPressFiredRef.current = false
      pressStartRef.current = Date.now()
    },
    onPointerUp: () => {
      const start = pressStartRef.current
      pressStartRef.current = null
      if (start != null && Date.now() - start >= 450) {
        longPressFiredRef.current = true
        if (action) action()
        else setDetail({ label, userIds })
      }
    },
    onPointerLeave: () => {
      pressStartRef.current = null
    },
    // Mobile: scrolling or a native gesture mid-hold fires pointercancel (no
    // pointerup) — clear the press so a later tap can't read a stale start.
    onPointerCancel: () => {
      pressStartRef.current = null
    },
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
  })

  /** True once per long-press: the click that follows it must not toggle. */
  const consumeLongPress = () => {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false
      return true
    }
    return false
  }

  // Reset per open; the job picker starts the flow unless the caller
  // pre-picked a job (initialJob), which lands straight on the assign stage.
  useEffect(() => {
    if (!open) return
    setJob(initialJob ?? null)
    setJobPickerOpen(initialJob == null)
    setManagePerson(null)
    setJobSearch('')
    setJobNumberQuery('')
    setSelectedYmd(initialYmd ?? todayYmd)
    setSelected(new Set())
    setPeopleSearch('')
    setWindowSel(null)
    setCustomOpen(false)
    setLinked(true)
    setInstructions('')
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      const [jobsRes, rosterRes, lanesRes] = await Promise.all([
        fetchJobsLedgerForScheduleDispatchHub(),
        fetchUsersTabRosterForScheduleDispatchHub(role === 'dev'),
        fetchDispatchSwimLanes(),
      ])
      if (cancelled) return
      setJobRows(jobsRes.data)
      const ids = rosterRes.data.map((r) => r.id)
      const { data: names } = await fetchUserNamesForIds(ids)
      if (cancelled) return
      setRoster(
        ids
          .map((id) => ({ userId: id, displayName: names.get(id) ?? 'Unknown' }))
          .sort((a, b) => a.displayName.localeCompare(b.displayName)),
      )
      setLanes(lanesRes.data)
    })()
    return () => {
      cancelled = true
    }
  }, [open, role])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void fetchDispatchModeDayBlocks(selectedYmd).then(({ data }) => {
      if (!cancelled) setDayBlocks(data)
    })
    return () => {
      cancelled = true
    }
  }, [open, selectedYmd, dayBlocksReloadKey])

  const busyByUser = useMemo(() => {
    const m = new Map<string, MinuteInterval[]>()
    for (const b of dayBlocks) {
      const list = m.get(b.assigneeUserId) ?? []
      list.push({
        startMin: timeInputToMinutesSafe(b.timeStart),
        endMin: timeInputToMinutesSafe(b.timeEnd),
      })
      m.set(b.assigneeUserId, list)
    }
    return m
  }, [dayBlocks])

  const sections = useMemo(() => {
    if (!lanes) return [{ laneId: null, label: '', people: roster }]
    return buildSwimLaneDisplaySections(lanes, roster)
  }, [lanes, roster])

  /** Sections narrowed by the people/teams search (team-name hit keeps the whole team). */
  const visibleSections = useMemo(
    () => filterSwimLaneSectionsByQuery(sections, peopleSearch),
    [sections, peopleSearch],
  )

  /* --- Keyboard flow: day strip and people list are each ONE Tab stop
     (roving tabindex); arrow keys move inside the group, Space/Enter selects.
     Tab then continues: search → people → time → instructions → confirm. --- */
  const dayStripRef = useRef<HTMLDivElement | null>(null)
  const peopleListRef = useRef<HTMLDivElement | null>(null)
  /** Roving key (`lane:<id>` / `person:<id>`) that owns the people group's tab stop. */
  const [peopleFocusKey, setPeopleFocusKey] = useState<string | null>(null)

  /** Ordered roving keys currently rendered — the fallback when the remembered one filters away. */
  const peopleRovingKeys = useMemo(() => {
    const keys: string[] = []
    for (const sec of visibleSections) {
      if (sec.label) keys.push(`lane:${sec.laneId ?? 'rest'}`)
      for (const p of sec.people) keys.push(`person:${p.userId}`)
    }
    return keys
  }, [visibleSections])
  const peopleTabKey =
    peopleFocusKey != null && peopleRovingKeys.includes(peopleFocusKey)
      ? peopleFocusKey
      : (peopleRovingKeys[0] ?? null)

  const onDayStripKeyDown = (e: { key: string; preventDefault: () => void }) => {
    const delta =
      e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' ? 7 : e.key === 'ArrowUp' ? -7 : 0
    if (delta === 0) return
    e.preventDefault()
    const flat = weeks.flat()
    const idx = flat.findIndex((d) => d.ymd === selectedYmd)
    const next = flat[Math.min(flat.length - 1, Math.max(0, (idx < 0 ? 0 : idx) + delta))]
    if (!next || next.ymd === selectedYmd) return
    setSelectedYmd(next.ymd)
    setWindowSel(null)
    dayStripRef.current?.querySelector<HTMLButtonElement>(`[data-ymd="${next.ymd}"]`)?.focus()
  }

  const onPeopleListKeyDown = (e: { key: string; preventDefault: () => void }) => {
    const delta =
      e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0
    if (delta === 0) return
    e.preventDefault()
    const items = [...(peopleListRef.current?.querySelectorAll<HTMLButtonElement>('[data-roving]') ?? [])]
    const cur = items.findIndex((el) => el === document.activeElement)
    items[Math.min(items.length - 1, Math.max(0, (cur < 0 ? 0 : cur) + delta))]?.focus()
  }

  const suggestions = useMemo(() => {
    if (selected.size === 0) return []
    return suggestCommonWindows([...selected].map((id) => busyByUser.get(id) ?? []))
  }, [selected, busyByUser])

  const effectiveWindow: MinuteInterval | null = useMemo(() => {
    if (customOpen) {
      const s = timeInputToMinutesSafe(customStart)
      const e = timeInputToMinutesSafe(customEnd)
      return e > s ? { startMin: s, endMin: e } : null
    }
    return windowSel
  }, [customOpen, customStart, customEnd, windowSel])

  const conflicts = useMemo(() => {
    if (!effectiveWindow) return new Set<string>()
    const out = new Set<string>()
    for (const id of selected) {
      if (windowOverlapsBusy(effectiveWindow, busyByUser.get(id) ?? [])) out.add(id)
    }
    return out
  }, [effectiveWindow, selected, busyByUser])

  // Anchor the day strip where the caller is looking (falls back to today) so
  // the sheet's starting day is always visible/selectable in its own strip.
  const weeks = useMemo(
    () => dispatchModeTwoWeekGrid(initialYmd ?? todayYmd),
    [initialYmd, todayYmd],
  )

  const togglePerson = (id: string) => {
    if (consumeLongPress()) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setWindowSel(null)
  }

  const toggleLane = (memberIds: string[]) => {
    if (consumeLongPress()) return
    setSelected((prev) => {
      const next = new Set(prev)
      const allIn = memberIds.every((id) => next.has(id))
      for (const id of memberIds) {
        if (allIn) next.delete(id)
        else next.add(id)
      }
      return next
    })
    setWindowSel(null)
  }

  const windowLabel = (w: MinuteInterval) =>
    `${formatDispatchQuickTimeLabel(dispatchMinutesToHHmm(w.startMin))}–${formatDispatchQuickTimeLabel(dispatchMinutesToHHmm(w.endMin))}`

  const canSchedule = job != null && selected.size > 0 && effectiveWindow != null && !saving

  const handleSchedule = useCallback(async () => {
    if (!job || !effectiveWindow || selected.size === 0 || !authUser?.id) return
    setSaving(true)
    setError(null)
    const ids = [...selected]
    const groupId = linked && ids.length > 1 ? newJobScheduleSharedBlockGroupId() : null
    const ts = timeInputToPg(dispatchMinutesToHHmm(effectiveWindow.startMin))
    const te = timeInputToPg(dispatchMinutesToHHmm(effectiveWindow.endMin))
    let inserted = 0
    for (const uid of ids) {
      const { error: insErr } = await insertJobScheduleBlock({
        job_id: job.id,
        assignee_user_id: uid,
        work_date: selectedYmd,
        time_start: ts,
        time_end: te,
        note: instructions.trim() || null,
        ...(groupId ? { shared_block_group_id: groupId } : {}),
      })
      if (insErr) {
        setSaving(false)
        setError(`After ${inserted} of ${ids.length}: ${insErr}`)
        return
      }
      inserted++
    }
    setSaving(false)
    showToast(
      `Scheduled ${inserted} ${inserted === 1 ? 'person' : 'people'} on ${formatScheduleDispatchHubJobTitle(job.hcp_number, job.job_name, job.click_number)}${groupId ? ' (linked)' : ''}.`,
      'success',
    )
    onScheduled?.(selectedYmd)
    onClose()
  }, [job, effectiveWindow, selected, authUser?.id, linked, selectedYmd, instructions, showToast, onScheduled, onClose])

  /** Standard job-picker rows (hub parity): status chip + finished-last demotion + evidence rail. */
  const pickerRows: ScheduleDispatchAssignJobPickerRow[] = useMemo(() => {
    const digits = jobNumberQuery.replace(/\D/g, '')
    const q = jobSearch.trim().toLowerCase()
    // "#" mode is exclusive and keeps the matcher's exact-then-prefix tier order.
    const base =
      digits !== ''
        ? findJobsByNumber(jobRows, digits)
        : jobRows
            .filter(
              (r) =>
                !q ||
                (r.hcp_number ?? '').toLowerCase().includes(q) ||
                (r.job_name ?? '').toLowerCase().includes(q) ||
                (r.job_address ?? '').toLowerCase().includes(q) ||
                (r.customer_name ?? '').toLowerCase().includes(q),
            )
            .sort(compareJobsByCreatedAtDesc)
    return sortJobPickerRowsFinishedLast(base.slice(0, 60)).map((r) => ({
      id: r.id,
      displayTitle: formatScheduleDispatchHubJobTitle(r.hcp_number, r.job_name, r.click_number),
      serviceTypeName: r.service_type?.name ?? null,
      subline: pickerSubline(r),
      status: r.status ?? null,
      evidence: pickerEvidence.get(r.id) ?? null,
    }))
  }, [jobRows, jobSearch, jobNumberQuery, pickerEvidence])

  /** Enrich visible picker rows with money-rail evidence — short lists only, debounced, accumulating, failure-silent (hub pattern). */
  useEffect(() => {
    if (!open || !jobPickerOpen) return
    if (pickerRows.length === 0 || pickerRows.length > 30) return
    const missing = pickerRows.filter((r) => !pickerEvidence.has(r.id)).map((r) => r.id)
    if (missing.length === 0) return
    let cancelled = false
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const got = await fetchJobSearchEvidence(missing, jobSearchEvidenceModeForRole(role))
          if (cancelled) return
          setPickerEvidence((prev) => {
            const next = new Map(prev)
            for (const [k, v] of got) next.set(k, v)
            return next
          })
        } catch {
          // Rows simply render without the rail.
        }
      })()
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [open, jobPickerOpen, pickerRows, pickerEvidence, role])

  if (!open) return null

  const jobPill = job ? buildServiceTypeTradePill(job.service_type?.name) : null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 1004,
      }}
      onClick={() => {
        if (!saving) onClose()
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-assign-title"
        style={{
          background: 'var(--surface)',
          borderRadius: '14px 14px 0 0',
          width: '100%',
          maxWidth: 640,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem',
          padding: '0.85rem 0.85rem calc(0.85rem + env(safe-area-inset-bottom))',
          boxShadow: '0 -8px 30px rgba(0,0,0,0.25)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 id="quick-assign-title" style={{ margin: 0, fontSize: '1rem', color: 'var(--text-strong)' }}>
              Assign work{' '}
              <span style={{ fontSize: '0.6875rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                (tip: long press to see details)
              </span>
            </h2>
            {job ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, marginTop: 2 }}>
                {jobPill ? (
                  <span style={{ ...jobPill.style, marginTop: 0, flexShrink: 0 }}>{jobPill.label}</span>
                ) : null}
                <span
                  style={{
                    fontSize: '0.8125rem',
                    color: 'var(--text-600)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatScheduleDispatchHubJobTitle(job.hcp_number, job.job_name, job.click_number)}
                  {(job.job_address ?? '').trim() ? ` — ${(job.job_address ?? '').trim()}` : ''}
                </span>
              </div>
            ) : null}
          </div>
          {job ? (
            <button type="button" style={chip(false)} onClick={() => setJobPickerOpen(true)}>
              Change job
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close assign work"
            style={{ ...chip(false), padding: '0.3rem 0.6rem' }}
          >
            ✕
          </button>
        </div>

        {job ? (
          <>
            {/* Day strip */}
            <div
              ref={dayStripRef}
              role="group"
              aria-label="Pick a day — arrow keys move, Enter selects"
              onKeyDown={onDayStripKeyDown}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', gap: 2 }}
            >
              {WEEKDAY_LETTERS.map((w, i) => (
                <span
                  key={`${w}-${i}`}
                  aria-hidden="true"
                  style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', padding: '0.1rem 0' }}
                >
                  {w}
                </span>
              ))}
              {weeks.flat().map((day, i, flat) => {
                const sel = day.ymd === selectedYmd
                const stripHasSelection = flat.some((d) => d.ymd === selectedYmd)
                return (
                  <button
                    key={day.ymd}
                    type="button"
                    data-ymd={day.ymd}
                    tabIndex={(stripHasSelection ? sel : i === 0) ? 0 : -1}
                    aria-pressed={sel}
                    aria-label={`Assign on ${day.ymd}`}
                    onClick={() => {
                      setSelectedYmd(day.ymd)
                      setWindowSel(null)
                    }}
                    style={{
                      border: 'none',
                      background: sel ? '#2563eb' : 'none',
                      color: sel ? '#fff' : day.ymd === todayYmd ? 'var(--text-link)' : 'var(--text-700)',
                      borderRadius: 8,
                      padding: '0.3rem 0',
                      fontSize: '0.8125rem',
                      fontWeight: sel || day.ymd === todayYmd ? 700 : 400,
                      cursor: 'pointer',
                    }}
                  >
                    {day.dayNum}
                  </button>
                )
              })}
            </div>

            {/* Teams & people search */}
            <input
              type="search"
              value={peopleSearch}
              onChange={(e) => setPeopleSearch(e.target.value)}
              placeholder="Search teams and people…"
              aria-label="Search teams and people"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '0.45rem 0.75rem',
                fontSize: '0.875rem',
                border: '1px solid var(--border-strong)',
                borderRadius: 999,
                background: 'var(--surface)',
                color: 'var(--text-strong)',
              }}
            />

            {/* People with ribbons */}
            <div
              ref={peopleListRef}
              role="group"
              aria-label="Pick people — arrow keys move, Space or Enter selects"
              onKeyDown={onPeopleListKeyDown}
              style={{ overflowY: 'auto', flex: 1, minHeight: 120, display: 'flex', flexDirection: 'column', gap: 4 }}
            >
              {visibleSections.length === 0 ? (
                <p style={{ margin: 0, padding: '0.75rem 0.2rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  No teams or people match “{peopleSearch.trim()}”.
                </p>
              ) : null}
              {visibleSections.map((sec) => {
                const memberIds = sec.people.map((p) => p.userId)
                const allIn = memberIds.length > 0 && memberIds.every((id) => selected.has(id))
                const accent = swimLaneAccentColor(sec.laneId)
                return (
                  <div
                    key={sec.laneId ?? 'rest'}
                    style={
                      sec.label
                        ? {
                            borderLeft: `3px solid ${accent ?? 'var(--border-strong)'}`,
                            borderRadius: 0,
                            paddingLeft: 7,
                            marginBottom: 2,
                          }
                        : undefined
                    }
                  >
                    {sec.label ? (
                      <button
                        type="button"
                        data-roving
                        tabIndex={peopleTabKey === `lane:${sec.laneId ?? 'rest'}` ? 0 : -1}
                        onFocus={() => setPeopleFocusKey(`lane:${sec.laneId ?? 'rest'}`)}
                        onClick={() => toggleLane(memberIds)}
                        {...longPressHandlers(sec.label, memberIds)}
                        aria-pressed={allIn}
                        aria-label={`Select everyone in ${sec.label}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 6,
                          width: '100%',
                          padding: '0.3rem 0.5rem',
                          marginBottom: 4,
                          border: 'none',
                          borderRadius: 6,
                          background: allIn ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: accent ?? 'var(--text-muted)',
                          textAlign: 'left',
                          WebkitUserSelect: 'none',
                          userSelect: 'none',
                          WebkitTouchCallout: 'none',
                        }}
                      >
                        <span>{sec.label}</span>
                        <span
                          style={{
                            fontWeight: 600,
                            fontVariantNumeric: 'tabular-nums',
                            color: allIn ? 'var(--text-blue-700)' : 'var(--text-muted)',
                          }}
                        >
                          {allIn ? '✓ crew selected' : sec.people.length}
                        </span>
                      </button>
                    ) : null}
                    {sec.people.map((p) => {
                      const isSel = selected.has(p.userId)
                      const busy = busyByUser.get(p.userId) ?? []
                      const conflict = isSel && conflicts.has(p.userId)
                      return (
                        <div
                          key={p.userId}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            width: '100%',
                            padding: '0.35rem 0.45rem',
                            marginBottom: 3,
                            border: conflict
                              ? '1px solid #d97706'
                              : isSel
                                ? '1px solid #2563eb'
                                : '1px solid var(--border)',
                            borderRadius: 8,
                            background: conflict
                              ? 'var(--bg-amber-tint)'
                              : isSel
                                ? 'var(--bg-blue-tint)'
                                : 'var(--surface)',
                            boxSizing: 'border-box',
                          }}
                        >
                          {/* Name → Manage day (mouse/touch target; keyboard flow stays on the select button). */}
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => setManagePerson({ userId: p.userId, displayName: p.displayName })}
                            title={`Manage ${p.displayName}'s schedule for this day`}
                            aria-label={`Manage ${p.displayName}'s schedule for this day`}
                            style={{
                              width: 78,
                              flexShrink: 0,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              padding: 0,
                              border: 'none',
                              background: 'none',
                              cursor: 'pointer',
                              textAlign: 'left',
                              font: 'inherit',
                            }}
                          >
                            <span
                              style={{
                                minWidth: 0,
                                fontSize: '0.8125rem',
                                fontWeight: isSel ? 700 : 500,
                                color: 'var(--text-strong)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                borderBottom: '1px dashed var(--border-strong)',
                              }}
                            >
                              {p.displayName}
                            </span>
                            <span aria-hidden style={{ flexShrink: 0, fontSize: '0.6875rem', color: 'var(--text-link)' }}>
                              ›
                            </span>
                          </button>
                          <button
                            type="button"
                            data-roving
                            tabIndex={peopleTabKey === `person:${p.userId}` ? 0 : -1}
                            onFocus={() => setPeopleFocusKey(`person:${p.userId}`)}
                            onClick={() => togglePerson(p.userId)}
                            {...longPressHandlers(p.displayName, [p.userId], () =>
                              setManagePerson({ userId: p.userId, displayName: p.displayName }),
                            )}
                            aria-pressed={isSel}
                            aria-label={`${isSel ? 'Deselect' : 'Select'} ${p.displayName}${conflict ? ' (time conflict)' : ''}`}
                            style={{
                              flex: 1,
                              minWidth: 0,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: 0,
                              border: 'none',
                              background: 'none',
                              cursor: 'pointer',
                              textAlign: 'left',
                              WebkitUserSelect: 'none',
                              userSelect: 'none',
                              WebkitTouchCallout: 'none',
                            }}
                          >
                          <span
                            aria-hidden="true"
                            style={{
                              flex: 1,
                              height: 14,
                              background: 'var(--bg-subtle)',
                              borderRadius: 3,
                              position: 'relative',
                              overflow: 'hidden',
                            }}
                          >
                            {busy.map((b, i) => {
                              const span = ribbonSpanPct(b)
                              return span ? (
                                <span
                                  key={i}
                                  style={{
                                    position: 'absolute',
                                    left: `${span.leftPct}%`,
                                    width: `${span.widthPct}%`,
                                    top: 0,
                                    bottom: 0,
                                    background: 'var(--bg-blue-200)',
                                  }}
                                />
                              ) : null
                            })}
                            {isSel && effectiveWindow
                              ? (() => {
                                  const span = ribbonSpanPct(effectiveWindow)
                                  return span ? (
                                    <span
                                      style={{
                                        position: 'absolute',
                                        left: `${span.leftPct}%`,
                                        width: `${span.widthPct}%`,
                                        top: 0,
                                        bottom: 0,
                                        border: `2px dashed ${conflict ? '#d97706' : '#16a34a'}`,
                                        borderRadius: 3,
                                        boxSizing: 'border-box',
                                      }}
                                    />
                                  ) : null
                                })()
                              : null}
                          </span>
                          {conflict ? (
                            <span style={{ flexShrink: 0, fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-amber-700)' }}>
                              overlap
                            </span>
                          ) : null}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>

            {/* Time suggestions */}
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', alignItems: 'center' }}>
              {selected.size === 0 ? (
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Pick people to see when everyone is free.
                </span>
              ) : (
                <>
                  {suggestions.map((w) => {
                    const active = !customOpen && windowSel != null && windowSel.startMin === w.startMin && windowSel.endMin === w.endMin
                    return (
                      <button
                        key={`${w.startMin}-${w.endMin}`}
                        type="button"
                        aria-pressed={active}
                        style={{
                          ...chip(active),
                          border: active ? '1px solid #16a34a' : '1px solid var(--border-strong)',
                          background: active ? 'var(--bg-green-100)' : 'var(--surface)',
                          color: active ? 'var(--text-green-600)' : 'var(--text-700)',
                        }}
                        onClick={() => {
                          setCustomOpen(false)
                          setWindowSel(w)
                        }}
                      >
                        {windowLabel(w)} · all free
                      </button>
                    )
                  })}
                  {suggestions.length === 0 ? (
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                      No shared free window —
                    </span>
                  ) : null}
                  <button
                    type="button"
                    aria-pressed={customOpen}
                    style={chip(customOpen)}
                    onClick={() => setCustomOpen((v) => !v)}
                  >
                    Custom…
                  </button>
                </>
              )}
            </div>
            {/* Two-dot range bar (6 AM–8 PM), mirroring the Add/Edit block modals.
                Dragging a dot switches the window to Custom with that value, so the
                bar, the chips, and the time inputs stay in sync. */}
            {(() => {
              const sliderWindow = effectiveWindow ?? { startMin: timeInputToMinutesSafe('08:00'), endMin: timeInputToMinutesSafe('16:00') }
              const sliderTrim = {
                loSlotIndex: dispatchMinutesToSlotIndex(timeInputToMinutesSafe('06:00')),
                hiSlotIndex: dispatchMinutesToSlotIndex(timeInputToMinutesSafe('20:00')),
              }
              const applySlot = (which: 'start' | 'end') => (slotIndex: number) => {
                const hhmm = dispatchMinutesToHHmm(dispatchSlotIndexToMinutes(slotIndex))
                if (!customOpen) {
                  setCustomStart(dispatchMinutesToHHmm(sliderWindow.startMin))
                  setCustomEnd(dispatchMinutesToHHmm(sliderWindow.endMin))
                  setCustomOpen(true)
                }
                if (which === 'start') setCustomStart(hhmm)
                else setCustomEnd(hhmm)
              }
              return (
                <div style={{ padding: '0.15rem 0.5rem 0' }}>
                  <DispatchAddBlockTimeRange
                    slotCount={DISPATCH_ADD_BLOCK_SLOT_COUNT}
                    startSlotIndex={dispatchMinutesToSlotIndex(sliderWindow.startMin)}
                    endSlotIndex={dispatchMinutesToSlotIndex(sliderWindow.endMin)}
                    onStartChange={applySlot('start')}
                    onEndChange={applySlot('end')}
                    formatAriaValue={(i) =>
                      formatDispatchQuickTimeLabel(dispatchMinutesToHHmm(dispatchSlotIndexToMinutes(i)))
                    }
                    groupAriaLabel="Scheduled window, 30-minute steps from 6:00 AM to 8:00 PM Central"
                    railTrimWindow={sliderTrim}
                  />
                </div>
              )
            })()}

            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value.slice(0, 500))}
              rows={2}
              placeholder="Job instructions (gate codes, scope, arrival)…"
              aria-label="Job instructions"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '0.45rem 0.55rem',
                fontSize: '0.875rem',
                border: '1px solid var(--border-strong)',
                borderRadius: 8,
                resize: 'none',
                fontFamily: 'inherit',
              }}
            />

            {error ? (
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>{error}</p>
            ) : null}

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.8125rem',
                  color: 'var(--text-700)',
                  flexShrink: 0,
                }}
              >
                <input
                  type="checkbox"
                  checked={linked}
                  disabled={selected.size < 2}
                  onChange={(e) => setLinked(e.target.checked)}
                  aria-label="Link the crew's blocks so time and instructions stay in sync"
                />
                Linked crew
              </label>
              <button
                type="button"
                // Not `disabled` (v2.1486): a disabled button swallows the tap
                // silently. Keep it tappable and toast WHY it can't schedule
                // yet; aria-disabled keeps the state honest for assistive tech.
                aria-disabled={!canSchedule}
                onClick={() => {
                  if (canSchedule) {
                    void handleSchedule()
                    return
                  }
                  const reason = quickAssignDisabledReason({
                    hasJob: job != null,
                    peopleCount: selected.size,
                    hasWindow: effectiveWindow != null,
                    saving,
                  })
                  if (reason) showToast(reason, 'info', 4500)
                }}
                style={{
                  flex: 1,
                  padding: '0.6rem',
                  fontSize: '0.9375rem',
                  fontWeight: 700,
                  border: 'none',
                  borderRadius: 10,
                  background: canSchedule ? '#2563eb' : 'var(--bg-muted)',
                  color: canSchedule ? '#fff' : 'var(--text-muted)',
                  cursor: canSchedule ? 'pointer' : 'not-allowed',
                }}
              >
                {saving ? (
                  'Scheduling…'
                ) : effectiveWindow && selected.size > 0 ? (
                  <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1.3 }}>
                    <span>{`Schedule ${selected.size} ${selected.size === 1 ? 'person' : 'people'}`}</span>
                    <span style={{ fontWeight: 500 }}>{windowLabel(effectiveWindow)}</span>
                  </span>
                ) : (
                  'Pick people and a time'
                )}
              </button>
            </div>
          </>
        ) : (
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Pick a job to start.</p>
        )}
      </div>

      <ScheduleDispatchAssignJobPickerModal
        open={jobPickerOpen}
        onClose={() => {
          setJobPickerOpen(false)
          if (!job) onClose()
        }}
        onCreateNewJob={
          jobFormModal
            ? () =>
                jobFormModal.openNewJob({
                  onCreatedJobId: (newJobId) => {
                    // Refetch the ledger so the just-created job exists in our
                    // rows, auto-pick it, and move the user to the next step.
                    void fetchJobsLedgerForScheduleDispatchHub().then(({ data }) => {
                      setJobRows(data)
                      const created = data.find((r) => r.id === newJobId) ?? null
                      if (created) {
                        setJob(created)
                        setJobPickerOpen(false)
                      }
                    })
                  },
                })
            : undefined
        }
        subtitle={null}
        jobRows={pickerRows}
        evidenceMode={jobSearchEvidenceModeForRole(role)}
        searchValue={jobSearch}
        onSearchChange={setJobSearch}
        numberQuery={jobNumberQuery}
        onNumberQueryChange={setJobNumberQuery}
        searchPlaceholder="Search HCP, job, address, or customer"
        onPickJob={(id) => {
          const found = jobRows.find((r) => r.id === id) ?? null
          setJob(found)
          setJobPickerOpen(false)
        }}
      />
      {detail ? (
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
            setDetail(null)
          }}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Schedule details for ${detail.label}`}
            style={{
              background: 'var(--surface)',
              borderRadius: 12,
              width: '96%',
              maxWidth: 480,
              maxHeight: '80vh',
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
              <h3 style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--text-strong)' }}>
                {detail.label} — {selectedYmd}
              </h3>
              <button
                type="button"
                onClick={() => setDetail(null)}
                aria-label="Close schedule details"
                style={{ ...chip(false), padding: '0.25rem 0.6rem' }}
              >
                ✕
              </button>
            </div>
            {detail.userIds.map((uid) => {
              const person = roster.find((p) => p.userId === uid)
              const personBlocks = dayBlocks
                .filter((b) => b.assigneeUserId === uid)
                .sort((a, b) => a.timeStart.localeCompare(b.timeStart))
              return (
                <div key={uid}>
                  {detail.userIds.length > 1 ? (
                    <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-blue-700)', margin: '0.25rem 0' }}>
                      {person?.displayName ?? 'Unknown'}
                    </div>
                  ) : null}
                  {personBlocks.length === 0 ? (
                    <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      Nothing scheduled this day.
                    </p>
                  ) : (
                    personBlocks.map((b) => {
                      const pill = buildServiceTypeTradePill(b.serviceTypeName)
                      const num = effectiveJobLedgerNumber(b.hcpNumber, b.clickNumber) || '—'
                      return (
                        <div
                          key={b.id}
                          style={{
                            display: 'flex',
                            gap: '0.6rem',
                            padding: '0.45rem 0',
                            borderBottom: '1px solid var(--border)',
                            alignItems: 'flex-start',
                          }}
                        >
                          <span style={{ flexShrink: 0, width: 66, fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)' }}>
                            {formatDispatchQuickTimeLabel(b.timeStart)}
                            <span style={{ display: 'block', fontWeight: 400, color: 'var(--text-faint)', fontSize: '0.75rem' }}>
                              {formatBlockDurationMinutes(
                                Math.max(0, timeInputToMinutesSafe(b.timeEnd) - timeInputToMinutesSafe(b.timeStart)),
                              )}
                            </span>
                          </span>
                          <span style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                              {pill ? (
                                <span style={{ ...pill.style, marginTop: 0, flexShrink: 0 }}>{pill.label}</span>
                              ) : null}
                              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {num} · {b.jobName}
                              </span>
                            </span>
                            {b.customerName ? (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-600)' }}>{b.customerName}</span>
                            ) : null}
                            {b.jobAddress ? (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.jobAddress}</span>
                            ) : null}
                          </span>
                        </div>
                      )
                    })
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
      {managePerson ? (
        <ManagePersonDayModal
          open
          personUserId={managePerson.userId}
          personName={managePerson.displayName}
          initialYmd={selectedYmd}
          onClose={() => setManagePerson(null)}
          onChanged={() => setDayBlocksReloadKey((k) => k + 1)}
          onPickForAssignment={(uid) => {
            setSelected((prev) => {
              const next = new Set(prev)
              next.add(uid)
              return next
            })
            setWindowSel(null)
            setManagePerson(null)
          }}
          pickedForAssignment={selected.has(managePerson.userId)}
        />
      ) : null}
    </div>
  )
}
