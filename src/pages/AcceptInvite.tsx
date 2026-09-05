import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PasswordInput from '../components/PasswordInput'
import {
  clearInvitePending,
  markInvitePendingFromHash,
  parseAcceptInviteHash,
  readInvitePending,
  resolveAcceptInviteState,
  safeSessionStorage,
} from '../lib/acceptInviteState'
import { recordNavClick } from '../lib/navClickTelemetry'

const INVALID_LINK = 'This invite link is invalid or expired. Ask a dev to resend the invite.'

/**
 * Landing page for invite-user email links (type=invite). The Supabase client's
 * detectSessionInUrl may consume the URL hash before this mounts, so the session is
 * acquired in three ways: auth event, existing session, then manual hash parse.
 * Invite links fire SIGNED_IN (not PASSWORD_RECOVERY), so SIGNED_IN means "ready to
 * set a password", never "done".
 *
 * The form arms only for a session that arrived through the invite (hash now, or the
 * `accept_invite_pending` flag `main.tsx` set when the hash landed). Any other live
 * session — a hire revisiting the bare URL from history, a signed-in dev wandering here —
 * sees "You're already set up" instead of a form that would reset *that* account's
 * password. Decision table: `src/lib/acceptInviteState.ts`.
 */
export default function AcceptInvite() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasSession, setHasSession] = useState<boolean | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [hashInfo] = useState(() => parseAcceptInviteHash(window.location.hash))
  const [pendingInviteFlag] = useState(() => {
    const storage = safeSessionStorage()
    markInvitePendingFromHash(window.location.hash, storage)
    return readInvitePending(storage)
  })
  const navigate = useNavigate()

  const view = resolveAcceptInviteState({
    hasSession,
    inviteHashPresent: hashInfo.inviteHashPresent,
    pendingInviteFlag,
    errorHash: hashInfo.errorHash,
  })

  useEffect(() => {
    // Dead/used link with no invite session behind it: nothing to wait for.
    if (hashInfo.errorHash && !pendingInviteFlag) return

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setHasSession(true)
        setUserId(session.user.id)
      }
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setHasSession(true)
        setUserId(session.user.id)
        return
      }
      if (hashInfo.inviteHashPresent && hashInfo.accessToken) {
        supabase.auth.setSession({
          access_token: hashInfo.accessToken,
          refresh_token: hashInfo.refreshToken || '',
        }).then(({ data: { session }, error }) => {
          if (error || !session) {
            setHasSession(false)
          } else {
            setHasSession(true)
            setUserId(session.user.id)
          }
        })
      } else {
        setHasSession(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [hashInfo, pendingInviteFlag])

  useEffect(() => {
    if (view === 'already-set-up' && userId) {
      recordNavClick(userId, null, 'accept_invite_blocked_already_set_up', '/accept-invite')
    }
  }, [view, userId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (view !== 'set-password') return

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    const { error: err } = await supabase.auth.updateUser({
      password: password,
    })

    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }

    clearInvitePending(safeSessionStorage())
    // Already signed in via the invite token; straight into the app
    navigate('/', { replace: true })
  }

  async function handleSignOut() {
    setLoading(true)
    try {
      await supabase.auth.signOut()
    } finally {
      setLoading(false)
      navigate('/sign-in', { replace: true })
    }
  }

  if (view === 'loading') {
    return (
      <div style={{ maxWidth: 360, margin: '4rem auto', padding: '0 1rem', textAlign: 'center' }}>
        <p>Verifying invite link…</p>
      </div>
    )
  }

  if (view === 'invalid-link') {
    return (
      <div style={{ maxWidth: 360, margin: '4rem auto', padding: '0 1rem' }}>
        <h1 style={{ marginBottom: '1rem' }}>Accept invitation</h1>
        <p style={{ color: 'var(--text-red-700)' }}>{INVALID_LINK}</p>
      </div>
    )
  }

  if (view === 'already-set-up') {
    return (
      <div style={{ maxWidth: 360, margin: '4rem auto', padding: '0 1rem' }}>
        <h1 style={{ marginBottom: '1rem' }}>You're already set up</h1>
        <p style={{ marginBottom: '1rem', color: 'var(--text-700)' }}>
          This account already has a password, so there is nothing to set here. Sign in to keep going.
        </p>
        <button
          type="button"
          onClick={() => navigate('/dashboard', { replace: true })}
          style={{ width: '100%', padding: '0.5rem 1rem' }}
        >
          Sign in
        </button>
        <p style={{ marginTop: '1rem', textAlign: 'center' }}>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={loading}
            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-muted)', textDecoration: 'underline', cursor: 'pointer' }}
          >
            Not you? Sign out
          </button>
        </p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 360, margin: '4rem auto', padding: '0 1rem' }}>
      <h1 style={{ marginBottom: '1rem' }}>Welcome to ClickTooling</h1>
      <p style={{ marginBottom: '1rem', color: 'var(--text-700)' }}>
        Choose a password to finish setting up your account.
      </p>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <PasswordInput
            id="password"
            label="Password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError(null)
            }}
            required
            autoComplete="new-password"
            minLength={6}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <PasswordInput
            id="confirm-password"
            label="Confirm password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value)
              setError(null)
            }}
            required
            autoComplete="new-password"
            minLength={6}
          />
        </div>
        {error && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ width: '100%', padding: '0.5rem 1rem' }}>
          {loading ? 'Setting password…' : 'Set password and continue'}
        </button>
      </form>
    </div>
  )
}
