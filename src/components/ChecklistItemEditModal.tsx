import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { activeUsersQuery } from '../lib/people/fetchActiveUsers'
import { getNextDisplayOrders } from '../utils/checklistOrder'
import { originallyDueLine, summarizeDuePushes, type DueChangeRow } from '../lib/checklistDuePushes'
import { syncChecklistTitleTextareaHeight } from '../lib/syncChecklistTitleTextareaHeight'
import { applyEditRegeneration } from '../lib/checklistEditRegenerate'
import { dailyFromScope, dayBeforeApplicable, scopeFromDaily } from '../lib/checklistReminderOptions'
import { isAssistantLike } from '../lib/subcontractorLikeRole'
import { todayYmdInAppTz } from '../utils/dateUtils'
import { formatErrorMessage } from '../utils/errorHandling'
import { parseLines, type TaskCriterion } from '../lib/taskCriteria'
import { loadItemLines, syncItemLines } from '../lib/taskLinesIo'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import { useRecentTaskAssignees } from '../hooks/useRecentTaskAssignees'
import { newTaskSentence, taskPersonName } from '../lib/tasks/newTaskWindow'
import { DONE_WHEN_HINT } from '../lib/tasks/taskRowsOnAPhone'
import { TaskFormRows } from './checklist/newTask/TaskFormRows'
import { TaskSendBar } from './checklist/newTask/TaskSendBar'
import { TaskWindowClose, TaskWindowShell } from './checklist/newTask/TaskWindowShell'
import { TASK_WORDS_BOX_STYLE } from './checklist/newTask/taskWindowBits'
import { taskPlaceColumns, taskPlaceDraft, taskPlaceDraftChanged, type TaskPlaceDraft } from '../lib/tasks/taskPlace'
import { loadTaskPlace } from '../lib/tasks/taskPlaceIo'
import type { TaskSpotPhotoDraft } from './checklist/TaskSpotPhotoField'
import { loadTaskSpotPhotoPath, putTaskSpotPhoto, removeTaskSpotPhotoFile, saveTaskSpotPhotoPath, taskSpotPhotoUrls } from '../lib/tasks/taskSpotPhotoIo'

type UserRole =
  | 'dev'
  | 'master_technician'
  | 'assistant'
  | 'subcontractor'
  | 'helpers'
  | 'estimator'
  | 'primary'
  | 'superintendent'

type ChecklistItem = {
  id: string
  title: string
  links?: string[] | null
  created_by_user_id: string
  repeat_type: string
  repeat_days_of_week: number[] | null
  repeat_days_after: number | null
  repeat_end_date: string | null
  start_date: string
  due_date: string | null
  show_until_completed: boolean
  notify_on_complete_user_id: string | null
  notify_creator_on_complete: boolean
  reminder_time: string | null
  reminder_scope: string | null
  remind_day_before: boolean | null
  escalate_after_days: number | null
  created_at: string | null
  updated_at: string | null
  users?: { name: string; email: string } | null
}

type FormState = {
  title: string
  links: string[]
  /** Task cards (#273, PR 2): the Done when… lines, one a row, as typed. */
  lines: string
  /** The writer's switch (PR 4): the finish holds for a photo. */
  asks_for_photo: boolean
  assigned_to_user_ids: string[]
  repeat_type: 'day_of_week' | 'days_after_completion' | 'once'
  repeat_days_of_week: number[]
  repeat_days_after: number
  repeat_end_date: string
  start_date: string
  due_date: string
  show_until_completed: boolean
  notify_on_complete_user_id: string
  notify_creator_on_complete: boolean
  reminder_time: string
  reminder_daily: boolean
  remind_day_before: boolean
  escalate_enabled: boolean
  escalate_days: number
}

const initialForm: FormState = {
  title: '',
  links: [],
  lines: '',
  asks_for_photo: false,
  assigned_to_user_ids: [],
  repeat_type: 'once',
  repeat_days_of_week: [],
  repeat_days_after: 1,
  repeat_end_date: '',
  start_date: todayYmdInAppTz(),
  due_date: '',
  show_until_completed: true,
  notify_on_complete_user_id: '',
  notify_creator_on_complete: false,
  reminder_time: '',
  reminder_daily: true,
  remind_day_before: false,
  escalate_enabled: false,
  escalate_days: 3,
}

function populateForm(item: ChecklistItem, assigneeIds: string[]): FormState {
  const rt = item.reminder_time
  return {
    title: item.title.replace(/\n/g, ' '),
    links: item.links ?? [],
    lines: '',
    asks_for_photo: Boolean((item as { asks_for_photo?: boolean | null }).asks_for_photo),
    assigned_to_user_ids: assigneeIds,
    repeat_type: item.repeat_type as FormState['repeat_type'],
    repeat_days_of_week: item.repeat_days_of_week ?? [],
    repeat_days_after: item.repeat_days_after ?? 1,
    repeat_end_date: item.repeat_end_date ?? '',
    start_date: item.start_date,
    due_date: item.due_date ?? '',
    show_until_completed: item.show_until_completed ?? true,
    notify_on_complete_user_id: item.notify_on_complete_user_id ?? '',
    notify_creator_on_complete: item.notify_creator_on_complete,
    reminder_time: rt ? (rt.length === 5 ? rt : rt.slice(0, 5)) : '',
    reminder_daily: dailyFromScope(item.reminder_scope),
    remind_day_before: item.remind_day_before ?? false,
    escalate_enabled: item.escalate_after_days != null,
    escalate_days: item.escalate_after_days ?? 3,
  }
}

export function ChecklistItemEditModal({
  itemId,
  onClose,
  onSaved,
  setError,
  role,
}: {
  itemId: string | null
  onClose: () => void
  onSaved: () => void
  setError: (s: string | null) => void
  role: UserRole | null
}) {
  const titleInputRef = useRef<HTMLTextAreaElement | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  /** The card's live Done when… lines as loaded; Save diffs the typed lines against them. */
  const [existingLines, setExistingLines] = useState<TaskCriterion[]>([])
  // Punch list #328: the task's place as loaded and as the editor has it now. Save writes it only when it changed, so
  // an edit to the title leaves who placed it and when alone.
  const { user: authUser } = useAuth()
  const phone = useIsMobile()
  /** The same rows as the New task window (v2.7092): the faces want the people given to last and whoever has the task now. */
  const recentIds = useRecentTaskAssignees(authUser?.id ?? null, Boolean(itemId))
  const [loadedAssigneeIds, setLoadedAssigneeIds] = useState<string[]>([])
  /** Who gave the task. The bell beside Save is theirs. */
  const [creatorId, setCreatorId] = useState<string | null>(null)
  /** What went wrong on the last Save, shown in the bar. The page behind gets it too. */
  const [saveError, setSaveError] = useState<string | null>(null)
  const [loadedPlace, setLoadedPlace] = useState<TaskPlaceDraft | null>(null)
  const [place, setPlace] = useState<TaskPlaceDraft | null>(null)
  useEffect(() => {
    setLoadedPlace(null)
    setPlace(null)
    if (!itemId) return
    let cancelled = false
    void loadTaskPlace(itemId).then((p) => {
      if (cancelled) return
      const draft = taskPlaceDraft(p)
      setLoadedPlace(draft)
      setPlace(draft)
    })
    return () => {
      cancelled = true
    }
  }, [itemId])
  // PR 6: the photo of the spot, as loaded (its path) and as the editor has it now.
  const [loadedPhotoPath, setLoadedPhotoPath] = useState<string | null>(null)
  const [spotPhoto, setSpotPhoto] = useState<TaskSpotPhotoDraft | null>(null)
  useEffect(() => {
    setLoadedPhotoPath(null)
    setSpotPhoto(null)
    if (!itemId) return
    let cancelled = false
    void loadTaskSpotPhotoPath({ kind: 'item', id: itemId }).then(async (path) => {
      if (cancelled || !path) return
      const url = (await taskSpotPhotoUrls([path])).get(path) ?? null
      if (cancelled) return
      setLoadedPhotoPath(path)
      setSpotPhoto({ kind: 'saved', path, previewUrl: url })
    })
    return () => {
      cancelled = true
    }
  }, [itemId])
  /** Due-change ledger for this item (v2.2371) — powers the "originally due" line. */
  const [dueChanges, setDueChanges] = useState<DueChangeRow[]>([])
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [form, setForm] = useState<FormState>(initialForm)
  /** user ids among the assignees that have ≥1 push device (null = unknown/not fetched). */
  const [pushEnabledIds, setPushEnabledIds] = useState<Set<string> | null>(null)
  /** Same When grammar as the Add modal (v2.2075); derived from the stored item on open. */
  const [when, setWhen] = useState<'today' | 'date' | 'repeat'>('date')
  const [repeatMode, setRepeatMode] = useState<'weekly' | 'after_done'>('weekly')

  // Reachability (v2.2096): which assignees can this reminder actually reach?
  // push_subscriptions is SELECT-visible to dev/master/assistant-like only.
  const canSeeReach = role === 'dev' || role === 'master_technician' || isAssistantLike(role)
  useEffect(() => {
    if (!itemId || !canSeeReach || !form.reminder_time || form.assigned_to_user_ids.length === 0) {
      setPushEnabledIds(null)
      return
    }
    let cancelled = false
    void supabase
      .from('push_subscriptions')
      .select('user_id')
      .in('user_id', form.assigned_to_user_ids)
      .then(({ data }) => {
        if (cancelled) return
        setPushEnabledIds(new Set(((data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id)))
      })
    return () => {
      cancelled = true
    }
  }, [itemId, canSeeReach, form.reminder_time, form.assigned_to_user_ids])

  useEffect(() => {
    if (!itemId) return
    setLoading(true)
    setError(null)
    setSaveError(null)
    Promise.all([
      supabase
        .from('checklist_items')
        .select('id, title, links, created_by_user_id, repeat_type, repeat_days_of_week, repeat_days_after, repeat_end_date, start_date, due_date, show_until_completed, notify_on_complete_user_id, notify_creator_on_complete, reminder_time, reminder_scope, remind_day_before, escalate_after_days, created_at, updated_at, asks_for_photo')
        .eq('id', itemId)
        .single(),
      supabase.from('checklist_item_assignees').select('user_id').eq('checklist_item_id', itemId),
      // Tier-2 #19 (J30-2): assignee picker = active people (no twins); dev rows stay.
      activeUsersQuery('id, name, email', { includeDev: true, withLogin: true }),
      loadItemLines(itemId),
    ]).then(([itemRes, assigneesRes, usersRes, linesRows]) => {
      const item = itemRes.data as ChecklistItem | null
      const assigneeIds = (assigneesRes.data ?? []).map((r: { user_id: string }) => r.user_id)
      const usersData = (usersRes.data ?? []) as Array<{ id: string; name: string; email: string }>
      if (itemRes.error) {
        setError(itemRes.error.message)
        onClose()
        return
      }
      if (item) {
        setExistingLines(linesRows)
        setLoadedAssigneeIds(assigneeIds)
        setCreatorId(item.created_by_user_id)
        setForm({ ...populateForm(item, assigneeIds), lines: linesRows.map((l) => l.body).join('\n') })
        void supabase
          .from('checklist_item_due_changes')
          .select('changed_at, changed_by, from_due, to_due')
          .eq('checklist_item_id', item.id)
          .order('changed_at', { ascending: true })
          .then(({ data }) => setDueChanges((data ?? []) as DueChangeRow[]))
        const today = todayYmdInAppTz()
        if (item.repeat_type === 'day_of_week') {
          setWhen('repeat')
          setRepeatMode('weekly')
        } else if (item.repeat_type === 'days_after_completion') {
          setWhen('repeat')
          setRepeatMode('after_done')
        } else {
          setWhen(item.start_date === today ? 'today' : 'date')
        }
      }
      setUsers(usersData)
      setLoading(false)
    })
  }, [itemId, onClose, setError])

  useLayoutEffect(() => {
    if (!itemId) return
    syncChecklistTitleTextareaHeight(titleInputRef.current)
  }, [itemId, form.title])

  async function handleSave() {
    if (!itemId) return
    setError(null)
    setSaveError(null)
    if (form.assigned_to_user_ids.length === 0) {
      setError('Select at least one assignee.')
      return
    }
    const effRepeatType: 'once' | 'day_of_week' | 'days_after_completion' =
      when === 'repeat' ? (repeatMode === 'weekly' ? 'day_of_week' : 'days_after_completion') : 'once'
    const effStartDate = when === 'today' ? todayYmdInAppTz() : form.start_date
    // A due date implies staying on the list — a deadline is meaningless for a task that vanishes first (v2.2351).
    const effDueDate = when !== 'repeat' && form.due_date ? form.due_date : null
    const effShowUntil = when === 'repeat' ? false : effDueDate ? true : form.show_until_completed
    if (when === 'date' && !form.start_date) {
      setError('Pick a date.')
      return
    }
    if (effDueDate && effDueDate < effStartDate) {
      setError('The due date can’t be before the task starts.')
      return
    }
    if (effRepeatType === 'day_of_week' && form.repeat_days_of_week.length === 0) {
      setError('Pick at least one weekday.')
      return
    }
    setSaving(true)
    try {
      const reminderCols = {
        remind_day_before:
          Boolean(form.reminder_time) &&
          form.remind_day_before &&
          dayBeforeApplicable(when === 'repeat' ? 'repeat' : when, effStartDate, todayYmdInAppTz()),
        escalate_after_days: form.reminder_time && form.escalate_enabled ? Math.max(1, form.escalate_days) : null,
      }
      const { error } = await supabase
        .from('checklist_items')
        .update({
          ...reminderCols,
          title: form.title,
          links: form.links.filter(Boolean).length ? form.links.filter(Boolean) : [],
          // Task cards (#273, PR 4): the writer's switch; the column is younger than the generated types.
          ...({ asks_for_photo: form.asks_for_photo } as Record<string, boolean>),
          // A place (#328) is written only when the editor changed it; the columns are younger than the generated types.
          ...(taskPlaceDraftChanged(loadedPlace, place) ? (taskPlaceColumns(place, authUser?.id ?? null, new Date().toISOString()) as Record<string, unknown>) : {}),
          repeat_type: effRepeatType,
          repeat_days_of_week: effRepeatType === 'day_of_week' ? (form.repeat_days_of_week.length ? form.repeat_days_of_week : null) : null,
          repeat_days_after: effRepeatType === 'days_after_completion' ? form.repeat_days_after : null,
          repeat_end_date: effRepeatType === 'day_of_week' ? form.repeat_end_date || null : null,
          start_date: effStartDate,
          due_date: effDueDate,
          show_until_completed: effShowUntil,
          notify_on_complete_user_id: form.notify_on_complete_user_id || null,
          notify_creator_on_complete: form.notify_creator_on_complete,
          reminder_time: form.reminder_time || null,
          reminder_scope: form.reminder_time ? scopeFromDaily(form.reminder_daily) : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId)
      if (error) throw error
      // The photo of the spot (#328, PR 6): a new picture replaces the old one, and no picture takes it off.
      if (spotPhoto?.kind === 'new') {
        const put = await putTaskSpotPhoto({ kind: 'item', id: itemId }, spotPhoto.id, spotPhoto.blob)
        if ('error' in put) throw new Error(`The task was saved, but its photo was not: ${put.error}`)
        if (loadedPhotoPath) void removeTaskSpotPhotoFile(loadedPhotoPath)
      } else if (!spotPhoto && loadedPhotoPath) {
        const why = await saveTaskSpotPhotoPath({ kind: 'item', id: itemId }, null)
        if (why) throw new Error(`The task was saved, but its photo was not taken off: ${why}`)
        void removeTaskSpotPhotoFile(loadedPhotoPath)
      }
      // Task cards (#273, PR 2): the Done when… lines follow the edit; a ticked line gone is retired, never deleted.
      const lineErr = await syncItemLines(itemId, existingLines, parseLines(form.lines))
      if (lineErr) throw new Error(lineErr)
      await supabase.from('checklist_item_assignees').delete().eq('checklist_item_id', itemId)
      if (form.assigned_to_user_ids.length > 0) {
        const nextOrders = await getNextDisplayOrders(form.assigned_to_user_ids)
        await supabase.from('checklist_item_assignees').insert(
          form.assigned_to_user_ids.map((uid) => ({
            checklist_item_id: itemId,
            user_id: uid,
            display_order: nextOrders.get(uid) ?? 1,
          }))
        )
      }
      // v2.2057: make the occurrences follow the edit — before this, changing
      // days/dates/people updated the template only and every occurrence kept
      // the old schedule and roster.
      const regen = await applyEditRegeneration(
        itemId,
        {
          repeat_type: effRepeatType,
          repeat_days_of_week: effRepeatType === 'day_of_week' ? form.repeat_days_of_week : null,
          start_date: effStartDate,
          repeat_end_date: effRepeatType === 'day_of_week' ? form.repeat_end_date || null : null,
        },
        form.assigned_to_user_ids,
      )
      if (!regen.ok) throw new Error(regen.error ?? 'Failed to update occurrences')
      window.dispatchEvent(new Event('checklist-item-saved'))
      onSaved()
      onClose()
    } catch (err) {
      const why = formatErrorMessage(err, 'Failed to save')
      setError(why)
      setSaveError(why)
    } finally {
      setSaving(false)
    }
  }

  if (!itemId) return null
  if (loading) return <p style={{ padding: '2rem' }}>Loading…</p>

  const todayStr = todayYmdInAppTz()
  const meId = authUser?.id ?? null
  const nameOf = (id: string) => taskPersonName(users.find((u) => u.id === id))
  // The bell is the giver's: *When it's done, notify the creator*. An edit by someone else names the giver.
  const giverIsMe = !creatorId || creatorId === meId
  const giverName = giverIsMe ? null : nameOf(creatorId)
  const onlyGivers = form.assigned_to_user_ids.length === 1 && form.assigned_to_user_ids[0] === (creatorId ?? meId)
  const sentence = newTaskSentence({
    meId,
    assigneeIds: form.assigned_to_user_ids,
    nameOf,
    title: form.title,
    when,
    repeatMode,
    startDate: form.start_date,
    todayStr,
    daysOfWeek: form.repeat_days_of_week,
    daysAfter: form.repeat_days_after,
    endDate: form.repeat_end_date || null,
    staysUntilDone: form.due_date ? true : form.show_until_completed,
    dueDate: when !== 'repeat' ? form.due_date || null : null,
    lineCount: parseLines(form.lines).length,
    asksForPhoto: form.asks_for_photo,
    tellMe: form.notify_creator_on_complete && !onlyGivers,
    tellOtherName: form.notify_on_complete_user_id ? nameOf(form.notify_on_complete_user_id) : null,
    giverName,
  })
  const dueLine = when !== 'repeat' && form.due_date ? originallyDueLine(summarizeDuePushes(dueChanges, form.due_date)) : null

  return (
    <TaskWindowShell
      titleId="checklist-edit-modal-title"
      title="Edit task"
      phone={phone}
      zIndex={1000}
      onBackdrop={onClose}
      cardTestId="checklist-edit-modal-card"
      headActions={<TaskWindowClose onClose={onClose} />}
      bar={
        <TaskSendBar
          sentence={sentence.text}
          dead={sentence.dead}
          label="Save"
          busyLabel="Saving…"
          submitting={saving}
          onSend={handleSave}
          tellMe={onlyGivers ? null : form.notify_creator_on_complete}
          tellLabel={giverName ? `Tell ${giverName}` : 'Tell me'}
          onTellMe={(next) => setForm((f) => ({ ...f, notify_creator_on_complete: next }))}
          error={saveError}
        />
      }
    >
      <div style={{ paddingBottom: 12 }}>
        <textarea
          ref={titleInputRef}
          aria-label="Task"
          value={form.title}
          onChange={(e) => {
            const t = e.target.value.replace(/\n/g, ' ')
            setForm((f) => ({ ...f, title: t }))
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.preventDefault()
          }}
          rows={2}
          placeholder="What needs to be done?"
          style={TASK_WORDS_BOX_STYLE}
        />
      </div>
      <TaskFormRows
        key={itemId}
        value={form}
        onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
        when={when}
        onWhen={setWhen}
        repeatMode={repeatMode}
        onRepeatMode={setRepeatMode}
        linesText={form.lines}
        onLinesText={(lines) => setForm((f) => ({ ...f, lines }))}
        linesHint={DONE_WHEN_HINT.edit}
        asksForPhoto={form.asks_for_photo}
        onAsksForPhoto={(asks_for_photo) => setForm((f) => ({ ...f, asks_for_photo }))}
        place={place}
        onPlace={setPlace}
        spotPhoto={spotPhoto}
        onSpotPhoto={setSpotPhoto}
        busy={saving}
        users={users}
        meId={meId}
        recentIds={recentIds}
        // Whoever has the task now keeps a face, recent or not.
        seatIds={loadedAssigneeIds}
        // An edit adds a person beside whoever has the task. It never takes the editor off by itself.
        soloSelfRule={false}
        canSeeReach={canSeeReach}
        pushEnabledIds={pushEnabledIds}
        phone={phone}
        todayStr={todayStr}
        searchId="checklist-edit-assign-search"
        onLinkToken={(i) => {
          const input = titleInputRef.current
          if (!input) return
          const start = input.selectionStart ?? form.title.length
          const end = input.selectionEnd ?? form.title.length
          const placeholder = `[${i + 1}]`
          const newTitle = form.title.slice(0, start) + placeholder + form.title.slice(end)
          setForm((f) => ({ ...f, title: newTitle }))
          setTimeout(() => {
            input.focus()
            const pos = start + placeholder.length
            input.setSelectionRange(pos, pos)
          }, 0)
        }}
        dueNote={
          dueLine ? (
            <div data-testid="edit-task-originally-due" style={{ fontSize: '0.8125rem', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', border: '1px solid #d97706', borderRadius: 8, padding: '0.45rem 0.7rem' }}>
              {dueLine}
            </div>
          ) : null
        }
        whenNote="Saving reshapes the days still to come. The ones already done keep their notes."
      />
    </TaskWindowShell>
  )
}
