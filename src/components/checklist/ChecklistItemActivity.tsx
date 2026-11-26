import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { stripStamp, type ChecklistCardEvent } from '../../lib/checklistCardEvents'
import { doerLineWords } from '../../lib/tasks/taskDoerActs'
import { buildManageTimeline, commentTargetInstance, type ManageInstanceLite } from '../../lib/checklistManageActivity'
import type { DueChangeRow } from '../../lib/checklistDuePushes'
import { localCalendarDayKey, todayYmdInAppTz } from '../../utils/dateUtils'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { useOptionalAuth } from '../../hooks/useAuth'
import { useTaskNoteTags } from '../../hooks/useTaskNoteTags'
import { canTagInTaskNotes } from '../../lib/jobs/noteTags'
import { noteTagsChanged, notifyNoteTag, postTaggedTaskNote } from '../../lib/jobs/noteTagsIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { useNoteTagBox } from '../jobs/NoteTagBox'
import { TaggedNoteBody } from '../jobs/TaggedNoteBody'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useToastContext } from '../../contexts/ToastContext'
import { TASK_COMMENT_DELETED_WORDS, TEST_NOTE_DELETE_PRESS, taskCommentDeleteConfirm, taskCommentDeleteProblem, testNoteDeleteDrawn } from '../../lib/notes/testNoteDelete'
import { deleteTestTaskComment } from '../../lib/notes/testNoteDeleteIo'

/** A long-running repeating task can have years of instances — cap the activity fetch. */
export const ITEM_ACTIVITY_INSTANCE_CAP = 120

/** Note box grows with its text up to about five lines, then scrolls. */
const DRAFT_MAX_HEIGHT = 160

export type ChecklistItemActivityItem = {
  id: string
  title: string
  created_at: string | null
  created_by_user_id: string | null
}

/**
 * The expandable task activity panel (shipped on Manage in v2.2010, shared
 * with Review since v2.2016 and Today since v2.2017): the item's full event
 * history across its
 * instances (creation → completed/reopened/signed-off → notes) plus a
 * composer. Notes attach to the instance picked by `commentTargetInstance`
 * (events live on instances, not the item template).
 */
export function ChecklistItemActivity({
  item,
  authUserId,
  showInstanceDays,
  setError,
  footerActions,
  commentInstanceId,
  onPosted,
  onComplete,
}: {
  item: ChecklistItemActivityItem
  authUserId: string | null
  /** Tag events with the day they belonged to (repeating items). */
  showInstanceDays: boolean
  setError: (s: string | null) => void
  /** Extra links/buttons rendered under the composer (e.g. Edit · Forward). */
  footerActions?: ReactNode
  /**
   * Attach new notes to this specific occurrence instead of the default
   * `commentTargetInstance` pick — Today's cards keep the conversation on the
   * occurrence being looked at.
   */
  commentInstanceId?: string
  /** Called after a note lands, so the parent can refresh its 💬 counts. */
  onPosted?: (instanceId: string, body: string) => void
  /**
   * ✓ Complete / ✓ Post & complete (v2.2039): completes the target occurrence
   * (posting the draft first when one is typed). The host supplies the actual
   * completion so each tab's side effects and refreshes stay in charge.
   * Resolve true on success. Available to everyone who can post.
   */
  onComplete?: (inst: { id: string; scheduledDate: string }) => Promise<boolean>
}) {
  const [loading, setLoading] = useState(true)
  const [instances, setInstances] = useState<ManageInstanceLite[]>([])
  const [dueChanges, setDueChanges] = useState<DueChangeRow[]>([])
  const [events, setEvents] = useState<ChecklistCardEvent[]>([])
  const [nameById, setNameById] = useState<Record<string, string>>({})
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [cappedPast, setCappedPast] = useState(false)
  const draftRef = useRef<HTMLTextAreaElement | null>(null)

  // Auto-grow the note box with its text (1 → ~5 lines, then it scrolls) and
  // snap back when a post clears the draft. Runs after every draft change.
  useEffect(() => {
    const el = draftRef.current
    if (!el) return
    el.style.height = 'auto'
    const borders = el.offsetHeight - el.clientHeight
    el.style.height = `${Math.min(el.scrollHeight + borders, DRAFT_MAX_HEIGHT)}px`
  }, [draft])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        // Repeating tasks pre-materialize instances years ahead — cap the
        // *past* history and take only the near future (comment target for
        // ahead-scheduled tasks), or the cap fills up with empty future rows.
        const todayStr = todayYmdInAppTz()
        const [pastRes, futureRes] = await Promise.all([
          supabase
            .from('checklist_instances')
            .select('id, scheduled_date, completed_at')
            .eq('checklist_item_id', item.id)
            .lte('scheduled_date', todayStr)
            .order('scheduled_date', { ascending: false })
            .limit(ITEM_ACTIVITY_INSTANCE_CAP),
          supabase
            .from('checklist_instances')
            .select('id, scheduled_date, completed_at')
            .eq('checklist_item_id', item.id)
            .gt('scheduled_date', todayStr)
            .order('scheduled_date', { ascending: true })
            .limit(30),
        ])
        const instErr = pastRes.error ?? futureRes.error
        if (instErr) {
          setError(instErr.message)
          return
        }
        const pastInsts = (pastRes.data ?? []) as ManageInstanceLite[]
        const insts = [...pastInsts, ...((futureRes.data ?? []) as ManageInstanceLite[])]
        setCappedPast(pastInsts.length >= ITEM_ACTIVITY_INSTANCE_CAP)
        let evs: ChecklistCardEvent[] = []
        if (insts.length > 0) {
          const { data: evData, error: evErr } = await supabase
            .from('checklist_instance_events')
            .select('id, instance_id, event_type, actor_user_id, body, created_at, percent')
            .in('instance_id', insts.map((i) => i.id))
            .order('created_at', { ascending: true })
          if (evErr) {
            setError(evErr.message)
            return
          }
          evs = (evData ?? []) as unknown as ChecklistCardEvent[]
        }
        // Due-change ledger (v2.2371): "pushed the due date …" spine lines.
        const { data: pushData } = await supabase
          .from('checklist_item_due_changes')
          .select('changed_at, changed_by, from_due, to_due')
          .eq('checklist_item_id', item.id)
          .order('changed_at', { ascending: true })
        const pushes = (pushData ?? []) as DueChangeRow[]
        const personIds = new Set<string>()
        if (item.created_by_user_id) personIds.add(item.created_by_user_id)
        for (const e of evs) if (e.actor_user_id) personIds.add(e.actor_user_id)
        for (const d of pushes) if (d.changed_by) personIds.add(d.changed_by)
        const names: Record<string, string> = {}
        if (personIds.size > 0) {
          const { data } = await supabase.from('users').select('id, name').in('id', [...personIds])
          for (const r of (data ?? []) as Array<{ id: string; name: string | null }>) {
            names[r.id] = (r.name ?? '').trim() || 'Someone'
          }
        }
        if (cancelled) return
        setInstances(insts)
        setEvents(evs)
        setDueChanges(pushes)
        setNameById(names)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [item.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const name = (id: string | null | undefined): string => {
    if (!id) return 'Someone'
    if (id === authUserId) return 'You'
    return nameById[id] ?? 'Someone'
  }

  const dayLabel = (d: string): string =>
    new Date(`${d}T00:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' })

  const timeline = useMemo(() => buildManageTimeline(item, instances, events, dueChanges), [item, instances, events, dueChanges])
  const commentTarget = useMemo(
    () => commentTargetInstance(instances, todayYmdInAppTz()),
    [instances],
  )
  const postTargetId = commentInstanceId ?? commentTarget?.id ?? null
  const targetInstance = postTargetId ? instances.find((i) => i.id === postTargetId) ?? null : null
  const canComplete = !!onComplete && !!authUserId && !!targetInstance && !targetInstance.completed_at

  // Tagging a teammate in a task note (punch list #375): the names at the box come from the day row the note
  // lands on, and a posted note that carries a tag draws its chip and who it waits on.
  const viewerRole = useOptionalAuth()?.role ?? null
  // Deleting a test task's comment (punch list #443, row 13): a dev's take-back of Post, on a ZZ task alone.
  const confirmDialog = useConfirmDialog()
  const { showToast } = useToastContext()
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null)
  const commentDeleteDrawn = testNoteDeleteDrawn(viewerRole)
  const commentDeleteProblem = commentDeleteDrawn ? taskCommentDeleteProblem({ event_type: 'comment' }, item.title) : ''
  const deleteComment = async (eventId: string, authorName: string) => {
    if (commentDeleteProblem || deletingEventId) return
    if (!(await confirmDialog({ ...taskCommentDeleteConfirm(authorName), danger: true }))) return
    setDeletingEventId(eventId)
    try {
      await deleteTestTaskComment(eventId)
      setEvents((prev) => prev.filter((e) => e.id !== eventId))
      showToast(TASK_COMMENT_DELETED_WORDS, 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'The comment was not deleted.'), 'error')
    } finally {
      setDeletingEventId(null)
    }
  }
  const tagBox = useNoteTagBox({
    jobId: '',
    taskInstanceId: postTargetId,
    draft,
    setDraft,
    inputRef: draftRef,
    enabled: !!authUserId && !!postTargetId && canTagInTaskNotes(viewerRole),
    place: 'above',
    bigAt: true,
  })
  const tagsByNote = useTaskNoteTags(loading ? null : item.id, events.length)

  async function postComment(): Promise<boolean> {
    const body = draft.trim()
    if (!body || posting || !authUserId || !postTargetId) return false
    const tagged = tagBox.taggedIds(body)
    setPosting(true)
    try {
      let noteId = `local-${Date.now()}`
      // The note's own id, when the database handed one back: the phone notice is asked for by it.
      let postedId: string | null = null
      if (tagged.length > 0) {
        // A note that tags someone posts with its tags in one transaction, or not at all.
        try {
          noteId = await postTaggedTaskNote(postTargetId, body, tagged)
          postedId = noteId
        } catch (err: unknown) {
          setError(formatErrorMessage(err, 'The note was not posted'))
          return false
        }
      } else {
        const { data: row, error: e } = await supabase
          .from('checklist_instance_events')
          .insert({ instance_id: postTargetId, event_type: 'comment', actor_user_id: authUserId, body })
          .select('id')
          .maybeSingle()
        if (e) {
          setError(e.message)
          return false
        }
        postedId = row?.id ?? null
      }
      // The notice (punch list #375): the people this note tags, and anyone whose tag on this task it answered. The
      // function sends nothing for a note that does neither, and a notice that fails changes nothing here.
      if (postedId) notifyNoteTag({ taskEventId: postedId })
      setDraft('')
      tagBox.reset()
      setEvents((prev) => [
        ...prev,
        {
          id: noteId,
          instance_id: postTargetId,
          event_type: 'comment',
          actor_user_id: authUserId,
          body,
          created_at: new Date().toISOString(),
        },
      ])
      onPosted?.(postTargetId, body)
      // A typed note may tag someone, and it answers any tag that waited on its writer on this task.
      noteTagsChanged()
      return true
    } finally {
      setPosting(false)
    }
  }

  /** ✓ Complete / ✓ Post & complete: draft (if any) posts first so the thread reads in order. */
  async function completeTarget() {
    if (!onComplete || !targetInstance || !authUserId || posting || completing) return
    setCompleting(true)
    try {
      if (draft.trim()) {
        const posted = await postComment()
        if (!posted) return
      }
      const ok = await onComplete({ id: targetInstance.id, scheduledDate: targetInstance.scheduled_date })
      if (!ok) return
      const nowIso = new Date().toISOString()
      setInstances((prev) => prev.map((i) => (i.id === targetInstance.id ? { ...i, completed_at: nowIso } : i)))
      setEvents((prev) => [
        ...prev,
        {
          id: `local-completed-${Date.now()}`,
          instance_id: targetInstance.id,
          event_type: 'completed',
          actor_user_id: authUserId,
          body: '',
          created_at: nowIso,
        },
      ])
    } finally {
      setCompleting(false)
    }
  }

  if (loading) {
    return <p style={{ margin: '0.4rem 0 0.2rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading activity…</p>
  }

  return (
    <div>
      {cappedPast ? (
        <p style={{ margin: '0.3rem 0 0.4rem', fontSize: '0.75rem', color: 'var(--text-faint)' }}>
          Showing the most recent {ITEM_ACTIVITY_INSTANCE_CAP} occurrences.
        </p>
      ) : null}
      {timeline.length === 0 ? (
        <p style={{ margin: '0.3rem 0 0.6rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>No activity recorded yet.</p>
      ) : (
        <div
          style={{
            borderLeft: '3px solid var(--border-strong)',
            paddingLeft: '0.65rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
            margin: '0.35rem 0 0.6rem',
          }}
        >
          {timeline.map((entry) => {
            if (entry.kind === 'created') {
              return (
                <div key="created" style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  {name(entry.actorUserId)} created this task · {stripStamp(entry.at)}
                </div>
              )
            }
            if (entry.kind === 'due_change') {
              return (
                <div key={entry.id} style={{ fontSize: '0.875rem', color: 'var(--text-amber-800)' }}>
                  {name(entry.actorUserId)} {entry.text} · {stripStamp(entry.at)}
                </div>
              )
            }
            // "for Aug 19" context only when the event happened on a different
            // day than the occurrence it belongs to — else it just repeats the stamp.
            const dayChip =
              showInstanceDays &&
              entry.scheduledDate &&
              localCalendarDayKey(new Date(entry.at)) !== entry.scheduledDate
                ? ` (for ${dayLabel(entry.scheduledDate)})`
                : ''
            if (entry.eventType === 'comment') {
              return (
                <div key={entry.id} style={{ fontSize: '0.9375rem', color: 'var(--text-700)', lineHeight: 1.45 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{name(entry.actorUserId)}</span>{' '}
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{stripStamp(entry.at)}{dayChip}</span> —{' '}
                  <TaggedNoteBody body={entry.body ?? ''} tags={tagsByNote.get(entry.id)} postedIso={entry.at} viewerId={authUserId} />
                  {commentDeleteDrawn ? (
                    <>
                      {' '}
                      <button
                        type="button"
                        data-testid="task-comment-delete"
                        aria-label={`${TEST_NOTE_DELETE_PRESS} ${name(entry.actorUserId)}’s comment`}
                        title={commentDeleteProblem || 'Delete this comment. Only a developer sees this press.'}
                        aria-disabled={!!commentDeleteProblem || deletingEventId != null}
                        onClick={() => { if (!commentDeleteProblem && !deletingEventId) void deleteComment(entry.id, name(entry.actorUserId)) }}
                        style={{ background: 'none', border: 'none', padding: 0, fontFamily: 'inherit', fontSize: '0.8125rem', textDecoration: 'underline', color: commentDeleteProblem ? 'var(--text-faint)' : 'var(--text-red-600)', cursor: commentDeleteProblem || deletingEventId ? 'default' : 'pointer' }}
                      >
                        {deletingEventId === entry.id ? 'Deleting…' : TEST_NOTE_DELETE_PRESS}
                      </button>
                      {commentDeleteProblem ? <span style={{ marginLeft: '0.35rem', color: 'var(--text-faint)', fontSize: '0.8125rem' }} data-testid="task-comment-delete-why">{commentDeleteProblem}</span> : null}
                    </>
                  ) : null}
                </div>
              )
            }
            // Task cards (#273): a line ticked or unticked, and a percent moved, read as quiet lines.
            if (entry.eventType === 'criterion') {
              return (
                <div key={entry.id} style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  {entry.body} · {name(entry.actorUserId)} · {stripStamp(entry.at)}
                  {dayChip}
                </div>
              )
            }
            if (entry.eventType === 'progress') {
              return (
                <div key={entry.id} style={{ fontSize: '0.875rem', color: 'var(--text-700)' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{name(entry.actorUserId)}</span> · {typeof entry.percent === 'number' ? `${entry.percent}%` : 'moved it'} · {stripStamp(entry.at)}
                  {dayChip}
                  {entry.body ? <> — “{entry.body}”</> : null}
                </div>
              )
            }
            // The doer's tools (punch list #369) write their own lines. A moved line is left out here: the due-day change
            // above already says it, with both days.
            if (entry.eventType === 'moved') return null
            const doerWords = doerLineWords(entry.eventType, entry.body ?? '')
            if (doerWords) {
              return (
                <div key={entry.id} data-doer-line={entry.eventType} style={{ fontSize: '0.875rem', color: entry.eventType === 'stuck' ? 'var(--text-amber-800)' : 'var(--text-700)' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{name(entry.actorUserId)}</span> {doerWords} · {stripStamp(entry.at)}
                  {dayChip}
                </div>
              )
            }
            const label =
              entry.eventType === 'completed'
                ? 'completed'
                : entry.eventType === 'reopened'
                  ? 'reopened'
                  : entry.eventType === 'accepted'
                    ? 'signed off'
                    : entry.eventType
            return (
              <div key={entry.id} style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                {name(entry.actorUserId)} {label} · {stripStamp(entry.at)}
                {dayChip}
                {entry.eventType === 'completed' && entry.body ? <> — “{entry.body}”</> : null}
              </div>
            )
          })}
        </div>
      )}
      {authUserId && postTargetId ? (
        // One wrapping row (v2.2143): the note box keeps ≥240px and takes all the
        // slack; when the row is too narrow for it plus the buttons (a phone),
        // the button group drops underneath and fills the width. No breakpoint.
        // The names offered and picked sit above the box, and the row of names opens above them, clear of a phone's keyboard (punch list #375).
        <div style={{ position: 'relative' }}>
        {tagBox.list}
        {tagBox.chips}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {/* The mark in the words is drawn under the box, so the box is see-through and this holds its background. */}
          <div style={{ position: 'relative', flex: '999 1 240px', minWidth: 0, display: 'flex', background: 'var(--surface)', borderRadius: 10 }}>
          {tagBox.mark}
          <textarea
            ref={draftRef}
            value={draft}
            rows={1}
            onChange={(e) => tagBox.onText(e.target.value, e.target.selectionStart)}
            onClick={(e) => tagBox.onText(e.currentTarget.value, e.currentTarget.selectionStart)}
            onKeyDown={(e) => {
              // The row of names takes its own keys first: Enter picks a name and Escape shuts the row.
              if (tagBox.onKeyDown(e)) return
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void postComment()
              }
            }}
            placeholder="Add a note…"
            disabled={posting}
            enterKeyHint="send"
            aria-label={`Add a note to ${item.title}`}
            style={{
              position: 'relative',
              flex: '1 1 auto',
              width: '100%',
              minWidth: 0,
              minHeight: 44,
              maxHeight: DRAFT_MAX_HEIGHT,
              resize: 'none',
              overflowY: 'auto',
              boxSizing: 'border-box',
              padding: '0.6rem 0.7rem',
              fontSize: '1rem',
              lineHeight: 1.35,
              fontFamily: 'inherit',
              border: '2px solid var(--text-600)',
              borderRadius: 10,
              background: 'transparent',
              color: 'var(--text-strong)',
            }}
          />
          </div>
          <div style={{ flex: '1 0 auto', display: 'flex', gap: '0.5rem' }}>
            {tagBox.atButton}
            <button
              type="button"
              onClick={() => void postComment()}
              disabled={posting || completing || !draft.trim()}
              style={{
                flex: '1 1 auto',
                height: 44,
                padding: '0 1rem',
                borderRadius: 10,
                border: 'none',
                background: posting || completing || !draft.trim() ? DEAD_PRESS_FILL : '#2563eb',
                color: posting || completing || !draft.trim() ? DEAD_PRESS_TEXT : 'white',
                fontSize: '0.9375rem',
                fontWeight: 600,
                cursor: posting || completing || !draft.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {posting ? '…' : 'Post'}
            </button>
            {canComplete ? (
              <button
                type="button"
                onClick={() => void completeTarget()}
                disabled={posting || completing}
                title={draft.trim() ? 'Post the note, then mark this task complete' : 'Mark this task complete'}
                style={{
                  flex: '1 1 auto',
                  height: 44,
                  padding: '0 1rem',
                  borderRadius: 10,
                  border: 'none',
                  background: posting || completing ? DEAD_PRESS_FILL : '#15803d',
                  color: posting || completing ? DEAD_PRESS_TEXT : 'white',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  cursor: posting || completing ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {completing ? '…' : draft.trim() ? '✓ Post & complete' : '✓ Complete'}
              </button>
            ) : null}
          </div>
        </div>
        </div>
      ) : null}
      {footerActions ? (
        <div style={{ display: 'flex', gap: '0.9rem', alignItems: 'center', marginTop: '0.55rem' }}>{footerActions}</div>
      ) : null}
    </div>
  )
}
