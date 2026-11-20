// dev-mcp's plan_twin_archive / apply_twin_archive (v2.7970 / 0.115.0): a twin taken out of the fleet and brought
// back, as Archive on the twin's row and Restore in the fold under the fleet do at Settings → System → Digital twins
// (DigitalTwinsPanel.archiveTwin / restoreTwin, src/lib/twins/fleetArchive.ts). Archive is the panel's two steps in
// its order: the twin's live keys revoked on twin_credentials as the dev under the table's dev-only RLS, then
// archive-user called as the dev, which stamps archived_at and bans the sign-in as for any account. Restore is
// restore-user called as the dev. Both functions keep their own fences: the caller's role, never your own account.
// No new RPC and no dry-run wrapper: the dry run is the server's own read of the twin and its live keys as the dev,
// and the plan hash commits to the state the twin stands in and to those keys, so a twin archived, restored or given
// a key since the plan refuses the apply. The keys are read by a column list that never names token_hash and carries
// no usage date, so a robot working between plan and apply does not move the hash.
// The undo of an archive is this pair with restore: true; a key revoked on the way is not brought back, as in the
// panel. Pure: no network, no env. Tests: src/lib/devMcp/devMcpTwinArchive.test.ts.

import { TWIN_PANEL_DOOR } from './devMcpTwin.ts'
import { twinRef } from './devMcpTwinKey.ts'

type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)

export const TWIN_ARCHIVE_VERBS = ['plan_twin_archive', 'apply_twin_archive'] as const
export type TwinArchiveVerb = (typeof TWIN_ARCHIVE_VERBS)[number]
export function isTwinArchiveVerb(verb: string): verb is TwinArchiveVerb {
  return (TWIN_ARCHIVE_VERBS as readonly string[]).includes(verb)
}

/** What an archive verb carries after the shape check: the twin, and which of the two presses it is. */
export type TwinArchivePayload = { twin: string; action: 'archive' | 'restore' }
export type TwinArchiveInput = { ok: true; p: TwinArchivePayload; target: string } | { ok: false; error: string }

/** The ask's shape, refused in words: a twin, restore: true to bring it back, and no other key. */
export function twinArchiveInput(verb: TwinArchiveVerb, input: Json): TwinArchiveInput {
  const archive = obj(input.archive)
  const shape = `${verb} needs archive — { twin (the twin's users.id or its address, twin-estimator-N@twins.pipetooling.local) } takes it out of the fleet; { twin, restore: true } brings an archived one back. plan_twin lists the fleet.`
  if (!archive) return { ok: false, error: shape }
  const twin = twinRef(archive.twin)
  if (!twin) return { ok: false, error: shape }
  if (archive.restore !== undefined && archive.restore !== true) return { ok: false, error: `${verb}: restore is true or left out. Leaving it out archives the twin.` }
  const extra = Object.keys(archive).filter((k) => k !== 'twin' && k !== 'restore')
  if (extra.length) return { ok: false, error: `${verb}: archive takes twin and restore alone, not ${extra.join(', ')}.` }
  return { ok: true, p: { twin, action: archive.restore === true ? 'restore' : 'archive' }, target: twin }
}

/** The columns the server reads of the twin. */
export const TWIN_ARCHIVE_TWIN_SELECT = 'id,name,email,twin_kind,read_only,archived_at'
export type TwinArchiveTwinRow = { id: string; name: string | null; email: string; twin_kind: string | null; read_only: boolean | null; archived_at: string | null }

/**
 * The columns the server reads of the twin's live keys: what names a key and nothing that changes while a robot
 * works. token_hash is never among them, and neither is a usage date, so the plan hash holds while the twin runs.
 */
export const TWIN_ARCHIVE_KEY_SELECT = 'id,label,created_at'
export type TwinArchiveKeyRow = { id: string; label: string | null; created_at: string }

const nameOf = (t: Pick<TwinArchiveTwinRow, 'name' | 'email'>): string => (t.name ?? '').trim() || t.email
const kindOf = (t: Pick<TwinArchiveTwinRow, 'twin_kind'>): 'estimator' | 'pricer' => (t.twin_kind === 'pricer' ? 'pricer' : 'estimator')
const twinFactsOf = (t: TwinArchiveTwinRow): Json => ({
  id: t.id,
  email: t.email,
  name: t.name,
  kind: kindOf(t),
  rung: t.read_only ? 'read-only (rung 1)' : 'fenced writes (rung 2)',
  ...(t.archived_at ? { archived_at: t.archived_at } : {}),
})
const keyFacts = (k: TwinArchiveKeyRow): Json => ({ key_id: k.id, label: k.label ?? '', made_at: k.created_at })

/** The seats a twin of that kind holds in the other apps, which neither press reaches. */
function otherSeatsWords(t: Pick<TwinArchiveTwinRow, 'twin_kind'>): string {
  return kindOf(t) === 'pricer' ? '' : ' Its CountTooling and TakeoffTooling seats are not touched: both functions reach PipeTooling alone.'
}

export type TwinArchiveDryRun = { ok: true; action: 'archive' | 'restore'; reply: Json; twin: TwinArchiveTwinRow; liveKeys: TwinArchiveKeyRow[] } | { ok: false; refused: string }

/**
 * The dry run: the twin, the state it stands in and its live keys. Archive names the keys it revokes first; restore
 * says what the twin comes back with. No such twin, a twin already archived and a twin that is not archived are each
 * refused in words.
 */
export function twinArchiveDryRun(p: TwinArchivePayload, twin: TwinArchiveTwinRow | null, liveKeys: readonly TwinArchiveKeyRow[]): TwinArchiveDryRun {
  if (!twin) return { ok: false, refused: `No twin reads as ${p.twin}. plan_twin lists the fleet.` }
  const n = liveKeys.length
  if (p.action === 'archive') {
    if (twin.archived_at) return { ok: false, refused: `Nothing to plan: ${twin.email} is archived already, since ${twin.archived_at}. The way back is this pair with restore: true.` }
    const keyWords =
      n === 0
        ? 'No key is live on it, so there is none to revoke.'
        : `${n === 1 ? 'Its one live key is' : `Its ${n} live keys are`} revoked first, so no Mac or harness can run it: a machine holding one is refused at its next call, and a robot in the middle of a bid stops there.`
    return {
      ok: true,
      action: 'archive',
      twin,
      liveKeys: [...liveKeys],
      reply: {
        dry_run: true,
        action: 'archive',
        twin: twinFactsOf(twin),
        revoke_first: liveKeys.map(keyFacts),
        then: `apply archives ${nameOf(twin)} as you, as Archive on the twin's row at ${TWIN_PANEL_DOOR} does. ${keyWords} Then archive-user stamps archived_at and bans its sign-in, and the row moves to the fold under the fleet. Its runs, shadows and bids stay.${otherSeatsWords(twin)} The way back is this pair with restore: true; a revoked key does not come back, a new one is mint_twin_setup_code.`,
      },
    }
  }
  if (!twin.archived_at) return { ok: false, refused: `Nothing to plan: ${twin.email} is live, not archived. Leave restore out to archive it.` }
  const comesBack =
    n === 0
      ? 'It comes back to the fleet with no live key: mint_twin_setup_code makes one.'
      : `It comes back to the fleet with ${n === 1 ? 'one live key' : `${n} live keys`}: it was archived outside the panel, which revokes them first. The twin seat goes by the key alone, so a machine holding one could run it all the while; plan_twin_key_revoke cuts one off.`
  return {
    ok: true,
    action: 'restore',
    twin,
    liveKeys: [...liveKeys],
    reply: {
      dry_run: true,
      action: 'restore',
      twin: twinFactsOf(twin),
      live_keys: liveKeys.map(keyFacts),
      then: `apply restores ${nameOf(twin)} as you, as Restore in the fold under the fleet at ${TWIN_PANEL_DOOR} does: restore-user clears archived_at and lifts the ban on its sign-in. ${comesBack} It stands on the rung it left, ${twin.read_only ? 'read-only (rung 1)' : 'fenced writes (rung 2)'}. The way back is this pair without restore.`,
    },
  }
}

/** The keys filter the first write is held to: this twin's keys still live, the panel's own. */
export function twinArchiveKeysQuery(twin: Pick<TwinArchiveTwinRow, 'id'>): string {
  return `twin_user_id=eq.${twin.id}&revoked_at=is.null`
}

/**
 * The archive-user body, the panel's own (fleetArchive.archiveTwinBody): the account by its id, the email and name
 * for the function's words, and no customers to move, since a twin owns none. Held equal to the client's by test.
 */
export function twinArchiveBody(twin: Pick<TwinArchiveTwinRow, 'id' | 'email' | 'name'>): Json {
  return { user_id: twin.id, email: (twin.email ?? '').trim(), name: (twin.name ?? '').trim() }
}

/** The restore-user body, the panel's own: the account by its id and nothing else. */
export function twinRestoreBody(twin: Pick<TwinArchiveTwinRow, 'id'>): Json {
  return { user_id: twin.id }
}

/** The line after an archive: what went, what was held and why, and the way back. */
export function twinArchivedWords(twin: TwinArchiveTwinRow, out: { keysPlanned: number; keysRevoked: number | null; keysHeld: string; archived: boolean; archiveHeld: string }): string {
  const who = `${nameOf(twin)} (${twin.email})`
  if (out.keysRevoked === null) return `Nothing archived: the live keys of ${who} could not be revoked (${out.keysHeld}), so the twin stays in the fleet with its keys live. read_twin_keys says where each stands; plan again.`
  const keys =
    out.keysPlanned === 0
      ? ''
      : out.keysRevoked === out.keysPlanned
        ? ` ${out.keysRevoked === 1 ? 'Its one live key was' : `Its ${out.keysRevoked} live keys were`} revoked first.`
        : ` ${out.keysRevoked} of its ${out.keysPlanned} live keys were revoked; read_twin_keys says where the rest stand.`
  if (!out.archived) return `Not archived: archive-user refused ${who} (${out.archiveHeld}).${keys} It stays in the fleet${out.keysRevoked > 0 ? ' with no key that was revoked coming back' : ''}; plan again, since the plan hash names keys that are gone.`
  return `Archived ${who}.${keys} Its runs, shadows and bids stay. The way back is plan_twin_archive { archive: { twin: "${twin.email}", restore: true } }.`
}

/** The line after a restore: where it stands now, or why nothing moved. */
export function twinRestoredWords(twin: TwinArchiveTwinRow, liveKeys: number, restored: boolean, heldWords = ''): string {
  const who = `${nameOf(twin)} (${twin.email})`
  if (!restored) return `Not restored: restore-user refused ${who}${heldWords ? ` (${heldWords})` : ''}. It stays archived; plan_twin lists the fleet.`
  const keys = liveKeys === 0 ? `It has no live key yet: mint_twin_setup_code { label, twin: "${twin.email}" } makes one.` : `It holds ${liveKeys === 1 ? 'one live key' : `${liveKeys} live keys`}; read_twin_keys lists them.`
  return `Restored ${who} to the fleet. ${keys} The way back is plan_twin_archive { archive: { twin: "${twin.email}" } }.`
}
