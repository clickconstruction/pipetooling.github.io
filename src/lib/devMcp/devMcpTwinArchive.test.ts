import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  TWIN_ARCHIVE_KEY_SELECT,
  TWIN_ARCHIVE_TWIN_SELECT,
  isTwinArchiveVerb,
  twinArchiveBody,
  twinArchiveDryRun,
  twinArchiveInput,
  twinArchiveKeysQuery,
  twinArchivedWords,
  twinRestoreBody,
  twinRestoredWords,
  type TwinArchiveKeyRow,
  type TwinArchiveTwinRow,
} from '../../../supabase/functions/_shared/devMcpTwinArchive'
import { twinRungDryRun } from '../../../supabase/functions/_shared/devMcpTwinRung'
import { WRITE_VERBS, alreadyApplied, planHash, planVerbFor, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { archiveTwinBody } from '../twins/fleetArchive'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const EDGE = readFileSync('docs/EDGE_FUNCTIONS.md', 'utf8')
const PANEL = readFileSync('src/components/settings/DigitalTwinsPanel.tsx', 'utf8')
const ARCHIVE_FN = readFileSync('supabase/functions/archive-user/index.ts', 'utf8')
const RESTORE_FN = readFileSync('supabase/functions/restore-user/index.ts', 'utf8')
const TYPES = readFileSync('src/types/database.ts', 'utf8')

const TWIN_ID = '6a424303-0000-4000-8000-000000000004'
const EMAIL = 'twin-estimator-4@twins.pipetooling.local'
const twin = (over: Partial<TwinArchiveTwinRow> = {}): TwinArchiveTwinRow => ({ id: TWIN_ID, name: 'Twin Estimator 4', email: EMAIL, twin_kind: null, read_only: true, archived_at: null, ...over })
const key = (n: number, label: string): TwinArchiveKeyRow => ({ id: `aaaaaaaa-0000-4000-8000-00000000000${n}`, label, created_at: `2026-11-1${n}T12:00:00Z` })
const KEYS = [key(1, 'Office Mac'), key(2, 'Laptop')]
const GONE = '2026-11-01T00:00:00Z'

describe('a twin archived and restored from the dev seat (v2.7970)', () => {
  it('is two write verbs on the allowlist with no wrapper RPC', () => {
    expect(WRITE_VERBS.plan_twin_archive).toEqual({ rpc: null, step: 'plan' })
    expect(WRITE_VERBS.apply_twin_archive).toEqual({ rpc: null, step: 'apply' })
    expect(isTwinArchiveVerb('apply_twin_archive')).toBe(true)
    expect(isTwinArchiveVerb('plan_twin')).toBe(false)
    expect(planVerbFor('apply_twin_archive')).toBe('plan_twin_archive')
  })

  it('takes a twin, restore: true or nothing, and no other key', () => {
    expect(twinArchiveInput('plan_twin_archive', { archive: { twin: EMAIL.toUpperCase() } })).toEqual({ ok: true, p: { twin: EMAIL, action: 'archive' }, target: EMAIL })
    expect(twinArchiveInput('plan_twin_archive', { archive: { twin: TWIN_ID, restore: true } })).toEqual({ ok: true, p: { twin: TWIN_ID, action: 'restore' }, target: TWIN_ID })
    for (const bad of [{}, { archive: null }, { archive: { twin: 'wendi@example.com' } }, { archive: { twin: '' } }]) {
      const r = twinArchiveInput('plan_twin_archive', bad as Record<string, unknown>)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toContain('plan_twin_archive needs archive')
    }
    const notTrue = twinArchiveInput('plan_twin_archive', { archive: { twin: EMAIL, restore: false } })
    expect(notTrue).toEqual({ ok: false, error: 'plan_twin_archive: restore is true or left out. Leaving it out archives the twin.' })
    const extra = twinArchiveInput('apply_twin_archive', { archive: { twin: EMAIL, reassign_customers_to: TWIN_ID, name: 'x' } })
    expect(extra).toEqual({ ok: false, error: 'apply_twin_archive: archive takes twin and restore alone, not reassign_customers_to, name.' })
    // The write list hands the same shape check on, plan and apply.
    const built = writeRpcBody('apply_twin_archive', { archive: { twin: EMAIL }, plan_hash: 'a'.repeat(64) })
    expect(built).toMatchObject({ ok: true, rpc: null, step: 'apply', body: { p: { twin: EMAIL, action: 'archive' } }, target: EMAIL, planHash: 'a'.repeat(64) })
  })

  it('never reads a key\'s hash or a usage date', () => {
    expect(TWIN_ARCHIVE_KEY_SELECT.split(',')).toEqual(['id', 'label', 'created_at'])
    const users = TYPES.slice(TYPES.indexOf('      users: {\n        Row: {'))
    for (const c of TWIN_ARCHIVE_TWIN_SELECT.split(',')) expect(users.slice(0, users.indexOf('Insert: {')), c).toContain(`          ${c}:`)
  })

  it('plans the archive: the twin, the keys revoked first, what stays and the way back', () => {
    const dry = twinArchiveDryRun({ twin: EMAIL, action: 'archive' }, twin(), KEYS)
    expect(dry.ok).toBe(true)
    if (!dry.ok) return
    expect(dry.action).toBe('archive')
    expect(dry.liveKeys).toEqual(KEYS)
    expect(dry.reply.twin).toEqual({ id: TWIN_ID, email: EMAIL, name: 'Twin Estimator 4', kind: 'estimator', rung: 'read-only (rung 1)' })
    expect(dry.reply.revoke_first).toEqual([
      { key_id: KEYS[0]!.id, label: 'Office Mac', made_at: KEYS[0]!.created_at },
      { key_id: KEYS[1]!.id, label: 'Laptop', made_at: KEYS[1]!.created_at },
    ])
    const then = String(dry.reply.then)
    expect(then).toContain('apply archives Twin Estimator 4 as you, as Archive on the twin\'s row at Settings → System → Digital twins does.')
    expect(then).toContain('Its 2 live keys are revoked first, so no Mac or harness can run it')
    expect(then).toContain('Then archive-user stamps archived_at and bans its sign-in')
    expect(then).toContain('Its runs, shadows and bids stay.')
    expect(then).toContain('Its CountTooling and TakeoffTooling seats are not touched')
    expect(then).toContain('The way back is this pair with restore: true; a revoked key does not come back')
    const one = twinArchiveDryRun({ twin: EMAIL, action: 'archive' }, twin(), [KEYS[0]!])
    expect(one.ok && String(one.reply.then)).toContain('Its one live key is revoked first')
    const none = twinArchiveDryRun({ twin: EMAIL, action: 'archive' }, twin({ twin_kind: 'pricer' }), [])
    expect(none.ok && String(none.reply.then)).toContain('No key is live on it, so there is none to revoke.')
    // A pricing robot has no seats in the other apps, so the plan names none.
    expect(none.ok && String(none.reply.then)).not.toContain('CountTooling')
  })

  it('plans the restore: with no key after an archive from here, and with the keys an outside archive left live', () => {
    const dry = twinArchiveDryRun({ twin: EMAIL, action: 'restore' }, twin({ archived_at: GONE, read_only: false }), [])
    expect(dry.ok).toBe(true)
    if (!dry.ok) return
    expect(dry.action).toBe('restore')
    expect(dry.reply.twin).toEqual({ id: TWIN_ID, email: EMAIL, name: 'Twin Estimator 4', kind: 'estimator', rung: 'fenced writes (rung 2)', archived_at: GONE })
    expect(dry.reply.live_keys).toEqual([])
    const then = String(dry.reply.then)
    expect(then).toContain('as Restore in the fold under the fleet at Settings → System → Digital twins does: restore-user clears archived_at and lifts the ban on its sign-in.')
    expect(then).toContain('It comes back to the fleet with no live key: mint_twin_setup_code makes one.')
    expect(then).toContain('It stands on the rung it left, fenced writes (rung 2).')
    const kept = twinArchiveDryRun({ twin: EMAIL, action: 'restore' }, twin({ archived_at: GONE }), [KEYS[0]!])
    expect(kept.ok && String(kept.reply.then)).toContain('It comes back to the fleet with one live key: it was archived outside the panel, which revokes them first. The twin seat goes by the key alone')
  })

  it('refuses in words: no twin, a twin archived already, a twin that is not archived', () => {
    expect(twinArchiveDryRun({ twin: EMAIL, action: 'archive' }, null, [])).toEqual({ ok: false, refused: `No twin reads as ${EMAIL}. plan_twin lists the fleet.` })
    expect(twinArchiveDryRun({ twin: EMAIL, action: 'archive' }, twin({ archived_at: GONE }), [])).toEqual({ ok: false, refused: `Nothing to plan: ${EMAIL} is archived already, since ${GONE}. The way back is this pair with restore: true.` })
    expect(twinArchiveDryRun({ twin: EMAIL, action: 'restore' }, twin(), KEYS)).toEqual({ ok: false, refused: `Nothing to plan: ${EMAIL} is live, not archived. Leave restore out to archive it.` })
    // The rung pair's refusal for an archived twin names this pair as the way back.
    const rung = twinRungDryRun({ twin: EMAIL, to: 2 }, twin({ archived_at: GONE }), [])
    expect(!rung.ok && rung.refused).toContain('plan_twin_archive with restore: true brings it back first.')
  })

  it('the plan commits to the twin\'s state and to its live keys: a key minted or revoked since changes the hash', async () => {
    const p = { twin: EMAIL, action: 'archive' as const }
    const a = twinArchiveDryRun(p, twin(), KEYS)
    const same = twinArchiveDryRun(p, twin(), KEYS)
    const fewer = twinArchiveDryRun(p, twin(), [KEYS[0]!])
    const graduated = twinArchiveDryRun(p, twin({ read_only: false }), KEYS)
    if (!a.ok || !same.ok || !fewer.ok || !graduated.ok) throw new Error('each plans')
    const h = await planHash('plan_twin_archive', p, a.reply)
    expect(await planHash('apply_twin_archive', p, same.reply)).toBe(h)
    expect(await planHash('plan_twin_archive', p, fewer.reply)).not.toBe(h)
    expect(await planHash('plan_twin_archive', p, graduated.reply)).not.toBe(h)
    expect(alreadyApplied('apply_twin_archive', { at: '2026-11-19T12:00:00Z', target: EMAIL })).toContain('The twin stands as it left it')
  })

  it('the writes are the panel\'s: every live key of the twin, then the function\'s own body', () => {
    expect(twinArchiveKeysQuery({ id: TWIN_ID })).toBe(`twin_user_id=eq.${TWIN_ID}&revoked_at=is.null`)
    expect(PANEL).toContain(".eq('twin_user_id', t.id)\n          .is('revoked_at', null)")
    // The body is the client's own, held equal: the account by its id, the email and name for the words, no customers.
    for (const t of [twin(), twin({ name: '  Twin Estimator 4 ' }), twin({ name: null })]) {
      expect(twinArchiveBody(t)).toEqual(archiveTwinBody(t))
    }
    expect(Object.keys(twinArchiveBody(twin()))).toEqual(['user_id', 'email', 'name'])
    expect(twinRestoreBody(twin())).toEqual({ user_id: TWIN_ID })
    expect(PANEL).toContain("supabase.functions.invoke('archive-user', { body: archiveTwinBody(t) })")
    expect(PANEL).toContain("supabase.functions.invoke('restore-user', { body: { user_id: t.id } })")
    // Both functions take a dev and answer a refusal as { error }, which the server reads.
    expect(ARCHIVE_FN).toContain("let callerAllowed = callerRole === 'dev' || callerRole === 'controller'")
    expect(RESTORE_FN).toContain("JSON.stringify({ error: 'User is not archived' })")
    expect(ARCHIVE_FN).not.toContain('ct-bridge')
    expect(ARCHIVE_FN).not.toContain('tt-bridge')
  })

  it('the closing line says what went, what was held and why, and the way back', () => {
    const t = twin()
    expect(twinArchivedWords(t, { keysPlanned: 2, keysRevoked: 2, keysHeld: '', archived: true, archiveHeld: '' })).toBe(
      `Archived Twin Estimator 4 (${EMAIL}). Its 2 live keys were revoked first. Its runs, shadows and bids stay. The way back is plan_twin_archive { archive: { twin: "${EMAIL}", restore: true } }.`,
    )
    expect(twinArchivedWords(t, { keysPlanned: 0, keysRevoked: 0, keysHeld: '', archived: true, archiveHeld: '' })).toBe(
      `Archived Twin Estimator 4 (${EMAIL}). Its runs, shadows and bids stay. The way back is plan_twin_archive { archive: { twin: "${EMAIL}", restore: true } }.`,
    )
    const keysRefused = twinArchivedWords(t, { keysPlanned: 2, keysRevoked: null, keysHeld: 'answered 403', archived: false, archiveHeld: '' })
    expect(keysRefused).toContain('Nothing archived: the live keys of Twin Estimator 4')
    expect(keysRefused).toContain('(answered 403), so the twin stays in the fleet with its keys live.')
    const fnRefused = twinArchivedWords(t, { keysPlanned: 1, keysRevoked: 1, keysHeld: '', archived: false, archiveHeld: 'Cannot archive your own account' })
    expect(fnRefused).toContain('Not archived: archive-user refused Twin Estimator 4')
    expect(fnRefused).toContain('(Cannot archive your own account). Its one live key was revoked first.')
    expect(fnRefused).toContain('plan again, since the plan hash names keys that are gone.')
    expect(twinRestoredWords(t, 0, true)).toBe(`Restored Twin Estimator 4 (${EMAIL}) to the fleet. It has no live key yet: mint_twin_setup_code { label, twin: "${EMAIL}" } makes one. The way back is plan_twin_archive { archive: { twin: "${EMAIL}" } }.`)
    expect(twinRestoredWords(t, 2, true)).toContain('It holds 2 live keys; read_twin_keys lists them.')
    expect(twinRestoredWords(t, 0, false, 'User is not archived')).toBe(`Not restored: restore-user refused Twin Estimator 4 (${EMAIL}) (User is not archived). It stays archived; plan_twin lists the fleet.`)
  })

  it('the server declares the pair, revokes the keys before the archive, and the docs carry the door', () => {
    for (const verb of ['plan_twin_archive', 'apply_twin_archive']) {
      expect(SERVER).toContain(`name: '${verb}'`)
      expect(SERVER).toContain(`case '${verb}':`)
    }
    const from = SERVER.indexOf("case 'plan_twin_archive':")
    const branch = SERVER.slice(from, SERVER.indexOf("case 'plan_rounds_stop':", from))
    expect(branch).toContain("if (who.role !== 'dev') return refused(`${name} writes, and only a dev's own key may write.`)")
    // The twin is found through twinRefQuery alone, which holds the read to is_digital_twin: a person is never archived here.
    expect(branch).toContain("await restGet(session, 'users', `select=${TWIN_ARCHIVE_TWIN_SELECT}&${twinRefQuery(p.twin)}&limit=1`)")
    expect(branch).toContain("await restGet(session, 'twin_credentials', `select=${TWIN_ARCHIVE_KEY_SELECT}&twin_user_id=eq.${twinRow.id}&revoked_at=is.null&order=created_at.desc&limit=1000`)")
    const keysWrite = branch.indexOf("await restRows(session, 'PATCH', 'twin_credentials', `${twinArchiveKeysQuery(dry.twin)}&select=id`, twinKeyRevokePatch(new Date().toISOString()), 'return=representation')")
    const archiveCall = branch.indexOf("await invokeAsDev(session, 'archive-user', twinArchiveBody(dry.twin))")
    const stopOnKeys = branch.indexOf('if (keysRevoked === null) return ok({ archived: false')
    expect(keysWrite).toBeGreaterThan(0)
    expect(stopOnKeys).toBeGreaterThan(keysWrite)
    expect(archiveCall).toBeGreaterThan(stopOnKeys) // the keys first; a refused key write never reaches the archive
    expect(branch).toContain("await invokeAsDev(session, 'restore-user', twinRestoreBody(dry.twin))")
    expect(branch.match(/restRows\(/g)).toHaveLength(1) // one table write, and it is the keys
    expect(branch.match(/invokeAsDev\(/g)).toHaveLength(2) // archive-user and restore-user, and no other function
    expect(branch).not.toContain('token_hash')
    expect(branch).toContain('if (fresh !== built.planHash) return refused(planMismatch(')
    expect(branch).toContain('const prior = await hooks.priorApply(name, fresh)')
    expect(SERVER).toContain("const SERVER_VERSION = '0.123.0'")
    expect(SERVER).toContain('Writes are one hundred and fifty-four verbs and nothing else')
    expect(SERVER).toContain('plan_twin_archive → apply_twin_archive (a twin taken out of the fleet as Archive on the twin\'s row')
    expect(README).toContain('| `plan_twin_archive(archive)` · `apply_twin_archive(archive, plan_hash)` |')
    expect(README).toContain("one hundred and forty-five since v2.7970's archive and rounds pairs")
    expect(README).toContain('one hundred and fifty-four `plan_` / `apply_` / `revert_` verbs')
    expect(EDGE).toContain('v2.7970 (server 0.115.0) — a twin archived and the rounds stopped from the seat')
  })
})
