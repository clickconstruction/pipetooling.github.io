// dev-mcp's plan_twin_seat / apply_twin_seat (v2.7974 / 0.117.0): a twin's seat in CountTooling or TakeoffTooling made
// again when the first try was held, as the link button on the twin's row does at Settings → System → Digital twins
// (DigitalTwinsPanel.retryCtSeat / retryTtSeat). A twin is made in three apps: its account here, then a seat in each
// of the other two over ct-bridge and tt-bridge. Either bridge call can fail and the twin still stands, with that
// seat held. The retry is the bridge's own create, called as the dev, idempotent there: a seat that exists is found,
// never made twice. The CountTooling seat's id is then saved on the twin's users row, the join key twin-mcp signs in
// by; TakeoffTooling has no join key here and is found by its address.
// No new RPC and no dry-run wrapper: the dry run is the server's own read of the twin as the dev, with the
// TakeoffTooling seat looked up over tt-bridge as the panel looks it up. The plan hash commits to the twin and to
// where each seat stands, never to a bridge's words for why a lookup failed, so a seat linked since the plan refuses
// the apply. There is nothing to undo: a seat is an account in the other app, and neither bridge call here takes one
// away. Pure: no network, no env. Tests: src/lib/devMcp/devMcpTwinSeat.test.ts.

import { TWIN_PANEL_DOOR } from './devMcpTwin.ts'
import { twinRef } from './devMcpTwinKey.ts'
import { ctTwinSeatEmail, ttTwinSeatEmail } from './twinSeat.ts'

type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)

export const TWIN_SEAT_VERBS = ['plan_twin_seat', 'apply_twin_seat'] as const
export type TwinSeatVerb = (typeof TWIN_SEAT_VERBS)[number]
export function isTwinSeatVerb(verb: string): verb is TwinSeatVerb {
  return (TWIN_SEAT_VERBS as readonly string[]).includes(verb)
}

/** The two other apps a bid robot holds a seat in, in the order a twin is made. */
export const TWIN_SEAT_APPS = ['counttooling', 'takeofftooling'] as const
export type TwinSeatApp = (typeof TWIN_SEAT_APPS)[number]
export const TWIN_SEAT_APP_WORDS: Record<TwinSeatApp, string> = { counttooling: 'CountTooling', takeofftooling: 'TakeoffTooling' }
const isSeatApp = (v: unknown): v is TwinSeatApp => typeof v === 'string' && (TWIN_SEAT_APPS as readonly string[]).includes(v)

/** What a seat verb carries after the shape check: the twin, and one app when the ask names one. */
export type TwinSeatPayload = { twin: string; app?: TwinSeatApp }
export type TwinSeatInput = { ok: true; p: TwinSeatPayload; target: string } | { ok: false; error: string }

/** The ask's shape, refused in words: a twin, one of the two apps or neither, and no other key. */
export function twinSeatInput(verb: TwinSeatVerb, input: Json): TwinSeatInput {
  const seat = obj(input.seat)
  const shape = `${verb} needs seat — { twin (the twin's users.id or its address, twin-estimator-N@twins.pipetooling.local), and app when one seat alone is meant: "counttooling" or "takeofftooling" (left out, every seat of the twin that is held) }. plan_twin lists the fleet.`
  if (!seat) return { ok: false, error: shape }
  const twin = twinRef(seat.twin)
  if (!twin) return { ok: false, error: shape }
  if (seat.app !== undefined && !isSeatApp(seat.app)) return { ok: false, error: shape }
  const extra = Object.keys(seat).filter((k) => k !== 'twin' && k !== 'app')
  if (extra.length) return { ok: false, error: `${verb}: seat takes twin and app alone, not ${extra.join(', ')}. A seat's address and name are the fleet's to give, never yours.` }
  return { ok: true, p: seat.app ? { twin, app: seat.app } : { twin }, target: twin }
}

/** The columns the server reads of the twin: who it is, and the CountTooling seat's join key. */
export const TWIN_SEAT_TWIN_SELECT = 'id,name,email,twin_kind,archived_at,counttooling_user_id'
export type TwinSeatTwinRow = { id: string; name: string | null; email: string; twin_kind: string | null; archived_at: string | null; counttooling_user_id: string | null }

/** The apps a plan looks at: the one the ask names, or both. */
export function twinSeatAppsAsked(p: TwinSeatPayload): TwinSeatApp[] {
  return p.app ? [p.app] : [...TWIN_SEAT_APPS]
}

/** tt-bridge's body to look a seat up by its address: the panel's own. */
export function twinSeatLookupBody(email: string): Json {
  return { verb: 'lookup', email }
}

/** Where the TakeoffTooling seat stands, off tt-bridge's lookup. `unread` is a bridge that did not answer: never held, never linked. */
export type TtSeatLookup = { state: 'linked'; tt_user_id: string } | { state: 'held' } | { state: 'unread'; why: string }

/**
 * The panel's own reading of tt-bridge's lookup (DigitalTwinsPanel.loadAll): a failed call is a bridge it could not
 * read; a seat that is found and flagged a twin is linked; anything else is held. The reason a failed call carries is
 * its status and the reply's own words (v2.8046): tt-bridge's refusals say `error`, and a reply it passes on from
 * TakeoffTooling or its gateway may say `message` or `msg` instead, which the status alone hid.
 */
export function ttSeatLookup(r: { ok: boolean; status: number; body: unknown }): TtSeatLookup {
  const b = obj(r.body)
  if (!r.ok) {
    const words = [b?.error, b?.message, b?.msg].find((w): w is string => typeof w === 'string' && w.trim() !== '')
    return { state: 'unread', why: `tt-bridge answered ${r.status}${words ? `: ${words.trim().slice(0, 300)}` : ''}` }
  }
  if (b?.found && b.is_digital_twin) return { state: 'linked', tt_user_id: typeof b.tt_user_id === 'string' && b.tt_user_id ? b.tt_user_id : 'linked' }
  return { state: 'held' }
}

const nameOf = (t: Pick<TwinSeatTwinRow, 'name' | 'email'>): string => (t.name ?? '').trim() || t.email
const twinFactsOf = (t: TwinSeatTwinRow): Json => ({ id: t.id, email: t.email, name: t.name, kind: 'estimator' })

export type TwinSeatDryRun = { ok: true; reply: Json; twin: TwinSeatTwinRow; retry: TwinSeatApp[] } | { ok: false; refused: string }

/**
 * The dry run: the twin, where each seat the ask names stands, and the ones apply would make again. `tt` is the
 * lookup of the TakeoffTooling seat, null when the ask does not name that app. No such twin, an archived twin, a
 * pricing robot and a twin with nothing held are each refused in words.
 */
export function twinSeatDryRun(p: TwinSeatPayload, twin: TwinSeatTwinRow | null, tt: TtSeatLookup | null): TwinSeatDryRun {
  if (!twin) return { ok: false, refused: `No twin reads as ${p.twin}. plan_twin lists the fleet.` }
  if (twin.archived_at) return { ok: false, refused: `Nothing to plan: ${twin.email} is archived. plan_twin_archive with restore: true brings it back first.` }
  if (twin.twin_kind === 'pricer') return { ok: false, refused: `Nothing to plan: ${twin.email} is the pricing robot. It prices quotes and holds no bids, so it has no seat in CountTooling or TakeoffTooling.` }
  const asked = twinSeatAppsAsked(p)
  const seats: Json = {}
  const retry: TwinSeatApp[] = []
  const warnings: string[] = []
  if (asked.includes('counttooling')) {
    const linked = Boolean(twin.counttooling_user_id)
    seats.counttooling = { email: ctTwinSeatEmail(twin.email), state: linked ? 'linked' : 'held', ...(linked ? { ct_user_id: twin.counttooling_user_id } : {}) }
    if (!linked) retry.push('counttooling')
  }
  if (asked.includes('takeofftooling')) {
    const look: TtSeatLookup = tt ?? { state: 'unread', why: 'the lookup was not made' }
    seats.takeofftooling = { email: ttTwinSeatEmail(twin.email), state: look.state === 'unread' ? 'could not be read' : look.state, ...(look.state === 'linked' ? { tt_user_id: look.tt_user_id } : {}) }
    if (look.state !== 'linked') retry.push('takeofftooling')
    if (look.state === 'unread') warnings.push(`The TakeoffTooling seat could not be looked up (${look.why}), so the plan cannot say it is held. The create is idempotent there: a seat that exists is found, never made twice. If the bridge is down, the create is refused the same way.`)
  }
  if (retry.length === 0) {
    const which = asked.length === 1 ? `its ${TWIN_SEAT_APP_WORDS[asked[0]!]} seat is` : 'its CountTooling and TakeoffTooling seats are'
    return { ok: false, refused: `Nothing to plan: ${which} linked already on ${twin.email}.` }
  }
  const parts = retry.map((app) =>
    app === 'counttooling'
      ? "makes its CountTooling seat through ct-bridge and saves the seat's id on the twin's users row, the join key the twin seat signs in to CountTooling by"
      : 'makes its TakeoffTooling seat through tt-bridge, which is found by its address and has no join key here',
  )
  return {
    ok: true,
    twin,
    retry,
    reply: {
      dry_run: true,
      twin: twinFactsOf(twin),
      seats,
      retry,
      ...(warnings.length ? { warnings } : {}),
      then: `apply ${parts.join(', then ')}, each as you, as the link button on the twin's row at ${TWIN_PANEL_DOOR} does. Each bridge's create is idempotent: a seat that exists there is found, never made twice. Each is reported done or held with the bridge's own reason, and one that fails does not stop the other. Nothing else changes: no key, no rung, and nothing here takes a seat away.`,
    },
  }
}

/** The users write that saves the CountTooling seat's id: the panel's own column. */
export function twinSeatLinkPatch(ctUserId: string): Json {
  return { counttooling_user_id: ctUserId }
}

/** The users filter that write is held to: this row, still a twin. */
export function twinSeatLinkQuery(twin: Pick<TwinSeatTwinRow, 'id'>): string {
  return `id=eq.${twin.id}&is_digital_twin=eq.true`
}

export type TwinSeatStep = { step: 'counttooling_seat' | 'takeofftooling_seat'; ok: boolean; words: string }

/** The line after the writes: what is linked now, what is still held and why, and where to read it back. */
export function twinSeatAppliedWords(steps: readonly TwinSeatStep[], twin: TwinSeatTwinRow): string {
  const appOf = (s: TwinSeatStep): string => (s.step === 'counttooling_seat' ? 'CountTooling' : 'TakeoffTooling')
  const done = steps.filter((s) => s.ok)
  const held = steps.filter((s) => !s.ok)
  const doneWords = done.length ? `Linked on ${nameOf(twin)} (${twin.email}): ${done.map(appOf).join(' and ')}.` : `Nothing linked on ${twin.email}.`
  const heldWords = held.length ? ` Still held: ${held.map((s) => `${appOf(s)} (${s.words})`).join('; ')}. A bridge that refuses names its own reason; the fix is on its side, and this pair can be planned again after it.` : ''
  return `${doneWords}${heldWords} plan_twin_seat { seat: { twin: "${twin.email}" } } reads where each seat stands.`
}
