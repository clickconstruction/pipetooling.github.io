import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  TWIN_SEAT_APPS,
  TWIN_SEAT_TWIN_SELECT,
  isTwinSeatVerb,
  ttSeatLookup,
  twinSeatAppliedWords,
  twinSeatAppsAsked,
  twinSeatDryRun,
  twinSeatInput,
  twinSeatLinkPatch,
  twinSeatLinkQuery,
  twinSeatLookupBody,
  type TwinSeatTwinRow,
} from '../../../supabase/functions/_shared/devMcpTwinSeat'
import { twinBridgeBody } from '../../../supabase/functions/_shared/devMcpTwin'
import { WRITE_VERBS, alreadyApplied, planHash, planVerbFor, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const EDGE = readFileSync('docs/EDGE_FUNCTIONS.md', 'utf8')
const PANEL = readFileSync('src/components/settings/DigitalTwinsPanel.tsx', 'utf8')
const CT_BRIDGE = readFileSync('supabase/functions/ct-bridge/index.ts', 'utf8')
const TT_BRIDGE = readFileSync('supabase/functions/tt-bridge/index.ts', 'utf8')
const TYPES = readFileSync('src/types/database.ts', 'utf8')

const TWIN_ID = '6a424303-0000-4000-8000-000000000004'
const EMAIL = 'twin-estimator-4@twins.pipetooling.local'
const CT_EMAIL = 'twin-estimator-4@twins.counttooling.local'
const TT_EMAIL = 'twin-estimator-4@twins.takeofftooling.local'
const CT_ID = 'cccccccc-0000-4000-8000-000000000004'
const TT_ID = 'dddddddd-0000-4000-8000-000000000004'
const twin = (over: Partial<TwinSeatTwinRow> = {}): TwinSeatTwinRow => ({ id: TWIN_ID, name: 'Twin Estimator 4', email: EMAIL, twin_kind: null, archived_at: null, counttooling_user_id: CT_ID, ...over })

describe('a twin\'s held seat made again from the dev seat (v2.7974)', () => {
  it('is two write verbs on the allowlist with no wrapper RPC', () => {
    expect(WRITE_VERBS.plan_twin_seat).toEqual({ rpc: null, step: 'plan' })
    expect(WRITE_VERBS.apply_twin_seat).toEqual({ rpc: null, step: 'apply' })
    expect(isTwinSeatVerb('apply_twin_seat')).toBe(true)
    expect(isTwinSeatVerb('plan_twin')).toBe(false)
    expect(planVerbFor('apply_twin_seat')).toBe('plan_twin_seat')
  })

  it('takes a twin, one of the two apps or neither, and no other key', () => {
    expect(twinSeatInput('plan_twin_seat', { seat: { twin: EMAIL.toUpperCase() } })).toEqual({ ok: true, p: { twin: EMAIL }, target: EMAIL })
    expect(twinSeatInput('plan_twin_seat', { seat: { twin: TWIN_ID, app: 'takeofftooling' } })).toEqual({ ok: true, p: { twin: TWIN_ID, app: 'takeofftooling' }, target: TWIN_ID })
    for (const bad of [{}, { seat: null }, { seat: { twin: 'wendi@example.com' } }, { seat: { twin: EMAIL, app: 'pipetooling' } }, { seat: { twin: EMAIL, app: 7 } }]) {
      const r = twinSeatInput('plan_twin_seat', bad as Record<string, unknown>)
      expect(r.ok, JSON.stringify(bad)).toBe(false)
      if (!r.ok) expect(r.error).toContain('plan_twin_seat needs seat')
    }
    expect(twinSeatInput('apply_twin_seat', { seat: { twin: EMAIL, email: TT_EMAIL } })).toEqual({ ok: false, error: "apply_twin_seat: seat takes twin and app alone, not email. A seat's address and name are the fleet's to give, never yours." })
    const built = writeRpcBody('apply_twin_seat', { seat: { twin: EMAIL, app: 'counttooling' }, plan_hash: 'a'.repeat(64) })
    expect(built).toMatchObject({ ok: true, rpc: null, step: 'apply', body: { p: { twin: EMAIL, app: 'counttooling' } }, target: EMAIL, planHash: 'a'.repeat(64) })
    expect(twinSeatAppsAsked({ twin: EMAIL })).toEqual(['counttooling', 'takeofftooling'])
    expect(twinSeatAppsAsked({ twin: EMAIL, app: 'takeofftooling' })).toEqual(['takeofftooling'])
    expect(TWIN_SEAT_APPS).toEqual(['counttooling', 'takeofftooling'])
  })

  it('reads the twin by columns that exist, the join key among them', () => {
    const users = TYPES.slice(TYPES.indexOf('      users: {\n        Row: {'))
    for (const c of TWIN_SEAT_TWIN_SELECT.split(',')) expect(users.slice(0, users.indexOf('Insert: {')), c).toContain(`          ${c}:`)
    expect(TWIN_SEAT_TWIN_SELECT.split(',')).toContain('counttooling_user_id')
  })

  it('reads tt-bridge\'s lookup as the panel reads it: a failed call is a seat it could not read, never one that is held', () => {
    expect(twinSeatLookupBody(TT_EMAIL)).toEqual({ verb: 'lookup', email: TT_EMAIL })
    expect(PANEL).toContain("supabase.functions.invoke('tt-bridge', { body: { verb: 'lookup', email: ttTwinEmail(tw.email) } })")
    expect(PANEL).toContain("map[tw.id] = found?.found && found.is_digital_twin ? (found.tt_user_id ?? 'linked') : null")
    expect(ttSeatLookup({ ok: true, status: 200, body: { found: true, is_digital_twin: true, tt_user_id: TT_ID } })).toEqual({ state: 'linked', tt_user_id: TT_ID })
    expect(ttSeatLookup({ ok: true, status: 200, body: { found: true, is_digital_twin: true } })).toEqual({ state: 'linked', tt_user_id: 'linked' })
    expect(ttSeatLookup({ ok: true, status: 200, body: { found: false } })).toEqual({ state: 'held' })
    // A person's account wearing the address is not the twin's seat: held, as the panel shows it.
    expect(ttSeatLookup({ ok: true, status: 200, body: { found: true, is_digital_twin: false, tt_user_id: TT_ID } })).toEqual({ state: 'held' })
    expect(ttSeatLookup({ ok: false, status: 500, body: { error: 'TT_BRIDGE_SECRET not configured' } })).toEqual({ state: 'unread', why: 'tt-bridge answered 500: TT_BRIDGE_SECRET not configured' })
    // v2.8046: a reply the bridge passes on may say message or msg where its own refusals say error. The status alone hid it.
    expect(ttSeatLookup({ ok: false, status: 401, body: { code: 401, message: 'Missing authorization header' } })).toEqual({ state: 'unread', why: 'tt-bridge answered 401: Missing authorization header' })
    expect(ttSeatLookup({ ok: false, status: 401, body: { msg: ' Invalid JWT ' } })).toEqual({ state: 'unread', why: 'tt-bridge answered 401: Invalid JWT' })
    expect(ttSeatLookup({ ok: false, status: 401, body: { error: '', message: 'Unauthorized' } })).toEqual({ state: 'unread', why: 'tt-bridge answered 401: Unauthorized' })
    expect(ttSeatLookup({ ok: false, status: 401, body: {} })).toEqual({ state: 'unread', why: 'tt-bridge answered 401' })
    expect(ttSeatLookup({ ok: false, status: 502, body: { message: 'x'.repeat(900) } }).state === 'unread' && (ttSeatLookup({ ok: false, status: 502, body: { message: 'x'.repeat(900) } }) as { why: string }).why.length).toBe('tt-bridge answered 502: '.length + 300)
    expect(ttSeatLookup({ ok: false, status: 404, body: 'not found' })).toEqual({ state: 'unread', why: 'tt-bridge answered 404' })
    for (const bridge of [CT_BRIDGE, TT_BRIDGE]) {
      expect(bridge).toContain("'create'")
      expect(bridge).toContain("'lookup'")
      expect(bridge).toContain("if (userError || userData?.role !== 'dev') return jsonResponse({ error: 'Forbidden - devs only' }, 403)")
    }
  })

  it('plans the seat that is held, and leaves a linked one alone', () => {
    const dry = twinSeatDryRun({ twin: EMAIL }, twin(), { state: 'held' })
    expect(dry.ok).toBe(true)
    if (!dry.ok) return
    expect(dry.retry).toEqual(['takeofftooling'])
    expect(dry.reply.twin).toEqual({ id: TWIN_ID, email: EMAIL, name: 'Twin Estimator 4', kind: 'estimator' })
    expect(dry.reply.seats).toEqual({ counttooling: { email: CT_EMAIL, state: 'linked', ct_user_id: CT_ID }, takeofftooling: { email: TT_EMAIL, state: 'held' } })
    expect(dry.reply.warnings).toBeUndefined()
    const then = String(dry.reply.then)
    expect(then).toContain('apply makes its TakeoffTooling seat through tt-bridge, which is found by its address and has no join key here, each as you, as the link button on the twin\'s row at Settings → System → Digital twins does.')
    expect(then).toContain('a seat that exists there is found, never made twice')
    expect(then).toContain('Nothing else changes: no key, no rung, and nothing here takes a seat away.')
    const both = twinSeatDryRun({ twin: EMAIL }, twin({ counttooling_user_id: null }), { state: 'held' })
    expect(both.ok && both.retry).toEqual(['counttooling', 'takeofftooling'])
    expect(both.ok && String(both.reply.then)).toContain("apply makes its CountTooling seat through ct-bridge and saves the seat's id on the twin's users row, the join key the twin seat signs in to CountTooling by, then makes its TakeoffTooling seat through tt-bridge")
    const one = twinSeatDryRun({ twin: EMAIL, app: 'counttooling' }, twin({ counttooling_user_id: null }), null)
    expect(one.ok && one.retry).toEqual(['counttooling'])
    expect(one.ok && one.reply.seats).toEqual({ counttooling: { email: CT_EMAIL, state: 'held' } })
  })

  it('says it could not read a seat when the bridge did not answer, and still plans the idempotent create', () => {
    const dry = twinSeatDryRun({ twin: EMAIL, app: 'takeofftooling' }, twin(), { state: 'unread', why: 'TT_BRIDGE_SECRET not configured' })
    expect(dry.ok).toBe(true)
    if (!dry.ok) return
    expect(dry.retry).toEqual(['takeofftooling'])
    expect(dry.reply.seats).toEqual({ takeofftooling: { email: TT_EMAIL, state: 'could not be read' } })
    expect(dry.reply.warnings).toEqual(['The TakeoffTooling seat could not be looked up (TT_BRIDGE_SECRET not configured), so the plan cannot say it is held. The create is idempotent there: a seat that exists is found, never made twice. If the bridge is down, the create is refused the same way.'])
    // A lookup the server never made reads the same way: not held, not linked.
    const never = twinSeatDryRun({ twin: EMAIL, app: 'takeofftooling' }, twin(), null)
    expect(never.ok && never.reply.seats).toEqual({ takeofftooling: { email: TT_EMAIL, state: 'could not be read' } })
  })

  it('refuses in words: no twin, an archived twin, the pricing robot, nothing held', () => {
    expect(twinSeatDryRun({ twin: EMAIL }, null, null)).toEqual({ ok: false, refused: `No twin reads as ${EMAIL}. plan_twin lists the fleet.` })
    expect(twinSeatDryRun({ twin: EMAIL }, twin({ archived_at: '2026-11-01T00:00:00Z' }), null)).toEqual({ ok: false, refused: `Nothing to plan: ${EMAIL} is archived. plan_twin_archive with restore: true brings it back first.` })
    const pricer = twinSeatDryRun({ twin: 'twin-pricer-1@twins.pipetooling.local' }, twin({ email: 'twin-pricer-1@twins.pipetooling.local', twin_kind: 'pricer', counttooling_user_id: null }), null)
    expect(!pricer.ok && pricer.refused).toContain('is the pricing robot. It prices quotes and holds no bids, so it has no seat in CountTooling or TakeoffTooling.')
    expect(twinSeatDryRun({ twin: EMAIL }, twin(), { state: 'linked', tt_user_id: TT_ID })).toEqual({ ok: false, refused: `Nothing to plan: its CountTooling and TakeoffTooling seats are linked already on ${EMAIL}.` })
    expect(twinSeatDryRun({ twin: EMAIL, app: 'counttooling' }, twin(), null)).toEqual({ ok: false, refused: `Nothing to plan: its CountTooling seat is linked already on ${EMAIL}.` })
  })

  it('the plan commits to where each seat stands, never to a bridge\'s words for why a lookup failed', async () => {
    const p = { twin: EMAIL }
    const a = twinSeatDryRun(p, twin(), { state: 'unread', why: 'tt-bridge answered 502' })
    const otherWords = twinSeatDryRun(p, twin(), { state: 'unread', why: 'tt-bridge could not be reached: timeout' })
    const held = twinSeatDryRun(p, twin(), { state: 'held' })
    const ctGone = twinSeatDryRun(p, twin({ counttooling_user_id: null }), { state: 'unread', why: 'tt-bridge answered 502' })
    if (!a.ok || !otherWords.ok || !held.ok || !ctGone.ok) throw new Error('each plans')
    const h = await planHash('plan_twin_seat', p, a.reply)
    expect(await planHash('apply_twin_seat', p, otherWords.reply)).toBe(h)
    expect(await planHash('plan_twin_seat', p, held.reply)).not.toBe(h) // could not be read and held are two answers
    expect(await planHash('plan_twin_seat', p, ctGone.reply)).not.toBe(h)
    expect(alreadyApplied('apply_twin_seat', { at: '2026-11-19T12:00:00Z', target: EMAIL })).toContain("plan_twin_seat reads where each of the twin's seats stands now")
  })

  it('the writes are the panel\'s: the bridge\'s own create, and the join key on a row that is still a twin', () => {
    expect(twinBridgeBody(TT_EMAIL, 'Twin Estimator 4')).toEqual({ verb: 'create', email: TT_EMAIL, name: 'Twin Estimator 4', is_digital_twin: true })
    expect(PANEL).toContain("body: { verb: 'create', email: ttTwinEmail(ptEmail), name: name ?? undefined, is_digital_twin: true },")
    expect(PANEL).toContain("body: { verb: 'create', email: ctTwinEmail(ptEmail), name: name ?? undefined, is_digital_twin: true },")
    expect(twinSeatLinkPatch(CT_ID)).toEqual({ counttooling_user_id: CT_ID })
    expect(PANEL).toContain('.update({ counttooling_user_id: ctId })')
    expect(twinSeatLinkQuery({ id: TWIN_ID })).toBe(`id=eq.${TWIN_ID}&is_digital_twin=eq.true`)
  })

  it('the closing line says what is linked, what is still held and why, and where to read it back', () => {
    const t = twin()
    expect(twinSeatAppliedWords([{ step: 'takeofftooling_seat', ok: true, words: 'made' }], t)).toBe(`Linked on Twin Estimator 4 (${EMAIL}): TakeoffTooling. plan_twin_seat { seat: { twin: "${EMAIL}" } } reads where each seat stands.`)
    const mixed = twinSeatAppliedWords([{ step: 'counttooling_seat', ok: true, words: 'made' }, { step: 'takeofftooling_seat', ok: false, words: 'tt-bridge made no seat: email domain not allowed' }], t)
    expect(mixed).toContain(`Linked on Twin Estimator 4 (${EMAIL}): CountTooling.`)
    expect(mixed).toContain('Still held: TakeoffTooling (tt-bridge made no seat: email domain not allowed). A bridge that refuses names its own reason; the fix is on its side')
    expect(twinSeatAppliedWords([{ step: 'takeofftooling_seat', ok: false, words: 'tt-bridge made no seat: answered 500' }], t)).toContain(`Nothing linked on ${EMAIL}. Still held: TakeoffTooling`)
  })

  it('the server declares the pair, looks the seat up before it plans, calls the bridges as the dev, and the docs carry the door', () => {
    for (const verb of ['plan_twin_seat', 'apply_twin_seat']) {
      expect(SERVER).toContain(`name: '${verb}'`)
      expect(SERVER).toContain(`case '${verb}':`)
    }
    const from = SERVER.indexOf("case 'plan_twin_seat':")
    const branch = SERVER.slice(from, SERVER.indexOf("case 'plan_pay_setup':", from))
    expect(branch).toContain("if (who.role !== 'dev') return refused(`${name} writes, and only a dev's own key may write.`)")
    // The twin is found through twinRefQuery alone, which holds the read to is_digital_twin: a person gets no seat here.
    expect(branch).toContain("await restGet(session, 'users', `select=${TWIN_SEAT_TWIN_SELECT}&${twinRefQuery(p.twin)}&limit=1`)")
    expect(branch).toContain("tt = ttSeatLookup(await invokeAsDev(session, 'tt-bridge', twinSeatLookupBody(ttTwinSeatEmail(twinRow.email))))")
    expect(branch).toContain("await invokeAsDev(session, 'ct-bridge', twinBridgeBody(ctEmail, seatName))")
    expect(branch).toContain("await invokeAsDev(session, 'tt-bridge', twinBridgeBody(ttEmail, seatName))")
    expect(branch.match(/invokeAsDev\(/g)).toHaveLength(3) // the lookup, and one create a bridge
    expect(branch).toContain("await restRows(session, 'PATCH', 'users', `${twinSeatLinkQuery(dry.twin)}&select=id`, twinSeatLinkPatch(ctId), 'return=representation')")
    expect(branch.match(/restRows\(/g)).toHaveLength(1) // one table write, and it is the join key
    expect(branch).not.toContain('twin_credentials') // it never reads or writes a key
    expect(branch).not.toContain("'create-user'") // it makes no account here
    // The lookup comes before the plan is hashed, and both creates after the hash is checked.
    expect(branch.indexOf('tt = ttSeatLookup(')).toBeLessThan(branch.indexOf('const fresh = await planHash(name, p, dry.reply)'))
    expect(branch.indexOf('if (fresh !== built.planHash) return refused(planMismatch(')).toBeLessThan(branch.indexOf("await invokeAsDev(session, 'ct-bridge'"))
    expect(branch).toContain('const prior = await hooks.priorApply(name, fresh)')
    expect(SERVER).toContain("const SERVER_VERSION = '0.130.0'")
    expect(SERVER).toContain('Writes are one hundred and fifty-six verbs and nothing else')
    expect(SERVER).toContain("plan_twin_seat → apply_twin_seat (a twin's held seat in CountTooling or TakeoffTooling made again")
    expect(README).toContain('| `plan_twin_seat(seat)` · `apply_twin_seat(seat, plan_hash)` |')
    expect(README).toContain("one hundred and forty-seven since v2.7974's seat pair")
    expect(README).toContain('one hundred and fifty-six `plan_` / `apply_` / `revert_` verbs')
    expect(EDGE).toContain("v2.7974 (server 0.117.0) — a twin's held seat made again from the seat")
  })
})
