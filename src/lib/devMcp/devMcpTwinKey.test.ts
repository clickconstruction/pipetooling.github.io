import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  TWIN_KEY_SELECT,
  TWIN_KEY_TWIN_SELECT,
  isTwinKeyVerb,
  twinKeyAppliedWords,
  twinKeyCommitment,
  twinKeyDryRun,
  twinKeyFacts,
  twinKeyInput,
  twinKeyRevokePatch,
  twinKeysReading,
  twinRef,
  twinRefQuery,
  type TwinKeyRow,
  type TwinKeyStep,
  type TwinKeyTwinRow,
} from '../../../supabase/functions/_shared/devMcpTwinKey'
import { DENIED_TABLES } from '../../../supabase/functions/_shared/devMcpDoor'
import { WRITE_VERBS, alreadyApplied, planHash, planVerbFor, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { CATALOG_TABLES } from '../../../supabase/functions/dev-mcp/catalog'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const EDGE = readFileSync('docs/EDGE_FUNCTIONS.md', 'utf8')
const PANEL = readFileSync('src/components/settings/DigitalTwinsPanel.tsx', 'utf8')

const TWIN_ID = '6a424303-0000-4000-8000-000000000001'
const EMAIL = 'twin-estimator-1@twins.pipetooling.local'
const twin: TwinKeyTwinRow = { id: TWIN_ID, name: 'Twin Estimator 1', email: EMAIL, twin_kind: null, archived_at: null }
const key = (n: number, over: Partial<TwinKeyRow> = {}): TwinKeyRow => ({
  id: `aaaaaaaa-0000-4000-8000-00000000000${n}`,
  twin_user_id: TWIN_ID,
  label: `Mac ${n}`,
  created_at: `2026-11-0${n}T12:00:00Z`,
  last_used_at: null,
  last_seen_at: null,
  revoked_at: null,
  stopped_at: null,
  ...over,
})
// Two machines live, one of them set up twice under one label, and two keys revoked on different days.
const KEYS: TwinKeyRow[] = [
  key(1, { label: 'Office Mac', last_seen_at: '2026-11-18T20:00:00Z' }),
  key(2, { label: 'office mac ', stopped_at: '2026-11-17T09:00:00Z' }),
  key(3, { label: 'Laptop' }),
  key(4, { label: 'Old Mac', revoked_at: '2026-10-01T00:00:00Z' }),
  key(5, { label: 'Old Mac', revoked_at: '2026-10-20T00:00:00Z' }),
]

describe('a twin\'s keys from the dev seat (v2.7900)', () => {
  it('the revoke is two write verbs on the allowlist with no wrapper RPC, and the list is not a write', () => {
    expect(WRITE_VERBS.plan_twin_key_revoke).toEqual({ rpc: null, step: 'plan' })
    expect(WRITE_VERBS.apply_twin_key_revoke).toEqual({ rpc: null, step: 'apply' })
    expect(isTwinKeyVerb('apply_twin_key_revoke')).toBe(true)
    expect(isTwinKeyVerb('read_twin_keys')).toBe(false)
    expect(planVerbFor('apply_twin_key_revoke')).toBe('plan_twin_key_revoke')
    expect(Object.keys(WRITE_VERBS)).not.toContain('read_twin_keys')
  })

  it('names a twin by its id or its fleet address, and nothing else', () => {
    expect(twinRef(` ${EMAIL.toUpperCase()} `)).toBe(EMAIL)
    expect(twinRef(TWIN_ID)).toBe(TWIN_ID)
    expect(twinRef('robert@example.com')).toBeNull()
    expect(twinRef('Twin Estimator 1')).toBeNull()
    expect(twinRef(7)).toBeNull()
    expect(twinRefQuery(EMAIL)).toBe('email=eq.twin-estimator-1%40twins.pipetooling.local&is_digital_twin=eq.true')
    expect(twinRefQuery(TWIN_ID)).toBe(`id=eq.${TWIN_ID}&is_digital_twin=eq.true`)
  })

  it('takes a twin and one of label or key_id, never both and never neither', () => {
    expect(twinKeyInput('plan_twin_key_revoke', { revoke: { twin: EMAIL, label: ' Office Mac ' } })).toEqual({ ok: true, p: { twin: EMAIL, label: 'Office Mac' }, target: EMAIL })
    expect(twinKeyInput('plan_twin_key_revoke', { revoke: { twin: TWIN_ID, key_id: KEYS[2]!.id.toUpperCase() } })).toEqual({ ok: true, p: { twin: TWIN_ID, key_id: KEYS[2]!.id }, target: TWIN_ID })
    for (const bad of [{}, { revoke: {} }, { revoke: { twin: EMAIL } }, { revoke: { label: 'Office Mac' } }, { revoke: { twin: EMAIL, label: 'a', key_id: KEYS[0]!.id } }, { revoke: { twin: 'someone@example.com', label: 'a' } }, { revoke: { twin: EMAIL, key_id: 'not-an-id' } }]) {
      const r = twinKeyInput('plan_twin_key_revoke', bad as Record<string, unknown>)
      expect(r.ok, JSON.stringify(bad)).toBe(false)
      if (!r.ok) expect(r.error).toContain('plan_twin_key_revoke needs revoke — { twin')
    }
    const long = twinKeyInput('apply_twin_key_revoke', { revoke: { twin: EMAIL, label: 'x'.repeat(81) } })
    expect(long.ok).toBe(false)
    if (!long.ok) expect(long.error).toBe("apply_twin_key_revoke: a key's label is at most 80 characters.")
    expect(writeRpcBody('apply_twin_key_revoke', { revoke: { twin: EMAIL, label: 'Laptop' } }).ok).toBe(false) // an apply quotes its plan
    expect(writeRpcBody('apply_twin_key_revoke', { revoke: { twin: EMAIL, label: 'Laptop' }, plan_hash: 'b'.repeat(64) })).toMatchObject({ ok: true, rpc: null, step: 'apply', body: { p: { twin: EMAIL, label: 'Laptop' } } })
  })

  it('never reads a key\'s hash: the column lists hold no token_hash, and read_rows still refuses the table', () => {
    const cols = Object.keys(CATALOG_TABLES.twin_credentials!.columns)
    expect(cols).toContain('token_hash')
    for (const c of TWIN_KEY_SELECT.split(',')) expect(cols, c).toContain(c)
    expect(TWIN_KEY_SELECT.split(',')).not.toContain('token_hash')
    expect(TWIN_KEY_SELECT).not.toContain('*')
    for (const c of TWIN_KEY_TWIN_SELECT.split(',')) expect(Object.keys(CATALOG_TABLES.users!.columns), c).toContain(c)
    expect(DENIED_TABLES.has('twin_credentials')).toBe(true)
    expect(JSON.stringify(twinKeyFacts(KEYS[0]!))).not.toMatch(/hash|token/i)
  })

  it('a label takes every live key wearing it, whatever its case or padding, and says what stays', () => {
    const dry = twinKeyDryRun({ twin: EMAIL, label: 'OFFICE MAC' }, twin, KEYS)
    expect(dry.ok).toBe(true)
    if (!dry.ok) return
    expect(dry.chosen.map((k) => k.id)).toEqual([KEYS[0]!.id, KEYS[1]!.id])
    expect(dry.reply.twin).toEqual({ id: TWIN_ID, email: EMAIL, name: 'Twin Estimator 1', kind: 'estimator', archived: false })
    expect(dry.reply.revoke).toEqual([
      { key_id: KEYS[0]!.id, label: 'Office Mac', state: 'live', made_at: '2026-11-01T12:00:00Z', last_used_at: null, last_seen_at: '2026-11-18T20:00:00Z' },
      { key_id: KEYS[1]!.id, label: 'office mac ', state: 'live', made_at: '2026-11-02T12:00:00Z', last_used_at: null, last_seen_at: null, rounds: 'stopped since 2026-11-17T09:00:00Z' },
    ])
    expect((dry.reply.stays_live as Array<Record<string, unknown>>).map((k) => k.label)).toEqual(['Laptop'])
    expect(String(dry.reply.then)).toContain('apply sets revoked_at on those 2 keys as you')
    expect(String(dry.reply.then)).toContain(`There is no undo: a new key is mint_twin_setup_code { label, twin: "${EMAIL}" }.`)
    expect(String(dry.reply.then)).not.toContain('No live key is left')
  })

  it('a key id takes one key, and the plan says when no live key would be left', () => {
    const only = [KEYS[2]!, KEYS[3]!]
    const dry = twinKeyDryRun({ twin: EMAIL, key_id: KEYS[2]!.id }, twin, only)
    expect(dry.ok).toBe(true)
    if (!dry.ok) return
    expect(dry.chosen).toEqual([KEYS[2]])
    expect(dry.reply.stays_live).toEqual([])
    expect(String(dry.reply.then)).toContain('apply sets revoked_at on that key as you')
    expect(String(dry.reply.then)).toContain(`No live key is left on ${EMAIL}: nothing can run it until one is minted.`)
  })

  it('refuses in words: no twin, no such key, a key already revoked, each with the labels that are live', () => {
    const none = twinKeyDryRun({ twin: EMAIL, label: 'Laptop' }, null, [])
    expect(none).toEqual({ ok: false, refused: `No twin reads as ${EMAIL}. read_twin_keys lists every twin with its keys.` })
    const unknown = twinKeyDryRun({ twin: EMAIL, label: 'Shop Mac' }, twin, KEYS)
    expect(unknown.ok).toBe(false)
    if (!unknown.ok) expect(unknown.refused).toBe(`No key labeled "Shop Mac" on ${EMAIL}. Its live keys: "Office Mac" (${KEYS[0]!.id}), "office mac " (${KEYS[1]!.id}), "Laptop" (${KEYS[2]!.id}).`)
    const gone = twinKeyDryRun({ twin: EMAIL, label: 'old mac' }, twin, KEYS)
    expect(gone.ok).toBe(false)
    if (!gone.ok) expect(gone.refused).toContain(`Nothing to plan: ${EMAIL} has no live key labeled "old mac"; the 2 that wore it were revoked already, the last 2026-10-20T00:00:00Z.`)
    const goneById = twinKeyDryRun({ twin: EMAIL, key_id: KEYS[3]!.id }, twin, KEYS)
    expect(goneById.ok).toBe(false)
    if (!goneById.ok) expect(goneById.refused).toContain('Nothing to plan: the key "Old Mac" on twin-estimator-1@twins.pipetooling.local was revoked already, 2026-10-01T00:00:00Z.')
    const stranger = twinKeyDryRun({ twin: EMAIL, key_id: 'bbbbbbbb-0000-4000-8000-000000000009' }, twin, KEYS)
    expect(stranger.ok).toBe(false)
    if (!stranger.ok) expect(stranger.refused).toContain(`No key bbbbbbbb-0000-4000-8000-000000000009 on ${EMAIL}.`)
    const bare = twinKeyDryRun({ twin: EMAIL, label: 'Laptop' }, twin, [KEYS[3]!])
    if (!bare.ok) expect(bare.refused).toContain('It has no live key.')
  })

  it('the plan commits to the keys as they read: one revoked or minted since changes the hash', async () => {
    const p = { twin: EMAIL, label: 'Office Mac' }
    const before = twinKeyDryRun(p, twin, KEYS)
    const same = twinKeyDryRun(p, twin, [...KEYS])
    const oneGone = twinKeyDryRun(p, twin, KEYS.map((k) => (k.id === KEYS[1]!.id ? { ...k, revoked_at: '2026-11-19T01:00:00Z' } : k)))
    const oneMore = twinKeyDryRun(p, twin, [...KEYS, key(6, { label: 'New Mac' })])
    if (!before.ok || !same.ok || !oneGone.ok || !oneMore.ok) throw new Error('dry run refused')
    const hash = await planHash('plan_twin_key_revoke', p, before.reply)
    expect(await planHash('apply_twin_key_revoke', p, same.reply)).toBe(hash)
    expect(await planHash('apply_twin_key_revoke', p, oneGone.reply)).not.toBe(hash)
    expect(await planHash('apply_twin_key_revoke', p, oneMore.reply)).not.toBe(hash)
  })

  it('a key used between plan and apply does not move the hash: the plan shows its usage dates and commits to none (v2.7918)', async () => {
    const p = { twin: EMAIL, label: 'Office Mac' }
    const before = twinKeyDryRun(p, twin, KEYS)
    // twin-mcp stamps last_seen_at once a minute while a robot works, twin-login stamps last_used_at at each sign-in.
    const worked = twinKeyDryRun(p, twin, KEYS.map((k) => (k.revoked_at ? k : { ...k, last_seen_at: '2026-11-19T03:01:00Z', last_used_at: '2026-11-19T03:00:00Z' })))
    if (!before.ok || !worked.ok) throw new Error('dry run refused')
    expect(JSON.stringify(worked.reply)).toContain('2026-11-19T03:01:00Z') // still shown
    expect(before.reply).not.toEqual(worked.reply)
    expect(await planHash('apply_twin_key_revoke', p, worked.reply)).toBe(await planHash('plan_twin_key_revoke', p, before.reply))
    expect(twinKeyCommitment((worked.reply.revoke as unknown[]))).toEqual((worked.reply.revoke as Array<Record<string, unknown>>).map(({ last_used_at: _u, last_seen_at: _s, ...rest }) => rest))
    expect(twinKeyCommitment(undefined)).toBeNull()
    // The dates are the only thing left out: a key whose rounds were stopped since still moves it.
    const stopped = twinKeyDryRun(p, twin, KEYS.map((k) => (k.id === KEYS[0]!.id ? { ...k, stopped_at: '2026-11-19T03:02:00Z' } : k)))
    if (!stopped.ok) throw new Error('dry run refused')
    expect(await planHash('apply_twin_key_revoke', p, stopped.reply)).not.toBe(await planHash('plan_twin_key_revoke', p, before.reply))
  })

  it('the write is the panel\'s, and the closing line names what was cut off and what was held', () => {
    expect(twinKeyRevokePatch('2026-11-19T02:00:00Z')).toEqual({ revoked_at: '2026-11-19T02:00:00Z' })
    expect(PANEL).toContain(".update({ revoked_at: new Date().toISOString() })\n        .eq('id', c.id)")
    const steps: TwinKeyStep[] = [
      { key_id: KEYS[0]!.id, label: 'Office Mac', ok: true, words: 'revoked' },
      { key_id: KEYS[1]!.id, label: 'office mac ', ok: false, words: 'no live row changed: it was revoked a moment ago, or RLS let no row through' },
    ]
    expect(twinKeyAppliedWords(steps, twin)).toBe(`Revoked 1 key on ${EMAIL}: "Office Mac". Held: "office mac " (no live row changed: it was revoked a moment ago, or RLS let no row through). read_twin_keys says where each stands; plan again for a key still live. A new key is mint_twin_setup_code { label, twin: "${EMAIL}" }.`)
    expect(twinKeyAppliedWords([steps[1]!], twin)).toContain(`Nothing revoked on ${EMAIL}.`)
    expect(alreadyApplied('apply_twin_key_revoke', { target: EMAIL, at: null })).toContain('Nothing written: this plan was already applied')
  })

  it('the list answers each twin with its live keys whole and its revoked keys counted, the last revoked first', () => {
    const pricer: TwinKeyTwinRow = { id: 'cccccccc-0000-4000-8000-000000000001', name: 'Twin Pricer 1', email: 'twin-pricer-1@twins.pipetooling.local', twin_kind: 'pricer', archived_at: '2026-11-01T00:00:00Z' }
    const reading = twinKeysReading([twin, pricer], KEYS, false) as { twins: Array<Record<string, unknown>>; reading: string; next: string }
    expect(reading.twins).toHaveLength(2)
    expect((reading.twins[0]!.live_keys as unknown[]).length).toBe(3)
    expect(reading.twins[0]!.revoked_keys).toEqual({ count: 2, newest: [{ key_id: KEYS[4]!.id, label: 'Old Mac', revoked_at: '2026-10-20T00:00:00Z' }, { key_id: KEYS[3]!.id, label: 'Old Mac', revoked_at: '2026-10-01T00:00:00Z' }] })
    expect(reading.twins[1]).toMatchObject({ email: 'twin-pricer-1@twins.pipetooling.local', kind: 'pricer', archived: true, live_keys: [], revoked_keys: { count: 0, newest: [] } })
    expect(reading.reading).toBe('3 live keys on 1 of 2 twins.')
    expect((twinKeysReading([twin], KEYS, true) as { reading: string }).reading).toContain('The key read stopped at its limit')
    expect(JSON.stringify(reading)).not.toMatch(/token_hash/)
    const many = Array.from({ length: 8 }, (_, i) => key(i + 1, { revoked_at: `2026-10-1${i}T00:00:00Z` }))
    const cut = (twinKeysReading([twin], many, false) as { twins: Array<{ revoked_keys: { count: number; newest: unknown[] } }> }).twins[0]!.revoked_keys
    expect([cut.count, cut.newest.length]).toEqual([8, 5])
  })

  it('the server declares the three verbs, reads the table by the fixed list alone, and the docs carry the door', () => {
    for (const verb of ['read_twin_keys', 'plan_twin_key_revoke', 'apply_twin_key_revoke']) {
      expect(SERVER).toContain(`name: '${verb}'`)
      expect(SERVER).toContain(`case '${verb}':`)
    }
    const from = SERVER.indexOf("case 'read_twin_keys':")
    const branch = SERVER.slice(from, SERVER.indexOf("case 'plan_twin_rung':", from))
    expect(branch).toContain("if (who.role !== 'dev') return refused('read_twin_keys is for devs")
    expect(branch).toContain("if (who.role !== 'dev') return refused(`${name} writes, and only a dev's own key may write.`)")
    // Every read of the table in the seat goes through the one column list, and the write asks for the id alone.
    const reads = SERVER.match(/restGet\(session, 'twin_credentials', `select=([^&`]+)/g) ?? []
    // v2.7918: the rung pair reads the twin's live keys by its own, shorter list (devMcpTwinRung.test.ts).
    expect(reads.map((r) => /select=\$\{(\w+)\}/.exec(r)?.[1])).toEqual(['TWIN_KEY_SELECT', 'TWIN_KEY_SELECT', 'TWIN_RUNG_KEY_SELECT', 'PRICER_KEY_SELECT', 'TWIN_ARCHIVE_KEY_SELECT', 'ROUNDS_KEY_SELECT']) // v2.7970: the archive and rounds plans read a twin's live keys by columns that name no hash (devMcpTwinArchive.test.ts, devMcpRoundsStop.test.ts); v2.7958: the price matrix plan counts a pricing robot's live keys by id (devMcpPriceMatrix.test.ts)
    expect(branch).toContain("await restRows(session, 'PATCH', 'twin_credentials', `id=eq.${key.id}&revoked_at=is.null&select=id`, patch, 'return=representation')")
    expect(SERVER.match(/rest(Rows|Post)\(session, '(PATCH|POST|DELETE)', 'twin_credentials'/g)).toHaveLength(2) // two writes of the table: this one, and the archive pair's revoke of a twin's live keys before archive-user (v2.7970, devMcpTwinArchive.test.ts)
    expect(branch).not.toContain('token_hash')
    expect(branch).toContain('if (fresh !== built.planHash) return refused(planMismatch(')
    expect(SERVER).toContain("const SERVER_VERSION = '0.115.0'")
    expect(SERVER).toContain('Writes are one hundred and forty-five verbs and nothing else')
    expect(SERVER).toContain('plan_twin_key_revoke → apply_twin_key_revoke (a twin')
    expect(README).toContain('| `read_twin_keys(twin?)` · `plan_twin_key_revoke(revoke)` · `apply_twin_key_revoke(revoke, plan_hash)` |')
    expect(README).toContain("one hundred and thirty-one since v2.7900's key revoke")
    expect(README).toContain('one hundred and forty-five `plan_` / `apply_` / `revert_` verbs')
    expect(EDGE).toContain("v2.7900 (server 0.107.0) — a twin's keys listed, and one cut off")
  })
})
