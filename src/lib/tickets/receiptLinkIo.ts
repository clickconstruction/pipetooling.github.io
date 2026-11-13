/**
 * The receipt link's doors (punch list #299, PR 1): the `receipt-link` function by the link's code, with no sign-in,
 * and the office's Copy the receipt link, signed in. The page is handed this object, so its render test hands it a
 * fake. Browser io, not pure.
 */
import { publicFunctionHeaders } from '../customerSampleMode'
import { supabase } from '../supabase'
import { RECEIPT_LINK_WORDS, receiptLinkUrl, type ReceiptJobPick, type ReceiptPageCharge } from './receiptLink'

// The deployed build's address ends in a slash, the local one does not: both read the same here.
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/+$/, '')
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
const FUNCTION_URL = `${supabaseUrl}/functions/v1/receipt-link`

/** What a link opens on. `signal` is a request that never got an answer. */
export type ReceiptLinkView =
  | { kind: 'open'; charges: ReceiptPageCharge[]; closesOn: string | null }
  | { kind: 'closed' }
  | { kind: 'not_found' }
  | { kind: 'locked' }
  | { kind: 'signal' }
  | { kind: 'failed'; words: string }

export type ReceiptWriteAnswer = { ok: true; charge: ReceiptPageCharge; kept: boolean } | { ok: false; why: 'signal' } | { ok: false; why: 'refused'; words: string }

export interface ReceiptPageInput {
  /** The charge's handle on the page: the request's id. */
  charge: string
  /** Minted on the phone, so a second try sends the same page. */
  pageId: string
  blob: Blob
  width: number
  height: number
  originalBytes: number
  job: ReceiptJobPick | null
  /** Retake: the page this one takes the place of. */
  replace: string | null
}

export interface ReceiptLinkIo {
  read(code: string): Promise<ReceiptLinkView>
  addPage(code: string, input: ReceiptPageInput): Promise<ReceiptWriteAnswer>
  setJob(code: string, charge: string, job: ReceiptJobPick): Promise<ReceiptWriteAnswer>
  /** The address of one page's picture, for a thumbnail the phone no longer holds. */
  pageUrl(code: string, pageId: string): string
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const words = (body: Record<string, unknown>, fallback: string): string => (typeof body.words === 'string' && body.words ? body.words : typeof body.error === 'string' && body.error && !/^[a-z_]+$/.test(body.error) ? body.error : fallback)

/** The page's bytes as base64, the shape the function takes (as the sub portal posts a signature). */
export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  const step = 0x8000
  for (let i = 0; i < bytes.length; i += step) bin += String.fromCharCode(...bytes.subarray(i, i + step))
  return btoa(bin)
}

async function post(body: Record<string, unknown>): Promise<{ status: number; body: Record<string, unknown> } | null> {
  try {
    const res = await fetch(FUNCTION_URL, { method: 'POST', headers: { ...(await publicFunctionHeaders(null)), 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const parsed: unknown = await res.json().catch(() => null)
    return { status: res.status, body: isRecord(parsed) ? parsed : {} }
  } catch {
    return null
  }
}

function writeAnswer(res: { status: number; body: Record<string, unknown> } | null): ReceiptWriteAnswer {
  if (!res) return { ok: false, why: 'signal' }
  if (res.status === 200 && res.body.ok === true && isRecord(res.body.charge)) return { ok: true, charge: res.body.charge as unknown as ReceiptPageCharge, kept: res.body.kept === true }
  return { ok: false, why: 'refused', words: words(res.body, RECEIPT_LINK_WORDS.failed) }
}

export const receiptLinkIo: ReceiptLinkIo = {
  async read(code) {
    let res: Response
    try {
      res = await fetch(`${FUNCTION_URL}?code=${encodeURIComponent(code)}`, { headers: await publicFunctionHeaders(null) })
    } catch {
      return { kind: 'signal' }
    }
    const parsed: unknown = await res.json().catch(() => null)
    const body = isRecord(parsed) ? parsed : {}
    if (res.status === 200 && body.ok === true && Array.isArray(body.charges)) return { kind: 'open', charges: body.charges as ReceiptPageCharge[], closesOn: typeof body.closesOn === 'string' ? body.closesOn : null }
    if (res.status === 410) return { kind: 'closed' }
    if (res.status === 404) return { kind: 'not_found' }
    if (res.status === 429 && body.code === 'locked') return { kind: 'locked' }
    return { kind: 'failed', words: words(body, 'That did not go through. Try again, or ask the office.') }
  },
  async addPage(code, input) {
    let data: string
    try {
      data = await blobToBase64(input.blob)
    } catch {
      return { ok: false, why: 'refused', words: RECEIPT_LINK_WORDS.notAPicture }
    }
    return writeAnswer(await post({ code, action: 'page', charge: input.charge, pageId: input.pageId, data, width: input.width, height: input.height, originalBytes: input.originalBytes, job: input.job, replace: input.replace }))
  },
  async setJob(code, charge, job) {
    return writeAnswer(await post({ code, action: 'job', charge, job }))
  },
  pageUrl(code, pageId) {
    // No key in the address: the function takes the code alone (`verify_jwt = false`), as the box page's photo does.
    return `${FUNCTION_URL}?code=${encodeURIComponent(code)}&page=${encodeURIComponent(pageId)}`
  },
}

/** The office's Copy the receipt link: the charge's request, made on the first ask, and a new code. Throws with the reason. */
export async function mintReceiptLink(chargeId: string): Promise<{ code: string; closesOn: string | null }> {
  let status = 0
  let body: Record<string, unknown> = {}
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token ?? ''
    const res = await fetch(FUNCTION_URL, { method: 'POST', headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'desk.mint', chargeId }) })
    status = res.status
    const parsed: unknown = await res.json().catch(() => null)
    if (isRecord(parsed)) body = parsed
  } catch {
    throw new Error('No signal. Check the connection and try again.')
  }
  if (status === 200 && body.ok === true && typeof body.code === 'string') return { code: body.code, closesOn: typeof body.closesOn === 'string' ? body.closesOn : null }
  throw new Error(words(body, `The receipt link was not made. The function answered ${status}.`))
}

/**
 * Make the charge's receipt link and put it on the clipboard. Safari lets a page write the clipboard only inside the
 * press itself, and the link is not there until the function answers, so the clipboard is handed a promise of the
 * words (a `ClipboardItem`), which every browser that has one waits on. A browser without one copies after the answer.
 * `copied` is false when the browser refused both, and the caller shows the link to copy by hand. Throws with the
 * reason when the link was not made. On a local copy the link is the local address, so a walk opens the local page.
 */
export async function copyReceiptLinkFor(chargeId: string): Promise<{ url: string; closesOn: string | null; copied: boolean }> {
  const local = typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)
  const made = mintReceiptLink(chargeId).then((m) => ({ url: local ? receiptLinkUrl(m.code, window.location.origin) : receiptLinkUrl(m.code), closesOn: m.closesOn }))
  let copied = false
  const Item = typeof window !== 'undefined' ? (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem : undefined
  if (Item && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([new Item({ 'text/plain': made.then((m) => new Blob([m.url], { type: 'text/plain' })) })])
      copied = true
    } catch {
      // The plain write below, once the link is there.
    }
  }
  const out = await made
  if (!copied) {
    try {
      await navigator.clipboard.writeText(out.url)
      copied = true
    } catch {
      copied = false
    }
  }
  return { ...out, copied }
}
