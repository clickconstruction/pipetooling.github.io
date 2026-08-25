import { useCallback, useEffect, useRef, useState } from 'react'
import { canSeeTaskCosts, estimateDollars, estimateRelativeBands, formatWholeDollars } from '../../lib/checklistCostEstimate'
import { writeChecklistCostActual } from '../../lib/checklistCostStore'
import { useChecklistCostEstimates } from '../../hooks/useChecklistCostEstimates'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { groupEventsByInstance, stripStamp, type ChecklistCardEvent } from '../../lib/checklistCardEvents'
import {
  buildReviewQueueRows,
  reviewQueueCutoffIso,
  type ReviewQueueInstance,
  type ReviewQueueRow,
} from '../../lib/checklistReviewQueue'

/**
 * "Checklist review" inbox section (Phase 3 of the checklist-card redesign):
 * completed-but-unreviewed tasks of your people — you review a card if you
 * created the item or are its notify-on-complete target (devs see all).
 * Dismiss stamps reviewed_at/reviewed_by (the trigger logs 'accepted');
 * Reopen requires a comment, clears completed_at (the trigger logs 'reopened'
 * and clears the review stamps), and pings the assignees.
 *
 * Fully self-contained (own fetch) so hosts mount it in one line: the
 * Dashboard/Dispatch-Mode Teams Inbox card and the Checklist Review tab.
 * Renders nothing while empty — it only appears when there is work to review.
 */
export function ChecklistReviewInboxSection({
  onCountChange,
  renderWhenEmpty = false,
}: {
  /** Reports the queue size upward (Review tab fold badge / summary tile). */
  onCountChange?: (n: number) => void
  /** Folded hosts want an explicit "nothing waiting" body instead of null. */
  renderWhenEmpty?: boolean
} = {}) {
  const { user: authUser, role } = useAuth()
  // Actuals capture (dev/controller): one tap per costed sign-off; untouched records nothing.
  const canSeeCosts = canSeeTaskCosts(role)
  const costEstimates = useChecklistCostEstimates(canSeeCosts)
  async function recordActual(costKey: string, hours: number | null) {
    if (actualBusyKey) return
    setActualBusyKey(costKey)
    try {
      await writeChecklistCostActual(costKey, hours)
    } catch {
      // non-blocking: sign-off never depends on this
    } finally {
      setActualBusyKey(null)
    }
  }
  const isDev = role === 'dev'
  const [rows, setRows] = useState<ReviewQueueRow[]>([])
  /** costKey with an actual write in flight (Took-about strip). */
  const [actualBusyKey, setActualBusyKey] = useState<string | null>(null)
  const [eventsByInstance, setEventsByInstance] = useState<Map<string, ChecklistCardEvent[]>>(new Map())
  const [nameById, setNameById] = useState<Record<string, string>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!authUser?.id) return
    try {
      const instances = (await withSupabaseRetry(
        async () =>
          supabase
            .from('checklist_instances')
            .select(
              'id, checklist_item_id, scheduled_date, completed_at, completed_by_user_id, reviewed_at, checklist_items(title, created_by_user_id, notify_on_complete_user_id, roadmap_group_task_id)',
            )
            .not('completed_at', 'is', null)
            .is('reviewed_at', null)
            .gte('completed_at', reviewQueueCutoffIso())
            .order('completed_at', { ascending: false })
            .limit(50),
        'checklist review queue',
      )) as unknown as ReviewQueueInstance[] | null
      const list = instances ?? []
      const ids = list.map((i) => i.id)
      let events: ChecklistCardEvent[] = []
      if (ids.length > 0) {
        events = ((await withSupabaseRetry(
          async () =>
            supabase
              .from('checklist_instance_events')
              .select('id, instance_id, event_type, actor_user_id, body, created_at')
              .in('instance_id', ids)
              .order('created_at', { ascending: true }),
          'checklist review queue events',
        )) ?? []) as ChecklistCardEvent[]
      }
      const grouped = groupEventsByInstance(events)
      const built = buildReviewQueueRows({
        instances: list,
        eventsByInstance: grouped,
        currentUserId: authUser.id,
        isDev,
      })
      setRows(built)
      onCountChange?.(built.length)
      setEventsByInstance(grouped)
      const personIds = new Set<string>()
      for (const r of built) if (r.completedByUserId) personIds.add(r.completedByUserId)
      for (const e of events) if (e.actor_user_id) personIds.add(e.actor_user_id)
      if (personIds.size > 0) {
        const nameRows = (await withSupabaseRetry(
          async () => supabase.from('users').select('id, name').in('id', [...personIds]),
          'checklist review queue names',
        )) as Array<{ id: string; name: string | null }> | null
        const map: Record<string, string> = {}
        for (const r of nameRows ?? []) map[r.id] = (r.name ?? '').trim() || 'Someone'
        setNameById(map)
      }
    } catch {
      // Queue is a convenience surface — fail quiet, the Checklist page still works.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onCountChange is a stable-enough reporter; re-running load on its identity would refetch on every parent render
  }, [authUser?.id, isDev])

  useEffect(() => {
    void load()
  }, [load])

  // Completing a task anywhere on the same screen (Outstanding-by-person's ✓,
  // a card panel's ✓ Complete) puts it in this queue — refetch on the
  // completion event, and on `checklist-item-saved` since edits/deletes can
  // change queue membership too. Same loadRef pattern as Review/Manage.
  const loadRef = useRef(load)
  loadRef.current = load
  useEffect(() => {
    const handler = () => void loadRef.current()
    window.addEventListener('checklist-instance-completed', handler)
    window.addEventListener('checklist-item-saved', handler)
    return () => {
      window.removeEventListener('checklist-instance-completed', handler)
      window.removeEventListener('checklist-item-saved', handler)
    }
  }, [])

  const name = (id: string | null): string => {
    if (!id) return 'Someone'
    if (id === authUser?.id) return 'You'
    return nameById[id] ?? 'Someone'
  }

  async function dismiss(row: ReviewQueueRow) {
    if (!authUser?.id || busyId) return
    setBusyId(row.instanceId)
    setError(null)
    const { error: e } = await supabase
      .from('checklist_instances')
      .update({ reviewed_at: new Date().toISOString(), reviewed_by: authUser.id })
      .eq('id', row.instanceId)
    if (e) setError(e.message)
    else await load()
    setBusyId(null)
  }

  async function reopenWithComment(row: ReviewQueueRow) {
    if (!authUser?.id || busyId) return
    const body = draft.trim()
    if (!body) {
      setError('Add a comment first — the person should know why it came back.')
      return
    }
    setBusyId(row.instanceId)
    setError(null)
    try {
      const { error: ce } = await supabase.from('checklist_instance_events').insert({
        instance_id: row.instanceId,
        event_type: 'comment',
        actor_user_id: authUser.id,
        body,
      })
      if (ce) throw ce
      const { error: ue } = await supabase
        .from('checklist_instances')
        .update({ completed_at: null, completed_by_user_id: null })
        .eq('id', row.instanceId)
      if (ue) throw ue
      setDraft('')
      setExpandedId(null)
      void notifyAssignees(row, body)
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not reopen this task.')
    } finally {
      setBusyId(null)
    }
  }

  async function notifyAssignees(row: ReviewQueueRow, reason: string) {
    try {
      const { data } = await supabase
        .from('checklist_instance_assignees')
        .select('user_id')
        .eq('checklist_instance_id', row.instanceId)
      for (const r of (data ?? []) as Array<{ user_id: string }>) {
        if (r.user_id === authUser?.id) continue
        try {
          await supabase.functions.invoke('send-checklist-notification', {
            body: {
              recipient_user_id: r.user_id,
              push_title: 'Task reopened',
              push_body: `${row.title} — "${reason}"`,
              push_url: '/checklist?tab=today',
              tag: `checklist-reopen-${row.instanceId}`,
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

  if (!authUser?.id) return null
  if (rows.length === 0) {
    if (!renderWhenEmpty) return null
    return (
      <p style={{ margin: 0, padding: '0.75rem 0.9rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
        Nothing waiting on review.
      </p>
    )
  }

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 10,
        background: 'var(--surface)',
        marginBottom: '1rem',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.6rem 0.9rem',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-strong)' }}>Checklist review</span>
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            padding: '0.1rem 0.55rem',
            borderRadius: 999,
            background: 'var(--bg-blue-tint)',
            color: 'var(--text-link)',
          }}
        >
          {rows.length} to review
        </span>
      </div>
      {error ? (
        <p style={{ margin: 0, padding: '0.5rem 0.9rem', fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>{error}</p>
      ) : null}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {rows.map((row) => {
          const expanded = expandedId === row.instanceId
          const events = eventsByInstance.get(row.instanceId) ?? []
          const busy = busyId === row.instanceId
          return (
            <li key={row.instanceId} style={{ borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'stretch' }}>
              {/* Full-height sign-off rail on the left — same pattern as the
                  Dispatch inbox's Dismiss rail, for one-tap clearing. */}
              <button
                type="button"
                onClick={() => void dismiss(row)}
                disabled={busy}
                title="Sign off and clear from review"
                style={{
                  flexShrink: 0,
                  alignSelf: 'stretch',
                  width: 88,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  border: 'none',
                  borderRight: '1px solid var(--border)',
                  borderRadius: 0,
                  background: 'var(--bg-green-tint)',
                  color: 'var(--text-green-800)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: busy ? 'not-allowed' : 'pointer',
                }}
              >
                <span aria-hidden style={{ fontSize: '1rem', lineHeight: 1 }}>✓</span>
                {busy ? '…' : 'Dismiss'}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
              <button
                type="button"
                onClick={() => {
                  setExpandedId(expanded ? null : row.instanceId)
                  setDraft('')
                  setError(null)
                }}
                aria-expanded={expanded}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.55rem 0.9rem',
                  background: expanded ? 'var(--bg-muted)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  color: 'var(--text-strong)',
                }}
              >
                <div style={{ fontWeight: 500 }}>{row.title}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  {name(row.completedByUserId)} · done {stripStamp(row.completedAt)}
                  {row.latestNoteBody ? <> · “{row.latestNoteBody}”</> : <> · no note</>}
                </div>
              </button>
              {(() => {
                if (!canSeeCosts) return null
                const est = costEstimates[row.costKey]
                if (!est) return null
                const strapBusy = actualBusyKey === row.costKey
                return (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      flexWrap: 'wrap',
                      padding: '0 0.9rem 0.6rem',
                      borderTop: '1px dashed var(--border)',
                      paddingTop: '0.5rem',
                      margin: '0 0 0',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '0.1rem 0.45rem',
                        borderRadius: 7,
                        background: '#fbbf24',
                        border: '1px solid #d97706',
                        color: '#451a03',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      est {formatWholeDollars(estimateDollars(est))} · {est.hours}h
                    </span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>Took about</span>
                    {estimateRelativeBands(est.hours).map((b) => {
                      const selected = est.actualHours === b
                      return (
                        <button
                          key={b}
                          type="button"
                          disabled={strapBusy}
                          onClick={() => void recordActual(row.costKey, selected ? null : b)}
                          title={b === est.hours ? 'As estimated' : undefined}
                          style={{
                            minWidth: 44,
                            minHeight: 32,
                            padding: '0 0.4rem',
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            borderRadius: 8,
                            border: selected
                              ? '2px solid #2563eb'
                              : b === est.hours
                                ? '1.5px solid #d97706'
                                : '1px solid var(--border-strong)',
                            background: selected ? 'var(--bg-blue-tint)' : 'var(--surface)',
                            color: selected ? 'var(--text-blue-800)' : b === est.hours ? 'var(--text-amber-800)' : 'var(--text-700)',
                            cursor: strapBusy ? 'wait' : 'pointer',
                          }}
                        >
                          {b}h{selected ? ' ✓' : ''}
                        </button>
                      )
                    })}
                  </div>
                )
              })()}
              {expanded ? (
                <div style={{ padding: '0 0.9rem 0.75rem' }}>
                  {events.length > 0 ? (
                    <div
                      style={{
                        borderLeft: '2px solid var(--border)',
                        paddingLeft: '0.6rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem',
                        margin: '0.25rem 0 0.6rem',
                      }}
                    >
                      {events.map((e) => (
                        <div
                          key={e.id}
                          style={{
                            fontSize: e.event_type === 'comment' ? '0.8125rem' : '0.75rem',
                            color: e.event_type === 'comment' ? 'var(--text-700)' : 'var(--text-muted)',
                            lineHeight: 1.45,
                          }}
                        >
                          <span style={{ fontWeight: e.event_type === 'comment' ? 600 : 400 }}>
                            {name(e.actor_user_id)}
                          </span>{' '}
                          {e.event_type === 'comment' ? '—' : e.event_type === 'accepted' ? 'signed off ·' : `${e.event_type} ·`}{' '}
                          {e.event_type === 'comment' ? e.body : stripStamp(e.created_at)}
                          {e.event_type === 'completed' && e.body ? <> — “{e.body}”</> : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Comment (required to reopen)…"
                    disabled={busy}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '0.45rem 0.6rem',
                      fontSize: '0.875rem',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 6,
                      marginBottom: '0.5rem',
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => void dismiss(row)}
                      disabled={busy}
                      style={{
                        padding: '0.35rem 0.9rem',
                        borderRadius: 6,
                        border: '1px solid var(--border-strong)',
                        background: 'var(--bg-muted)',
                        fontSize: '0.8125rem',
                        cursor: busy ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {busy ? '…' : 'Dismiss'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void reopenWithComment(row)}
                      disabled={busy || !draft.trim()}
                      style={{
                        padding: '0.35rem 0.9rem',
                        borderRadius: 6,
                        border: 'none',
                        background: busy || !draft.trim() ? '#9ca3af' : '#d97706',
                        color: 'white',
                        fontSize: '0.8125rem',
                        fontWeight: 500,
                        cursor: busy || !draft.trim() ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Reopen with comment
                    </button>
                  </div>
                </div>
              ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
