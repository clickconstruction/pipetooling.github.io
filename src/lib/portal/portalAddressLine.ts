/**
 * The line under the portal window's address (punch list #389, the walk of 2026-11-25, finding 180). A fresh
 * portal fills the address box with a suggestion, their name plus a random tail, and nothing is saved until
 * **Copy link** is pressed. The window said so only by silence: the suggestion was drawn as a saved address is,
 * and a walker read it off the screen as the customer's address, which opened nothing. Now the line under it says
 * so, and the suggestion is drawn in a lighter tone than a saved address. Pure.
 */

export type PortalAddressState = 'suggested' | 'saved' | 'locked'

/** `saved` is the address on the customer's row, null when none was ever saved; `locked` once it was first shared. */
export function portalAddressState(args: { saved: string | null; locked: boolean }): PortalAddressState {
  if (args.locked) return 'locked'
  return args.saved ? 'saved' : 'suggested'
}

export const PORTAL_ADDRESS_NOT_SAVED_LINE = 'Not saved yet. Copy link saves it.'
export const PORTAL_ADDRESS_EDITABLE_LINE = 'Editable until first shared'

/** The words under the address: what a press would do to it. Empty once the address is locked. */
export function portalAddressLine(state: PortalAddressState): string {
  if (state === 'suggested') return PORTAL_ADDRESS_NOT_SAVED_LINE
  if (state === 'saved') return PORTAL_ADDRESS_EDITABLE_LINE
  return ''
}

/** The line's colour: a notice while nothing is saved, faint once something is. */
export function portalAddressLineColor(state: PortalAddressState): string {
  return state === 'suggested' ? 'var(--text-amber-700)' : 'var(--text-faint)'
}

/** The address's own colour in the box: muted while it is a suggestion, the box's own once saved. */
export function portalAddressTextColor(state: PortalAddressState): string {
  return state === 'suggested' ? 'var(--text-muted)' : 'inherit'
}
