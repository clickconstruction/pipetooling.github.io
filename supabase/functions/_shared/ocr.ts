/**
 * Our own OCR for scans (punch list #240, PR 3): Google Document AI's Document OCR processor behind one function, the
 * processor read from the secret `GOOGLE_DOCAI_PROCESSOR` at call time. Unset, `ocrSetup` answers null and the index
 * leaves a scan as `scan`; set, a scan's bytes go to the processor as the service account (a cloud-platform token
 * minted here, so `driveUpload.ts`'s Drive token stays what it is) and the text comes back into the row with
 * `text_source = 'ocr'`. The rules are pure in `ocrKernel.ts`. Setup: docs/DRIVE_INTAKE_SETUP.md → Our own OCR.
 */
import { b64url } from './driveUpload.ts'
import type { PassSpend } from './fileIndexKernel.ts'
import { base64OfBytes } from './messagesEmailFiles.ts'
import { OCR_MAX_BYTES, OCR_MAX_PAGES, OCR_PROCESSOR_SECRET, OCR_READ_MS, OCR_TOKEN_SCOPE, ocrEndpoint, ocrReadAnswer, ocrRequestBody, type OcrAnswer } from './ocrKernel.ts'

export interface OcrSetup {
  processor: string
  url: string
  /** A cloud-platform token for the service account, minted once per request and reused. */
  token: () => Promise<string>
}

/** The OCR setup for this request, or null when the secret is not set. A malformed secret is logged and reads as unset. */
export function ocrSetup(saJson: string | null | undefined): OcrSetup | null {
  const processor = Deno.env.get(OCR_PROCESSOR_SECRET)?.trim()
  if (!processor || !saJson) return null
  const endpoint = ocrEndpoint(processor)
  if (!endpoint.ok) {
    console.warn(endpoint.error)
    return null
  }
  let minted: Promise<string> | null = null
  return { processor, url: endpoint.url, token: () => (minted ??= cloudPlatformToken(saJson)) }
}

/** The service account's token for Google Cloud APIs beyond Drive: the same JWT-bearer grant with the cloud-platform scope. */
export async function cloudPlatformToken(saJson: string): Promise<string> {
  const sa = JSON.parse(saJson) as { client_email: string; private_key: string; token_uri?: string }
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(JSON.stringify({ iss: sa.client_email, scope: OCR_TOKEN_SCOPE, aud: sa.token_uri ?? 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }))
  const pem = sa.private_key.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '')
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`)))
  const res = await fetch(sa.token_uri ?? 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claims}.${b64url(sig)}` }),
  })
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string; error_description?: string }
  if (!res.ok || !body.access_token) throw new Error(`Google token exchange failed (${res.status}): ${body.error_description ?? body.error ?? 'unknown'}`)
  return body.access_token
}

/** One file's bytes through the processor: the text and the page count, or Document AI's own reason, within `OCR_READ_MS`. Never throws. */
export async function ocrText(setup: OcrSetup, bytes: Uint8Array, mime: string, opts: { maxPages?: number; waitMs?: number; spend?: PassSpend } = {}): Promise<OcrAnswer> {
  const maxPages = opts.maxPages ?? OCR_MAX_PAGES
  const waitMs = opts.waitMs ?? OCR_READ_MS
  if (bytes.length > OCR_MAX_BYTES) return { ok: false, error: `The file is ${bytes.length} bytes; Document AI takes up to ${OCR_MAX_BYTES} inline.` }
  const stop = new AbortController()
  const timer = setTimeout(() => stop.abort(), waitMs)
  try {
    const token = await setup.token()
    // The request's own CPU counts on the pass's clock: encoding a large photo costs what parsing a PDF does.
    const encoding = performance.now()
    const payload = JSON.stringify(ocrRequestBody(base64OfBytes(bytes), mime, maxPages))
    if (opts.spend) {
      opts.spend.ms += performance.now() - encoding
      opts.spend.bytes += bytes.length
    }
    const res = await fetch(setup.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: payload,
      signal: stop.signal,
    })
    const text = await res.text()
    let body: unknown = text
    try {
      body = text ? JSON.parse(text) : null
    } catch { /* a non-JSON reply is reported as text */ }
    return ocrReadAnswer(res.status, body)
  } catch (e) {
    if (stop.signal.aborted) return { ok: false, error: `Document AI did not answer within ${Math.round(waitMs / 1000)} s.` }
    return { ok: false, error: `The OCR call did not go through: ${e instanceof Error ? e.message : String(e)}` }
  } finally {
    clearTimeout(timer)
  }
}

/** A one-pixel PNG, the made-up document the probe sends so the provider answers with its own words. */
export const OCR_PROBE_PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0))
