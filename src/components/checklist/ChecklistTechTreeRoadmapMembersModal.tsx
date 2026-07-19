import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { Database } from '../../types/database'

type MemberRow = Database['public']['Tables']['checklist_tech_tree_roadmap_members']['Row']

type Props = {
  open: boolean
  onClose: () => void
  roadmapId: string | null
  roadmapTitle: string
  authUserId: string
  users: Array<{ id: string; name: string; email: string }>
  members: MemberRow[]
  onMembersChanged: () => void
  canManage: boolean
  portalContainer?: HTMLElement | null
}

export function ChecklistTechTreeRoadmapMembersModal({
  open,
  onClose,
  roadmapId,
  roadmapTitle,
  authUserId,
  users,
  members,
  onMembersChanged,
  canManage,
  portalContainer,
}: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) setError(null)
  }, [open])

  const nameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const u of users) m.set(u.id, u.name?.trim() || u.email)
    return m
  }, [users])

  const refreshMembers = useCallback(async () => {
    if (!roadmapId) return
    onMembersChanged()
  }, [roadmapId, onMembersChanged])

  const addMember = useCallback(
    async (userId: string, role: 'viewer' | 'editor') => {
      if (!roadmapId || !canManage) return
      setSaving(true)
      setError(null)
      try {
        await withSupabaseRetry(
          () =>
            supabase.from('checklist_tech_tree_roadmap_members').insert({
              roadmap_id: roadmapId,
              user_id: userId,
              role,
            }),
          'insert roadmap member',
        )
        await refreshMembers()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not add member')
      } finally {
        setSaving(false)
      }
    },
    [canManage, roadmapId, refreshMembers],
  )

  const removeMember = useCallback(
    async (userId: string) => {
      if (!roadmapId || !canManage) return
      setSaving(true)
      setError(null)
      try {
        await withSupabaseRetry(
          () =>
            supabase
              .from('checklist_tech_tree_roadmap_members')
              .delete()
              .eq('roadmap_id', roadmapId)
              .eq('user_id', userId),
          'remove roadmap member',
        )
        await refreshMembers()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not remove member')
      } finally {
        setSaving(false)
      }
    },
    [canManage, roadmapId, refreshMembers],
  )

  const setRole = useCallback(
    async (userId: string, role: 'viewer' | 'editor') => {
      if (!roadmapId || !canManage) return
      setSaving(true)
      setError(null)
      try {
        await withSupabaseRetry(
          () =>
            supabase
              .from('checklist_tech_tree_roadmap_members')
              .update({ role })
              .eq('roadmap_id', roadmapId)
              .eq('user_id', userId),
          'update roadmap member role',
        )
        await refreshMembers()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not update role')
      } finally {
        setSaving(false)
      }
    },
    [canManage, roadmapId, refreshMembers],
  )

  if (!open || !roadmapId) return null

  const memberUserIds = new Set(members.map((m) => m.user_id))
  const addableUsers = users.filter((u) => !memberUserIds.has(u.id))

  const body = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="roadmap-members-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10060,
        background: 'rgba(15, 23, 42, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 10,
          maxWidth: 520,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 50px rgba(15, 23, 42, 0.2)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h2 id="roadmap-members-title" style={{ margin: 0, fontSize: '1.125rem' }}>
            Members — {roadmapTitle}
          </h2>
        </div>
        <div style={{ padding: 16 }}>
          {error ? (
            <p style={{ color: 'var(--text-amber-700)', marginTop: 0 }} role="alert">
              {error}
            </p>
          ) : null}
          <p style={{ marginTop: 0, fontSize: 13, color: 'var(--text-slate-500)' }}>
            Editors can change the graph and manage members. Viewers can see the roadmap and complete tasks assigned to
            them.
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0' }}>
            {members.map((m) => (
              <li
                key={m.user_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 0',
                  borderBottom: '1px solid #f1f5f9',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ flex: '1 1 140px', fontWeight: 500 }}>
                  {nameById.get(m.user_id) ?? m.user_id}
                  {m.user_id === authUserId ? ' (you)' : ''}
                </span>
                {canManage ? (
                  <select
                    value={m.role}
                    disabled={saving}
                    onChange={(e) => void setRole(m.user_id, e.target.value as 'viewer' | 'editor')}
                    aria-label={`Role for ${nameById.get(m.user_id) ?? m.user_id}`}
                    style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)' }}
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                  </select>
                ) : (
                  <span style={{ fontSize: 13, color: 'var(--text-slate-500)' }}>{m.role}</span>
                )}
                {canManage && m.user_id !== authUserId ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void removeMember(m.user_id)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: '1px solid #fecaca',
                      background: 'var(--bg-red-tint)',
                      color: 'var(--text-red-700)',
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {canManage && addableUsers.length > 0 ? (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Add people</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflow: 'auto' }}>
                {addableUsers.map((u) => (
                  <div
                    key={u.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}
                  >
                    <span style={{ fontSize: 14 }}>{u.name?.trim() || u.email}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void addMember(u.id, 'viewer')}
                        style={{
                          padding: '4px 8px',
                          fontSize: 12,
                          borderRadius: 6,
                          border: '1px solid var(--border-strong)',
                          background: 'var(--bg-slate-tint)',
                          cursor: 'pointer',
                        }}
                      >
                        + Viewer
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void addMember(u.id, 'editor')}
                        style={{
                          padding: '4px 8px',
                          fontSize: 12,
                          borderRadius: 6,
                          border: '1px solid var(--border-strong)',
                          background: 'var(--bg-slate-tint)',
                          cursor: 'pointer',
                        }}
                      >
                        + Editor
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <div style={{ padding: 12, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid var(--border-strong)',
              background: 'var(--surface)',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )

  if (portalContainer) return createPortal(body, portalContainer)
  return body
}
