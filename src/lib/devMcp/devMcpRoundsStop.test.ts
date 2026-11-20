import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  ROUNDS_AGENTS_READ,
  ROUNDS_KEY_SELECT,
  ROUNDS_STOP_RPC,
  ROUNDS_TWIN_SELECT,
  isRoundsStopVerb,
  roundsInHandWords,
  roundsKeyCommitment,
  roundsKeyFacts,
  roundsStopAppliedWords,
  roundsStopBody,
  roundsStopDryRun,
  roundsStopInput,
  type RoundsAgentRow,
  type RoundsKeyRow,
  type RoundsTwinRow,
} from '../../../supabase/functions/_shared/devMcpRoundsStop'
import { WRITE_VERBS, alreadyApplied, planHash, planVerbFor, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const HOOK = readFileSync('src/hooks/useRobotAgents.ts', 'utf8')
const CARD = readFileSync('src/components/bids/TwinRoundsCard.tsx', 'utf8')
const TWIN_SEAT = readFileSync('supabase/functions/twin-mcp/index.ts', 'utf8')
const TYPES = readFileSync('src/types/database.ts', 'utf8')
const MIGRATION = readFileSync('supabase/migrations/20261022060151_robot_agents.sql', 'utf8')

const TWIN_ID = '6a424303-0000-4000-8000-000000000001'
const EMAIL = 'twin-estimator-1@twins.pipetooling.local'
const twin = (over: Partial<RoundsTwinRow> = {}): RoundsTwinRow => ({ id: TWIN_ID, name: 'Twin Estimator 1', email: EMAIL, twin_kind: null, archived_at: null, ...over })
const key = (n: number, label: string, over: Partial<RoundsKeyRow> = {}): RoundsKeyRow => ({ id: `aaaaaaaa-0000-4000-8000-00000000000${n}`, label, created_at: `2026-11-1${n}T12:00:00Z`, last_seen_at: `2026-11-19T12:0${n}:00Z`, stopped_at: null, ...over })
const STOPPED = '2026-11-18T09:00:00Z'
const MINI = key(1, 'Office Mac mini')
const LAPTOP = key(2, 'Laptop')
const agent = (k: RoundsKeyRow, over: Partial<RoundsAgentRow> = {}): RoundsAgentRow => ({ credential_id: k.id, holds_open_shell: false, heartbeat_is_round: true, ...over })

describe('the rounds stopped and started from the dev seat (v2.7970)', () => {
  it('is two write verbs on the allowlist with no wrapper RPC', () => {
    expect(WRITE_VERBS.plan_rounds_stop).toEqual({ rpc: null, step: 'plan' })
    expect(WRITE_VERBS.apply_rounds_stop).toEqual({ rpc: null, step: 'apply' })
    expect(isRoundsStopVerb('apply_rounds_stop')).toBe(true)
    expect(isRoundsStopVerb('plan_twin_key_revoke')).toBe(false)
    expect(planVerbFor('apply_rounds_stop')).toBe('plan_rounds_stop')
  })

  it('takes a twin, a stop that is true or false, one key or none, and no other key', () => {
    expect(roundsStopInput('plan_rounds_stop', { rounds: { twin: EMAIL, stop: true } })).toEqual({ ok: true, p: { twin: EMAIL, stop: true }, target: EMAIL })
    expect(roundsStopInput('plan_rounds_stop', { rounds: { twin: TWIN_ID, stop: false, key_id: MINI.id.toUpperCase() } })).toEqual({ ok: true, p: { twin: TWIN_ID, stop: false, key_id: MINI.id }, target: TWIN_ID })
    for (const bad of [{}, { rounds: { twin: EMAIL } }, { rounds: { twin: EMAIL, stop: 'yes' } }, { rounds: { twin: 'wendi@example.com', stop: true } }, { rounds: { twin: EMAIL, stop: true, key_id: 'Office Mac mini' } }, { rounds: { twin: EMAIL, stop: true, key_id: 7 } }]) {
      const r = roundsStopInput('plan_rounds_stop', bad as Record<string, unknown>)
      expect(r.ok, JSON.stringify(bad)).toBe(false)
      if (!r.ok) expect(r.error).toContain('plan_rounds_stop needs rounds')
    }
    expect(roundsStopInput('apply_rounds_stop', { rounds: { twin: EMAIL, stop: true, label: 'Laptop' } })).toEqual({ ok: false, error: 'apply_rounds_stop: rounds takes twin, stop and key_id alone, not label.' })
    const built = writeRpcBody('apply_rounds_stop', { rounds: { twin: EMAIL, stop: true }, plan_hash: 'a'.repeat(64) })
    expect(built).toMatchObject({ ok: true, rpc: null, step: 'apply', body: { p: { twin: EMAIL, stop: true } }, target: EMAIL, planHash: 'a'.repeat(64) })
  })

  it('reads a key by columns that exist and never its hash, and the card\'s own read for what it has in hand', () => {
    const creds = TYPES.slice(TYPES.indexOf('      twin_credentials: {\n        Row: {'))
    const row = creds.slice(0, creds.indexOf('Insert: {'))
    for (const c of ROUNDS_KEY_SELECT.split(',')) expect(row, c).toContain(`          ${c}:`)
    expect(ROUNDS_KEY_SELECT.split(',')).not.toContain('token_hash')
    expect(ROUNDS_TWIN_SELECT.split(',')).toEqual(['id', 'name', 'email', 'twin_kind', 'archived_at'])
    expect(ROUNDS_AGENTS_READ).toBe('rpc/robot_agents')
    expect(HOOK).toContain("await db.rpc('robot_agents')")
    const agents = TYPES.slice(TYPES.indexOf('      robot_agents: {'))
    const cols = agents.slice(0, agents.indexOf('      robot_fixture_gate: {'))
    for (const c of ['credential_id', 'heartbeat_stage', 'heartbeat_is_round', 'heartbeat_bid_number', 'heartbeat_source_bid_number', 'holds_open_shell']) expect(cols, c).toContain(`          ${c}:`)
  })

  it('says what a key has in hand, and that it could not look when the read was refused', () => {
    expect(roundsInHandWords(MINI, null)).toBe('could not be read')
    expect(roundsInHandWords(MINI, [])).toBe('no call in seven days')
    expect(roundsInHandWords(MINI, [agent(MINI)])).toBe('nothing in hand')
    expect(roundsInHandWords(MINI, [agent(MINI, { holds_open_shell: true, heartbeat_source_bid_number: '509', heartbeat_bid_number: '2038', heartbeat_stage: 'TAKEOFF' })])).toBe('b509 in hand, at TAKEOFF, on a round')
    expect(roundsInHandWords(MINI, [agent(MINI, { holds_open_shell: true, heartbeat_bid_number: '2038', heartbeat_is_round: false })])).toBe('shell b2038 in hand, in a session started by hand, which a stop does not reach')
  })

  it('plans the stop: each key it changes, each already there, and what the robot does next', () => {
    const dry = roundsStopDryRun({ twin: EMAIL, stop: true }, twin(), [MINI, key(2, 'Laptop', { stopped_at: STOPPED })], [agent(MINI, { holds_open_shell: true, heartbeat_source_bid_number: '509', heartbeat_stage: 'COUNT' })])
    expect(dry.ok).toBe(true)
    if (!dry.ok) return
    expect(dry.change).toEqual([MINI])
    expect(dry.reply.action).toBe('stop')
    expect(dry.reply.twin).toEqual({ id: TWIN_ID, email: EMAIL, name: 'Twin Estimator 1', kind: 'estimator' })
    expect(dry.reply.change).toEqual([{ key_id: MINI.id, label: 'Office Mac mini', made_at: MINI.created_at, rounds: 'not stopped', last_seen_at: MINI.last_seen_at, in_hand: 'b509 in hand, at COUNT, on a round' }])
    expect(dry.reply.already).toEqual([{ key_id: LAPTOP.id, label: 'Laptop', made_at: LAPTOP.created_at, rounds: `stopped since ${STOPPED}`, last_seen_at: LAPTOP.last_seen_at, in_hand: 'no call in seven days' }])
    const then = String(dry.reply.then)
    expect(then).toContain('apply stops the rounds on that key as you, through robot_rounds_stop, as Stop the rounds on the Rounds card at Bids → Robots → Console does')
    expect(then).toContain('the robot finishes the bid in hand, then claims no more')
    expect(then).toContain('never a session a person starts by hand, and the key stays live')
    expect(then).toContain('scripts/twin/install-rounds.ts --uninstall takes it off')
    expect(then).toContain('The way back is this pair with stop: false.')
    // The card says the same two things, and the twin seat is where a round hears it.
    expect(CARD).toContain('The robot finishes the bid in hand, then claims no more.')
    expect(TWIN_SEAT).toContain("if ((cred as { stopped_at?: string | null } | null)?.stopped_at) return 'stop'")
  })

  it('plans the start again, on one key when the ask names it', () => {
    const stopped = [key(1, 'Office Mac mini', { stopped_at: STOPPED }), key(2, 'Laptop', { stopped_at: STOPPED })]
    const all = roundsStopDryRun({ twin: EMAIL, stop: false }, twin(), stopped, null)
    expect(all.ok && all.change.map((k) => k.label)).toEqual(['Office Mac mini', 'Laptop'])
    expect(all.ok && String(all.reply.then)).toContain('apply starts the rounds again on those 2 keys as you')
    expect(all.ok && String(all.reply.then)).toContain('The next round comes within five minutes on a Mac that has the agent installed and awake')
    expect(all.ok && (all.reply.change as Array<{ in_hand: string }>)[0]!.in_hand).toBe('could not be read')
    const one = roundsStopDryRun({ twin: EMAIL, stop: false, key_id: LAPTOP.id }, twin(), stopped, [])
    expect(one.ok && one.change.map((k) => k.label)).toEqual(['Laptop'])
    expect(one.ok && one.reply.already).toEqual([])
    expect(CARD).toContain('The rounds start again. The next round comes within five minutes.')
  })

  it('refuses in words: no twin, no live key, a key that is not one of its live keys, a press that changes nothing', () => {
    expect(roundsStopDryRun({ twin: EMAIL, stop: true }, null, [], null)).toEqual({ ok: false, refused: `No twin reads as ${EMAIL}. read_twin_keys lists every twin with its keys.` })
    expect(roundsStopDryRun({ twin: EMAIL, stop: true }, twin(), [], null)).toEqual({ ok: false, refused: `Nothing to plan: ${EMAIL} has no live key, so no rounds run as it. read_twin_keys lists every twin with its keys.` })
    const archived = roundsStopDryRun({ twin: EMAIL, stop: true }, twin({ archived_at: STOPPED }), [], null)
    expect(!archived.ok && archived.refused).toContain('has no live key (it is archived)')
    const other = roundsStopDryRun({ twin: EMAIL, stop: true, key_id: 'bbbbbbbb-0000-4000-8000-000000000009' }, twin(), [MINI], null)
    expect(!other.ok && other.refused).toBe(`No live key bbbbbbbb-0000-4000-8000-000000000009 on ${EMAIL}. Its live keys: "Office Mac mini" (${MINI.id}, not stopped).`)
    const again = roundsStopDryRun({ twin: EMAIL, stop: true }, twin(), [key(1, 'Office Mac mini', { stopped_at: STOPPED })], null)
    expect(!again.ok && again.refused).toContain('Nothing to plan: the rounds are stopped already on the key "Office Mac mini"')
    expect(!again.ok && again.refused).toContain('stop: false starts them again.')
    const running = roundsStopDryRun({ twin: EMAIL, stop: false }, twin(), [MINI, LAPTOP], null)
    expect(!running.ok && running.refused).toContain('Nothing to plan: the rounds are not stopped on each of its 2 live keys')
  })

  it('the plan commits to each key by its id, label and stop, never by its last call or what it has in hand', async () => {
    const p = { twin: EMAIL, stop: true }
    const a = roundsStopDryRun(p, twin(), [MINI, LAPTOP], [agent(MINI)])
    const later = roundsStopDryRun(p, twin(), [{ ...MINI, last_seen_at: '2026-11-19T12:30:00Z' }, LAPTOP], [agent(MINI, { holds_open_shell: true, heartbeat_bid_number: '2038' })])
    const unread = roundsStopDryRun(p, twin(), [MINI, LAPTOP], null)
    const fewer = roundsStopDryRun(p, twin(), [MINI], [agent(MINI)])
    const oneStopped = roundsStopDryRun(p, twin(), [MINI, { ...LAPTOP, stopped_at: STOPPED }], [agent(MINI)])
    if (!a.ok || !later.ok || !unread.ok || !fewer.ok || !oneStopped.ok) throw new Error('each plans')
    const h = await planHash('plan_rounds_stop', p, a.reply)
    expect(await planHash('apply_rounds_stop', p, later.reply)).toBe(h) // a robot working between plan and apply does not move it
    expect(await planHash('apply_rounds_stop', p, unread.reply)).toBe(h) // nor does a read of the card that was refused
    expect(await planHash('plan_rounds_stop', p, fewer.reply)).not.toBe(h)
    expect(await planHash('plan_rounds_stop', p, oneStopped.reply)).not.toBe(h)
    expect(roundsKeyCommitment([roundsKeyFacts(MINI, [agent(MINI)])])).toEqual([{ key_id: MINI.id, label: 'Office Mac mini', made_at: MINI.created_at, rounds: 'not stopped' }])
    expect(roundsKeyCommitment(undefined)).toBeNull()
    expect(alreadyApplied('apply_rounds_stop', { at: '2026-11-19T12:00:00Z', target: EMAIL })).toContain('The rounds stand as it set them')
  })

  it('the call is the card\'s own, a key at a time, and the RPC takes a dev and a key still live', () => {
    expect(ROUNDS_STOP_RPC).toBe('robot_rounds_stop')
    expect(roundsStopBody(MINI, true)).toEqual({ p_credential_id: MINI.id, p_stop: true })
    expect(roundsStopBody(MINI, false)).toEqual({ p_credential_id: MINI.id, p_stop: false })
    expect(HOOK).toContain("await db.rpc('robot_rounds_stop', { p_credential_id: credentialId, p_stop: stop })")
    expect(TYPES).toContain('      robot_rounds_stop: {\n        Args: { p_credential_id: string; p_stop: boolean }')
    expect(MIGRATION).toContain("u.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role])) INTO v_ok")
    expect(MIGRATION).toContain('WHERE id = p_credential_id AND revoked_at IS NULL')
  })

  it('the closing line says what changed, what was held and why, and the way back', () => {
    const t = twin()
    expect(roundsStopAppliedWords([{ key_id: MINI.id, label: 'Office Mac mini', ok: true, words: 'stopped' }], t, true)).toBe(
      `Stopping the rounds on 1 key of Twin Estimator 1: "Office Mac mini". The robot finishes the bid in hand, then claims no more. The way back is plan_rounds_stop { rounds: { twin: "${EMAIL}", stop: false } }.`,
    )
    const mixed = roundsStopAppliedWords([{ key_id: MINI.id, label: 'Office Mac mini', ok: true, words: 'started again' }, { key_id: LAPTOP.id, label: 'Laptop', ok: false, words: 'No live key with that id' }], t, false)
    expect(mixed).toContain('The rounds start again on 1 key of Twin Estimator 1: "Office Mac mini". The next round comes within five minutes.')
    expect(mixed).toContain('Held: "Laptop" (No live key with that id). read_twin_keys says where each stands')
    expect(mixed).toContain('stop: true } }.')
    expect(roundsStopAppliedWords([{ key_id: MINI.id, label: 'Office Mac mini', ok: false, words: 'answered 500' }], t, true)).toContain(`Nothing changed on ${EMAIL}. Held: "Office Mac mini" (answered 500).`)
  })

  it('the server declares the pair, calls the card\'s RPC once a key and writes no table, and the docs carry the door', () => {
    for (const verb of ['plan_rounds_stop', 'apply_rounds_stop']) {
      expect(SERVER).toContain(`name: '${verb}'`)
      expect(SERVER).toContain(`case '${verb}':`)
    }
    const from = SERVER.indexOf("case 'plan_rounds_stop':")
    const branch = SERVER.slice(from, SERVER.indexOf("case 'plan_twin_seat':", from))
    expect(branch).toContain("if (who.role !== 'dev') return refused(`${name} writes, and only a dev's own key may write.`)")
    expect(branch).toContain("await restGet(session, 'users', `select=${ROUNDS_TWIN_SELECT}&${twinRefQuery(p.twin)}&limit=1`)")
    expect(branch).toContain("await restGet(session, 'twin_credentials', `select=${ROUNDS_KEY_SELECT}&twin_user_id=eq.${twinRow.id}&revoked_at=is.null&order=created_at.desc&limit=1000`)")
    // What a key has in hand is fail-soft: a refused read stays null, and the plan says it could not look.
    expect(branch).toContain('let agents: RoundsAgentRow[] | null = null')
    expect(branch).toContain("const agentsRead = await restGet(session, ROUNDS_AGENTS_READ, '')")
    expect(branch).toContain('await restPost(session, `rpc/${ROUNDS_STOP_RPC}`, roundsStopBody(key, p.stop))')
    expect(branch.match(/restPost\(/g)).toHaveLength(1) // the card's RPC, in a loop over the keys the plan named
    expect(branch).not.toContain('restRows(') // no table is written: the RPC sets the two columns
    expect(branch).not.toContain('invokeAsDev(')
    expect(branch).not.toContain('token_hash')
    expect(branch).toContain('if (fresh !== built.planHash) return refused(planMismatch(')
    expect(branch).toContain('const prior = await hooks.priorApply(name, fresh)')
    expect(SERVER).toContain("const SERVER_VERSION = '0.119.0'")
    expect(SERVER).toContain('plan_rounds_stop → apply_rounds_stop (the rounds stopped on a twin\'s key or started again')
    expect(README).toContain('| `plan_rounds_stop(rounds)` · `apply_rounds_stop(rounds, plan_hash)` |')
  })
})
