import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'

/**
 * Nav-click telemetry (v2.2334, CX-audit measurement plan): one row per click on
 * instrumented navigation chrome, so redesign decisions ride on which controls
 * people actually use. Complements `user_app_activity_page_daily` (time-on-page).
 *
 * Contract with the UI:
 * - A container marks itself `data-navtrack="<control>"`; the nearest marked
 *   ancestor names the control (inner containers override outer ones).
 * - Anchor-based chrome needs no per-link wiring: a capture listener on the
 *   container calls `recordNavClickFromEvent`, and the clicked `<a href>` is the
 *   target. Button-based chrome (dock chips, mode footers) calls
 *   `recordNavClick` directly with an explicit target.
 * - Recording is fire-and-forget, single attempt, errors swallowed — the same
 *   posture as the app-activity heartbeat; navigation must never wait on it.
 */

/** Pure: resolve a click inside instrumented chrome to {control, target}, or null when it wasn't a nav link. */
export function resolveNavClick(clicked: Element | null): { control: string; target: string } | null {
  const anchor = clicked?.closest('a[href]')
  if (!anchor) return null
  const tracked = anchor.closest('[data-navtrack]')
  const control = tracked?.getAttribute('data-navtrack')
  if (!control) return null
  const href = anchor.getAttribute('href') ?? ''
  // In-app links are root-relative; strip any origin so targets compare cleanly.
  const target = href.replace(/^[a-z]+:\/\/[^/]+/i, '')
  if (!target.startsWith('/')) return null
  return { control, target }
}

/** Fire-and-forget insert; never throws, never retries, never blocks navigation. */
export function recordNavClick(
  userId: string | null | undefined,
  role: string | null,
  control: string,
  target: string,
): void {
  if (!userId) return
  const from_path = typeof window !== 'undefined' ? window.location.pathname : null
  void withSupabaseRetry(
    () =>
      (supabase as any).from('ui_nav_clicks').insert({
        user_id: userId,
        role,
        control,
        target,
        from_path,
      }),
    'record_nav_click',
    { maxRetries: 0, logRetries: false },
  ).catch(() => {
    /* measurement is best-effort by design */
  })
}

/** Capture-phase helper for anchor-based chrome: resolve the clicked link and record it. */
export function recordNavClickFromEvent(
  userId: string | null | undefined,
  role: string | null,
  e: { target: EventTarget | null },
): void {
  const resolved = resolveNavClick(e.target instanceof Element ? e.target : null)
  if (!resolved) return
  recordNavClick(userId, role, resolved.control, resolved.target)
}
