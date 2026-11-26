/**
 * The doors of a painted map's link (punch list #345, PR 4): the `painted-map-link` function by the
 * link's code, with no sign-in, and Share a link, signed in. The page and the sheet are handed
 * these, so their render tests hand them fakes. Browser io, not pure.
 */
import { publicFunctionHeaders } from '../customerSampleMode'
import { supabase } from '../supabase'
import { formatErrorMessage } from '../../utils/errorHandling'
import { PAINTED_MAP_LINK_WORDS, mintPaintedMapLinkCode, type PaintedMapLinkRow, type PaintedMapVisitRow, type SharedPaintedMap } from './paintedMapLink'

// The deployed build's address ends in a slash, the local one does not: both read the same here.
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/+$/, '')
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
const FUNCTION_URL = `${supabaseUrl}/functions/v1/painted-map-link`

/** What a link opens on. `signal` is a request that never got an answer. */
export type PaintedWayView =
  | { kind: 'open'; map: SharedPaintedMap; company: { name: string; phone: string }; endsOn: string | null; visitor?: { name: string; signedIn: boolean } | null }
  /** This device has given no name on this link: the page asks for one, knowing only the map's name and who sent it. */
  | { kind: 'name'; mapName: string; company: { name: string; phone: string }; endsOn: string | null }
  | { kind: 'gone' }
  | { kind: 'locked' }
  | { kind: 'signal' }
  | { kind: 'failed'; words: string }

/** What the page says of the reader when it opens a link: the name, when one is known, and the device. */
export type PaintedWayAsk = { name: string | null; device: { id: string; screen: string; language: string; timeZone: string } }

export interface PaintedWayIo {
  /** Open the link as this reader. With no name known for the device, the answer is the ask for one. */
  open(code: string, ask: PaintedWayAsk): Promise<PaintedWayView>
  /** Where the reader is, after they pressed Show where I am. Best effort: `false` when it was not kept. */
  here(code: string, deviceId: string, point: { lat: number; lng: number; accuracyM: number | null }): Promise<boolean>
  /** The address of one place's photo. It carries the code and this device's id: a photo opens for a device that gave a name. */
  photoUrl(code: string, placeId: string, deviceId?: string | null): string
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

/** A signed-in teammate's session, so the function names them from their account. Everyone else goes as the public does. */
async function readerHeaders(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (token) return { apikey: anonKey, Authorization: `Bearer ${token}` }
  } catch {
    // No session to read: the public's headers.
  }
  return publicFunctionHeaders(null)
}
const words = (body: Record<string, unknown>, fallback: string): string => (typeof body.words === 'string' && body.words ? body.words : typeof body.error === 'string' && body.error && !/^[a-z_]+$/.test(body.error) ? body.error : fallback)

export const paintedWayIo: PaintedWayIo = {
  async open(code, ask) {
    let res: Response
    try {
      res = await fetch(FUNCTION_URL, { method: 'POST', headers: { ...(await readerHeaders()), 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'way.open', code, name: ask.name, device: ask.device }) })
    } catch {
      return { kind: 'signal' }
    }
    const parsed: unknown = await res.json().catch(() => null)
    const body = isRecord(parsed) ? parsed : {}
    const sent = isRecord(body.company) ? body.company : {}
    const company = { name: typeof sent.name === 'string' ? sent.name : '', phone: typeof sent.phone === 'string' ? sent.phone : '' }
    const endsOn = typeof body.endsOn === 'string' ? body.endsOn : null
    if (res.status === 200 && body.ok === true && isRecord(body.map)) {
      const who = isRecord(body.visitor) && typeof body.visitor.name === 'string' ? { name: body.visitor.name, signedIn: body.visitor.signedIn === true } : null
      return { kind: 'open', map: body.map as unknown as SharedPaintedMap, company, endsOn, visitor: who }
    }
    if (res.status === 200 && body.ok === true && body.needsName === true) return { kind: 'name', mapName: typeof body.mapName === 'string' ? body.mapName : '', company, endsOn }
    if (res.status === 404) return { kind: 'gone' }
    if (res.status === 429 && body.code === 'locked') return { kind: 'locked' }
    return { kind: 'failed', words: words(body, PAINTED_MAP_LINK_WORDS.failed) }
  },
  async here(code, deviceId, point) {
    try {
      const res = await fetch(FUNCTION_URL, { method: 'POST', headers: { ...(await readerHeaders()), 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'way.here', code, deviceId, lat: point.lat, lng: point.lng, accuracyM: point.accuracyM }) })
      const parsed: unknown = await res.json().catch(() => null)
      return res.status === 200 && isRecord(parsed) && parsed.kept === true
    } catch {
      return false
    }
  },
  photoUrl(code, placeId, deviceId) {
    return `${FUNCTION_URL}?code=${encodeURIComponent(code)}&photo=${encodeURIComponent(placeId)}${deviceId ? `&device=${encodeURIComponent(deviceId)}` : ''}`
  },
}

/** The signed-in session's token, or none: the function then says who may share. */
async function sessionToken(): Promise<string> {
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? ''
  } catch {
    // No session: the function says so.
    return ''
  }
}

/** One ask of the function as the signed-in person. `keepalive` lets it finish after the phone has left for another app. */
function post(token: string, body: Record<string, unknown>, keepalive = false): Promise<Response> {
  return fetch(FUNCTION_URL, { method: 'POST', keepalive, headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

async function desk(body: Record<string, unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
  let res: Response
  try {
    res = await post(await sessionToken(), body)
  } catch {
    throw new Error('No signal. Check the connection and try again.')
  }
  const parsed: unknown = await res.json().catch(() => null)
  return { status: res.status, body: isRecord(parsed) ? parsed : {} }
}

/**
 * The session as it was read when the sheet last asked whether a link can be made. Reading it takes a
 * moment, and a press has none to spare: with this at hand, the ask for a link leaves inside the press.
 */
let atHand: { token: string; at: number } | null = null
const AT_HAND_FOR_MS = 10 * 60_000
const NO_SIGNAL = 'No signal. Check the connection and try again.'

/** Ten letters this phone picks (punch list #394, step 3), so a link's address is known before the server answers. */
export function pickPaintedMapLinkCode(): string {
  return mintPaintedMapLinkCode((n) => crypto.getRandomValues(new Uint8Array(n)))
}

/**
 * Whether a link could be made for the map now. Nothing is written. The sheet asks on opening, and hands a
 * text to the phone at once only on a yes: a text is never written around a link the server would refuse.
 * False for a refusal, a lost signal, and a function from before the question existed.
 */
export async function canMakePaintedMapLink(mapId: string): Promise<boolean> {
  try {
    const token = await sessionToken()
    atHand = token ? { token, at: Date.now() } : null
    const res = await post(token, { action: 'desk.can', mapId })
    const parsed: unknown = await res.json().catch(() => null)
    return res.status === 200 && isRecord(parsed) && parsed.ok === true
  } catch {
    return false
  }
}

/**
 * Share a link whose code this phone picked. Not an `async` function on purpose: with the session at hand
 * the ask is on its way before this returns, so it has left the phone before the phone leaves for Messages,
 * and `keepalive` lets it finish there. A lost signal gets one more try, and the function answers a second
 * ask for the same code as it did the first. The code in the answer is the phone's own. A function from
 * before this step makes its own code and hands it back, and that one is the link then.
 * Throws with the reason in words.
 */
export function registerPaintedMapLink(mapId: string, code: string): Promise<{ code: string; endsOn: string | null }> {
  const body = { action: 'desk.mint', mapId, code }
  const token = atHand && Date.now() - atHand.at < AT_HAND_FOR_MS ? atHand.token : null
  const first = token ? post(token, body, true) : sessionToken().then((t) => post(t, body, true))
  return first
    .catch(async () => {
      await new Promise((r) => setTimeout(r, 800))
      return post(await sessionToken(), body, true)
    })
    .then(
      async (res) => {
        const parsed: unknown = await res.json().catch(() => null)
        const answer = isRecord(parsed) ? parsed : {}
        if (res.status === 200 && answer.ok === true) {
          const endsOn = typeof answer.endsOn === 'string' ? answer.endsOn : null
          if (typeof answer.code === 'string') return { code: answer.code, endsOn }
          if (answer.kept === true) return { code, endsOn }
        }
        throw new Error(words(answer, `The link was not made. The function answered ${res.status}.`))
      },
      () => {
        throw new Error(NO_SIGNAL)
      },
    )
}

/** End this link now: one link, or every open link of the map. How many were ended. Throws with the reason in words. */
export async function endPaintedMapLinks(mapId: string, linkId?: string | null): Promise<number> {
  const res = await desk({ action: 'desk.end', mapId, ...(linkId ? { linkId } : {}) })
  if (res.status === 200 && res.body.ok === true) return typeof res.body.ended === 'number' ? res.body.ended : 0
  throw new Error(words(res.body, `The link was not ended. The function answered ${res.status}.`))
}

/**
 * Reopen one ended link (punch list #443, row 14): a dev's take-back of End this link now, on a test map alone. The
 * function holds every rule itself and refuses in its own words; the sheet runs the same rule first
 * (`paintedMapLinkReopen.ts`). Answers the day the link ends on.
 */
export async function reopenPaintedMapLink(mapId: string, linkId: string): Promise<{ endsOn: string | null }> {
  const res = await desk({ action: 'desk.reopen', mapId, linkId })
  if (res.status === 200 && res.body.ok === true) return { endsOn: typeof res.body.endsOn === 'string' ? res.body.endsOn : null }
  throw new Error(words(res.body, `The link was not reopened. The function answered ${res.status}.`))
}

/** The most visits the sheet lists. Past it the latest are shown. */
export const PAINTED_MAP_VISITS_MAX = 50

/**
 * Who opened the map's links, latest first. Row security hands these to the office and the map's painter and to
 * nobody else, so anyone else reads an empty list: the sheet then says nothing about who.
 */
export async function loadPaintedMapVisits(mapId: string): Promise<{ ok: true; value: PaintedMapVisitRow[] } | { ok: false; error: string }> {
  try {
    const res = (await supabase
      .from('painted_map_link_visits' as never)
      .select('id, visitor_name, user_id, device_words, last_opened_at, open_count, first_lat, first_lng, first_located_at, first_accuracy_m, last_lat, last_lng, last_located_at, last_accuracy_m' as '*')
      .eq('map_id' as never, mapId)
      .order('last_opened_at' as never, { ascending: false })
      .limit(PAINTED_MAP_VISITS_MAX)) as unknown as { data: PaintedMapVisitRow[] | null; error: unknown }
    if (res.error) return { ok: false, error: formatErrorMessage(res.error, 'Who opened the link did not load.') }
    return { ok: true, value: res.data ?? [] }
  } catch (e) {
    return { ok: false, error: formatErrorMessage(e, 'Who opened the link did not load.') }
  }
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
