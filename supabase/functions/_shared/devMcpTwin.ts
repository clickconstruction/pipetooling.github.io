// dev-mcp's plan_twin / apply_twin (v2.7879 / 0.105.0): a digital twin's account made as Settings → System → Digital
// twins makes it (DigitalTwinsPanel.mintTwin) — create-user as the dev with no roster row and a password nobody is
// told, the twin flags on the users row (is_digital_twin, read_only, twin_kind for the pricing robot), then for a bid
// robot its CountTooling seat through ct-bridge with the join key stored on the row, and its TakeoffTooling seat through
// tt-bridge. No new RPC and no dry-run wrapper: the dry run is the server's own read of the fleet as the dev, and the
// plan hash commits to it, so a twin minted since the plan, by anyone, refuses the apply. The caller chooses the kind
// and nothing else: the seat number, the address and the name come from the fleet (_shared/twinSeat.ts, the panel's
// own rule). No key is made here: mint_twin_setup_code is the next call. The rung is not chosen here either: a new
// twin is read-only, as the panel leaves it, and plan_twin_rung moves it (v2.7918). Pure: no network, no env. Tests: src/lib/devMcp/devMcpTwin.test.ts.

import { ctTwinSeatEmail, nextTwinSeat, ttTwinSeatEmail, twinSeatName, type TwinSeatKind } from './twinSeat.ts'

type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)

export const TWIN_VERBS = ['plan_twin', 'apply_twin'] as const
export type TwinVerb = (typeof TWIN_VERBS)[number]
export function isTwinVerb(verb: string): verb is TwinVerb {
  return (TWIN_VERBS as readonly string[]).includes(verb)
}

/** What a twin verb carries after the shape check: the kind of seat, and nothing else. */
export type TwinPayload = { kind: TwinSeatKind }
export type TwinInput = { ok: true; p: TwinPayload; target: string } | { ok: false; error: string }

/** The ask's shape, refused in words: a kind, and no other key. */
export function twinInput(verb: TwinVerb, input: Json): TwinInput {
  const twin = obj(input.twin)
  const shape = `${verb} needs twin — { kind (estimator: a bid robot, with its CountTooling and TakeoffTooling seats; pricer: the pricing robot, quotes only and no bids) }. The seat number, the address and the name are the fleet's to give, never yours.`
  if (!twin) return { ok: false, error: shape }
  if (twin.kind !== 'estimator' && twin.kind !== 'pricer') return { ok: false, error: shape }
  const extra = Object.keys(twin).filter((k) => k !== 'kind')
  if (extra.length) return { ok: false, error: `${verb}: twin takes kind alone, not ${extra.join(', ')}. The seat, the address, the name and the rung are not chosen here.` }
  return { ok: true, p: { kind: twin.kind }, target: `twin-${twin.kind}` }
}

/** The columns the server reads of every twin, archived ones too: seat numbers count them, as the panel's do. */
export const TWIN_FLEET_SELECT = 'id,name,email,role,read_only,twin_kind,archived_at,counttooling_user_id'
export type TwinFleetRow = { id: string; name: string | null; email: string; role: string; read_only: boolean | null; twin_kind: string | null; archived_at: string | null; counttooling_user_id: string | null }

/** The columns the server reads of any users row already wearing the seat's address. */
export const TWIN_HOLDER_SELECT = 'id,name,email,role,is_digital_twin,archived_at'
export type TwinHolderRow = { id: string; name: string | null; email: string | null; role: string | null; is_digital_twin: boolean | null; archived_at: string | null }

export type TwinSeat = { n: number; email: string; name: string; kind: TwinSeatKind }

/** The seat a mint would take: the next number of its kind over every twin there has been. */
export function twinSeatFor(p: TwinPayload, fleet: readonly TwinFleetRow[]): TwinSeat {
  const seat = nextTwinSeat(fleet.map((t) => String(t.email ?? '').toLowerCase()), p.kind)
  return { n: seat.n, email: seat.email, name: twinSeatName(p.kind, seat.n), kind: p.kind }
}

const kindOfRow = (t: Pick<TwinFleetRow, 'twin_kind'>): TwinSeatKind => (t.twin_kind === 'pricer' ? 'pricer' : 'estimator')
const rungWords = (readOnly: boolean | null): string => (readOnly ? 'read-only (rung 1)' : 'fenced writes (rung 2)')

/** One twin as the plan and the reply list it. */
export function twinFacts(t: TwinFleetRow): Json {
  return { id: t.id, email: t.email, name: t.name, kind: kindOfRow(t), rung: rungWords(t.read_only), archived: Boolean(t.archived_at), counttooling_seat: kindOfRow(t) === 'pricer' ? 'none: a pricing robot has no seat there' : t.counttooling_user_id ? 'linked' : 'not linked' }
}

/** The flags that make a users row a twin, as the panel sets them: read-only until a dev flips the rung. */
export function twinFlagPatch(kind: TwinSeatKind): Json {
  return kind === 'pricer' ? { is_digital_twin: true, read_only: true, twin_kind: 'pricer' } : { is_digital_twin: true, read_only: true }
}

/** create-user's body for a twin: an estimator with no roster row (a twin is not a person) and a password nobody is told. */
export function twinCreateBody(seat: TwinSeat, password: string): Json {
  return { email: seat.email, password, role: 'estimator', name: seat.name, skip_roster_row: true }
}

/** The body ct-bridge and tt-bridge take to make a twin's seat in the other app (idempotent there). */
export function twinBridgeBody(email: string, name: string): Json {
  return { verb: 'create', email, name, is_digital_twin: true }
}

export type TwinWorld = { fleet: readonly TwinFleetRow[]; holders: readonly TwinHolderRow[] }
export type TwinDryRun = { ok: true; reply: Json; seat: TwinSeat } | { ok: false; refused: string }

/** Where a twin's row is kept and changed once it stands. */
export const TWIN_PANEL_DOOR = 'Settings → System → Digital twins'

/**
 * The dry run: the seat the fleet gives next and what a mint would make on it. A users row already wearing the
 * seat's address is refused in words: the fleet does not count it, so it is a mint that stopped before its flags, or
 * a person's row, and neither is this door's to finish.
 */
export function twinDryRun(p: TwinPayload, world: TwinWorld): TwinDryRun {
  const seat = twinSeatFor(p, world.fleet)
  const holder = world.holders.find((h) => String(h.email ?? '').toLowerCase() === seat.email)
  if (holder) {
    return { ok: false, refused: `Nothing to plan: ${seat.email} is the next ${p.kind} seat, and a users row already wears that address without the twin flag (users ${holder.id}, ${holder.name ?? 'no name'}, role ${holder.role ?? 'none'}${holder.archived_at ? ', archived' : ''}). A mint that stopped before its flags leaves a row like this. A dev flags or archives that row first; this door makes a seat from nothing only.` }
  }
  const live = world.fleet.filter((t) => !t.archived_at)
  const bidRobot = p.kind === 'estimator'
  return {
    ok: true,
    seat,
    reply: {
      dry_run: true,
      twin: { email: seat.email, name: seat.name, seat: seat.n, kind: p.kind, role: 'estimator', rung: rungWords(true), flags: twinFlagPatch(p.kind), roster_row: 'none: a twin is not a person' },
      seats: bidRobot ? { counttooling: ctTwinSeatEmail(seat.email), takeofftooling: ttTwinSeatEmail(seat.email) } : 'none: the pricing robot prices quotes and holds no bids',
      fleet: { live: live.map(twinFacts), archived: world.fleet.filter((t) => t.archived_at).map((t) => t.email) },
      then: `apply makes the login through create-user as you, with a password nobody is told, then sets the twin flags on its row${bidRobot ? ', then makes its CountTooling seat through ct-bridge and stores the join key, then its TakeoffTooling seat through tt-bridge' : ''}. Each step is reported done or held, and what landed stays. No key is made: mint_twin_setup_code { label, twin: "${seat.email}" } is the next call. The twin stays read-only: plan_twin_rung moves its rung, plan_twin_key_revoke cuts a key off, and plan_twin_archive takes it out of the fleet, or brings it back with restore: true.${bidRobot ? ' plan_twin_seat makes a held seat again.' : ''} Each is also a press at ${TWIN_PANEL_DOOR}.`,
    },
  }
}

export type TwinStep = { step: 'account' | 'flags' | 'counttooling_seat' | 'takeofftooling_seat'; ok: boolean; words: string }

/** The line after the write: what stands, what was held with its door, and the next call. */
export function twinAppliedWords(steps: readonly TwinStep[], seat: TwinSeat): string {
  const held = steps.filter((s) => !s.ok)
  const flagged = steps.some((s) => s.step === 'flags' && s.ok)
  if (!flagged) {
    return `Stopped: the login ${seat.email} is made but its row is not flagged a twin, so no seat was made in the other apps and no key can be minted for it. Nobody holds its password. A dev sets is_digital_twin and read_only on that users row, or archives it, before another plan: this door refuses the seat while an unflagged row wears it.`
  }
  const next = `Next: mint_twin_setup_code { label, twin: "${seat.email}" } for its key. It is read-only until plan_twin_rung moves it to rung 2.`
  if (held.length === 0) return `Made: ${seat.name} (${seat.email}) stands in the fleet${seat.kind === 'estimator' ? ' with its CountTooling and TakeoffTooling seats' : ', a pricing robot with no seat in the other apps'}. ${next}`
  return `Made: ${seat.name} (${seat.email}) stands in the fleet. Held: ${held.map((s) => `${s.step.replace(/_/g, ' ')} (${s.words})`).join('; ')}. plan_twin_seat { seat: { twin: "${seat.email}" } } makes a held seat again, as the link button on the twin's row at ${TWIN_PANEL_DOOR} does. ${next}`
}
