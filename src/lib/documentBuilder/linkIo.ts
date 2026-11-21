/**
 * The doors of the Document builder's link (punch list #404, steps 4 and 8): the `document-builder-link` function by
 * the link's code, with no sign-in, and the dev's own presses, signed in. The page and the builder are handed these,
 * so their render tests hand them fakes. Browser io, not pure.
 */
import { staffAwarePublicHeaders } from '../publicFunctionStaffHeaders'
import { supabase } from '../supabase'
import type { Landed } from './documentBuildersIo'
import { DOCUMENT_BUILDER_LINK_WORDS, type DocumentBuilderLinkState } from './link'
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

/** Open a link by its code, as whoever holds it. A teammate's session rides along so their look is not counted. */
export async function openBuilderLink(code: string): Promise<BuilderLinkView> {
  let res: Response
  try {
    res = await fetch(FUNCTION_URL, { method: 'POST', headers: { ...(await staffAwarePublicHeaders()), 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'open', code }) })
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

function stateFrom(raw: unknown): DocumentBuilderLinkState | null {
  if (!isRecord(raw)) return null
  if (raw.on === false) return { on: false }
  if (raw.on === true && (typeof raw.code === 'string' || raw.code === null) && typeof raw.madeAt === 'string') {
    return { on: true, code: raw.code, madeAt: raw.madeAt, opened: typeof raw.opened === 'number' ? raw.opened : 0, lastOpenedAt: typeof raw.lastOpenedAt === 'string' ? raw.lastOpenedAt : null }
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
