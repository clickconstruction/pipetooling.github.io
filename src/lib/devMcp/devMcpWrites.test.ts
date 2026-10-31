import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { WRITE_VERBS, alreadyApplied, canonicalJson, isWriteVerb, planCommitment, planHash, planMismatch, planReply, planVerbFor, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'

const COST_MIGRATION = readFileSync('supabase/migrations/20260909161532_cost_batches.sql', 'utf8')
const HR_MIGRATION = readFileSync('supabase/migrations/20260922102017_dev_hr_entry_write.sql', 'utf8')
const NARRATIVE_MIGRATION = readFileSync('supabase/migrations/20261007235000_dev_legal_narrative_write.sql', 'utf8')
const PLAN_MIGRATION = readFileSync('supabase/migrations/20261023195135_legal_plan_items.sql', 'utf8')
const DOCUMENT_MIGRATION = readFileSync('supabase/migrations/20261028010000_dev_legal_document_write.sql', 'utf8')
const GAP_MIGRATION = readFileSync('supabase/migrations/20261028120000_dev_legal_gap_answer_write.sql', 'utf8')
const HISTORY_MIGRATION = readFileSync('supabase/migrations/20261029130000_dev_history_entry_write.sql', 'utf8')
const BID_MIGRATION = readFileSync('supabase/migrations/20261030210000_dev_bid_write.sql', 'utf8')
const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')

const PERSON = '11111111-2222-4333-8444-555555555555'
const BATCH = { label: 'ZZ test', reason: 'a test', ops: [{ op: 'thread_note', job_id: '0e4dcd2b-a524-4056-b93c-16713041a6e7', body: 'hello' }] }
const HASH = 'a'.repeat(64)
/** The `p` a built write POSTs, for the keys a plan carries or leaves out. */
const pOf = (built: ReturnType<typeof writeRpcBody>): Record<string, unknown> => (built.ok ? (built.body.p as Record<string, unknown>) : {})

describe('devMcpWrites — the allowlist', () => {
  it('names only RPCs a migration creates, each gated is_dev() inside and closed to anon', () => {
    const rpcs = new Set(Object.values(WRITE_VERBS).map((v) => v.rpc))
    expect([...rpcs].sort()).toEqual(['cost_batch_apply', 'cost_batch_revert', 'dev_bid_write', 'dev_history_entry_write', 'dev_hr_entry_write', 'dev_legal_document_write', 'dev_legal_gap_answer_write', 'dev_legal_narrative_write', 'dev_legal_plan_write'])
    expect(COST_MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.cost_batch_apply(p jsonb, p_dry_run boolean DEFAULT true)')
    expect(COST_MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.cost_batch_revert(p_batch_id uuid, p_reason text DEFAULT NULL)')
    expect(COST_MIGRATION.match(/NOT public\.is_dev\(\)/g)?.length).toBeGreaterThanOrEqual(2)
    expect(HR_MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.dev_hr_entry_write(p jsonb, p_dry_run boolean DEFAULT true)')
    expect(HR_MIGRATION).toContain('IF auth.uid() IS NULL OR NOT public.is_dev() THEN')
    expect(HR_MIGRATION).toContain('REVOKE ALL ON FUNCTION public.dev_hr_entry_write(jsonb, boolean) FROM anon;')
    expect(HR_MIGRATION).toContain('GRANT EXECUTE ON FUNCTION public.dev_hr_entry_write(jsonb, boolean) TO authenticated;')
    expect(HR_MIGRATION.startsWith("SET lock_timeout = '3s';")).toBe(true)
    expect(HR_MIGRATION).not.toMatch(/CREATE TABLE/i) // no table → no read-only fence appliers owed
    expect(HISTORY_MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.dev_history_entry_write(p jsonb, p_dry_run boolean DEFAULT true)')
    expect(HISTORY_MIGRATION).toContain('IF auth.uid() IS NULL OR NOT public.is_dev() THEN')
    expect(HISTORY_MIGRATION).toContain('REVOKE ALL ON FUNCTION public.dev_history_entry_write(jsonb, boolean) FROM anon;')
    expect(HISTORY_MIGRATION).toContain('GRANT EXECUTE ON FUNCTION public.dev_history_entry_write(jsonb, boolean) TO authenticated;')
    expect(HISTORY_MIGRATION.startsWith("SET lock_timeout = '3s';")).toBe(true)
    expect(HISTORY_MIGRATION).not.toMatch(/CREATE TABLE/i)
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
    // v2.6005: the gap-answer wrapper — the same gates; writes through the desk's two office RPCs and never redefines them.
    expect(GAP_MIGRATION.startsWith("SET lock_timeout = '3s';")).toBe(true)
    expect(GAP_MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.dev_legal_gap_answer_write(p jsonb, p_dry_run boolean DEFAULT true)')
    expect(GAP_MIGRATION).toContain('IF auth.uid() IS NULL OR NOT public.is_dev() THEN')
    expect(GAP_MIGRATION).toContain('REVOKE EXECUTE ON FUNCTION public.dev_legal_gap_answer_write(jsonb, boolean) FROM PUBLIC, anon;')
    expect(GAP_MIGRATION).toContain('GRANT EXECUTE ON FUNCTION public.dev_legal_gap_answer_write(jsonb, boolean) TO authenticated;')
    expect(GAP_MIGRATION).not.toMatch(/CREATE TABLE/i)
    expect(GAP_MIGRATION).toContain('public.legal_answer_gap(v_matter.payer_key, v_matter.customer_id, v_matter.payer_name, NULL, v_gap_key, v_answer, v_document_id, v_label)')
    expect(GAP_MIGRATION).toContain('public.legal_clear_gap_answer(v_matter.id, v_gap_key)')
    expect(GAP_MIGRATION).not.toContain('FUNCTION public.legal_answer_gap')
    expect(GAP_MIGRATION).not.toContain('FUNCTION public.legal_clear_gap_answer')
    expect(GAP_MIGRATION).toContain('IF v_matter.closed_at IS NOT NULL THEN') // a closed matter is refused before the dry run answers
    expect(GAP_MIGRATION).toContain("WHERE id = v_document_id AND voided_at IS NULL") // a document must be live and on this matter
  })

  it('knows its verbs, and the server declares every one as a tool and refuses them through view_as', () => {
    expect(isWriteVerb('apply_cost_batch')).toBe(true)
    expect(isWriteVerb('call_read')).toBe(false)
    expect(isWriteVerb('toString')).toBe(false)
    for (const verb of Object.keys(WRITE_VERBS)) {
      expect(SERVER).toContain(`name: '${verb}'`)
      expect(SERVER).toContain(`case '${verb}':`)
    }
    expect(SERVER).toContain("if (isWriteVerb(verb) || verb === 'mint_twin_setup_code') return finish(refused(")
    // restPost is reached only from the write branches: once to declare it, three calls in the generic branch, and
    // the plan set verbs' own dry run and stamp (v2.6185).
    expect(SERVER.match(/restPost\(/g)?.length).toBe(6)
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
    expect(SERVER).toContain("const SERVER_VERSION = '0.12.0'")
  })
})

describe('the gap-answer verbs (v2.6005)', () => {
  const MATTER = '3c9e7d21-4f0a-4b6c-8d5e-1a2b3c4d5e6f'
  const DOCUMENT = '9f8e7d6c-5b4a-4c3d-8e2f-0a1b2c3d4e5f'
  it('are on the allowlist, plan before apply, and POST { p, p_dry_run } with the gap\'s key and the one line', () => {
    expect(isWriteVerb('plan_gap_answer')).toBe(true)
    expect(planVerbFor('apply_gap_answer')).toBe('plan_gap_answer')
    const plan = writeRpcBody('plan_gap_answer', { gap: { matter_id: MATTER, gap_key: 'never_asked', answer: ' Asked on the Oct 3 call; they said after the GC pays. ', label: 'Never asked when they would pay' } })
    expect(plan).toEqual({ ok: true, rpc: 'dev_legal_gap_answer_write', step: 'plan', body: { p: { action: 'answer', matter_id: MATTER, gap_key: 'never_asked', answer: 'Asked on the Oct 3 call; they said after the GC pays.', label: 'Never asked when they would pay' }, p_dry_run: true }, dryRunBody: { p: { action: 'answer', matter_id: MATTER, gap_key: 'never_asked', answer: 'Asked on the Oct 3 call; they said after the GC pays.', label: 'Never asked when they would pay' }, p_dry_run: true }, target: MATTER, planHash: null })
    // action defaults to answer; a document on the matter rides along by id; a per-job key is any string under 120.
    const withDoc = writeRpcBody('plan_gap_answer', { gap: { matter_id: MATTER, gap_key: `demand`, answer: 'Sent certified Oct 27; the letter is on the Evidence tab.', document_id: DOCUMENT } })
    expect(withDoc).toMatchObject({ ok: true, body: { p: { action: 'answer', gap_key: 'demand', document_id: DOCUMENT } } })
    if (!withDoc.ok) throw new Error(withDoc.error)
    expect(withDoc.body.p).not.toHaveProperty('label')
    expect(writeRpcBody('plan_gap_answer', { gap: { matter_id: MATTER, gap_key: `subjob:${DOCUMENT}`, answer: 'x' } })).toMatchObject({ ok: true, target: MATTER })
    const apply = writeRpcBody('apply_gap_answer', { gap: { matter_id: MATTER, gap_key: 'never_asked', answer: 'x' }, plan_hash: HASH })
    expect(apply).toMatchObject({ ok: true, step: 'apply', body: { p_dry_run: false }, dryRunBody: { p_dry_run: true }, planHash: HASH })
    expect(writeRpcBody('apply_gap_answer', { gap: { matter_id: MATTER, gap_key: 'never_asked', answer: 'x' } })).toMatchObject({ ok: false, error: expect.stringContaining('plan_hash') })
  })
  it('clear names the matter and the gap and carries nothing else', () => {
    const clear = writeRpcBody('plan_gap_answer', { gap: { matter_id: MATTER, gap_key: 'never_asked', action: 'clear', answer: 'ignored' } })
    expect(clear).toMatchObject({ ok: true, body: { p: { action: 'clear', matter_id: MATTER, gap_key: 'never_asked' } }, target: MATTER })
    if (!clear.ok) throw new Error(clear.error)
    expect(clear.body.p).not.toHaveProperty('answer')
  })
  it('refuses in words a gap without its matter, key or line, a line over 500, a label over 300, a bad document id and an unknown action', () => {
    expect(writeRpcBody('plan_gap_answer', {})).toMatchObject({ ok: false, error: expect.stringContaining('needs gap') })
    expect(writeRpcBody('plan_gap_answer', { gap: { matter_id: 'the burd matter', gap_key: 'never_asked', answer: 'x' } })).toMatchObject({ ok: false, error: expect.stringContaining('matter_id') })
    expect(writeRpcBody('plan_gap_answer', { gap: { matter_id: MATTER, gap_key: ' ', answer: 'x' } })).toMatchObject({ ok: false, error: expect.stringContaining('gap_key') })
    expect(writeRpcBody('plan_gap_answer', { gap: { matter_id: MATTER, gap_key: 'k'.repeat(121), answer: 'x' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_gap_answer', { gap: { matter_id: MATTER, gap_key: 'never_asked', answer: '  ' } })).toMatchObject({ ok: false, error: expect.stringContaining('under 500') })
    expect(writeRpcBody('plan_gap_answer', { gap: { matter_id: MATTER, gap_key: 'never_asked', answer: 'a'.repeat(501) } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_gap_answer', { gap: { matter_id: MATTER, gap_key: 'never_asked', answer: 'x', label: 'l'.repeat(301) } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_gap_answer', { gap: { matter_id: MATTER, gap_key: 'never_asked', answer: 'x', document_id: 'the letter' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_gap_answer', { gap: { matter_id: MATTER, gap_key: 'never_asked', action: 'delete' } })).toMatchObject({ ok: false, error: expect.stringContaining('answer | clear') })
  })
  it('the plan reply points at apply_gap_answer, and a repeat apply says the answer is under its gap', () => {
    expect(String(planReply('plan_gap_answer', { matter: { id: MATTER } }, 'd'.repeat(64)).next)).toContain('apply_gap_answer')
    expect(alreadyApplied('apply_gap_answer', { target: MATTER, at: '2026-10-28T15:00:00Z' })).toContain('on this matter')
    expect(alreadyApplied('apply_gap_answer', { target: MATTER, at: null })).toContain('legal_matter_gap_answers')
  })
  it('the server declares both verbs in the write branch and reports 0.12.0', () => {
    expect(SERVER).toContain("name: 'plan_gap_answer'")
    expect(SERVER).toContain("name: 'apply_gap_answer'")
    expect(SERVER).toContain("case 'plan_gap_answer':")
    expect(SERVER).toContain("case 'apply_gap_answer':")
    expect(SERVER).toContain("const SERVER_VERSION = '0.12.0'")
    expect(SERVER).toContain('Writes are nineteen verbs and nothing else')
  })
})

describe('the bid verbs (v2.6183)', () => {
  const CUSTOMER = '9d16a3ce-2d4a-45ca-8cd7-0df73357fcc5'
  const SERVICE = 'd53845ab-79ed-498b-88d1-d3a069cf2e73'
  const SITE = '7d7b2580-3301-42bd-af10-85d75b941918'
  const BID = { project_name: ' 231 Gun Dog Trail Bunker & Lodge ', customer_id: CUSTOMER, service_type_id: SERVICE, address: '231 Gun Dog Trail, Neeses, SC 29107', development_id: SITE, distance_from_office: 1158.5, bid_due_date: '2026-11-13', robot_opt_out: false }
  it('are on the allowlist, plan before apply, and POST { p: { action: create, … }, p_dry_run } with the name trimmed and the distance as text', () => {
    expect(isWriteVerb('plan_bid')).toBe(true)
    expect(isWriteVerb('apply_bid')).toBe(true)
    expect(planVerbFor('apply_bid')).toBe('plan_bid')
    const plan = writeRpcBody('plan_bid', { bid: BID })
    expect(plan).toMatchObject({ ok: true, rpc: 'dev_bid_write', step: 'plan', target: '231 Gun Dog Trail Bunker & Lodge', body: { p: { action: 'create', project_name: '231 Gun Dog Trail Bunker & Lodge', customer_id: CUSTOMER, service_type_id: SERVICE, development_id: SITE, distance_from_office: '1158.5', bid_due_date: '2026-11-13', robot_opt_out: false }, p_dry_run: true } })
    expect(pOf(plan)).not.toHaveProperty('estimator_id')
    const apply = writeRpcBody('apply_bid', { bid: BID, plan_hash: HASH })
    expect(apply).toMatchObject({ ok: true, step: 'apply', body: { p_dry_run: false }, dryRunBody: { p_dry_run: true }, planHash: HASH })
    expect(writeRpcBody('apply_bid', { bid: BID })).toMatchObject({ ok: false, error: expect.stringContaining('plan_hash') })
  })
  it('refuses a missing name, a bad id, a wrong date or time, a negative distance — and carries allow_duplicate_name only when true', () => {
    expect(writeRpcBody('plan_bid', { bid: { ...BID, project_name: ' ' } })).toMatchObject({ ok: false, error: expect.stringContaining('project_name') })
    expect(writeRpcBody('plan_bid', { bid: { ...BID, customer_id: 'DSI' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_bid', { bid: { ...BID, development_id: 'gun dog' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_bid', { bid: { ...BID, bid_due_date: 'Nov 13' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_bid', { bid: { ...BID, bid_due_time: '2pm' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_bid', { bid: { ...BID, distance_from_office: -3 } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_bid', { bid: { ...BID, distance_from_office: '12 miles' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_bid', { bid: { ...BID, bid_due_time: '14:00', allow_duplicate_name: true } })).toMatchObject({ ok: true, body: { p: { bid_due_time: '14:00', allow_duplicate_name: true } } })
    expect(pOf(writeRpcBody('plan_bid', { bid: { ...BID, allow_duplicate_name: false } }))).not.toHaveProperty('allow_duplicate_name')
    expect(writeRpcBody('plan_bid', {})).toMatchObject({ ok: false, error: expect.stringContaining('needs bid') })
  })
  it('the migration creates dev_bid_write gated is_dev(), closed to anon, with the create and file_plans actions; the plan reply points at apply_bid and a repeat apply names the bid', () => {
    expect(BID_MIGRATION.startsWith("SET lock_timeout = '3s';")).toBe(true)
    expect(BID_MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.dev_bid_write(p jsonb, p_dry_run boolean DEFAULT true, p_link jsonb DEFAULT NULL)')
    expect(BID_MIGRATION).toContain('IF auth.uid() IS NULL OR NOT public.is_dev() THEN')
    expect(BID_MIGRATION).toContain('REVOKE ALL ON FUNCTION public.dev_bid_write(jsonb, boolean, jsonb) FROM anon;')
    expect(BID_MIGRATION).toContain('GRANT EXECUTE ON FUNCTION public.dev_bid_write(jsonb, boolean, jsonb) TO authenticated;')
    expect(BID_MIGRATION).toContain("v_action NOT IN ('create', 'file_plans')")
    expect(BID_MIGRATION).not.toMatch(/CREATE TABLE/i)
    expect(String(planReply('plan_bid', { after: { project_name: 'x' } }, 'e'.repeat(64)).next)).toContain('apply_bid')
    expect(alreadyApplied('apply_bid', { target: 'b612', at: '2026-10-30T22:00:00Z' })).toContain('as bid b612')
    expect(alreadyApplied('apply_bid', { target: 'b612', at: null })).toContain('allow_duplicate_name')
  })
})

describe('the history verbs (v2.6044)', () => {
  const SITE = '7d7b2580-3301-42bd-af10-85d75b941918'
  const JOB = 'e7a353d8-5aad-4776-a609-500d1f60d274'
  const LINE = { development_id: SITE, happened_at: '2026-10-28T09:12:00-05:00', source: 'email', body: ' The GC: the slab pour moves to Nov 4. ', agent_label: 'the inbox robot' }
  it('are on the allowlist, plan before apply, and POST { p, p_dry_run } with the line trimmed and the piece at most one', () => {
    expect(isWriteVerb('plan_history_entry')).toBe(true)
    expect(planVerbFor('apply_history_entry')).toBe('plan_history_entry')
    const plan = writeRpcBody('plan_history_entry', { line: LINE })
    expect(plan).toEqual({ ok: true, rpc: 'dev_history_entry_write', step: 'plan', body: { p: { development_id: SITE, happened_at: LINE.happened_at, source: 'email', body: 'The GC: the slab pour moves to Nov 4.', agent_label: 'the inbox robot' }, p_dry_run: true }, dryRunBody: { p: { development_id: SITE, happened_at: LINE.happened_at, source: 'email', body: 'The GC: the slab pour moves to Nov 4.', agent_label: 'the inbox robot' }, p_dry_run: true }, target: SITE, planHash: null })
    const onJob = writeRpcBody('plan_history_entry', { line: { ...LINE, job_id: JOB, link_url: ' https://mail.example/thread/1 ' } })
    expect(onJob).toMatchObject({ ok: true, body: { p: { job_id: JOB, link_url: 'https://mail.example/thread/1' } } })
    const apply = writeRpcBody('apply_history_entry', { line: LINE, plan_hash: HASH })
    expect(apply).toMatchObject({ ok: true, step: 'apply', body: { p_dry_run: false }, dryRunBody: { p_dry_run: true }, planHash: HASH })
    expect(writeRpcBody('apply_history_entry', { line: LINE })).toMatchObject({ ok: false, error: expect.stringContaining('plan_hash') })
  })
  it('refuses in words a line without its site, time, source, body or robot, two pieces, a body over 20,000 and a bad id', () => {
    expect(writeRpcBody('plan_history_entry', {})).toMatchObject({ ok: false, error: expect.stringContaining('needs line') })
    expect(writeRpcBody('plan_history_entry', { line: { ...LINE, development_id: 'gun dog' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_history_entry', { line: { ...LINE, happened_at: 'yesterday' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_history_entry', { line: { ...LINE, source: 'fax' } })).toMatchObject({ ok: false, error: expect.stringContaining('on_site') })
    expect(writeRpcBody('plan_history_entry', { line: { ...LINE, body: '   ' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_history_entry', { line: { ...LINE, body: 'a'.repeat(20001) } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_history_entry', { line: { ...LINE, agent_label: '' } })).toMatchObject({ ok: false, error: expect.stringContaining('agent_label') })
    expect(writeRpcBody('plan_history_entry', { line: { ...LINE, job_id: JOB, bid_id: JOB } })).toMatchObject({ ok: false, error: expect.stringContaining('at most one') })
    expect(writeRpcBody('plan_history_entry', { line: { ...LINE, customer_id: 'the GC' } })).toMatchObject({ ok: false })
  })
  it('the plan reply points at apply_history_entry, a repeat apply says the line is in History, and the server declares the three verbs', () => {
    expect(String(planReply('plan_history_entry', { after: { development: 'Harlow Ranch' } }, 'e'.repeat(64)).next)).toContain('apply_history_entry')
    expect(alreadyApplied('apply_history_entry', { target: SITE, at: '2026-10-29T06:00:00Z' })).toContain('on this development')
    expect(alreadyApplied('apply_history_entry', { target: SITE, at: null })).toContain('get_history')
    expect(SERVER).toContain("name: 'plan_history_entry'")
    expect(SERVER).toContain("name: 'apply_history_entry'")
    expect(SERVER).toContain("name: 'get_history'")
    expect(SERVER).toContain("case 'plan_history_entry':")
    expect(SERVER).toContain("case 'apply_history_entry':")
    expect(SERVER).toContain("case 'get_history': {")
    expect(SERVER).toContain('rpc/dev_history_read')
    expect(HISTORY_MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.dev_history_read(')
    expect(HISTORY_MIGRATION).toContain('SECURITY INVOKER')
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

describe('the plan set verbs (v2.6185)', () => {
  const BID_ID = '0e4dcd2b-a524-4056-b93c-16713041a6e7'
  const SHA = 'c'.repeat(64)
  const PLANS = { bid: BID_ID, file_name: '231 Gun Dog Trail Bunker & Lodge - plans for the robot.pdf', size_bytes: 25274441, sha256: SHA.toUpperCase() }
  it('are on the allowlist over the same RPC, plan before apply, and POST { p: { action: file_plans, … }, p_dry_run } with the sha lowered', () => {
    expect(isWriteVerb('plan_file_plans')).toBe(true)
    expect(planVerbFor('apply_file_plans')).toBe('plan_file_plans')
    expect(WRITE_VERBS.plan_file_plans.rpc).toBe('dev_bid_write')
    const plan = writeRpcBody('plan_file_plans', { plans: PLANS })
    expect(plan).toMatchObject({ ok: true, step: 'plan', target: BID_ID, body: { p: { action: 'file_plans', bid_id: BID_ID, file_name: PLANS.file_name, size_bytes: 25274441, sha256: SHA }, p_dry_run: true } })
    expect(pOf(plan)).not.toHaveProperty('replace')
    const apply = writeRpcBody('apply_file_plans', { plans: { ...PLANS, replace: true, set_name: 'Plans for the robot', memo: 'Lodge 25 + Bunker 44, gaps filled' }, plan_hash: HASH })
    expect(apply).toMatchObject({ ok: true, step: 'apply', body: { p: { replace: true, set_name: 'Plans for the robot', memo: 'Lodge 25 + Bunker 44, gaps filled' }, p_dry_run: false }, dryRunBody: { p_dry_run: true }, planHash: HASH })
    expect(writeRpcBody('apply_file_plans', { plans: PLANS })).toMatchObject({ ok: false, error: expect.stringContaining('plan_hash') })
  })
  it('refuses a non-PDF name, a path, a file over 50 MB, a bad sha and a bad bid id', () => {
    expect(writeRpcBody('plan_file_plans', { plans: { ...PLANS, file_name: 'plans.zip' } })).toMatchObject({ ok: false, error: expect.stringContaining('.pdf') })
    expect(writeRpcBody('plan_file_plans', { plans: { ...PLANS, file_name: 'sets/plans.pdf' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_file_plans', { plans: { ...PLANS, size_bytes: 52428801 } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_file_plans', { plans: { ...PLANS, size_bytes: 0 } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_file_plans', { plans: { ...PLANS, sha256: 'abc' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_file_plans', { plans: { ...PLANS, bid: 'b612' } })).toMatchObject({ ok: false, error: expect.stringContaining('find_bid') })
    expect(writeRpcBody('plan_file_plans', {})).toMatchObject({ ok: false, error: expect.stringContaining('needs plans') })
  })
  it('the server stages into the private bid-submittals bucket, files into the division folder with the shared Drive helpers, and probes; the plan reply points at apply_file_plans', () => {
    expect(SERVER).toContain("name: 'plan_file_plans'")
    expect(SERVER).toContain("case 'apply_file_plans': {")
    expect(SERVER).toContain("const ROBOT_PLANS_BUCKET = 'bid-submittals'")
    expect(SERVER).toContain("from '../_shared/driveUpload.ts'")
    expect(SERVER).toContain("from '../_shared/bidPlansFolders.ts'")
    expect(SERVER).toContain('p_link: { folder_link: folderLink, file_link: fileLink, pages }')
    expect(SERVER).toContain('await stagedRemove(session, stagePath)')
    expect(SERVER).toContain('await probePlans(session, plans.bid_id)')
    expect(String(planReply('plan_file_plans', { after: { bid: 'b612' } }, 'f'.repeat(64)).next)).toContain('apply_file_plans')
    expect(alreadyApplied('apply_file_plans', { target: 'b612', at: '2026-10-30T22:30:00Z' })).toContain('on bid b612')
    expect(alreadyApplied('apply_file_plans', { target: 'b612', at: null })).toContain('replace: true')
  })
})

describe('mint_twin_setup_code (v2.6187)', () => {
  it('is not a plan/apply write, is refused through view_as, asks twin-setup as the dev, and never hands the key back', () => {
    expect(isWriteVerb('mint_twin_setup_code')).toBe(false)
    expect(SERVER).toContain("name: 'mint_twin_setup_code'")
    expect(SERVER).toContain("case 'mint_twin_setup_code': {")
    expect(SERVER).toContain("if (isWriteVerb(verb) || verb === 'mint_twin_setup_code') return finish(refused(")
    expect(SERVER).toContain("/functions/v1/twin-setup`")
    expect(SERVER).toContain("{ action: 'mint', label, ...(twinUserId ? { twin_user_id: twinUserId } : { kind: 'estimator' }) }")
    expect(SERVER).toContain('redeem: `python3 scripts/twin/redeem_setup_code.py ${reply.code}')
    expect(SERVER).not.toContain('reply.token')
  })
})
