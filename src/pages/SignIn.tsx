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

  /**
   * Explicit Enter-to-submit (v2.2448, Wendi: "can't hit enter to login have to press the
   * button"). The form is a proper <form onSubmit> with a type="submit" button, so Enter
   * SHOULD submit implicitly — but implicit submission is browser machinery, and things
   * outside our code (password-manager overlays and autofill dropdowns that swallow the
   * keystroke, PWA webview quirks) can eat it. Handling Enter ourselves removes the
   * dependency: preventDefault stops the implicit path (no double submit), requestSubmit
   * runs the same validation + submit pipeline it would have used.
   */
  function submitOnEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
    e.preventDefault()
    const form = e.currentTarget.form
    if (!form) return
    if (typeof form.requestSubmit === 'function') form.requestSubmit()
    else form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
  }

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
                onKeyDown={submitOnEnter}
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
                onKeyDown={submitOnEnter}
                required
                autoComplete="current-password"
              />
            </div>
            {error ? <p className="auth-public-landing__signin-error">{error}</p> : null}
            <button type="submit" className="auth-public-landing__signin-submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
            {/* Deliberately no "Forgot password?" link (owner decision, 2026-08-26 / v2.2330):
                account recovery goes through the office. /reset-password exists and works for
                office-directed use — do not link it from here without a new product decision. */}
            <p className="auth-public-landing__signin-footnote">
              Issue logging in? Contact the office
            </p>
          </form>
        </div>
      </div>
    </AuthPublicLandingLayout>
  )
}
