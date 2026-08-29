/** Settings → Advanced tab: collapsible "Fix app" help + admin claim-code form
 * + dev-only email-monitoring links (v2.2497).
 * Self-contained (v2.856): owns its section-open + claim-code state and the
 * claim-dev edge-fn call; on success it invokes onRoleMaybeChanged so the parent
 * reloads (the user's role may have just changed).
 * The role gate (non-subcontractor) stays in the parent; isDev gates the
 * DMARC links only. */
import { useState } from 'react'
import type { FormEvent } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

/**
 * The two Cloudflare DMARC Management dashboards (enabled 2026-08-29, see
 * docs/DOMAIN_CUTOVER.md → Resend sender migration). Monitoring lives in
 * Cloudflare on purpose — the app only links there.
 */
const DMARC_DASHBOARDS = [
  { zone: 'clicktooling.com', url: 'https://dash.cloudflare.com/7cad448b9713f42ee58be38cfe9ddaf6/clicktooling.com/email/dmarc-management' },
  { zone: 'pipetooling.com', url: 'https://dash.cloudflare.com/7cad448b9713f42ee58be38cfe9ddaf6/pipetooling.com/email/dmarc-management' },
]

export default function SettingsAdvancedTab({
  active,
  isDev,
  onRoleMaybeChanged,
}: {
  active: boolean
  isDev: boolean
  onRoleMaybeChanged: () => void
}) {
  const [advancedSectionOpen, setAdvancedSectionOpen] = useState(false)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [codeSubmitting, setCodeSubmitting] = useState(false)

  async function handleClaimCode(e: FormEvent) {
    e.preventDefault()
    setCodeError(null)
    setCodeSubmitting(true)
    const { data, error: eFn } = await supabase.functions.invoke('claim-dev', {
      body: { code: code.trim() },
    })
    setCodeSubmitting(false)
    if (eFn) {
      let msg = eFn.message
      if (eFn instanceof FunctionsHttpError && eFn.context?.json) {
        try {
          const b = (await eFn.context.json()) as { error?: string } | null
          if (b?.error) msg = b.error
        } catch { /* ignore */ }
      }
      setCodeError(msg)
      return
    }
    const err = (data as { error?: string } | null)?.error
    if (err) {
      setCodeError(err)
      return
    }
    if ((data as { success?: boolean } | null)?.success) {
      setCode('')
      setCodeError(null)
      onRoleMaybeChanged()
    } else {
      setCodeError('Invalid code')
    }
  }

  return (
    <div id="settings-advanced-tools" style={{ marginTop: '2rem', marginBottom: '1.5rem', display: active ? undefined : 'none' }}>
      <button
        type="button"
        onClick={() => setAdvancedSectionOpen((prev) => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          margin: 0,
          padding: '1rem',
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '0.9375rem',
          fontWeight: 500,
          textAlign: 'left',
          color: 'var(--text-muted)',
        }}
      >
        <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>{advancedSectionOpen ? '▼' : '▶'}</span>
        Advanced
      </button>
      {advancedSectionOpen && (
        <div style={{ padding: '1rem 0 0 0' }}>
          <div style={{ marginBottom: '1.5rem', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }}>
            <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Fix app</h2>
            <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              If the app shows a white screen after an update (e.g. phone was open during deploy), open{' '}
              <a href="/fix-cache.html" style={{ color: 'var(--text-link)', fontWeight: 500 }}>
                Fix app
              </a>{' '}
              to clear cached files and reload. Bookmark this link to use when the app won&apos;t load.
            </p>
          </div>
          {isDev && (
            <div style={{ marginBottom: '1.5rem', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }}>
              <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Email domain monitoring</h2>
              <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                DMARC reports show who is sending email as our domains (should only ever be Resend).
                Reports collect and render in Cloudflare — check them before tightening the DMARC policy.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1.25rem' }}>
                {DMARC_DASHBOARDS.map((d) => (
                  <a
                    key={d.zone}
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--text-link)', fontWeight: 500, fontSize: '0.875rem' }}
                  >
                    DMARC reports — {d.zone} ↗
                  </a>
                ))}
              </div>
            </div>
          )}
          <form onSubmit={handleClaimCode}>
            <label htmlFor="code" style={{ display: 'block', marginBottom: 4 }}>Enter code</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                id="code"
                type="text"
                value={code}
                onChange={(e) => { setCode(e.target.value); setCodeError(null) }}
                disabled={codeSubmitting}
                placeholder="Admin code"
                style={{ padding: '0.5rem', minWidth: 160 }}
                autoComplete="one-time-code"
              />
              <button type="submit" disabled={codeSubmitting || !code.trim()}>
                {codeSubmitting ? 'Checking…' : 'Submit'}
              </button>
            </div>
            {codeError && <p style={{ color: 'var(--text-red-700)', marginTop: 4, marginBottom: 0 }}>{codeError}</p>}
            {/* Static on purpose: it must not reveal WHY a code was refused (a "correct but refused"
             * response would confirm the code is valid). It just tells an honest user what to do instead. */}
            <p style={{ marginTop: '0.5rem', marginBottom: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              This code only works when no dev is available. If a dev already has access, ask them to change
              your role in <strong>Settings → People &amp; accounts</strong> instead. Every attempt is recorded.
            </p>
          </form>
        </div>
      )}
    </div>
  )
}
