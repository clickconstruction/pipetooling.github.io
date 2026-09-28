/**
 * Bid Room change order signing kernel (v2.3964): what stops a GC's signature
 * on a change order card, and the body the card posts to `sign-bid-room`.
 *
 * A change order carries the electronic-signature consent as its own act — the
 * consent line's checkbox — beside the card's agree box, so the words stored
 * on `esign_consents` are the words the signer ticked. Pure: the card supplies
 * the pad's state and the consent text; this decides what to say and what to
 * send. The checks run in the order the other signing forms use: name,
 * consent, agree, drawing.
 */
import type { EsignConsentPayload } from '../esignConsent'

export type ChangeOrderSignMode = 'type' | 'draw'

export type ChangeOrderSignInput = {
  printedName: string
  /** The consent line's own checkbox: "I agree to sign electronically." */
  consented: boolean
  /** The card's agree box: the change order and its impact on cost and schedule. */
  agreed: boolean
  mode: ChangeOrderSignMode
  /** The drawn PNG data URL, or null when the pad is empty / in type mode. */
  drawnPng: string | null
}

export const CHANGE_ORDER_NAME_HINT = 'Please enter your full name.'
export const CHANGE_ORDER_CONSENT_HINT = 'Please tick "I agree to sign electronically" to continue.'
export const CHANGE_ORDER_AGREE_HINT = 'Please confirm you agree to this change order.'
export const CHANGE_ORDER_DRAW_HINT = 'Please sign in the box.'

/** The document noun the consent text is built with (`esignConsentText({ audience: 'gc', documentNoun })`). */
export const CHANGE_ORDER_CONSENT_NOUN = 'this change order'

/** First problem with the signature, or null when the change order can be signed. */
export function changeOrderSignError(input: ChangeOrderSignInput): string | null {
  if (!input.printedName.trim()) return CHANGE_ORDER_NAME_HINT
  if (!input.consented) return CHANGE_ORDER_CONSENT_HINT
  if (!input.agreed) return CHANGE_ORDER_AGREE_HINT
  if (input.mode === 'draw' && !input.drawnPng) return CHANGE_ORDER_DRAW_HINT
  return null
}

export type ChangeOrderSignBody = {
  action: 'sign'
  documentId: string
  printedName: string
  agreedTerms: true
  /** Present only for a drawn signature — `sign-bid-room` stores it beside the row. */
  signaturePngBase64?: string
  /** The exact consent words shown on the card; the function stores them verbatim. */
  esignConsent: EsignConsentPayload
}

/** The `sign-bid-room` body for a signed change order. Call only after `changeOrderSignError` is null. */
export function changeOrderSignBody(documentId: string, input: ChangeOrderSignInput, consent: EsignConsentPayload): ChangeOrderSignBody {
  const base: ChangeOrderSignBody = {
    action: 'sign',
    documentId,
    printedName: input.printedName.trim(),
    agreedTerms: true,
    esignConsent: consent,
  }
  if (input.mode === 'draw' && input.drawnPng) return { ...base, signaturePngBase64: input.drawnPng }
  return base
}
