/**
 * The dev seat reads and writes a person's standing over time (punch list #315, upgrade 4c): plan_engagement →
 * apply_engagement over dev_engagement_write, and the engagements block get_person_file and get_case_brief carry.
 * Made-up people and days.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ENGAGEMENT_SELECT, engagementArgsForLog, engagementInput, engagementsBlock, isEngagementVerb } from '../../../supabase/functions/_shared/devMcpEngagement'
import { getCaseBrief } from '../../../supabase/functions/_shared/devMcpCaseBrief'
import type { Reader, Row } from '../../../supabase/functions/_shared/devMcpComposites'
import { getPersonFile, type PersonFileWholeReply } from '../../../supabase/functions/_shared/devMcpPersonFile'
import { WRITE_VERBS, alreadyApplied, applyVerbFor, isWriteVerb, planHash, planVerbFor, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { catalogReader } from './catalogReader'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const EDGE = readFileSync('docs/EDGE_FUNCTIONS.md', 'utf8')
const HR = readFileSync('docs/HR_FILES.md', 'utf8')
const MIGRATION = readFileSync('supabase/migrations/20261113090000_person_engagements.sql', 'utf8')

const PERSON = '11111111-2222-4333-8444-555555555555'
const G1 = 'aaaaaaa1-2222-4333-8444-555555555555'
const G2 = 'aaaaaaa2-2222-4333-8444-555555555555'
const G9 = 'aaaaaaa9-2222-4333-8444-555555555555'
const HASH = 'b'.repeat(64)
const dev = { role: 'dev', todayYmd: '2026-11-19' }

const stretch = (id: string, kind: string, from: string, to: string | null, over: Record<string, unknown> = {}): Row => ({ id, person_id: PERSON, kind, started_on: from, ended_on: to, source: 'contract', source_ref: '', note: '', withdrawn_at: null, ...over })
const STRETCHES: Row[] = [
  stretch(G1, 'subcontractor', '2026-02-02', '2026-05-31', { source_ref: 'the February agreement' }),
  stretch(G2, 'employee', '2026-06-01', null, { source: 'payroll', note: 'Moved onto payroll.' }),
  stretch(G9, 'employee', '2026-01-01', '2026-01-15', { withdrawn_at: '2026-03-01T12:00:00Z' }),
]
const PEOPLE: Row[] = [{ id: PERSON, name: 'Pat Doe', kind: 'helper', start_date: '2026-02-02', end_date: null, archived_at: null, account_user_id: null }]

/** A plain reader over tables: eq, in, is and gt filters, and a refusal for a table it does not hold. */
function tableReader(tables: Record<string, Row[]>): Reader {
  return {
    rpc: async (name) => {
      throw new Error(`rpc ${name} is not in the fixture`)
    },
    rows: async (table, q) => {
      if (!(table in tables)) throw new Error(`relation "${table}" does not exist`)
      let out = [...tables[table]!]
      for (const f of q.filters ?? []) {
        if (f.op === 'eq') out = out.filter((r) => r[f.column] === f.value)
        else if (f.op === 'in') out = out.filter((r) => (f.value as unknown[]).includes(r[f.column]))
        else if (f.op === 'is') out = out.filter((r) => r[f.column] === f.value)
        else if (f.op === 'gt') out = out.filter((r) => String(r[f.column]) > String(f.value))
      }
      return out.slice(0, q.limit ?? 50)
    },
  }
}

describe('plan_engagement → apply_engagement: the input becomes dev_engagement_write\'s payload', () => {
  it('each of the four, through the tab\'s own payload builders', () => {
    const p = (engagement: Record<string, unknown>) => {
      const r = engagementInput('plan_engagement', { engagement: { person_id: PERSON.toUpperCase(), ...engagement } })
      if (!r.ok) throw new Error(r.error)
      return [r.op, r.p]
    }
    expect(p({ open: { kind: 'subcontractor', started_on: '2026-02-02', source: 'contract', source_ref: '  the February agreement ', note: '' } })).toEqual(['open', { person_id: PERSON, open: { kind: 'subcontractor', started_on: '2026-02-02', source: 'contract', source_ref: 'the February agreement' } }])
    expect(p({ open: { kind: 'employee', started_on: '2025-01-06', ended_on: '2025-08-29', source: 'record' } })).toEqual(['open', { person_id: PERSON, open: { kind: 'employee', started_on: '2025-01-06', ended_on: '2025-08-29', source: 'record' } }])
    expect(p({ change: { kind: 'employee', on: '2026-06-01', source: 'payroll', note: 'Moved onto payroll.' } })).toEqual(['change', { person_id: PERSON, change: { kind: 'employee', on: '2026-06-01', source: 'payroll', note: 'Moved onto payroll.' } }])
    expect(p({ close: { ended_on: '2026-10-30' } })).toEqual(['close', { person_id: PERSON, close: { ended_on: '2026-10-30' } }])
    expect(p({ withdraw: { id: G1.toUpperCase(), why: '  Recorded on the wrong person. ' } })).toEqual(['withdraw', { person_id: PERSON, withdraw: { id: G1, why: 'Recorded on the wrong person.' } }])
  })

  it('refuses in words what the door would refuse', () => {
    const bad = (engagement: unknown, words: string) => {
      const r = engagementInput('plan_engagement', { engagement })
      expect(r.ok, words).toBe(false)
      if (!r.ok) expect(r.error, words).toContain(words)
    }
    bad(undefined, 'plan_engagement needs engagement')
    bad(undefined, "find_person answers a login's users.id, which this door refuses")
    bad({ person_id: 'Pat Doe', close: { ended_on: '2026-10-30' } }, 'plan_engagement needs engagement')
    bad({ person_id: PERSON }, 'names none of open, change, close, withdraw')
    bad({ person_id: PERSON, open: { kind: 'employee', started_on: '2026-01-05', source: 'owner' }, close: { ended_on: '2026-02-01' } }, 'names open and close of open, change, close, withdraw')
    bad({ person_id: PERSON, open: 'employee' }, 'open is an object')
    bad({ person_id: PERSON, open: { kind: 'partner', started_on: '2026-01-05', source: 'owner' } }, 'open.kind is employee or subcontractor')
    bad({ person_id: PERSON, open: { kind: 'employee', started_on: '2026-01-05', source: 'a guess' } }, 'open.source is one of contract, payroll, owner, record, other')
    bad({ person_id: PERSON, open: { kind: 'employee', started_on: 'January 5', source: 'owner' } }, 'open.started_on is a day')
    bad({ person_id: PERSON, open: { kind: 'employee', started_on: '2026-02-30', source: 'owner' } }, 'open.started_on is a day')
    bad({ person_id: PERSON, open: { kind: 'employee', started_on: '2026-03-01', ended_on: '2026-02-01', source: 'owner' } }, 'open.ended_on is before open.started_on')
    bad({ person_id: PERSON, open: { kind: 'employee', started_on: '2026-03-01', source: 'owner', source_ref: 'x'.repeat(301) } }, 'open.source_ref is words, under 300')
    bad({ person_id: PERSON, change: { kind: 'employee', source: 'payroll' } }, 'change.on is a day')
    bad({ person_id: PERSON, close: {} }, 'close.ended_on is a day')
    bad({ person_id: PERSON, withdraw: { id: 'the first one', why: 'x' } }, "withdraw.id is the stretch's id")
    bad({ person_id: PERSON, withdraw: { id: G1, why: 'x'.repeat(201) } }, 'withdraw.why is 1 to 200 characters')
  })

  it('the pair is in the grammar over the one door, and the hash holds no clock', async () => {
    expect(isEngagementVerb('plan_engagement') && isEngagementVerb('apply_engagement') && !isEngagementVerb('plan_case')).toBe(true)
    expect(isWriteVerb('plan_engagement') && isWriteVerb('apply_engagement')).toBe(true)
    expect(WRITE_VERBS.plan_engagement).toEqual({ rpc: 'dev_engagement_write', step: 'plan' })
    expect(WRITE_VERBS.apply_engagement).toEqual({ rpc: 'dev_engagement_write', step: 'apply' })
    expect(planVerbFor('apply_engagement')).toBe('plan_engagement')
    expect(applyVerbFor('plan_engagement')).toBe('apply_engagement')
    const ask = { engagement: { person_id: PERSON, close: { ended_on: '2026-10-30' } } }
    const p = { person_id: PERSON, close: { ended_on: '2026-10-30' } }
    expect(writeRpcBody('plan_engagement', ask)).toEqual({ ok: true, rpc: 'dev_engagement_write', step: 'plan', body: { p, p_dry_run: true }, dryRunBody: { p, p_dry_run: true }, target: PERSON, planHash: null })
    expect(writeRpcBody('apply_engagement', { ...ask, plan_hash: HASH })).toMatchObject({ ok: true, step: 'apply', body: { p, p_dry_run: false }, dryRunBody: { p, p_dry_run: true }, planHash: HASH })
    expect(writeRpcBody('apply_engagement', ask)).toMatchObject({ ok: false, error: expect.stringContaining('apply_engagement needs plan_hash') })
    const reply = { dry_run: true, person: { id: PERSON, name: 'Pat Doe' }, author_label: 'Dev One', changes: [{ op: 'close', kind: 'employee', started_on: '2026-06-01', ended_on: '2026-10-30' }], standing: [{ kind: 'employee', started_on: '2026-06-01', ended_on: '2026-10-30', source: 'payroll' }] }
    const planned = await planHash('plan_engagement', p, reply)
    expect(await planHash('apply_engagement', p, { ...reply, dry_run: false })).toBe(planned)
    expect(await planHash('apply_engagement', p, { ...reply, standing: [] })).not.toBe(planned)
    expect(alreadyApplied('apply_engagement', { target: PERSON, at: null })).toContain("get_person_file's engagements")
    // The door's reply carries no id and no stamp, and one writer a person at a time.
    expect(MIGRATION).toContain("'standing', COALESCE((SELECT jsonb_agg(jsonb_build_object('kind', e.kind, 'started_on', e.started_on, 'ended_on', e.ended_on, 'source', e.source) ORDER BY e.started_on)")
    expect(MIGRATION).toContain("PERFORM pg_advisory_xact_lock(hashtext('person_engagements'), hashtext(v_person::text));")
  })

  it('the call log keeps the kind and the days, never a reference, a note or a reason', () => {
    const words = 'These words stay on the file.'
    expect(engagementArgsForLog('apply_engagement', { engagement: { person_id: PERSON, open: { kind: 'employee', started_on: '2026-01-05', ended_on: '2026-02-01', source: 'owner', source_ref: words, note: words } }, plan_hash: ` ${HASH.toUpperCase()} ` })).toEqual({ engagement: { person_id: PERSON, op: 'open', kind: 'employee', started_on: '2026-01-05', ended_on: '2026-02-01' }, plan_hash: HASH })
    expect(JSON.stringify(engagementArgsForLog('plan_engagement', { engagement: { person_id: PERSON, withdraw: { id: G1, why: words } } }))).not.toContain('These words')
    expect(engagementArgsForLog('plan_engagement', { engagement: { person_id: PERSON, withdraw: { id: G1, why: words } } })).toEqual({ engagement: { person_id: PERSON, op: 'withdraw', id: G1 } })
    expect(engagementArgsForLog('plan_engagement', {})).toEqual({ engagement: null })
  })
})

describe('the block the reads carry', () => {
  it('the standing in the strip\'s words, what they are today, each stretch that stands, and how many were taken off', () => {
    const block = engagementsBlock(STRETCHES as never, '2026-11-19')
    expect(block.standing).toBe('Employee · since Jun 1, 2026 · still engaged')
    expect(block.today).toBe('employee')
    expect(block.stretches).toEqual([
      { id: G1, kind: 'subcontractor', started_on: '2026-02-02', ended_on: '2026-05-31', source: 'contract', source_ref: 'the February agreement', words: 'Subcontractor from Feb 2, 2026 to May 31, 2026, by a signed paper' },
      { id: G2, kind: 'employee', started_on: '2026-06-01', ended_on: null, source: 'payroll', note: 'Moved onto payroll.', words: 'Employee since Jun 1, 2026, by how they were paid' },
    ])
    expect(block.taken_off).toBe(1)
    expect(engagementsBlock([], '2026-11-19')).toEqual({ standing: null, today: null, stretches: [], taken_off: 0 })
  })

  it('get_person_file carries engagements and draws each change on the Timeline; another role reads none', async () => {
    const data = () => ({ people: PEOPLE, person_engagements: STRETCHES })
    const reader = catalogReader({ rows: data() })
    const out = (await getPersonFile(reader, { person: PERSON }, dev)) as PersonFileWholeReply
    expect('refused' in out).toBe(false)
    expect(reader.asked).toContain('rows:person_engagements')
    expect(out.engagements).toMatchObject({ standing: 'Employee · since Jun 1, 2026 · still engaged', today: 'employee', taken_off: 1 })
    const lines = [...out.ahead, ...out.months.flatMap((m) => m.lines)].filter((l) => l.ref.table === 'person_engagements')
    expect(lines.map((l) => [l.ymd, l.kindWords])).toEqual(expect.arrayContaining([['2026-02-02', 'standing'], ['2026-06-01', 'standing changed']]))
    expect(lines).toHaveLength(2)
    const office = await getPersonFile(catalogReader({ rows: data() }), { person: PERSON }, { role: 'assistant', todayYmd: '2026-11-19' })
    if ('refused' in office) throw new Error(office.refused)
    expect(office.engagements).toBeNull()
    expect([...office.ahead, ...office.months.flatMap((m) => m.lines)].some((l) => 'ref' in l && l.ref.table === 'person_engagements')).toBe(false)
  })

  it('get_case_brief carries the block, and the manifest counts the stretches that stand and names the pair', async () => {
    const tables: Record<string, Row[]> = { people: PEOPLE, person_file_entries: [], person_file_evidence: [], person_file_index: [], person_document_index: [], legal_matters: [], legal_theme_marks: [], legal_themes: [], person_file_amendments: [], person_case_items: [], person_case_log: [], person_engagements: STRETCHES }
    const out = await getCaseBrief(tableReader(tables), { person: PERSON }, dev)
    if ('refused' in out) throw new Error(out.refused)
    expect(out.engagements).toMatchObject({ standing: 'Employee · since Jun 1, 2026 · still engaged', taken_off: 1 })
    expect(out.engagements?.stretches).toHaveLength(2)
    const part = out.manifest.parts.find((p) => p.part === 'standing')
    expect(part).toMatchObject({ count: 2 })
    expect(String(part?.open)).toContain('plan_engagement → apply_engagement')
    delete tables.person_engagements
    const held = await getCaseBrief(tableReader(tables), { person: PERSON }, dev)
    if ('refused' in held) throw new Error(held.refused)
    expect(held.engagements).toBeNull()
    expect(held.held).toEqual([{ source: 'standing', reason: 'relation "person_engagements" does not exist' }])
  })

  it('the select is one the door accepts', async () => {
    await expect(catalogReader({ rows: {} }).rows('person_engagements', { select: ENGAGEMENT_SELECT, filters: [{ column: 'person_id', op: 'eq', value: PERSON }] })).resolves.toEqual([])
  })
})

describe('the seat and its docs carry the pair', () => {
  it('the server wires both verbs to the one door and logs a call by its kind and days', () => {
    for (const v of ['plan_engagement', 'apply_engagement']) {
      expect(SERVER).toContain(`case '${v}':`)
      expect(SERVER).toContain(`name: '${v}',`)
    }
    expect(SERVER).toContain('if (isEngagementVerb(name)) return engagementArgsForLog(name, args)')
    expect(SERVER).toContain('plan_engagement → apply_engagement (a person\'s standing over time')
    expect(MIGRATION).toContain('GRANT EXECUTE ON FUNCTION public.dev_engagement_write(jsonb, boolean) TO authenticated;')
  })

  it('the README, the function reference and the HR reference say what the seat reads and writes', () => {
    expect(README).toContain('`plan_engagement(engagement)` · `apply_engagement(engagement, plan_hash)`')
    expect(README).toContain('**`engagements`**')
    expect(EDGE).toContain('a person\'s standing read and written from the seat')
    expect(HR).toContain('`plan_engagement` → `apply_engagement`')
  })
})
