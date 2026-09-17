/**
 * Google Drive through the service account (lifted from drive-intake for Submittals 6c so
 * the package filing shares one implementation): the JWT-bearer token, find-or-create a
 * folder, reuse-or-upload a file from a URL. Setup and the delegation note:
 * docs/DRIVE_INTAKE_SETUP.md. Idempotent by name: an existing same-name folder or file is
 * reused, never duplicated.
 */

export function b64url(data: Uint8Array | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** A service-account access token (RS256 JWT bearer grant via WebCrypto); `impersonate` = domain-wide delegation. */
export async function googleAccessToken(saJson: string, impersonate?: string): Promise<string> {
  const sa = JSON.parse(saJson) as { client_email: string; private_key: string; token_uri?: string }
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: sa.token_uri ?? 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    ...(impersonate ? { sub: impersonate } : {}),
  }))
  const pem = sa.private_key.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '')
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`)))
  const jwt = `${header}.${claims}.${b64url(sig)}`
  const res = await fetch(sa.token_uri ?? 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  })
  const body = await res.json()
  if (!res.ok || !body.access_token) throw new Error(`Google token exchange failed (${res.status}): ${body.error_description ?? body.error ?? 'unknown'}`)
  return body.access_token as string
}

export const DRIVE = 'https://www.googleapis.com/drive/v3'

export async function findOrCreateFolder(token: string, parentId: string, name: string): Promise<{ id: string; created: boolean }> {
  const q = encodeURIComponent(`name = '${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`)
  const found = await fetch(`${DRIVE}/files?q=${q}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json())
  if (found.files?.[0]?.id) return { id: found.files[0].id, created: false }
  const res = await fetch(`${DRIVE}/files?supportsAllDrives=true&fields=id`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
  })
  const body = await res.json()
  if (!res.ok || !body.id) throw new Error(`Folder create failed (${res.status}): ${body.error?.message ?? 'unknown'}`)
  return { id: body.id as string, created: true }
}

/** file/d/<id>, open?id=, uc?id= → the Drive file id; null for a non-Drive URL. */
export function driveFileIdFromUrl(url: string): string | null {
  const m = /drive\.google\.com\/(?:file\/d\/([\w-]{20,})|(?:open|uc)\?(?:[^#]*&)?id=([\w-]{20,}))/.exec(url)
  return m?.[1] ?? m?.[2] ?? null
}

/** drive.google.com/drive/folders/<id> → the folder id; null otherwise. */
export function driveFolderIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const m = /drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([\w-]{20,})/.exec(url)
  return m?.[1] ?? null
}

export async function findExistingFile(token: string, folderId: string, name: string): Promise<string | null> {
  const q = encodeURIComponent(`name = '${name.replace(/'/g, "\\'")}' and '${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`)
  const found = await fetch(`${DRIVE}/files?q=${q}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json())
  return found.files?.[0]?.id ?? null
}

/** Reuse-or-upload: a same-name file already in the folder is returned instead of uploaded twice. */
export async function uploadFromUrl(token: string, folderId: string, url: string, fileName: string): Promise<{ id: string; name: string; reused: boolean }> {
  const driveId = driveFileIdFromUrl(url)
  let name = fileName
  if (driveId) {
    const metaRes = await fetch(`${DRIVE}/files/${driveId}?fields=name&supportsAllDrives=true`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (metaRes.ok) {
      const m = await metaRes.json()
      if (m.name && !fileName.trim()) name = String(m.name)
      else if (m.name && fileName.endsWith(' - plans.pdf')) name = String(m.name)
    }
  }
  const existingId = await findExistingFile(token, folderId, name)
  if (existingId) return { id: existingId, name, reused: true }
  let src: Response
  if (driveId) {
    src = await fetch(`${DRIVE}/files/${driveId}?alt=media&supportsAllDrives=true`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!src.ok) throw new Error(`Drive source fetch failed (${src.status}) — is the file (or its folder) shared with the service account?`)
  } else {
    src = await fetch(url)
    if (!src.ok || !src.body) throw new Error(`Could not fetch the source (${src.status})`)
  }
  const meta = { name, parents: [folderId] }
  const boundary = 'drive-upload-' + crypto.randomUUID()
  const fileBytes = new Uint8Array(await src.arrayBuffer())
  const pre = new TextEncoder().encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${src.headers.get('content-type') ?? 'application/pdf'}\r\n\r\n`,
  )
  const post = new TextEncoder().encode(`\r\n--${boundary}--`)
  const payload = new Uint8Array(pre.length + fileBytes.length + post.length)
  payload.set(pre, 0)
  payload.set(fileBytes, pre.length)
  payload.set(post, pre.length + fileBytes.length)
  const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: payload,
  })
  const body = await res.json()
  if (!res.ok || !body.id) throw new Error(`Upload failed (${res.status}): ${body.error?.message ?? 'unknown'}`)
  return { id: body.id as string, name, reused: false }
}
