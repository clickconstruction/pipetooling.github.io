/**
 * Bid Room signature kernel (v2.3159): the checks the room runs before it
 * posts a GC's approval, and the fields it sends. Shared by the proposal
 * approval and each change order's Review & sign. Pure — the page supplies
 * the pad's state; this decides what to say and what to send.
 */

export type BidRoomSignatureMode = 'type' | 'draw'

export type BidRoomSignatureInput = {
  printedName: string
  agreed: boolean
  mode: BidRoomSignatureMode
  /** The drawn PNG data URL, or null when the pad is empty / in type mode. */
  drawnPng: string | null
}

export const BID_ROOM_NAME_HINT = 'Please enter your full name.'
export const BID_ROOM_DRAW_HINT = 'Please sign in the box.'

/**
 * First problem with the signature, or null when it can be sent. `agreeHint`
 * is the surface's own wording (the proposal and a change order ask
 * differently).
 */
export function bidRoomSignatureError(input: BidRoomSignatureInput, agreeHint: string): string | null {
  if (!input.printedName.trim()) return BID_ROOM_NAME_HINT
  if (!input.agreed) return agreeHint
  if (input.mode === 'draw' && !input.drawnPng) return BID_ROOM_DRAW_HINT
  return null
}

export type BidRoomSignatureFields = {
  printedName: string
  agreedTerms: true
  /** Present only for a drawn signature — `sign-bid-room` stores it beside the row. */
  signaturePngBase64?: string
}

/** The signature part of the `sign-bid-room` body. Call only after `bidRoomSignatureError` is null. */
export function bidRoomSignatureFields(input: BidRoomSignatureInput): BidRoomSignatureFields {
  const base: BidRoomSignatureFields = { printedName: input.printedName.trim(), agreedTerms: true }
  if (input.mode === 'draw' && input.drawnPng) return { ...base, signaturePngBase64: input.drawnPng }
  return base
}
