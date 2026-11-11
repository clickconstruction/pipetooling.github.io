import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  PERSON_MATTER_NEXT_VERBS,
  PERSON_MATTER_PERSON_SELECT,
  PERSON_MATTER_STANDING_SELECT,
  isPersonMatterVerb,
  personMatterAppliedWords,
  personMatterDryRun,
  personMatterInput,
  personMatterRpc,
  personMatterStageWords,
  type PersonMatterPersonRow,
  type PersonMatterStandingRow,
} from '../../../supabase/functions/_shared/devMcpPersonMatter'
import { WRITE_VERBS, alreadyApplied, planHash, planReply, planVerbFor, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { CATALOG_TABLES } from '../../../supabase/functions/dev-mcp/catalog'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const EDGE = readFileSync('docs/EDGE_FUNCTIONS.md', 'utf8')
const HR = readFileSync('docs/HR_FILES.md', 'utf8')
const MIGRATION = readFileSync('supabase/migrations/20261105220000_legal_person_matter.sql', 'utf8')

const PERSON = '11111111-2222-4333-8444-555555555555'
const LOGIN = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const MATTER = 'c1b2c3d4-0000-4000-8000-000000000077'
const person: PersonMatterPersonRow = { id: PERSON, name: 'Pat Doe', kind: 'helper', archived_at: '2026-09-01T00:00:00Z', account_user_id: LOGIN }
const standing: PersonMatterStandingRow = { id: MATTER, stage: 'review', closed_at: null, closed_reason: '', handling_name: 'Doe matter', person_id: PERSON, updated_at: '2026-11-05T22:30:00Z' }

describe('the person-matter verbs (open a matter on a person from the dev seat, v2.6582 / punch list #269 PR 3b)', () => {
  it('are two write verbs on the allowlist with no wrapper RPC — they POST the HR file\'s own legal_person_matter_open, which the person-matter migration holds to devs', () => {
    expect(WRITE_VERBS.plan_matter_open_person).toEqual({ rpc: null, step: 'plan' })
    expect(WRITE_VERBS.apply_matter_open_person).toEqual({ rpc: null, step: 'apply' })
    expect(isPersonMatterVerb('plan_matter_open_person')).toBe(true)
    expect(isPersonMatterVerb('plan_person_report')).toBe(false)
    expect(planVerbFor('apply_matter_open_person')).toBe('plan_matter_open_person')
    expect(MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.legal_person_matter_open(p_person_id uuid, p_handling_name text DEFAULT \'\')')
    expect(MIGRATION).toContain("IF NOT public.is_dev() THEN RETURN jsonb_build_object('error', 'A matter on a person is a dev''s to open'); END IF;")
    expect(MIGRATION).toContain('CREATE UNIQUE INDEX IF NOT EXISTS legal_matters_person_id_key') // one matter a person
    for (const c of PERSON_MATTER_PERSON_SELECT.split(',')) expect(Object.keys(CATALOG_TABLES.people!.columns)).toContain(c)
    for (const c of PERSON_MATTER_STANDING_SELECT.split(',')) expect(Object.keys(CATALOG_TABLES.legal_matters!.columns)).toContain(c)
  })

  it('the shape: a person\'s id, lower-cased, and a handling name only when given; the rest is refused in words', () => {
    const plain = writeRpcBody('plan_matter_open_person', { matter: { person_id: PERSON.toUpperCase() } })
    expect(plain).toMatchObject({ ok: true, rpc: null, step: 'plan', target: PERSON, body: { p: { person_id: PERSON } } })
    expect(plain.ok && plain.body.p).not.toHaveProperty('handling_name')
    const named = personMatterInput('apply_matter_open_person', { matter: { person_id: PERSON, handling_name: ' Doe matter ' } })
    expect(named).toEqual({ ok: true, p: { person_id: PERSON, handling_name: 'Doe matter' }, target: PERSON })
    const bad = (input: Record<string, unknown>) => {
      const r = personMatterInput('plan_matter_open_person', input)
      return r.ok ? '' : r.error
    }
    expect(bad({})).toContain('needs matter')
    expect(bad({ matter: { person_id: 'nope' } })).toContain('needs matter')
    expect(bad({ matter: { person_id: PERSON, handling_name: 'x'.repeat(201) } })).toContain('under 200 characters')
    const noHash = writeRpcBody('apply_matter_open_person', { matter: { person_id: PERSON } })
    expect(noHash.ok ? '' : noHash.error).toContain('needs plan_hash')
  })

  it('the dry run shows the person and the matter as the RPC would open it, and refuses no person or a matter that already stands', () => {
    const dry = personMatterDryRun({ person_id: LOGIN, handling_name: 'Doe matter' }, person, null, calendarYmdInAppTzFromIso)
    expect(dry.ok).toBe(true)
    const reply = dry.ok ? dry.reply : {}
    expect(reply.person).toEqual({ id: PERSON, name: 'Pat Doe', kind: 'helper', archived: true })
    expect(reply.matter).toBeNull()
    expect(reply.after).toEqual({ kind: 'person', stage: 'review', stage_words: 'Under review', payer_name: 'Pat Doe', handling_name: 'Doe matter', released: false })
    expect(String(reply.then)).toContain('legal_person_matter_open')
    expect(String(reply.then)).toContain('Matter · Under review')
    expect(String(reply.then)).toContain(PERSON_MATTER_NEXT_VERBS)

    const none = personMatterDryRun({ person_id: PERSON }, null, null, calendarYmdInAppTzFromIso)
    expect(none.ok ? '' : none.refused).toContain(`No person ${PERSON}`)
    const stands = personMatterDryRun({ person_id: PERSON }, person, standing, calendarYmdInAppTzFromIso)
    expect(stands.ok ? '' : stands.refused).toBe(`Nothing to plan: a matter already stands on Pat Doe (matter_id ${MATTER}, Under review, Doe matter · last changed 2026-11-05). One matter a person. Write on it instead: ${PERSON_MATTER_NEXT_VERBS}; get_person_file and read_rows on legal_matters by person_id show it.`)
    expect(personMatterStageWords({ stage: 'in_house', closed_at: null, closed_reason: '' })).toBe('In house')
    expect(personMatterStageWords({ stage: 'demand', closed_at: null, closed_reason: '' })).toBe('With the firm')
    expect(personMatterStageWords({ stage: 'review', closed_at: '2026-11-06T00:00:00Z', closed_reason: 'settled' })).toBe('Closed · settled')
  })

  it('the plan hash is stable over the same ask and world, and moves with the person, the name or a matter standing', async () => {
    const p = { person_id: PERSON }
    const dry = personMatterDryRun(p, person, null, calendarYmdInAppTzFromIso)
    const reply = dry.ok ? dry.reply : {}
    const a = await planHash('plan_matter_open_person', p, reply)
    const b = await planHash('apply_matter_open_person', p, personMatterDryRun(p, person, null, calendarYmdInAppTzFromIso).ok ? (personMatterDryRun(p, person, null, calendarYmdInAppTzFromIso) as { ok: true; reply: Record<string, unknown> }).reply : {})
    expect(a).toBe(b)
    const renamed = personMatterDryRun(p, { ...person, name: 'Pat Doe-Ray' }, null, calendarYmdInAppTzFromIso)
    expect(await planHash('plan_matter_open_person', p, renamed.ok ? renamed.reply : {})).not.toBe(a)
    const handled = personMatterDryRun({ ...p, handling_name: 'Doe matter' }, person, null, calendarYmdInAppTzFromIso)
    expect(await planHash('plan_matter_open_person', { ...p, handling_name: 'Doe matter' }, handled.ok ? handled.reply : {})).not.toBe(a)
    const shown = planReply('plan_matter_open_person', reply, a)
    expect(shown.plan_hash).toBe(a)
    expect(String(shown.next)).toContain('apply_matter_open_person')
  })

  it('the RPC body carries the resolved people row and the handling name, and the words after read the RPC\'s own answer', () => {
    expect(personMatterRpc({ person_id: LOGIN }, PERSON)).toEqual({ rpc: 'legal_person_matter_open', body: { p_person_id: PERSON, p_handling_name: '' } })
    expect(personMatterRpc({ person_id: PERSON, handling_name: 'Doe matter' }, PERSON).body).toEqual({ p_person_id: PERSON, p_handling_name: 'Doe matter' })
    expect(personMatterAppliedWords({ ok: true, matter_id: MATTER, stage: 'review', closed: false, made: true, person_name: 'Pat Doe' }, 'Pat Doe')).toBe(`Opened: matter ${MATTER} stands on Pat Doe, Under review, nothing released; the HR file's Matter view draws it. Write on it now: ${PERSON_MATTER_NEXT_VERBS}.`)
    expect(personMatterAppliedWords({ ok: true, matter_id: MATTER, made: false, person_name: 'Pat Doe' }, '')).toContain(`Nothing new: a matter already stood on Pat Doe (matter_id ${MATTER})`)
    expect(alreadyApplied('apply_matter_open_person', { target: PERSON, at: '2026-11-06T15:00:00Z' })).toBe('Nothing written: this plan was already applied on this person at 2026-11-06T15:00:00Z. The matter stands: get_person_file and read_rows on legal_matters by person_id show it, and the HR file\'s Matter view draws it. Write on its matter_id instead.')
  })

  it('the server declares both verbs with their own case after the report verbs, reports the version, and the docs carry the door', () => {
    for (const verb of ['plan_matter_open_person', 'apply_matter_open_person']) {
      expect(SERVER).toContain(`name: '${verb}'`)
      expect(SERVER).toContain(`case '${verb}':`)
    }
    expect(SERVER.indexOf("case 'plan_matter_open_person':")).toBeGreaterThan(SERVER.indexOf("case 'apply_person_report': {"))
    expect(SERVER).toContain("await restPost(session, `rpc/${call.rpc}`, call.body)")
    expect(SERVER).toContain("account_user_id=eq.${p.person_id}") // a login's id resolves to the people row
    expect(SERVER).toContain("const SERVER_VERSION = '0.67.0'")
    expect(SERVER).toContain('Writes are eighty-three verbs and nothing else')
    expect(SERVER).toContain('plan_matter_open_person → apply_matter_open_person')
    expect(README).toContain('| `plan_matter_open_person(matter)` · `apply_matter_open_person(matter, plan_hash)` |')
    expect(README).toContain('eighty-three `plan_` / `apply_` / `revert_` verbs')
    expect(EDGE).toContain('v2.6582 (server 0.31.0) — a matter opened on a person')
    expect(HR).toContain('`plan_matter_open_person` → `apply_matter_open_person`')
  })
})
