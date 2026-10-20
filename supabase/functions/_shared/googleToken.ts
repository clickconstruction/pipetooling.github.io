/**
 * A Google access token for the service account (GOOGLE_SERVICE_ACCOUNT_JSON): an RS256 JWT bearer grant signed with
 * WebCrypto, `sub` set to the impersonated user for domain-wide delegation. The same path as `driveUpload.ts`'s
 * `googleAccessToken`, with the scopes given rather than Drive's alone, so a reader that needs other scopes (Messages
 * cut 6's `gmail-sync`, Gmail's) takes no change to the Drive helpers or to the functions that bundle them.
 */

const b64url = (data: Uint8Array | string): string => {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** An access token for `scopes`, as `impersonate` when given. Throws with Google's reason. */
export async function googleServiceToken(saJson: string, scopes: readonly string[], impersonate?: string): Promise<string> {
  const sa = JSON.parse(saJson) as { client_email: string; private_key: string; token_uri?: string }
  const tokenUri = sa.token_uri ?? 'https://oauth2.googleapis.com/token'
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: scopes.join(' '),
      aud: tokenUri,
      iat: now,
      exp: now + 3600,
      ...(impersonate ? { sub: impersonate } : {}),
    }),
  )
  const pem = sa.private_key.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '')
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`)))
  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claims}.${b64url(sig)}` }),
  })
  const body = await res.json()
  if (!res.ok || !body.access_token) throw new Error(`Google token exchange failed (${res.status}): ${body.error_description ?? body.error ?? 'unknown'}`)
  return body.access_token as string
}
