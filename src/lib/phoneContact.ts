/**
 * One phone-number reading for the app's call buttons (Customer Waiting,
 * v2.3247). The customer record stores whatever was typed; this turns it into
 * the three things a button needs — a `tel:` href, an `sms:` href, and a
 * display string — or null when there is nothing dialable.
 *
 * US ten digits (or eleven with a leading 1) → `+1…` and `(512) 555-0142`
 * (the `formatChasePhone` shape the AR chase already prints). Anything else
 * with at least seven digits dials as typed digits and displays as typed.
 */

export type PhoneContact = {
  telHref: string
  smsHref: string
  display: string
  /** Digits only, `+1`-prefixed for US — what a clipboard copy should carry. */
  e164: string
}

export function phoneContact(raw: string | null | undefined): PhoneContact | null {
  const s = (raw ?? '').trim()
  if (!s) return null
  const digits = s.replace(/\D/g, '')
  if (digits.length < 7) return null
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  if (ten.length === 10) {
    const e164 = `+1${ten}`
    return {
      telHref: `tel:${e164}`,
      smsHref: `sms:${e164}`,
      display: `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`,
      e164,
    }
  }
  const intl = s.startsWith('+') ? `+${digits}` : digits
  return { telHref: `tel:${intl}`, smsHref: `sms:${intl}`, display: s, e164: intl }
}
