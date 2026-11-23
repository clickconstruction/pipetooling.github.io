import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  TWIN_FLEET_SELECT,
  TWIN_HOLDER_SELECT,
  isTwinVerb,
  twinAppliedWords,
  twinBridgeBody,
  twinCreateBody,
  twinDryRun,
  twinFacts,
  twinFlagPatch,
  twinInput,
  twinSeatFor,
  type TwinFleetRow,
  type TwinHolderRow,
  type TwinStep,
} from '../../../supabase/functions/_shared/devMcpTwin'
import { ctTwinSeatEmail, nextTwinSeat, ttTwinSeatEmail, twinSeatName } from '../../../supabase/functions/_shared/twinSeat'
import { WRITE_VERBS, alreadyApplied, planHash, planVerbFor, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { CATALOG_TABLES } from '../../../supabase/functions/dev-mcp/catalog'
import { nextTwinSeat as panelNextTwinSeat } from '../twinConsoleDisplay'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const EDGE = readFileSync('docs/EDGE_FUNCTIONS.md', 'utf8')
const PANEL = readFileSync('src/components/settings/DigitalTwinsPanel.tsx', 'utf8')

const row = (n: number, over: Partial<TwinFleetRow> = {}): TwinFleetRow => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  name: `Twin Estimator ${n}`,
  email: `twin-estimator-${n}@twins.pipetooling.local`,
  role: 'estimator',
  read_only: true,
  twin_kind: null,
  archived_at: null,
  counttooling_user_id: null,
  ...over,
})
const pricer: TwinFleetRow = row(9, { name: 'Twin Pricer 1', email: 'twin-pricer-1@twins.pipetooling.local', twin_kind: 'pricer' })
// The fleet as prod read on 2026-11-18: one working, one archived, one read-only, and the pricing robot.
const FLEET: TwinFleetRow[] = [row(1, { read_only: false, counttooling_user_id: 'ct-1' }), row(2, { archived_at: '2026-10-22T18:49:28Z' }), row(3, { counttooling_user_id: 'ct-3' }), pricer]

describe('the twin verbs (a digital twin made from the dev seat, v2.7879)', () => {
  it('are two write verbs on the allowlist with no wrapper RPC', () => {
    expect(WRITE_VERBS.plan_twin).toEqual({ rpc: null, step: 'plan' })
    expect(WRITE_VERBS.apply_twin).toEqual({ rpc: null, step: 'apply' })
    expect(isTwinVerb('plan_twin')).toBe(true)
    expect(isTwinVerb('plan_account')).toBe(false)
    expect(planVerbFor('apply_twin')).toBe('plan_twin')
  })

  it('take a kind and nothing else: the seat, the address, the name and the rung are never the caller\'s', () => {
    expect(twinInput('plan_twin', { twin: { kind: 'estimator' } })).toEqual({ ok: true, p: { kind: 'estimator' }, target: 'twin-estimator' })
    expect(twinInput('plan_twin', { twin: { kind: 'pricer' } })).toEqual({ ok: true, p: { kind: 'pricer' }, target: 'twin-pricer' })
    for (const bad of [{}, { twin: null }, { twin: {} }, { twin: { kind: 'master_technician' } }, { twin: 'estimator' }]) {
      const r = twinInput('plan_twin', bad as Record<string, unknown>)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toContain('plan_twin needs twin — { kind (estimator')
    }
    const extra = twinInput('apply_twin', { twin: { kind: 'estimator', email: 'robert@example.com', read_only: false } })
    expect(extra.ok).toBe(false)
    if (!extra.ok) expect(extra.error).toBe('apply_twin: twin takes kind alone, not email, read_only. The seat, the address, the name and the rung are not chosen here.')
  })

  it('writeRpcBody hands the payload on, and an apply must quote the plan', () => {
    const plan = writeRpcBody('plan_twin', { twin: { kind: 'estimator' } })
    expect(plan).toMatchObject({ ok: true, rpc: null, step: 'plan', body: { p: { kind: 'estimator' } }, dryRunBody: null })
    const bare = writeRpcBody('apply_twin', { twin: { kind: 'estimator' } })
    expect(bare.ok).toBe(false)
    const apply = writeRpcBody('apply_twin', { twin: { kind: 'estimator' }, plan_hash: 'a'.repeat(64) })
    expect(apply).toMatchObject({ ok: true, step: 'apply', planHash: 'a'.repeat(64) })
  })

  it('number the seat by the panel\'s own rule: the next of its kind, archived twins counted, a gap never reused', () => {
    expect(twinSeatFor({ kind: 'estimator' }, FLEET)).toEqual({ n: 4, email: 'twin-estimator-4@twins.pipetooling.local', name: 'Twin Estimator 4', kind: 'estimator' })
    expect(twinSeatFor({ kind: 'pricer' }, FLEET)).toEqual({ n: 2, email: 'twin-pricer-2@twins.pipetooling.local', name: 'Twin Pricer 2', kind: 'pricer' })
    expect(twinSeatFor({ kind: 'estimator' }, [])).toMatchObject({ n: 1, email: 'twin-estimator-1@twins.pipetooling.local' })
    expect(twinSeatFor({ kind: 'estimator' }, [row(1, { email: 'Twin-Estimator-7@twins.pipetooling.local' })]).n).toBe(8)
    // One kernel: the panel's nextTwinSeat is this file's, through the client's door.
    expect(panelNextTwinSeat).toBe(nextTwinSeat)
    expect(PANEL).toContain("nextTwinSeat(twins.map((t) => t.email), kind)")
    expect(twinSeatName('pricer', 2)).toBe('Twin Pricer 2')
    expect(ctTwinSeatEmail('twin-estimator-4@twins.pipetooling.local')).toBe('twin-estimator-4@twins.counttooling.local')
    expect(ttTwinSeatEmail('twin-estimator-4@twins.pipetooling.local')).toBe('twin-estimator-4@twins.takeofftooling.local')
  })

  it('the dry run names the seat, the flags, the other apps\' seats and the fleet as it stands', () => {
    const dry = twinDryRun({ kind: 'estimator' }, { fleet: FLEET, holders: [] })
    expect(dry.ok).toBe(true)
    if (!dry.ok) return
    expect(dry.seat.email).toBe('twin-estimator-4@twins.pipetooling.local')
    expect(dry.reply.twin).toEqual({ email: 'twin-estimator-4@twins.pipetooling.local', name: 'Twin Estimator 4', seat: 4, kind: 'estimator', role: 'estimator', rung: 'read-only (rung 1)', flags: { is_digital_twin: true, read_only: true }, roster_row: 'none: a twin is not a person' })
    expect(dry.reply.seats).toEqual({ counttooling: 'twin-estimator-4@twins.counttooling.local', takeofftooling: 'twin-estimator-4@twins.takeofftooling.local' })
    const fleet = dry.reply.fleet as { live: Array<Record<string, unknown>>; archived: string[] }
    expect(fleet.live.map((t) => t.email)).toEqual(['twin-estimator-1@twins.pipetooling.local', 'twin-estimator-3@twins.pipetooling.local', 'twin-pricer-1@twins.pipetooling.local'])
    expect(fleet.live[0]).toMatchObject({ rung: 'fenced writes (rung 2)', counttooling_seat: 'linked' })
    expect(fleet.live[2]).toMatchObject({ kind: 'pricer', counttooling_seat: 'none: a pricing robot has no seat there' })
    expect(fleet.archived).toEqual(['twin-estimator-2@twins.pipetooling.local'])
    expect(String(dry.reply.then)).toContain('mint_twin_setup_code { label, twin: "twin-estimator-4@twins.pipetooling.local" } is the next call')
    expect(String(dry.reply.then)).toContain('The twin stays read-only')
  })

  it('a pricing robot gets its kind flag and no seat in the other apps', () => {
    const dry = twinDryRun({ kind: 'pricer' }, { fleet: FLEET, holders: [] })
    expect(dry.ok).toBe(true)
    if (!dry.ok) return
    expect(dry.reply.seats).toBe('none: the pricing robot prices quotes and holds no bids')
    expect((dry.reply.twin as Record<string, unknown>).flags).toEqual({ is_digital_twin: true, read_only: true, twin_kind: 'pricer' })
    expect(String(dry.reply.then)).not.toContain('ct-bridge')
    expect(twinFlagPatch('estimator')).toEqual({ is_digital_twin: true, read_only: true })
  })

  it('refuses a seat whose address a row already wears without the twin flag', () => {
    const holder: TwinHolderRow = { id: 'aaaaaaaa-0000-4000-8000-000000000004', name: 'Twin Estimator 4', email: 'Twin-Estimator-4@twins.pipetooling.local', role: 'estimator', is_digital_twin: false, archived_at: null }
    const dry = twinDryRun({ kind: 'estimator' }, { fleet: FLEET, holders: [holder] })
    expect(dry.ok).toBe(false)
    if (dry.ok) return
    expect(dry.refused).toContain('Nothing to plan: twin-estimator-4@twins.pipetooling.local is the next estimator seat')
    expect(dry.refused).toContain('users aaaaaaaa-0000-4000-8000-000000000004')
    expect(dry.refused).toContain('this door makes a seat from nothing only')
  })

  it('the plan commits to the fleet: a twin minted since changes the hash', async () => {
    const p = { kind: 'estimator' as const }
    const before = twinDryRun(p, { fleet: FLEET, holders: [] })
    const after = twinDryRun(p, { fleet: [...FLEET, row(4)], holders: [] })
    const same = twinDryRun(p, { fleet: FLEET, holders: [] })
    if (!before.ok || !after.ok || !same.ok) throw new Error('dry run refused')
    expect(await planHash('plan_twin', p, before.reply)).toBe(await planHash('apply_twin', p, same.reply))
    expect(await planHash('plan_twin', p, before.reply)).not.toBe(await planHash('apply_twin', p, after.reply))
    expect(after.seat.n).toBe(5)
  })

  it('the bodies are the panel\'s: an estimator with no roster row, and the other apps\' create', () => {
    const seat = twinSeatFor({ kind: 'estimator' }, FLEET)
    expect(twinCreateBody(seat, 'secret')).toEqual({ email: 'twin-estimator-4@twins.pipetooling.local', password: 'secret', role: 'estimator', name: 'Twin Estimator 4', skip_roster_row: true })
    expect(twinBridgeBody('twin-estimator-4@twins.counttooling.local', 'Twin Estimator 4')).toEqual({ verb: 'create', email: 'twin-estimator-4@twins.counttooling.local', name: 'Twin Estimator 4', is_digital_twin: true })
    expect(PANEL).toContain("role: 'estimator', name: kind === 'pricer' ? `Twin Pricer ${seat.n}` : `Twin Estimator ${seat.n}`, skip_roster_row: true }")
    expect(PANEL).toContain("kind === 'pricer' ? { is_digital_twin: true, read_only: true, twin_kind: 'pricer' } : { is_digital_twin: true, read_only: true }")
    expect(PANEL).toContain("body: { verb: 'create', email: ctTwinEmail(ptEmail), name: name ?? undefined, is_digital_twin: true }")
  })

  it('the closing line says what stands, what was held with its door, and the next call', () => {
    const seat = twinSeatFor({ kind: 'estimator' }, FLEET)
    const ok = (step: TwinStep['step']): TwinStep => ({ step, ok: true, words: 'done' })
    const whole = twinAppliedWords([ok('account'), ok('flags'), ok('counttooling_seat'), ok('takeofftooling_seat')], seat)
    expect(whole).toBe('Made: Twin Estimator 4 (twin-estimator-4@twins.pipetooling.local) stands in the fleet with its CountTooling and TakeoffTooling seats. Next: mint_twin_setup_code { label, twin: "twin-estimator-4@twins.pipetooling.local" } for its key. It is read-only until plan_twin_rung moves it to rung 2.')
    const held = twinAppliedWords([ok('account'), ok('flags'), { step: 'counttooling_seat', ok: false, words: 'ct-bridge made no seat: answered 500' }, ok('takeofftooling_seat')], seat)
    expect(held).toContain('Held: counttooling seat (ct-bridge made no seat: answered 500).')
    expect(held).toContain('plan_twin_seat { seat: { twin: "twin-estimator-4@twins.pipetooling.local" } } makes a held seat again, as the link button on the twin\'s row at Settings → System → Digital twins does.')
    const unflagged = twinAppliedWords([ok('account'), { step: 'flags', ok: false, words: 'RLS let no row through' }], seat)
    expect(unflagged).toContain('Stopped: the login twin-estimator-4@twins.pipetooling.local is made but its row is not flagged a twin')
    expect(unflagged).not.toContain('mint_twin_setup_code')
    const pricerSeat = twinSeatFor({ kind: 'pricer' }, FLEET)
    expect(twinAppliedWords([ok('account'), ok('flags')], pricerSeat)).toContain('a pricing robot with no seat in the other apps')
    expect(twinFacts(FLEET[1]!)).toMatchObject({ archived: true, rung: 'read-only (rung 1)', counttooling_seat: 'not linked' })
    expect(alreadyApplied('apply_twin', { target: seat.email, at: null })).toContain('Nothing written: this plan was already applied')
  })

  it('reads only columns the catalog knows', () => {
    const users = Object.keys(CATALOG_TABLES.users!.columns)
    for (const col of [...TWIN_FLEET_SELECT.split(','), ...TWIN_HOLDER_SELECT.split(',')]) expect(users, col).toContain(col)
  })

  it('the server declares both verbs, goes through the panel\'s own functions as the dev, and the docs carry the door', () => {
    for (const verb of ['plan_twin', 'apply_twin']) {
      expect(SERVER).toContain(`name: '${verb}'`)
      expect(SERVER).toContain(`case '${verb}':`)
    }
    const from = SERVER.indexOf("case 'plan_twin':")
    const branch = SERVER.slice(from, SERVER.indexOf("case 'read_twin_keys':", from))
    expect(branch).toContain("if (who.role !== 'dev') return refused(`${name} writes, and only a dev's own key may write.`)")
    expect(branch).toContain("await invokeAsDev(session, 'create-user', twinCreateBody(seat, ")
    expect(branch).toContain("await invokeAsDev(session, 'ct-bridge', twinBridgeBody(ctEmail, seat.name))")
    expect(branch).toContain("await invokeAsDev(session, 'tt-bridge', twinBridgeBody(ttEmail, seat.name))")
    expect(branch).toContain("if (flagged && p.kind === 'estimator') {") // no seat in the other apps for a row that is not a twin
    expect(branch).toContain('if (fresh !== built.planHash) return refused(planMismatch(')
    expect(branch).not.toContain('twin_credentials') // it makes no key
    expect(branch).not.toContain('password:') // the password is the kernel's body alone, never a reply or a log line
    expect(SERVER).toContain("const SERVER_VERSION = '0.132.0'")
    expect(SERVER).toContain('Writes are one hundred and fifty-six verbs and nothing else')
    expect(SERVER).toContain('plan_twin → apply_twin (a digital twin')
    expect(README).toContain('| `plan_twin(twin)` · `apply_twin(twin, plan_hash)` |')
    expect(README).toContain("one hundred and twenty-nine since v2.7879's twin pair")
    expect(README).toContain('one hundred and fifty-six `plan_` / `apply_` / `revert_` verbs')
    expect(EDGE).toContain('v2.7879 (server 0.105.0) — a digital twin made from the seat')
  })

  it('no sentence sends a reader to the panel for what the seat does itself: a held seat and Archive name their verbs', () => {
    const KERNEL = readFileSync('supabase/functions/_shared/devMcpTwin.ts', 'utf8')
    expect(SERVER).toContain("a seat that was held is made again with plan_twin_seat, as the link button on the twin's row at Settings → System → Digital twins makes it.")
    expect(SERVER).toContain('plan_twin_rung for its rung, plan_twin_key_revoke for a key and plan_twin_archive to take it out of the fleet or bring it back.')
    for (const source of [SERVER, KERNEL]) {
      expect(source).not.toContain('stays a press')
      expect(source).not.toContain('Archive is a press')
      expect(source).not.toContain('made again with the link button')
      expect(source).not.toContain('The link button on the twin')
    }
  })
})
