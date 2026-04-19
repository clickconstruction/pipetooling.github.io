/** Default when `app_settings` row is missing or empty (US local display + E.164 for tel:). */
export const DEFAULT_FIELD_DISPATCH_DISPLAY = '512 360 0599'
export const DEFAULT_FIELD_DISPATCH_TEL = '+15123600599'

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '')
}

function formatUs10(d: string): string {
  if (d.length !== 10) return d
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`
}

/**
 * Maps stored `value_text` to `tel:` href and a short display string.
 * US 10- or 11-digit numbers get `+1` and spaced display; other digit runs use `+digits`.
 */
export function parseFieldDispatchPhoneFromValueText(raw: string | null | undefined): {
  telHref: string
  display: string
} {
  if (raw == null || String(raw).trim() === '') {
    return { telHref: DEFAULT_FIELD_DISPATCH_TEL, display: DEFAULT_FIELD_DISPATCH_DISPLAY }
  }
  const t = String(raw).trim()
  const d = digitsOnly(t)
  if (d.length === 0) {
    return { telHref: DEFAULT_FIELD_DISPATCH_TEL, display: DEFAULT_FIELD_DISPATCH_DISPLAY }
  }

  if (d.length === 10) {
    return { telHref: `+1${d}`, display: formatUs10(d) }
  }
  if (d.length === 11 && d.startsWith('1')) {
    const ten = d.slice(1)
    return { telHref: `+1${ten}`, display: formatUs10(ten) }
  }

  if (t.startsWith('+')) {
    return { telHref: `+${d}`, display: t }
  }
  return { telHref: `+${d}`, display: d }
}
