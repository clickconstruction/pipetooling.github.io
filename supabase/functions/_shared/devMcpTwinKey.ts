// dev-mcp's read_twin_keys and plan_twin_key_revoke / apply_twin_key_revoke (v2.7900 / 0.107.0): a twin's keys listed
// and one cut off, as Settings → System → Digital twins lists them and its Revoke press cuts one off
// (DigitalTwinsPanel.revokeToken) — revoked_at set on the key's own twin_credentials row, as the dev under the table's
// dev-only RLS. Until now the seat could mint a key (mint_twin_setup_code) and neither see nor take one back.
// twin_credentials stays closed to read_rows: these verbs read it by a fixed column list that never names token_hash,
// so a key's label, its dates and its state cross the door and nothing that could stand in for the key does.
// No new RPC and no dry-run wrapper: the dry run is the server's own read of the twin and its keys as the dev, and the
// plan hash commits to them, so a key revoked or minted since the plan refuses the apply. There is no undo, as in the
// panel: a new key is mint_twin_setup_code. Pure: no network, no env. Tests: src/lib/devMcp/devMcpTwinKey.test.ts.

type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TWIN_EMAIL_RE = /^twin-[a-z_]+-\d+@twins\.pipetooling\.local$/i

export const TWIN_KEY_LABEL_MAX = 80

export const TWIN_KEY_VERBS = ['plan_twin_key_revoke', 'apply_twin_key_revoke'] as const
export type TwinKeyVerb = (typeof TWIN_KEY_VERBS)[number]
export function isTwinKeyVerb(verb: string): verb is TwinKeyVerb {
  return (TWIN_KEY_VERBS as readonly string[]).includes(verb)
}

/** A twin as a caller names it: its users.id or its fleet address, lower-cased; null when it is neither. */
export function twinRef(raw: unknown): string | null {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  return UUID_RE.test(s) || TWIN_EMAIL_RE.test(s) ? s : null
}

/** The users filter that finds one twin by that ref, a twin and nothing else. */
export function twinRefQuery(ref: string): string {
  return `${UUID_RE.test(ref) ? 'id' : 'email'}=eq.${encodeURIComponent(ref)}&is_digital_twin=eq.true`
}

/** What a revoke carries after the shape check: the twin, and the key by its label or by its id. */
export type TwinKeyPayload = { twin: string; label?: string; key_id?: string }
export type TwinKeyInput = { ok: true; p: TwinKeyPayload; target: string } | { ok: false; error: string }

/** The ask's shape, refused in words: a twin, and a label or a key id, never both. */
export function twinKeyInput(verb: TwinKeyVerb, input: Json): TwinKeyInput {
  const revoke = obj(input.revoke)
  const shape = `${verb} needs revoke — { twin (the twin's users.id or its address, twin-estimator-N@twins.pipetooling.local), and one of: label (the key's name as read_twin_keys lists it; every live key of that twin wearing it is revoked) or key_id (one key by its id) }. read_twin_keys lists every twin's keys first.`
  if (!revoke) return { ok: false, error: shape }
  const twin = twinRef(revoke.twin)
  if (!twin) return { ok: false, error: shape }
  const label = typeof revoke.label === 'string' ? revoke.label.trim() : ''
  const keyId = typeof revoke.key_id === 'string' ? revoke.key_id.trim().toLowerCase() : ''
  if (Boolean(label) === Boolean(keyId)) return { ok: false, error: shape }
  if (label.length > TWIN_KEY_LABEL_MAX) return { ok: false, error: `${verb}: a key's label is at most ${TWIN_KEY_LABEL_MAX} characters.` }
  if (keyId && !UUID_RE.test(keyId)) return { ok: false, error: shape }
  return { ok: true, p: label ? { twin, label } : { twin, key_id: keyId }, target: twin }
}

/** The columns the server reads of a key. token_hash is never among them: nothing here can stand in for the key. */
export const TWIN_KEY_SELECT = 'id,twin_user_id,label,created_at,last_used_at,last_seen_at,revoked_at,stopped_at'
export type TwinKeyRow = { id: string; twin_user_id: string; label: string | null; created_at: string; last_used_at: string | null; last_seen_at: string | null; revoked_at: string | null; stopped_at: string | null }

/** The columns the server reads of the twin a key belongs to. */
export const TWIN_KEY_TWIN_SELECT = 'id,name,email,twin_kind,archived_at'
export type TwinKeyTwinRow = { id: string; name: string | null; email: string; twin_kind: string | null; archived_at: string | null }

const sameLabel = (a: string | null | undefined, b: string): boolean => String(a ?? '').trim().toLowerCase() === b.trim().toLowerCase()
const isLive = (k: Pick<TwinKeyRow, 'revoked_at'>): boolean => !k.revoked_at
/** Revoked keys, the last one revoked first. */
const revokedNewestFirst = (keys: readonly TwinKeyRow[]): TwinKeyRow[] => keys.filter((k) => !isLive(k)).sort((a, b) => String(b.revoked_at).localeCompare(String(a.revoked_at)))

/** One key as a plan or a list shows it: its label, its dates and its state, never its hash. */
export function twinKeyFacts(k: TwinKeyRow): Json {
  return {
    key_id: k.id,
    label: k.label ?? '',
    state: isLive(k) ? 'live' : 'revoked',
    made_at: k.created_at,
    last_used_at: k.last_used_at,
    last_seen_at: k.last_seen_at,
    ...(k.revoked_at ? { revoked_at: k.revoked_at } : {}),
    ...(isLive(k) && k.stopped_at ? { rounds: `stopped since ${k.stopped_at}` } : {}),
  }
}

const twinFactsOf = (t: TwinKeyTwinRow): Json => ({ id: t.id, email: t.email, name: t.name, kind: t.twin_kind === 'pricer' ? 'pricer' : 'estimator', archived: Boolean(t.archived_at) })

/** How many revoked keys a list names for a twin; the count beside them is whole. */
export const TWIN_KEYS_REVOKED_SHOWN = 5

/**
 * read_twin_keys' answer: each twin with its live keys whole and its revoked keys counted, the newest few named.
 * `capped` says the key read stopped at its limit, so a count may be short.
 */
export function twinKeysReading(twins: readonly TwinKeyTwinRow[], keys: readonly TwinKeyRow[], capped: boolean): Json {
  const byTwin = new Map<string, TwinKeyRow[]>()
  for (const k of keys) byTwin.set(k.twin_user_id, [...(byTwin.get(k.twin_user_id) ?? []), k])
  const rows = twins.map((t) => {
    const mine = byTwin.get(t.id) ?? []
    const revoked = revokedNewestFirst(mine)
    return {
      ...twinFactsOf(t),
      live_keys: mine.filter(isLive).map(twinKeyFacts),
      revoked_keys: { count: revoked.length, newest: revoked.slice(0, TWIN_KEYS_REVOKED_SHOWN).map((k) => ({ key_id: k.id, label: k.label ?? '', revoked_at: k.revoked_at })) },
    }
  })
  const live = rows.reduce((n, r) => n + r.live_keys.length, 0)
  return {
    twins: rows,
    reading: `${live} live key${live === 1 ? '' : 's'} on ${rows.filter((r) => r.live_keys.length > 0).length} of ${rows.length} twin${rows.length === 1 ? '' : 's'}.${capped ? ' The key read stopped at its limit, so an old revoked key may be missing from a count.' : ''}`,
    next: 'plan_twin_key_revoke { revoke: { twin, label } } cuts off every live key of that twin wearing the label; { twin, key_id } cuts off one. A key is made with mint_twin_setup_code. A key itself is never shown: only its label, its dates and its state.',
  }
}

export type TwinKeyDryRun = { ok: true; reply: Json; twin: TwinKeyTwinRow; chosen: TwinKeyRow[] } | { ok: false; refused: string }

/**
 * The dry run: the twin, the live keys the ask names and the live keys that stay. No such twin, no such key, and a
 * key already revoked are each refused in words, with the labels that are live so the next plan can name one.
 */
export function twinKeyDryRun(p: TwinKeyPayload, twin: TwinKeyTwinRow | null, keys: readonly TwinKeyRow[]): TwinKeyDryRun {
  if (!twin) return { ok: false, refused: `No twin reads as ${p.twin}. read_twin_keys lists every twin with its keys.` }
  const live = keys.filter(isLive)
  const liveWords = live.length ? `Its live keys: ${live.map((k) => `${JSON.stringify(k.label ?? '')} (${k.id})`).join(', ')}.` : 'It has no live key.'
  let chosen: TwinKeyRow[]
  if (p.key_id) {
    const one = keys.find((k) => k.id.toLowerCase() === p.key_id)
    if (!one) return { ok: false, refused: `No key ${p.key_id} on ${twin.email}. ${liveWords}` }
    if (!isLive(one)) return { ok: false, refused: `Nothing to plan: the key ${JSON.stringify(one.label ?? '')} on ${twin.email} was revoked already, ${one.revoked_at}. ${liveWords}` }
    chosen = [one]
  } else {
    const label = p.label ?? ''
    chosen = live.filter((k) => sameLabel(k.label, label))
    if (chosen.length === 0) {
      const gone = revokedNewestFirst(keys).filter((k) => sameLabel(k.label, label))
      if (gone.length) return { ok: false, refused: `Nothing to plan: ${twin.email} has no live key labeled ${JSON.stringify(label)}; ${gone.length === 1 ? 'the one that wore it was' : `the ${gone.length} that wore it were`} revoked already, the last ${gone[0]!.revoked_at}. ${liveWords}` }
      return { ok: false, refused: `No key labeled ${JSON.stringify(label)} on ${twin.email}. ${liveWords}` }
    }
  }
  const ids = new Set(chosen.map((k) => k.id))
  const stays = live.filter((k) => !ids.has(k.id))
  const n = chosen.length
  return {
    ok: true,
    twin,
    chosen,
    reply: {
      dry_run: true,
      twin: twinFactsOf(twin),
      revoke: chosen.map(twinKeyFacts),
      stays_live: stays.map(twinKeyFacts),
      then: `apply sets revoked_at on ${n === 1 ? 'that key' : `those ${n} keys`} as you, as Revoke on the twin's row at Settings → System → Digital twins does. A machine holding ${n === 1 ? 'it' : 'one'} is refused at its next call (Unknown or revoked twin token), and a Mac making the rounds with it finds no seat. There is no undo: a new key is mint_twin_setup_code { label, twin: "${twin.email}" }.${stays.length === 0 ? ` No live key is left on ${twin.email}: nothing can run it until one is minted.` : ''}`,
    },
  }
}

/** The write: the panel's own, revoked_at on the key's row. */
export function twinKeyRevokePatch(nowIso: string): Json {
  return { revoked_at: nowIso }
}

export type TwinKeyStep = { key_id: string; label: string; ok: boolean; words: string }

/** The line after the write: what was cut off, what was held and why, and how a key is made again. */
export function twinKeyAppliedWords(steps: readonly TwinKeyStep[], twin: TwinKeyTwinRow): string {
  const done = steps.filter((s) => s.ok)
  const held = steps.filter((s) => !s.ok)
  const names = (list: readonly TwinKeyStep[]) => list.map((s) => JSON.stringify(s.label)).join(', ')
  const doneWords = done.length ? `Revoked ${done.length} key${done.length === 1 ? '' : 's'} on ${twin.email}: ${names(done)}.` : `Nothing revoked on ${twin.email}.`
  const heldWords = held.length ? ` Held: ${held.map((s) => `${JSON.stringify(s.label)} (${s.words})`).join('; ')}. read_twin_keys says where each stands; plan again for a key still live.` : ''
  return `${doneWords}${heldWords} A new key is mint_twin_setup_code { label, twin: "${twin.email}" }.`
}
