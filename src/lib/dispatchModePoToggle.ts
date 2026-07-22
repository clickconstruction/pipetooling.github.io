/**
 * Per-user, per-device toggle for the Dispatch Mode PO tab (the phone PO
 * minting flow). Mirrors dispatchModeToggle's localStorage + same-tab event
 * pattern; deliberately NOT server-backed — it's a small per-device UI
 * preference, off by default, flipped from the gear menu while Dispatch Mode
 * is on.
 */

export const DISPATCH_MODE_PO_CHANGED_EVENT = 'dispatch_mode_po_changed'

function key(userId: string): string {
  return `dispatch_mode_po_${userId}`
}

/** Explicit per-device choice; null = never chosen (assistants then default ON). */
export function readDispatchModePoEnabled(userId: string | null | undefined): boolean | null {
  if (!userId) return null
  try {
    if (typeof localStorage === 'undefined') return null
    const v = localStorage.getItem(key(userId))
    return v == null ? null : v === '1'
  } catch {
    return null
  }
}

export function writeDispatchModePoEnabled(userId: string | null | undefined, enabled: boolean): void {
  if (!userId) return
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(key(userId), enabled ? '1' : '0')
    window.dispatchEvent(new Event(DISPATCH_MODE_PO_CHANGED_EVENT))
  } catch {
    // ignore
  }
}
