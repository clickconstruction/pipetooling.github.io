import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sessionMessage, setSessionMessage] = useState<string | null>(null)

  useEffect(() => {
    // Check for session expiry message
    const message = sessionStorage.getItem('auth_error_message')
    if (message) {
      setSessionMessage(message)
      sessionStorage.removeItem('auth_error_message')
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    void supabase.rpc('touch_last_sign_in')
    // Hard reload to clear cache (avoids stale data, service worker cache)
    const reload = () => { location.reload() }
    if (typeof caches !== 'undefined') {
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .then(reload, reload)
    } else {
      reload()
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: '4rem auto', padding: '0 1rem' }}>
      <h1 style={{ marginBottom: '1rem' }}>Sign in</h1>
      {sessionMessage && (
        <div style={{
          padding: '1rem',
          background: '#fef3c7',
          color: '#78350f',
          border: '1px solid #fbbf24',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span style={{ fontSize: '1.25rem' }}>⚠️</span>
          <span>{sessionMessage}</span>
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="email" style={{ display: 'block', marginBottom: 4 }}>Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="password" style={{ display: 'block', marginBottom: 4 }}>Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ width: '100%', padding: '0.5rem 1rem' }}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
        <p style={{ margin: 0, lineHeight: '1.6', color: '#374151', fontSize: '0.9375rem' }}>
          Pipe-Tooling is a web application designed for Master Plumbers to track plumbing work across multiple projects and crews. Masters can see all steps in a project, Assistants and Subcontractors can only see steps they have been assigned to.
        </p>
      </div>
      <p style={{ marginTop: '1rem', textAlign: 'center' }}>
        <Link to="/sign-up">Create an account</Link>
        {' · '}
        <Link to="/reset-password">Forgot password?</Link>
      </p>
    </div>
  )
}
