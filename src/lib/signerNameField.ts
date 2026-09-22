/**
 * The signer's name at submit (v2.3739): what the box holds wins over what React remembers.
 *
 * iOS Safari's AutoFill (the contact suggestion above the keyboard) can write a name into the
 * box without firing an input event, so a controlled `<input value={printedName}>` keeps
 * `printedName === ''` and rewrites the box to '' on the next render — ticking the consent
 * checkbox was enough. The customer saw her name vanish and "Please enter your full name."
 * The name input is uncontrolled (`SignerNameInput`) and every submit reads the box itself.
 */
export type SignerNameRead = {
  /** The trimmed name to submit — the box's text when there is a box, the state otherwise. */
  name: string
  /** True when the box held something React's state did not — the caller syncs state. */
  drifted: boolean
}

export function resolveSignerName(stateValue: string, domValue: string | null | undefined): SignerNameRead {
  const fromDom = typeof domValue === 'string' ? domValue : null
  const raw = fromDom ?? stateValue
  return { name: raw.trim(), drifted: fromDom != null && fromDom !== stateValue }
}
