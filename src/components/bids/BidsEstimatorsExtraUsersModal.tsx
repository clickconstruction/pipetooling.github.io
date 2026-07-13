import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import type { Database } from '../../types/database'

type UserRow = Pick<
  Database['public']['Tables']['users']['Row'],
  'id' | 'name' | 'role'
>

export type BidsEstimatorsExtraUsersModalProps = {
  open: boolean
  onClose: () => void
  /** Called after a successful add or remove so the parent can refresh the column set. */
  onChanged: () => void
}

/**
 * Dev / master_technician / assistant only — manages the org-wide augmentation list
 * `bid_estimators_extra_users` for the Bids → Estimators tab. Users with role
 * `estimator` are always shown as columns and not listed here.
 */
export function BidsEstimatorsExtraUsersModal({
  open,
  onClose,
  onChanged,
}: BidsEstimatorsExtraUsersModalProps) {
  const { showToast } = useToastContext()
  const [allUsers, setAllUsers] = useState<UserRow[]>([])
  const [extraIds, setExtraIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [usersRaw, extrasRaw] = await Promise.all([
        withSupabaseRetry(
          async () =>
            supabase
              .from('users')
              .select('id, name, role')
              .is('archived_at', null)
              .order('name', { ascending: true, nullsFirst: false }),
          'bid estimators extras: load users',
        ),
        withSupabaseRetry(
          async () => supabase.from('bid_estimators_extra_users').select('user_id'),
          'bid estimators extras: load existing',
        ),
      ])
      const usersTyped = ((usersRaw ?? []) as UserRow[]).filter(
        (u) => (u.name?.trim().toLowerCase() ?? '') !== 'delete',
      )
      setAllUsers(usersTyped)
      const extras = ((extrasRaw ?? []) as { user_id: string }[]).map((r) => r.user_id)
      setExtraIds(new Set(extras))
    } catch (e: unknown) {
      showToast(formatErrorMessage(e, 'Failed to load estimator column list'), 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    if (!open) return
    void load()
  }, [open, load])

  const candidateUsers = useMemo(() => {
    // Exclude helpers (never columns) and estimators (always columns, not toggleable here).
    return allUsers.filter((u) => u.role !== 'helpers' && u.role !== 'estimator')
  }, [allUsers])

  const filteredCandidates = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return candidateUsers
    return candidateUsers.filter((u) => (u.name ?? '').toLowerCase().includes(q))
  }, [candidateUsers, search])

  const estimatorRoleUsers = useMemo(
    () => allUsers.filter((u) => u.role === 'estimator'),
    [allUsers],
  )

  const toggle = useCallback(
    async (userId: string, on: boolean) => {
      setBusyUserId(userId)
      try {
        if (on) {
          await withSupabaseRetry(
            async () =>
              supabase
                .from('bid_estimators_extra_users')
                .insert({ user_id: userId }),
            'bid estimators extras: insert',
          )
          setExtraIds((prev) => {
            const next = new Set(prev)
            next.add(userId)
            return next
          })
        } else {
          await withSupabaseRetry(
            async () =>
              supabase
                .from('bid_estimators_extra_users')
                .delete()
                .eq('user_id', userId),
            'bid estimators extras: delete',
          )
          setExtraIds((prev) => {
            const next = new Set(prev)
            next.delete(userId)
            return next
          })
        }
        onChanged()
      } catch (e: unknown) {
        showToast(formatErrorMessage(e, 'Failed to update estimator column list'), 'error')
      } finally {
        setBusyUserId(null)
      }
    },
    [onChanged, showToast],
  )

  if (!open) return null

  const overlay: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 60,
    padding: '1rem',
  }

  const sheet: CSSProperties = {
    background: 'var(--surface)',
    borderRadius: 8,
    maxWidth: 520,
    width: '100%',
    maxHeight: '90vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
  }

  return (
    <div
      style={overlay}
      role="dialog"
      aria-modal
      aria-labelledby="bid-estimators-extras-modal-title"
    >
      <div style={sheet}>
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
          }}
        >
          <h2 id="bid-estimators-extras-modal-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
            Manage Estimators columns
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.35rem 0.65rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              background: 'var(--bg-subtle)',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
        <div style={{ padding: '0.75rem 1.25rem 1.25rem', overflow: 'auto', flex: 1 }}>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: 'var(--text-700)' }}>
            Users with role <strong>Estimator</strong> are always columns. Add anyone else from your team
            below to also show their bid-clock time. Changes are visible to everyone.
          </p>
          {loading ? (
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading…</p>
          ) : (
            <>
              {estimatorRoleUsers.length > 0 ? (
                <div style={{ marginTop: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Always included
                  </div>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    {estimatorRoleUsers.map((u) => (
                      <li key={u.id} style={{ padding: '0.35rem 0.5rem', fontSize: '0.875rem', color: 'var(--text-700)', background: 'var(--bg-muted)', borderRadius: 4 }}>
                        {u.name?.trim() || '—'}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div style={{ marginTop: '1rem' }}>
                <div
                  style={{
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--text-muted)',
                    marginBottom: '0.25rem',
                  }}
                >
                  Also include
                </div>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name…"
                  aria-label="Search users to add"
                  style={{
                    width: '100%',
                    padding: '0.4rem 0.6rem',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 4,
                    fontSize: '0.875rem',
                    boxSizing: 'border-box',
                    marginBottom: '0.4rem',
                  }}
                />
                {filteredCandidates.length === 0 ? (
                  <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    {search.trim() ? 'No users match.' : 'No additional users.'}
                  </p>
                ) : (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    {filteredCandidates.map((u) => {
                      const isOn = extraIds.has(u.id)
                      const busy = busyUserId === u.id
                      return (
                        <li
                          key={u.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.5rem',
                            padding: '0.35rem 0.5rem',
                            borderRadius: 4,
                            background: isOn ? 'var(--bg-blue-tint)' : 'transparent',
                          }}
                        >
                          <label
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              fontSize: '0.875rem',
                              cursor: busy ? 'wait' : 'pointer',
                              flex: 1,
                              minWidth: 0,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isOn}
                              disabled={busy}
                              onChange={(e) => void toggle(u.id, e.target.checked)}
                            />
                            <span style={{ color: 'var(--text-strong)' }}>{u.name?.trim() || '—'}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{labelForRole(u.role)}</span>
                          </label>
                          {busy ? <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>…</span> : null}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function labelForRole(role: Database['public']['Enums']['user_role']): string {
  switch (role) {
    case 'dev':
      return 'Dev'
    case 'master_technician':
      return 'Master'
    case 'master':
      return 'Master'
    case 'owner':
      return 'Owner'
    case 'assistant':
      return 'Assistant'
    case 'subcontractor':
      return 'Sub'
    case 'helpers':
      return 'Helper'
    case 'estimator':
      return 'Estimator'
    case 'primary':
      return 'Primary'
    case 'superintendent':
      return 'Super'
    default:
      return ''
  }
}
