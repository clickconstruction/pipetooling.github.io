/**
 * The doors of the Document builder's link (punch list #404, steps 4 and 8): the `document-builder-link` function by
 * the link's code, with no sign-in, and the dev's own presses, signed in. The page and the builder are handed these,
 * so their render tests hand them fakes. Browser io, not pure.
 */
import { staffAwarePublicHeaders } from '../publicFunctionStaffHeaders'
import { supabase } from '../supabase'
import type { Landed } from './documentBuildersIo'
import { DOCUMENT_BUILDER_LINK_WORDS, documentBuilderLinkDevice, documentBuilderLinkEndedWhy, type DocumentBuilderLinkOpen, type DocumentBuilderLinkState } from './link'
import { parseResolvedSheet, type ResolvedSheet } from './sheet'

// The deployed build's address ends in a slash, the local one does not: both read the same here.
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/+$/, '')
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
const FUNCTION_URL = `${supabaseUrl}/functions/v1/document-builder-link`

/** What a link opens on. `signal` is a request that never got an answer. */
export type BuilderLinkView =
  | { kind: 'sheet'; sheet: ResolvedSheet; revision: number; job: string }
  | { kind: 'builder'; builder: string; revision: number; contents: unknown }
  | { kind: 'gone'; words: string }
  | { kind: 'signal' }
  | { kind: 'failed'; words: string }

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const wordsOf = (body: unknown, fallback: string): string => {
  if (!isRecord(body)) return fallback
  if (typeof body.words === 'string' && body.words) return body.words
  return typeof body.error === 'string' && body.error && !/^[a-z_]+$/.test(body.error) ? body.error : fallback
}

/**
 * What the page reports about its device with an open: the browser's language, time zone, screen and platform, and
 * whether it is a touch screen. Each is something the browser tells every site. Nothing is drawn, measured or stored
 * to tell one device from another. A browser that hides one leaves it out.
 */
export function linkDeviceOf(env: { language?: unknown; timeZone?: unknown; screenWidth?: unknown; screenHeight?: unknown; platform?: unknown; touchPoints?: unknown }): Record<string, string> {
  const screen = typeof env.screenWidth === 'number' && typeof env.screenHeight === 'number' && env.screenWidth > 0 && env.screenHeight > 0 ? `${Math.round(env.screenWidth)}x${Math.round(env.screenHeight)}` : undefined
  const touch = typeof env.touchPoints === 'number' ? (env.touchPoints > 0 ? 'yes' : 'no') : undefined
  return documentBuilderLinkDevice({ language: env.language, timeZone: env.timeZone, screen, platform: env.platform, touch })
}

function deviceNow(): Record<string, string> {
  try {
    return linkDeviceOf({
      language: navigator.language,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screenWidth: window.screen?.width,
      screenHeight: window.screen?.height,
      platform: navigator.platform,
      touchPoints: navigator.maxTouchPoints,
    })
  } catch {
    return {}
  }
}

/**
 * Open a link by its code, as whoever holds it. A teammate's session rides along so their look is not counted, and
 * so the open is kept under their account. The device's few details ride along for someone with no account.
 */
export async function openBuilderLink(code: string): Promise<BuilderLinkView> {
  let res: Response
  try {
    res = await fetch(FUNCTION_URL, { method: 'POST', headers: { ...(await staffAwarePublicHeaders()), 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'open', code, device: deviceNow() }) })
  } catch {
    return { kind: 'signal' }
  }
  const body: unknown = await res.json().catch(() => null)
  if (res.status === 404) return { kind: 'gone', words: wordsOf(body, DOCUMENT_BUILDER_LINK_WORDS.gone) }
  if (!res.ok || !isRecord(body)) return { kind: 'failed', words: wordsOf(body, DOCUMENT_BUILDER_LINK_WORDS.failed) }
  const revision = typeof body.revision === 'number' ? body.revision : 0
  if (body.kind === 'sheet') {
    const sheet = parseResolvedSheet(body.sheet)
    return sheet ? { kind: 'sheet', sheet, revision, job: typeof body.job === 'string' ? body.job : '' } : { kind: 'failed', words: DOCUMENT_BUILDER_LINK_WORDS.failed }
  }
  if (body.kind === 'builder' && typeof body.builder === 'string') return { kind: 'builder', builder: body.builder, revision, contents: body.contents }
  return { kind: 'failed', words: DOCUMENT_BUILDER_LINK_WORDS.failed }
}

/** One open as the function hands it. A row that is not one is left out. */
function openFrom(raw: unknown): DocumentBuilderLinkOpen | null {
  if (!isRecord(raw) || typeof raw.at !== 'string' || !raw.at) return null
  const text = (v: unknown) => (typeof v === 'string' && v ? v : null)
  return { at: raw.at, viewer: raw.viewer === 'staff' || raw.viewer === 'preview' ? raw.viewer : 'outside', name: text(raw.name), ip: text(raw.ip), agent: text(raw.agent), device: documentBuilderLinkDevice(raw.device) }
}

/** Who opened the link, when the function says: an older function says nothing, and the card then shows no list. */
function historyFrom(raw: Record<string, unknown>): { opens?: DocumentBuilderLinkOpen[]; opensTotal?: number } {
  if (!Array.isArray(raw.opens)) return {}
  const opens = raw.opens.map(openFrom).filter((o): o is DocumentBuilderLinkOpen => o != null)
  return { opens, opensTotal: typeof raw.opensTotal === 'number' && raw.opensTotal >= opens.length ? raw.opensTotal : opens.length }
}

export function stateFrom(raw: unknown): DocumentBuilderLinkState | null {
  if (!isRecord(raw)) return null
  if (raw.on === false) return { on: false, endedAt: typeof raw.endedAt === 'string' ? raw.endedAt : null, endedWhy: documentBuilderLinkEndedWhy(raw.endedWhy), ...historyFrom(raw) }
  if (raw.on === true && (typeof raw.code === 'string' || raw.code === null) && typeof raw.madeAt === 'string') {
    return { on: true, code: raw.code, madeAt: raw.madeAt, opened: typeof raw.opened === 'number' ? raw.opened : 0, lastOpenedAt: typeof raw.lastOpenedAt === 'string' ? raw.lastOpenedAt : null, ...historyFrom(raw) }
  }
  return null
}

/** One of the dev's presses: read the link, make a new one (the old one stops), or switch it off. */
async function desk(action: 'desk.state' | 'desk.mint' | 'desk.end', builderKey: string, sheetId: string | null): Promise<Landed<DocumentBuilderLinkState>> {
  let token: string | null = null
  try {
    token = (await supabase.auth.getSession()).data.session?.access_token ?? null
  } catch {
    token = null
  }
  if (!token) return { ok: false, error: DOCUMENT_BUILDER_LINK_WORDS.notYours }
  let res: Response
  try {
    res = await fetch(FUNCTION_URL, { method: 'POST', headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action, builderKey, sheetId }) })
  } catch {
    return { ok: false, error: 'Could not reach the app. Check your signal, then try again.' }
  }
  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) return { ok: false, error: wordsOf(body, DOCUMENT_BUILDER_LINK_WORDS.failed) }
  const state = stateFrom(isRecord(body) ? body.link : null)
  return state ? { ok: true, value: state } : { ok: false, error: DOCUMENT_BUILDER_LINK_WORDS.failed }
}

export const readBuilderLink = (builderKey: string, sheetId: string | null) => desk('desk.state', builderKey, sheetId)
export const makeBuilderLink = (builderKey: string, sheetId: string | null) => desk('desk.mint', builderKey, sheetId)
export const endBuilderLink = (builderKey: string, sheetId: string | null) => desk('desk.end', builderKey, sheetId)
