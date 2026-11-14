/**
 * The doors of a painted map's link (punch list #345, PR 4): the `painted-map-link` function by the
 * link's code, with no sign-in, and Share a link, signed in. The page and the sheet are handed
 * these, so their render tests hand them fakes. Browser io, not pure.
 */
import { publicFunctionHeaders } from '../customerSampleMode'
import { supabase } from '../supabase'
import { formatErrorMessage } from '../../utils/errorHandling'
import { PAINTED_MAP_LINK_WORDS, type PaintedMapLinkRow, type SharedPaintedMap } from './paintedMapLink'

// The deployed build's address ends in a slash, the local one does not: both read the same here.
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/+$/, '')
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
const FUNCTION_URL = `${supabaseUrl}/functions/v1/painted-map-link`

/** What a link opens on. `signal` is a request that never got an answer. */
export type PaintedWayView =
  | { kind: 'open'; map: SharedPaintedMap; company: { name: string; phone: string }; endsOn: string | null }
  | { kind: 'gone' }
  | { kind: 'locked' }
  | { kind: 'signal' }
  | { kind: 'failed'; words: string }

export interface PaintedWayIo {
  read(code: string): Promise<PaintedWayView>
  /** The address of one place's photo. No key in it: the function takes the code alone. */
  photoUrl(code: string, placeId: string): string
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const words = (body: Record<string, unknown>, fallback: string): string => (typeof body.words === 'string' && body.words ? body.words : typeof body.error === 'string' && body.error && !/^[a-z_]+$/.test(body.error) ? body.error : fallback)

export const paintedWayIo: PaintedWayIo = {
  async read(code) {
    let res: Response
    try {
      res = await fetch(`${FUNCTION_URL}?code=${encodeURIComponent(code)}`, { headers: await publicFunctionHeaders(null) })
    } catch {
      return { kind: 'signal' }
    }
    const parsed: unknown = await res.json().catch(() => null)
    const body = isRecord(parsed) ? parsed : {}
    if (res.status === 200 && body.ok === true && isRecord(body.map)) {
      const company = isRecord(body.company) ? body.company : {}
      return { kind: 'open', map: body.map as unknown as SharedPaintedMap, company: { name: typeof company.name === 'string' ? company.name : '', phone: typeof company.phone === 'string' ? company.phone : '' }, endsOn: typeof body.endsOn === 'string' ? body.endsOn : null }
    }
    if (res.status === 404) return { kind: 'gone' }
    if (res.status === 429 && body.code === 'locked') return { kind: 'locked' }
    return { kind: 'failed', words: words(body, PAINTED_MAP_LINK_WORDS.failed) }
  },
  photoUrl(code, placeId) {
    return `${FUNCTION_URL}?code=${encodeURIComponent(code)}&photo=${encodeURIComponent(placeId)}`
  },
}

async function desk(body: Record<string, unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
  let token = ''
  try {
    const { data } = await supabase.auth.getSession()
    token = data.session?.access_token ?? ''
  } catch {
    // No session: the function says so.
  }
  let res: Response
  try {
    res = await fetch(FUNCTION_URL, { method: 'POST', headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  } catch {
    throw new Error('No signal. Check the connection and try again.')
  }
  const parsed: unknown = await res.json().catch(() => null)
  return { status: res.status, body: isRecord(parsed) ? parsed : {} }
}

/** Share a link: a new code for the map, handed out once. Throws with the reason in words. */
export async function mintPaintedMapLink(mapId: string): Promise<{ code: string; endsOn: string | null }> {
  const res = await desk({ action: 'desk.mint', mapId })
  if (res.status === 200 && res.body.ok === true && typeof res.body.code === 'string') return { code: res.body.code, endsOn: typeof res.body.endsOn === 'string' ? res.body.endsOn : null }
  throw new Error(words(res.body, `The link was not made. The function answered ${res.status}.`))
}

/** End this link now: one link, or every open link of the map. How many were ended. Throws with the reason in words. */
export async function endPaintedMapLinks(mapId: string, linkId?: string | null): Promise<number> {
  const res = await desk({ action: 'desk.end', mapId, ...(linkId ? { linkId } : {}) })
  if (res.status === 200 && res.body.ok === true) return typeof res.body.ended === 'number' ? res.body.ended : 0
  throw new Error(words(res.body, `The link was not ended. The function answered ${res.status}.`))
}

/** The map's links as the table holds them: when each was made, when it ends, how often it was opened. No code is in a row. */
export async function loadPaintedMapLinks(mapId: string): Promise<{ ok: true; value: PaintedMapLinkRow[] } | { ok: false; error: string }> {
  try {
    const res = (await supabase
      .from('painted_map_links' as never)
      .select('id,made_at,expires_at,ended_at,open_count' as '*')
      .eq('map_id' as never, mapId)
      .order('made_at' as never, { ascending: false })) as unknown as { data: PaintedMapLinkRow[] | null; error: { message: string } | null }
    if (res.error) return { ok: false, error: formatErrorMessage(res.error, 'The map’s links did not load.') }
    return { ok: true, value: res.data ?? [] }
  } catch (e) {
    return { ok: false, error: formatErrorMessage(e, 'The map’s links did not load.') }
  }
}

/**
 * The link this device made for a map, kept so the sheet can show it again. The code is handed out
 * once and the table keeps only its hash, so this device's own copy is the one place it can be read
 * back from. It is forgotten when the link is ended from here.
 */
const rememberKey = (mapId: string) => `pipetooling-painted-map-link:${mapId}`
export function rememberPaintedMapLink(mapId: string, link: { code: string; endsOn: string | null } | null): void {
  try {
    if (link) window.localStorage.setItem(rememberKey(mapId), JSON.stringify(link))
    else window.localStorage.removeItem(rememberKey(mapId))
  } catch {
    // A private window: the link is shown this once.
  }
}
export function rememberedPaintedMapLink(mapId: string): { code: string; endsOn: string | null } | null {
  try {
    const raw = window.localStorage.getItem(rememberKey(mapId))
    const kept = raw ? (JSON.parse(raw) as { code?: unknown; endsOn?: unknown }) : null
    return kept && typeof kept.code === 'string' ? { code: kept.code, endsOn: typeof kept.endsOn === 'string' ? kept.endsOn : null } : null
  } catch {
    return null
  }
}
