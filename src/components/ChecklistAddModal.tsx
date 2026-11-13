import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { activeUsersQuery } from '../lib/people/fetchActiveUsers'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import { useChecklistAddModal } from '../contexts/ChecklistAddModalContext'
import { getNextDisplayOrders } from '../utils/checklistOrder'
import { syncChecklistTitleTextareaHeight } from '../lib/syncChecklistTitleTextareaHeight'
import { isAssistantLike } from '../lib/subcontractorLikeRole'
import { MATERIALIZE_HORIZON_DAYS, materializeDates } from '../lib/checklistMaterialize'
import { dayBeforeApplicable, scopeFromDaily } from '../lib/checklistReminderOptions'
import { ymdAddDays } from '../utils/dateUtils'
import { checklistJobLinks, composeChecklistJobTitle, type ChecklistJobPreset } from '../lib/checklistJobPreset'
import { parseLines } from '../lib/taskCriteria'
import { writeItemLines } from '../lib/taskLinesIo'
import { asksForPhotoDefault } from '../lib/taskProgress'
import { taskPlaceColumns, type TaskPlaceDraft } from '../lib/tasks/taskPlace'
import type { TaskSpotPhotoDraft } from './checklist/TaskSpotPhotoField'
import { putTaskSpotPhoto } from '../lib/tasks/taskSpotPhotoIo'
import { newTaskSentence, taskPersonName, taskSendLabel, type TaskAddKey } from '../lib/tasks/newTaskWindow'
import { useRecentTaskAssignees } from '../hooks/useRecentTaskAssignees'
import { TaskFormRows } from './checklist/newTask/TaskFormRows'
import { TASK_WORDS_BOX_STYLE, focusPeopleSearchIfOpen } from './checklist/newTask/taskWindowBits'
import { TaskSendBar } from './checklist/newTask/TaskSendBar'
import { TaskWindowClose, TaskWindowShell } from './checklist/newTask/TaskWindowShell'
import { ADD_TASK_PICKER_Z, ADD_TASK_WINDOW_Z } from '../lib/windowLayers'

const FALLBACK_ASSIGNEE_EMAIL = 'taunya@clickplumbing.com'

function getDefaultAssigneeId(
  initialAssigneeUserId: string | null,
  users: Array<{ id: string; email?: string }>,
  currentUserId: string | null
): string | null {
  // Send task flow: use passed userId if valid
  if (initialAssigneeUserId && users.some((u) => u.id === initialAssigneeUserId)) {
    return initialAssigneeUserId
  }
  // Add checklist flow: current user first
  if (currentUserId && users.some((u) => u.id === currentUserId)) {
    return currentUserId
  }
  // Fallback: Taunya by email
  const taunya = users.find((u) => u.email?.toLowerCase() === FALLBACK_ASSIGNEE_EMAIL)
  return taunya?.id ?? users[0]?.id ?? null
}

function toLocalDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

type UserRole =
  | 'dev'
  | 'master_technician'
  | 'assistant'
  | 'subcontractor'
  | 'helpers'
  | 'estimator'
  | 'primary'

export default function ChecklistAddModal({
  overlayBackground = 'rgba(0,0,0,0.5)',
  goToChecklistKeepsModalOpen = true,
}: { overlayBackground?: string; goToChecklistKeepsModalOpen?: boolean } = {}) {
  const { user: authUser } = useAuth()
  const navigate = useNavigate()
  const phone = useIsMobile()
  const modalContext = useChecklistAddModal()
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([])
  /** The faces (v2.7085): the people given to last, newest task first, in place of three names in the order the rows came back. */
  const recentAssigneeIds = useRecentTaskAssignees(authUser?.id ?? null, Boolean(modalContext?.isOpen))
  const [role, setRole] = useState<UserRole | null>(null)
  /** user ids among the assignees that have ≥1 push device (null = unknown/not fetched). */
  const [pushEnabledIds, setPushEnabledIds] = useState<Set<string> | null>(null)
  /** The rows under the words (v2.7085) keep what is open themselves. A new open of the window gives them a new key, so they start closed. */
  const [rowsKey, setRowsKey] = useState(0)
  /** The press of the Add row the rows open with: the links, for a task that arrives with some. */
  const [rowsOpen, setRowsOpen] = useState<TaskAddKey | null>(null)
  /** People who get a face though they are not recent: whoever the window opened on. */
  const [seatIds, setSeatIds] = useState<string[]>([])
  /** Task cards (#273, PR 2): the Done when… lines, one a row; each becomes a box the person ticks. */
  const [linesText, setLinesText] = useState('')
  const lineCount = parseLines(linesText).length
  /** The writer's switch (PR 4): on by itself once a line is written, off on a plain one-off, until the writer touches it. */
  const [asksForPhotoPick, setAsksForPhotoPick] = useState<boolean | null>(null)
  // Punch list #328: where the work is. Null is a task with no place, the default.
  const [place, setPlace] = useState<TaskPlaceDraft | null>(null)
  // PR 6: the giver's photo of the spot, held here until the task has an id to file it under.
  const [spotPhoto, setSpotPhoto] = useState<TaskSpotPhotoDraft | null>(null)
  const asksForPhoto = asksForPhotoPick ?? asksForPhotoDefault(lineCount)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const titleInputRef = useRef<HTMLTextAreaElement | null>(null)
  const saveButtonRef = useRef<HTMLButtonElement>(null)
  /** Tab cycles title → people search (when the full list is open) → Send → title (Shift+Tab reverses); other controls stay mouse-reachable. */
  const ASSIGN_SEARCH_ID = 'checklist-add-assign-search'
  const [form, setForm] = useState({
    title: '',
    links: [] as string[],
    /** The job bar (v2.3751): set by a "send this job as a task" door; Send composes `{{1:<num · name>}} — <title>` around it. */
    job: null as ChecklistJobPreset | null,
    assigned_to_user_ids: [] as string[],
    repeat_type: 'once' as 'day_of_week' | 'days_after_completion' | 'once',
    repeat_days_of_week: [] as number[],
    repeat_days_after: 1,
    repeat_end_date: '',
    start_date: toLocalDateString(new Date()),
    due_date: '',
    show_until_completed: true,
    notify_on_complete_user_id: '',
    notify_creator_on_complete: true,
    reminder_time: '',
    reminder_daily: true,
    remind_day_before: false,
    escalate_enabled: false,
    escalate_days: 3,
  })
  /** The When control (v2.2058): scheduling is first-class, not "Advanced". */
  const [when, setWhen] = useState<'today' | 'date' | 'repeat'>('today')
  const [repeatMode, setRepeatMode] = useState<'weekly' | 'after_done'>('weekly')

  const canManage = useMemo(
    () =>
      role === 'dev' ||
      role === 'master_technician' ||
      isAssistantLike(role) ||
      role === 'primary' ||
      role === 'estimator' ||
      role === 'subcontractor' ||
      role === 'helpers',
    [role],
  )

  // Reachability (v2.2096): which assignees can this reminder actually reach?
  // push_subscriptions is SELECT-visible to dev/master/assistant-like only.
  const canSeeReach = role === 'dev' || role === 'master_technician' || isAssistantLike(role)
  useEffect(() => {
    if (!modalContext?.isOpen || !canSeeReach || !form.reminder_time || form.assigned_to_user_ids.length === 0) {
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
  }, [modalContext?.isOpen, canSeeReach, form.reminder_time, form.assigned_to_user_ids])

  useEffect(() => {
    if (!modalContext?.isOpen) return
    // Tier-2 #19 (J30-2): assignee picker = active people (no twins); dev rows stay — tasks go to the owner.
    activeUsersQuery('id, name, email', { includeDev: true, withLogin: true })
      .then(({ data }) => {
        setUsers((data ?? []) as Array<{ id: string; name: string; email: string }>)
      })
    if (authUser?.id) {
      supabase.from('users').select('role').eq('id', authUser.id).single().then(({ data }) => {
        setRole((data as { role: UserRole } | null)?.role ?? null)
      })
    }
  }, [modalContext?.isOpen, authUser?.id])

  useEffect(() => {
    if (modalContext?.isOpen && users.length > 0 && form.assigned_to_user_ids.length === 0) {
      const defaultId = getDefaultAssigneeId(
        modalContext.initialAssigneeUserId,
        users,
        authUser?.id ?? null
      )
      if (defaultId) {
        setForm((f) => ({ ...f, assigned_to_user_ids: [defaultId] }))
        setSeatIds((prev) => (prev.includes(defaultId) ? prev : [...prev, defaultId]))
      }
    }
  }, [modalContext?.isOpen, modalContext?.initialAssigneeUserId, users, form.assigned_to_user_ids.length, authUser?.id])

  /**
   * One reset per open (v2.2195): this effect's deps include `users` and
   * `authUser` so the default assignee can be computed, but their async
   * settling used to RE-FIRE the reset and wipe a draft the user was already
   * typing (the CI flake that blocked three unrelated merges on 2026-08-23 —
   * and a real wipe on slow connections). The key guards: reset only when the
   * modal (re)opens or its preset changes; the effect below fills the default
   * assignee when the roster lands later.
   */
  const formResetKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (!modalContext?.isOpen) {
      formResetKeyRef.current = null
      return
    }
    {
      const resetKey = JSON.stringify([
        modalContext.initialAssigneeUserId ?? null,
        modalContext.initialPreset ?? null,
      ])
      if (formResetKeyRef.current === resetKey) return
      formResetKeyRef.current = resetKey
    }
    {
      const defaultAssignee = getDefaultAssigneeId(
        modalContext.initialAssigneeUserId,
        users,
        authUser?.id ?? null
      )
      const preset = modalContext.initialPreset
      const presetLinks = preset?.links?.filter((u) => u.trim()) ?? []
      setForm({
        title: preset?.title ?? '',
        links: presetLinks.length ? [...presetLinks] : [],
        job: preset?.job ?? null,
        assigned_to_user_ids: defaultAssignee ? [defaultAssignee] : [],
        repeat_type: 'once',
        repeat_days_of_week: [],
        repeat_days_after: 1,
        repeat_end_date: '',
        start_date: toLocalDateString(new Date()),
        due_date: '',
        show_until_completed: true,
        notify_on_complete_user_id: '',
        notify_creator_on_complete: true,
        reminder_time: '',
        reminder_daily: true,
        remind_day_before: false,
        escalate_enabled: false,
        escalate_days: 3,
      })
      setFormError(null)
      setPlace(null)
      setSpotPhoto(null)
      // The job bar already shows its link, so the links stay closed behind it (v2.3751).
      setRowsOpen(presetLinks.length > 0 && !preset?.job ? 'link' : null)
      setSeatIds(defaultAssignee ? [defaultAssignee] : [])
      setRowsKey((k) => k + 1)
      setWhen(preset?.when ?? 'today')
      setRepeatMode('weekly')
    }
  }, [
    modalContext?.isOpen,
    modalContext?.initialAssigneeUserId,
    modalContext?.initialPreset,
    users,
    authUser?.id,
  ])

  useLayoutEffect(() => {
    if (!modalContext?.isOpen) return
    syncChecklistTitleTextareaHeight(titleInputRef.current)
  }, [modalContext?.isOpen, form.title])

  useLayoutEffect(() => {
    if (!modalContext?.isOpen || !canManage) return
    // Focus immediately, then retry across the next two frames so it still lands when the
    // field mounts/paints late — e.g. the slower async standalone-PWA open (auth → role → users).
    const focusTitle = () => titleInputRef.current?.focus({ preventScroll: true })
    focusTitle()
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      focusTitle()
      raf2 = requestAnimationFrame(focusTitle)
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [modalContext?.isOpen, canManage])

  async function generateInstances(itemId: string, item: typeof form) {
    const assigneeIds = item.assigned_to_user_ids?.length ? item.assigned_to_user_ids : []
    if (assigneeIds.length === 0) return

    // Shared kernel (v2.2055) — string-date math fixes the old UTC-anchor bug
    // where a weekly item could materialize a day before its chosen start.
    const instanceDates = materializeDates(
      {
        repeat_type: item.repeat_type,
        repeat_days_of_week: item.repeat_days_of_week,
        start_date: item.start_date,
        repeat_end_date: item.repeat_end_date || null,
      },
      item.start_date,
      // Rolling horizon (v2.2056): create only the near window; the nightly
      // cron top-up keeps weekly items stocked ahead forever — no more
      // two-year cliff, no more years of empty future rows.
      ymdAddDays(item.start_date, MATERIALIZE_HORIZON_DAYS),
    )

    for (const scheduledDate of instanceDates) {
      // Upsert against the (item, date) unique index — idempotent by construction.
      const { data: inst } = await supabase
        .from('checklist_instances')
        .upsert(
          { checklist_item_id: itemId, scheduled_date: scheduledDate },
          { onConflict: 'checklist_item_id,scheduled_date', ignoreDuplicates: false },
        )
        .select('id')
        .single()
      if (inst?.id) {
        await supabase.from('checklist_instance_assignees').insert(
          assigneeIds.map((uid) => ({ checklist_instance_id: inst.id, user_id: uid }))
        )
      }
    }
  }

  async function saveItem() {
    if (!authUser?.id || !modalContext) return
    if (submitting) return
    setFormError(null)
    const trimmedTitle = form.title.trim()
    if (!trimmedTitle) {
      setFormError('Enter a title.')
      return
    }
    // The job bar stores the pre-v2.3751 shape — the token, the dash, the typed
    // text, the job as link [1] — so nothing downstream sees a change.
    const storedTitle = form.job ? composeChecklistJobTitle(form.job, trimmedTitle) : trimmedTitle
    const storedLinks = form.job ? checklistJobLinks(form.job, form.links) : form.links.filter(Boolean)
    if (form.assigned_to_user_ids.length === 0) {
      setFormError('Select at least one assignee.')
      return
    }
    // The When control maps onto the stored repeat fields (v2.2058).
    const effRepeatType: 'once' | 'day_of_week' | 'days_after_completion' =
      when === 'repeat' ? (repeatMode === 'weekly' ? 'day_of_week' : 'days_after_completion') : 'once'
    const effStartDate = when === 'today' ? toLocalDateString(new Date()) : form.start_date
    // A due date implies staying on the list — a deadline is meaningless for a task that vanishes first (v2.2351).
    const effDueDate = when !== 'repeat' && form.due_date ? form.due_date : null
    const effShowUntil = when === 'repeat' ? false : effDueDate ? true : form.show_until_completed
    if (when === 'date' && !form.start_date) {
      setFormError('Pick a date.')
      return
    }
    if (effDueDate && effDueDate < effStartDate) {
      setFormError('The due date can’t be before the task starts.')
      return
    }
    if (effRepeatType === 'day_of_week' && form.repeat_days_of_week.length === 0) {
      setFormError('Pick at least one weekday.')
      return
    }
    setSubmitting(true)
    try {
      const reminderCols = {
        remind_day_before:
          Boolean(form.reminder_time) && form.remind_day_before && dayBeforeApplicable(when, effStartDate, toLocalDateString(new Date())),
        escalate_after_days: form.reminder_time && form.escalate_enabled ? Math.max(1, form.escalate_days) : null,
      }
      const { data, error } = await supabase
        .from('checklist_items')
        .insert({
          ...reminderCols,
          title: storedTitle,
          links: storedLinks,
          // Task cards (#273, PR 4): the writer's switch; the column is younger than the generated types.
          ...({ asks_for_photo: asksForPhoto } as Record<string, boolean>),
          // A place (#328) is written only when one is set, so a task with none sends the row it always sent. The columns
          // are younger than the generated types.
          ...(place ? (taskPlaceColumns(place, authUser.id, new Date().toISOString()) as Record<string, unknown>) : {}),
          created_by_user_id: authUser.id,
          repeat_type: effRepeatType,
          repeat_days_of_week: effRepeatType === 'day_of_week' && form.repeat_days_of_week.length ? form.repeat_days_of_week : null,
          repeat_days_after: effRepeatType === 'days_after_completion' ? form.repeat_days_after : null,
          repeat_end_date: effRepeatType === 'day_of_week' ? form.repeat_end_date || null : null,
          start_date: effStartDate,
          due_date: effDueDate,
          show_until_completed: effShowUntil,
          notify_on_complete_user_id: form.notify_on_complete_user_id || null,
          notify_creator_on_complete: form.notify_creator_on_complete,
          reminder_time: form.reminder_time || null,
          reminder_scope: form.reminder_time ? scopeFromDaily(form.reminder_daily) : null,
        })
        .select('id')
        .single()
      if (error) {
        setFormError(error.message)
        return
      }
      const newId = (data as { id: string })?.id
      if (newId) {
        const nextOrders = await getNextDisplayOrders(form.assigned_to_user_ids)
        await supabase.from('checklist_item_assignees').insert(
          form.assigned_to_user_ids.map((uid) => ({
            checklist_item_id: newId,
            user_id: uid,
            display_order: nextOrders.get(uid) ?? 1,
          }))
        )
        await generateInstances(newId, { ...form, repeat_type: effRepeatType, start_date: effStartDate, repeat_end_date: effRepeatType === 'day_of_week' ? form.repeat_end_date : '' })
        // The photo of the spot (#328, PR 6) is filed under the task's id, so it goes now. The task is sent either way; a
        // photo that did not land says so and leaves the dialog open, since sending again would make a second task.
        if (spotPhoto?.kind === 'new') {
          const put = await putTaskSpotPhoto({ kind: 'item', id: newId }, spotPhoto.id, spotPhoto.blob)
          if ('error' in put) {
            setFormError(`The task was sent, but its photo did not save: ${put.error} Add it from Checklist → Manage → Edit.`)
            setSpotPhoto(null)
            modalContext.onSaved?.(newId)
            window.dispatchEvent(new CustomEvent('checklist-item-saved'))
            return
          }
        }
        // Task cards (#273, PR 2): the Done when… lines. The task is sent either way; a line that did not land says so
        // and leaves the dialog open, since sending again would make a second task.
        const lines = parseLines(linesText)
        if (lines.length > 0) {
          const lineErr = await writeItemLines(newId, lines, authUser.id)
          if (lineErr) {
            setFormError(`The task was sent, but its Done when… lines did not save: ${lineErr} Add them from Checklist → Manage → Edit.`)
            modalContext.onSaved?.(newId)
            window.dispatchEvent(new CustomEvent('checklist-item-saved'))
            return
          }
        }
      }
      setLinesText('')
      setAsksForPhotoPick(null)
      setPlace(null)
      setSpotPhoto(null)
      modalContext.onSaved?.(newId || undefined)
      modalContext.closeModal()
      window.dispatchEvent(new CustomEvent('checklist-item-saved'))
    } finally {
      setSubmitting(false)
    }
  }

  if (!modalContext?.isOpen) return null

  if (!canManage) return null

  const todayStr = toLocalDateString(new Date())
  const meId = authUser?.id ?? null
  const nameOf = (id: string) => taskPersonName(users.find((u) => u.id === id))
  const onlyMine = form.assigned_to_user_ids.length === 1 && form.assigned_to_user_ids[0] === meId
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
    lineCount,
    asksForPhoto,
    tellMe: form.notify_creator_on_complete,
    tellOtherName: form.notify_on_complete_user_id ? nameOf(form.notify_on_complete_user_id) : null,
  })

  return (
    <TaskWindowShell
      titleId="checklist-add-modal-title"
      title="New task"
      phone={phone}
      // Above Job Detail (1004) and Edit Job (1010) so the header send-as-task buttons stack this over either
      // (v2.1529), and above a thread's window (1200) so Ask a tech… and Send as a task do too (v2.7069).
      zIndex={ADD_TASK_WINDOW_Z}
      overlayBackground={overlayBackground}
      // No close on backdrop click (v2.2742): a stray tap outside used to throw the
      // draft away. Close is the × in the header or a successful Send.
      cardTestId="checklist-add-modal-card"
      headActions={
        <>
          {/* Header Send (v2.2740): a second Send at the top of a phone, once a title is typed. The bar's Send
              sits above the keyboard since v2.7085; this one stays until a walk on a real phone shows that holds. */}
          {phone && form.title.trim() ? (
            <button
              type="button"
              onClick={saveItem}
              disabled={submitting}
              aria-label="Send"
              style={{
                padding: '0.3rem 0.85rem',
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: 999,
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? 'Sending…' : 'Send'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              // Navigate the page behind but keep the modal (and its draft) open, so a
              // mis-click costs nothing. The standalone /task shortcut page unmounts on
              // navigation, so it opts out and keeps the old close-then-go behavior.
              if (goToChecklistKeepsModalOpen) {
                navigate('/checklist?tab=today')
                titleInputRef.current?.focus({ preventScroll: true })
              } else {
                modalContext.closeModal()
                navigate('/checklist')
              }
            }}
            aria-label="Go to checklist"
            title="Go to checklist"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              padding: '0.25rem',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              lineHeight: 0,
              flexShrink: 0,
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1.25em" height="1.25em" fill="currentColor" aria-hidden="true">
              <path d="M197.8 100.3C208.7 107.9 211.3 122.9 203.7 133.7L147.7 213.7C143.6 219.5 137.2 223.2 130.1 223.8C123 224.4 116 222 111 217L71 177C61.7 167.6 61.7 152.4 71 143C80.3 133.6 95.6 133.7 105 143L124.8 162.8L164.4 106.2C172 95.3 187 92.7 197.8 100.3zM197.8 260.3C208.7 267.9 211.3 282.9 203.7 293.7L147.7 373.7C143.6 379.5 137.2 383.2 130.1 383.8C123 384.4 116 382 111 377L71 337C61.6 327.6 61.6 312.4 71 303.1C80.4 293.8 95.6 293.7 104.9 303.1L124.7 322.9L164.3 266.3C171.9 255.4 186.9 252.8 197.7 260.4zM288 160C288 142.3 302.3 128 320 128L544 128C561.7 128 576 142.3 576 160C576 177.7 561.7 192 544 192L320 192C302.3 192 288 177.7 288 160zM288 320C288 302.3 302.3 288 320 288L544 288C561.7 288 576 302.3 576 320C576 337.7 561.7 352 544 352L320 352C302.3 352 288 337.7 288 320zM224 480C224 462.3 238.3 448 256 448L544 448C561.7 448 576 462.3 576 480C576 497.7 561.7 512 544 512L256 512C238.3 512 224 497.7 224 480zM128 440C150.1 440 168 457.9 168 480C168 502.1 150.1 520 128 520C105.9 520 88 502.1 88 480C88 457.9 105.9 440 128 440z"/>
            </svg>
          </button>
          <TaskWindowClose onClose={() => modalContext.closeModal()} />
        </>
      }
      bar={
        <TaskSendBar
          sentence={sentence.text}
          dead={sentence.dead}
          label={taskSendLabel({ meId, assigneeIds: form.assigned_to_user_ids, nameOf })}
          submitting={submitting}
          onSend={saveItem}
          tellMe={onlyMine ? null : form.notify_creator_on_complete}
          onTellMe={(next) => setForm((f) => ({ ...f, notify_creator_on_complete: next }))}
          error={formError}
          sendRef={saveButtonRef}
          onSendKeyDown={(e) => {
            if (e.key !== 'Tab') return
            e.preventDefault()
            if (!(e.shiftKey && focusPeopleSearchIfOpen(ASSIGN_SEARCH_ID))) titleInputRef.current?.focus()
          }}
        />
      }
    >
      {form.job ? (
        /* The job bar (v2.3751): the job a door opened with, as the pipeline row
           shows it — number pill, name, address · customer — with a door to the
           job and a × for "not about this job after all". The title box below
           holds only the task. */
        <div
          role="group"
          aria-label="Job"
          data-testid="checklist-add-job-bar"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.4rem 0.5rem',
            marginBottom: '0.5rem',
            border: '1px solid rgba(124, 58, 237, 0.35)',
            borderRadius: 8,
            background: 'rgba(124, 58, 237, 0.08)',
          }}
        >
          <span
            aria-hidden
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 22,
              height: 22,
              borderRadius: 6,
              background: '#7c3aed',
              color: 'white',
              flexShrink: 0,
              lineHeight: 0,
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={13} height={13} fill="currentColor" aria-hidden>
              <path d="M128 96C110.3 96 96 110.3 96 128L96 544C96 561.7 110.3 576 128 576C145.7 576 160 561.7 160 544L160 416L480 416C497.7 416 512 401.7 512 384C512 379.3 511 374.8 509.1 370.8L448 256L509.1 141.2C511 137.2 512 132.7 512 128C512 110.3 497.7 96 480 96L128 96z" />
            </svg>
          </span>
          <div style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
              {form.job.number ? (
                <span
                  style={{
                    display: 'inline-block',
                    padding: '0.15rem 0.4rem',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    lineHeight: 1.2,
                    borderRadius: 4,
                    letterSpacing: '0.02em',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    border: form.job.trade ? '1px solid rgba(255,255,255,0.5)' : '1px solid var(--border-strong)',
                    background: form.job.trade ? form.job.trade.color : 'var(--bg-muted)',
                    color: form.job.trade ? '#fff' : 'var(--text-700)',
                  }}
                >
                  {form.job.number}
                  {form.job.trade ? ` ${form.job.trade.tag}` : ''}
                </span>
              ) : null}
              <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {form.job.name}
              </span>
            </div>
            {form.job.address || form.job.customer ? (
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {[form.job.address, form.job.customer].filter(Boolean).join(' · ')}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => {
              // Same rule as "Go to checklist": the page behind navigates, the
              // dialog and its draft stay open (the standalone /task page opts out).
              const path = form.job?.path
              if (!path) return
              if (goToChecklistKeepsModalOpen) {
                navigate(path)
                titleInputRef.current?.focus({ preventScroll: true })
              } else {
                modalContext.closeModal()
                navigate(path)
              }
            }}
            aria-label="Open the job"
            title="Open the job"
            style={{
              background: 'none',
              border: 'none',
              padding: '0.25rem 0.15rem',
              color: '#7c3aed',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            open ↗
          </button>
          <button
            type="button"
            onClick={() =>
              setForm((f) => ({
                ...f,
                job: null,
                links: f.links.filter((u) => u !== f.job?.url),
              }))
            }
            aria-label="Remove job"
            title="Not about this job"
            style={{
              background: 'none',
              border: 'none',
              padding: '0 0.25rem',
              color: 'var(--text-muted)',
              fontSize: '1.25rem',
              lineHeight: 1,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
      ) : null}
      <div style={{ paddingBottom: 12 }}>
        <textarea
          ref={titleInputRef}
          autoFocus
          aria-label="Checklist item title"
          value={form.title}
          onChange={(e) => {
            const t = e.target.value.replace(/\n/g, ' ')
            setForm((f) => ({ ...f, title: t }))
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.preventDefault()
            if (e.key === 'Tab') {
              e.preventDefault()
              if (e.shiftKey || !focusPeopleSearchIfOpen(ASSIGN_SEARCH_ID)) saveButtonRef.current?.focus()
            }
          }}
          rows={2}
          placeholder={form.job ? 'What needs doing on this job?' : 'What needs to be done?'}
          style={TASK_WORDS_BOX_STYLE}
        />
      </div>
      <TaskFormRows
        key={rowsKey}
        value={form}
        onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
        when={when}
        onWhen={setWhen}
        repeatMode={repeatMode}
        onRepeatMode={setRepeatMode}
        linesText={linesText}
        onLinesText={setLinesText}
        linesHint="The card reads its percent from the ticks. Leave this empty and the person sets the percent by hand. A photo is offered at each new percent on every card. With Photo at the finish on, the finish holds until a photo is in or a reason is typed."
        asksForPhoto={asksForPhoto}
        onAsksForPhoto={setAsksForPhotoPick}
        place={place}
        onPlace={setPlace}
        spotPhoto={spotPhoto}
        onSpotPhoto={setSpotPhoto}
        busy={submitting}
        users={users}
        meId={meId}
        recentIds={recentAssigneeIds}
        seatIds={seatIds}
        soloSelfRule
        canSeeReach={canSeeReach}
        pushEnabledIds={pushEnabledIds}
        phone={phone}
        todayStr={todayStr}
        searchId={ASSIGN_SEARCH_ID}
        onSearchTab={(shift) => (shift ? titleInputRef.current : saveButtonRef.current)?.focus()}
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
        initialOpen={rowsOpen}
        // What the rows open through a portal, the notify list and the place sheet, sits over this window (v2.7069).
        pickerZIndex={ADD_TASK_PICKER_Z}
      />
    </TaskWindowShell>
  )
}
