import { useEffect, useState } from 'react'

/**
 * Route Suspense fallback with an escape hatch (v2.2312). A page chunk fetch
 * that hangs (classically: a tab from before a deploy fetching mid-propagation
 * assets) used to strand the user on a bare "Loading…" with no way out — the
 * chunk recovery (v2.811) only fires when the fetch FAILS, not when it hangs.
 *
 * Three phases: 0–3s a bare "Loading…" so normal navigation never flashes
 * extra copy; 3–10s a countdown to more options; at 10s a Reload button (the
 * fix for the stuck-after-deploy case) and the /fix-cache.html repair link.
 * The sign-in AuthGateLoadingScreen (v2.1051) keeps its own 5s link.
 */
export function RouteLoadingFallback() {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setElapsed((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  if (elapsed >= 10) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ maxWidth: '26ch', lineHeight: 1.45 }}>
          Still loading. This can happen right after an app update.
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            padding: '0.5rem 1.1rem',
            fontSize: '0.9375rem',
            fontWeight: 600,
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: 7,
            cursor: 'pointer',
          }}
        >
          Reload
        </button>
        <a href="/fix-cache.html" style={{ fontSize: '0.875rem', color: 'var(--text-link)' }}>
          Fix the app
        </a>
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
      <div>Loading…</div>
      {elapsed >= 3 ? (
        <div aria-live="polite" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          Taking longer than usual — more options in {10 - elapsed}
        </div>
      ) : null}
    </div>
  )
}
