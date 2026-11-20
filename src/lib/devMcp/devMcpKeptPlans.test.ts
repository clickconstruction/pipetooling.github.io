/**
 * The dev seat's half of the one approvals list (punch list #315, upgrade 3a): keep: true on a person-file plan verb,
 * list_kept_plans, drop_kept_plan, and an apply that settles the plan it applied. Made-up people and words.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  KEPT_ARGS_MAX_BYTES,
  KEPT_PLAN_LIST_COLUMNS,
  KEPT_PLAN_LIST_MAX,
  KEPT_PLAN_WHOLE_COLUMNS,
  KEPT_REPLY_MAX_BYTES,
  KEPT_WHY_MAX,
  KEPT_WORDS_MAX,
  decideBody,
  dropKeptPlanInput,
  keepAsk,
  keepBody,
  keptPlanByHashQuery,
  keptPlanPersonOfArgs,
  keptPlanStoredArgs,
  keptPlanVerbOfApply,
  keptPlanWholeQuery,
  keptPlanWholeReply,
  keptPlansInput,
  keptPlansListQuery,
  keptPlansListReply,
  keptReplyForStore,
  keptWords,
  notKeptWords,
  sameKeptArgs,
  settledWords,
  staleCandidates,
  type KeptPlanRead,
} from '../../../supabase/functions/_shared/devMcpKeptPlans'
import { WRITE_VERBS, isWriteVerb, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { CATALOG_RPCS, CATALOG_TABLES } from '../../../supabase/functions/dev-mcp/catalog'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const EDGE = readFileSync('docs/EDGE_FUNCTIONS.md', 'utf8')
const HR = readFileSync('docs/HR_FILES.md', 'utf8')
const MIGRATION = readFileSync('supabase/migrations/20261113120000_dev_seat_kept_plans.sql', 'utf8')

const PERSON = '11111111-2222-4333-8444-555555555555'
const OTHER = '22222222-2222-4333-8444-555555555555'
const REPORT = '99999999-2222-4333-8444-555555555555'
const K1 = 'aaaaaaa1-2222-4333-8444-555555555555'
const K2 = 'aaaaaaa2-2222-4333-8444-555555555555'
const K3 = 'aaaaaaa3-2222-4333-8444-555555555555'
const HASH = 'a'.repeat(64)
const WORDS = 'Files one entry on the March 30 call, as Pat told it. Nothing else on the file changes.'
const ENTRY = { person_id: PERSON, entries: [{ entry_date: '2026-03-30', source: 'conversation', content: 'Called in at 6:40.' }] }
const ymdOf = (iso: string) => iso.slice(0, 10)

const row = (id: string, over: Partial<KeptPlanRead> = {}): KeptPlanRead => ({
  id,
  person_id: PERSON,
  verb: 'plan_hr_entry',
  plan_hash: HASH,
  words: WORDS,
  author_label: 'Dev One',
  session_label: 'the Tuesday session',
  kept_at: '2026-11-17T15:00:00Z',
  state: 'waiting',
  decided_label: null,
  decided_at: null,
  decided_why: null,
  ...over,
})

describe('keep: true on a plan (devMcpKeptPlans.ts over the tab\'s kernel)', () => {
  it('a plan that asks nothing is left alone, and an ask is read before any dry run runs', () => {
    expect(keepAsk('plan_hr_entry', { entry: ENTRY })).toBeNull()
    expect(keepAsk('plan_hr_entry', { entry: ENTRY, keep: false })).toBeNull()
    // Another verb's own `keep` is not this list's key: the review of theme marks keeps a list of mark ids.
    expect(keepAsk('plan_theme_review', { keep: ['11111111-2222-4333-8444-555555555555'], take_off: [] })).toBeNull()
    expect(keepAsk('apply_theme_review', { keep: ['11111111-2222-4333-8444-555555555555'], plan_hash: HASH })).toBeNull()
    expect(writeRpcBody('plan_theme_review', { keep: ['11111111-2222-4333-8444-555555555555'] })).toMatchObject({ ok: true, rpc: 'dev_theme_review_write' })
    const ask = keepAsk('plan_hr_entry', { entry: ENTRY, keep: true, words: `  ${WORDS}  `, session: ' the Tuesday session ' })
    expect(ask).toEqual({ ok: true, verb: 'plan_hr_entry', words: WORDS, session: 'the Tuesday session', stored: { entry: ENTRY } })
    // The seat's own keys are never stored: an apply sends the verb's arguments and the hash.
    expect(keptPlanStoredArgs({ entry: ENTRY, keep: true, words: WORDS, session: 's', plan_hash: HASH })).toEqual({ entry: ENTRY })
    expect(keepAsk('plan_person_doc', { doc: { person_id: PERSON, kind: 'summary', markdown: '## Trajectory\nSteady.' }, keep: true, words: WORDS })).toMatchObject({ ok: true, verb: 'plan_person_doc', session: null })
    expect(keepAsk('plan_person_report', { report: { report_id: REPORT, action: 'file' }, keep: true, words: WORDS })).toMatchObject({ ok: true, verb: 'plan_person_report' })
  })

  it('refuses in words: no words, a verb the list does not take, an apply, a file\'s bytes, counsel-only, a plan too large', () => {
    const bad = (verb: string, args: Record<string, unknown>, words: string) => {
      const r = keepAsk(verb, args)
      expect(r && !r.ok ? r.error : `kept: ${JSON.stringify(r)}`, words).toContain(words)
    }
    bad('plan_hr_entry', { entry: ENTRY, keep: 'yes' }, 'keep is true, or left out')
    bad('plan_hr_entry', { entry: ENTRY, keep: true }, 'a kept plan needs words')
    bad('plan_hr_entry', { entry: ENTRY, keep: true, words: 'x'.repeat(KEPT_WORDS_MAX + 1) }, 'a kept plan needs words')
    bad('plan_hr_entry', { entry: ENTRY, keep: true, words: WORDS, session: 'x'.repeat(121) }, 'session is the name this session goes by')
    bad('apply_hr_entry', { entry: ENTRY, keep: true, words: WORDS, plan_hash: HASH }, 'keep goes on the plan, not the apply')
    bad('plan_case', { case: { person_id: PERSON, log: ['x'] }, keep: true, words: WORDS }, 'plan_case is not a plan that can be kept')
    bad('plan_person_evidence', { evidence: { person_id: PERSON, files: [{ name: 'a.pdf', content_base64: 'AAAA' }] }, keep: true, words: WORDS }, 'is not a plan that can be kept')
    bad('plan_person_doc', { doc: { person_id: PERSON, title: 'For counsel', markdown: 'x', counsel_only: true }, keep: true, words: WORDS }, 'A counsel-only plan is not kept')
    bad('plan_person_doc', { doc: { person_id: PERSON, kind: 'narrative', markdown: 'x'.repeat(KEPT_ARGS_MAX_BYTES) }, keep: true, words: WORDS }, 'a plan this large is not kept')
  })

  it('names the person the arguments write to, and leaves a field report\'s to the report', () => {
    expect(keptPlanPersonOfArgs('plan_hr_entry', { entry: { ...ENTRY, person_id: PERSON.toUpperCase() } })).toBe(PERSON)
    expect(keptPlanPersonOfArgs('plan_person_doc', { doc: { person_id: PERSON, kind: 'summary' } })).toBe(PERSON)
    expect(keptPlanPersonOfArgs('plan_person_doc', { doc: { kind: 'summary' } })).toBeNull()
    expect(keptPlanPersonOfArgs('plan_person_report', { report: { report_id: REPORT, action: 'file' } })).toBeNull()
  })

  it('the door\'s body holds the verb\'s own arguments, the plan\'s own hash and the reply as shown; a long reply is cut and says so', () => {
    const ask = keepAsk('plan_hr_entry', { entry: ENTRY, keep: true, words: WORDS, session: 'the Tuesday session' })
    if (!ask || !ask.ok) throw new Error('the ask should be kept')
    const planned = { plan_hash: HASH, next: 'Read this plan.', person: { id: PERSON, name: 'Pat Doe' }, entries_inserted: 1 }
    expect(keepBody(ask, PERSON, HASH, planned)).toEqual({ p: { person_id: PERSON, verb: 'plan_hr_entry', args: { entry: ENTRY }, plan_hash: HASH, reply: planned, words: WORDS, session: 'the Tuesday session' } })
    const long = keptReplyForStore({ plan_hash: HASH, changes: 'é'.repeat(60_000) })
    expect(long).toMatchObject({ shortened: true, plan_hash: HASH })
    expect(new TextEncoder().encode(JSON.stringify(long)).length).toBeLessThanOrEqual(KEPT_REPLY_MAX_BYTES)
    expect(String(long.why)).toContain('Plan again with the kept arguments to read it whole')
    expect(keptReplyForStore('ok')).toEqual({ result: 'ok' })
    // What the plan's reply gains, kept or not.
    expect(keptWords('plan_hr_entry', { kept_id: K1, state: 'waiting', waiting: 2 })).toMatchObject({ kept_id: K1, kept: { state: 'waiting', waiting_on_this_file: 2 } })
    expect(String((keptWords('plan_person_doc', { kept_id: K1 }).kept as { next: string }).next)).toContain('call apply_person_doc with the same arguments and plan_hash')
    expect(notKeptWords('dev_kept_plan_keep: this plan is already kept and waiting')).toMatchObject({ kept_id: null, not_kept: { why: 'dev_kept_plan_keep: this plan is already kept and waiting' } })
  })
})

describe('list_kept_plans', () => {
  it('reads its input, and builds the reads the seat sends as the dev', () => {
    expect(keptPlansInput({})).toEqual({ ok: true, id: null, person: null, show: 'waiting' })
    expect(keptPlansInput({ person: ' Pat Doe ', show: 'all' })).toEqual({ ok: true, id: null, person: 'Pat Doe', show: 'all' })
    expect(keptPlansInput({ id: K1.toUpperCase() })).toEqual({ ok: true, id: K1, person: null, show: 'waiting' })
    expect(keptPlansInput({ id: 'the first one' })).toMatchObject({ ok: false })
    expect(keptPlansInput({ show: 'stale' })).toMatchObject({ ok: false })
    expect(keptPlansListQuery(PERSON, 'waiting')).toBe(`select=${KEPT_PLAN_LIST_COLUMNS}&person_id=eq.${PERSON}&state=in.(waiting,stale)&order=kept_at.desc&limit=${KEPT_PLAN_LIST_MAX}`)
    expect(keptPlansListQuery(null, 'all')).toBe(`select=${KEPT_PLAN_LIST_COLUMNS}&order=kept_at.desc&limit=${KEPT_PLAN_LIST_MAX}`)
    expect(keptPlanWholeQuery(K1)).toBe(`select=${KEPT_PLAN_WHOLE_COLUMNS}&id=eq.${K1}&limit=1`)
    expect(keptPlanByHashQuery('plan_hr_entry', HASH)).toBe(`select=id,person_id,verb,plan_hash,args,state&verb=eq.plan_hr_entry&plan_hash=eq.${HASH}&state=eq.waiting&limit=5`)
    // Nothing that is not a keepable verb and a whole hash ever reaches a query string.
    expect(keptPlanByHashQuery('plan_case', HASH)).toBeNull()
    expect(keptPlanByHashQuery('plan_hr_entry', `${HASH}&state=eq.applied`)).toBeNull()
    // Every column named is one the table has, and the list never reads the arguments.
    const columns = Object.keys(CATALOG_TABLES.dev_seat_kept_plans!.columns)
    for (const c of KEPT_PLAN_WHOLE_COLUMNS.split(',')) expect(columns, c).toContain(c)
    expect(KEPT_PLAN_LIST_COLUMNS.split(',')).not.toContain('args')
    expect(KEPT_PLAN_LIST_COLUMNS.split(',')).not.toContain('reply')
  })

  it('the plans that wait, the longest wait first, then the ones that went stale this week; a waiting row carries its hash', () => {
    const rows = [
      row(K2, { kept_at: '2026-11-19T10:00:00Z', verb: 'plan_person_doc', person_id: OTHER }),
      row(K1, { kept_at: '2026-11-17T15:00:00Z' }),
      row(K3, { state: 'stale', decided_label: 'Dev Two', decided_at: '2026-11-18T09:00:00Z', decided_why: 'the document was saved since' }),
      row('old-stale', { state: 'stale', decided_at: '2026-10-01T09:00:00Z', decided_why: 'old' }),
    ]
    const nameOf = (id: string) => (id === PERSON ? 'Pat Doe' : id === OTHER ? 'Sam Roe' : null)
    const out = keptPlansListReply(rows, { show: 'waiting', person: null }, nameOf, '2026-11-19', ymdOf) as { waiting: number; plans: Record<string, unknown>[]; stale_this_week: Record<string, unknown>[]; next: string }
    expect(out.waiting).toBe(2)
    expect(out.plans.map((p) => p.kept_id)).toEqual([K1, K2])
    expect(out.plans[0]).toEqual({
      kept_id: K1,
      person: { id: PERSON, name: 'Pat Doe' },
      about: 'an HR entry',
      verb: 'plan_hr_entry',
      state: 'waiting',
      words: WORDS,
      kept: 'Kept by Dev One’s agent, the Tuesday session, Nov 17, 2026',
      kept_at: '2026-11-17T15:00:00Z',
      age: 'waiting 2 days',
      plan_hash: HASH,
    })
    expect(out.plans[1]).toMatchObject({ about: 'an HR document', person: { id: OTHER, name: 'Sam Roe' }, age: 'waiting today' })
    expect(out.stale_this_week).toEqual([expect.objectContaining({ kept_id: K3, state: 'stale', decided: { by: 'Dev Two', at: '2026-11-18T09:00:00Z', why: 'the document was saved since' } })])
    expect(out.stale_this_week[0]).not.toHaveProperty('plan_hash')
    expect(out.next).toContain("only on the owner's yes for that plan")
    const all = keptPlansListReply(rows, { show: 'all', person: { id: PERSON, name: 'Pat Doe' } }, nameOf, '2026-11-19', ymdOf) as { plans: unknown[] }
    expect(all.plans).toHaveLength(4)
    expect(all).not.toHaveProperty('stale_this_week')
  })

  it('one plan whole carries the arguments and the call that applies it; a decided plan offers none', () => {
    const whole = keptPlanWholeReply(row(K1, { args: { entry: ENTRY }, reply: { plan_hash: HASH, entries_inserted: 1 } }), 'Pat Doe', '2026-11-19', ymdOf) as Record<string, unknown>
    expect(whole).toMatchObject({ kept_id: K1, plan_hash: HASH, args: { entry: ENTRY }, reply_as_kept: { plan_hash: HASH, entries_inserted: 1 } })
    expect(whole.apply).toMatchObject({ verb: 'apply_hr_entry', arguments: { entry: ENTRY, plan_hash: HASH } })
    expect(String((whole.apply as { rule: string }).rule)).toContain("Only on the owner's yes for this plan")
    const dropped = keptPlanWholeReply(row(K2, { state: 'dropped', decided_at: '2026-11-18T09:00:00Z', decided_why: 'superseded', args: { entry: ENTRY } }), 'Pat Doe', '2026-11-19', ymdOf)
    expect(dropped.apply).toBeNull()
  })
})

describe('an apply settles the kept plan, and drop_kept_plan takes one off', () => {
  it('knows which applies can settle one, and which waiting rows a failed hash turns stale', () => {
    expect([keptPlanVerbOfApply('apply_hr_entry'), keptPlanVerbOfApply('apply_person_doc'), keptPlanVerbOfApply('apply_person_report'), keptPlanVerbOfApply('apply_case'), keptPlanVerbOfApply('plan_hr_entry')]).toEqual(['plan_hr_entry', 'plan_person_doc', 'plan_person_report', null, null])
    // The same arguments in another key order are the same plan; the seat's own keys do not count.
    expect(sameKeptArgs({ entry: { entries: ENTRY.entries, person_id: PERSON } }, { entry: ENTRY, plan_hash: HASH })).toBe(true)
    expect(sameKeptArgs({ entry: ENTRY }, { entry: { ...ENTRY, entries: [] }, plan_hash: HASH })).toBe(false)
    // A session that quoted a kept plan's hash over other arguments does not turn that plan stale.
    expect(staleCandidates([{ id: K1, args: { entry: ENTRY } }, { id: K2, args: { entry: { ...ENTRY, person_id: OTHER } } }], { entry: ENTRY, plan_hash: HASH })).toEqual([K1])
  })

  it('the decision\'s body and the words an apply\'s reply gains', () => {
    expect(decideBody(K1, 'applied')).toEqual({ p_id: K1, p_state: 'applied' })
    expect(decideBody(K1, 'stale', '  the document was saved since  ')).toEqual({ p_id: K1, p_state: 'stale', p_why: 'the document was saved since' })
    expect(String(decideBody(K1, 'stale', 'x'.repeat(KEPT_WHY_MAX + 80)).p_why)).toHaveLength(KEPT_WHY_MAX)
    expect(settledWords([], 'applied', null)).toEqual({})
    expect(settledWords([K1], 'applied', null)).toMatchObject({ kept: { state: 'applied', kept_ids: [K1] } })
    expect(settledWords([K1], 'stale', null)).toMatchObject({ kept: { state: 'stale' } })
    // The write already landed: a decision that fails is said, and never fails the apply.
    expect(settledWords([K1], 'applied', 'permission denied')).toMatchObject({ kept: { state: 'waiting', kept_ids: [K1] } })
  })

  it('drop_kept_plan needs the plan and a reason, and is one write verb over the decision door', () => {
    expect(dropKeptPlanInput({ id: K1.toUpperCase(), why: '  Superseded by the Thursday plan.  ' })).toEqual({ ok: true, body: { p_id: K1, p_state: 'dropped', p_why: 'Superseded by the Thursday plan.' }, target: K1 })
    for (const input of [{}, { id: K1 }, { id: K1, why: '   ' }, { id: 'the first one', why: 'x' }, { id: K1, why: 'x'.repeat(KEPT_WHY_MAX + 1) }]) expect(dropKeptPlanInput(input), JSON.stringify(input)).toMatchObject({ ok: false, error: expect.stringContaining('drop_kept_plan needs id') })
    expect(isWriteVerb('drop_kept_plan')).toBe(true)
    expect(WRITE_VERBS.drop_kept_plan).toEqual({ rpc: 'dev_kept_plan_decide', step: 'drop' })
    expect(writeRpcBody('drop_kept_plan', { id: K1, why: 'Superseded.' })).toEqual({ ok: true, rpc: 'dev_kept_plan_decide', step: 'drop', body: { p_id: K1, p_state: 'dropped', p_why: 'Superseded.' }, dryRunBody: null, target: K1, planHash: null })
    expect(writeRpcBody('drop_kept_plan', { id: K1 })).toMatchObject({ ok: false })
    // The three keepable plans stay what they were in the grammar: keep is the seat's key, not the verb's.
    expect(writeRpcBody('plan_hr_entry', { entry: ENTRY, keep: true, words: WORDS })).toMatchObject({ ok: true, body: { p: ENTRY, p_dry_run: true } })
  })
})

describe('the seat, its docs and the migration carry the list', () => {
  it('the catalog knows the table and both doors, and the migration grants them to a dev alone', () => {
    expect(CATALOG_RPCS.dev_kept_plan_keep).toBeTruthy()
    expect(CATALOG_RPCS.dev_kept_plan_decide).toBeTruthy()
    expect(MIGRATION).toContain("SELECT ARRAY['plan_hr_entry', 'plan_person_doc', 'plan_person_report']")
    expect(MIGRATION).toContain('GRANT EXECUTE ON FUNCTION public.dev_kept_plan_keep(jsonb) TO authenticated;')
    expect(MIGRATION).toContain('GRANT EXECUTE ON FUNCTION public.dev_kept_plan_decide(uuid, text, text) TO authenticated;')
  })

  it('the server keeps a plan only after its dry run, settles one after an apply, and never keeps through view_as', () => {
    for (const v of ['list_kept_plans', 'drop_kept_plan']) {
      expect(SERVER).toContain(`case '${v}':`)
      expect(SERVER).toContain(`name: '${v}',`)
    }
    expect(SERVER).toContain("restPost(session, 'rpc/dev_kept_plan_keep', keepBody(")
    expect(SERVER).toContain("restPost(session, 'rpc/dev_kept_plan_decide', decideBody(")
    expect(SERVER).toContain('list_kept_plans reads the plans kept for a yes')
    // A kept plan's hash is read by the seat's own query: the door's generic reads redact a column named *_hash.
    expect(SERVER).toContain("restGet(session, 'dev_seat_kept_plans', ")
  })

  it('the README, the function reference and the HR reference say what the seat keeps, lists and drops', () => {
    expect(README).toContain('`list_kept_plans(person?, id?, show?)` · `drop_kept_plan(id, why)`')
    expect(README).toContain('`keep: true`')
    expect(EDGE).toContain('a plan kept for a yes from the seat')
    expect(HR).toContain('`list_kept_plans`')
  })
})
