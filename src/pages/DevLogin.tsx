import { useState, useEffect } from 'react'
import { useSearchParams, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { twinAliasEmail } from '../lib/twinLogin'

// Dev login signs in as this account; ?as= / typed emails no longer pick the user —
// EXCEPT the digital-twin alias (Phase T2, docs/DIGITAL_TWINS_PLAN.md):
// ?as=twin:<role> or ?as=twin:<role>:<n> resolves to that twin instance's account.
export const DEV_LOGIN_EMAIL = 'robert@douglasmining.com'

/**
 * Establish the session on THIS origin by verifying the magic link's token
 * directly, instead of following the link. Following it round-trips through
 * Supabase's redirect allow-list, which only knows a couple of localhost
 * ports — any other dev-server port (parallel sessions) got bounced to prod.
 * Returns an error message, or null after kicking off the redirect.
 */
async function signInFromActionLink(link: string, targetRedirect: string): Promise<string | null> {
  let tokenHash: string | null = null
  try {
    tokenHash = new URL(link).searchParams.get('token')
  } catch {
    return 'Malformed login link'
  }
  if (!tokenHash) return 'Login link had no token'
  const { error } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash })
  if (error) return error.message
  window.location.assign(targetRedirect)
  return null
}

export default function DevLogin() {
  const [searchParams] = useSearchParams()
  const [redirectTo, setRedirectTo] = useState('/dashboard')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const secret = import.meta.env.VITE_DEV_LOGIN_SECRET as string | undefined
  const asParam = searchParams.get('as')

  useEffect(() => {
    if (asParam === null || !secret || !import.meta.env.DEV) return
    const to = searchParams.get('to') ?? '/dashboard'
    setRedirectTo(to)
    setLoading(true)
    setError(null)
    const baseUrl = window.location.origin
    const targetRedirect = `${baseUrl}${to.startsWith('/') ? to : `/${to}`}`

    supabase.functions
      .invoke('dev-login', {
        body: { email: twinAliasEmail(asParam) ?? DEV_LOGIN_EMAIL, redirectTo: targetRedirect },
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
          void signInFromActionLink(link, targetRedirect).then((verifyErr) => {
            if (verifyErr) setError(verifyErr)
          })
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

  const autoFiring = asParam !== null

  if (autoFiring && loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Signing in as {twinAliasEmail(asParam) ?? DEV_LOGIN_EMAIL}…</p>
      </div>
    )
  }

  if (!secret) {
    return (
      <div style={{ maxWidth: 400, margin: '4rem auto', padding: '1.5rem' }}>
        <h2 style={{ marginTop: 0 }}>Dev Login</h2>
        <p style={{ color: 'var(--text-red-700)' }}>
          Set <code>VITE_DEV_LOGIN_SECRET</code> in <code>.env.local</code> to use dev login.
        </p>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Also set <code>DEV_LOGIN_SECRET</code> for the Edge Function (e.g. <code>supabase secrets set DEV_LOGIN_SECRET=your-secret</code>).
        </p>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!secret) return
    setLoading(true)
    setError(null)
    const baseUrl = window.location.origin
    const targetRedirect = `${baseUrl}${redirectTo.startsWith('/') ? redirectTo : `/${redirectTo}`}`

    const { data, error: err } = await supabase.functions.invoke('dev-login', {
      body: { email: DEV_LOGIN_EMAIL, redirectTo: targetRedirect },
      headers: { 'X-Dev-Login-Secret': secret },
    })

    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    const link = (data as { action_link?: string } | null)?.action_link
    if (link) {
      const verifyErr = await signInFromActionLink(link, targetRedirect)
      if (verifyErr) setError(verifyErr)
    } else {
      setError('No login link returned')
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: '4rem auto', padding: '1.5rem' }}>
      <h2 style={{ marginTop: 0 }}>Dev Login</h2>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
        Signs in as <code>{DEV_LOGIN_EMAIL}</code>. Only available in development.
      </p>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <span style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Account</span>
          <div
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              background: 'var(--surface)',
              color: 'var(--text-muted)',
            }}
          >
            {DEV_LOGIN_EMAIL}
          </div>
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
            disabled={autoFiring}
            style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
          />
        </div>
        {error && (
          <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</p>
        )}
        <button
          type="submit"
          disabled={loading || autoFiring}
          style={{
            padding: '0.5rem 1rem',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: loading || autoFiring ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Signing in…' : 'Dev Login'}
        </button>
      </form>
      <p style={{ marginTop: '1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        <code>?as=1&to=/path</code> in the URL auto-fires on load. <code>?as=twin:estimator</code> (or <code>twin:estimator:2</code>) signs in as that digital-twin account instead.
      </p>
    </div>
  )
}
