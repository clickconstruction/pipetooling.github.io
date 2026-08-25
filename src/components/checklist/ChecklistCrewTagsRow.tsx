import { useCallback, useEffect, useRef, useState } from 'react'
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

type UserRow = { id: string; name: string | null; email: string | null }

const LONG_PRESS_MS = 500

type CrewPanelState = null | { kind: 'create' } | { kind: 'edit'; crewId: string }

type Props = {
  users: UserRow[]
  /** Current selection (userId → checked) — the row only reads it. */
  assignees: Readonly<Record<string, boolean>>
  /**
   * Apply a crew staffing change: set every id in `memberIds` to `checked`.
   * The parent owns how that lands (setState, immediate save, dedupe rules…).
   */
  onStaffCrew: (memberIds: string[], checked: boolean, crewName: string) => void
  /** Show ＋ New crew / ✎ Edit / long-press management (default true). */
  manage?: boolean
  /** Chip count style: 'members' = crew size; 'toAdd' = "+N" not yet selected. */
  countMode?: 'members' | 'toAdd'
  /** Shown first in the create/edit member picker. */
  currentUserId?: string | null
}

/**
 * The crew-tags chip row (People → Teams as one-tap staffing), shared by the
 * roadmap Add-task dialog, the everyday ChecklistAddModal, and (management
 * off) the task card. Tap a crew = stage/unstage all its members; chips read
 * filled / dashed-partial / plain from the parent's selection. Management
 * writes to `people_teams` / `people_team_members` so crews exist everywhere.
 */
export function ChecklistCrewTagsRow({
  users,
  assignees,
  onStaffCrew,
  manage = true,
  countMode = 'members',
  currentUserId = null,
}: Props) {
  const [crews, setCrews] = useState<CrewView[]>([])
  const [crewsUnavailable, setCrewsUnavailable] = useState(false)
  const [rowEditMode, setRowEditMode] = useState(false)
  const [panel, setPanel] = useState<CrewPanelState>(null)
  const [crewName, setCrewName] = useState('')
  const [picked, setPicked] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const longPressRef = useRef<{ timer: number; fired: boolean } | null>(null)

  const loadCrews = useCallback(async () => {
    try {
      const [teams, members] = await Promise.all([
        withSupabaseRetry(
          () => supabase.from('people_teams').select('id, name, sequence_order'),
          'load crews',
        ),
        withSupabaseRetry(
          () => supabase.from('people_team_members').select('team_id, person_name'),
          'load crew members',
        ),
      ])
      setCrews(buildCrewViews((teams ?? []) as CrewTeamRow[], (members ?? []) as CrewMemberRow[], users))
      setCrewsUnavailable(false)
    } catch {
      // RLS or load failure: the row simply doesn't render — selection still works.
      setCrewsUnavailable(true)
    }
  }, [users])

  useEffect(() => {
    void loadCrews()
  }, [loadCrews])

  const usersOrdered = (() => {
    if (!currentUserId) return users
    const me = users.find((u) => u.id === currentUserId)
    if (!me) return users
    return [me, ...users.filter((u) => u.id !== currentUserId)]
  })()

  const openPanel = (state: CrewPanelState, crew?: CrewView) => {
    setPanel(state)
    setError(null)
    setDeleteConfirm(false)
    if (crew) {
      setCrewName(crew.name)
      const m: Record<string, boolean> = {}
      for (const id of crew.memberUserIds) m[id] = true
      setPicked(m)
    } else {
      setCrewName('')
      setPicked({})
    }
  }

  const cancelLongPress = () => {
    if (longPressRef.current) window.clearTimeout(longPressRef.current.timer)
  }
  const startLongPress = (crew: CrewView) => {
    if (!manage) return
    cancelLongPress()
    const timer = window.setTimeout(() => {
      if (longPressRef.current) longPressRef.current.fired = true
      openPanel({ kind: 'edit', crewId: crew.id }, crew)
    }, LONG_PRESS_MS)
    longPressRef.current = { timer, fired: false }
  }

  const onChipClick = (crew: CrewView) => {
    if (longPressRef.current?.fired) {
      longPressRef.current.fired = false
      return
    }
    if (manage && rowEditMode) {
      openPanel({ kind: 'edit', crewId: crew.id }, crew)
      return
    }
    const state = crewChipState(crew.memberUserIds, assignees)
    onStaffCrew(crew.memberUserIds, state !== 'all', crew.name)
  }

  const saveCrew = async () => {
    const name = crewName.trim()
    if (!name || saving) return
    const pickedIds = Object.entries(picked)
      .filter(([, v]) => v)
      .map(([k]) => k)
    setSaving(true)
    setError(null)
    try {
      if (panel?.kind === 'create') {
        const inserted = await withSupabaseRetry<{ id: string }>(
          () =>
            supabase.from('people_teams').insert({ name, sequence_order: crews.length }).select('id').single(),
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
        // The new crew comes back active on the current selection.
        onStaffCrew(pickedIds, true, name)
      } else if (panel?.kind === 'edit') {
        const crew = crews.find((c) => c.id === panel.crewId)
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
      setPanel(null)
      setRowEditMode(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save crew')
    } finally {
      setSaving(false)
    }
  }

  const deleteCrew = async () => {
    if (panel?.kind !== 'edit' || saving) return
    setSaving(true)
    setError(null)
    try {
      await withSupabaseRetry(
        () => supabase.from('people_team_members').delete().eq('team_id', panel.crewId),
        'delete crew members',
      )
      await withSupabaseRetry(
        () => supabase.from('people_teams').delete().eq('id', panel.crewId),
        'delete crew',
      )
      await loadCrews()
      setPanel(null)
      setRowEditMode(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete crew')
    } finally {
      setSaving(false)
      setDeleteConfirm(false)
    }
  }

  if (crewsUnavailable) return null
  if (!manage && crews.length === 0) return null

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

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '2px 0 8px' }}>
        {crews.map((c) => {
          const state = crewChipState(c.memberUserIds, assignees)
          const active = state === 'all' && c.memberUserIds.length > 0
          const partial = state === 'some'
          const toAdd = c.memberUserIds.filter((id) => !assignees[id]).length
          const countLabel =
            countMode === 'toAdd' && !active ? `+${toAdd}` : `${c.memberUserIds.length}${active ? ' ✓' : ''}`
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onChipClick(c)}
              onPointerDown={() => startLongPress(c)}
              onPointerUp={cancelLongPress}
              onPointerLeave={cancelLongPress}
              onContextMenu={(e) => {
                if (!manage) return
                e.preventDefault()
                openPanel({ kind: 'edit', crewId: c.id }, c)
              }}
              title={
                (manage && rowEditMode ? `Edit ${c.name}` : `Staff ${c.name}`) +
                (c.unmatchedCount > 0
                  ? ` · ${c.unmatchedCount} member${c.unmatchedCount === 1 ? ' has' : 's have'} no login`
                  : '')
              }
              style={{
                ...chipBase,
                border: active
                  ? '1.5px solid #2563eb'
                  : partial || (manage && rowEditMode)
                    ? '1.5px dashed #2563eb'
                    : '1.5px solid var(--border-strong)',
                ...(active ? { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)' } : {}),
                ...(partial || (manage && rowEditMode) ? { color: 'var(--text-blue-800)' } : {}),
              }}
            >
              {manage && rowEditMode ? '✎ ' : ''}
              {c.name}
              <span style={{ fontWeight: 400, color: active ? 'var(--text-blue-800)' : 'var(--text-muted)' }}>
                {countLabel}
              </span>
            </button>
          )
        })}
        {manage ? (
          <button
            type="button"
            onClick={() => openPanel({ kind: 'create' })}
            style={{ ...chipBase, border: '1.5px dashed var(--border-strong)', color: 'var(--text-muted)' }}
          >
            ＋ New crew
          </button>
        ) : null}
        {manage && crews.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              setRowEditMode((m) => !m)
              setPanel(null)
            }}
            aria-pressed={rowEditMode}
            style={{
              ...chipBase,
              border: rowEditMode ? '1.5px solid #2563eb' : '1.5px dashed var(--border-strong)',
              color: rowEditMode ? 'var(--text-blue-800)' : 'var(--text-muted)',
              ...(rowEditMode ? { background: 'var(--bg-blue-tint)' } : {}),
            }}
          >
            {rowEditMode ? '✎ Editing — tap a crew' : '✎ Edit'}
          </button>
        ) : null}
      </div>
      {panel ? (
        <div
          style={{
            border: '1.5px dashed #d97706',
            background: 'var(--bg-amber-tint)',
            borderRadius: 10,
            padding: '10px 12px',
            marginBottom: 10,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text-amber-800)',
              letterSpacing: '0.02em',
              textTransform: 'uppercase',
              marginBottom: 7,
            }}
          >
            {panel.kind === 'create' ? 'New crew' : `Edit crew — ${crews.find((c) => c.id === panel.crewId)?.name ?? ''}`}
          </div>
          <input
            value={crewName}
            onChange={(e) => setCrewName(e.target.value)}
            placeholder="Crew name"
            disabled={saving}
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
            {usersOrdered.map((u) => (
              <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={!!picked[u.id]}
                  onChange={(e) => setPicked((m) => ({ ...m, [u.id]: e.target.checked }))}
                  disabled={saving}
                />
                {u.name || u.email}
              </label>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 7 }}>
            {panel.kind === 'create'
              ? 'Tick who’s in it. Saves to People → Teams, so this crew shows up everywhere.'
              : 'Changes save to People → Teams — every surface that uses this crew follows. Members without logins stay on the crew.'}
          </div>
          {error ? <div style={{ fontSize: 12.5, color: 'var(--text-red-700)', marginTop: 6 }}>{error}</div> : null}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            {panel.kind === 'edit' ? (
              deleteConfirm ? (
                <>
                  <span style={{ fontSize: 12, color: 'var(--text-red-700)', flex: 1, minWidth: 0 }}>
                    Removes this crew from People → Teams everywhere. People stay; only the grouping goes.
                  </span>
                  <button
                    type="button"
                    onClick={() => void deleteCrew()}
                    disabled={saving}
                    style={{
                      background: '#dc2626',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 7,
                      padding: '7px 12px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {saving ? 'Deleting…' : 'Delete permanently'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(true)}
                  disabled={saving}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: 'var(--text-red-700)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Delete crew…
                </button>
              )
            ) : null}
            <span style={{ flex: 1 }} />
            {!deleteConfirm ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setPanel(null)
                    setDeleteConfirm(false)
                  }}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void saveCrew()}
                  disabled={saving || !crewName.trim()}
                  style={{
                    background: saving || !crewName.trim() ? 'var(--bg-200)' : '#2563eb',
                    color: saving || !crewName.trim() ? 'var(--text-muted)' : '#fff',
                    border: 'none',
                    borderRadius: 7,
                    padding: '7px 14px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: saving || !crewName.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  {saving
                    ? 'Saving…'
                    : panel.kind === 'create'
                      ? `Save crew${Object.values(picked).filter(Boolean).length > 0 ? ` · ${Object.values(picked).filter(Boolean).length} people` : ''}`
                      : 'Save changes'}
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setDeleteConfirm(false)} disabled={saving}>
                Keep it
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
