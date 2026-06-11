import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import { useIsMobile } from './useIsMobile'
import { DISPATCH_PATH, awayMsSince, shouldLandOnDispatch } from '../lib/assistantDispatchLanding'

const LAST_ACTIVE_KEY = 'pipetooling:last-active-at'

function readLastActive(): number | null {
  try {
    const raw = localStorage.getItem(LAST_ACTIVE_KEY)
    return raw == null ? null : Number(raw)
  } catch {
    return null
  }
}

function markActive(): void {
  try {
    localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()))
  } catch {
    // localStorage unavailable (private mode) — best effort
  }
}

/**
 * Mobile assistants who reopen the app after being away (> ~1h) land on the Dispatch page
 * instead of the dashboard — but only when they'd otherwise be on the home landing, and only
 * on an actual return (cold load or un-backgrounding), never on every navigation home.
 *
 * Tracks the last-active time in localStorage so the "away" gap survives reloads and persisted
 * (PWA) sessions. Call once from the authed Layout.
 */
export function useAssistantDispatchLanding(): void {
  const { role } = useAuth()
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const location = useLocation()

  // Away-since-last-session, captured during the first render BEFORE anything writes the timestamp.
  const coldAwayMsRef = useRef<number | null>(null)
  if (coldAwayMsRef.current == null) coldAwayMsRef.current = awayMsSince(readLastActive(), Date.now())

  // Latest values for the stable (empty-deps) listeners below.
  const roleRef = useRef(role)
  roleRef.current = role
  const isMobileRef = useRef(isMobile)
  isMobileRef.current = isMobile
  const pathnameRef = useRef(location.pathname)
  pathnameRef.current = location.pathname
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  // Cold load: evaluate once the (async) role is known. One-shot.
  const coldHandledRef = useRef(false)
  useEffect(() => {
    if (coldHandledRef.current || role == null) return
    coldHandledRef.current = true
    if (shouldLandOnDispatch({ role, isMobile, pathname: location.pathname, awayMs: coldAwayMsRef.current ?? Number.POSITIVE_INFINITY })) {
      navigate(DISPATCH_PATH, { replace: true })
    }
  }, [role, isMobile, location.pathname, navigate])

  // Keep the last-active timestamp fresh and handle background-returns (bfcache + un-hide).
  const returnedRef = useRef(false)
  useEffect(() => {
    const handleReturn = () => {
      if (returnedRef.current) return
      const awayMs = awayMsSince(readLastActive(), Date.now())
      if (shouldLandOnDispatch({ role: roleRef.current, isMobile: isMobileRef.current, pathname: pathnameRef.current, awayMs })) {
        returnedRef.current = true
        navigateRef.current(DISPATCH_PATH, { replace: true })
      }
    }
    let interval: ReturnType<typeof setInterval> | undefined
    const start = () => { if (!interval) interval = setInterval(markActive, 60_000) }
    const stop = () => { if (interval) { clearInterval(interval); interval = undefined } }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleReturn()
        markActive()
        start()
      } else {
        markActive() // record the moment we left
        stop()
        returnedRef.current = false // next return is a fresh opportunity
      }
    }
    // Only bfcache restores (persisted) count as a return; the initial pageshow is the cold load.
    const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) { handleReturn(); markActive() } }

    markActive() // mark active now (cold-away already captured during render)
    start()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [])
}
