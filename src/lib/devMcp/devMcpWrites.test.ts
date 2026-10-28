import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { WRITE_VERBS, alreadyApplied, canonicalJson, isWriteVerb, planCommitment, planHash, planMismatch, planReply, planVerbFor, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'

const COST_MIGRATION = readFileSync('supabase/migrations/20260909161532_cost_batches.sql', 'utf8')
const HR_MIGRATION = readFileSync('supabase/migrations/20260922102017_dev_hr_entry_write.sql', 'utf8')
const NARRATIVE_MIGRATION = readFileSync('supabase/migrations/20261007235000_dev_legal_narrative_write.sql', 'utf8')
const PLAN_MIGRATION = readFileSync('supabase/migrations/20261023195135_legal_plan_items.sql', 'utf8')
const DOCUMENT_MIGRATION = readFileSync('supabase/migrations/20261028010000_dev_legal_document_write.sql', 'utf8')
const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')

const PERSON = '11111111-2222-4333-8444-555555555555'
const BATCH = { label: 'ZZ test', reason: 'a test', ops: [{ op: 'thread_note', job_id: '0e4dcd2b-a524-4056-b93c-16713041a6e7', body: 'hello' }] }
const HASH = 'a'.repeat(64)

describe('devMcpWrites — the allowlist', () => {
  it('names only RPCs a migration creates, each gated is_dev() inside and closed to anon', () => {
    const rpcs = new Set(Object.values(WRITE_VERBS).map((v) => v.rpc))
    expect([...rpcs].sort()).toEqual(['cost_batch_apply', 'cost_batch_revert', 'dev_hr_entry_write', 'dev_legal_document_write', 'dev_legal_narrative_write', 'dev_legal_plan_write'])
    expect(COST_MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.cost_batch_apply(p jsonb, p_dry_run boolean DEFAULT true)')
    expect(COST_MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.cost_batch_revert(p_batch_id uuid, p_reason text DEFAULT NULL)')
    expect(COST_MIGRATION.match(/NOT public\.is_dev\(\)/g)?.length).toBeGreaterThanOrEqual(2)
    expect(HR_MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.dev_hr_entry_write(p jsonb, p_dry_run boolean DEFAULT true)')
    expect(HR_MIGRATION).toContain('IF auth.uid() IS NULL OR NOT public.is_dev() THEN')
    expect(HR_MIGRATION).toContain('REVOKE ALL ON FUNCTION public.dev_hr_entry_write(jsonb, boolean) FROM anon;')
    expect(HR_MIGRATION).toContain('GRANT EXECUTE ON FUNCTION public.dev_hr_entry_write(jsonb, boolean) TO authenticated;')
    expect(HR_MIGRATION.startsWith("SET lock_timeout = '3s';")).toBe(true)
    expect(HR_MIGRATION).not.toMatch(/CREATE TABLE/i) // no table → no read-only fence appliers owed
    // The wrapper calls the LIVE hr_agent_write; it never redefines it.
    expect(HR_MIGRATION).toContain('public.hr_agent_write(v_payload)')
    expect(HR_MIGRATION).not.toContain('FUNCTION public.hr_agent_write')
    // v2.4814: the narrative wrapper, the same shape over legal_set_narrative.
    expect(NARRATIVE_MIGRATION.startsWith("SET lock_timeout = '3s';")).toBe(true)
    expect(NARRATIVE_MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.dev_legal_narrative_write(p jsonb, p_dry_run boolean DEFAULT true)')
    expect(NARRATIVE_MIGRATION).toContain('IF auth.uid() IS NULL OR NOT public.is_dev() THEN')
    expect(NARRATIVE_MIGRATION).toContain('REVOKE EXECUTE ON FUNCTION public.dev_legal_narrative_write(jsonb, boolean) FROM PUBLIC, anon;')
    expect(NARRATIVE_MIGRATION).toContain('GRANT EXECUTE ON FUNCTION public.dev_legal_narrative_write(jsonb, boolean) TO authenticated;')
    expect(NARRATIVE_MIGRATION).not.toMatch(/CREATE TABLE/i)
    expect(NARRATIVE_MIGRATION).toContain('public.legal_set_narrative(v_matter.id, v_md)')
    expect(NARRATIVE_MIGRATION).not.toContain('FUNCTION public.legal_set_narrative')
    // v2.5800: the planned-step wrapper, the same shape over the three office RPCs, with source mcp.
    expect(PLAN_MIGRATION.startsWith("SET lock_timeout = '3s';")).toBe(true)
    expect(PLAN_MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.dev_legal_plan_write(p jsonb, p_dry_run boolean DEFAULT true)')
    expect(PLAN_MIGRATION).toContain('IF auth.uid() IS NULL OR NOT public.is_dev() THEN')
    expect(PLAN_MIGRATION).toContain('REVOKE EXECUTE ON FUNCTION public.dev_legal_plan_write(jsonb, boolean) FROM PUBLIC, anon;')
    expect(PLAN_MIGRATION).toContain('GRANT EXECUTE ON FUNCTION public.dev_legal_plan_write(jsonb, boolean) TO authenticated;')
    expect(PLAN_MIGRATION).not.toMatch(/CREATE TABLE/i)
    expect(PLAN_MIGRATION).toContain("public.legal_plan_add(v_matter.id, v_on, v_body, v_notes, 'mcp')")
    expect(PLAN_MIGRATION).toContain("public.legal_plan_update(v_entry.id, v_on, v_body, v_notes, 'mcp')")
    expect(PLAN_MIGRATION).toContain("public.legal_plan_mark_done(v_entry.id, v_done_on, v_note, 'mcp')")
    expect(PLAN_MIGRATION).toContain("'plan'") // the kind CHECK gains it
    // v2.6004: the document wrapper — the same gates; the row only once the file is in the bucket under the matter's folder.
    expect(DOCUMENT_MIGRATION.startsWith("SET lock_timeout = '3s';")).toBe(true)
    expect(DOCUMENT_MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.dev_legal_document_write(p jsonb, p_dry_run boolean DEFAULT true, p_file jsonb DEFAULT NULL)')
    expect(DOCUMENT_MIGRATION).toContain('IF auth.uid() IS NULL OR NOT public.is_dev() THEN')
    expect(DOCUMENT_MIGRATION).toContain('REVOKE EXECUTE ON FUNCTION public.dev_legal_document_write(jsonb, boolean, jsonb) FROM PUBLIC, anon;')
    expect(DOCUMENT_MIGRATION).toContain('GRANT EXECUTE ON FUNCTION public.dev_legal_document_write(jsonb, boolean, jsonb) TO authenticated;')
    expect(DOCUMENT_MIGRATION).not.toMatch(/CREATE TABLE/i)
    expect(DOCUMENT_MIGRATION).toContain("FROM storage.objects WHERE bucket_id = 'legal-matter-documents' AND name = v_path")
    expect(DOCUMENT_MIGRATION).toContain('INSERT INTO public.legal_matter_documents (id, matter_id, title, shows, storage_path, mime, size_bytes, original_name, dated_on, state, received_on, sent_on, sent_how, sent_to, added_by)')
    expect(DOCUMENT_MIGRATION).not.toContain('FUNCTION public.legal_matter_documents_stamp')
  })

  it('knows its verbs, and the server declares every one as a tool and refuses them through view_as', () => {
    expect(isWriteVerb('apply_cost_batch')).toBe(true)
    expect(isWriteVerb('call_read')).toBe(false)
    expect(isWriteVerb('toString')).toBe(false)
    for (const verb of Object.keys(WRITE_VERBS)) {
      expect(SERVER).toContain(`name: '${verb}'`)
      expect(SERVER).toContain(`case '${verb}':`)
    }
    expect(SERVER).toContain('if (isWriteVerb(verb)) return finish(refused(')
    // restPost is reached only from the write branch: once to declare it, and only in that branch's calls.
    expect(SERVER.match(/restPost\(/g)?.length).toBe(4)
    expect(planVerbFor('apply_hr_entry')).toBe('plan_hr_entry')
    expect(planVerbFor('revert_cost_batch')).toBeNull()
  })
})

describe('the planned-step verbs (v2.5800)', () => {
  const MATTER = 'a1b2c3d4-0000-4000-8000-000000000085'
  const ENTRY = 'b1b2c3d4-0000-4000-8000-000000000086'
  it('are on the allowlist, plan before apply, and POST { p, p_dry_run } to the dry-run wrapper', () => {
    expect(isWriteVerb('plan_matter_plan_item')).toBe(true)
    expect(planVerbFor('apply_matter_plan_item')).toBe('plan_matter_plan_item')
    const add = writeRpcBody('plan_matter_plan_item', { item: { action: 'add', matter_id: MATTER, on: '2026-11-13', body: 'Mail the materials lien notice', notes: 'Certified.' } })
    expect(add).toEqual({ ok: true, rpc: 'dev_legal_plan_write', step: 'plan', body: { p: { action: 'add', matter_id: MATTER, on: '2026-11-13', body: 'Mail the materials lien notice', notes: 'Certified.' }, p_dry_run: true }, dryRunBody: { p: { action: 'add', matter_id: MATTER, on: '2026-11-13', body: 'Mail the materials lien notice', notes: 'Certified.' }, p_dry_run: true }, target: MATTER, planHash: null })
    // action defaults to add; a missing day or body is refused in words.
    expect(writeRpcBody('plan_matter_plan_item', { item: { matter_id: MATTER, on: '2026-11-13', body: 'x' } })).toMatchObject({ ok: true, body: { p: { action: 'add' } } })
    expect(writeRpcBody('plan_matter_plan_item', { item: { matter_id: MATTER, body: 'x' } })).toMatchObject({ ok: false, error: expect.stringContaining('on (YYYY-MM-DD') })
    expect(writeRpcBody('plan_matter_plan_item', { item: { matter_id: MATTER, on: '13 Nov', body: 'x' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_matter_plan_item', { item: { action: 'move', entry_id: ENTRY } })).toMatchObject({ ok: false })
  })
  it('update and mark_done name the planned step and carry only what changes', () => {
    const upd = writeRpcBody('plan_matter_plan_item', { item: { action: 'update', entry_id: ENTRY, on: '2026-11-14', notes: '' } })
    expect(upd).toMatchObject({ ok: true, body: { p: { action: 'update', entry_id: ENTRY, on: '2026-11-14', notes: '' } }, target: ENTRY })
    if (!upd.ok) throw new Error(upd.error)
    expect(upd.body.p).not.toHaveProperty('body')
    const done = writeRpcBody('apply_matter_plan_item', { item: { action: 'mark_done', entry_id: ENTRY, note: 'Mailed.' }, plan_hash: HASH })
    expect(done).toMatchObject({ ok: true, step: 'apply', body: { p: { action: 'mark_done', entry_id: ENTRY, note: 'Mailed.' }, p_dry_run: false }, dryRunBody: { p: { action: 'mark_done', entry_id: ENTRY, note: 'Mailed.' }, p_dry_run: true }, planHash: HASH })
    expect(writeRpcBody('plan_matter_plan_item', { item: { action: 'mark_done', entry_id: 'nope' } })).toMatchObject({ ok: false, error: expect.stringContaining('entry_id') })
    expect(writeRpcBody('apply_matter_plan_item', { item: { action: 'mark_done', entry_id: ENTRY } })).toMatchObject({ ok: false, error: expect.stringContaining('plan_hash') })
  })
  it('the plan reply points at apply_matter_plan_item, and a repeat apply says the step is on the matter', () => {
    expect(String(planReply('plan_matter_plan_item', { matter: { id: MATTER } }, 'a'.repeat(64)).next)).toContain('apply_matter_plan_item')
    expect(alreadyApplied('apply_matter_plan_item', { target: MATTER, at: '2026-10-23T18:00:00Z' })).toContain('on this matter')
    expect(alreadyApplied('apply_matter_plan_item', { target: MATTER, at: null })).toContain('entry_id')
  })
})

describe('the document verbs (v2.6004)', () => {
  const MATTER = '7a1f3c2e-5b64-4d8a-9e21-0c3f5a7b9d11'
  const SHA = 'c'.repeat(64)
  const doc = { matter_id: MATTER, title: 'Demand letter to the GC', shows: 'The letter as sent on Nov 3', original_name: 'Demand letter.pdf', mime: 'application/pdf', size_bytes: 3795044, sha256: SHA }
  it('are on the allowlist, plan before apply, and POST { p, p_dry_run } with the file as mime, size and digest — never its bytes', () => {
    expect(isWriteVerb('plan_matter_document')).toBe(true)
    expect(planVerbFor('apply_matter_document')).toBe('plan_matter_document')
    const plan = writeRpcBody('plan_matter_document', { document: { ...doc, content_base64: 'JVBERi0=' } })
    expect(plan).toMatchObject({ ok: true, rpc: 'dev_legal_document_write', step: 'plan', target: MATTER, body: { p: { matter_id: MATTER, title: doc.title, shows: doc.shows, original_name: doc.original_name, mime: 'application/pdf', size_bytes: 3795044, sha256: SHA, state: 'final' }, p_dry_run: true } })
    expect(JSON.stringify(plan)).not.toContain('content_base64')
    const apply = writeRpcBody('apply_matter_document', { document: doc, plan_hash: 'a'.repeat(64) })
    expect(apply).toMatchObject({ ok: true, step: 'apply', body: { p_dry_run: false }, dryRunBody: { p_dry_run: true }, planHash: 'a'.repeat(64) })
    expect(writeRpcBody('apply_matter_document', { document: doc })).toMatchObject({ ok: false, error: expect.stringContaining('plan_hash') })
  })
  it('refuses a document without its digest, size, title, line or matter, and a day that is not YYYY-MM-DD', () => {
    expect(writeRpcBody('plan_matter_document', { document: { ...doc, sha256: 'nope' } })).toMatchObject({ ok: false, error: expect.stringContaining('content_base64') })
    expect(writeRpcBody('plan_matter_document', { document: { ...doc, size_bytes: 0 } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_matter_document', { document: { ...doc, shows: ' ' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_matter_document', { document: { ...doc, matter_id: 'burd' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_matter_document', { document: { ...doc, dated_on: 'Oct 27' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_matter_document', {})).toMatchObject({ ok: false, error: expect.stringContaining('needs document') })
  })
  it('carries the paper\'s day and state; a sent paper needs how and to whom, and a received one its day', () => {
    const sent = writeRpcBody('plan_matter_document', { document: { ...doc, dated_on: '2026-10-27', state: 'sent', sent_on: '2026-10-27', sent_how: 'certified_mail', sent_to: 'The GC, Amarillo office' } })
    expect(sent).toMatchObject({ ok: true, body: { p: { dated_on: '2026-10-27', state: 'sent', sent_on: '2026-10-27', sent_how: 'certified_mail', sent_to: 'The GC, Amarillo office' } } })
    expect(writeRpcBody('plan_matter_document', { document: { ...doc, state: 'sent', sent_to: 'The GC' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_matter_document', { document: { ...doc, state: 'sent', sent_how: 'fax', sent_to: 'The GC' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_matter_document', { document: { ...doc, state: 'filed' } })).toMatchObject({ ok: false })
    const received = writeRpcBody('plan_matter_document', { document: { ...doc, state: 'received', received_on: '2026-10-22' } })
    expect(received).toMatchObject({ ok: true, body: { p: { state: 'received', received_on: '2026-10-22' } } })
    const final = writeRpcBody('plan_matter_document', { document: { ...doc, sent_how: 'email', sent_to: 'nobody' } })
    expect(final).toMatchObject({ ok: true, body: { p: { state: 'final' } } })
    expect(final.ok ? (final.body.p as Record<string, unknown>).sent_how : 'refused').toBeUndefined()
  })
  it('the plan reply points at apply_matter_document, and a repeat apply says the document is on the matter', () => {
    expect(String(planReply('plan_matter_document', { matter: { id: MATTER } }, 'b'.repeat(64)).next)).toContain('apply_matter_document')
    expect(alreadyApplied('apply_matter_document', { target: MATTER, at: '2026-10-27T23:00:00Z' })).toContain('on the Evidence tab')
  })
  it('the server declares both verbs, handles them in the write branch, stores the file only at apply, and keeps the bytes out of the log', () => {
    expect(SERVER).toContain("name: 'plan_matter_document'")
    expect(SERVER).toContain("case 'apply_matter_document': {")
    expect(SERVER).toContain('const file = isDocument ? await documentBytes(args) : null')
    expect(SERVER).toContain("p_file: { id, storage_path: path }")
    expect(SERVER).toContain('if (stored) await storageRemove(session, stored)')
    expect(SERVER).toContain('args: argsForLog(name, args)')
    expect(SERVER).toContain("const SERVER_VERSION = '0.7.0'")
  })
})

describe('writeRpcBody — the shape each verb POSTs', () => {
  it('plans as a dry run and applies for real, with the same payload under p', () => {
    const plan = writeRpcBody('plan_cost_batch', { batch: BATCH })
    expect(plan).toMatchObject({ ok: true, rpc: 'cost_batch_apply', step: 'plan', body: { p: BATCH, p_dry_run: true }, target: 'ZZ test' })
    const apply = writeRpcBody('apply_cost_batch', { batch: BATCH, plan_hash: HASH.toUpperCase() })
    expect(apply).toMatchObject({ ok: true, step: 'apply', body: { p: BATCH, p_dry_run: false }, dryRunBody: { p: BATCH, p_dry_run: true }, planHash: HASH })
    const hr = writeRpcBody('plan_hr_entry', { entry: { person_id: PERSON, entries: [{ entry_date: '2026-09-22', content: 'x' }] } })
    expect(hr).toMatchObject({ ok: true, rpc: 'dev_hr_entry_write', body: { p_dry_run: true }, target: PERSON })
  })

  it('apply needs the plan hash; revert needs the batch id and a reason in words', () => {
    expect(writeRpcBody('apply_cost_batch', { batch: BATCH })).toMatchObject({ ok: false, error: expect.stringContaining('plan_hash') })
    expect(writeRpcBody('apply_hr_entry', { entry: { person_id: PERSON }, plan_hash: 'nope' })).toMatchObject({ ok: false })
    expect(writeRpcBody('revert_cost_batch', { batch_id: PERSON })).toMatchObject({ ok: false, error: expect.stringContaining('reason') })
    expect(writeRpcBody('revert_cost_batch', { batch_id: 'b1', reason: 'wrong job' })).toMatchObject({ ok: false, error: expect.stringContaining('batch_id') })
    expect(writeRpcBody('revert_cost_batch', { batch_id: PERSON, reason: ' wrong job ' })).toMatchObject({ ok: true, body: { p_batch_id: PERSON, p_reason: 'wrong job' }, target: PERSON })
  })

  it('refuses a batch with no ops and an entry with no person', () => {
    expect(writeRpcBody('plan_cost_batch', { batch: { label: 'x', ops: [] } })).toMatchObject({ ok: false, error: expect.stringContaining('at least one op') })
    expect(writeRpcBody('plan_cost_batch', { batch: 'x' })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_hr_entry', { entry: { person_id: 'bob' } })).toMatchObject({ ok: false, error: expect.stringContaining('person_id') })
  })
})

describe('the plan hash — what apply must match', () => {
  const costReply = {
    batch_id: null,
    dry_run: true,
    op_count: 1,
    by_job: { j1: { notes: 1 } },
    ops: [{ seq: 1, op: 'thread_note', before: null, after: { id: 'n-123', created_at: '2026-09-22T10:00:00Z', body: 'hello' } }],
  }

  it('canonical JSON sorts keys at every depth', () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: null } })).toBe('{"a":{"c":null,"d":[3,{"y":2,"z":1}]},"b":1}')
    expect(canonicalJson(undefined)).toBe('null')
  })

  it('commits to the before images and the money, never the after images or the dry_run flag', () => {
    expect(planCommitment('plan_cost_batch', costReply)).toEqual({ op_count: 1, by_job: { j1: { notes: 1 } }, ops: [{ seq: 1, op: 'thread_note', before: null }] })
    expect(planCommitment('plan_hr_entry', { dry_run: true, entries_inserted: 1, person: { id: PERSON, name: 'Curly' } })).toEqual({ entries_inserted: 1, person: { id: PERSON, name: 'Curly' } })
  })

  it('is the same across runs whose after images differ, and different when the world or the payload moved', async () => {
    const h1 = await planHash('plan_cost_batch', BATCH, costReply)
    const again = { ...costReply, dry_run: false, ops: [{ ...costReply.ops[0], after: { id: 'n-456', created_at: '2026-09-22T10:05:00Z', body: 'hello' } }] }
    expect(await planHash('apply_cost_batch', BATCH, again)).toBe(h1)
    expect(await planHash('apply_cost_batch', { ...BATCH, label: 'other' }, costReply)).not.toBe(h1)
    const moved = { ...costReply, ops: [{ ...costReply.ops[0], before: { allocated: 5 } }] }
    expect(await planHash('apply_cost_batch', BATCH, moved)).not.toBe(h1)
    expect(h1).toMatch(/^[0-9a-f]{64}$/)
  })

  it('the plan reply leads with the hash and the next step; a mismatch says nothing was written', () => {
    const r = planReply('plan_hr_entry', { entries_inserted: 1 }, HASH)
    expect(Object.keys(r)[0]).toBe('plan_hash')
    expect(String(r.next)).toContain('apply_hr_entry')
    expect(r.entries_inserted).toBe(1)
    expect(planMismatch('apply_cost_batch', HASH, 'b'.repeat(64))).toMatch(/^Nothing written/)
    expect(planMismatch('apply_cost_batch', HASH, 'b'.repeat(64))).toContain('plan_cost_batch')
  })

  it('one apply per plan (v2.3730): the server asks the log before the real write, and the refusal names the prior batch', () => {
    const applyStart = SERVER.indexOf("if (built.step === 'apply')")
    const applyBranch = SERVER.slice(applyStart, SERVER.indexOf('const res = await restPost(session, rpcPath, built.body)', applyStart))
    expect(applyBranch).toContain('hooks.priorApply(name, fresh)')
    expect(applyBranch).toContain('alreadyApplied(name, prior)')
    expect(SERVER).toContain("eq('args->>plan_hash', hash)")
    expect(SERVER).toContain("select('reverted_at')") // a reverted batch does not count
    expect(alreadyApplied('apply_cost_batch', { target: PERSON, at: '2026-09-22T10:00:00Z' })).toBe(`Nothing written: this plan was already applied as batch ${PERSON} at 2026-09-22T10:00:00Z. Revert that batch first if it was wrong, or plan a different batch.`)
    expect(alreadyApplied('apply_hr_entry', { target: PERSON, at: null })).toMatch(/^Nothing written: this plan was already applied on this person\. A second identical entry is a duplicate/)
    expect(String(planReply('plan_cost_batch', {}, HASH).next)).toContain('One apply per plan')
  })
})

describe('the narrative verbs (v2.4814)', () => {
  const MATTER = 'a1b2c3d4-0000-4000-8000-000000000085'
  it('are on the allowlist, plan before apply, and POST { p, p_dry_run } to the dry-run wrapper', () => {
    expect(isWriteVerb('plan_matter_narrative')).toBe(true)
    expect(planVerbFor('apply_matter_narrative')).toBe('plan_matter_narrative')
    const plan = writeRpcBody('plan_matter_narrative', { narrative: { matter_id: MATTER, markdown: '## The parties' } })
    expect(plan).toEqual({ ok: true, rpc: 'dev_legal_narrative_write', step: 'plan', body: { p: { matter_id: MATTER, markdown: '## The parties' }, p_dry_run: true }, dryRunBody: { p: { matter_id: MATTER, markdown: '## The parties' }, p_dry_run: true }, target: MATTER, planHash: null })
    expect(writeRpcBody('apply_matter_narrative', { narrative: { matter_id: MATTER, markdown: 'x' } })).toMatchObject({ ok: false, error: expect.stringContaining('plan_hash') })
    expect(writeRpcBody('plan_matter_narrative', { narrative: { matter_id: 'nope', markdown: 'x' } })).toMatchObject({ ok: false, error: expect.stringContaining('matter_id') })
    expect(writeRpcBody('plan_matter_narrative', { narrative: { matter_id: MATTER } })).toMatchObject({ ok: false })
  })

  it('the plan reply points at apply_matter_narrative, and a repeat apply says it is already on the matter', () => {
    expect(String(planReply('plan_matter_narrative', { matter: { id: MATTER } }, 'a'.repeat(64)).next)).toContain('apply_matter_narrative')
    expect(alreadyApplied('apply_matter_narrative', { target: MATTER, at: '2026-10-07T18:00:00Z' })).toContain('on this matter')
  })
})
