import { useEffect, useRef, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

/** Long-lived tabs poll for a new deploy this often. */
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000
/** Extra check when a hidden tab becomes visible again (phones left open), throttled. */
const VISIBILITY_CHECK_MIN_GAP_MS = 15 * 60 * 1000

/**
 * Owns the service-worker registration (prompt mode). When a new build's SW reaches
 * the waiting state, shows a persistent "new version" pill; Reload posts SKIP_WAITING
 * (listener in src/sw.ts) and vite-plugin-pwa reloads the page once the new SW takes
 * control. Also polls registration.update() so tabs left open discover deploys.
 */
export function UpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [updating, setUpdating] = useState(false)
  const updateSWRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null)

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined
    let onVisible: (() => void) | undefined
    let lastCheck = Date.now()

    updateSWRef.current = registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedRefresh(true)
      },
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return
        const check = () => {
          lastCheck = Date.now()
          registration.update().catch(() => {
            // Offline or transient network failure — next tick retries
          })
        }
        intervalId = setInterval(check, UPDATE_CHECK_INTERVAL_MS)
        onVisible = () => {
          if (document.visibilityState === 'visible' && Date.now() - lastCheck > VISIBILITY_CHECK_MIN_GAP_MS) {
            check()
          }
        }
        document.addEventListener('visibilitychange', onVisible)
      },
    })

    return () => {
      if (intervalId !== undefined) clearInterval(intervalId)
      if (onVisible) document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  if (!needRefresh) return null

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        bottom: '1rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        maxWidth: '92vw',
        padding: '0.5rem 0.625rem 0.5rem 1rem',
        borderRadius: '9999px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
      }}
    >
      <span style={{ fontSize: '0.875rem', color: 'var(--text-base)', whiteSpace: 'nowrap' }}>
        A new version is ready.
      </span>
      <button
        type="button"
        disabled={updating}
        onClick={() => {
          setUpdating(true)
          // Reload ourselves on controllerchange: the plugin's own reload only fires
          // when workbox-window flags the controlling event isUpdate, which it does
          // not for updates discovered after registration (our registration.update()
          // polling). Fallback timer covers tabs whose SW already switched (no
          // controllerchange coming) — a plain reload gets the new build either way.
          try {
            navigator.serviceWorker.addEventListener(
              'controllerchange',
              () => window.location.reload(),
              { once: true },
            )
          } catch {
            // serviceWorker API unavailable — fallback timer still reloads
          }
          setTimeout(() => window.location.reload(), 4000)
          void updateSWRef.current?.()
        }}
        style={{
          padding: '0.375rem 1rem',
          borderRadius: '9999px',
          border: 'none',
          background: '#f97316',
          color: '#ffffff',
          fontSize: '0.875rem',
          fontWeight: 600,
          cursor: updating ? 'default' : 'pointer',
          opacity: updating ? 0.7 : 1,
          whiteSpace: 'nowrap',
        }}
      >
        {updating ? 'Updating…' : 'Reload'}
      </button>
      <button
        type="button"
        onClick={() => setNeedRefresh(false)}
        aria-label="Dismiss update notice until the next deploy"
        style={{
          padding: '0.375rem 0.5rem',
          border: 'none',
          background: 'none',
          color: 'var(--text-muted)',
          fontSize: '0.8125rem',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        Not now
      </button>
    </div>
  )
}
