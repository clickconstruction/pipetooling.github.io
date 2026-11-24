import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  TWIN_RUNG_KEY_SELECT,
  TWIN_RUNG_TWIN_SELECT,
  TWIN_RUNG_WORDS,
  isTwinRungVerb,
  twinRungAppliedWords,
  twinRungDryRun,
  twinRungInput,
  twinRungOf,
  twinRungPatch,
  twinRungPatchQuery,
  type TwinRungKeyRow,
  type TwinRungTwinRow,
} from '../../../supabase/functions/_shared/devMcpTwinRung'
import { twinDryRun, twinAppliedWords } from '../../../supabase/functions/_shared/devMcpTwin'
import { WRITE_VERBS, alreadyApplied, planHash, planVerbFor, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const EDGE = readFileSync('docs/EDGE_FUNCTIONS.md', 'utf8')
const PANEL = readFileSync('src/components/settings/DigitalTwinsPanel.tsx', 'utf8')

const TWIN_ID = '6a424303-0000-4000-8000-000000000004'
const EMAIL = 'twin-estimator-4@twins.pipetooling.local'
const twin = (over: Partial<TwinRungTwinRow> = {}): TwinRungTwinRow => ({ id: TWIN_ID, name: 'Twin Estimator 4', email: EMAIL, twin_kind: null, read_only: true, archived_at: null, ...over })
const key = (n: number, label: string): TwinRungKeyRow => ({ id: `aaaaaaaa-0000-4000-8000-00000000000${n}`, label, created_at: `2026-11-1${n}T12:00:00Z` })
const KEYS = [key(1, 'Office Mac'), key(2, 'Laptop')]

describe('a twin\'s rung from the dev seat (v2.7918)', () => {
  it('is two write verbs on the allowlist with no wrapper RPC', () => {
    expect(WRITE_VERBS.plan_twin_rung).toEqual({ rpc: null, step: 'plan' })
    expect(WRITE_VERBS.apply_twin_rung).toEqual({ rpc: null, step: 'apply' })
    expect(isTwinRungVerb('apply_twin_rung')).toBe(true)
    expect(isTwinRungVerb('plan_twin')).toBe(false)
    expect(planVerbFor('apply_twin_rung')).toBe('plan_twin_rung')
  })

  it('reads the rung off read_only by the panel\'s own rule', () => {
    expect([twinRungOf(true), twinRungOf(false), twinRungOf(null), twinRungOf(undefined)]).toEqual([1, 2, 2, 2])
    expect(PANEL).toContain('const currentRung = t.read_only ? 1 : 2')
  })

  it('takes a twin and a rung of 1 or 2, and nothing else', () => {
    const good = twinRungInput('plan_twin_rung', { rung: { twin: ` ${EMAIL.toUpperCase()} `, to: 2 } })
    expect(good).toEqual({ ok: true, p: { twin: EMAIL, to: 2 }, target: EMAIL })
    expect(twinRungInput('plan_twin_rung', { rung: { twin: TWIN_ID, to: 1 } })).toMatchObject({ ok: true, p: { twin: TWIN_ID, to: 1 } })
    for (const bad of [{}, { rung: 'two' }, { rung: { to: 2 } }, { rung: { twin: 'robert@example.com', to: 2 } }, { rung: { twin: EMAIL } }, { rung: { twin: EMAIL, to: '2' } }, { rung: { twin: EMAIL, to: 0 } }, { rung: { twin: EMAIL, to: true } }]) {
      const r = twinRungInput('plan_twin_rung', bad)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toContain('plan_twin_rung needs rung — { twin')
    }
    const three = twinRungInput('apply_twin_rung', { rung: { twin: EMAIL, to: 3 } })
    expect(three).toEqual({ ok: false, error: 'apply_twin_rung: rung 3, production, is not built. A twin stands on rung 1 (read-only) or rung 2 (fenced writes), here and at Settings → System → Digital twins.' })
    const extra = twinRungInput('plan_twin_rung', { rung: { twin: EMAIL, to: 2, read_only: false, role: 'dev' } })
    expect(extra).toEqual({ ok: false, error: 'plan_twin_rung: rung takes twin and to alone, not read_only, role.' })
    // The allowlist hands the shape to this kernel and carries the hash through.
    const built = writeRpcBody('apply_twin_rung', { rung: { twin: EMAIL, to: 2 }, plan_hash: 'a'.repeat(64) })
    expect(built).toMatchObject({ ok: true, rpc: null, step: 'apply', body: { p: { twin: EMAIL, to: 2 } }, dryRunBody: null, target: EMAIL, planHash: 'a'.repeat(64) })
    expect(writeRpcBody('plan_twin_rung', { rung: { twin: EMAIL, to: 3 } })).toMatchObject({ ok: false })
  })

  it('never reads a key\'s hash or a usage date, and never a row that is not a twin', () => {
    expect(TWIN_RUNG_KEY_SELECT).toBe('id,label,created_at')
    expect(TWIN_RUNG_TWIN_SELECT).toBe('id,name,email,twin_kind,read_only,archived_at')
    expect(TWIN_RUNG_KEY_SELECT).not.toMatch(/token_hash|last_used_at|last_seen_at/)
  })

  it('plans the graduate: the rung it stands on, the rung it would stand on, and the keys that gain writes', () => {
    const dry = twinRungDryRun({ twin: EMAIL, to: 2 }, twin(), KEYS)
    if (!dry.ok) throw new Error(dry.refused)
    expect(dry.from).toBe(1)
    expect(dry.reply).toMatchObject({
      dry_run: true,
      twin: { id: TWIN_ID, email: EMAIL, name: 'Twin Estimator 4', kind: 'estimator', rung: 'read-only (rung 1)' },
      from: 'read-only (rung 1)',
      to: 'fenced writes (rung 2)',
      live_keys: [{ key_id: KEYS[0]!.id, label: 'Office Mac', made_at: '2026-11-11T12:00:00Z' }, { key_id: KEYS[1]!.id, label: 'Laptop', made_at: '2026-11-12T12:00:00Z' }],
    })
    const then = String(dry.reply.then)
    expect(then).toContain('apply sets read_only false on its users row as you, as Graduate ↑ on the twin\'s row at Settings → System → Digital twins does.')
    expect(then).toContain('On rung 2 the twin write fence binds it: its own signed-in session writes only bids it made or is the assigned estimator on')
    expect(then).toContain('it can never send a bid or record an outcome')
    expect(then).toContain('The machines holding its 2 live keys gain those writes at once')
    expect(then).toContain('The seat\'s own verbs (twin-mcp) write as the service and never read the rung')
    expect(then).toContain('CountTooling has no read-only')
    expect(then).toContain('The way back is this pair with to: 1.')
    expect(PANEL).toContain("{ label: 'Graduate ↑', to: false }")
  })

  it('plans the way back, and says so when one key or none holds the twin', () => {
    const back = twinRungDryRun({ twin: TWIN_ID, to: 1 }, twin({ read_only: false, twin_kind: 'pricer' }), [KEYS[0]!])
    if (!back.ok) throw new Error(back.refused)
    expect(back.from).toBe(2)
    expect(back.reply).toMatchObject({ twin: { kind: 'pricer', rung: 'fenced writes (rung 2)' }, from: 'fenced writes (rung 2)', to: 'read-only (rung 1)' })
    const then = String(back.reply.then)
    expect(then).toContain('apply sets read_only true on its users row as you, as Back ↓ on the twin\'s row')
    expect(then).toContain('On rung 1 every write its own signed-in session tries is refused')
    expect(then).toContain('The machine holding its one live key loses those writes at once')
    expect(then).toContain('The way back is this pair with to: 2.')
    expect(PANEL).toContain("{ label: 'Back ↓', to: true }")
    const noKey = twinRungDryRun({ twin: EMAIL, to: 2 }, twin(), [])
    if (!noKey.ok) throw new Error(noKey.refused)
    expect(noKey.reply.live_keys).toEqual([])
    expect(String(noKey.reply.then)).toContain(`No live key is on ${EMAIL}, so nothing runs it today: the rung waits for its next key.`)
    // A users row whose read_only was never set reads as rung 2, as the panel reads it.
    expect(twinRungDryRun({ twin: EMAIL, to: 1 }, twin({ read_only: null }), [])).toMatchObject({ ok: true, from: 2 })
  })

  it('refuses in words: no twin, an archived twin, a twin already on that rung', () => {
    expect(twinRungDryRun({ twin: EMAIL, to: 2 }, null, [])).toEqual({ ok: false, refused: `No twin reads as ${EMAIL}. plan_twin lists the fleet with each twin's rung.` })
    expect(twinRungDryRun({ twin: EMAIL, to: 2 }, twin({ archived_at: '2026-11-01T00:00:00Z' }), KEYS)).toEqual({ ok: false, refused: `Nothing to plan: ${EMAIL} is archived, and an archived twin has no ladder. plan_twin_archive with restore: true brings it back first.` })
    expect(twinRungDryRun({ twin: EMAIL, to: 1 }, twin(), KEYS)).toEqual({ ok: false, refused: `Nothing to plan: ${EMAIL} already stands on read-only (rung 1).` })
    expect(twinRungDryRun({ twin: EMAIL, to: 2 }, twin({ read_only: false }), KEYS)).toEqual({ ok: false, refused: `Nothing to plan: ${EMAIL} already stands on fenced writes (rung 2).` })
  })

  it('the plan commits to the rung and to the live keys: a key minted or revoked since changes the hash', async () => {
    const p = { twin: EMAIL, to: 2 as const }
    const before = twinRungDryRun(p, twin(), KEYS)
    const same = twinRungDryRun(p, twin(), [...KEYS])
    const oneMore = twinRungDryRun(p, twin(), [...KEYS, key(3, 'New Mac')])
    const oneGone = twinRungDryRun(p, twin(), [KEYS[0]!])
    const renamed = twinRungDryRun(p, twin({ name: 'Twin Estimator Four' }), KEYS)
    if (!before.ok || !same.ok || !oneMore.ok || !oneGone.ok || !renamed.ok) throw new Error('dry run refused')
    const hash = await planHash('plan_twin_rung', p, before.reply)
    expect(await planHash('apply_twin_rung', p, same.reply)).toBe(hash)
    expect(await planHash('apply_twin_rung', p, oneMore.reply)).not.toBe(hash)
    expect(await planHash('apply_twin_rung', p, oneGone.reply)).not.toBe(hash)
    expect(await planHash('apply_twin_rung', p, renamed.reply)).not.toBe(hash)
    // The other rung is another ask, and a twin already moved is refused before any hash.
    const back = twinRungDryRun({ twin: EMAIL, to: 1 }, twin({ read_only: false }), KEYS)
    if (!back.ok) throw new Error(back.refused)
    expect(await planHash('plan_twin_rung', { twin: EMAIL, to: 1 }, back.reply)).not.toBe(hash)
    expect(twinRungDryRun(p, twin({ read_only: false }), KEYS).ok).toBe(false)
  })

  it('the write is the panel\'s, held to a live twin still on the rung the plan read', () => {
    expect(twinRungPatch(1)).toEqual({ read_only: true })
    expect(twinRungPatch(2)).toEqual({ read_only: false })
    expect(PANEL).toContain("await supabase.from('users').update({ read_only: readOnly }).eq('id', t.id)")
    expect(twinRungPatchQuery(twin(), 1)).toBe(`id=eq.${TWIN_ID}&is_digital_twin=eq.true&archived_at=is.null&read_only=is.true`)
    expect(twinRungPatchQuery(twin(), 2)).toBe(`id=eq.${TWIN_ID}&is_digital_twin=eq.true&archived_at=is.null&read_only=not.is.true`)
  })

  it('the closing line names the rung it stands on and the way back, or why nothing moved', () => {
    expect(twinRungAppliedWords(true, twin(), 1, 2)).toBe(`Twin Estimator 4 (${EMAIL}) now stands on fenced writes (rung 2). The way back is plan_twin_rung { rung: { twin: "${EMAIL}", to: 1 } }.`)
    expect(twinRungAppliedWords(true, twin({ name: null }), 2, 1)).toBe(`${EMAIL} (${EMAIL}) now stands on read-only (rung 1). The way back is plan_twin_rung { rung: { twin: "${EMAIL}", to: 2 } }.`)
    expect(twinRungAppliedWords(false, twin(), 1, 2, 'no row changed: its rung moved a moment ago, or RLS let no row through')).toBe(`Nothing moved: ${EMAIL} stays on read-only (rung 1) (no row changed: its rung moved a moment ago, or RLS let no row through). plan_twin lists the fleet with each twin's rung; plan again from the rung it stands on.`)
    expect(alreadyApplied('apply_twin_rung', { target: EMAIL, at: null })).toContain('Nothing written: this plan was already applied')
    expect(TWIN_RUNG_WORDS).toEqual({ 1: 'read-only (rung 1)', 2: 'fenced writes (rung 2)' })
  })

  it('a new twin\'s plan and closing line name this pair, where they named a press', () => {
    const dry = twinDryRun({ kind: 'estimator' }, { fleet: [], holders: [] })
    if (!dry.ok) throw new Error(dry.refused)
    expect(String(dry.reply.then)).toContain('The twin stays read-only: plan_twin_rung moves its rung, plan_twin_key_revoke cuts a key off, and plan_twin_archive takes it out of the fleet, or brings it back with restore: true. plan_twin_seat makes a held seat again. Each is also a press at Settings → System → Digital twins.')
    // The pricing robot has no seat in the other apps, so its plan names no seat verb.
    const pricer = twinDryRun({ kind: 'pricer' }, { fleet: [], holders: [] })
    if (!pricer.ok) throw new Error(pricer.refused)
    expect(String(pricer.reply.then)).toContain('or brings it back with restore: true. Each is also a press at Settings → System → Digital twins.')
    expect(String(pricer.reply.then)).not.toContain('plan_twin_seat')
    const steps = [{ step: 'account' as const, ok: true, words: '' }, { step: 'flags' as const, ok: true, words: '' }]
    expect(twinAppliedWords(steps, dry.seat)).toContain('It is read-only until plan_twin_rung moves it to rung 2.')
  })

  it('the server declares the pair, writes one row of users held to a twin, and the docs carry the door', () => {
    for (const verb of ['plan_twin_rung', 'apply_twin_rung']) {
      expect(SERVER).toContain(`name: '${verb}'`)
      expect(SERVER).toContain(`case '${verb}':`)
    }
    const from = SERVER.indexOf("case 'plan_twin_rung':")
    const branch = SERVER.slice(from, SERVER.indexOf("case 'plan_calibration_standard':", from))
    expect(branch).toContain("if (who.role !== 'dev') return refused(`${name} writes, and only a dev's own key may write.`)")
    // The twin is found through twinRefQuery alone, which holds the read to is_digital_twin: a person's row is never found.
    expect(branch).toContain("await restGet(session, 'users', `select=${TWIN_RUNG_TWIN_SELECT}&${twinRefQuery(p.twin)}&limit=1`)")
    expect(branch).toContain("await restGet(session, 'twin_credentials', `select=${TWIN_RUNG_KEY_SELECT}&twin_user_id=eq.${twinRow.id}&revoked_at=is.null&order=created_at.desc&limit=1000`)")
    expect(branch).toContain("await restRows(session, 'PATCH', 'users', `${twinRungPatchQuery(dry.twin, dry.from)}&select=id`, twinRungPatch(p.to), 'return=representation')")
    expect(branch.match(/restRows\(/g)).toHaveLength(1) // one write, and it is the rung
    expect(branch).not.toContain("'twin_credentials', `id=eq.") // it never writes a key
    expect(branch).not.toContain('token_hash')
    expect(branch).not.toContain('invokeAsDev(') // nothing is sent to CountTooling or TakeoffTooling
    expect(branch).toContain('if (fresh !== built.planHash) return refused(planMismatch(')
    expect(branch).toContain('const prior = await hooks.priorApply(name, fresh)')
    expect(SERVER).toContain("const SERVER_VERSION = '0.133.0'")
    expect(SERVER).toContain('Writes are one hundred and fifty-six verbs and nothing else')
    expect(SERVER).toContain('plan_twin_rung → apply_twin_rung (a twin moved between the rungs of its safety ladder')
    expect(README).toContain('| `plan_twin_rung(rung)` · `apply_twin_rung(rung, plan_hash)` |')
    expect(README).toContain("one hundred and thirty-three since v2.7918's rung pair")
    expect(README).toContain('one hundred and fifty-six `plan_` / `apply_` / `revert_` verbs')
    expect(EDGE).toContain("v2.7918 (server 0.108.0) — a twin's rung moved from the seat")
  })
})
