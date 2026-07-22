import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useAuth } from '../../hooks/useAuth'
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
  type ScheduleDispatchHubJobRow,
} from '../../lib/scheduleDispatchHub'
import {
  fetchDispatchSwimLanes,
  type DispatchSwimLanesData,
} from '../../lib/dispatchSwimLanes'
import { buildSwimLaneDisplaySections } from '../../lib/dispatchSwimLaneSections'
import {
  dispatchModeTwoWeekGrid,
  fetchDispatchModeDayBlocks,
  type DispatchModeAgendaBlock,
} from '../../lib/dispatchModeSchedule'
import {
  dispatchMinutesToHHmm,
  formatDispatchQuickTimeLabel,
  timeInputToMinutesSafe,
  timeInputToPg,
} from '../../lib/dispatchAddBlockTime'
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
}: {
  open: boolean
  onClose: () => void
  onScheduled?: () => void
}) {
  const { user: authUser, role } = useAuth()
  const { showToast } = useToastContext()

  const todayYmd = denverCalendarDayKey(Date.now())
  const [job, setJob] = useState<ScheduleDispatchHubJobRow | null>(null)
  const [jobPickerOpen, setJobPickerOpen] = useState(false)
  const [jobRows, setJobRows] = useState<ScheduleDispatchHubJobRow[]>([])
  const [jobSearch, setJobSearch] = useState('')
  const [selectedYmd, setSelectedYmd] = useState(todayYmd)
  const [roster, setRoster] = useState<RosterPerson[]>([])
  const [lanes, setLanes] = useState<DispatchSwimLanesData | null>(null)
  const [dayBlocks, setDayBlocks] = useState<DispatchModeAgendaBlock[]>([])
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [windowSel, setWindowSel] = useState<MinuteInterval | null>(null)
  const [customOpen, setCustomOpen] = useState(false)
  const [customStart, setCustomStart] = useState('08:00')
  const [customEnd, setCustomEnd] = useState('16:00')
  const [linked, setLinked] = useState(true)
  const [instructions, setInstructions] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset per open; job picker starts the flow.
  useEffect(() => {
    if (!open) return
    setJob(null)
    setJobPickerOpen(true)
    setJobSearch('')
    setSelectedYmd(todayYmd)
    setSelected(new Set())
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
  }, [open, selectedYmd])

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

  const weeks = useMemo(() => dispatchModeTwoWeekGrid(todayYmd), [todayYmd])

  const togglePerson = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setWindowSel(null)
  }

  const toggleLane = (memberIds: string[]) => {
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
    onScheduled?.()
    onClose()
  }, [job, effectiveWindow, selected, authUser?.id, linked, selectedYmd, instructions, showToast, onScheduled, onClose])

  if (!open) return null

  const pickerRows: ScheduleDispatchAssignJobPickerRow[] = (() => {
    const q = jobSearch.trim().toLowerCase()
    return jobRows
      .filter(
        (r) =>
          !q ||
          (r.hcp_number ?? '').toLowerCase().includes(q) ||
          (r.job_name ?? '').toLowerCase().includes(q) ||
          (r.job_address ?? '').toLowerCase().includes(q) ||
          (r.customer_name ?? '').toLowerCase().includes(q),
      )
      .slice(0, 60)
      .map((r) => ({
        id: r.id,
        displayTitle: formatScheduleDispatchHubJobTitle(r.hcp_number, r.job_name, r.click_number),
        serviceTypeName: r.service_type?.name ?? null,
        subline: pickerSubline(r),
      }))
  })()

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
              Assign work
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', gap: 2 }}>
              {weeks.flat().map((day) => {
                const sel = day.ymd === selectedYmd
                return (
                  <button
                    key={day.ymd}
                    type="button"
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

            {/* People with ribbons */}
            <div style={{ overflowY: 'auto', flex: 1, minHeight: 120, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {sections.map((sec) => {
                const memberIds = sec.people.map((p) => p.userId)
                const allIn = memberIds.length > 0 && memberIds.every((id) => selected.has(id))
                return (
                  <div key={sec.laneId ?? 'rest'}>
                    {sec.label ? (
                      <button
                        type="button"
                        onClick={() => toggleLane(memberIds)}
                        aria-pressed={allIn}
                        aria-label={`Select everyone in ${sec.label}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          width: '100%',
                          padding: '0.3rem 0.2rem 0.15rem',
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: allIn ? 'var(--text-blue-700)' : 'var(--text-muted)',
                          textAlign: 'left',
                        }}
                      >
                        {sec.label}
                        <span style={{ fontWeight: 400 }}>{allIn ? '— crew selected' : ''}</span>
                      </button>
                    ) : null}
                    {sec.people.map((p) => {
                      const isSel = selected.has(p.userId)
                      const busy = busyByUser.get(p.userId) ?? []
                      const conflict = isSel && conflicts.has(p.userId)
                      return (
                        <button
                          key={p.userId}
                          type="button"
                          onClick={() => togglePerson(p.userId)}
                          aria-pressed={isSel}
                          aria-label={`${isSel ? 'Deselect' : 'Select'} ${p.displayName}${conflict ? ' (time conflict)' : ''}`}
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
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <span
                            style={{
                              width: 78,
                              flexShrink: 0,
                              fontSize: '0.8125rem',
                              fontWeight: isSel ? 700 : 500,
                              color: 'var(--text-strong)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {p.displayName}
                          </span>
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
            {customOpen ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="time"
                  value={customStart}
                  step={900}
                  aria-label="Start time"
                  onChange={(e) => setCustomStart(e.target.value)}
                  style={{ padding: '0.3rem', fontSize: '0.875rem' }}
                />
                <span style={{ color: 'var(--text-muted)' }}>–</span>
                <input
                  type="time"
                  value={customEnd}
                  step={900}
                  aria-label="End time"
                  onChange={(e) => setCustomEnd(e.target.value)}
                  style={{ padding: '0.3rem', fontSize: '0.875rem' }}
                />
              </div>
            ) : null}

            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value.slice(0, 500))}
              rows={2}
              placeholder="Job instructions (gate codes, scope, arrival details)…"
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
                disabled={!canSchedule}
                onClick={() => void handleSchedule()}
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
                {saving
                  ? 'Scheduling…'
                  : effectiveWindow && selected.size > 0
                    ? `Schedule ${selected.size} ${selected.size === 1 ? 'person' : 'people'} · ${windowLabel(effectiveWindow)}`
                    : 'Pick people and a time'}
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
        subtitle={null}
        jobRows={pickerRows}
        searchValue={jobSearch}
        onSearchChange={setJobSearch}
        searchPlaceholder="Search HCP, job, address, or customer"
        onPickJob={(id) => {
          const found = jobRows.find((r) => r.id === id) ?? null
          setJob(found)
          setJobPickerOpen(false)
        }}
      />
    </div>
  )
}
