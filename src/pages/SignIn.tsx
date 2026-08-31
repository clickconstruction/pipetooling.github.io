import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PasswordInput from '../components/PasswordInput'
import AuthPublicLandingLayout from '../components/AuthPublicLandingLayout'
import {
  MAGIC_LINK_RESEND_COOLDOWN_S,
  friendlyOtpError,
  normalizeSignInEmail,
  recordFailedSignIn,
  shouldOfferMagicLink,
} from '../lib/signInMagicLink'

const SIGNIN_INPUT_CLASS = 'auth-public-landing__signin-input'
const SIGNIN_PASSWORD_INPUT_CLASS = `${SIGNIN_INPUT_CLASS} auth-public-landing__signin-input--password`

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sessionMessage, setSessionMessage] = useState<string | null>(null)
  // Magic-link fallback (v2.2524, ported from CountTooling): after two failed
  // password attempts on the SAME email, offer to email a one-time sign-in link.
  const [failCounts, setFailCounts] = useState<Record<string, number>>({})
  const [magicSent, setMagicSent] = useState(false)
  const [magicSending, setMagicSending] = useState(false)
  const [magicError, setMagicError] = useState<string | null>(null)
  const [sentToEmail, setSentToEmail] = useState('')
  const [cooldownLeft, setCooldownLeft] = useState(0)

  useEffect(() => {
    // GoTrue rate-limits magic-link emails — hold the Resend button until it can succeed.
    if (cooldownLeft <= 0) return
    const timer = setTimeout(() => setCooldownLeft((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldownLeft])

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
    if (savedEmail) setEmail(savedEmail)
    // v2.2450: the password is no longer stored or pre-filled — plaintext credentials in
    // localStorage are readable by any script on the origin. Purge what older builds saved;
    // autoComplete="current-password" hands the job to the browser's password manager.
    localStorage.removeItem('signin_password')
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
      setFailCounts((counts) => recordFailedSignIn(counts, email))
      return
    }
    localStorage.setItem('signin_email', email)
    // Hard reload to clear cache (avoids stale data, service worker cache)
    const reload = () => { location.reload() }
    if (typeof caches !== 'undefined') {
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .then(reload, reload)
    } else {
      reload()
    }
  }

  async function sendMagicLink(targetEmail: string): Promise<boolean> {
    setMagicError(null)
    setMagicSending(true)
    // shouldCreateUser: false — accounts are office-provisioned; a typo'd email
    // must never create one. The emailed link lands on /dashboard and is consumed
    // by supabase-js detectSessionInUrl (same path the office's sign-in emails use).
    const { error: err } = await supabase.auth.signInWithOtp({
      email: normalizeSignInEmail(targetEmail),
      options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/dashboard` },
    })
    setMagicSending(false)
    if (err) {
      setMagicError(friendlyOtpError(err.message))
      return false
    }
    return true
  }

  async function handleMagicOfferClick() {
    if (!(await sendMagicLink(email))) return
    setSentToEmail(normalizeSignInEmail(email))
    setMagicSent(true)
    setCooldownLeft(MAGIC_LINK_RESEND_COOLDOWN_S)
  }

  async function handleMagicResend() {
    if (!(await sendMagicLink(sentToEmail))) return
    setCooldownLeft(MAGIC_LINK_RESEND_COOLDOWN_S)
  }

  function handleMagicBack() {
    // The counter already qualified this email — the offer stays visible on the form.
    setMagicSent(false)
    setMagicError(null)
    setPassword('')
  }

  const offerMagicLink = shouldOfferMagicLink(failCounts, email)
  const cooldownLabel = `Resend in ${Math.floor(cooldownLeft / 60)}:${String(cooldownLeft % 60).padStart(2, '0')}`

  if (magicSent) {
    return (
      <AuthPublicLandingLayout
        titleLinkText="ClickPlumbing.com"
        titleLinkAriaLabel="ClickPlumbing.com — visit Click Plumbing (opens in new tab)"
      >
        <div className="auth-public-landing__signin-stack">
          <div className="auth-public-landing__signin-box">
            <div className="auth-public-landing__signin-magic-sent">
              <h2 className="auth-public-landing__signin-magic-sent-title">Check your email</h2>
              <p className="auth-public-landing__signin-magic-sent-text">
                We sent a one-time sign-in link to <strong>{sentToEmail}</strong>.
              </p>
              <p className="auth-public-landing__signin-magic-sent-warning">
                Open the link on <strong>this device</strong> — it signs in whichever browser opens it.
              </p>
              {magicError ? <p className="auth-public-landing__signin-error" role="alert">{magicError}</p> : null}
              <button
                type="button"
                className="auth-public-landing__signin-submit"
                onClick={handleMagicResend}
                disabled={magicSending || cooldownLeft > 0}
              >
                {magicSending ? 'Sending…' : cooldownLeft > 0 ? cooldownLabel : 'Resend link'}
              </button>
              <button
                type="button"
                className="auth-public-landing__signin-magic-back"
                onClick={handleMagicBack}
              >
                Back to password sign-in
              </button>
            </div>
          </div>
        </div>
      </AuthPublicLandingLayout>
    )
  }

  return (
    <AuthPublicLandingLayout
      titleLinkText="ClickPlumbing.com"
      titleLinkAriaLabel="ClickPlumbing.com — visit Click Plumbing (opens in new tab)"
    >
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
            {offerMagicLink ? (
              <div className="auth-public-landing__signin-magic-offer">
                <p className="auth-public-landing__signin-magic-offer-text">
                  Trouble signing in? We can email you a one-time sign-in link instead.
                </p>
                {magicError ? <p className="auth-public-landing__signin-error" role="alert">{magicError}</p> : null}
                <button
                  type="button"
                  className="auth-public-landing__signin-magic-button"
                  onClick={handleMagicOfferClick}
                  disabled={magicSending}
                >
                  {magicSending ? 'Sending…' : 'Email me a sign-in link'}
                </button>
              </div>
            ) : null}
            {/* Deliberately no "Forgot password?" link (owner decision, 2026-08-26 / v2.2330):
                account recovery goes through the office. /reset-password exists and works for
                office-directed use — do not link it from here without a new product decision.
                The magic-link offer above (v2.2524) is the sanctioned self-service fallback:
                it appears only after two failed password attempts on the same email and never
                exposes a password-reset form. */}
            <p className="auth-public-landing__signin-footnote">
              Issue logging in? Contact the office
            </p>
          </form>
        </div>
      </div>
    </AuthPublicLandingLayout>
  )
}
