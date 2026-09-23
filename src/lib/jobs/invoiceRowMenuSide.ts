/**
 * Which way a bill row's ⋯ menu opens (Edit Job → Bill → the list of bills).
 *
 * The ⋯ button sits at the LEFT of its row, right after Record payment, and
 * the menu is wider than the space to its left, so a menu anchored to the
 * button's right edge (`right: 0`) runs past the modal's left edge and gets
 * clipped — "ayment cash, check", "ount credit note" (v2.3765). The menu
 * opens rightward from the button's left edge unless that would run past the
 * container; then it opens leftward if that fits, else whichever side has
 * more room.
 */
export type InvoiceRowMenuSide = 'left' | 'right'

export type InvoiceRowMenuSideInput = {
  /** The ⋯ button's edges, in the same coordinate space as the bounds. */
  anchorLeft: number
  anchorRight: number
  /** The menu's rendered width. */
  menuWidth: number
  /** The clipping container's edges (the ledger / modal body, or the viewport). */
  boundsLeft: number
  boundsRight: number
  /** Breathing room kept from each edge. */
  gutter?: number
}

/** `'left'` = anchor the menu's left edge to the button (opens rightward); `'right'` = anchor its right edge (opens leftward). */
export function invoiceRowMenuSide(input: InvoiceRowMenuSideInput): InvoiceRowMenuSide {
  const gutter = input.gutter ?? 8
  const roomRight = input.boundsRight - gutter - input.anchorLeft
  const roomLeft = input.anchorRight - (input.boundsLeft + gutter)
  if (input.menuWidth <= roomRight) return 'left'
  if (input.menuWidth <= roomLeft) return 'right'
  return roomLeft > roomRight ? 'right' : 'left'
}
