import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import {
  assignUserToDispatchSwimLane,
  createDispatchSwimLane,
  deleteDispatchSwimLane,
  fetchDispatchSwimLanes,
  removeUserFromDispatchSwimLane,
  renameDispatchSwimLane,
  reorderDispatchSwimLanes,
  type DispatchSwimLanesData,
} from '../../lib/dispatchSwimLanes'
import type { DispatchSettingsModalRosterRow } from './DispatchSettingsModal'

const inputStyle = {
  padding: '0.3rem 0.45rem',
  fontSize: '0.8125rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
} as const

const smallBtn = {
  padding: '0.2rem 0.5rem',
  fontSize: '0.75rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
  background: 'var(--surface)',
  cursor: 'pointer',
} as const

/**
 * Dispatch Settings → "Swim lanes" manager. Self-contained: loads lanes on
 * mount and every mutation writes IMMEDIATELY (unlike the note-requirements
 * lists above, which batch under Save) — the copy says so. `onChanged` lets
 * the page refresh the grid's lane grouping live.
 */
export function DispatchSwimLanesSettingsSection({
  roster,
  onChanged,
}: {
  roster: DispatchSettingsModalRosterRow[]
  onChanged?: () => void
}) {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const [lanes, setLanes] = useState<DispatchSwimLanesData | null>(null)
  const [busy, setBusy] = useState(false)
  const [newLaneName, setNewLaneName] = useState('')
  const [renamingLaneId, setRenamingLaneId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const reload = useCallback(async () => {
    const { data, error } = await fetchDispatchSwimLanes()
    if (error) showToast(error, 'error')
    setLanes(data)
  }, [showToast])

  useEffect(() => {
    void reload()
  }, [reload])

  const run = useCallback(
    async (op: () => Promise<{ error: string | null }>) => {
      if (busy) return
      setBusy(true)
      try {
        const { error } = await op()
        if (error) {
          showToast(error, 'error')
          return
        }
        await reload()
        onChanged?.()
      } finally {
        setBusy(false)
      }
    },
    [busy, reload, onChanged, showToast],
  )

  const nameById = new Map(roster.map((r) => [r.userId, r.displayName]))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-strong)' }}>
        Swim lanes (People grid crews)
      </span>
      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        Named groups shown as sections on the People grid (cycle the <strong>Person</strong> header
        to <em>lanes</em>). A person belongs to <strong>one</strong> lane — assigning them moves
        them. Changes here save <strong>immediately</strong> and everyone sees the same lanes.
      </p>
      {lanes == null ? (
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Loading…</p>
      ) : (
        <>
          {lanes.lanes.map((lane, idx) => {
            const memberIds = lanes.memberIdsByLaneId.get(lane.id) ?? []
            return (
              <div
                key={lane.id}
                style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '0.5rem 0.6rem', display: 'flex', flexDirection: 'column', gap: 6 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {renamingLaneId === lane.id ? (
                    <>
                      <input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        aria-label={`New name for lane ${lane.name}`}
                        style={{ ...inputStyle, flex: '1 1 140px' }}
                      />
                      <button
                        type="button"
                        disabled={busy}
                        style={{ ...smallBtn, background: '#2563eb', color: '#fff', border: 'none' }}
                        onClick={() => {
                          void run(() => renameDispatchSwimLane(lane.id, renameValue)).then(() =>
                            setRenamingLaneId(null),
                          )
                        }}
                      >
                        Save
                      </button>
                      <button type="button" style={smallBtn} onClick={() => setRenamingLaneId(null)}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <strong style={{ fontSize: '0.8125rem', flex: '1 1 auto', minWidth: 0 }}>{lane.name}</strong>
                      <button
                        type="button"
                        aria-label={`Move lane ${lane.name} up`}
                        disabled={busy || idx === 0}
                        style={smallBtn}
                        onClick={() => {
                          const ids = lanes.lanes.map((l) => l.id)
                          ;[ids[idx - 1], ids[idx]] = [ids[idx]!, ids[idx - 1]!]
                          void run(() => reorderDispatchSwimLanes(ids))
                        }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`Move lane ${lane.name} down`}
                        disabled={busy || idx === lanes.lanes.length - 1}
                        style={smallBtn}
                        onClick={() => {
                          const ids = lanes.lanes.map((l) => l.id)
                          ;[ids[idx], ids[idx + 1]] = [ids[idx + 1]!, ids[idx]!]
                          void run(() => reorderDispatchSwimLanes(ids))
                        }}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        style={smallBtn}
                        onClick={() => {
                          setRenamingLaneId(lane.id)
                          setRenameValue(lane.name)
                        }}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        style={{ ...smallBtn, color: 'var(--text-red-700)' }}
                        onClick={() => {
                          if (!confirm(`Delete lane "${lane.name}"? Its people return to "Everyone else".`)) return
                          void run(() => deleteDispatchSwimLane(lane.id))
                        }}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                  {memberIds.map((uid) => (
                    <span
                      key={uid}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: '0.75rem',
                        border: '1px solid var(--border)',
                        borderRadius: 999,
                        padding: '0.1rem 0.3rem 0.1rem 0.55rem',
                        background: 'var(--bg-blue-tint)',
                      }}
                    >
                      {nameById.get(uid) ?? 'Unknown'}
                      <button
                        type="button"
                        aria-label={`Remove ${nameById.get(uid) ?? 'person'} from ${lane.name}`}
                        disabled={busy}
                        onClick={() => void run(() => removeUserFromDispatchSwimLane(uid))}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, fontSize: '0.8rem', lineHeight: 1, color: 'var(--text-muted)' }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <select
                    aria-label={`Add a person to ${lane.name}`}
                    disabled={busy}
                    value=""
                    onChange={(e) => {
                      const uid = e.target.value
                      if (!uid) return
                      void run(() => assignUserToDispatchSwimLane(uid, lane.id, memberIds.length))
                    }}
                    style={{ ...inputStyle, minWidth: 130 }}
                  >
                    <option value="">Add person…</option>
                    {roster
                      .filter((r) => !memberIds.includes(r.userId))
                      .map((r) => {
                        const otherLaneId = lanes.laneIdByUserId.get(r.userId)
                        const otherLane = otherLaneId
                          ? lanes.lanes.find((l) => l.id === otherLaneId)?.name
                          : null
                        return (
                          <option key={r.userId} value={r.userId}>
                            {r.displayName}
                            {otherLane ? ` (moves from ${otherLane})` : ''}
                          </option>
                        )
                      })}
                  </select>
                </div>
              </div>
            )
          })}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              value={newLaneName}
              onChange={(e) => setNewLaneName(e.target.value)}
              placeholder="New lane name…"
              aria-label="New swim lane name"
              disabled={busy}
              style={{ ...inputStyle, flex: '1 1 160px' }}
            />
            <button
              type="button"
              disabled={busy || !newLaneName.trim()}
              style={{ ...smallBtn, background: '#2563eb', color: '#fff', border: 'none', fontWeight: 600 }}
              onClick={() => {
                if (!user?.id) return
                void run(() => createDispatchSwimLane(newLaneName, lanes?.lanes.length ?? 0, user.id)).then(() =>
                  setNewLaneName(''),
                )
              }}
            >
              Add lane
            </button>
          </div>
        </>
      )}
    </div>
  )
}
