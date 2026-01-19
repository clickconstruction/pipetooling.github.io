import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setLoading(true)

    const redirectTo = `${window.location.origin}/reset-password-confirm`
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    })

    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }

    setSuccess(true)
  }

  if (success) {
    return (
      <div style={{ maxWidth: 360, margin: '4rem auto', padding: '0 1rem' }}>
        <h1 style={{ marginBottom: '1rem' }}>Check your email</h1>
        <p style={{ marginBottom: '1rem', color: '#374151' }}>
          We've sent a password reset link to <strong>{email}</strong>. Click the link in the email to reset your password.
        </p>
        <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
          Didn't receive the email? Check your spam folder or{' '}
          <button
            type="button"
            onClick={() => {
              setSuccess(false)
              setEmail('')
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#2563eb',
              textDecoration: 'underline',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            try again
          </button>
          .
        </p>
        <p style={{ marginTop: '1rem' }}>
          <Link to="/sign-in">Back to sign in</Link>
        </p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 360, margin: '4rem auto', padding: '0 1rem' }}>
      <h1 style={{ marginBottom: '1rem' }}>Reset password</h1>
      <p style={{ marginBottom: '1rem', color: '#374151' }}>
        Enter your email address and we'll send you a link to reset your password.
      </p>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="email" style={{ display: 'block', marginBottom: 4 }}>Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError(null)
            }}
            required
            autoComplete="email"
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ width: '100%', padding: '0.5rem 1rem' }}>
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
      <p style={{ marginTop: '1rem' }}>
        <Link to="/sign-in">Back to sign in</Link>
      </p>
    </div>
  )
}
