import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  OWNER_MODES,
  PROPERTY_JOB_COLS,
  PROPERTY_JOBS_LISTED,
  PROPERTY_KINDS,
  PROPERTY_RECORD_VERBS,
  PROPERTY_TEXT_COLUMNS,
  isPropertyRecordVerb,
  propertyJobLabel,
  propertyLienGaps,
  propertyLienReading,
  propertyPatch,
  propertyPatchBody,
  propertyRecordAppliedWords,
  propertyRecordDryRun,
  propertyRecordInput,
  readPropertyWorld,
  type Json,
  type PropertyJobRow,
  type PropertyRecordPayload,
  type PropertyWorld,
} from '../../../supabase/functions/_shared/devMcpPropertyRecord'
import { WRITE_VERBS, alreadyApplied, isWriteVerb, planHash, planReply, planVerbFor, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { CATALOG_TABLES } from '../../../supabase/functions/dev-mcp/catalog'
import { propertyKindPatch } from '../jobs/propertyKind'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const PANEL = readFileSync('src/components/customers/CustomerPropertyRecordPanel.tsx', 'utf8')

// Made-up ids and a made-up property: no real owner or address is in this file.
const JOB = '99999999-1111-4111-8111-111111111111'
const OTHER_JOB = '99999999-2222-4222-8222-222222222222'
const PROPERTY = 'aaaaaaaa-1111-4111-8111-111111111111'
const HASH = 'a'.repeat(64)

const record = (over: Json = {}): Json => ({
  id: PROPERTY, customer_id: 'cccccccc-1111-4111-8111-111111111111', address: '12 Sample Rd, Devine, TX 78016', updated_at: '2026-11-10T15:00:00+00:00',
  county: 'Medina', county_source: 'parcel', legal_description: 'A1 SAMPLE SURVEY; TRACT J', property_kind: 'residential', homestead: false,
  owner_mode: 'homeowner', owner_name: 'SAMPLE PAT', owner_company: '', owner_mailing_address: '12 SAMPLE RD, DEVINE, TX 78016', owner_email: '', owner_phone: '',
  ...over,
})
const jobRow = (over: Partial<PropertyJobRow> = {}): PropertyJobRow => ({ id: JOB, job_name: 'ZZ TEST seat walk', click_number: '868', hcp_number: '', customer_address_id: PROPERTY, ...over })
const world = (over: Partial<PropertyWorld> = {}): PropertyWorld => ({ job: jobRow(), record: record(), jobs: [jobRow(), jobRow({ id: OTHER_JOB, click_number: '', hcp_number: '273', job_name: 'ZZ TEST second job' })], jobOwner: null, ...over })
const plan = (set: Json, by: Json = { job_id: JOB }): PropertyRecordPayload => {
  const built = propertyRecordInput('plan_property_record', { record: { ...by, set } })
  if (!built.ok) throw new Error(built.error)
  return built.p
}
const reply = (set: Json, w: PropertyWorld = world()): Json => {
  const dry = propertyRecordDryRun(plan(set), w)
  if (!dry.ok) throw new Error(dry.refused)
  return dry.reply
}
const refusal = (set: Json, w: PropertyWorld = world(), by?: Json): string => {
  const dry = propertyRecordDryRun(plan(set, by), w)
  if (dry.ok) throw new Error('expected a refusal')
  return dry.refused
}

describe('devMcpPropertyRecord — the verbs on the allowlist', () => {
  it('are two write verbs with no RPC in the table, plan before apply, named by the server and the README', () => {
    expect(PROPERTY_RECORD_VERBS).toEqual(['plan_property_record', 'apply_property_record'])
    for (const v of PROPERTY_RECORD_VERBS) {
      expect(isPropertyRecordVerb(v)).toBe(true)
      expect(isWriteVerb(v)).toBe(true)
      expect(WRITE_VERBS[v].rpc).toBeNull()
      expect(SERVER).toContain(`case '${v}':`)
      expect(SERVER).toContain(`name: '${v}',`)
    }
    expect(planVerbFor('apply_property_record')).toBe('plan_property_record')
    expect(SERVER).toContain('plan_property_record → apply_property_record (a property record’s lien facts'.replace('’', "'"))
    expect(README).toContain('`plan_property_record(record)` · `apply_property_record(record, plan_hash)`')
    expect(isPropertyRecordVerb('plan_job_update')).toBe(false)
  })

  it('writes columns the table has, reads only what the catalog names, and goes through one PATCH read back whole', () => {
    const columns = CATALOG_TABLES.customer_addresses!.columns
    for (const col of [...Object.keys(PROPERTY_TEXT_COLUMNS), 'county_source', 'property_kind', 'homestead', 'owner_mode', 'updated_at']) expect(columns, col).toHaveProperty(col)
    for (const col of PROPERTY_JOB_COLS.split(',')) expect(CATALOG_TABLES.jobs_ledger!.columns, col).toHaveProperty(col)
    for (const col of ['owner_name', 'company_name', 'mailing_address', 'job_id']) expect(CATALOG_TABLES.job_property_owners!.columns, col).toHaveProperty(col)
    expect(SERVER).toContain("await restRows(session, 'PATCH', 'customer_addresses', `id=eq.${recordId}`, body)")
    expect(SERVER).toContain("await restGet(session, 'customer_addresses', `select=*&id=eq.${recordId}`)")
    expect(SERVER).toContain("if (who.role !== 'dev') return refused(`${name} writes, and only a dev's own key may write.`)")
  })

  it('keeps the form’s own lists: the two kinds, the two owner modes, a typed county as manual, a commercial pick clearing homestead', () => {
    expect([...PROPERTY_KINDS]).toEqual(['residential', 'non_residential'])
    expect([...OWNER_MODES]).toEqual(['homeowner', 'building_owner'])
    expect(PANEL).toContain("onChange({ county: e.target.value, county_source: 'manual' })")
    expect(PANEL).toContain("pill('Homeowner', fields.owner_mode === 'homeowner'")
    expect(PANEL).toContain("pill('Building owner', fields.owner_mode === 'building_owner'")
    expect(propertyKindPatch('non_residential')).toEqual({ property_kind: 'non_residential', homestead: false })
  })
})

describe('devMcpPropertyRecord — the input', () => {
  it('names the record by a job or by its own id, never both, never neither', () => {
    expect(plan({ homestead: true })).toEqual({ action: 'property_record', job_id: JOB, set: { homestead: true } })
    expect(plan({ county: ' Medina ' }, { property_id: PROPERTY.toUpperCase() })).toEqual({ action: 'property_record', property_id: PROPERTY, set: { county: 'Medina' } })
    const both = propertyRecordInput('plan_property_record', { record: { job_id: JOB, property_id: PROPERTY, set: { homestead: true } } })
    expect(both).toMatchObject({ ok: false, error: expect.stringContaining('not both') })
    expect(propertyRecordInput('plan_property_record', { record: { set: { homestead: true } } }).ok).toBe(false)
    expect(propertyRecordInput('plan_property_record', { record: { job_id: 'JP868', set: { homestead: true } } })).toMatchObject({ ok: false, error: expect.stringContaining('find_job') })
    expect(propertyRecordInput('plan_property_record', {}).ok).toBe(false)
  })

  it('shapes each column: text trimmed and capped, "" clears, commercial is the word for non_residential, homestead a plain true or false', () => {
    expect(plan({ property_kind: 'Commercial' }).set).toEqual({ property_kind: 'non_residential' })
    expect(plan({ property_kind: '' }).set).toEqual({ property_kind: '' })
    expect(plan({ owner_mode: null, owner_company: null }).set).toEqual({ owner_mode: '', owner_company: '' })
    expect(plan({ owner_email: ' pat@example.test ' }).set).toEqual({ owner_email: 'pat@example.test' })
    const bad = (set: Json) => propertyRecordInput('plan_property_record', { record: { job_id: JOB, set } })
    expect(bad({ homestead: 'yes' })).toMatchObject({ ok: false, error: expect.stringContaining('true or false') })
    expect(bad({ property_kind: 'house' })).toMatchObject({ ok: false, error: expect.stringContaining('residential, commercial') })
    expect(bad({ owner_mode: 'tenant' }).ok).toBe(false)
    expect(bad({ owner_email: 'not an email' })).toMatchObject({ ok: false, error: expect.stringContaining('email') })
    expect(bad({ county: 'x'.repeat(81) })).toMatchObject({ ok: false, error: expect.stringContaining('under 80') })
    expect(bad({ parcel_id: '67055' })).toMatchObject({ ok: false, error: expect.stringContaining('"parcel_id" is not a column this verb writes') })
    expect(bad({})).toMatchObject({ ok: false, error: expect.stringContaining('names nothing to change') })
  })

  it('apply needs the plan’s 64-hex hash, and writeRpcBody hands the payload through with no RPC', () => {
    expect(propertyRecordInput('apply_property_record', { record: { job_id: JOB, set: { homestead: true } } })).toMatchObject({ ok: false, error: expect.stringContaining('plan_hash') })
    const built = writeRpcBody('apply_property_record', { record: { job_id: JOB, set: { homestead: true } }, plan_hash: HASH })
    expect(built).toMatchObject({ ok: true, rpc: null, step: 'apply', target: JOB, planHash: HASH, body: { p: { action: 'property_record', job_id: JOB, set: { homestead: true } } } })
    expect(writeRpcBody('plan_property_record', { record: { job_id: JOB, set: { homestead: true } } })).toMatchObject({ ok: true, step: 'plan', planHash: null })
  })
})

describe('devMcpPropertyRecord — the reads', () => {
  it('reads the job, its record whole, the record’s jobs and the job’s own owner; a job with no record stops there', async () => {
    const asked: string[] = []
    const reads = (rows: Record<string, Json[]>) => ({
      rows: async (table: string, query: string) => {
        asked.push(`${table}?${query}`)
        return rows[table] ?? []
      },
    })
    const w = await readPropertyWorld(reads({ jobs_ledger: [jobRow() as unknown as Json], customer_addresses: [record()], job_property_owners: [{ owner_name: 'Sam Other', company_name: '', mailing_address: '' }] }), plan({ homestead: true }))
    expect(asked).toEqual([
      `jobs_ledger?select=${PROPERTY_JOB_COLS}&id=eq.${JOB}`,
      `customer_addresses?select=*&id=eq.${PROPERTY}`,
      `jobs_ledger?select=${PROPERTY_JOB_COLS}&customer_address_id=eq.${PROPERTY}&order=created_at.desc`,
      `job_property_owners?select=owner_name,company_name,mailing_address&job_id=eq.${JOB}`,
    ])
    expect(w.record?.id).toBe(PROPERTY)
    expect(w.jobOwner?.owner_name).toBe('Sam Other')
    asked.length = 0
    const unlinked = await readPropertyWorld(reads({ jobs_ledger: [jobRow({ customer_address_id: null }) as unknown as Json] }), plan({ homestead: true }))
    expect(asked).toHaveLength(1)
    expect(unlinked).toEqual({ job: jobRow({ customer_address_id: null }), record: null, jobs: [], jobOwner: null })
    asked.length = 0
    await readPropertyWorld(reads({ customer_addresses: [record()] }), plan({ county: 'Medina' }, { property_id: PROPERTY }))
    expect(asked[0]).toBe(`customer_addresses?select=*&id=eq.${PROPERTY}`)
    expect(asked.some((a) => a.startsWith('job_property_owners'))).toBe(false)
  })
})

describe('devMcpPropertyRecord — the patch', () => {
  it('writes only what changes, marks a typed county as typed by hand, and always stamps updated_at', () => {
    expect(propertyPatch({ county: 'Medina' }, record())).toEqual({ changes: [], stamps: ['updated_at'] })
    const typed = propertyPatch({ county: 'Frio', owner_phone: '(830) 555-0142' }, record())
    expect(typed.changes.map((c) => [c.column, c.before, c.after])).toEqual([['county', 'Medina', 'Frio'], ['county_source', 'parcel', 'manual'], ['owner_phone', '', '(830) 555-0142']])
    expect(propertyPatch({ county: '' }, record()).changes.map((c) => [c.column, c.after])).toEqual([['county', ''], ['county_source', '']])
    expect(propertyPatchBody(typed, '2026-11-11T16:00:00.000Z')).toEqual({ county: 'Frio', county_source: 'manual', owner_phone: '(830) 555-0142', updated_at: '2026-11-11T16:00:00.000Z' })
  })

  it('a homestead yes on a house sets the flag; the answer is stamped only where the record carries the column', () => {
    expect(propertyPatch({ homestead: true }, record())).toEqual({ changes: [{ column: 'homestead', before: false, after: true }], stamps: ['updated_at'] })
    const withColumn = propertyPatch({ homestead: true }, record({ homestead_answered_at: null }))
    expect(withColumn.stamps).toEqual(['updated_at', 'homestead_answered_at'])
    expect(propertyPatchBody(withColumn, 'NOW')).toEqual({ homestead: true, updated_at: 'NOW', homestead_answered_at: 'NOW' })
    // A no on a record that already reads false changes no column, and is still an answer where the column exists.
    expect(propertyPatch({ homestead: false }, record({ homestead_answered_at: null }))).toEqual({ changes: [], stamps: ['updated_at', 'homestead_answered_at'] })
    expect(propertyPatch({ homestead: false }, record())).toEqual({ changes: [], stamps: ['updated_at'] })
  })

  it('homestead is asked only of a residential property, and a commercial pick clears a homestead flag', () => {
    expect(propertyPatch({ homestead: true }, record({ property_kind: 'non_residential' })).refused).toContain('asked only of a residential property')
    expect(propertyPatch({ homestead: true }, record({ property_kind: '' })).refused).toContain('kind not set')
    // Named together, the kind lands first and the yes is taken.
    expect(propertyPatch({ homestead: true, property_kind: 'residential' }, record({ property_kind: '' })).changes.map((c) => c.column)).toEqual(['property_kind', 'homestead'])
    const commercial = propertyPatch({ property_kind: 'non_residential' }, record({ homestead: true, homestead_answered_at: '2026-11-01T00:00:00Z' }))
    expect(commercial.changes.map((c) => [c.column, c.after])).toEqual([['property_kind', 'non_residential'], ['homestead', false]])
    expect(commercial.changes[1]!.why).toBe('a property that is not residential cannot be a homestead')
    expect(commercial.stamps).toEqual(['updated_at'])
  })
})

describe('devMcpPropertyRecord — the dry run', () => {
  it('a homestead yes: the column before and after, every job that follows, and the hold the Lien desk reads', () => {
    const r = reply({ homestead: true })
    expect(r.property).toEqual({ id: PROPERTY, address: '12 Sample Rd, Devine, TX 78016', customer_id: 'cccccccc-1111-4111-8111-111111111111', updated_at: '2026-11-10T15:00:00+00:00' })
    expect(r.job).toEqual({ id: JOB, label: 'JP868 · ZZ TEST seat walk' })
    expect(r.changes).toEqual([{ column: 'homestead', before: false, after: true }])
    expect(r.stamps).toEqual(['updated_at: now'])
    expect(r.jobs_that_follow).toEqual({ count: 2, listed: [{ id: JOB, label: 'JP868 · ZZ TEST seat walk' }, { id: OTHER_JOB, label: 'JP273 · ZZ TEST second job' }], note: 'every job linked to this record reads the change' })
    const lien = r.lien as { before: string; after: string; still_missing: string[] }
    expect(lien.before).toBe('Residential, not a homestead: the notice and the affidavit run on the residential dates, a month earlier than commercial.')
    expect(lien.after).toContain('Homestead: the Lien desk holds an affidavit on this property for the attorney')
    expect(lien.still_missing).toEqual([])
    expect(r).not.toHaveProperty('owner_on_job')
  })

  it('says the answer is stamped where the column exists, and reads an unanswered house as unanswered', () => {
    const w = world({ record: record({ homestead_answered_at: null }) })
    const r = reply({ homestead: false }, w)
    expect(r.changes).toEqual([])
    expect(r.stamps).toEqual(['updated_at: now', 'homestead_answered_at: now (a person answered the homestead question)'])
    const lien = r.lien as { before: string; after: string }
    expect(lien.before).toContain('nobody has answered the homestead question')
    expect(lien.after).toBe('Residential, not a homestead: the notice and the affidavit run on the residential dates, a month earlier than commercial.')
  })

  it('names what the lien papers still lack, and warns when the named job keeps its own owner', () => {
    const w = world({ record: record({ legal_description: '', owner_name: '', owner_mailing_address: '' }), jobOwner: { owner_name: 'Sam Other', company_name: '', mailing_address: '9 Other Way' } })
    const r = reply({ owner_name: 'SAMPLE PAT & LEE' }, w)
    expect((r.lien as { still_missing: string[] }).still_missing).toEqual(['legal description', 'owner mailing address'])
    expect(r.owner_on_job).toContain('JP868 · ZZ TEST seat walk names its own owner')
    // A change that is not the owner's says nothing of the job's own owner.
    expect(reply({ county: 'Frio' }, w)).not.toHaveProperty('owner_on_job')
    expect(propertyLienGaps(record({ county: ' ', owner_name: '', owner_company: 'Sample Holdings LLC' }))).toEqual(['county'])
  })

  it('lists the first 25 jobs and counts them all', () => {
    const many = Array.from({ length: 30 }, (_, i) => jobRow({ id: `99999999-0000-4000-8000-${String(i).padStart(12, '0')}`, click_number: String(900 + i) }))
    const r = reply({ homestead: true }, world({ jobs: many }))
    const follow = r.jobs_that_follow as { count: number; listed: unknown[]; note: string }
    expect([follow.count, follow.listed.length, follow.note]).toEqual([30, PROPERTY_JOBS_LISTED, 'the first 25 of 30'])
  })

  it('refuses what cannot be saved: no job, no record linked, a record not visible, nothing to change, a homestead on a shop', () => {
    expect(refusal({ homestead: true }, world({ job: null, record: null, jobs: [] }))).toContain('No job')
    expect(refusal({ homestead: true }, world({ job: jobRow({ customer_address_id: null }), record: null, jobs: [] }))).toContain("has no property record linked. Link one on Edit Job's Property record row")
    expect(refusal({ homestead: true }, world({ record: null, jobs: [] }))).toContain('property record is not visible to you')
    expect(refusal({ county: 'Medina' }, world({ job: null, record: null, jobs: [] }), { property_id: PROPERTY })).toContain(`No property record ${PROPERTY} is visible to you`)
    expect(refusal({ county: 'Medina', homestead: false })).toContain('already reads that way. Nothing to apply.')
    expect(refusal({ homestead: true }, world({ record: record({ property_kind: 'non_residential' }) }))).toContain('asked only of a residential property')
  })

  it('reads the kind in the Lien desk’s words', () => {
    expect(propertyLienReading(record({ property_kind: 'non_residential' }))).toBe('Commercial: the notice and the affidavit run on the commercial dates. The homestead question is not asked.')
    expect(propertyLienReading(record({ property_kind: '' }))).toContain('Kind not set')
    expect(propertyJobLabel({ click_number: '', hcp_number: '', job_name: '' })).toBe('a job with no number')
  })
})

describe('devMcpPropertyRecord — the hash, the replay and the apply’s words', () => {
  it('the hash commits to the record’s before values and its updated_at: a record saved since no longer matches', async () => {
    const p = plan({ homestead: true })
    const first = await planHash('plan_property_record', p, reply({ homestead: true }))
    expect(first).toMatch(/^[0-9a-f]{64}$/)
    expect(await planHash('apply_property_record', p, reply({ homestead: true }))).toBe(first)
    const saved = world({ record: record({ updated_at: '2026-11-11T09:00:00+00:00' }) })
    expect(await planHash('apply_property_record', p, reply({ homestead: true }, saved))).not.toBe(first)
    const moved = world({ jobs: [jobRow()] })
    expect(await planHash('apply_property_record', p, reply({ homestead: true }, moved))).not.toBe(first)
    expect(planReply('plan_property_record', reply({ homestead: true }), first).next).toContain('apply_property_record')
  })

  it('a replay is refused in the record’s words, and the apply says what changed and what the desk reads', () => {
    expect(alreadyApplied('apply_property_record', { target: PROPERTY, at: '2026-11-11T16:00:00Z' })).toContain('already applied on this property record at 2026-11-11T16:00:00Z')
    const done = propertyRecordAppliedWords('12 Sample Rd, Devine, TX 78016', ['homestead'], { ok: true, row: { homestead: true }, reading: propertyLienReading(record({ homestead: true })) })
    expect(done).toMatchObject({ action: 'property_record', ok: true, changed: ['homestead'], row: { homestead: true } })
    expect(done.lien).toContain('Homestead: the Lien desk holds an affidavit')
    expect(propertyRecordAppliedWords('12 Sample Rd', [], { ok: false, error: 'RLS let no row through' })).toEqual({ action: 'property_record', property: '12 Sample Rd', ok: false, error: 'RLS let no row through' })
  })
})
