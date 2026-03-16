import { useState, useEffect } from 'react'
import { useSearchParams, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function DevLogin() {
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [redirectTo, setRedirectTo] = useState('/dashboard')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const secret = import.meta.env.VITE_DEV_LOGIN_SECRET as string | undefined
  const asParam = searchParams.get('as')

  useEffect(() => {
    if (!asParam || !secret || !import.meta.env.DEV) return
    setEmail(asParam)
    const to = searchParams.get('to') ?? '/dashboard'
    setRedirectTo(to)
    setLoading(true)
    setError(null)
    const baseUrl = window.location.origin
    const targetRedirect = `${baseUrl}${to.startsWith('/') ? to : `/${to}`}`

    supabase.functions
      .invoke('dev-login', {
        body: { email: asParam.trim(), redirectTo: targetRedirect },
        headers: { 'X-Dev-Login-Secret': secret },
      })
      .then(({ data, error: err }) => {
        setLoading(false)
        if (err) {
          const isFetchError = err?.name === 'FunctionsFetchError'
          setError(
            isFetchError
              ? 'dev-login Edge Function not reachable. Deploy it: supabase functions deploy dev-login && supabase secrets set DEV_LOGIN_SECRET=your-secret'
              : err.message
          )
          return
        }
        const link = (data as { action_link?: string } | null)?.action_link
        if (link) {
          window.location.href = link
        } else {
          setError('No login link returned')
        }
      })
      .catch((e) => {
        setLoading(false)
        setError(e?.message ?? 'Failed to dev login')
      })
  }, [asParam, secret, searchParams])

  if (!import.meta.env.DEV) {
    return <Navigate to="/sign-in" replace />
  }

  if (asParam && loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Signing in as {asParam}…</p>
      </div>
    )
  }

  if (!secret) {
    return (
      <div style={{ maxWidth: 400, margin: '4rem auto', padding: '1.5rem' }}>
        <h2 style={{ marginTop: 0 }}>Dev Login</h2>
        <p style={{ color: '#b91c1c' }}>
          Set <code>VITE_DEV_LOGIN_SECRET</code> in <code>.env.local</code> to use dev login.
        </p>
        <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
          Also set <code>DEV_LOGIN_SECRET</code> for the Edge Function (e.g. <code>supabase secrets set DEV_LOGIN_SECRET=your-secret</code>).
        </p>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!secret) return
    const trimmed = email.trim()
    if (!trimmed) {
      setError('Enter an email address')
      return
    }
    setLoading(true)
    setError(null)
    const baseUrl = window.location.origin
    const targetRedirect = `${baseUrl}${redirectTo.startsWith('/') ? redirectTo : `/${redirectTo}`}`

    const { data, error: err } = await supabase.functions.invoke('dev-login', {
      body: { email: trimmed, redirectTo: targetRedirect },
      headers: { 'X-Dev-Login-Secret': secret },
    })

    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    const link = (data as { action_link?: string } | null)?.action_link
    if (link) {
      window.location.href = link
    } else {
      setError('No login link returned')
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: '4rem auto', padding: '1.5rem' }}>
      <h2 style={{ marginTop: 0 }}>Dev Login</h2>
      <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
        Sign in as any user by email. Only available in development.
      </p>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="dev-login-email" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
            Email
          </label>
          <input
            id="dev-login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            disabled={!!asParam}
            style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 4 }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="dev-login-redirect" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
            Redirect to
          </label>
          <input
            id="dev-login-redirect"
            type="text"
            value={redirectTo}
            onChange={(e) => setRedirectTo(e.target.value)}
            placeholder="/dashboard"
            disabled={!!asParam}
            style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 4 }}
          />
        </div>
        {error && (
          <p style={{ color: '#b91c1c', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</p>
        )}
        <button
          type="submit"
          disabled={loading || !!asParam}
          style={{
            padding: '0.5rem 1rem',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: loading || asParam ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Signing in…' : 'Dev Login'}
        </button>
      </form>
      <p style={{ marginTop: '1rem', fontSize: '0.8125rem', color: '#6b7280' }}>
        Or use <code>?as=user@example.com</code> in the URL.
      </p>
    </div>
  )
}
