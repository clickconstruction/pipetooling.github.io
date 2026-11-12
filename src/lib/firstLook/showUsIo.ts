/**
 * The customer's page's doors (punch list #319, the spike, v2.6981): the `first-look` function by the link's code, and
 * storage by the one-file address the function hands out. Nothing here is signed in. The page is handed this object,
 * so its render test hands it a fake.
 */
import { publicFunctionHeaders } from '../customerSampleMode'
import { firstLookPageView, type FirstLookPageView, type FirstLookThanks } from './look'
import { pieceMetadata, signedPiecesEndpoint, type PiecePlan, type PieceTransport } from './pieces'
import type { DoneAnswer, SignAnswer, WholeAnswer } from './sendFile'

// The deployed build's address ends in a slash, the local one does not: both read the same here.
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/+$/, '')
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
const FUNCTION_URL = `${supabaseUrl}/functions/v1/first-look`
const TUS = '1.0.0'

export type SendAnswer = { ok: true; thanks: FirstLookThanks } | { ok: false; why: 'refused'; words: string } | { ok: false; why: 'signal' }

export type ShowUsIo = {
  read(code: string): Promise<FirstLookPageView | { kind: 'signal' }>
  sign(code: string, file: { mime: string; bytes: number; name: string; fileId: string | null }): Promise<SignAnswer>
  done(code: string, input: { fileId: string; road: 'pieces' | 'whole'; resumed: number; tookMs: number; seconds: number | null }): Promise<DoneAnswer>
  send(code: string, input: { place: string | null; words: string | null }): Promise<SendAnswer>
  putWhole(signedUrl: string, blob: Blob, mime: string, onSent: (bytes: number) => void): Promise<WholeAnswer>
  pieces: PieceTransport
  piecePlan(signed: { bucket: string; path: string; token: string }, mime: string): PiecePlan
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const str = (v: unknown, fallback: string): string => (typeof v === 'string' && v.trim() ? v : fallback)
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

async function post(body: Record<string, unknown>): Promise<{ status: number; body: Record<string, unknown> } | null> {
  try {
    const res = await fetch(FUNCTION_URL, { method: 'POST', headers: { ...(await publicFunctionHeaders(null)), 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const parsed: unknown = await res.json().catch(() => null)
    return { status: res.status, body: isRecord(parsed) ? parsed : {} }
  } catch {
    return null
  }
}

const FALLBACK = 'That did not go through. Try again, or call the office.'

/** One request with the bytes, and how far it has got. A lost signal is `signal`; anything storage turns away is `refused`. */
function xhrSend(method: 'PUT' | 'PATCH', url: string, headers: Record<string, string>, body: Blob, onSent: ((bytes: number) => void) | undefined): Promise<{ status: number; header(name: string): string | null } | null> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open(method, url)
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v)
    if (onSent) xhr.upload.onprogress = (e) => onSent(e.loaded)
    xhr.onload = () => resolve({ status: xhr.status, header: (name) => xhr.getResponseHeader(name) })
    xhr.onerror = () => resolve(null)
    xhr.onabort = () => resolve(null)
    xhr.ontimeout = () => resolve(null)
    xhr.send(body)
  })
}

const browserPieceTransport: PieceTransport = {
  async create(plan, length) {
    const res = await fetch(plan.endpoint, {
      method: 'POST',
      headers: { ...plan.headers, 'Tus-Resumable': TUS, 'Upload-Length': String(length), 'Upload-Metadata': pieceMetadata(plan), 'x-upsert': 'true' },
    })
    const where = res.headers.get('Location')
    if (res.status !== 201 || !where) return { ok: false, status: res.status || 500 }
    return { ok: true, location: new URL(where, plan.endpoint).toString() }
  },
  async offset(location, headers) {
    const res = await fetch(location, { method: 'HEAD', headers: { ...headers, 'Tus-Resumable': TUS } })
    if (!res.ok) return null
    const held = Number(res.headers.get('Upload-Offset'))
    return Number.isFinite(held) ? held : null
  },
  async patch(location, headers, offset, piece, onSent) {
    const res = await xhrSend('PATCH', location, { ...headers, 'Tus-Resumable': TUS, 'Upload-Offset': String(offset), 'Content-Type': 'application/offset+octet-stream' }, piece, onSent)
    if (!res) throw new Error('signal')
    if (res.status !== 204 && res.status !== 200) return { ok: false, status: res.status }
    const next = Number(res.header('Upload-Offset'))
    return { ok: true, offset: Number.isFinite(next) && next > offset ? next : offset + piece.size }
  },
}

export const showUsIo: ShowUsIo = {
  async read(code) {
    try {
      const res = await fetch(`${FUNCTION_URL}?code=${encodeURIComponent(code)}`, { headers: await publicFunctionHeaders(null) })
      const body: unknown = await res.json().catch(() => null)
      return firstLookPageView(res.status, body)
    } catch {
      return { kind: 'signal' }
    }
  },
  async sign(code, file) {
    const res = await post({ code, action: 'sign', mime: file.mime, bytes: file.bytes, name: file.name, ...(file.fileId ? { fileId: file.fileId } : {}) })
    if (!res) return { ok: false, why: 'signal' }
    const b = res.body
    if (res.status === 200 && b.ok === true && typeof b.fileId === 'string' && typeof b.token === 'string' && typeof b.signedUrl === 'string' && typeof b.path === 'string' && typeof b.bucket === 'string') {
      return { ok: true, fileId: b.fileId, bucket: b.bucket, path: b.path, token: b.token, signedUrl: b.signedUrl }
    }
    if (res.status === 409 && b.code === 'finished') return { ok: false, why: 'finished' }
    if (res.status >= 500 || res.status === 429) return { ok: false, why: 'signal' }
    return { ok: false, why: 'refused', words: str(b.error, FALLBACK), gone: res.status === 410 || res.status === 404 }
  },
  async done(code, input) {
    const res = await post({ code, action: 'done', ...input })
    if (!res) return { ok: false, why: 'signal' }
    const b = res.body
    if (res.status === 200 && b.ok === true) return { ok: true, photos: num(b.photos), videos: num(b.videos) }
    if (res.status === 409) return { ok: false, why: 'not-there' }
    if (res.status >= 500 || res.status === 429) return { ok: false, why: 'signal' }
    return { ok: false, why: 'refused', words: str(b.error, FALLBACK) }
  },
  async send(code, input) {
    const res = await post({ code, action: 'send', place: input.place, words: input.words })
    if (!res) return { ok: false, why: 'signal' }
    const b = res.body
    if (res.status === 200 && b.ok === true && isRecord(b.thanks) && typeof b.thanks.got === 'string' && Array.isArray(b.thanks.steps)) {
      return { ok: true, thanks: { got: b.thanks.got, steps: b.thanks.steps.filter((s): s is string => typeof s === 'string') } }
    }
    if (res.status >= 500 || res.status === 429) return { ok: false, why: 'signal' }
    return { ok: false, why: 'refused', words: str(b.error, FALLBACK) }
  },
  async putWhole(signedUrl, blob, mime, onSent) {
    const res = await xhrSend('PUT', signedUrl, { apikey: anonKey, 'Content-Type': mime, 'x-upsert': 'true', 'cache-control': 'max-age=3600' }, blob, onSent)
    if (!res) return { ok: false, why: 'signal' }
    if (res.status >= 200 && res.status < 300) return { ok: true }
    if (res.status >= 500 || res.status === 429) return { ok: false, why: 'signal' }
    return { ok: false, why: 'refused', status: res.status }
  },
  pieces: browserPieceTransport,
  piecePlan(signed, mime) {
    return { endpoint: signedPiecesEndpoint(supabaseUrl), bucket: signed.bucket, path: signed.path, mime, headers: { apikey: anonKey, 'x-signature': signed.token } }
  },
}
