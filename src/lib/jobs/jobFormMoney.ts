/**
 * Money-string parsing/formatting + payment-date display for the Job Form
 * (Edit/New Job) inputs. Extracted verbatim from JobFormModal for unit testing.
 * Pure — no React, no DOM, no DB.
 */

export function formatCurrency(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function parseMoneyInputToNumber(s: string): number {
  const t = s.replace(/,/g, '').trim()
  if (t === '' || t === '.') return 0
  const n = parseFloat(t)
  return Number.isFinite(n) ? n : 0
}

export function parseMoneyInputToNumberOrNull(s: string): number | null {
  const t = s.replace(/,/g, '').trim()
  if (t === '' || t === '.') return null
  const n = parseFloat(t)
  return Number.isFinite(n) ? n : null
}

/** Keep only digits and a single decimal point as the user types a money amount. */
export function sanitizeMoneyTyping(raw: string): string {
  const noComma = raw.replace(/,/g, '')
  let out = ''
  let dotSeen = false
  for (const c of noComma) {
    if (c >= '0' && c <= '9') out += c
    else if (c === '.' && !dotSeen) {
      dotSeen = true
      out += '.'
    }
  }
  return out
}

/** Display `YYYY-MM-DD` for payment table cells (Stripe-locked rows use plain text, not date inputs). */
export function formatPaymentDateForDisplay(isoYmd: string | null | undefined): string {
  const t = isoYmd?.trim()
  if (!t) return '—'
  const d = new Date(`${t}T12:00:00`)
  if (Number.isNaN(d.getTime())) return t
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
