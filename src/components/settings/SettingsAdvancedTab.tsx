/** Settings → Advanced tab: collapsible "Fix app" help + admin claim-code form.
 * Presentational; all state/handlers live in the parent (Settings.tsx) and arrive as props.
 * The role gate (non-subcontractor) stays in the parent. */
import type { Dispatch, FormEvent, SetStateAction } from 'react'

export default function SettingsAdvancedTab({
  active,
  advancedSectionOpen,
  setAdvancedSectionOpen,
  code,
  setCode,
  codeError,
  setCodeError,
  codeSubmitting,
  handleClaimCode,
}: {
  active: boolean
  advancedSectionOpen: boolean
  setAdvancedSectionOpen: Dispatch<SetStateAction<boolean>>
  code: string
  setCode: Dispatch<SetStateAction<string>>
  codeError: string | null
  setCodeError: Dispatch<SetStateAction<string | null>>
  codeSubmitting: boolean
  handleClaimCode: (e: FormEvent) => void
}) {
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
