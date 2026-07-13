import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import {
  computeTeamFeedbackEligibilityDetail,
  fetchAllActiveUsersForTeamFeedbackOverview,
  fetchAllTeamFeedbackUserStates,
  fetchTeamFeedbackSettings,
  resetTeamFeedbackUserStateEligibilityForDev,
  type TeamFeedbackEligibilityDetail,
  type TeamFeedbackOverviewUserRow,
  type TeamFeedbackSettingsRow,
  type TeamFeedbackUserStateRow,
} from '../../lib/teamFeedback'
import { useToastContext } from '../../contexts/ToastContext'

function eligibilitySummary(detail: TeamFeedbackEligibilityDetail): { badge: string; line: string } {
  if (detail.reason === 'disabled') {
    return { badge: 'Off', line: 'Team feedback is disabled in settings.' }
  }
  if (detail.reason === 'ok') {
    return {
      badge: 'Eligible',
      line: 'Eligible on next qualifying clock-out.',
    }
  }
  const when = detail.earliestEligibleAt
  const whenStr = when ? when.toLocaleString() : '—'
  if (detail.reason === 'snoozed') {
    return {
      badge: 'Snoozed',
      line: `Eligible after ${whenStr} (next qualifying clock-out).`,
    }
  }
  return {
    badge: 'Cadence',
    line: `Eligible after ${whenStr} (next qualifying clock-out).`,
  }
}

function badgeStyle(detail: TeamFeedbackEligibilityDetail): CSSProperties {
  if (detail.reason === 'ok') {
    return { background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }
  }
  if (detail.reason === 'disabled') {
    return { background: 'var(--bg-muted)', color: 'var(--text-600)', border: '1px solid var(--border-strong)' }
  }
  return { background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' }
}

export default function TeamFeedbackEligibilityOverview() {
  const { showToast } = useToastContext()
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [settings, setSettings] = useState<TeamFeedbackSettingsRow | null>(null)
  const [users, setUsers] = useState<TeamFeedbackOverviewUserRow[]>([])
  const [stateByUser, setStateByUser] = useState<Map<string, TeamFeedbackUserStateRow>>(new Map())
  const [filter, setFilter] = useState('')
  const [resettingUserId, setResettingUserId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, u, m] = await Promise.all([
        fetchTeamFeedbackSettings(),
        fetchAllActiveUsersForTeamFeedbackOverview(),
        fetchAllTeamFeedbackUserStates(),
      ])
      setSettings(s)
      setUsers(u)
      setStateByUser(m)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to load eligibility overview', 'error')
    } finally {
      setLoading(false)
      setHasLoadedOnce(true)
    }
  }, [showToast])

  useEffect(() => {
    if (modalOpen) void load()
  }, [modalOpen, load])

  useEffect(() => {
    if (!modalOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setModalOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [modalOpen])

  const handleResetEligibility = useCallback(
    async (userId: string) => {
      setResettingUserId(userId)
      try {
        const result = await resetTeamFeedbackUserStateEligibilityForDev(userId)
        if (result === 'updated') {
          showToast('Eligibility state cleared for this user', 'success')
          await load()
        } else {
          showToast('No stored state for this user', 'info')
        }
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Reset failed', 'error')
      } finally {
        setResettingUserId(null)
      }
    },
    [load, showToast]
  )

  const filteredUsers = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => {
      const name = (u.name ?? '').toLowerCase()
      const email = (u.email ?? '').toLowerCase()
      return name.includes(q) || email.includes(q)
    })
  }, [users, filter])

  const nowMs = Date.now()

  const modalBody = (
    <>
      {loading && <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading…</p>}
      {!loading && hasLoadedOnce && (
        <>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.8125rem' }}>
            <span style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem', color: 'var(--text-700)' }}>
              Filter by name or email
            </span>
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search…"
              style={{
                width: '100%',
                maxWidth: 320,
                padding: '0.4rem 0.5rem',
                borderRadius: 6,
                border: '1px solid var(--border-strong)',
                fontSize: '0.875rem',
              }}
            />
          </label>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: 'var(--text-faint)' }}>
            Cadence: {settings?.cadence_days ?? '—'} day(s). Prompts run on clock-out when eligible.
          </p>
          <div
            style={{
              maxHeight: 'min(28rem, 60vh)',
              overflow: 'auto',
              border: '1px solid var(--border)',
              borderRadius: 8,
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem 0.65rem', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>
                    User
                  </th>
                  <th style={{ padding: '0.5rem 0.65rem', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>
                    Role
                  </th>
                  <th style={{ padding: '0.5rem 0.65rem', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>
                    Eligibility
                  </th>
                  <th style={{ padding: '0.5rem 0.65rem', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const state = stateByUser.get(u.id) ?? null
                  const detail = computeTeamFeedbackEligibilityDetail(settings, state, nowMs)
                  const { badge, line } = eligibilitySummary(detail)
                  const hasStateRow = stateByUser.has(u.id)
                  const resetBusy = resettingUserId === u.id
                  return (
                    <tr key={u.id}>
                      <td style={{ padding: '0.45rem 0.65rem', borderBottom: '1px solid #f3f4f6', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 500, color: 'var(--text-strong)' }}>{u.name || '—'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                          {u.email ?? ''}
                        </div>
                      </td>
                      <td style={{ padding: '0.45rem 0.65rem', borderBottom: '1px solid #f3f4f6', color: 'var(--text-700)' }}>
                        {u.role ?? '—'}
                      </td>
                      <td style={{ padding: '0.45rem 0.65rem', borderBottom: '1px solid #f3f4f6', verticalAlign: 'top' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '0.15rem 0.45rem',
                            borderRadius: 4,
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            marginBottom: '0.25rem',
                            ...badgeStyle(detail),
                          }}
                        >
                          {badge}
                        </span>
                        <div style={{ color: 'var(--text-600)', lineHeight: 1.35 }}>{line}</div>
                      </td>
                      <td style={{ padding: '0.45rem 0.65rem', borderBottom: '1px solid #f3f4f6', verticalAlign: 'top' }}>
                        <button
                          type="button"
                          title="Clear snooze and cadence barriers for this user (dev only)."
                          disabled={!hasStateRow || resetBusy}
                          onClick={() => void handleResetEligibility(u.id)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            borderRadius: 6,
                            border: '1px solid var(--border-strong)',
                            background: !hasStateRow || resetBusy ? 'var(--bg-muted)' : 'var(--surface)',
                            color: 'var(--text-700)',
                            cursor: !hasStateRow || resetBusy ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {resetBusy ? '…' : 'Reset'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filteredUsers.length === 0 && (
              <p style={{ margin: 0, padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                No users match this filter.
              </p>
            )}
          </div>
        </>
      )}
    </>
  )

  return (
    <>
      <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          aria-haspopup="dialog"
          style={{
            padding: '0.35rem 0.75rem',
            borderRadius: 6,
            border: '1px solid var(--border-strong)',
            background: 'var(--surface)',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'var(--text-700)',
            cursor: 'pointer',
          }}
        >
          Eligibility
        </button>
      </div>
      {modalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="presentation"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1040,
              background: 'rgba(15, 23, 42, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
              boxSizing: 'border-box',
            }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setModalOpen(false)
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="team-feedback-eligibility-modal-title"
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 720,
                maxHeight: 'min(90vh, 900px)',
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--surface)',
                borderRadius: 10,
                border: '1px solid var(--border)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  padding: '0.85rem 1rem',
                  borderBottom: '1px solid var(--border)',
                  background: 'var(--bg-subtle)',
                }}
              >
                <h2
                  id="team-feedback-eligibility-modal-title"
                  style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-strong)' }}
                >
                  Eligibility
                </h2>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{
                    padding: '0.35rem 0.65rem',
                    borderRadius: 6,
                    border: '1px solid var(--border-strong)',
                    background: 'var(--surface)',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: 'var(--text-700)',
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
              <div style={{ overflow: 'auto', padding: '1rem', flex: '1 1 auto', minHeight: 0 }}>{modalBody}</div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
