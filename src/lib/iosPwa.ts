/**
 * iOS PWA detection + "Add Task" home-screen shortcut flags.
 *
 * The detection kernels are pure (they take an injected env object) so they're unit-testable
 * in the node test environment; thin wrappers read `navigator` / `matchMedia` at runtime.
 * This generalizes the inline check in `openInExternalBrowser.ts` and additionally handles
 * iPadOS 13+, which reports as "MacIntel" with touch points.
 */

export type DeviceEnv = {
  ua: string
  platform: string
  maxTouchPoints: number
}

/** True for iPhone / iPad / iPod, including iPadOS that masquerades as desktop Safari. */
export function detectIsIOS(env: DeviceEnv): boolean {
  if (/iPad|iPhone|iPod/.test(env.ua)) return true
  // iPadOS 13+ reports platform "MacIntel"; touch points distinguish an iPad from a real Mac.
  return env.platform === 'MacIntel' && env.maxTouchPoints > 1
}

export type StandaloneEnv = {
  navStandalone: boolean | undefined
  displayModeStandalone: boolean
}

/** True when launched from a home-screen icon (iOS `navigator.standalone` or display-mode). */
export function detectIsStandalone(env: StandaloneEnv): boolean {
  return env.navStandalone === true || env.displayModeStandalone === true
}

function readDeviceEnv(): DeviceEnv {
  if (typeof navigator === 'undefined') return { ua: '', platform: '', maxTouchPoints: 0 }
  return {
    ua: navigator.userAgent || '',
    platform: navigator.platform || '',
    maxTouchPoints: navigator.maxTouchPoints || 0,
  }
}

function readStandaloneEnv(): StandaloneEnv {
  const navStandalone =
    typeof navigator !== 'undefined'
      ? (navigator as { standalone?: boolean }).standalone
      : undefined
  const displayModeStandalone =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(display-mode: standalone)').matches
      : false
  return { navStandalone, displayModeStandalone }
}

export function isIOSDevice(): boolean {
  return detectIsIOS(readDeviceEnv())
}

export function isStandalonePwa(): boolean {
  return detectIsStandalone(readStandaloneEnv())
}

/** In Safari's browser (not a standalone webclip) on iOS — the only place "Add to Home Screen" lives. */
export function isIOSSafariBrowser(): boolean {
  return isIOSDevice() && !isStandalonePwa()
}

// --- localStorage flags (safe; no-op when storage is unavailable) ---

const PENDING_OPEN_ADD_TASK_KEY = 'add_task_pending_open_v1'
const INSTALLED_KEY = 'add_task_shortcut_installed_v1'
const BANNER_DISMISSED_KEY = 'add_task_banner_dismissed_v1'

function safeGet(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function safeSet(key: string, value: string): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}
function safeRemove(key: string): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

/** Intent: open the Add Task modal on the next authenticated app load. Survives the sign-in hard reload. */
export function setPendingOpenAddTask(): void {
  safeSet(PENDING_OPEN_ADD_TASK_KEY, '1')
}
/** Read + clear the pending-open intent in one call. */
export function consumePendingOpenAddTask(): boolean {
  const present = safeGet(PENDING_OPEN_ADD_TASK_KEY) === '1'
  if (present) safeRemove(PENDING_OPEN_ADD_TASK_KEY)
  return present
}

/** Best-effort suppression once the icon has been launched at least once (only if iOS shares storage). */
export function markTaskShortcutInstalled(): void {
  safeSet(INSTALLED_KEY, '1')
}
export function isTaskShortcutInstalled(): boolean {
  return safeGet(INSTALLED_KEY) === '1'
}

/** Reliable suppression: the user dismissed the Safari banner. */
export function markAddTaskBannerDismissed(): void {
  safeSet(BANNER_DISMISSED_KEY, '1')
}
export function isAddTaskBannerDismissed(): boolean {
  return safeGet(BANNER_DISMISSED_KEY) === '1'
}

/** Whether to show the Safari "add the Add Task icon" banner (role gating is applied by the caller). */
export function shouldShowAddTaskBanner(): boolean {
  return isIOSSafariBrowser() && !isAddTaskBannerDismissed() && !isTaskShortcutInstalled()
}
