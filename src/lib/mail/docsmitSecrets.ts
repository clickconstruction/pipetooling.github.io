/**
 * The Developer block's side of Docsmit's secrets (the Docsmit train, PR 9): the password is hashed in
 * the browser (Docsmit's API takes the SHA-512 hex, nothing else), so the cleartext never leaves it; the
 * block reads a status, never a value. Pure but for `crypto.subtle`.
 */

export async function sha512Hex(text: string, subtle: SubtleCrypto = crypto.subtle): Promise<string> {
  const digest = await subtle.digest('SHA-512', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export type DocsmitSecretStatus = {
  ready: boolean
  set: Record<string, boolean>
  source: Record<string, 'vault' | 'env' | 'none'>
  email: string | null
  base_url: string | null
  env: 'tracksmit' | 'prod' | null
}

/** One line for the block: what is set, from where, and which Docsmit. */
export function docsmitSecretStatusWords(s: DocsmitSecretStatus | null): string {
  if (!s) return 'Not read yet.'
  const names: Array<[string, string]> = [['DOCSMIT_EMAIL', 'email'], ['DOCSMIT_PASSWORD_SHA512', 'password'], ['DOCSMIT_SOFTWARE_ID', 'software id']]
  const parts = names.map(([k, label]) => `${label} ${s.set[k] ? `set (${s.source[k] ?? 'vault'})` : 'missing'}`)
  const which = s.env === 'prod' ? 'the live Docsmit' : 'Tracksmit, the sandbox'
  return `${s.ready ? 'Ready' : 'Not ready'}: ${parts.join(', ')} · ${which}${s.email ? ` · ${s.email}` : ''}`
}

/** Docsmit's two homes, for the select. */
export const DOCSMIT_BASE_URLS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'https://secure.tracksmit.com/api/v1', label: 'Tracksmit (sandbox, nothing mails)' },
  { value: 'https://secure.docsmit.com/api/v1', label: 'Docsmit (live, mails for real)' },
]
