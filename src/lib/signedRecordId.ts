/**
 * The short record ID printed inside a signature frame (v2.2724): ties the
 * mark on every surface — office view, customer page, PDF, email — to the
 * stored row without exposing the UUID. `E84-9F3A2C` for estimate #84,
 * `J922-1B0C4D` for a job contract. Not a secret; a lookup key.
 */
export function signedRecordId(prefix: 'E' | 'J', number: string | number | null | undefined, rowId: string | null | undefined): string {
  const n = String(number ?? '').replace(/[^a-zA-Z0-9]/g, '') || '0'
  const hex = (rowId ?? '').replace(/-/g, '').slice(0, 6).toUpperCase() || '000000'
  return `${prefix}${n}-${hex}`
}

/** "Mozilla/5.0 (iPhone…) … CriOS/…" → "iPhone · Chrome"; null-safe. */
export function describeUserAgent(ua: string | null | undefined): string | null {
  const s = (ua ?? '').trim()
  if (!s) return null
  const os = /iPhone/.test(s) ? 'iPhone' : /iPad/.test(s) ? 'iPad' : /Android/.test(s) ? 'Android' : /Mac OS/.test(s) ? 'Mac' : /Windows/.test(s) ? 'Windows' : /Linux/.test(s) ? 'Linux' : 'Device'
  const br = /Edg\//.test(s) ? 'Edge' : /CriOS|Chrome\//.test(s) ? 'Chrome' : /FxiOS|Firefox\//.test(s) ? 'Firefox' : /Safari\//.test(s) ? 'Safari' : 'browser'
  return `${os} · ${br}`
}

export type SignatureMethod = 'type' | 'draw' | 'in_person' | 'paper'

export function signatureMethodLabel(method: SignatureMethod | string | null | undefined, surface: 'estimate' | 'contract' = 'contract'): string {
  switch (method) {
    case 'draw':
      return surface === 'estimate' ? 'Drawn on the estimate page' : 'Drawn on their phone'
    case 'in_person':
      return 'Signed in person on our device'
    case 'paper':
      return 'Signed on paper, uploaded by the office'
    default:
      return surface === 'estimate' ? 'Typed on the estimate page' : 'Typed on their phone'
  }
}
