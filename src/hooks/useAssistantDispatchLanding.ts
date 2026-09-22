import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import { useIsMobile } from './useIsMobile'
import {
  awayMsSince,
  readLastActiveAt,
  resolveAssistantLanding,
  stampLastActive,
} from '../lib/assistantDispatchLanding'

/**
 * Assistants who reopen the app after being away land on the schedule instead of the
 * dashboard — but only when they'd otherwise be on the home landing, and only on an actual
 * return (cold load or un-backgrounding), never on every navigation home. The rule itself
 * (who, from where, how long, to which page) is `resolveAssistantLanding`; `dispatchMode`
 * is Layout's `dispatchModeActive` and picks the 5-minute / 1-hour threshold.
 *
 * Tracks the last-active time in localStorage so the "away" gap survives reloads and persisted
 * (PWA) sessions. Call once from the authed Layout.
 */
export function useAssistantDispatchLanding(dispatchMode: boolean): void {
  const { role } = useAuth()
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const location = useLocation()

  // Away-since-last-session, captured during the first render BEFORE anything writes the timestamp.
  const coldAwayMsRef = useRef<number | null>(null)
  if (coldAwayMsRef.current == null) coldAwayMsRef.current = awayMsSince(readLastActiveAt(), Date.now())

  // Latest values for the stable (empty-deps) listeners below.
  const roleRef = useRef(role)
  roleRef.current = role
  const isMobileRef = useRef(isMobile)
  isMobileRef.current = isMobile
  const dispatchModeRef = useRef(dispatchMode)
  dispatchModeRef.current = dispatchMode
  const pathnameRef = useRef(location.pathname)
  pathnameRef.current = location.pathname
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  // Cold load: evaluate once the (async) role is known. One-shot.
  const coldHandledRef = useRef(false)
  useEffect(() => {
    if (coldHandledRef.current || role == null) return
    coldHandledRef.current = true
    const to = resolveAssistantLanding({
      role,
      isMobile,
      dispatchMode,
      pathname: location.pathname,
      awayMs: coldAwayMsRef.current ?? Number.POSITIVE_INFINITY,
    })
    if (to) navigate(to, { replace: true })
  }, [role, isMobile, dispatchMode, location.pathname, navigate])

  // Keep the last-active timestamp fresh and handle background-returns (bfcache + un-hide).
  const returnedRef = useRef(false)
  useEffect(() => {
    const handleReturn = () => {
      if (returnedRef.current) return
      const to = resolveAssistantLanding({
        role: roleRef.current,
        isMobile: isMobileRef.current,
        dispatchMode: dispatchModeRef.current,
        pathname: pathnameRef.current,
        awayMs: awayMsSince(readLastActiveAt(), Date.now()),
      })
      if (to) {
        returnedRef.current = true
        navigateRef.current(to, { replace: true })
      }
    }
    let interval: ReturnType<typeof setInterval> | undefined
    const start = () => { if (!interval) interval = setInterval(() => stampLastActive(), 60_000) }
    const stop = () => { if (interval) { clearInterval(interval); interval = undefined } }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleReturn()
        stampLastActive()
        start()
      } else {
        stampLastActive() // record the moment we left
        stop()
        returnedRef.current = false // next return is a fresh opportunity
      }
    }
    // Only bfcache restores (persisted) count as a return; the initial pageshow is the cold load.
    const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) { handleReturn(); stampLastActive() } }

    stampLastActive() // mark active now (cold-away already captured during render)
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
