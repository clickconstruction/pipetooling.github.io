import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useChecklistAddModal } from '../contexts/ChecklistAddModalContext'
import { getNextDisplayOrders } from '../utils/checklistOrder'
import { SearchableMultiSelect } from './SearchableMultiSelect'
import { SearchableSelect } from './SearchableSelect'
import { syncChecklistTitleTextareaHeight } from '../lib/syncChecklistTitleTextareaHeight'
import { isAssistantLike } from '../lib/subcontractorLikeRole'
import { MATERIALIZE_HORIZON_DAYS, materializeDates } from '../lib/checklistMaterialize'
import { checklistScheduleSummary, startNotOnChosenDay } from '../lib/checklistScheduleSummary'
import { REMINDER_PRESETS, dayBeforeApplicable, reminderSummary, scopeFromDaily } from '../lib/checklistReminderOptions'
import { ymdAddDays } from '../utils/dateUtils'
import { ChecklistCrewTagsRow } from './checklist/ChecklistCrewTagsRow'

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

/**
 * When assignees were only the current user and the user adds someone else, drop self so the new default is "other only" (they can add self back).
 */
function dedupeSoloSelfWhenAddingOthers(
  prev: string[],
  next: string[],
  authUserId: string | null
): string[] {
  if (!authUserId || prev.length !== 1 || prev[0] !== authUserId) return next
  if (next.includes(authUserId) && next.some((id) => id !== authUserId)) {
    return next.filter((id) => id !== authUserId)
  }
  return next
}

function toLocalDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

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
  const modalContext = useChecklistAddModal()
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [recentAssigneeIds, setRecentAssigneeIds] = useState<string[]>([])
  const [role, setRole] = useState<UserRole | null>(null)
  const [customTimeOpen, setCustomTimeOpen] = useState(false)
  /** user ids among the assignees that have ≥1 push device (null = unknown/not fetched). */
  const [pushEnabledIds, setPushEnabledIds] = useState<Set<string> | null>(null)
  const [linksSectionOpen, setLinksSectionOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const titleInputRef = useRef<HTMLTextAreaElement | null>(null)
  const saveButtonRef = useRef<HTMLButtonElement>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  /** Tab cycles title → people search → Save → Cancel → title (Shift+Tab reverses); other controls stay mouse-reachable. */
  const ASSIGN_SEARCH_ID = 'checklist-add-assign-search'
  const [form, setForm] = useState({
    title: '',
    links: [] as string[],
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

  const assignToSelectOptions = useMemo(
    () =>
      users.map((u) => ({
        value: u.id,
        label: u.name?.trim() || u.email,
      })),
    [users],
  )

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
    supabase
      .from('users')
      .select('id, name, email')
      .is('archived_at', null)
      .order('name')
      .then(({ data }) => {
        setUsers((data ?? []) as Array<{ id: string; name: string; email: string }>)
      })
    if (authUser?.id) {
      supabase.from('users').select('role').eq('id', authUser.id).single().then(({ data }) => {
        setRole((data as { role: UserRole } | null)?.role ?? null)
      })
      supabase
        .from('checklist_items')
        .select('id')
        .eq('created_by_user_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(30)
        .then(async ({ data: items }) => {
          const ids = (items ?? []).map((r) => r.id)
          if (ids.length === 0) {
            setRecentAssigneeIds([])
            return
          }
          const { data: assignees } = await supabase
            .from('checklist_item_assignees')
            .select('user_id')
            .in('checklist_item_id', ids)
          const seen = new Set<string>()
          const unique: string[] = []
          for (const row of (assignees ?? []) as Array<{ user_id: string }>) {
            const id = row.user_id
            if (id && !seen.has(id) && unique.length < 3) {
              seen.add(id)
              unique.push(id)
            }
          }
          setRecentAssigneeIds(unique)
        })
    } else {
      setRecentAssigneeIds([])
    }
  }, [modalContext?.isOpen, authUser?.id])

  useEffect(() => {
    if (modalContext?.isOpen && users.length > 0 && form.assigned_to_user_ids.length === 0) {
      const defaultId = getDefaultAssigneeId(
        modalContext.initialAssigneeUserId,
        users,
        authUser?.id ?? null
      )
      if (defaultId) setForm((f) => ({ ...f, assigned_to_user_ids: [defaultId] }))
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
      setCustomTimeOpen(false)
      setFormError(null)
      setLinksSectionOpen(presetLinks.length > 0)
      setWhen('today')
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
          title: trimmedTitle,
          links: form.links.filter(Boolean).length ? form.links.filter(Boolean) : [],
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
      }
      modalContext.onSaved?.()
      modalContext.closeModal()
      window.dispatchEvent(new CustomEvent('checklist-item-saved'))
    } finally {
      setSubmitting(false)
    }
  }

  if (!modalContext?.isOpen) return null

  if (!canManage) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="checklist-add-modal-title"
      // z 1012: above Job Detail (1004) and Edit Job (1010) so the header
      // send-as-task buttons can stack this modal over either dialog (v2.1529).
      style={{ position: 'fixed', padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))', inset: 0, background: overlayBackground, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1012 }}
      onClick={() => modalContext.closeModal()}
    >
      <div
        style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, maxWidth: 480, width: '90%', maxHeight: 'min(90vh, 100%)', overflow: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <h3 id="checklist-add-modal-title" style={{ margin: 0 }}>Add checklist item:</h3>
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
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div>
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
                    if (e.shiftKey) cancelButtonRef.current?.focus()
                    else document.getElementById(ASSIGN_SEARCH_ID)?.focus()
                  }
                }}
                rows={1}
                placeholder="What needs to be done?"
                style={{
                  width: '100%',
                  minHeight: '2.75rem',
                  padding: '0.5rem',
                  boxSizing: 'border-box',
                  font: 'inherit',
                  lineHeight: 1.5,
                  overflowWrap: 'break-word',
                  wordBreak: 'break-word',
                  resize: 'none',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 6,
                }}
              />
            </div>
            <div
              role="group"
              aria-labelledby="checklist-add-assign-label"
              style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: '0.25rem' }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  width: '100%',
                }}
              >
                <span id="checklist-add-assign-label" style={{ display: 'block', flexShrink: 0 }}>
                  Assign to
                </span>
                <div
                  aria-label={recentAssigneeIds.length > 0 ? 'Recent assignees' : undefined}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    textAlign: 'center',
                  }}
                >
                  {recentAssigneeIds.length > 0
                    ? (
                        <>
                          <span style={{ marginRight: '0.5rem' }}>Recent:</span>
                          {recentAssigneeIds
                            .map((id) => users.find((x) => x.id === id))
                            .filter((u): u is { id: string; name: string; email: string } => !!u)
                            .map((u, i) => (
                              <span key={u.id}>
                                {i > 0 && ', '}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setForm((f) => {
                                      const prev = f.assigned_to_user_ids
                                      const proposed = prev.includes(u.id)
                                        ? prev
                                        : [...prev, u.id]
                                      return {
                                        ...f,
                                        assigned_to_user_ids: dedupeSoloSelfWhenAddingOthers(
                                          prev,
                                          proposed,
                                          authUser?.id ?? null,
                                        ),
                                      }
                                    })
                                  }}
                                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-link)', textDecoration: 'underline', fontSize: 'inherit' }}
                                >
                                  {u.name || u.email}
                                </button>
                              </span>
                            ))}
                        </>
                      )
                    : null}
                </div>
                <button
                  type="button"
                  onClick={() => setLinksSectionOpen((o) => !o)}
                  aria-expanded={linksSectionOpen}
                  aria-label={linksSectionOpen ? 'Hide links' : 'Show links'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.25rem 0',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 500,
                    fontSize: '1rem',
                    color: 'var(--text-faint)',
                    flexShrink: 0,
                  }}
                >
                  <span aria-hidden>{linksSectionOpen ? '▼' : '▶'}</span>
                  <span>Links</span>
                  {form.links.length > 0 ? (
                    <span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'inherit' }}>({form.links.length})</span>
                  ) : null}
                </button>
              </div>
              <div style={{ marginTop: '0.35rem' }}>
                {/* Crew chips (People → Teams): one tap staffs the whole crew; the
                    solo-self dedupe rule applies to crew taps like manual picks. */}
                <ChecklistCrewTagsRow
                  users={users}
                  assignees={Object.fromEntries(form.assigned_to_user_ids.map((id) => [id, true]))}
                  currentUserId={authUser?.id ?? null}
                  onStaffCrew={(memberIds, checked) =>
                    setForm((f) => {
                      const prev = f.assigned_to_user_ids
                      const proposed = checked
                        ? [...prev, ...memberIds.filter((id) => !prev.includes(id))]
                        : prev.filter((id) => !memberIds.includes(id))
                      return {
                        ...f,
                        assigned_to_user_ids: checked
                          ? dedupeSoloSelfWhenAddingOthers(prev, proposed, authUser?.id ?? null)
                          : proposed,
                      }
                    })
                  }
                />
              </div>
              <div
                style={{ marginTop: '0.25rem' }}
                onKeyDown={(e) => {
                  if (e.key !== 'Tab') return
                  const target = e.target as HTMLElement
                  if (target.id !== ASSIGN_SEARCH_ID) return
                  e.preventDefault()
                  if (e.shiftKey) titleInputRef.current?.focus()
                  else saveButtonRef.current?.focus()
                }}
              >
                <SearchableMultiSelect
                  id="checklist-add-assign"
                  searchPlaceholder="Search people…"
                  options={assignToSelectOptions}
                  value={form.assigned_to_user_ids}
                  onChange={(ids) =>
                    setForm((f) => ({
                      ...f,
                      assigned_to_user_ids: dedupeSoloSelfWhenAddingOthers(
                        f.assigned_to_user_ids,
                        ids,
                        authUser?.id ?? null,
                      ),
                    }))
                  }
                  listAriaLabel="Assign to"
                  pinSelectedToTop
                  keyboardSelect
                />
              </div>
            </div>
            {linksSectionOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                {form.links.map((url, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const input = titleInputRef.current
                        if (input) {
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
                        }
                      }}
                      style={{
                        flexShrink: 0,
                        padding: '0.25rem 0.5rem',
                        background: 'var(--bg-muted)',
                        border: '1px solid var(--border-strong)',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                      }}
                    >
                      [{i + 1}]
                    </button>
                    <input
                      type="url"
                      value={url}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          links: f.links.map((u, j) => (j === i ? e.target.value : u)),
                        }))
                      }
                      placeholder="URL"
                      style={{ flex: 1, padding: '0.5rem' }}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          links: f.links.filter((_, j) => j !== i),
                        }))
                      }
                      style={{
                        padding: '0.25rem',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        fontSize: '1.25rem',
                        lineHeight: 1,
                      }}
                      title="Remove link"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, links: [...f.links, ''] }))}
                  style={{
                    alignSelf: 'flex-start',
                    padding: '0.25rem 0.5rem',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-link)',
                    textDecoration: 'underline',
                    fontSize: '0.875rem',
                  }}
                >
                  [+ add]
                </button>
              </div>
            )}
          </div>
          <div style={{ marginBottom: '1rem' }}>
            {/* ── When (v2.2058): scheduling is a first-class question ── */}
            <div style={{ marginTop: '0.85rem' }}>
              <span style={{ display: 'block', fontWeight: 500, marginBottom: '0.35rem' }}>When</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {([['today', 'Today'], ['date', 'On a date'], ['repeat', 'Repeats']] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setWhen(key)}
                    aria-pressed={when === key}
                    style={{
                      ...{ flex: '1 1 90px', padding: '0.45rem 0.5rem', fontSize: '0.875rem', borderRadius: 9, cursor: 'pointer' },
                      border: when === key ? '1.5px solid #2563eb' : '1.5px solid var(--border-strong)',
                      background: when === key ? 'var(--bg-blue-tint)' : 'var(--surface)',
                      color: when === key ? 'var(--text-blue-800)' : 'var(--text-700)',
                      fontWeight: when === key ? 600 : 400,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {when === 'date' ? (
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem' }}>
                  <span>Do on</span>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                    style={{ padding: '0.4rem' }}
                  />
                </label>
              ) : null}
              {when !== 'repeat' ? (
                // Due by (v2.2351): optional deadline — on the list from Do on, late after this.
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>Due by</span>
                    <input
                      type="date"
                      value={form.due_date}
                      min={when === 'today' ? toLocalDateString(new Date()) : form.start_date || undefined}
                      onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                      style={{ padding: '0.4rem' }}
                    />
                  </label>
                  {form.due_date ? (
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, due_date: '' }))}
                      style={{ border: 'none', background: 'none', color: 'var(--text-muted)', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.8125rem', padding: 0 }}
                    >
                      clear — no due date
                    </button>
                  ) : null}
                </div>
              ) : null}
              {when !== 'repeat' ? (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.875rem', cursor: form.due_date ? 'default' : 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.due_date ? true : form.show_until_completed}
                    disabled={Boolean(form.due_date)}
                    onChange={(e) => setForm((f) => ({ ...f, show_until_completed: e.target.checked }))}
                  />
                  <span>Stays on the list until done{form.due_date ? ' (a due date keeps it on the list)' : ''}</span>
                </label>
              ) : null}
              {when === 'repeat' ? (
                <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {([['weekly', 'Weekly on\u2026'], ['after_done', "\u2014 days after it's done"]] as const).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setRepeatMode(key)}
                        aria-pressed={repeatMode === key}
                        style={{
                          ...{ flex: '1 1 90px', padding: '0.45rem 0.5rem', fontSize: '0.875rem', borderRadius: 9, cursor: 'pointer' },
                          flex: '0 1 auto',
                          border: repeatMode === key ? '1.5px solid #2563eb' : '1.5px solid var(--border-strong)',
                          background: repeatMode === key ? 'var(--bg-blue-tint)' : 'var(--surface)',
                          color: repeatMode === key ? 'var(--text-blue-800)' : 'var(--text-700)',
                          fontWeight: repeatMode === key ? 600 : 400,
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {repeatMode === 'weekly' ? (
                    <>
                      <div style={{ display: 'flex', gap: 4 }} role="group" aria-label="Days of the week">
                        {DAYS.map((name, i) => {
                          const on = form.repeat_days_of_week.includes(i)
                          return (
                            <button
                              key={i}
                              type="button"
                              aria-pressed={on}
                              aria-label={name}
                              onClick={() =>
                                setForm((f) => ({
                                  ...f,
                                  repeat_days_of_week: on
                                    ? f.repeat_days_of_week.filter((d) => d !== i)
                                    : [...f.repeat_days_of_week, i].sort((a, b) => a - b),
                                }))
                              }
                              style={{
                                flex: 1,
                                minWidth: 0,
                                padding: '0.35rem 0',
                                borderRadius: 8,
                                fontSize: '0.8125rem',
                                fontWeight: on ? 700 : 400,
                                border: on ? '1.5px solid #2563eb' : '1.5px solid var(--border-strong)',
                                background: on ? '#2563eb' : 'var(--surface)',
                                color: on ? 'white' : 'var(--text-muted)',
                                cursor: 'pointer',
                              }}
                            >
                              {name[0]}
                            </button>
                          )
                        })}
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Starts</span>
                          <input
                            type="date"
                            value={form.start_date}
                            onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                            style={{ padding: '0.4rem' }}
                          />
                        </label>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Ends (optional)</span>
                          <input
                            type="date"
                            value={form.repeat_end_date}
                            onChange={(e) => setForm((f) => ({ ...f, repeat_end_date: e.target.value }))}
                            style={{ padding: '0.4rem' }}
                          />
                        </label>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span>Repeat</span>
                        <input
                          type="number"
                          min={1}
                          value={form.repeat_days_after}
                          onChange={(e) => setForm((f) => ({ ...f, repeat_days_after: Number(e.target.value) || 1 }))}
                          style={{ padding: '0.4rem', width: 64 }}
                        />
                        <span>days after it's completed</span>
                      </label>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Starts</span>
                        <input
                          type="date"
                          value={form.start_date}
                          onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                          style={{ padding: '0.4rem' }}
                        />
                      </label>
                    </div>
                  )}
                </div>
              ) : null}
              <div
                role="status"
                style={{
                  marginTop: '0.6rem',
                  padding: '0.5rem 0.7rem',
                  borderRadius: 9,
                  background: 'var(--bg-green-100)',
                  border: '1px solid #16a34a',
                  color: 'var(--text-green-700)',
                  fontSize: '0.85rem',
                }}
              >
                {checklistScheduleSummary({
                  when,
                  repeatMode,
                  startDate: form.start_date,
                  todayStr: toLocalDateString(new Date()),
                  daysOfWeek: form.repeat_days_of_week,
                  daysAfter: form.repeat_days_after,
                  endDate: form.repeat_end_date || null,
                  staysUntilDone: form.due_date ? true : form.show_until_completed,
                  dueDate: when !== 'repeat' ? form.due_date || null : null,
                  assigneeNames: form.assigned_to_user_ids.map(
                    (id) => users.find((u) => u.id === id)?.name?.trim() || users.find((u) => u.id === id)?.email || '\u2026',
                  ),
                })}
                {when === 'repeat' && repeatMode === 'weekly' && startNotOnChosenDay(form.start_date, form.repeat_days_of_week)
                  ? ' First occurrence lands on the next chosen day.'
                  : ''}
              </div>
            </div>

            {/* ── Notify: one line, chips-style (v2.2058) ── */}
            <div style={{ marginTop: '0.75rem' }}>
              <span style={{ display: 'block', fontWeight: 500, marginBottom: '0.35rem' }}>When it's done, notify</span>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input
                    id="checklist-add-notify-creator"
                    type="checkbox"
                    checked={form.notify_creator_on_complete}
                    onChange={(e) => setForm((f) => ({ ...f, notify_creator_on_complete: e.target.checked }))}
                  />
                  Me
                </label>
                <div style={{ minWidth: 200, flex: '1 1 200px' }}>
                  <SearchableSelect
                    id="checklist-add-notify-on-complete"
                    value={form.notify_on_complete_user_id}
                    onChange={(id) => setForm((f) => ({ ...f, notify_on_complete_user_id: id }))}
                    options={assignToSelectOptions}
                    emptyOption={{ value: '', label: '\u2014 add someone else \u2014' }}
                    placeholder="\u2014 add someone else \u2014"
                    listAriaLabel="Also notify when completed"
                    searchReplacesTrigger
                    hideEmptyOptionInListWhenUnset
                  />
                </div>
              </div>
            </div>

            {/* Remind (v2.2096): open to every task creator — preset chips, plain-words options, reachability. */}
            <div style={{ marginTop: '1rem' }}>
              <p style={{ fontWeight: 700, fontSize: '1.05rem', margin: '0 0 0.5rem' }}>Remind</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(() => {
                  const isPreset = REMINDER_PRESETS.some((p) => p.time === form.reminder_time)
                  const customVisible = customTimeOpen || (form.reminder_time !== '' && !isPreset)
                  const chips: Array<{ label: string; active: boolean; onClick: () => void }> = [
                    {
                      label: 'No reminder',
                      active: !form.reminder_time && !customVisible,
                      onClick: () => {
                        setForm((f) => ({ ...f, reminder_time: '' }))
                        setCustomTimeOpen(false)
                      },
                    },
                    ...REMINDER_PRESETS.map((p) => ({
                      label: p.label,
                      active: !customVisible && form.reminder_time === p.time,
                      onClick: () => {
                        setForm((f) => ({ ...f, reminder_time: p.time }))
                        setCustomTimeOpen(false)
                      },
                    })),
                    { label: 'Custom…', active: customVisible, onClick: () => setCustomTimeOpen(true) },
                  ]
                  return chips.map((c) => (
                    <button
                      key={c.label}
                      type="button"
                      onClick={c.onClick}
                      style={{
                        padding: '0.45rem 0.9rem',
                        borderRadius: 9,
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        border: c.active ? '1.5px solid #2563eb' : '1.5px solid var(--border-strong)',
                        background: c.active ? 'var(--bg-blue-tint)' : 'var(--surface)',
                        color: c.active ? 'var(--text-blue-800)' : 'var(--text-700)',
                        fontWeight: c.active ? 600 : 400,
                      }}
                    >
                      {c.label}
                    </button>
                  ))
                })()}
              </div>
              {(customTimeOpen || (form.reminder_time !== '' && !REMINDER_PRESETS.some((p) => p.time === form.reminder_time))) && (
                <label style={{ display: 'block', marginTop: '0.6rem' }}>
                  <span style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Remind at (CST)</span>
                  <input
                    type="time"
                    value={form.reminder_time}
                    onChange={(e) => setForm((f) => ({ ...f, reminder_time: e.target.value }))}
                    style={{ padding: '0.5rem' }}
                  />
                </label>
              )}
              {form.reminder_time ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', marginTop: '0.75rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.95rem' }}>
                    <input
                      type="checkbox"
                      checked={form.reminder_daily}
                      onChange={(e) => setForm((f) => ({ ...f, reminder_daily: e.target.checked }))}
                    />
                    Keep reminding every day until it&apos;s done
                  </label>
                  {dayBeforeApplicable(when === 'repeat' ? 'repeat' : when, form.start_date, toLocalDateString(new Date())) && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.95rem' }}>
                      <input
                        type="checkbox"
                        checked={form.remind_day_before}
                        onChange={(e) => setForm((f) => ({ ...f, remind_day_before: e.target.checked }))}
                      />
                      Also remind the day before it&apos;s due
                    </label>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', fontSize: '0.95rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={form.escalate_enabled}
                        onChange={(e) => setForm((f) => ({ ...f, escalate_enabled: e.target.checked }))}
                      />
                      Still not done after
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={form.escalate_days}
                      disabled={!form.escalate_enabled}
                      onChange={(e) => setForm((f) => ({ ...f, escalate_days: Math.min(30, Math.max(1, Number(e.target.value) || 1)) }))}
                      aria-label="Days overdue before reminding the creator"
                      style={{ width: 52, padding: '0.25rem 0.35rem' }}
                    />
                    <span>days? Remind me too</span>
                  </div>
                  {canSeeReach && pushEnabledIds && form.assigned_to_user_ids.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem', color: 'var(--text-muted)', borderTop: '1px dashed var(--border)', paddingTop: '0.55rem' }}>
                      {form.assigned_to_user_ids.map((uid) => {
                        const u = users.find((x) => x.id === uid)
                        const name = u?.name?.trim() || u?.email || 'Unknown'
                        const hasPush = pushEnabledIds.has(uid)
                        return (
                          <span key={uid}>
                            <b style={{ color: 'var(--text-strong)', fontWeight: 600 }}>{name}</b>{' '}
                            {hasPush ? (
                              <span style={{ color: 'var(--text-green-700)', fontWeight: 600 }}>{'📱'} phone alert</span>
                            ) : (
                              <>
                                <span style={{ color: 'var(--text-amber-800)', fontWeight: 600 }}>{'✉️'} email</span>
                                <span> {'—'} no phone alerts set up</span>
                              </>
                            )}
                          </span>
                        )
                      })}
                    </div>
                  ) : null}
                  {(() => {
                    const names = form.assigned_to_user_ids
                      .map((uid) => {
                        const u = users.find((x) => x.id === uid)
                        return u?.name?.trim() || u?.email || ''
                      })
                      .filter(Boolean)
                    const s = reminderSummary(
                      {
                        time: form.reminder_time,
                        dailyUntilDone: form.reminder_daily,
                        dayBefore:
                          form.remind_day_before && dayBeforeApplicable(when === 'repeat' ? 'repeat' : when, form.start_date, toLocalDateString(new Date())),
                        escalateAfterDays: form.escalate_enabled ? form.escalate_days : null,
                      },
                      names,
                    )
                    return s ? (
                      <div
                        role="status"
                        style={{
                          padding: '0.5rem 0.7rem',
                          borderRadius: 9,
                          background: 'var(--bg-green-100)',
                          border: '1px solid #16a34a',
                          color: 'var(--text-green-700)',
                          fontSize: '0.85rem',
                        }}
                      >
                        {s}
                      </div>
                    ) : null
                  })()}
                </div>
              ) : null}
            </div>
          </div>
        </div>
        {formError && <p style={{ color: 'var(--text-red-700)', marginTop: '0.5rem', fontSize: '0.875rem' }}>{formError}</p>}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.5rem',
            marginTop: '1.5rem',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          <button
            type="button"
            ref={cancelButtonRef}
            onClick={() => modalContext.closeModal()}
            onKeyDown={(e) => {
              if (e.key !== 'Tab') return
              e.preventDefault()
              if (e.shiftKey) saveButtonRef.current?.focus()
              else titleInputRef.current?.focus()
            }}
            style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            ref={saveButtonRef}
            onClick={saveItem}
            disabled={submitting}
            onKeyDown={(e) => {
              if (e.key !== 'Tab') return
              e.preventDefault()
              if (e.shiftKey) document.getElementById(ASSIGN_SEARCH_ID)?.focus()
              else cancelButtonRef.current?.focus()
            }}
            style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
