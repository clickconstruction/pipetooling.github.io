import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ResetPasswordConfirm() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    // Handle password reset from email link
    // Supabase redirects with hash fragments containing the access token
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setCheckingSession(false)
        // Session is available, user can now set new password
      } else if (event === 'SIGNED_IN') {
        // Password was successfully updated, redirect
        navigate('/sign-in', { replace: true, state: { message: 'Password reset successfully. Please sign in with your new password.' } })
      }
    })

    // Also check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setCheckingSession(false)
      } else {
        // Check if we're coming from a password reset link
        // Supabase uses hash fragments for password reset tokens
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        const type = hashParams.get('type')
        
        if (accessToken && type === 'recovery') {
          // We have a recovery token, set the session
          supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: hashParams.get('refresh_token') || '',
          }).then(({ data: { session }, error }) => {
            setCheckingSession(false)
            if (error || !session) {
              setError('Invalid or expired reset link. Please request a new password reset.')
            }
          })
        } else {
          setCheckingSession(false)
          setError('Invalid or expired reset link. Please request a new password reset.')
        }
      }
    })
  }, [navigate])

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

    // Success - redirect to sign in
    navigate('/sign-in', { replace: true, state: { message: 'Password reset successfully. Please sign in with your new password.' } })
  }

  if (checkingSession) {
    return (
      <div style={{ maxWidth: 360, margin: '4rem auto', padding: '0 1rem', textAlign: 'center' }}>
        <p>Verifying reset link…</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 360, margin: '4rem auto', padding: '0 1rem' }}>
      <h1 style={{ marginBottom: '1rem' }}>Set new password</h1>
      <p style={{ marginBottom: '1rem', color: '#374151' }}>
        Enter your new password below.
      </p>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="password" style={{ display: 'block', marginBottom: 4 }}>New password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError(null)
            }}
            required
            autoComplete="new-password"
            minLength={6}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="confirm-password" style={{ display: 'block', marginBottom: 4 }}>Confirm new password</label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value)
              setError(null)
            }}
            required
            autoComplete="new-password"
            minLength={6}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ width: '100%', padding: '0.5rem 1rem' }}>
          {loading ? 'Updating password…' : 'Update password'}
        </button>
      </form>
    </div>
  )
}
