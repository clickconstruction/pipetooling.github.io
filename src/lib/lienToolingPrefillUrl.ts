/** Lien Tooling shareable URL: UTF-8 JSON → base64url → `#d=` fragment (matches lientooling form-url-state.js). */

export type LienToolingFormPage = 'demand-letter' | 'mechanics-lien' | 'release-lien'

export function lienToolingOrigin(): string {
  const raw = import.meta.env.VITE_LIEN_TOOLING_ORIGIN
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim().replace(/\/+$/, '')
  }
  return 'https://lientooling.com'
}

/** JSON-serializable field map for Lien Tooling forms (strings, booleans for checkboxes). */
export type LienToolingPrefillState = Record<string, string | boolean | number>

export function utf8JsonToBase64Url(obj: LienToolingPrefillState): string {
  const json = JSON.stringify(obj)
  const bytes = new TextEncoder().encode(json)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]!)
  }
  const b64 = btoa(bin)
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function buildLienToolingFormUrl(
  origin: string,
  page: LienToolingFormPage,
  state: LienToolingPrefillState,
): string {
  const base = origin.replace(/\/+$/, '')
  const payload = utf8JsonToBase64Url(state)
  return `${base}/${page}.html#d=${payload}`
}
