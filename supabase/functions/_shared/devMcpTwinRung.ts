// dev-mcp's plan_twin_rung / apply_twin_rung (v2.7918 / 0.108.0): a twin moved between the two rungs the safety ladder
// at Settings → System → Digital twins has built, as Graduate ↑ and Back ↓ on the twin's row move it
// (DigitalTwinsPanel.setRung) — users.read_only on the twin's own row, as the dev under the users table's dev update
// policy. Rung 1 is read-only: every write the twin's own signed-in session tries is refused. Rung 2 is fenced writes:
// the twin write fence binds it to bids it made or is the assigned estimator on. Rung 3 is not built, here or there.
// No new RPC and no dry-run wrapper: the dry run is the server's own read of the twin and its live keys as the dev,
// and the plan hash commits to the rung it stands on and to the keys that would gain or lose writes, so a rung moved
// or a key minted or revoked since the plan refuses the apply. The keys are read by a column list that never names
// token_hash and carries no usage date, so a robot working between plan and apply does not move the hash.
// The undo is the same pair with the other rung. Pure: no network, no env. Tests: src/lib/devMcp/devMcpTwinRung.test.ts.

import { TWIN_PANEL_DOOR } from './devMcpTwin.ts'
import { twinRef } from './devMcpTwinKey.ts'

type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)

export const TWIN_RUNG_VERBS = ['plan_twin_rung', 'apply_twin_rung'] as const
export type TwinRungVerb = (typeof TWIN_RUNG_VERBS)[number]
export function isTwinRungVerb(verb: string): verb is TwinRungVerb {
  return (TWIN_RUNG_VERBS as readonly string[]).includes(verb)
}

/** The rungs a twin can stand on today. The ladder's third, production, is not built. */
export type TwinRung = 1 | 2
export const TWIN_RUNG_WORDS: Record<TwinRung, string> = { 1: 'read-only (rung 1)', 2: 'fenced writes (rung 2)' }

/** The rung a users row stands on, by the panel's own rule: read_only is rung 1, anything else rung 2. */
export function twinRungOf(readOnly: boolean | null | undefined): TwinRung {
  return readOnly ? 1 : 2
}

/** What a rung verb carries after the shape check: the twin, and the rung it moves to. */
export type TwinRungPayload = { twin: string; to: TwinRung }
export type TwinRungInput = { ok: true; p: TwinRungPayload; target: string } | { ok: false; error: string }

/** The ask's shape, refused in words: a twin, a rung of 1 or 2, and no other key. */
export function twinRungInput(verb: TwinRungVerb, input: Json): TwinRungInput {
  const rung = obj(input.rung)
  const shape = `${verb} needs rung — { twin (the twin's users.id or its address, twin-estimator-N@twins.pipetooling.local), to (1: read-only, every write its own session tries is refused; 2: fenced writes, its own bids only) }. plan_twin lists the fleet with each twin's rung.`
  if (!rung) return { ok: false, error: shape }
  const twin = twinRef(rung.twin)
  if (!twin) return { ok: false, error: shape }
  if (rung.to === 3) return { ok: false, error: `${verb}: rung 3, production, is not built. A twin stands on rung 1 (read-only) or rung 2 (fenced writes), here and at ${TWIN_PANEL_DOOR}.` }
  if (rung.to !== 1 && rung.to !== 2) return { ok: false, error: shape }
  const extra = Object.keys(rung).filter((k) => k !== 'twin' && k !== 'to')
  if (extra.length) return { ok: false, error: `${verb}: rung takes twin and to alone, not ${extra.join(', ')}.` }
  return { ok: true, p: { twin, to: rung.to }, target: twin }
}

/** The columns the server reads of the twin whose rung moves. */
export const TWIN_RUNG_TWIN_SELECT = 'id,name,email,twin_kind,read_only,archived_at'
export type TwinRungTwinRow = { id: string; name: string | null; email: string; twin_kind: string | null; read_only: boolean | null; archived_at: string | null }

/**
 * The columns the server reads of the twin's live keys: what names a key and nothing that changes while a robot
 * works. token_hash is never among them, and neither is a usage date, so the plan hash holds while the twin runs.
 */
export const TWIN_RUNG_KEY_SELECT = 'id,label,created_at'
export type TwinRungKeyRow = { id: string; label: string | null; created_at: string }

const kindOf = (t: Pick<TwinRungTwinRow, 'twin_kind'>): 'estimator' | 'pricer' => (t.twin_kind === 'pricer' ? 'pricer' : 'estimator')
const twinFactsOf = (t: TwinRungTwinRow): Json => ({ id: t.id, email: t.email, name: t.name, kind: kindOf(t), rung: TWIN_RUNG_WORDS[twinRungOf(t.read_only)] })

/** What each rung lets the twin's own signed-in session write, in the fence's own terms. */
function rungMeans(to: TwinRung): string {
  if (to === 1) return 'On rung 1 every write its own signed-in session tries is refused, as for a person in training mode. It still reads what an estimator reads.'
  return 'On rung 2 the twin write fence binds it: its own signed-in session writes only bids it made or is the assigned estimator on, with their child rows and help feedback, and it can never send a bid or record an outcome.'
}

export type TwinRungDryRun = { ok: true; reply: Json; twin: TwinRungTwinRow; from: TwinRung } | { ok: false; refused: string }

/**
 * The dry run: the twin, the rung it stands on, the rung it would stand on and the live keys that gain or lose
 * writes with it. No such twin, an archived twin and a twin already on that rung are each refused in words.
 */
export function twinRungDryRun(p: TwinRungPayload, twin: TwinRungTwinRow | null, liveKeys: readonly TwinRungKeyRow[]): TwinRungDryRun {
  if (!twin) return { ok: false, refused: `No twin reads as ${p.twin}. plan_twin lists the fleet with each twin's rung.` }
  if (twin.archived_at) return { ok: false, refused: `Nothing to plan: ${twin.email} is archived, and an archived twin has no ladder. Restore it at ${TWIN_PANEL_DOOR} first.` }
  const from = twinRungOf(twin.read_only)
  if (from === p.to) return { ok: false, refused: `Nothing to plan: ${twin.email} already stands on ${TWIN_RUNG_WORDS[from]}.` }
  const n = liveKeys.length
  const keyWords =
    n === 0
      ? `No live key is on ${twin.email}, so nothing runs it today: the rung waits for its next key.`
      : p.to === 2
        ? `${n === 1 ? 'The machine holding its one live key gains' : `The machines holding its ${n} live keys gain`} those writes at once, in any browser session ${n === 1 ? 'it opens' : 'they open'} as the twin.`
        : `${n === 1 ? 'The machine holding its one live key loses' : `The machines holding its ${n} live keys lose`} those writes at once: a browser session open as the twin is refused at its next write.`
  return {
    ok: true,
    twin,
    from,
    reply: {
      dry_run: true,
      twin: twinFactsOf(twin),
      from: TWIN_RUNG_WORDS[from],
      to: TWIN_RUNG_WORDS[p.to],
      live_keys: liveKeys.map((k) => ({ key_id: k.id, label: k.label ?? '', made_at: k.created_at })),
      then: `apply sets read_only ${p.to === 1 ? 'true' : 'false'} on its users row as you, as ${p.to === 2 ? 'Graduate ↑' : 'Back ↓'} on the twin's row at ${TWIN_PANEL_DOOR} does. ${rungMeans(p.to)} ${keyWords} The seat's own verbs (twin-mcp) write as the service and never read the rung, so a shadow or a backtest runs the same on either. CountTooling has no read-only, so the rung does not carry there. The way back is this pair with to: ${from}.`,
    },
  }
}

/** The write: the panel's own, read_only on the twin's row. */
export function twinRungPatch(to: TwinRung): Json {
  return { read_only: to === 1 }
}

/** The users filter the write is held to: this twin, still a twin, still live, still on the rung the plan read. */
export function twinRungPatchQuery(twin: Pick<TwinRungTwinRow, 'id'>, from: TwinRung): string {
  return `id=eq.${twin.id}&is_digital_twin=eq.true&archived_at=is.null&read_only=${from === 1 ? 'is.true' : 'not.is.true'}`
}

/** The line after the write: the rung it stands on now and the way back, or why nothing moved. */
export function twinRungAppliedWords(landed: boolean, twin: TwinRungTwinRow, from: TwinRung, to: TwinRung, heldWords = ''): string {
  if (!landed) return `Nothing moved: ${twin.email} stays on ${TWIN_RUNG_WORDS[from]}${heldWords ? ` (${heldWords})` : ''}. plan_twin lists the fleet with each twin's rung; plan again from the rung it stands on.`
  return `${twin.name ?? twin.email} (${twin.email}) now stands on ${TWIN_RUNG_WORDS[to]}. The way back is plan_twin_rung { rung: { twin: "${twin.email}", to: ${from} } }.`
}
