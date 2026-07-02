import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PasswordInput from '../components/PasswordInput'

/**
 * Landing page for invite-user email links (type=invite). The Supabase client's
 * detectSessionInUrl may consume the URL hash before this mounts, so the session is
 * acquired in three ways: auth event, existing session, then manual hash parse.
 * Invite links fire SIGNED_IN (not PASSWORD_RECOVERY), so SIGNED_IN means "ready to
 * set a password", never "done".
 */
export default function AcceptInvite() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [sessionReady, setSessionReady] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1))

    // Supabase appends error params for dead/used links instead of tokens
    if (hashParams.get('error_code') === 'otp_expired' || hashParams.get('error') === 'access_denied') {
      setCheckingSession(false)
      setError('This invite link is invalid or expired. Ask a dev to resend the invite.')
      return
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        setSessionReady(true)
        setCheckingSession(false)
      }
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady(true)
        setCheckingSession(false)
        return
      }
      const accessToken = hashParams.get('access_token')
      const type = hashParams.get('type')
      if (accessToken && type === 'invite') {
        supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: hashParams.get('refresh_token') || '',
        }).then(({ data: { session }, error }) => {
          setCheckingSession(false)
          if (error || !session) {
            setError('This invite link is invalid or expired. Ask a dev to resend the invite.')
          } else {
            setSessionReady(true)
          }
        })
      } else {
        setCheckingSession(false)
        setError('This invite link is invalid or expired. Ask a dev to resend the invite.')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

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

    // Already signed in via the invite token; straight into the app
    navigate('/', { replace: true })
  }

  if (checkingSession) {
    return (
      <div style={{ maxWidth: 360, margin: '4rem auto', padding: '0 1rem', textAlign: 'center' }}>
        <p>Verifying invite link…</p>
      </div>
    )
  }

  if (!sessionReady) {
    return (
      <div style={{ maxWidth: 360, margin: '4rem auto', padding: '0 1rem' }}>
        <h1 style={{ marginBottom: '1rem' }}>Accept invitation</h1>
        <p style={{ color: '#b91c1c' }}>{error || 'This invite link is invalid or expired. Ask a dev to resend the invite.'}</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 360, margin: '4rem auto', padding: '0 1rem' }}>
      <h1 style={{ marginBottom: '1rem' }}>Welcome to PipeTooling</h1>
      <p style={{ marginBottom: '1rem', color: '#374151' }}>
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
        {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ width: '100%', padding: '0.5rem 1rem' }}>
          {loading ? 'Setting password…' : 'Set password and continue'}
        </button>
      </form>
    </div>
  )
}
