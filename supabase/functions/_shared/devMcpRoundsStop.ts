// dev-mcp's plan_rounds_stop / apply_rounds_stop (v2.7970 / 0.115.0): the rounds stopped on a twin's key and started
// again, as Stop the rounds and Start again on the Rounds card at Bids → Robots → Console do (TwinRoundsCard.press,
// useRobotAgents.stopRounds) — robot_rounds_stop(p_credential_id, p_stop) called as the dev, the card's own RPC, which
// takes a dev or the master and sets stopped_at and stopped_by on a key still live. A round reads the stop in the
// reply to its next heartbeat (twin-mcp heartbeatOrders): it finishes the bid in hand and claims no more. It reaches
// rounds only, never a session a person starts by hand, and the key stays live.
// No new RPC and no dry-run wrapper: the dry run is the server's own read of the twin and its live keys as the dev,
// with what each key has in hand from robot_agents(), the card's own read, beside the hash and never in it. The plan
// hash commits to each live key by its id, label and stop, never by a usage date, so a robot working between plan
// and apply does not move it, and a key stopped, started, minted or revoked since the plan refuses the apply.
// The undo is the same pair with the other stop. Pure: no network, no env. Tests: src/lib/devMcp/devMcpRoundsStop.test.ts.

import { twinRef } from './devMcpTwinKey.ts'

type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const ROUNDS_STOP_VERBS = ['plan_rounds_stop', 'apply_rounds_stop'] as const
export type RoundsStopVerb = (typeof ROUNDS_STOP_VERBS)[number]
export function isRoundsStopVerb(verb: string): verb is RoundsStopVerb {
  return (ROUNDS_STOP_VERBS as readonly string[]).includes(verb)
}

/** Where the press lives in the app. */
export const ROUNDS_CARD_DOOR = 'the Rounds card at Bids → Robots → Console'
/** The card's own RPC, and its read. */
export const ROUNDS_STOP_RPC = 'robot_rounds_stop'
export const ROUNDS_AGENTS_READ = 'rpc/robot_agents'

/** What a rounds verb carries after the shape check: the twin, the stop, and one key when the ask names one. */
export type RoundsStopPayload = { twin: string; stop: boolean; key_id?: string }
export type RoundsStopInput = { ok: true; p: RoundsStopPayload; target: string } | { ok: false; error: string }

/** The ask's shape, refused in words: a twin, stop true or false, a key id or none, and no other key. */
export function roundsStopInput(verb: RoundsStopVerb, input: Json): RoundsStopInput {
  const rounds = obj(input.rounds)
  const shape = `${verb} needs rounds — { twin (the twin's users.id or its address, twin-estimator-N@twins.pipetooling.local), stop (true: stop the rounds; false: start them again), and key_id when one key alone is meant (left out, every live key of the twin) }. read_twin_keys lists every twin's keys with the rounds stopped on each.`
  if (!rounds) return { ok: false, error: shape }
  const twin = twinRef(rounds.twin)
  if (!twin) return { ok: false, error: shape }
  if (typeof rounds.stop !== 'boolean') return { ok: false, error: shape }
  const keyId = rounds.key_id === undefined ? '' : typeof rounds.key_id === 'string' ? rounds.key_id.trim().toLowerCase() : 'x'
  if (rounds.key_id !== undefined && !UUID_RE.test(keyId)) return { ok: false, error: shape }
  const extra = Object.keys(rounds).filter((k) => k !== 'twin' && k !== 'stop' && k !== 'key_id')
  if (extra.length) return { ok: false, error: `${verb}: rounds takes twin, stop and key_id alone, not ${extra.join(', ')}.` }
  return { ok: true, p: keyId ? { twin, stop: rounds.stop, key_id: keyId } : { twin, stop: rounds.stop }, target: twin }
}

/** The columns the server reads of the twin. */
export const ROUNDS_TWIN_SELECT = 'id,name,email,twin_kind,archived_at'
export type RoundsTwinRow = { id: string; name: string | null; email: string; twin_kind: string | null; archived_at: string | null }

/** The columns the server reads of the twin's live keys. token_hash is never among them. */
export const ROUNDS_KEY_SELECT = 'id,label,created_at,last_seen_at,stopped_at'
export type RoundsKeyRow = { id: string; label: string | null; created_at: string; last_seen_at: string | null; stopped_at: string | null }

/** What the plan reads of a robot_agents() row: the key and what it has in hand. */
export type RoundsAgentRow = {
  credential_id: string
  heartbeat_state?: string | null
  heartbeat_stage?: string | null
  heartbeat_is_round?: boolean | null
  heartbeat_bid_number?: string | null
  heartbeat_source_bid_number?: string | null
  holds_open_shell?: boolean | null
}

/**
 * What a key has in hand, in words, off the card's own read. `agents` null is a read that was refused: the plan
 * says it could not look, never that the key is idle. A key the read does not list has not called in seven days.
 */
export function roundsInHandWords(key: Pick<RoundsKeyRow, 'id'>, agents: readonly RoundsAgentRow[] | null): string {
  if (agents === null) return 'could not be read'
  const a = agents.find((x) => x.credential_id === key.id)
  if (!a) return 'no call in seven days'
  if (!a.holds_open_shell) return 'nothing in hand'
  const bid = a.heartbeat_source_bid_number ? `b${a.heartbeat_source_bid_number}` : a.heartbeat_bid_number ? `shell b${a.heartbeat_bid_number}` : 'a bid'
  return `${bid} in hand${a.heartbeat_stage ? `, at ${a.heartbeat_stage}` : ''}, ${a.heartbeat_is_round ? 'on a round' : 'in a session started by hand, which a stop does not reach'}`
}

const nameOf = (t: Pick<RoundsTwinRow, 'name' | 'email'>): string => (t.name ?? '').trim() || t.email
const twinFactsOf = (t: RoundsTwinRow): Json => ({ id: t.id, email: t.email, name: t.name, kind: t.twin_kind === 'pricer' ? 'pricer' : 'estimator' })

/** One key as a rounds plan shows it: its label, its stop, its last call and what it has in hand. */
export function roundsKeyFacts(k: RoundsKeyRow, agents: readonly RoundsAgentRow[] | null): Json {
  return { key_id: k.id, label: k.label ?? '', made_at: k.created_at, rounds: k.stopped_at ? `stopped since ${k.stopped_at}` : 'not stopped', last_seen_at: k.last_seen_at, in_hand: roundsInHandWords(k, agents) }
}

/**
 * A plan's keys as its hash commits to them: each key without its last call and without what it has in hand, the
 * two that move while a robot works.
 */
export function roundsKeyCommitment(keys: unknown): unknown {
  if (!Array.isArray(keys)) return keys ?? null
  return keys.map((k) => {
    const o = obj(k)
    if (!o) return k
    const { last_seen_at: _seen, in_hand: _hand, ...rest } = o
    return rest
  })
}

export type RoundsStopDryRun = { ok: true; reply: Json; twin: RoundsTwinRow; change: RoundsKeyRow[] } | { ok: false; refused: string }

/**
 * The dry run: the twin, the live keys the press changes and the ones already there. No such twin, a twin with no
 * live key, a key that is not one of its live keys and a press that would change nothing are each refused in words.
 */
export function roundsStopDryRun(p: RoundsStopPayload, twin: RoundsTwinRow | null, liveKeys: readonly RoundsKeyRow[], agents: readonly RoundsAgentRow[] | null): RoundsStopDryRun {
  if (!twin) return { ok: false, refused: `No twin reads as ${p.twin}. read_twin_keys lists every twin with its keys.` }
  if (liveKeys.length === 0) return { ok: false, refused: `Nothing to plan: ${twin.email} has no live key${twin.archived_at ? ' (it is archived)' : ''}, so no rounds run as it. read_twin_keys lists every twin with its keys.` }
  const liveWords = `Its live keys: ${liveKeys.map((k) => `${JSON.stringify(k.label ?? '')} (${k.id}, ${k.stopped_at ? 'stopped' : 'not stopped'})`).join(', ')}.`
  let asked: RoundsKeyRow[] = [...liveKeys]
  if (p.key_id) {
    const one = liveKeys.find((k) => k.id.toLowerCase() === p.key_id)
    if (!one) return { ok: false, refused: `No live key ${p.key_id} on ${twin.email}. ${liveWords}` }
    asked = [one]
  }
  const change = asked.filter((k) => Boolean(k.stopped_at) !== p.stop)
  const already = asked.filter((k) => Boolean(k.stopped_at) === p.stop)
  if (change.length === 0) {
    const each = asked.length === 1 ? `the key ${JSON.stringify(asked[0]!.label ?? '')}` : `each of its ${asked.length} live keys`
    return { ok: false, refused: p.stop ? `Nothing to plan: the rounds are stopped already on ${each} of ${twin.email}. ${liveWords} stop: false starts them again.` : `Nothing to plan: the rounds are not stopped on ${each} of ${twin.email}. ${liveWords}` }
  }
  const n = change.length
  const those = n === 1 ? 'that key' : `those ${n} keys`
  const then = p.stop
    ? `apply stops the rounds on ${those} as you, through ${ROUNDS_STOP_RPC}, as Stop the rounds on ${ROUNDS_CARD_DOOR} does: stopped_at and stopped_by set on the key's row. A round reads it in the reply to its next heartbeat: the robot finishes the bid in hand, then claims no more. It reaches the rounds only, never a session a person starts by hand, and the key stays live. The agent stays installed on the Mac: scripts/twin/install-rounds.ts --uninstall takes it off. The way back is this pair with stop: false.`
    : `apply starts the rounds again on ${those} as you, through ${ROUNDS_STOP_RPC}, as Start again on ${ROUNDS_CARD_DOOR} does: stopped_at and stopped_by cleared on the key's row. The next round comes within five minutes on a Mac that has the agent installed and awake; a key with no agent behind it makes no rounds either way. The way back is this pair with stop: true.`
  return {
    ok: true,
    twin,
    change,
    reply: {
      dry_run: true,
      action: p.stop ? 'stop' : 'start again',
      twin: twinFactsOf(twin),
      change: change.map((k) => roundsKeyFacts(k, agents)),
      already: already.map((k) => roundsKeyFacts(k, agents)),
      then,
    },
  }
}

/** The RPC body for one key: the card's own. */
export function roundsStopBody(key: Pick<RoundsKeyRow, 'id'>, stop: boolean): Json {
  return { p_credential_id: key.id, p_stop: stop }
}

export type RoundsStopStep = { key_id: string; label: string; ok: boolean; words: string }

/** The line after the press: what changed, what was held and why, and the way back. */
export function roundsStopAppliedWords(steps: readonly RoundsStopStep[], twin: RoundsTwinRow, stop: boolean): string {
  const done = steps.filter((s) => s.ok)
  const held = steps.filter((s) => !s.ok)
  const names = (list: readonly RoundsStopStep[]) => list.map((s) => JSON.stringify(s.label)).join(', ')
  const keys = (n: number) => `${n} key${n === 1 ? '' : 's'}`
  const doneWords = done.length
    ? stop
      ? `Stopping the rounds on ${keys(done.length)} of ${nameOf(twin)}: ${names(done)}. The robot finishes the bid in hand, then claims no more.`
      : `The rounds start again on ${keys(done.length)} of ${nameOf(twin)}: ${names(done)}. The next round comes within five minutes.`
    : `Nothing changed on ${twin.email}.`
  const heldWords = held.length ? ` Held: ${held.map((s) => `${JSON.stringify(s.label)} (${s.words})`).join('; ')}. read_twin_keys says where each stands; plan again for a key still live.` : ''
  return `${doneWords}${heldWords} The way back is plan_rounds_stop { rounds: { twin: "${twin.email}", stop: ${stop ? 'false' : 'true'} } }.`
}
