import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { groupEventsByInstance, stripStamp, type ChecklistCardEvent } from '../../lib/checklistCardEvents'
import {
  completedDayGroups,
  groupByDayDesc,
  ledgerChip,
  ledgerDayLabel,
  ledgerStats,
  weekStartSunday,
  type LedgerInstance,
} from '../../lib/checklistHistoryLedger'
import { doneLateLabel } from '../../lib/checklistDueDates'
import { ChecklistTitleWithLinks } from '../ChecklistTitleWithLinks'

/**
 * The phone-first History view (narrow screens): reverse-chronological day
 * groups with per-row status chips and a stats strip, replacing the
 * compliance grid that needed ~1,000px of horizontal scroll on a 375px phone.
 * Tapping a row expands the card's event history (v2.1842 spine) with a
 * composer, so notes and reopen reasons finally surface in History.
 */
export function ChecklistHistoryLedger({
  instances,
  selectedUserId,
  currentUserId,
  todayStr,
  setError,
  onAfterReopen,
}: {
  instances: LedgerInstance[]
  selectedUserId: string
  currentUserId: string | null
  todayStr: string
  setError: (s: string | null) => void
  /** Called after a successful reopen so the tab reloads its instance list. */
  onAfterReopen?: () => void
}) {
  const { showToast } = useToastContext()
  const [reopening, setReopening] = useState(false)
  const [eventsByInstance, setEventsByInstance] = useState<Map<string, ChecklistCardEvent[]>>(new Map())
  const [nameById, setNameById] = useState<Record<string, string>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)

  // Stats read the FULL set (misses still count); the rendered groups are the
  // completed record only — misses live on Today's Outstanding section (v2.1864).
  const allDays = useMemo(() => groupByDayDesc(instances), [instances])
  const days = useMemo(() => completedDayGroups(instances), [instances])
  const stats = useMemo(() => ledgerStats(allDays, todayStr, weekStartSunday(todayStr)), [allDays, todayStr])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const ids = instances.map((i) => i.id)
      if (ids.length === 0) {
        setEventsByInstance(new Map())
        return
      }
      // Chunk the .in() filter — a months-long office view can hold hundreds
      // of instances, and a single-URL filter that long would 414.
      const chunks: string[][] = []
      for (let i = 0; i < ids.length; i += 150) chunks.push(ids.slice(i, i + 150))
      const results = await Promise.all(
        chunks.map((chunk) =>
          supabase
            .from('checklist_instance_events')
            .select('id, instance_id, event_type, actor_user_id, body, created_at')
            .in('instance_id', chunk)
            .order('created_at', { ascending: true }),
        ),
      )
      if (cancelled) return
      const events: ChecklistCardEvent[] = []
      for (const r of results) {
        if (!r.error && r.data) events.push(...(r.data as ChecklistCardEvent[]))
      }
      // Parallel chunks can interleave instances; re-sort per instance on read.
      events.sort((a, b) => a.created_at.localeCompare(b.created_at))
      setEventsByInstance(groupEventsByInstance(events))
      const personIds = new Set<string>()
      for (const e of events) if (e.actor_user_id) personIds.add(e.actor_user_id)
      for (const i of instances) if (i.completed_by_user_id) personIds.add(i.completed_by_user_id)
      if (personIds.size > 0) {
        const { data } = await supabase.from('users').select('id, name').in('id', [...personIds])
        if (cancelled) return
        const map: Record<string, string> = {}
        for (const r of (data ?? []) as Array<{ id: string; name: string | null }>) {
          map[r.id] = (r.name ?? '').trim() || 'Someone'
        }
        setNameById(map)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [instances])

  const name = (id: string | null | undefined): string => {
    if (!id) return 'Someone'
    if (id === currentUserId) return 'You'
    return nameById[id] ?? 'Someone'
  }

  /**
   * Assignee reopen (v2.1869): note required — it becomes the reason the other
   * assignees see. Clears the completion (trigger logs `reopened` + clears
   * review stamps); the card lands on Today's Outstanding via the
   * reopened-last qualifier. RLS limits this to assignees + office.
   */
  async function reopenWithNote(inst: { id: string }) {
    const body = draft.trim()
    if (!body) {
      setError('Add a note first — whoever completed it should know why it came back.')
      return
    }
    if (reopening || !currentUserId) return
    setReopening(true)
    setError(null)
    try {
      const { error: ce } = await supabase.from('checklist_instance_events').insert({
        instance_id: inst.id,
        event_type: 'comment',
        actor_user_id: currentUserId,
        body,
      })
      if (ce) throw ce
      const { error: ue } = await supabase
        .from('checklist_instances')
        .update({ completed_at: null, completed_by_user_id: null })
        .eq('id', inst.id)
      if (ue) throw ue
      setDraft('')
      setExpandedId(null)
      void notifyReopen(inst.id, body)
      showToast('Reopened — it\u2019s back on Today\u2019s Outstanding list.', 'success')
      onAfterReopen?.()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not reopen this task.')
    } finally {
      setReopening(false)
    }
  }

  async function notifyReopen(instanceId: string, reason: string) {
    try {
      const inst = instances.find((i) => i.id === instanceId)
      const title = inst?.checklist_items?.title ?? 'Checklist task'
      const { data } = await supabase
        .from('checklist_instance_assignees')
        .select('user_id')
        .eq('checklist_instance_id', instanceId)
      for (const r of (data ?? []) as Array<{ user_id: string }>) {
        if (r.user_id === currentUserId) continue
        try {
          await supabase.functions.invoke('send-checklist-notification', {
            body: {
              recipient_user_id: r.user_id,
              push_title: 'Task reopened',
              push_body: `${title} — "${reason}"`,
              push_url: '/checklist?tab=today',
              tag: `checklist-reopen-${instanceId}`,
            },
          })
        } catch {
          // best-effort
        }
      }
    } catch {
      // best-effort
    }
  }

  async function postComment(instanceId: string) {
    const body = draft.trim()
    if (!body || posting || !currentUserId) return
    setPosting(true)
    try {
      const { error: e } = await supabase.from('checklist_instance_events').insert({
        instance_id: instanceId,
        event_type: 'comment',
        actor_user_id: currentUserId,
        body,
      })
      if (e) {
        setError(e.message)
        return
      }
      setDraft('')
      setEventsByInstance((prev) => {
        const next = new Map(prev)
        const list = [...(next.get(instanceId) ?? [])]
        list.push({
          id: `local-${Date.now()}`,
          instance_id: instanceId,
          event_type: 'comment',
          actor_user_id: currentUserId,
          body,
          created_at: new Date().toISOString(),
        })
        next.set(instanceId, list)
        return next
      })
    } finally {
      setPosting(false)
    }
  }

  function chipEl(inst: LedgerInstance) {
    const chip = ledgerChip(inst, selectedUserId, todayStr, eventsByInstance.get(inst.id) ?? [])
    const base = {
      fontSize: '0.8125rem',
      fontWeight: 600,
      padding: '0.25rem 0.6rem',
      borderRadius: 8,
      flexShrink: 0,
      whiteSpace: 'nowrap' as const,
    }
    switch (chip.kind) {
      case 'done': {
        // "done N days late" rider (v2.2351): only when the item carried a due date and the completion day passed it.
        const late = doneLateLabel(chip.completedAt, inst.checklist_items?.due_date)
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <span style={{ ...base, background: '#16a34a', color: 'white' }}>✓ {stripStamp(chip.completedAt)}</span>
            {late ? <span style={{ ...base, fontWeight: 500, background: 'var(--bg-red-100)', border: '1px solid #dc2626', color: 'var(--text-red-700)' }}>{late}</span> : null}
          </span>
        )
      }
      case 'done_by_other':
        return (
          <span style={{ ...base, background: 'var(--bg-amber-tint)', border: '1px solid #d97706', color: 'var(--text-amber-800)' }}>
            ✓ by {name(chip.byUserId)}
          </span>
        )
      case 'reopened':
        return (
          <span style={{ ...base, background: 'var(--bg-amber-tint)', border: '1px solid #d97706', color: 'var(--text-amber-800)' }}>
            Reopened
          </span>
        )
      case 'missed':
        return (
          <span style={{ ...base, background: 'var(--bg-red-100)', border: '1px solid #dc2626', color: 'var(--text-red-700)' }}>
            ✗ Missed
          </span>
        )
      case 'open':
        return (
          <span style={{ ...base, background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', color: 'var(--text-700)' }}>
            Open
          </span>
        )
    }
  }

  const statTile = (label: string, value: string, valueColor?: string) => (
    <div style={{ flex: 1, background: 'var(--bg-muted)', borderRadius: 10, padding: '0.6rem 0.75rem' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontSize: '1.25rem', fontWeight: 600, color: valueColor ?? 'var(--text-strong)', marginTop: 2 }}>{value}</div>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.9rem' }}>
        {statTile('This week', stats.weekPct == null ? '—' : `${stats.weekPct}%`)}
        {statTile('Streak', stats.streakDays === 1 ? '1 day' : `${stats.streakDays} days`)}
        {statTile('Missed', String(stats.missedCount), stats.missedCount > 0 ? 'var(--text-red-700)' : undefined)}
      </div>
      {days.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No checklist history in this range.</p>
      ) : (
        days.map((day) => (
          <div key={day.date} style={{ marginBottom: '0.9rem' }}>
            <p style={{ margin: '0 0 0.35rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-700)' }}>
              {ledgerDayLabel(day.date, todayStr)} ·{' '}
              <span style={{ color: 'var(--text-strong)' }}>{day.doneCount} done</span>
            </p>
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                border: '1px solid var(--border-strong)',
                borderRadius: 12,
                overflow: 'hidden',
              }}
            >
              {day.rows.map((inst) => {
                const events = eventsByInstance.get(inst.id) ?? []
                const notes = events.filter((e) => e.event_type === 'comment').length
                const expanded = expandedId === inst.id
                const title = inst.checklist_items?.title ?? 'Untitled'
                return (
                  <li key={inst.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedId(expanded ? null : inst.id)
                        setDraft('')
                      }}
                      aria-expanded={expanded}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        width: '100%',
                        textAlign: 'left',
                        minHeight: 52,
                        padding: '0.6rem 0.75rem',
                        background: expanded ? 'var(--bg-muted)' : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-strong)',
                      }}
                    >
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: '0.9375rem' }}>
                          <ChecklistTitleWithLinks title={title} links={inst.checklist_items?.links} />
                        </span>
                        {notes > 0 ? (
                          <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                            💬 {notes} {notes === 1 ? 'note' : 'notes'}
                          </span>
                        ) : null}
                      </span>
                      {chipEl(inst)}
                      <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {expanded ? '▾' : '▸'}
                      </span>
                    </button>
                    {expanded ? (
                      <div style={{ padding: '0 0.75rem 0.7rem' }}>
                        {events.length > 0 ? (
                          <div
                            style={{
                              borderLeft: '3px solid var(--border-strong)',
                              paddingLeft: '0.65rem',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.35rem',
                              margin: '0.2rem 0 0.6rem',
                            }}
                          >
                            {events.map((e) => {
                              if (e.event_type === 'comment') {
                                return (
                                  <div key={e.id} style={{ fontSize: '0.9375rem', color: 'var(--text-700)', lineHeight: 1.45 }}>
                                    <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{name(e.actor_user_id)}</span>{' '}
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{stripStamp(e.created_at)}</span>{' '}
                                    — {e.body}
                                  </div>
                                )
                              }
                              const label =
                                e.event_type === 'completed'
                                  ? 'completed'
                                  : e.event_type === 'reopened'
                                    ? 'reopened'
                                    : e.event_type === 'accepted'
                                      ? 'signed off'
                                      : e.event_type
                              return (
                                <div key={e.id} style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                  {name(e.actor_user_id)} {label} · {stripStamp(e.created_at)}
                                  {e.event_type === 'completed' && e.body ? <> — “{e.body}”</> : null}
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <p style={{ margin: '0.2rem 0 0.6rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                            No activity recorded for this day.
                          </p>
                        )}
                        {currentUserId ? (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                              type="text"
                              value={draft}
                              onChange={(e) => setDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') void postComment(inst.id)
                              }}
                              placeholder="Add a note…"
                              disabled={posting}
                              style={{
                                flex: 1,
                                minWidth: 0,
                                height: 44,
                                boxSizing: 'border-box',
                                padding: '0 0.7rem',
                                fontSize: '1rem',
                                border: '2px solid var(--text-600)',
                                borderRadius: 10,
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => void postComment(inst.id)}
                              disabled={posting || reopening || !draft.trim()}
                              style={{
                                height: 44,
                                padding: '0 1rem',
                                borderRadius: 10,
                                border: 'none',
                                background: posting || reopening || !draft.trim() ? '#9ca3af' : '#2563eb',
                                color: 'white',
                                fontSize: '0.9375rem',
                                fontWeight: 600,
                                cursor: posting || reopening || !draft.trim() ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {posting ? '…' : 'Post'}
                            </button>
                            <button
                              type="button"
                              onClick={() => void reopenWithNote(inst)}
                              disabled={posting || reopening || !draft.trim()}
                              title="Reopen this task — your note becomes the reason"
                              style={{
                                height: 44,
                                padding: '0 1rem',
                                borderRadius: 10,
                                border: 'none',
                                background: posting || reopening || !draft.trim() ? '#9ca3af' : '#d97706',
                                color: 'white',
                                fontSize: '0.9375rem',
                                fontWeight: 600,
                                cursor: posting || reopening || !draft.trim() ? 'not-allowed' : 'pointer',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {reopening ? '…' : 'Reopen'}
                            </button>
                          </div>
                        ) : null}
                        {currentUserId ? (
                          <p style={{ margin: '0.4rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                            Reopen posts your note, puts this back on Today → Outstanding, and notifies the assignees.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </div>
        ))
      )}
    </div>
  )
}
