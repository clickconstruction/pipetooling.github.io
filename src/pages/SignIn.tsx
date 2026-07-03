import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PasswordInput from '../components/PasswordInput'
import AuthPublicLandingLayout from '../components/AuthPublicLandingLayout'

const SIGNIN_INPUT_CLASS = 'auth-public-landing__signin-input'
const SIGNIN_PASSWORD_INPUT_CLASS = `${SIGNIN_INPUT_CLASS} auth-public-landing__signin-input--password`

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

  useEffect(() => {
    const savedEmail = localStorage.getItem('signin_email')
    const savedPassword = localStorage.getItem('signin_password')
    if (savedEmail) setEmail(savedEmail)
    if (savedPassword) setPassword(savedPassword)
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
    localStorage.setItem('signin_email', email)
    localStorage.setItem('signin_password', password)
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
    <AuthPublicLandingLayout>
      <div className="auth-public-landing__signin-stack">
        <div className="auth-public-landing__signin-box">
          {sessionMessage && (
            <div className="auth-public-landing__signin-session" role="alert">
              <span className="auth-public-landing__signin-session-icon" aria-hidden>
                {'\u26A0\uFE0F'}
              </span>
              <span>{sessionMessage}</span>
            </div>
          )}
          <form className="auth-public-landing__signin-form" onSubmit={handleSubmit}>
            <div className="auth-public-landing__signin-field">
              <input
                id="email"
                type="email"
                className={SIGNIN_INPUT_CLASS}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError(null)
                }}
                placeholder="Email"
                aria-label="Email"
                required
                autoComplete="email"
                autoFocus
              />
            </div>
            <div className="auth-public-landing__signin-field">
              <PasswordInput
                id="password"
                placeholder="Password"
                ariaLabel="Password"
                inputClassName={SIGNIN_PASSWORD_INPUT_CLASS}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError(null)
                }}
                required
                autoComplete="current-password"
              />
            </div>
            {error ? <p className="auth-public-landing__signin-error">{error}</p> : null}
            <button type="submit" className="auth-public-landing__signin-submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
            <p className="auth-public-landing__signin-footnote">
              Issue logging in? Contact the office
            </p>
          </form>
        </div>
      </div>
    </AuthPublicLandingLayout>
  )
}
