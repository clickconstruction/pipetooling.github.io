/**
 * Auto-reload at quiet moments (v2.3740). A new build's service worker waits until the
 * person taps Reload on the pill — and customers who open a link and never tap it ride a
 * two-week-old build (v2.3739's screenshot). The app may reload itself when nothing can be
 * lost: on first paint before any interaction, and on a route change with no modal open and
 * no field focused; and (v2.3741) when idle — the tab hidden five minutes, or untouched half
 * an hour — with no unsaved-work hold and no write in flight (src/lib/unsavedWork.ts).
 * Anything it cannot tell is "no" — the pill is the fallback. Drafts come with PR 3.
 */
export type AutoReloadMoment = 'first-paint' | 'route-change' | 'idle'

export type AutoReloadSnapshot = {
  moment: AutoReloadMoment
  /** onNeedRefresh has fired — a new service worker is installed and waiting. */
  updateWaiting: boolean
  /** Rendered inside an iframe (Settings → What customers see): the top window owns reloads. */
  framed: boolean
  /** Any pointerdown / keydown / touchstart / wheel since the page loaded. */
  interacted: boolean
  msSinceLoad: number
  /** document.activeElement is a text field, textarea, select or contenteditable. */
  editableFocused: boolean
  /** A [role=dialog] / [aria-modal] / <dialog open> is in the DOM. */
  dialogOpen: boolean
  /** Components holding unsaved work (`useHoldsUnsavedWork`). */
  unsavedHolds: number
  /** Non-GET requests through the Supabase client still waiting for a response. */
  inFlightWrites: number
  /** Time since the last automatic reload in this tab, null when there was none. */
  msSinceLastAutoReload: number | null
  /** "Not now" on the pill: time since the dismissal, null when never dismissed. */
  msSinceDismissed: number | null
  /** Idle moment only: how long the tab has been hidden. */
  hiddenForMs?: number
  /** Idle moment only: how long since the last touch while visible. */
  idleForMs?: number
}

export type AutoReloadDecision = { reload: boolean; reason: string }

/** First paint means: the waiting worker was found this early, and nobody has touched the page. */
export const FIRST_PAINT_WINDOW_MS = 15_000
/** Loop guard: never two automatic reloads within this gap (the new build may fail to take). */
export const AUTO_RELOAD_MIN_GAP_MS = 60_000
/** "Not now" is honoured this long before a quiet moment may reload anyway (matches the pill's resurface gap). */
export const AUTO_RELOAD_DISMISS_GRACE_MS = 10 * 60 * 1000
/** Idle moment: the tab has been hidden at least this long… */
export const IDLE_HIDDEN_MIN_MS = 5 * 60 * 1000
/** …or visible and untouched at least this long (a desk tab left on the Dashboard). */
export const IDLE_VISIBLE_MIN_MS = 30 * 60 * 1000

export function decideAutoReload(s: AutoReloadSnapshot): AutoReloadDecision {
  if (!s.updateWaiting) return { reload: false, reason: 'no update waiting' }
  if (s.framed) return { reload: false, reason: 'framed — the top window owns reloads' }
  if (s.msSinceLastAutoReload != null && s.msSinceLastAutoReload < AUTO_RELOAD_MIN_GAP_MS) {
    return { reload: false, reason: 'reloaded automatically less than a minute ago' }
  }
  if (s.msSinceDismissed != null && s.msSinceDismissed < AUTO_RELOAD_DISMISS_GRACE_MS) {
    return { reload: false, reason: 'they said "Not now" recently' }
  }
  if (s.unsavedHolds > 0) return { reload: false, reason: `${s.unsavedHolds} component(s) hold unsaved work` }
  if (s.inFlightWrites > 0) return { reload: false, reason: `${s.inFlightWrites} write(s) in flight` }
  if (s.editableFocused) return { reload: false, reason: 'a field is focused' }
  if (s.dialogOpen) return { reload: false, reason: 'a dialog is open' }
  switch (s.moment) {
    case 'first-paint':
      if (s.interacted) return { reload: false, reason: 'they already touched the page' }
      if (s.msSinceLoad > FIRST_PAINT_WINDOW_MS) return { reload: false, reason: 'too long after load to count as first paint' }
      return { reload: true, reason: 'first paint, untouched' }
    case 'route-change':
      return { reload: true, reason: 'route change, nothing open' }
    case 'idle':
      if ((s.hiddenForMs ?? 0) >= IDLE_HIDDEN_MIN_MS) return { reload: true, reason: 'hidden long enough, nothing open' }
      if ((s.idleForMs ?? 0) >= IDLE_VISIBLE_MIN_MS) return { reload: true, reason: 'untouched long enough, nothing open' }
      return { reload: false, reason: 'not idle long enough' }
  }
}

/** sessionStorage key recording the last automatic reload (per tab). */
export const AUTO_RELOAD_KEY = 'pipetooling-auto-reload-last'

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

/** Time since the last automatic reload recorded in this tab, or null. */
export function msSinceLastAutoReload(now: number, storage: StorageLike | null | undefined): number | null {
  if (!storage) return null
  try {
    const last = storage.getItem(AUTO_RELOAD_KEY)
    if (!last) return null
    const lastMs = Number.parseInt(last, 10)
    return Number.isFinite(lastMs) ? now - lastMs : null
  } catch {
    return null
  }
}

/** Stamp the automatic reload about to happen. Best effort. */
export function recordAutoReload(now: number, storage: StorageLike | null | undefined): void {
  try {
    storage?.setItem(AUTO_RELOAD_KEY, String(now))
  } catch {
    // private mode / quota — the loop guard just does not apply
  }
}

const EDITABLE_INPUT_TYPES = new Set(['text', 'search', 'email', 'tel', 'url', 'password', 'number', 'date', 'datetime-local', 'time', 'month', 'week'])

/** True when the focused element is something a person could be typing into. */
export function isEditableFocused(doc: Pick<Document, 'activeElement'>): boolean {
  const el = doc.activeElement as (Element & { isContentEditable?: boolean; type?: string }) | null
  if (!el) return false
  const tag = el.tagName
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (tag === 'INPUT') return EDITABLE_INPUT_TYPES.has(((el as HTMLInputElement).type || 'text').toLowerCase())
  return el.isContentEditable === true
}

/** True when a modal or dialog is in the DOM. */
export function isDialogOpen(doc: Pick<Document, 'querySelector'>): boolean {
  return doc.querySelector('[role="dialog"], [role="alertdialog"], [aria-modal="true"], dialog[open]') != null
}
