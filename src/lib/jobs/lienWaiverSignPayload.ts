import type { EstimateAcceptSubmitPayload } from '../../components/estimates/EstimateAcceptBody'

/**
 * Reading the signature line of a lien waiver when the sign button is pressed (v2.4335). The line
 * is `LienWaiverSignOnPage` at the foot of the page; this is what it hands over and what
 * `signLienRelease` takes from it, or the one thing still missing, in the order the signer meets
 * them: the line, then the box.
 */

/** What the signature line exposes to the sign button. */
export type LienWaiverSignOnPageHandle = {
  mode: 'draw' | 'type'
  /** True when drawing and nothing is on the line yet. */
  isEmpty: () => boolean
  /** The drawing as a PNG data URL, or null when empty or typing. */
  toDataURL: () => string | null
  clear: () => void
}

/** The payload `signLienRelease` takes, read from the line; or the one thing still missing. */
export function lienWaiverSignPayload(
  pad: LienWaiverSignOnPageHandle | null,
  printedName: string,
  agreed: boolean,
): { payload: EstimateAcceptSubmitPayload } | { error: string } {
  const name = printedName.trim()
  if (!pad) return { error: 'The signature line is not ready yet.' }
  if (!name) return { error: 'There is no name to print under the signature. Fill in Signed by on the waiver first.' }
  let png: string | null = null
  if (pad.mode === 'draw') {
    png = pad.toDataURL()
    if (!png) return { error: 'Sign on the line first.' }
  }
  if (!agreed) return { error: 'Tick the box to agree first.' }
  return pad.mode === 'draw' && png ? { payload: { mode: 'draw', printedName: name, signaturePngBase64: png } } : { payload: { mode: 'type', printedName: name } }
}
