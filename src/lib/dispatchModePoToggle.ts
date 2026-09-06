/**
 * Per-user, per-device toggle for the Dispatch Mode PO tab (the phone PO
 * minting flow). Mirrors dispatchModeToggle's localStorage + same-tab event
 * pattern; deliberately NOT server-backed — it's a small per-device UI
 * preference, flipped from the gear menu while Dispatch Mode is on.
 *
 * Default when never chosen: ON for the roles that mint counter codes daily
 * (assistant-like and master technicians, v2.2903 / J29-F7), OFF for dev.
 */
import { isAssistantLike } from './subcontractorLikeRole'

/** Roles that may see the PO tab at all (mirrors Layout's gate). */
export function dispatchModePoRoleAllowed(role: string | null | undefined): boolean {
  return role === 'dev' || role === 'master_technician' || role === 'assistant'
}

/** What the tab does before the user ever touches the gear item. */
export function dispatchModePoDefaultEnabled(role: string | null | undefined): boolean {
  return isAssistantLike(role) || role === 'master_technician'
}

/** Stored per-device choice wins; otherwise the role default. */
export function resolveDispatchModePoEnabled(stored: boolean | null, role: string | null | undefined): boolean {
  return stored ?? dispatchModePoDefaultEnabled(role)
}

export const DISPATCH_MODE_PO_CHANGED_EVENT = 'dispatch_mode_po_changed'

function key(userId: string): string {
  return `dispatch_mode_po_${userId}`
}

/** Explicit per-device choice; null = never chosen (see `dispatchModePoDefaultEnabled`). */
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
