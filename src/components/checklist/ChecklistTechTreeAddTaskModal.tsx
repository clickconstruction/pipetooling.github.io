import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import {
  buildCrewViews,
  crewChipState,
  crewRosterDiff,
  type CrewMemberRow,
  type CrewTeamRow,
  type CrewView,
} from '../../lib/checklistCrewTags'

type UserRow = { id: string; name: string; email: string }

// Stable default: an inline `= []` default mints a new array identity on every
// render, and it sits in the reset-effect's dependency list — so each keystroke
// (setTitle → re-render → "new" dep) re-ran the reset and wiped the title.
const NO_PRESET_ASSIGNEES: readonly string[] = []

const LONG_PRESS_MS = 500

type Props = {
  open: boolean
  groupId: string | null
  groupTitle: string
  users: UserRow[]
  /** When set and present in `users`, that row is shown first. */
  currentUserId: string | null
  onClose: () => void
  onSave: (title: string, assigneeUserIds: string[]) => Promise<boolean>
  /** e.g. roadmap canvas in Fullscreen API — modals must mount inside the fullscreen element */
  portalContainer?: HTMLElement | null
  /** When set, modal is in edit mode (title + assignees pre-filled). */
  editingTaskId?: string | null
  initialEditTitle?: string
  initialEditAssigneeUserIds?: readonly string[]
}

type CrewPanelState = null | { kind: 'create' } | { kind: 'edit'; crewId: string }

/**
 * Add a task to a Roadmap group (title + optional assignees). Parent supplies onSave; returns true on success.
 *
 * Crew tags (the chip row above the assignee list) are the People → Teams
 * tables surfaced here: tap a crew to staff it wholesale, ＋ New crew / ✎ Edit
 * to manage crews without leaving the modal. Tags never change what a task
 * stores — they only drive the same checkboxes.
 */
export function ChecklistTechTreeAddTaskModal({
  open,
  groupId,
  groupTitle,
  users,
  currentUserId,
  onClose,
  onSave,
  portalContainer,
  editingTaskId = null,
  initialEditTitle = '',
  initialEditAssigneeUserIds = NO_PRESET_ASSIGNEES,
}: Props) {
  const [title, setTitle] = useState('')
  const [assignees, setAssignees] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const isEditMode = Boolean(editingTaskId)

  const [crews, setCrews] = useState<CrewView[]>([])
  const [crewsUnavailable, setCrewsUnavailable] = useState(false)
  const [crewRowEditMode, setCrewRowEditMode] = useState(false)
  const [crewPanel, setCrewPanel] = useState<CrewPanelState>(null)
  const [crewName, setCrewName] = useState('')
  const [crewPicked, setCrewPicked] = useState<Record<string, boolean>>({})
  const [crewSaving, setCrewSaving] = useState(false)
  const [crewError, setCrewError] = useState<string | null>(null)
  const [crewDeleteConfirm, setCrewDeleteConfirm] = useState(false)
  /** userId → crew name, for the "via crew" attribution pill; UI-only. */
  const [viaCrew, setViaCrew] = useState<Record<string, string>>({})
  const longPressRef = useRef<{ timer: number; fired: boolean } | null>(null)

  const usersOrderedForDisplay = useMemo(() => {
    if (!currentUserId) return users
    const me = users.find((u) => u.id === currentUserId)
    if (!me) return users
    return [me, ...users.filter((u) => u.id !== currentUserId)]
  }, [users, currentUserId])

  const loadCrews = useCallback(async () => {
    try {
      const [teams, members] = await Promise.all([
        withSupabaseRetry(
          () => supabase.from('people_teams').select('id, name, sequence_order'),
          'load crews for task modal',
        ),
        withSupabaseRetry(
          () => supabase.from('people_team_members').select('team_id, person_name'),
          'load crew members for task modal',
        ),
      ])
      setCrews(buildCrewViews((teams ?? []) as CrewTeamRow[], (members ?? []) as CrewMemberRow[], users))
      setCrewsUnavailable(false)
    } catch {
      // RLS or load failure: the row simply doesn't render — assignees still work.
      setCrewsUnavailable(true)
    }
  }, [users])

  useEffect(() => {
    if (!open) return
    if (editingTaskId) {
      setTitle(initialEditTitle)
      const m: Record<string, boolean> = {}
      for (const id of initialEditAssigneeUserIds) {
        m[id] = true
      }
      setAssignees(m)
    } else {
      setTitle('')
      setAssignees({})
    }
    setCrewRowEditMode(false)
    setCrewPanel(null)
    setCrewError(null)
    setViaCrew({})
    void loadCrews()
  }, [open, groupId, editingTaskId, initialEditTitle, initialEditAssigneeUserIds, loadCrews])

  if (!open || !groupId) return null

  const handleSave = async () => {
    const trimmed = title.trim()
    if (!trimmed) return
    setSaving(true)
    try {
      const assigneeUserIds = Object.entries(assignees)
        .filter(([, v]) => v)
        .map(([k]) => k)
      const ok = await onSave(trimmed, assigneeUserIds)
      if (ok) onClose()
    } finally {
      setSaving(false)
    }
  }

  const openCrewPanel = (state: CrewPanelState, crew?: CrewView) => {
    setCrewPanel(state)
    setCrewError(null)
    setCrewDeleteConfirm(false)
    if (crew) {
      setCrewName(crew.name)
      const m: Record<string, boolean> = {}
      for (const id of crew.memberUserIds) m[id] = true
      setCrewPicked(m)
    } else {
      setCrewName('')
      setCrewPicked({})
    }
  }

  const staffCrew = (crew: CrewView) => {
    const state = crewChipState(crew.memberUserIds, assignees)
    if (state === 'all') {
      setAssignees((m) => {
        const next = { ...m }
        for (const id of crew.memberUserIds) next[id] = false
        return next
      })
      setViaCrew((v) => {
        const next = { ...v }
        for (const id of crew.memberUserIds) delete next[id]
        return next
      })
    } else {
      setAssignees((m) => {
        const next = { ...m }
        for (const id of crew.memberUserIds) next[id] = true
        return next
      })
      setViaCrew((v) => {
        const next = { ...v }
        for (const id of crew.memberUserIds) next[id] = crew.name
        return next
      })
    }
  }

  const onCrewChipClick = (crew: CrewView) => {
    if (longPressRef.current?.fired) {
      longPressRef.current.fired = false
      return
    }
    if (crewRowEditMode) openCrewPanel({ kind: 'edit', crewId: crew.id }, crew)
    else staffCrew(crew)
  }

  const startLongPress = (crew: CrewView) => {
    cancelLongPress()
    const timer = window.setTimeout(() => {
      if (longPressRef.current) longPressRef.current.fired = true
      openCrewPanel({ kind: 'edit', crewId: crew.id }, crew)
    }, LONG_PRESS_MS)
    longPressRef.current = { timer, fired: false }
  }

  const cancelLongPress = () => {
    if (longPressRef.current) window.clearTimeout(longPressRef.current.timer)
  }

  const saveCrew = async () => {
    const name = crewName.trim()
    if (!name || crewSaving) return
    const pickedIds = Object.entries(crewPicked)
      .filter(([, v]) => v)
      .map(([k]) => k)
    setCrewSaving(true)
    setCrewError(null)
    try {
      if (crewPanel?.kind === 'create') {
        const inserted = await withSupabaseRetry<{ id: string }>(
          () =>
            supabase
              .from('people_teams')
              .insert({ name, sequence_order: crews.length })
              .select('id')
              .single(),
          'create crew',
        )
        if (!inserted) throw new Error('Crew insert returned no row')
        const memberNames = pickedIds
          .map((id) => (users.find((u) => u.id === id)?.name ?? '').trim())
          .filter(Boolean)
        if (memberNames.length > 0) {
          await withSupabaseRetry(
            () =>
              supabase
                .from('people_team_members')
                .insert(memberNames.map((person_name) => ({ team_id: inserted.id, person_name }))),
            'add crew members',
          )
        }
        // The new crew comes back active: members staffed on this task.
        setAssignees((m) => {
          const next = { ...m }
          for (const id of pickedIds) next[id] = true
          return next
        })
        setViaCrew((v) => {
          const next = { ...v }
          for (const id of pickedIds) next[id] = name
          return next
        })
      } else if (crewPanel?.kind === 'edit') {
        const crew = crews.find((c) => c.id === crewPanel.crewId)
        if (!crew) return
        if (name !== crew.name) {
          await withSupabaseRetry(
            () => supabase.from('people_teams').update({ name }).eq('id', crew.id),
            'rename crew',
          )
        }
        const { namesToAdd, namesToRemove } = crewRosterDiff(crew.memberNames, pickedIds, users)
        if (namesToRemove.length > 0) {
          await withSupabaseRetry(
            () =>
              supabase
                .from('people_team_members')
                .delete()
                .eq('team_id', crew.id)
                .in('person_name', namesToRemove),
            'remove crew members',
          )
        }
        if (namesToAdd.length > 0) {
          await withSupabaseRetry(
            () =>
              supabase
                .from('people_team_members')
                .insert(namesToAdd.map((person_name) => ({ team_id: crew.id, person_name }))),
            'add crew members',
          )
        }
      }
      await loadCrews()
      setCrewPanel(null)
      setCrewRowEditMode(false)
    } catch (e) {
      setCrewError(e instanceof Error ? e.message : 'Could not save crew')
    } finally {
      setCrewSaving(false)
    }
  }

  const deleteCrew = async () => {
    if (crewPanel?.kind !== 'edit' || crewSaving) return
    setCrewSaving(true)
    setCrewError(null)
    try {
      await withSupabaseRetry(
        () => supabase.from('people_team_members').delete().eq('team_id', crewPanel.crewId),
        'delete crew members',
      )
      await withSupabaseRetry(
        () => supabase.from('people_teams').delete().eq('id', crewPanel.crewId),
        'delete crew',
      )
      await loadCrews()
      setCrewPanel(null)
      setCrewRowEditMode(false)
    } catch (e) {
      setCrewError(e instanceof Error ? e.message : 'Could not delete crew')
    } finally {
      setCrewSaving(false)
      setCrewDeleteConfirm(false)
    }
  }

  const target = typeof document !== 'undefined' ? (portalContainer ?? document.body) : null
  if (!target) return null

  const chipBase = {
    display: 'inline-flex',
    alignItems: 'center' as const,
    gap: 5,
    fontSize: 12.5,
    fontWeight: 600,
    borderRadius: 999,
    padding: '5px 11px',
    background: 'var(--surface)',
    color: 'var(--text-700)',
    cursor: 'pointer',
  }

  // Always rendered while crews load fine — with zero crews the row is just
  // "＋ New crew", which is exactly how the first crew gets made.
  const crewChips =
    !crewsUnavailable ? (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '2px 0 10px' }}>
        {crews.map((c) => {
          const state = crewChipState(c.memberUserIds, assignees)
          const active = state === 'all' && c.memberUserIds.length > 0
          const partial = state === 'some'
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onCrewChipClick(c)}
              onPointerDown={() => startLongPress(c)}
              onPointerUp={cancelLongPress}
              onPointerLeave={cancelLongPress}
              onContextMenu={(e) => {
                e.preventDefault()
                openCrewPanel({ kind: 'edit', crewId: c.id }, c)
              }}
              title={
                (crewRowEditMode ? `Edit ${c.name}` : `Staff ${c.name}`) +
                (c.unmatchedCount > 0 ? ` · ${c.unmatchedCount} member${c.unmatchedCount === 1 ? ' has' : 's have'} no login` : '')
              }
              style={{
                ...chipBase,
                border: active
                  ? '1.5px solid #2563eb'
                  : partial || crewRowEditMode
                    ? '1.5px dashed #2563eb'
                    : '1.5px solid var(--border-strong)',
                ...(active ? { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)' } : {}),
                ...(partial || crewRowEditMode ? { color: 'var(--text-blue-800)' } : {}),
              }}
            >
              {crewRowEditMode ? '✎ ' : ''}
              {c.name}
              <span style={{ fontWeight: 400, color: active ? 'var(--text-blue-800)' : 'var(--text-muted)' }}>
                {c.memberUserIds.length}
                {active ? ' ✓' : ''}
              </span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => openCrewPanel({ kind: 'create' })}
          style={{ ...chipBase, border: '1.5px dashed var(--border-strong)', color: 'var(--text-muted)' }}
        >
          ＋ New crew
        </button>
        {crews.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              setCrewRowEditMode((m) => !m)
              setCrewPanel(null)
            }}
            aria-pressed={crewRowEditMode}
            style={{
              ...chipBase,
              border: '1.5px dashed var(--border-strong)',
              color: crewRowEditMode ? 'var(--text-blue-800)' : 'var(--text-muted)',
              ...(crewRowEditMode ? { border: '1.5px solid #2563eb', background: 'var(--bg-blue-tint)' } : {}),
            }}
          >
            {crewRowEditMode ? '✎ Editing — tap a crew' : '✎ Edit'}
          </button>
        ) : null}
      </div>
    ) : null

  const crewPanelView = crewPanel ? (
    <div
      style={{
        border: '1.5px dashed #d97706',
        background: 'var(--bg-amber-tint)',
        borderRadius: 10,
        padding: '10px 12px',
        marginBottom: 12,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-amber-800)', letterSpacing: '0.02em', textTransform: 'uppercase', marginBottom: 7 }}>
        {crewPanel.kind === 'create' ? 'New crew' : `Edit crew — ${crews.find((c) => c.id === crewPanel.crewId)?.name ?? ''}`}
      </div>
      <input
        value={crewName}
        onChange={(e) => setCrewName(e.target.value)}
        placeholder="Crew name"
        disabled={crewSaving}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          height: 36,
          border: '1.5px solid var(--border-strong)',
          borderRadius: 7,
          padding: '0 10px',
          fontSize: 14,
          background: 'var(--surface)',
          color: 'var(--text-strong)',
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflow: 'auto', margin: '8px 0 0' }}>
        {usersOrderedForDisplay.map((u) => (
          <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
            <input
              type="checkbox"
              checked={!!crewPicked[u.id]}
              onChange={(e) => setCrewPicked((m) => ({ ...m, [u.id]: e.target.checked }))}
              disabled={crewSaving}
            />
            {u.name || u.email}
          </label>
        ))}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 7 }}>
        {crewPanel.kind === 'create'
          ? 'Tick who’s in it. Saves to People → Teams, so this crew shows up everywhere.'
          : 'Changes save to People → Teams — every surface that uses this crew follows. Members without logins stay on the crew.'}
      </div>
      {crewError ? (
        <div style={{ fontSize: 12.5, color: 'var(--text-red-700)', marginTop: 6 }}>{crewError}</div>
      ) : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
        {crewPanel.kind === 'edit' ? (
          crewDeleteConfirm ? (
            <>
              <span style={{ fontSize: 12, color: 'var(--text-red-700)', flex: 1, minWidth: 0 }}>
                Removes this crew from People → Teams everywhere. People stay; only the grouping goes.
              </span>
              <button
                type="button"
                onClick={() => void deleteCrew()}
                disabled={crewSaving}
                style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                {crewSaving ? 'Deleting…' : 'Delete permanently'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setCrewDeleteConfirm(true)}
              disabled={crewSaving}
              style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-red-700)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Delete crew…
            </button>
          )
        ) : null}
        <span style={{ flex: 1 }} />
        {!crewDeleteConfirm ? (
          <>
            <button type="button" onClick={() => { setCrewPanel(null); setCrewDeleteConfirm(false) }} disabled={crewSaving}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void saveCrew()}
              disabled={crewSaving || !crewName.trim()}
              style={{
                background: crewSaving || !crewName.trim() ? 'var(--bg-200)' : '#2563eb',
                color: crewSaving || !crewName.trim() ? 'var(--text-muted)' : '#fff',
                border: 'none',
                borderRadius: 7,
                padding: '7px 14px',
                fontSize: 13,
                fontWeight: 600,
                cursor: crewSaving || !crewName.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {crewSaving
                ? 'Saving…'
                : crewPanel.kind === 'create'
                  ? `Save crew${Object.values(crewPicked).filter(Boolean).length > 0 ? ` · ${Object.values(crewPicked).filter(Boolean).length} people` : ''}`
                  : 'Save changes'}
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setCrewDeleteConfirm(false)} disabled={crewSaving}>
            Keep it
          </button>
        )}
      </div>
    </div>
  ) : null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10050,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'calc(16px + env(safe-area-inset-top, 0px)) 16px calc(16px + env(safe-area-inset-bottom, 0px))',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tech-tree-add-task-modal-title"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: 20,
          maxWidth: 440,
          width: '100%',
          maxHeight: 'min(90vh, 100%)',
          overflow: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="tech-tree-add-task-modal-title" style={{ margin: '0 0 0.5rem', fontSize: '1.125rem' }}>
          {isEditMode ? 'Edit task' : 'Add task'}
        </h2>
        <p style={{ margin: '0 0 1rem', color: 'var(--text-slate-500)', fontSize: 13 }}>Group: {groupTitle || '—'}</p>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-slate-500)', marginBottom: 4 }} htmlFor="tech-tree-add-task-title">
          Task title
        </label>
        <input
          id="tech-tree-add-task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ width: '100%', padding: '8px 10px', marginBottom: 12, boxSizing: 'border-box' }}
          disabled={saving}
        />
        <div style={{ fontSize: 12, color: 'var(--text-slate-500)', marginBottom: 4 }}>Assignees (optional)</div>
        {crewChips}
        {crewPanelView}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflow: 'auto', marginBottom: 16 }}>
          {usersOrderedForDisplay.map((u) => (
            <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!assignees[u.id]}
                onChange={(e) => {
                  setAssignees((m) => ({ ...m, [u.id]: e.target.checked }))
                  // A manual change means this box is yours now, not the crew's.
                  setViaCrew((v) => {
                    if (!(u.id in v)) return v
                    const next = { ...v }
                    delete next[u.id]
                    return next
                  })
                }}
                disabled={saving}
              />
              {u.name || u.email}
              {assignees[u.id] && viaCrew[u.id] ? (
                <span
                  style={{
                    fontSize: 11.5,
                    color: 'var(--text-blue-800)',
                    background: 'var(--bg-blue-tint)',
                    borderRadius: 999,
                    padding: '2px 8px',
                  }}
                >
                  {viaCrew[u.id]}
                </span>
              ) : null}
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !title.trim()}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>,
    target,
  )
}
