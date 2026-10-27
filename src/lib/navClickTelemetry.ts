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

/** `ui_nav_clicks.control` for a press on a Call link or button (v2.5904); the target names the site, `#surface=<site>`. */
export const CALL_PRESSED_CONTROL = 'call_pressed'

/** Pure: the `target` of a Call press. */
export function callPressedTarget(site: string): string {
  return `#surface=${site}`
}

/**
 * After one of these, a button's label names the thing it acts on (a job, a customer, a
 * phone number); the words before it name the press, which is what the ledger groups on.
 */
const BUTTON_NAME_CUTS = [' — ', ' · ', ': ', ' for ', ' at ', ' on ', '’s ', "'s ", ' + ', ' (']

/**
 * The app's own capitalised words a button may carry into the ledger (v2.5904). A person's or a
 * company's name is capitalised too, so a capitalised word not on this list ends the name: the
 * words before it stay and the rest becomes `…`. The press still counts. A new button whose
 * words are not here counts under a shorter name until its words are added, or it gets a
 * `data-nav`. Words that start in lower case pass, and so do a lone letter and a form code.
 */
const NAV_WORDS = new Set([
  'A', 'AIA', 'Account', 'Add', 'All', 'Arrived', 'Ask', 'Assign', 'Back', 'Bid', 'Bill', 'Billed', 'Billing', 'Bills',
  'Builder', 'Call', 'Clock', 'Close', 'Collect', 'Collections', 'Commercial', 'Complete', 'Conditional', 'Contract',
  'Costs', 'Create', 'Crew', 'Current', 'Customer', 'Date', 'Day', 'Development', 'Dispatch', 'Documents', 'Done',
  'Draft', 'Drive', 'Edit', 'Electrical', 'Email', 'Every', 'Expand', 'Expected', 'File', 'Files', 'Final', 'Flag',
  'Folders', 'GC', 'Gas', 'Generator', 'Give', 'Go', 'Google', 'HCP', 'HVAC', 'History', 'In', 'Items', 'Job', 'Jobs',
  'Jump', 'Last', 'Latest', 'Leave', 'Leaving', 'Lien', 'Liens', 'Line', 'Link', 'Man-hours', 'Maps', 'Mark', 'Message',
  'Messages', 'Money', 'Month', 'Move', 'Multiple', 'Next', 'No', 'Not', 'Note', 'Notes', 'Nothing', 'On', 'Only', 'Open',
  'Out', 'PDF', 'Paid', 'Payment', 'Phone', 'Photos', 'Pictures', 'Pipeline', 'Plans', 'Plumbing', 'Post', 'Progress',
  'Project', 'Property', 'Put', 'Quo', 'Ready', 'Record', 'Release', 'Remove', 'Replace', 'Report', 'Reports',
  'Residential', 'Schedule', 'Segment', 'Send', 'Sent', 'Set', 'Share', 'Signed', 'Stages', 'Status', 'Story', 'Summary',
  'Team', 'Test', 'Text', 'Texts', 'The', 'Their', 'This', 'Time', 'Today', 'Tomorrow', 'Turnaway', 'Unconditional',
  'View', 'Waiting', 'Week', 'Working', 'Write', 'Yesterday',
])

/** A month or a weekday, folded to `date` so a dated chip is one target. */
const CALENDAR_WORD =
  /^(Jan(uary)?|Feb(ruary)?|Mar(ch)?|Apr(il)?|May|June?|July?|Aug(ust)?|Sep(t(ember)?)?|Oct(ober)?|Nov(ember)?|Dec(ember)?|Mon(day)?|Tue(s(day)?)?|Wed(nesday)?|Thu(r(s(day)?)?)?|Fri(day)?|Sat(urday)?|Sun(day)?)[.,]?$/

/** Pure: whether one word of a button's label may reach the ledger. */
function navWordIsSafe(word: string): boolean {
  if (CALENDAR_WORD.test(word)) return true
  for (const part of word.split('/')) {
    const letters = part.replace(/[^A-Za-z-]/g, '').replace(/^-+|-+$/g, '')
    if (!letters || !/^[A-Z]/.test(letters)) continue
    if (/^[A-Z](-[A-Z])*$/.test(letters)) continue
    if (!NAV_WORDS.has(letters)) return false
  }
  return true
}

/**
 * Pure: a button's short name for the ledger (v2.5904). `data-nav` wins when set; otherwise
 * the aria-label, title or text, cut where it starts naming a thing, digits folded to `#`,
 * months and weekdays to `date`, so one button is one target however many jobs it sits on. A
 * capitalised word the app does not own (a customer, a company, a person) ends the name with
 * `…`. Null when it has no words.
 */
export function navButtonName(button: Element): string | null {
  const nav = (button.getAttribute('data-nav') ?? '').trim()
  if (nav) return nav.slice(0, 48)
  const raw = button.getAttribute('aria-label') || button.getAttribute('title') || button.textContent || ''
  let name = raw.replace(/\s+/g, ' ').trim()
  if (!name) return null
  let cut = name.length
  for (const sep of BUTTON_NAME_CUTS) {
    const i = name.indexOf(sep)
    if (i > 0 && i < cut) cut = i
  }
  const words = name.slice(0, cut).replace(/\d+/g, '#').trim().split(' ').filter(Boolean)
  const firstUnsafe = words.findIndex((w) => !navWordIsSafe(w))
  const kept = (firstUnsafe === -1 ? words : words.slice(0, firstUnsafe)).map((w) => (CALENDAR_WORD.test(w) ? 'date' : w))
  if (firstUnsafe !== -1) kept.push('…')
  name = kept.join(' ')
  return name ? name.slice(0, 48) : null
}

/**
 * Pure: resolve a click inside instrumented chrome to {control, target}, or null when it was
 * not a press the ledger keeps. A root-relative link is the nav press it always was. A `tel:`
 * link inside tracked chrome is the Call press (`call_pressed`, the container as its site). A
 * labelled button counts only inside a container that also carries `data-navbuttons`
 * (v2.5904: the Pipeline row and the job window), named by `navButtonName`, so the older
 * chrome keeps recording links alone. Those markers record as the signed-in viewer
 * (`navClickViewer.ts`), not through an auth hook.
 */
export function resolveNavClick(clicked: Element | null): { control: string; target: string } | null {
  if (!clicked) return null
  const anchor = clicked.closest('a[href]')
  if (anchor) {
    const tracked = anchor.closest('[data-navtrack]')
    const control = tracked?.getAttribute('data-navtrack')
    if (!control) return null
    const href = anchor.getAttribute('href') ?? ''
    if (/^tel:/i.test(href)) return { control: CALL_PRESSED_CONTROL, target: callPressedTarget(control) }
    // In-app links are root-relative; strip any origin so targets compare cleanly.
    const target = href.replace(/^[a-z]+:\/\/[^/]+/i, '')
    if (!target.startsWith('/')) return null
    return { control, target }
  }
  const button = clicked.closest('button, [role="button"]')
  if (!button) return null
  const tracked = button.closest('[data-navtrack]')
  const control = tracked?.getAttribute('data-navtrack')
  if (!control || !tracked?.hasAttribute('data-navbuttons')) return null
  const name = navButtonName(button)
  return name ? { control, target: `#${name}` } : null
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

/** Capture-phase helper for tracked chrome: resolve the clicked link or button and record it. */
export function recordNavClickFromEvent(
  userId: string | null | undefined,
  role: string | null,
  e: { target: EventTarget | null },
): void {
  const resolved = resolveNavClick(e.target instanceof Element ? e.target : null)
  if (!resolved) return
  recordNavClick(userId, role, resolved.control, resolved.target)
}
