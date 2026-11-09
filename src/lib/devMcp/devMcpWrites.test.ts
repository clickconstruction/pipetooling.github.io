import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ROBOT_PLANS_SHARED_DRIVE, robotPlansDivisionFolderName, robotPlansPathWords } from '../../../supabase/functions/_shared/bidPlansFolders'
import { EVIDENCE_MAX_FILES, WRITE_VERBS, alreadyApplied, canonicalJson, clockOpCommitment, driveFilingRefusal, isWriteVerb, planCommitment, planHash, planMismatch, planReply, planVerbFor, stateGuarded, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { DEFAULT_JOB_LEDGER_PREFIX, formatJobLedgerNumberLabel } from '../ledgerDisplayPrefixes'

const COST_MIGRATION = readFileSync('supabase/migrations/20260909161532_cost_batches.sql', 'utf8')
const HR_MIGRATION = readFileSync('supabase/migrations/20260922102017_dev_hr_entry_write.sql', 'utf8')
const NARRATIVE_MIGRATION = readFileSync('supabase/migrations/20261007235000_dev_legal_narrative_write.sql', 'utf8')
const PLAN_MIGRATION = readFileSync('supabase/migrations/20261023195135_legal_plan_items.sql', 'utf8')
const EVENT_MIGRATION = readFileSync('supabase/migrations/20261108080000_dev_legal_event_write.sql', 'utf8')
const DOCUMENT_MIGRATION = readFileSync('supabase/migrations/20261028010000_dev_legal_document_write.sql', 'utf8')
const GAP_MIGRATION = readFileSync('supabase/migrations/20261028120000_dev_legal_gap_answer_write.sql', 'utf8')
const DOC_MIGRATION = readFileSync('supabase/migrations/20261107013000_dev_person_doc_write.sql', 'utf8')
const NAMED_DOCS_MIGRATION = readFileSync('supabase/migrations/20261107040000_person_documents.sql', 'utf8')
const SHARED_DOCS_MIGRATION = readFileSync('supabase/migrations/20261108210000_shared_documents.sql', 'utf8')
const COUNSEL_DOCS_MIGRATION = readFileSync('supabase/migrations/20261108230000_matter_document_counsel_only.sql', 'utf8')
const NARRATIVE_OPS_MIGRATION = readFileSync('supabase/migrations/20261107100000_matter_narrative_ops.sql', 'utf8')
const HISTORY_MIGRATION = readFileSync('supabase/migrations/20261029130000_dev_history_entry_write.sql', 'utf8')
const BID_MIGRATION = readFileSync('supabase/migrations/20261030210000_dev_bid_write.sql', 'utf8')
const STATEMENT_MIGRATION = readFileSync('supabase/migrations/20261031190000_dev_legal_statement_write.sql', 'utf8')
const CLOCK_MIGRATION = readFileSync('supabase/migrations/20261103050000_dev_clock_session_write.sql', 'utf8')
const ON_SITE_MIGRATION = readFileSync('supabase/migrations/20261102100000_dev_on_site_write.sql', 'utf8')
const ON_SITE_FIXES_MIGRATION = readFileSync('supabase/migrations/20261103143000_on_site_small_fixes.sql', 'utf8')
/** The newest migration that (re)defines a function: a later CREATE OR REPLACE replaces the body, so its rules are held there. */
function newestDefinition(fn: string): { file: string; body: string } {
  const files = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort().reverse()
  for (const file of files) {
    const sql = readFileSync(`supabase/migrations/${file}`, 'utf8')
    const at = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${fn}(`)
    if (at >= 0) return { file, body: sql.slice(at, sql.indexOf('$fn$;', sql.indexOf('AS $fn$', at)) + 5) }
  }
  throw new Error(`no definition of public.${fn}`)
}
const EVIDENCE_MIGRATION = readFileSync('supabase/migrations/20261103060000_dev_person_evidence_write.sql', 'utf8')
const HOURS_MIGRATION = readFileSync('supabase/migrations/20261103003000_dev_hours_statement_write.sql', 'utf8')
const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')

const PERSON = '11111111-2222-4333-8444-555555555555'
const BATCH = { label: 'ZZ test', reason: 'a test', ops: [{ op: 'thread_note', job_id: '0e4dcd2b-a524-4056-b93c-16713041a6e7', body: 'hello' }] }
const HASH = 'a'.repeat(64)
/** The `p` a built write POSTs, for the keys a plan carries or leaves out. */
const pOf = (built: ReturnType<typeof writeRpcBody>): Record<string, unknown> => (built.ok ? (built.body.p as Record<string, unknown>) : {})

describe('devMcpWrites — the allowlist', () => {
  it('names only RPCs a migration creates, each gated is_dev() inside and closed to anon', () => {
    // v2.6317: the four plan-part verbs name no RPC — they write the rows the Plans section writes, under RLS (devMcpPlanSets.test.ts).
    const tableVerbs = Object.entries(WRITE_VERBS).filter(([, v]) => v.rpc === null).map(([k]) => k)
    expect(tableVerbs).toEqual(['plan_plan_set', 'apply_plan_set', 'plan_paper', 'apply_paper', 'plan_person_report', 'apply_person_report', 'plan_matter_open_person', 'apply_matter_open_person', 'plan_job', 'apply_job', 'plan_job_update', 'apply_job_update', 'plan_account', 'apply_account', 'plan_login', 'apply_login', 'plan_password_reset', 'apply_password_reset', 'plan_submittal_rows', 'apply_submittal_rows', 'plan_submittal_log', 'apply_submittal_log', 'plan_activity_note', 'apply_activity_note']) // v2.6430: the report verbs POST the HR queue's own RPCs after the server's read of the report (devMcpPersonReport.test.ts); v2.6582: the person-matter verbs POST the HR file's own legal_person_matter_open (devMcpPersonMatter.test.ts)
    const rpcs = new Set(Object.values(WRITE_VERBS).flatMap((v) => (v.rpc === null ? [] : [v.rpc])))
    expect([...rpcs].sort()).toEqual(['cost_batch_apply', 'cost_batch_revert', 'dev_bid_write', 'dev_clock_session_write', 'dev_history_entry_write', 'dev_hours_statement_write', 'dev_hr_entry_write', 'dev_legal_document_write', 'dev_legal_event_write', 'dev_legal_gap_answer_write', 'dev_legal_narrative_write', 'dev_legal_plan_write', 'dev_legal_statement_write', 'dev_on_site_write', 'dev_person_doc_write', 'dev_person_evidence_write', 'dev_person_license_write', 'dev_theme_marks_write'])
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
    // v2.6244: the statement wrapper — the same gates; writes through the desk's two office RPCs with source mcp and never
    // redefines them, never prints or signs, and refuses the sworn text once the signed copy is filed.
    expect(STATEMENT_MIGRATION.startsWith("SET lock_timeout = '3s';")).toBe(true)
    expect(STATEMENT_MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.dev_legal_statement_write(p jsonb, p_dry_run boolean DEFAULT true)')
    expect(STATEMENT_MIGRATION).toContain('IF auth.uid() IS NULL OR NOT public.is_dev() THEN')
    expect(STATEMENT_MIGRATION).toContain('REVOKE EXECUTE ON FUNCTION public.dev_legal_statement_write(jsonb, boolean) FROM PUBLIC, anon;')
    expect(STATEMENT_MIGRATION).toContain('GRANT EXECUTE ON FUNCTION public.dev_legal_statement_write(jsonb, boolean) TO authenticated;')
    expect(STATEMENT_MIGRATION).not.toMatch(/CREATE TABLE/i)
    expect(STATEMENT_MIGRATION).toContain("public.legal_statement_add(v_matter.id, v_on, v_body, v_title, v_affiant, v_form, v_to, v_county, 'mcp')")
    expect(STATEMENT_MIGRATION).toContain("public.legal_statement_update(v_entry.id, v_on, v_body, v_title, v_affiant, v_form, v_to, v_to IS NULL, v_county, v_county IS NULL, 'mcp')")
    expect(STATEMENT_MIGRATION).not.toContain('FUNCTION public.legal_statement_add')
    expect(STATEMENT_MIGRATION).not.toContain('FUNCTION public.legal_statement_update')
    expect(STATEMENT_MIGRATION).not.toContain('legal_statement_print(')
    expect(STATEMENT_MIGRATION).not.toContain('legal_statement_sign(')
    expect(STATEMENT_MIGRATION).toContain("IF v_state = 'signed' THEN")
    expect(STATEMENT_MIGRATION).toContain('public.legal_statement_affiant_problem(v_affiant)') // the office RPC's own affiant check, so the plan refuses in words
    expect(STATEMENT_MIGRATION).toContain("WHERE matter_id = v_matter.id AND kind = 'statement' AND voided_at IS NULL") // the live count the hash commits to
    expect(STATEMENT_MIGRATION).toContain("'state_words', CASE WHEN v_state = 'draft' THEN 'Draft · not signed.'")
    // v2.6426: the evidence wrapper — the same gates; the panel's two tables, append-only, only once every file is in hr-files.
    expect(EVIDENCE_MIGRATION.startsWith("SET lock_timeout = '3s';")).toBe(true)
    expect(EVIDENCE_MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.dev_person_evidence_write(p jsonb, p_dry_run boolean DEFAULT true, p_files jsonb DEFAULT NULL)')
    expect(EVIDENCE_MIGRATION).toContain('IF auth.uid() IS NULL OR NOT public.is_dev() THEN')
    expect(EVIDENCE_MIGRATION).toContain('REVOKE EXECUTE ON FUNCTION public.dev_person_evidence_write(jsonb, boolean, jsonb) FROM PUBLIC, anon;')
    expect(EVIDENCE_MIGRATION).toContain('GRANT EXECUTE ON FUNCTION public.dev_person_evidence_write(jsonb, boolean, jsonb) TO authenticated;')
    expect(EVIDENCE_MIGRATION).not.toMatch(/CREATE TABLE/i)
    expect(EVIDENCE_MIGRATION).toContain("FROM storage.objects WHERE bucket_id = 'hr-files' AND name = v_path")
    expect(EVIDENCE_MIGRATION).toContain('INSERT INTO public.person_file_evidence (id, person_id, entry_id, dated_on, title, memo, created_by, author_label)')
    expect(EVIDENCE_MIGRATION).toContain('INSERT INTO public.person_file_attachments (id, person_id, entry_id, evidence_id, storage_path, filename, mime_type, size_bytes, uploaded_by, author_label)')
    expect(EVIDENCE_MIGRATION).not.toMatch(/UPDATE public\.person_file|DELETE FROM public\.person_file/) // append-only, as the panel
    expect(EVIDENCE_MIGRATION).toContain('IF v_dated > public.app_today() THEN') // the panel's rule: never ahead of today
    expect(EVIDENCE_MIGRATION).toContain("'evidence_on_person', v_live") // the live count the hash commits to
    expect(EVIDENCE_MIGRATION).not.toMatch(/net\.http|pg_net|PERFORM /) // Drive is the function's leg, after the rows: the wrapper calls nothing out
  })

  it('knows its verbs, and the server declares every one as a tool and refuses them through view_as', () => {
    expect(isWriteVerb('apply_cost_batch')).toBe(true)
    expect(isWriteVerb('call_read')).toBe(false)
    expect(isWriteVerb('toString')).toBe(false)
    for (const verb of Object.keys(WRITE_VERBS)) {
      expect(SERVER).toContain(`name: '${verb}'`)
      expect(SERVER).toContain(`case '${verb}':`)
    }
    expect(SERVER).toContain("if (isWriteVerb(verb) || verb === 'mint_twin_setup_code' || verb === 'plan_index_backfill' || verb === 'apply_index_backfill' || verb === 'plan_mail_file' || verb === 'apply_mail_file' || verb === 'plan_mail_tag' || verb === 'apply_mail_tag') return finish(refused(")
    // restPost is reached only from the write branches: once to declare it, three calls in the generic branch, the
    // report verbs' one (v2.6430), the person-matter verbs' one (v2.6582), the plan set verbs' own dry run and stamp
    // (v2.6185), the hours statement's mark_sent after its send leg (v2.6414), and the job update's update_job_status step (v2.6793).
    expect(SERVER.match(/restPost\(/g)?.length).toBe(11)
    expect(planVerbFor('apply_hr_entry')).toBe('plan_hr_entry')
    expect(planVerbFor('revert_cost_batch')).toBeNull()
  })
})

describe('the event verbs (v2.6682, punch list #169)', () => {
  const MATTER = 'a1b2c3d4-0000-4000-8000-000000000169'
  const DOC = 'c1b2c3d4-0000-4000-8000-000000000170'
  it('are on the allowlist over dev_legal_event_write, plan before apply, and POST { p, p_dry_run }', () => {
    expect(isWriteVerb('plan_matter_event')).toBe(true)
    expect(planVerbFor('apply_matter_event')).toBe('plan_matter_event')
    const add = writeRpcBody('plan_matter_event', { event: { matter_id: MATTER, on: '2026-10-20', body: "The GC's notice arrived.", notes: 'Certified, signed for by the office.', document_ids: [DOC, DOC] } })
    expect(add).toEqual({ ok: true, rpc: 'dev_legal_event_write', step: 'plan', body: { p: { matter_id: MATTER, on: '2026-10-20', body: "The GC's notice arrived.", notes: 'Certified, signed for by the office.', document_ids: [DOC] }, p_dry_run: true }, dryRunBody: { p: { matter_id: MATTER, on: '2026-10-20', body: "The GC's notice arrived.", notes: 'Certified, signed for by the office.', document_ids: [DOC] }, p_dry_run: true }, target: MATTER, planHash: null })
    // Notes and documents are optional and travel empty, so the hash covers the whole shape.
    expect(writeRpcBody('plan_matter_event', { event: { matter_id: MATTER, on: '2026-10-20', body: 'Paid in full.' } })).toMatchObject({ ok: true, body: { p: { matter_id: MATTER, on: '2026-10-20', body: 'Paid in full.', notes: '', document_ids: [] } } })
    const apply = writeRpcBody('apply_matter_event', { event: { matter_id: MATTER, on: '2026-10-20', body: 'Paid in full.' }, plan_hash: HASH })
    expect(apply).toMatchObject({ ok: true, step: 'apply', body: { p_dry_run: false }, dryRunBody: { p_dry_run: true }, planHash: HASH })
  })
  it('refuses a missing day, a day that is not one, no body, a long body or notes, and documents that are not ids, in words', () => {
    expect(writeRpcBody('plan_matter_event', { event: { matter_id: MATTER, body: 'x' } })).toMatchObject({ ok: false, error: expect.stringContaining('on (YYYY-MM-DD') })
    expect(writeRpcBody('plan_matter_event', { event: { matter_id: MATTER, on: 'Oct 20', body: 'x' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_matter_event', { event: { matter_id: MATTER, on: '2026-10-20', body: '  ' } })).toMatchObject({ ok: false, error: expect.stringContaining('body') })
    expect(writeRpcBody('plan_matter_event', { event: { matter_id: 'nope', on: '2026-10-20', body: 'x' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_matter_event', { event: { matter_id: MATTER, on: '2026-10-20', body: 'x'.repeat(501) } })).toMatchObject({ ok: false, error: expect.stringContaining('500') })
    expect(writeRpcBody('plan_matter_event', { event: { matter_id: MATTER, on: '2026-10-20', body: 'x', notes: 'n'.repeat(4001) } })).toMatchObject({ ok: false, error: expect.stringContaining('4,000') })
    expect(writeRpcBody('plan_matter_event', { event: { matter_id: MATTER, on: '2026-10-20', body: 'x', document_ids: 'd1' } })).toMatchObject({ ok: false, error: expect.stringContaining('document_ids') })
    expect(writeRpcBody('plan_matter_event', { event: { matter_id: MATTER, on: '2026-10-20', body: 'x', document_ids: ['d1'] } })).toMatchObject({ ok: false, error: expect.stringContaining('document_ids') })
    expect(writeRpcBody('apply_matter_event', { event: { matter_id: MATTER, on: '2026-10-20', body: 'x' } })).toMatchObject({ ok: false, error: expect.stringContaining('plan_hash') })
  })
  it('the plan reply points at apply_matter_event, and a repeat apply says the event is on the matter', () => {
    expect(String(planReply('plan_matter_event', { matter: { id: MATTER } }, 'a'.repeat(64)).next)).toContain('apply_matter_event')
    expect(alreadyApplied('apply_matter_event', { target: MATTER, at: '2026-11-08T06:00:00Z' })).toContain('on this matter')
    expect(alreadyApplied('apply_matter_event', { target: MATTER, at: null })).toContain('kind eq event')
  })
  it('the migration is the plan wrapper\'s shape over legal_event_add with source mcp, and the server names both verbs at 0.46.0', () => {
    expect(EVENT_MIGRATION.startsWith("SET lock_timeout = '3s';")).toBe(true)
    expect(EVENT_MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.dev_legal_event_write(p jsonb, p_dry_run boolean DEFAULT true)')
    expect(EVENT_MIGRATION).toContain('IF auth.uid() IS NULL OR NOT public.is_dev() THEN')
    expect(EVENT_MIGRATION).toContain('REVOKE EXECUTE ON FUNCTION public.dev_legal_event_write(jsonb, boolean) FROM PUBLIC, anon;')
    expect(EVENT_MIGRATION).toContain('GRANT EXECUTE ON FUNCTION public.dev_legal_event_write(jsonb, boolean) TO authenticated;')
    expect(EVENT_MIGRATION).not.toMatch(/CREATE TABLE/i)
    expect(EVENT_MIGRATION).toContain("public.legal_event_add(v_matter.id, v_on, v_body, v_notes, v_docs, 'mcp')")
    expect(EVENT_MIGRATION).toContain('v_on > public.app_today()')
    expect(EVENT_MIGRATION).toContain("'events_on_matter', v_count")
    expect(EVENT_MIGRATION).not.toContain('FUNCTION public.legal_event_add')
    for (const verb of ['plan_matter_event', 'apply_matter_event']) {
      expect(SERVER).toContain(`name: '${verb}'`)
      expect(SERVER).toContain(`case '${verb}':`)
    }
    expect(SERVER).toContain("const SERVER_VERSION = '0.54.0'")
    expect(SERVER).toContain('plan_matter_event → apply_matter_event')
    expect(SERVER).toContain('sixty-seven verbs')
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

describe('the statement verbs (v2.6244, punch list #220)', () => {
  const MATTER = 'c4d5e6f7-1111-4222-8333-444455556666'
  const ENTRY = 'd4d5e6f7-1111-4222-8333-444455556667'
  const USER = 'e4d5e6f7-1111-4222-8333-444455556668'
  const AFFIANT = { kind: 'team', user_id: USER, name: ' Malachi Smith ', role: 'the RMP, license M-12345' }
  const ADD = { matter_id: MATTER, on: '2026-10-20', title: 'Affidavit of Malachi Smith', body: '1. I am the RMP.\n2. On October 20 I saw the GC lock the gate.', affiant: AFFIANT, incident_to: '2026-10-22', venue_county: 'Guadalupe' }
  it('are on the allowlist, plan before apply, and POST { p, p_dry_run } to the dry-run wrapper with the affiant trimmed to its four keys', () => {
    expect(isWriteVerb('plan_matter_statement')).toBe(true)
    expect(isWriteVerb('apply_matter_statement')).toBe(true)
    expect(planVerbFor('apply_matter_statement')).toBe('plan_matter_statement')
    const plan = writeRpcBody('plan_matter_statement', { statement: ADD })
    const p = { action: 'add', matter_id: MATTER, on: '2026-10-20', title: 'Affidavit of Malachi Smith', body: ADD.body, affiant: { kind: 'team', name: 'Malachi Smith', role: 'the RMP, license M-12345', user_id: USER }, incident_to: '2026-10-22', venue_county: 'Guadalupe' }
    expect(plan).toEqual({ ok: true, rpc: 'dev_legal_statement_write', step: 'plan', body: { p, p_dry_run: true }, dryRunBody: { p, p_dry_run: true }, target: MATTER, planHash: null })
    // action defaults to add; form rides along only when given (the RPC's default is notary); a witness has no user_id.
    expect(pOf(plan)).not.toHaveProperty('form')
    const witness = writeRpcBody('plan_matter_statement', { statement: { ...ADD, form: 'declaration', affiant: { kind: 'witness', name: 'Jo Dean', role: 'the foreman for Brightline Electric' } } })
    expect(witness).toMatchObject({ ok: true, body: { p: { form: 'declaration', affiant: { kind: 'witness', name: 'Jo Dean', role: 'the foreman for Brightline Electric' } } } })
    expect((pOf(witness).affiant as Record<string, unknown>)).not.toHaveProperty('user_id')
    const apply = writeRpcBody('apply_matter_statement', { statement: ADD, plan_hash: HASH })
    expect(apply).toMatchObject({ ok: true, step: 'apply', body: { p, p_dry_run: false }, dryRunBody: { p, p_dry_run: true }, planHash: HASH })
    expect(writeRpcBody('apply_matter_statement', { statement: ADD })).toMatchObject({ ok: false, error: expect.stringContaining('plan_hash') })
  })
  it('refuses in words an add without its matter, day, title, body or affiant, a bad form, kind or day, a witness with a user_id, and the caps', () => {
    expect(writeRpcBody('plan_matter_statement', {})).toMatchObject({ ok: false, error: expect.stringContaining('needs statement') })
    expect(writeRpcBody('plan_matter_statement', { statement: { ...ADD, matter_id: 'burd' } })).toMatchObject({ ok: false, error: expect.stringContaining('matter_id') })
    expect(writeRpcBody('plan_matter_statement', { statement: { ...ADD, on: undefined } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_matter_statement', { statement: { ...ADD, on: 'Oct 20' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_matter_statement', { statement: { ...ADD, title: ' ' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_matter_statement', { statement: { ...ADD, title: 't'.repeat(201) } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_matter_statement', { statement: { ...ADD, body: '' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_matter_statement', { statement: { ...ADD, body: 'b'.repeat(20001) } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_matter_statement', { statement: { ...ADD, affiant: undefined } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_matter_statement', { statement: { ...ADD, affiant: { kind: 'notary', name: 'x' } } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_matter_statement', { statement: { ...ADD, affiant: { kind: 'team', name: ' ' } } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_matter_statement', { statement: { ...ADD, affiant: { kind: 'witness', name: 'Jo', user_id: USER } } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_matter_statement', { statement: { ...ADD, affiant: { kind: 'team', name: 'Jo', user_id: 'malachi' } } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_matter_statement', { statement: { ...ADD, affiant: { kind: 'team', name: 'Jo', role: 'r'.repeat(301) } } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_matter_statement', { statement: { ...ADD, form: 'sworn' } })).toMatchObject({ ok: false, error: expect.stringContaining('notary | declaration') })
    expect(writeRpcBody('plan_matter_statement', { statement: { ...ADD, incident_to: '22 Oct' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_matter_statement', { statement: { ...ADD, venue_county: 'c'.repeat(61) } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_matter_statement', { statement: { ...ADD, action: 'sign' } })).toMatchObject({ ok: false, error: expect.stringContaining('add | update') })
    // On an add a null span or county is the same as leaving it out.
    const bare = writeRpcBody('plan_matter_statement', { statement: { ...ADD, incident_to: null, venue_county: null } })
    expect(bare).toMatchObject({ ok: true })
    expect(pOf(bare)).not.toHaveProperty('incident_to')
    expect(pOf(bare)).not.toHaveProperty('venue_county')
  })
  it('update names the statement and carries only what changes; null clears the span or the county; nothing to change is refused', () => {
    const upd = writeRpcBody('plan_matter_statement', { statement: { action: 'update', entry_id: ENTRY, title: 'Affidavit of Malachi Smith (RMP)', incident_to: null } })
    expect(upd).toMatchObject({ ok: true, body: { p: { action: 'update', entry_id: ENTRY, title: 'Affidavit of Malachi Smith (RMP)', incident_to: null } }, target: ENTRY })
    expect(pOf(upd)).not.toHaveProperty('body')
    expect(pOf(upd)).not.toHaveProperty('affiant')
    expect(pOf(upd)).not.toHaveProperty('venue_county')
    expect(writeRpcBody('plan_matter_statement', { statement: { action: 'update', entry_id: ENTRY, venue_county: null } })).toMatchObject({ ok: true, body: { p: { venue_county: null } } })
    expect(writeRpcBody('plan_matter_statement', { statement: { action: 'update', entry_id: ENTRY, affiant: { kind: 'witness', name: 'Jo Dean' } } })).toMatchObject({ ok: true, body: { p: { affiant: { kind: 'witness', name: 'Jo Dean', role: '' } } } })
    expect(writeRpcBody('plan_matter_statement', { statement: { action: 'update', entry_id: ENTRY } })).toMatchObject({ ok: false, error: expect.stringContaining('at least one change') })
    expect(writeRpcBody('plan_matter_statement', { statement: { action: 'update', entry_id: 'nope', body: 'x' } })).toMatchObject({ ok: false, error: expect.stringContaining('entry_id') })
    expect(writeRpcBody('plan_matter_statement', { statement: { action: 'update', entry_id: ENTRY, affiant: { kind: 'team', name: '' } } })).toMatchObject({ ok: false })
    expect(writeRpcBody('apply_matter_statement', { statement: { action: 'update', entry_id: ENTRY, body: 'New text.' }, plan_hash: HASH })).toMatchObject({ ok: true, step: 'apply', body: { p: { action: 'update', entry_id: ENTRY, body: 'New text.' }, p_dry_run: false }, planHash: HASH })
  })
  it('the plan hash commits to the draft as it would be written and the live statement count, and a JSON null survives the canonical form', async () => {
    const reply = { dry_run: true, action: 'add', matter: { id: MATTER, payer_name: 'Burd & Assoc.', stage: 'demand' }, before: null, after: { kind: 'statement', state: 'draft', state_words: 'Draft · not signed.', source: 'mcp', incident_to: null }, statements_on_matter: 0, firm_reads_it: true }
    expect(planCommitment('plan_matter_statement', reply)).toEqual({ action: 'add', matter: reply.matter, before: null, after: reply.after, statements_on_matter: 0, firm_reads_it: true })
    const p = pOf(writeRpcBody('plan_matter_statement', { statement: ADD }))
    const a = await planHash('plan_matter_statement', p, reply)
    expect(a).toBe(await planHash('apply_matter_statement', p, reply))
    expect(a).not.toBe(await planHash('plan_matter_statement', p, { ...reply, statements_on_matter: 1 })) // a statement added since
    expect(a).not.toBe(await planHash('plan_matter_statement', { ...p, body: 'Other words.' }, reply)) // a different payload
    expect(canonicalJson({ action: 'update', entry_id: ENTRY, incident_to: null })).toBe(`{"action":"update","entry_id":"${ENTRY}","incident_to":null}`)
  })
  it('the plan reply points at apply_matter_statement, and a repeat apply says the draft is on the Said lane', () => {
    expect(String(planReply('plan_matter_statement', { matter: { id: MATTER } }, 'e'.repeat(64)).next)).toContain('apply_matter_statement')
    expect(alreadyApplied('apply_matter_statement', { target: MATTER, at: '2026-10-31T18:00:00Z' })).toContain('on this matter')
    expect(alreadyApplied('apply_matter_statement', { target: MATTER, at: null })).toContain('Said lane')
    expect(planMismatch('apply_matter_statement', 'a'.repeat(64), 'b'.repeat(64))).toContain('plan_matter_statement')
  })
  it('the server declares both verbs in the write branch, with every older write verb\'s label there too, and reports 0.23.0 (the file index verbs bumped it to 0.15.0, Materials on site to 0.16.0, get_person_file to 0.17.0, the evidence verbs to 0.18.0, the clock session verbs to 0.19.0, the hours statement verbs to 0.20.0, the report verbs to 0.21.0, get_job\'s paged reads to 0.22.0, get_job\'s card rule to 0.23.0)', () => {
    expect(SERVER).toContain("name: 'plan_matter_statement'")
    expect(SERVER).toContain("name: 'apply_matter_statement'")
    expect(SERVER).toContain("case 'plan_matter_statement':")
    expect(SERVER).toContain("case 'apply_matter_statement':")
    expect(SERVER).toContain("const SERVER_VERSION = '0.54.0'")
    expect(SERVER).toContain('plan_matter_statement → apply_matter_statement')
    // v2.6187's mint_twin_setup_code block was merged between the older write labels and the write branch, so for a day
    // plan_cost_batch through apply_history_entry fell through into it. Every write label now sits directly above the
    // branch that handles it, below the mint block.
    const mintStart = SERVER.indexOf("case 'mint_twin_setup_code': {")
    const lineBeforeMint = SERVER.slice(SERVER.lastIndexOf('\n', SERVER.lastIndexOf('\n', mintStart) - 1) + 1, SERVER.lastIndexOf('\n', mintStart))
    expect(lineBeforeMint.trim()).not.toMatch(/^case '(plan|apply|revert)_/)
    const writeBranch = SERVER.indexOf('// The second path: a POST to one hard-coded RPC, as the dev.')
    for (const verb of Object.keys(WRITE_VERBS)) {
      const at = SERVER.indexOf(`case '${verb}':`)
      expect(at).toBeGreaterThan(mintStart)
      expect(at).toBeLessThan(writeBranch)
    }
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
  it('a text document (v2.6716, punch list #288): markdown rides to the RPC with a text file\'s facts, refused empty, over a million characters or on a PDF; the migration keeps the words in documents', () => {
    const md = { ...doc, original_name: 'Intake memo.md', mime: 'text/markdown', size_bytes: 20, markdown: '## One\n\nThe words.' }
    const plan = writeRpcBody('plan_matter_document', { document: md })
    expect(plan).toMatchObject({ ok: true, body: { p: { mime: 'text/markdown', markdown: '## One\n\nThe words.' } } })
    expect(writeRpcBody('plan_matter_document', { document: { ...md, markdown: '  ' } })).toMatchObject({ ok: false, error: expect.stringContaining('not empty') })
    expect(writeRpcBody('plan_matter_document', { document: { ...md, markdown: 'x'.repeat(1_000_001) } })).toMatchObject({ ok: false, error: expect.stringContaining('1,000,000') })
    expect(writeRpcBody('plan_matter_document', { document: { ...doc, markdown: 'words on a pdf' } })).toMatchObject({ ok: false, error: expect.stringContaining('text file') })
    const plain = writeRpcBody('plan_matter_document', { document: doc })
    expect(plain.ok ? (plain.body.p as Record<string, unknown>).markdown : 'refused').toBeUndefined()
    expect(SHARED_DOCS_MIGRATION).toMatch(/^SET lock_timeout = '3s';/)
    expect(SHARED_DOCS_MIGRATION).toContain('ALTER TABLE public.person_documents RENAME TO documents;')
    expect(SHARED_DOCS_MIGRATION).toContain('ALTER TABLE public.person_document_revisions RENAME TO document_revisions;')
    expect(SHARED_DOCS_MIGRATION).toContain("c.relname = 'person_documents' AND c.relkind = 'r'")
    expect(SHARED_DOCS_MIGRATION).toContain('ADD CONSTRAINT documents_one_owner_check CHECK ((person_id IS NULL) <> (matter_id IS NULL)) NOT VALID;')
    expect(SHARED_DOCS_MIGRATION).toContain('CREATE OR REPLACE VIEW public.person_documents\nWITH (security_invoker = true) AS\n  SELECT d.* FROM public.documents d WHERE d.person_id IS NOT NULL;')
    expect(SHARED_DOCS_MIGRATION).toContain('FOR SELECT USING (matter_id IS NOT NULL AND public.legal_office_can_read());')
    expect(SHARED_DOCS_MIGRATION).toContain('FOR INSERT WITH CHECK (matter_id IS NOT NULL AND person_id IS NULL AND public.legal_office_can_read());')
    expect(SHARED_DOCS_MIGRATION).not.toMatch(/FOR DELETE/)
    expect(SHARED_DOCS_MIGRATION).toContain('ALTER TABLE public.legal_matter_documents ADD COLUMN IF NOT EXISTS text_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL;')
    expect(SHARED_DOCS_MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.dev_legal_document_write(p jsonb, p_dry_run boolean DEFAULT true, p_file jsonb DEFAULT NULL)')
    expect(SHARED_DOCS_MIGRATION).toContain("v_markdown text := CASE WHEN p ? 'markdown' THEN p->>'markdown' ELSE NULL END;")
    expect(SHARED_DOCS_MIGRATION).toContain("IF v_mime NOT IN ('text/plain', 'text/markdown') THEN")
    expect(SHARED_DOCS_MIGRATION).toContain('INSERT INTO public.documents (matter_id, title, content, author_label, created_by, updated_by)')
    expect(SHARED_DOCS_MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.dev_case_search(p_person_id uuid, p_q text, p_in text DEFAULT NULL, p_limit int DEFAULT 40)')
    expect(SHARED_DOCS_MIGRATION).toContain('JOIN public.documents t ON t.id = d.text_document_id')
    expect(SHARED_DOCS_MIGRATION).toContain('FROM public.documents d\n      CROSS JOIN LATERAL public.hr_doc_sections(d.content) s')
    for (const fence of ['apply_read_only_write_blocks', 'apply_read_only_stmt_blocks', 'apply_digital_twin_write_blocks', 'apply_archived_read_blocks']) expect(SHARED_DOCS_MIGRATION).toContain(`SELECT public.${fence}();`)
  })
  it('counsel-only (v2.6720, punch list #288 PR 2): the mark rides to the RPC when true, is refused as a non-boolean, and the migration binds the seat and the print the way the doc says', () => {
    expect(writeRpcBody('plan_matter_document', { document: { ...doc, counsel_only: true } })).toMatchObject({ ok: true, body: { p: { counsel_only: true } } })
    const off = writeRpcBody('plan_matter_document', { document: { ...doc, counsel_only: false } })
    expect(off.ok ? (off.body.p as Record<string, unknown>).counsel_only : 'refused').toBeUndefined()
    expect(writeRpcBody('plan_matter_document', { document: { ...doc, counsel_only: 'yes' } })).toMatchObject({ ok: false, error: expect.stringContaining('counsel_only') })
    expect(COUNSEL_DOCS_MIGRATION).toMatch(/^SET lock_timeout = '3s';/)
    expect(COUNSEL_DOCS_MIGRATION).toContain('ALTER TABLE public.legal_matter_documents ADD COLUMN IF NOT EXISTS counsel_only boolean NOT NULL DEFAULT false;')
    expect(COUNSEL_DOCS_MIGRATION).toContain('AS RESTRICTIVE FOR SELECT TO authenticated USING (NOT (counsel_only AND public.request_is_dev_seat()));')
    expect(COUNSEL_DOCS_MIGRATION).toContain('CREATE POLICY documents_matter_counsel_only_seat ON public.documents')
    expect(COUNSEL_DOCS_MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.matter_counsel_only_count(p_matter_id uuid)')
    expect(COUNSEL_DOCS_MIGRATION).toContain("v_counsel boolean := COALESCE(NULLIF(btrim(COALESCE(p->>'counsel_only', '')), '')::boolean, false);")
    expect(COUNSEL_DOCS_MIGRATION).toContain('INSERT INTO public.documents (matter_id, title, content, counsel_only, author_label, created_by, updated_by)')
    expect(COUNSEL_DOCS_MIGRATION).toContain("SELECT 'matter_document', d.id::text, d.title, s.n, s.heading, d.dated_on::text, d.counsel_only,")
    expect(COUNSEL_DOCS_MIGRATION).toContain("AND (f.source <> 'matter_document' OR d.text_document_id IS NULL)")
    expect(COUNSEL_DOCS_MIGRATION).not.toMatch(/FROM public\.person_documents/)
    expect(COUNSEL_DOCS_MIGRATION).not.toMatch(/CREATE TABLE/)
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
    expect(SERVER).toContain("case 'apply_matter_document':")
    // v2.6414: the hours statement's labels sit in the chain before v2.6426's evidence labels, which close it.
    expect(SERVER).toContain("case 'plan_hours_statement':\n    case 'apply_hours_statement':\n    case 'plan_person_doc':\n    case 'apply_person_doc':\n    case 'plan_person_evidence':") // v2.6608: the person-document labels sit between them
    expect(SERVER).toContain('let file = isDocument ? await documentBytes(args) : null')
    expect(SERVER).toContain("p_file: { id, storage_path: path }")
    expect(SERVER).toContain('if (stored) await storageRemove(session, LEGAL_MATTER_DOCUMENTS_BUCKET, stored)')
    expect(SERVER).toContain('args: argsForLog(name, args)')
    expect(SERVER).toContain("const SERVER_VERSION = '0.54.0'")
  })
})

describe('the evidence verbs (v2.6426)', () => {
  const ENTRY = 'b1b2c3d4-0000-4000-8000-000000000099'
  const FILE = { name: 'site.jpg', mime: 'image/jpeg', size_bytes: 2048, sha256: 'b'.repeat(64) }
  const EVIDENCE = { person_id: PERSON, dated_on: '2026-10-28', title: ' Left a mess at the site ', memo: 'Two photos from the super.', files: [FILE] }
  const problem = (input: Record<string, unknown>): string => {
    const r = writeRpcBody('plan_person_evidence', input)
    return r.ok ? '' : r.error
  }

  it('are on the allowlist, plan before apply, and POST { p, p_dry_run } with each file as its name, mime, size and digest — never its bytes', () => {
    expect(WRITE_VERBS.plan_person_evidence).toEqual({ rpc: 'dev_person_evidence_write', step: 'plan' })
    expect(WRITE_VERBS.apply_person_evidence).toEqual({ rpc: 'dev_person_evidence_write', step: 'apply' })
    expect(planVerbFor('apply_person_evidence')).toBe('plan_person_evidence')
    const plan = writeRpcBody('plan_person_evidence', { evidence: EVIDENCE })
    expect(plan).toMatchObject({ ok: true, rpc: 'dev_person_evidence_write', step: 'plan', target: PERSON })
    expect(pOf(plan)).toEqual({ person_id: PERSON, dated_on: '2026-10-28', title: 'Left a mess at the site', memo: 'Two photos from the super.', files: [FILE] })
    expect(plan.ok && plan.body.p_dry_run).toBe(true)
    const apply = writeRpcBody('apply_person_evidence', { evidence: { ...EVIDENCE, entry_id: ENTRY, files: [{ ...FILE, mime: 'IMAGE/JPEG', sha256: 'B'.repeat(64) }] }, plan_hash: HASH })
    expect(apply.ok && apply.body.p_dry_run).toBe(false)
    expect(apply.ok && apply.dryRunBody?.p_dry_run).toBe(true)
    expect(pOf(apply).entry_id).toBe(ENTRY)
    expect(pOf(apply).files).toEqual([FILE]) // the mime and the digest lowered
    expect(JSON.stringify(pOf(apply))).not.toContain('content_base64')
  })

  it('a file already in Drive travels as { name, drive_url } alone and is held to a Drive address (v2.6541); the migration writes it with its link and reads its id', () => {
    const LINK = { name: 'Call recording, Aug 29', drive_url: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing' }
    const plan = writeRpcBody('plan_person_evidence', { evidence: { ...EVIDENCE, files: [FILE, LINK] } })
    expect(plan.ok).toBe(true)
    expect(pOf(plan).files).toEqual([FILE, LINK])
    expect(writeRpcBody('plan_person_evidence', { evidence: { ...EVIDENCE, files: [LINK] } }).ok).toBe(true)
    expect(problem({ evidence: { ...EVIDENCE, files: [{ ...LINK, drive_url: 'https://example.com/call.mp3' }] } })).toContain('needs evidence')
    expect(problem({ evidence: { ...EVIDENCE, files: [{ ...LINK, name: '' }] } })).toContain('needs evidence')
    const linked = readFileSync('supabase/migrations/20261105200000_evidence_linked_file.sql', 'utf8')
    expect(linked).toContain("SET lock_timeout = '3s';")
    expect(linked).toContain('ALTER TABLE public.person_file_attachments ALTER COLUMN storage_path DROP NOT NULL;')
    expect(linked).toContain('CHECK (storage_path IS NOT NULL OR drive_url IS NOT NULL) NOT VALID')
    expect(linked).toContain("btrim(v_file->>'drive_url') !~ '^https://(drive|docs)\\.google\\.com/\\S+$'")
    expect(linked).toContain('VALUES (v_file_id, v_person_id, v_entry_id, v_evidence_id, NULL, btrim(v_file->>\'name\'), NULL, NULL, v_drive_id, v_url, now(), auth.uid(), v_label);')
    expect(linked).toContain("'linked', v_linked, 'staged', v_count - v_linked")
    expect(SERVER).toContain("rows.push({ id, drive_url: f.driveUrl })")
    // v2.6544: the custody hash the plan committed to is stored on the staged file's row.
    const hashed = readFileSync('supabase/migrations/20261105230000_evidence_sha256.sql', 'utf8')
    expect(hashed).toContain("SET lock_timeout = '3s';")
    expect(hashed).toContain('ALTER TABLE public.person_file_attachments ADD COLUMN IF NOT EXISTS sha256 text;')
    expect(hashed).toContain("CHECK (sha256 IS NULL OR sha256 ~ '^[0-9a-f]{64}$') NOT VALID")
    expect(hashed).toContain('INSERT INTO public.person_file_attachments (id, person_id, entry_id, evidence_id, storage_path, filename, mime_type, size_bytes, sha256, uploaded_by, author_label)')
    expect(hashed).toContain("lower(v_file->>'sha256'), auth.uid(), v_label);")
  })

  it('refuses in words an evidence without its person, day, title, memo or files, the caps, a file with no digest or over 10 MB, a bad entry id, and apply without the hash', () => {
    expect(problem({})).toContain('needs evidence')
    expect(problem({ evidence: { ...EVIDENCE, person_id: 'nope' } })).toContain('needs evidence')
    expect(problem({ evidence: { ...EVIDENCE, dated_on: '10/28/2026' } })).toContain('needs evidence')
    expect(problem({ evidence: { ...EVIDENCE, title: ' ' } })).toContain('needs evidence')
    expect(problem({ evidence: { ...EVIDENCE, title: 'x'.repeat(161) } })).toContain('needs evidence')
    expect(problem({ evidence: { ...EVIDENCE, memo: '' } })).toContain('needs evidence')
    expect(problem({ evidence: { ...EVIDENCE, memo: 'x'.repeat(4001) } })).toContain('needs evidence')
    expect(problem({ evidence: { ...EVIDENCE, files: [] } })).toContain('needs evidence')
    expect(problem({ evidence: { ...EVIDENCE, files: Array(EVIDENCE_MAX_FILES + 1).fill(FILE) } })).toContain('needs evidence')
    expect(problem({ evidence: { ...EVIDENCE, files: [{ ...FILE, sha256: 'short' }] } })).toContain('needs evidence')
    expect(problem({ evidence: { ...EVIDENCE, files: [{ ...FILE, size_bytes: 10 * 1024 * 1024 + 1 }] } })).toContain('needs evidence')
    expect(problem({ evidence: { ...EVIDENCE, files: [{ ...FILE, name: '' }] } })).toContain('needs evidence')
    expect(problem({ evidence: { ...EVIDENCE, entry_id: 'nope' } })).toContain('needs evidence')
    expect(problem({ evidence: { ...EVIDENCE, files: Array(EVIDENCE_MAX_FILES).fill(FILE) } })).toBe('')
    const noHash = writeRpcBody('apply_person_evidence', { evidence: EVIDENCE })
    expect(noHash.ok ? '' : noHash.error).toContain('needs plan_hash')
  })

  it("the plan hash commits to the files' digests, the record as it would be written and the live count; a record kept or a file changed since moves it", async () => {
    const reply = { dry_run: true, person: { id: PERSON, name: 'Pat' }, author_label: 'Robert', after: { dated_on: '2026-10-28', title: 'Left a mess at the site', files: [FILE] }, evidence_on_person: 2, where: 'People › Pat › 2026-10-28 · Left a mess at the site', people_folder_set: true }
    const a = await planHash('plan_person_evidence', pOf(writeRpcBody('plan_person_evidence', { evidence: EVIDENCE })), reply)
    const b = await planHash('apply_person_evidence', pOf(writeRpcBody('apply_person_evidence', { evidence: EVIDENCE, plan_hash: HASH })), { ...reply, dry_run: false })
    expect(a).toBe(b)
    expect(await planHash('plan_person_evidence', pOf(writeRpcBody('plan_person_evidence', { evidence: EVIDENCE })), { ...reply, evidence_on_person: 3 })).not.toBe(a)
    expect(await planHash('plan_person_evidence', pOf(writeRpcBody('plan_person_evidence', { evidence: { ...EVIDENCE, files: [{ ...FILE, sha256: 'c'.repeat(64) }] } })), reply)).not.toBe(a)
    expect(planCommitment('plan_person_evidence', reply)).not.toHaveProperty('dry_run')
  })

  it('the plan reply points at apply_person_evidence, and a repeat apply says the record is on the Evidence tab', () => {
    expect(planReply('plan_person_evidence', { dry_run: true }, HASH).next).toContain('apply_person_evidence')
    expect(alreadyApplied('apply_person_evidence', { target: PERSON, at: '2026-11-02T00:00:00Z' })).toContain('Evidence tab')
    expect(alreadyApplied('apply_person_evidence', { target: PERSON, at: null })).toContain('on this person')
  })

  it("the server declares both verbs in the write branch, stages every file in hr-files under the record's folder only at apply, removes them when the rows are refused, asks Drive after the rows, and keeps the bytes out of the log", () => {
    expect(SERVER).toContain("name: 'plan_person_evidence'")
    expect(SERVER).toContain("name: 'apply_person_evidence'")
    expect(SERVER).toContain("case 'plan_person_evidence':\n    case 'apply_person_evidence': {")
    expect(SERVER).toContain('const evidence = isEvidence ? await evidenceBytes(args) : null')
    expect(SERVER).toContain('evidenceStoragePath(String(built.target), evidenceId, id, f.name)')
    expect(SERVER).toContain('storagePut(session, HR_FILES_BUCKET, path, f.bytes, f.mime)')
    expect(SERVER).toContain('p_files: { evidence_id: evidenceId, files: rows }')
    expect(SERVER).toContain('for (const p of staged) await storageRemove(session, HR_FILES_BUCKET, p)')
    expect(SERVER.indexOf('await fileEvidenceToDrive(session, evidenceId)')).toBeGreaterThan(SERVER.indexOf('const res = await restPost(session, rpcPath, writeBody)'))
    expect(SERVER).toContain("if (name === 'plan_person_evidence' || name === 'apply_person_evidence') {") // argsForLog
    expect(SERVER).toContain("const SERVER_VERSION = '0.54.0'")
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
  it('the server declares both verbs in the write branch and reports the server version', () => {
    expect(SERVER).toContain("name: 'plan_gap_answer'")
    expect(SERVER).toContain("name: 'apply_gap_answer'")
    expect(SERVER).toContain("case 'plan_gap_answer':")
    expect(SERVER).toContain("case 'apply_gap_answer':")
    expect(SERVER).toContain("const SERVER_VERSION = '0.54.0'")
    expect(SERVER).toContain('Writes are sixty-seven verbs and nothing else')
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

describe('the Materials on site verbs (v2.6367, punch list #209)', () => {
  const JOB = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const PART = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  const ON_SITE_VERBS = ['plan_container', 'apply_container', 'plan_delivery', 'apply_delivery', 'plan_movement', 'apply_movement', 'plan_count', 'apply_count'] as const
  it('are eight verbs on the allowlist over one SECURITY INVOKER RPC that refuses a training account and a twin in words, with the seven actions', () => {
    for (const verb of ON_SITE_VERBS) {
      expect(isWriteVerb(verb)).toBe(true)
      expect(WRITE_VERBS[verb].rpc).toBe('dev_on_site_write')
    }
    expect(planVerbFor('apply_container')).toBe('plan_container')
    expect(planVerbFor('apply_delivery')).toBe('plan_delivery')
    expect(planVerbFor('apply_movement')).toBe('plan_movement')
    expect(planVerbFor('apply_count')).toBe('plan_count')
    expect(planVerbFor('plan_count')).toBeNull()
    expect(ON_SITE_MIGRATION.startsWith("SET lock_timeout = '3s';")).toBe(true)
    expect(ON_SITE_MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.dev_on_site_write(p jsonb, p_dry_run boolean DEFAULT true)')
    expect(ON_SITE_MIGRATION).toContain('IF auth.uid() IS NULL OR NOT public.is_dev() THEN')
    expect(ON_SITE_MIGRATION).toContain('IF public.is_read_only() THEN')
    expect(ON_SITE_MIGRATION).toContain('IF public.is_digital_twin() THEN')
    expect(ON_SITE_MIGRATION).toContain('IF NOT public.on_site_can_touch_job(v_job_id) THEN')
    expect(ON_SITE_MIGRATION).toContain('REVOKE ALL ON FUNCTION public.dev_on_site_write(jsonb, boolean) FROM anon;')
    expect(ON_SITE_MIGRATION).toContain('GRANT EXECUTE ON FUNCTION public.dev_on_site_write(jsonb, boolean) TO authenticated;')
    expect(ON_SITE_MIGRATION).not.toMatch(/CREATE TABLE/i)
    // SECURITY INVOKER on purpose: every insert lands under the dev's own RLS, the gate and the fences as on the screen.
    // Held on the newest definition: v2.6456 re-stated the wrapper whole, and a later one must keep every rule.
    const wrapper = newestDefinition('dev_on_site_write').body
    expect(wrapper).toContain('SECURITY INVOKER')
    expect(wrapper).not.toContain('SECURITY DEFINER')
    for (const action of ['add_container', 'move_container', 'retire_container', 'bring_back_container', 'delivery', 'movement', 'count']) expect(wrapper).toContain(`v_action = '${action}'`)
    // The phone's rules, in its own words: a box with parts in it is not retired (v2.6041); a retired box comes back
    // unless a live box on the job carries its stencil now, compared without case or spaces (v2.6406's unretireVerdict).
    expect(wrapper).toContain('still has parts in it. Move them or mark them used first, then retire it.')
    expect(wrapper).toContain('already carries %. Retire it first, or give it another stencil.')
    expect(wrapper).toContain('% is already on the job.')
    expect(wrapper).toContain("format('%s is back on the job. Its label works again.', v_container.label)")
    expect(wrapper).toContain("lower(regexp_replace(c.label, '\\s+', '', 'g')) = lower(regexp_replace(v_container.label, '\\s+', '', 'g'))")
    expect(wrapper).toContain('UPDATE public.job_containers SET retired_at = NULL WHERE id = v_container.id;')
    // The ledger's arithmetic in SQL beside the kernel's: a count resets, the rest sum.
    expect(ON_SITE_MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.on_site_line_on_hand(p_container_id uuid, p_part_id uuid, p_part_name text)')
    expect(ON_SITE_MIGRATION).toContain('MCP as')
  })
  it('v2.6456: a trigger fills who made a cage or a place, the on-hand read takes one part argument, and the wrapper names the job as the app does', () => {
    expect(ON_SITE_FIXES_MIGRATION.startsWith("SET lock_timeout = '3s';")).toBe(true)
    expect(ON_SITE_FIXES_MIGRATION).not.toMatch(/CREATE TABLE/i)
    // The screens send created_by: null; the trigger fills it from the signed-in user and keeps one that was given.
    expect(ON_SITE_FIXES_MIGRATION).toContain('IF NEW.created_by IS NULL THEN\n    NEW.created_by := auth.uid();')
    for (const table of ['job_containers', 'job_places']) expect(ON_SITE_FIXES_MIGRATION).toContain(`CREATE OR REPLACE TRIGGER ${table}_fill_created_by BEFORE INSERT ON public.${table}\n  FOR EACH ROW EXECUTE FUNCTION public.on_site_fill_created_by();`)
    // A GET cannot send a null, so the seat's call_read names one part argument and the other defaults.
    const onHand = newestDefinition('on_site_line_on_hand')
    expect(onHand.file).toBe('20261103143000_on_site_small_fixes.sql')
    expect(onHand.body).toContain('public.on_site_line_on_hand(p_container_id uuid, p_part_id uuid DEFAULT NULL, p_part_name text DEFAULT NULL)')
    expect(ON_SITE_FIXES_MIGRATION).toContain('GRANT EXECUTE ON FUNCTION public.on_site_line_on_hand(uuid, uuid, text) TO authenticated;')
    // The job's label as the app writes it (formatJobLedgerNumberLabel over effectiveJobLedgerNumber): the service
    // type's job prefix, else J, then the HCP number, else the Click number.
    const wrapper = newestDefinition('dev_on_site_write')
    expect(wrapper.file).toBe('20261103143000_on_site_small_fixes.sql')
    expect(wrapper.body).toContain("COALESCE(NULLIF(btrim(st.ledger_job_prefix), ''), 'J') || COALESCE(NULLIF(btrim(j.hcp_number), ''), NULLIF(btrim(j.click_number), ''), '—')")
    expect(wrapper.body).toContain('LEFT JOIN public.service_types st ON st.id = j.service_type_id')
    expect(DEFAULT_JOB_LEDGER_PREFIX).toBe('J')
    expect(formatJobLedgerNumberLabel('JP', '972', null)).toBe('JP972')
    expect(formatJobLedgerNumberLabel('', '', '1085')).toBe('J1085')
    expect(formatJobLedgerNumberLabel('', ' ', '')).toBe('J—')
    expect(ON_SITE_FIXES_MIGRATION).toContain('GRANT EXECUTE ON FUNCTION public.dev_on_site_write(jsonb, boolean) TO authenticated;')
    expect(ON_SITE_FIXES_MIGRATION).toContain('REVOKE ALL ON FUNCTION public.dev_on_site_write(jsonb, boolean) FROM anon;')
  })
  it('a container plan: add with its stencil, kind, where and place; move, retire and bring back name the box; refusals in words', () => {
    const add = writeRpcBody('plan_container', { container: { job_id: JOB, agent_label: 'the receiving robot', label: ' a2 ', kind: 'Cage', where: 'by the north stair', place: 'Level 2' } })
    const p = { action: 'add_container', job_id: JOB, agent_label: 'the receiving robot', label: 'a2', kind: 'cage', where: 'by the north stair', place: 'Level 2' }
    expect(add).toEqual({ ok: true, rpc: 'dev_on_site_write', step: 'plan', body: { p, p_dry_run: true }, dryRunBody: { p, p_dry_run: true }, target: `${JOB} A2`, planHash: null })
    expect(pOf(writeRpcBody('plan_container', { container: { job_id: JOB, agent_label: 'r', action: 'move', container: 'A2', place: 'Laydown yard', at: '2026-11-01T09:00:00-05:00' } }))).toEqual({ action: 'move_container', job_id: JOB, agent_label: 'r', container: 'A2', place: 'Laydown yard', at: '2026-11-01T09:00:00-05:00' })
    expect(pOf(writeRpcBody('plan_container', { container: { job_id: JOB, agent_label: 'r', action: 'retire', container: 'A2' } }))).toEqual({ action: 'retire_container', job_id: JOB, agent_label: 'r', container: 'A2' })
    expect(writeRpcBody('plan_container', { container: { job_id: JOB, agent_label: 'r', action: 'bring_back', container: 'G4' } })).toMatchObject({ ok: true, target: `${JOB} G4`, body: { p: { action: 'bring_back_container', job_id: JOB, agent_label: 'r', container: 'G4' } } })
    expect(writeRpcBody('plan_container', { container: { job_id: JOB, agent_label: 'r', action: 'bring_back' } })).toMatchObject({ ok: false, error: expect.stringContaining('bring_back: container') })
    expect(writeRpcBody('plan_container', { container: { job_id: JOB, agent_label: 'r', action: 'unretire', container: 'G4' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_container', {})).toMatchObject({ ok: false, error: expect.stringContaining('needs container') })
    expect(writeRpcBody('plan_container', { container: { job_id: JOB, agent_label: 'r', label: 'A2', kind: 'unsorted' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_container', { container: { job_id: JOB, agent_label: 'r', label: 'A2', kind: 'box', where: 'x'.repeat(121) } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_container', { container: { job_id: JOB, label: 'A2', kind: 'box' } })).toMatchObject({ ok: false, error: expect.stringContaining('agent_label') })
    expect(writeRpcBody('plan_container', { container: { job_id: JOB, agent_label: 'r', action: 'move', container: 'A2' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_container', { container: { job_id: JOB, agent_label: 'r', action: 'move', container: 'A2', place: 'Yard', at: 'last week' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('apply_container', { container: { job_id: JOB, agent_label: 'r', label: 'A2', kind: 'box' } })).toMatchObject({ ok: false, error: expect.stringContaining('plan_hash') })
    expect(writeRpcBody('apply_container', { container: { job_id: JOB, agent_label: 'r', label: 'A2', kind: 'box' }, plan_hash: HASH })).toMatchObject({ ok: true, step: 'apply', body: { p_dry_run: false }, dryRunBody: { p_dry_run: true }, planHash: HASH })
  })
  it('a delivery plan: lines by book id or typed name with whole quantities and units, the source, the box (Unsorted when left out)', () => {
    const plan = writeRpcBody('plan_delivery', { delivery: { job_id: JOB, agent_label: 'the receiving robot', source: ' INV-10422 ', lines: [{ part_id: PART, quantity: 25, unit: 'EA' }, { part_name: '  50 gal  water heater ', quantity: 2 }] } })
    expect(pOf(plan)).toEqual({ action: 'delivery', job_id: JOB, agent_label: 'the receiving robot', source: 'INV-10422', lines: [{ quantity: 25, part_id: PART, unit: 'EA' }, { quantity: 2, part_name: '50 gal water heater' }] })
    expect(plan).toMatchObject({ ok: true, target: `${JOB} Unsorted` })
    expect(writeRpcBody('plan_delivery', { delivery: { job_id: JOB, agent_label: 'r', to: 'A2', lines: [{ part_name: 'x', quantity: 1 }] } })).toMatchObject({ ok: true, target: `${JOB} A2`, body: { p: { to: 'A2' } } })
    expect(writeRpcBody('plan_delivery', {})).toMatchObject({ ok: false, error: expect.stringContaining('needs delivery') })
    expect(writeRpcBody('plan_delivery', { delivery: { job_id: JOB, agent_label: 'r', lines: [] } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_delivery', { delivery: { job_id: JOB, agent_label: 'r', lines: [{ part_name: 'x', quantity: 0 }] } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_delivery', { delivery: { job_id: JOB, agent_label: 'r', lines: [{ part_name: 'x', quantity: 2.5 }] } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_delivery', { delivery: { job_id: JOB, agent_label: 'r', lines: [{ part_id: 'the copper', quantity: 1 }] } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_delivery', { delivery: { job_id: JOB, agent_label: 'r', lines: [{ quantity: 1 }] } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_delivery', { delivery: { job_id: JOB, agent_label: 'r', lines: Array.from({ length: 201 }, () => ({ part_name: 'x', quantity: 1 })) } })).toMatchObject({ ok: false })
  })
  it('a movement plan: one press on a line with its reason; moved needs to, taken needs a note, nothing else takes to', () => {
    expect(pOf(writeRpcBody('plan_movement', { movement: { job_id: JOB, agent_label: 'r', container: 'Unsorted', part_id: PART, quantity: 25, reason: 'moved', to: 'A2' } }))).toEqual({ action: 'movement', job_id: JOB, agent_label: 'r', container: 'Unsorted', reason: 'moved', quantity: 25, part_id: PART, to: 'A2' })
    expect(pOf(writeRpcBody('plan_movement', { movement: { job_id: JOB, agent_label: 'r', container: 'A2', part_name: '3/4" copper 90', quantity: 4, reason: 'USED', note: 'the risers' } }))).toEqual({ action: 'movement', job_id: JOB, agent_label: 'r', container: 'A2', reason: 'used', quantity: 4, part_name: '3/4" copper 90', note: 'the risers' })
    expect(writeRpcBody('plan_movement', { movement: { job_id: JOB, agent_label: 'r', container: 'A2', part_id: PART, quantity: 1, reason: 'taken', note: "Mateo's truck" } })).toMatchObject({ ok: true })
    expect(writeRpcBody('plan_movement', { movement: { job_id: JOB, agent_label: 'r', container: 'A2', part_id: PART, quantity: 1, reason: 'taken' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_movement', { movement: { job_id: JOB, agent_label: 'r', container: 'A2', part_id: PART, quantity: 1, reason: 'moved' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_movement', { movement: { job_id: JOB, agent_label: 'r', container: 'A2', part_id: PART, quantity: 1, reason: 'used', to: 'B1' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_movement', { movement: { job_id: JOB, agent_label: 'r', container: 'A2', part_id: PART, quantity: 1, reason: 'delivered' } })).toMatchObject({ ok: false, error: expect.stringContaining('plan_delivery') })
    expect(writeRpcBody('plan_movement', { movement: { job_id: JOB, agent_label: 'r', container: 'A2', part_id: PART, quantity: 1, reason: 'counted' } })).toMatchObject({ ok: false, error: expect.stringContaining('plan_count') })
    expect(writeRpcBody('plan_movement', { movement: { job_id: JOB, agent_label: 'r', part_id: PART, quantity: 1, reason: 'used' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_movement', { movement: { job_id: JOB, agent_label: 'r', container: 'A2', part_id: PART, quantity: 0, reason: 'used' } })).toMatchObject({ ok: false })
  })
  it('a count plan: the box and its lines with counted numbers, zero allowed; the plan hash commits to the lines and the box\'s row count, never a clock', async () => {
    const count = { job_id: JOB, agent_label: 'the counting robot', container: 'A2', lines: [{ part_id: PART, counted: 12 }, { part_name: '2in pvc 45', counted: 0 }] }
    expect(pOf(writeRpcBody('plan_count', { count }))).toEqual({ action: 'count', job_id: JOB, agent_label: 'the counting robot', container: 'A2', lines: [{ counted: 12, part_id: PART }, { counted: 0, part_name: '2in pvc 45' }] })
    expect(writeRpcBody('plan_count', { count: { ...count, lines: [{ part_id: PART, counted: -1 }] } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_count', { count: { ...count, lines: [{ part_id: PART, quantity: 3 }] } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_count', { count: { ...count, container: '' } })).toMatchObject({ ok: false, error: expect.stringContaining('needs count') })
    const reply = { ok: true, dry_run: true, action: 'count', job: { id: JOB, label: '972', name: 'ZZ Test job' }, after: { container: 'A2', lines: [{ part: 'x', expected: 14, counted: 12, diff: -2 }] }, by: 'the counting robot · MCP as Stephen', at: 'now', container_rows: 4 }
    const built = writeRpcBody('plan_count', { count })
    const h1 = await planHash('plan_count', pOf(built), reply)
    expect(h1).toBe(await planHash('apply_count', pOf(writeRpcBody('apply_count', { count, plan_hash: HASH })), { ...reply, dry_run: false }))
    expect(h1).not.toBe(await planHash('plan_count', pOf(built), { ...reply, container_rows: 5 }))
    expect(planCommitment('plan_count', reply)).not.toHaveProperty('dry_run')
  })
  it('the plan replies point at their apply verbs, a replay is refused by the box\'s own state rather than the log, and the server declares the nine verbs and reports 0.20.0 (the hours statement verbs took it there)', () => {
    expect(String(planReply('plan_container', { after: { container: 'A2' } }, 'e'.repeat(64)).next)).toContain('apply_container')
    expect(String(planReply('plan_delivery', {}, 'e'.repeat(64)).next)).toContain('apply_delivery')
    expect(String(planReply('plan_movement', {}, 'e'.repeat(64)).next)).toContain('apply_movement')
    expect(String(planReply('plan_count', {}, 'e'.repeat(64)).next)).toContain('apply_count')
    // The log's one-apply rule leaves the four alone: their plans commit to the state the write changes, so a replay
    // is refused by the wrapper (a live stencil, already there, already retired or back) or by a moved row count —
    // and G4 added, retired and added again is a second act, not a replay.
    for (const verb of ['apply_container', 'apply_delivery', 'apply_movement', 'apply_count']) expect(stateGuarded(verb)).toBe(true)
    for (const verb of ['plan_container', 'apply_cost_batch', 'apply_hr_entry', 'apply_history_entry', 'apply_bid', 'apply_plan_set', 'apply_paper']) expect(stateGuarded(verb)).toBe(false)
    expect(SERVER).toContain('const prior = stateGuarded(name) ? null : await hooks.priorApply(name, fresh)')
    for (const verb of [...ON_SITE_VERBS, 'read_on_site']) expect(SERVER).toContain(`name: '${verb}'`)
    for (const verb of ON_SITE_VERBS) expect(SERVER).toContain(`case '${verb}':`)
    expect(SERVER).toContain("case 'read_on_site':")
    expect(SERVER).toContain("const SERVER_VERSION = '0.54.0'")
    expect(SERVER).toContain('Writes are sixty-seven verbs and nothing else')
    expect(SERVER).toContain('plan_count → apply_count')
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

  it('v2.6623: ops against the narrative\'s headings, with expect_updated_at; both or neither of markdown and ops refused; the migration carries the shared op function', () => {
    const ops = [{ op: 'replace_section', heading: 'The claim', markdown: 'What is owed.' }, { op: 'append', markdown: '## Next\n\nThe demand.' }]
    expect(writeRpcBody('plan_matter_narrative', { narrative: { matter_id: MATTER, ops, expect_updated_at: '2026-11-07T06:00:00Z' } })).toMatchObject({ ok: true, target: MATTER, body: { p: { matter_id: MATTER, ops, expect_updated_at: '2026-11-07T06:00:00Z' }, p_dry_run: true } })
    expect(writeRpcBody('plan_matter_narrative', { narrative: { matter_id: MATTER, markdown: 'x', ops } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_matter_narrative', { narrative: { matter_id: MATTER, ops: [] } })).toMatchObject({ ok: false })
    expect(NARRATIVE_OPS_MIGRATION).toMatch(/^SET lock_timeout = '3s';/)
    expect(NARRATIVE_OPS_MIGRATION).toContain("CREATE OR REPLACE FUNCTION public.hr_doc_apply_ops(p_text text, p_ops jsonb, p_what text DEFAULT 'document')")
    expect(NARRATIVE_OPS_MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.dev_legal_narrative_write(p jsonb, p_dry_run boolean DEFAULT true)')
    expect(NARRATIVE_OPS_MIGRATION).toContain("IF (p ? 'markdown') = (p ? 'ops') THEN")
    expect(NARRATIVE_OPS_MIGRATION).toContain("v_applied := public.hr_doc_apply_ops(v_before, p->'ops', 'narrative');")
    expect(NARRATIVE_OPS_MIGRATION).toContain('v_result := public.legal_set_narrative(v_matter.id, v_md);')
    expect(NARRATIVE_OPS_MIGRATION).toContain('REVOKE EXECUTE ON FUNCTION public.dev_legal_narrative_write(jsonb, boolean) FROM PUBLIC, anon;')
    expect(NARRATIVE_OPS_MIGRATION).not.toContain('CREATE TABLE')
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
    expect(SERVER).toContain("if (isWriteVerb(verb) || verb === 'mint_twin_setup_code' || verb === 'plan_index_backfill' || verb === 'apply_index_backfill' || verb === 'plan_mail_file' || verb === 'apply_mail_file' || verb === 'plan_mail_tag' || verb === 'apply_mail_tag') return finish(refused(")
    expect(SERVER).toContain("/functions/v1/twin-setup`")
    expect(SERVER).toContain("{ action: 'mint', label, ...(twinUserId ? { twin_user_id: twinUserId } : { kind: 'estimator' }) }")
    expect(SERVER).toContain('redeem: `python3 scripts/twin/redeem_setup_code.py ${reply.code}')
    expect(SERVER).not.toContain('reply.token')
  })
})

describe('driveFilingRefusal (v2.6239, target since v2.6241)', () => {
  const SA = 'drive-intake@pipetooling-drive.iam.gserviceaccount.com'
  const PLUMBING = { label: 'plumbing', url: 'https://drive.google.com/drive/folders/1HRAnLDgQ-0__1o4umf59w6zpfW3rFvtB' }
  const TARGET = { name: 'PipeTooling Jobs › Bid plans › Plumbing', url: 'https://drive.google.com/drive/folders/divisionFolderId0000000' }
  const base = { serviceAccount: SA, target: TARGET, division: PLUMBING, folderName: 'ZZ Dev Seat Check 2026-10-31' }
  const BY_HAND = `Until then a person drops the file into a folder named "ZZ Dev Seat Check 2026-10-31" in the plumbing bids folder (${PLUMBING.url}) and presses Find the folder on the bid form.`
  const RETRY = 'The staged copy is still there: call apply_file_plans again with the same plans and plan_hash.'

  it('names the account, where it stopped and the grant for a permission refusal', () => {
    const words = driveFilingRefusal({ ...base, message: 'Folder create failed (403): Insufficient permissions for the specified parent.' })
    expect(words).toContain('Insufficient permissions for the specified parent.')
    expect(words).not.toContain('parent..')
    expect(words).toContain(`The intake service account (${SA}) can see PipeTooling Jobs › Bid plans › Plumbing but cannot write in it.`)
    expect(words).toContain(`A manager of ${TARGET.url} gives ${SA} write access there: Contributor on a Shared Drive, Editor on a My Drive folder.`)
    expect(words).toContain(BY_HAND)
    expect(words).toContain(RETRY)
    expect(words).not.toMatch(/[—–]/)
  })

  it('reads a file-level permission refusal the same way', () => {
    expect(driveFilingRefusal({ ...base, message: 'Upload failed (403): The user does not have sufficient permissions for this file.' })).toContain('cannot write in it')
  })

  it('tests storage quota before permission, the refusal found live on b566 after the share', () => {
    const words = driveFilingRefusal({ ...base, message: 'Upload failed (403): Service Accounts do not have storage quota. Leverage shared drives.' })
    expect(words).toMatch(/^Drive refused the upload: /)
    expect(words).toContain('PipeTooling Jobs › Bid plans › Plumbing is not on a Shared Drive the service account is in')
    expect(words).toContain('DRIVE_IMPERSONATE_USER')
    expect(words).toContain(BY_HAND)
    expect(words).not.toContain('cannot write in it')
  })

  it('says when the account cannot see the folder at all', () => {
    expect(driveFilingRefusal({ ...base, message: 'Folder lookup failed (404): File not found: 0AI1sqwYSeegpUk9PVA.' })).toContain('cannot see PipeTooling Jobs › Bid plans › Plumbing at all')
  })

  it('asks for a wait on a rate limit, with no grant to make', () => {
    const words = driveFilingRefusal({ ...base, message: 'Upload failed (403): User rate limit exceeded.' })
    expect(words).toContain('Wait a minute.')
    expect(words).not.toContain('write access there')
  })

  it('still names the by-hand door and the retry for an error it does not know', () => {
    expect(driveFilingRefusal({ ...base, message: 'Upload failed (500): Backend Error' })).toBe(`Drive refused the filing: Upload failed (500): Backend Error. ${BY_HAND} ${RETRY}`)
  })

  it('points at the key when the account email cannot be read', () => {
    expect(driveFilingRefusal({ ...base, serviceAccount: null, message: 'Folder create failed (403): Insufficient permissions for the specified parent.' })).toContain('the client_email in GOOGLE_SERVICE_ACCOUNT_JSON')
  })

  it('is what apply_file_plans answers when Drive refuses', () => {
    expect(SERVER).toContain('return errored(driveFilingRefusal({ message: e instanceof Error ? e.message : String(e), serviceAccount, target: { name: targetName, url: targetUrl }, division, folderName }))')
    expect(SERVER).not.toContain('The staged copy is still there for a retry.')
  })
})

describe('the plan set goes into the Shared Drive (v2.6241)', () => {
  it('names the path in words, the project folder last', () => {
    expect(robotPlansPathWords('plumbing')).toBe('PipeTooling Jobs › Bid plans › Plumbing')
    expect(robotPlansPathWords('hvac', ' ZZ Dev Seat Check ')).toBe('PipeTooling Jobs › Bid plans › HVAC › ZZ Dev Seat Check')
    expect(robotPlansDivisionFolderName('electrical')).toBe('Electrical')
  })

  it('files into the drive the intake account is a member of, at its root beside Jobs', () => {
    expect(ROBOT_PLANS_SHARED_DRIVE).toEqual({ id: '0ANSfYqm0sENHUk9PVA', name: 'PipeTooling Jobs', folderName: 'Bid plans' })
  })

  it('walks Bid plans › division › project and never writes in the office’s division folder', () => {
    expect(SERVER).toContain('findOrCreateFolder(token, ROBOT_PLANS_SHARED_DRIVE.id, ROBOT_PLANS_SHARED_DRIVE.folderName)')
    expect(SERVER).toContain('findOrCreateFolder(token, bidPlans.id, robotPlansDivisionFolderName(division.key))')
    expect(SERVER).toContain('findOrCreateFolder(token, divisionFolder.id, folderName)')
    expect(SERVER).not.toContain('findOrCreateFolder(token, division.folderId')
    expect(SERVER).toContain('path: robotPlansPathWords(division.key, folderName)')
  })
})

describe('the file index verbs (v2.6332, punch list #240 PR 2)', () => {
  it('are declared as tools, handled in their own case, refused through view_as, and outside the RPC write grammar', () => {
    for (const verb of ['read_file_index_status', 'plan_index_backfill', 'apply_index_backfill']) {
      expect(SERVER).toContain(`name: '${verb}'`)
      expect(SERVER).toContain(`case '${verb}':`)
      expect(isWriteVerb(verb)).toBe(false)
    }
    // The apply writes file_index through the index pass as the service role and never POSTs an RPC: the hash is checked on
    // every call and the one-apply-per-plan hook is not consulted, since an apply runs as often as files remain.
    const start = SERVER.indexOf("case 'plan_index_backfill':")
    const end = SERVER.indexOf("case 'plan_file_plans':")
    const block = SERVER.slice(start, end)
    expect(block).toContain('indexFiles(ctx, listed,')
    expect(block).toContain('backfillCommitment(plan, jobs)')
    expect(block).not.toContain('hooks.priorApply(')
    expect(block).not.toContain('restPost(')
  })
})

describe('the hours statement verbs (v2.6414, punch list #212 PR 5)', () => {
  const JOB = '0e4dcd2b-a524-4056-b93c-16713041a6e7'
  const USER = '11111111-2222-4333-8444-555555555555'
  const snapshot = { input: { kind: 'clock', periodStart: '2026-06-01', periodEnd: '2026-06-13', rows: [], withPay: true, worker: { name: 'Marcus Reyes' } }, worker: { name: 'Marcus Reyes', standing: 'helper' }, job: { number: '1042', name: 'Ridgeway Lofts', customer: null, site: '12 Elm St', isOfficeJob: false }, approvedBy: null, preparedBy: 'Robert Dev', preparedOn: 'November 3, 2026', asOf: '' }
  const make = { action: 'make', job_ledger_id: JOB, user_id: USER, person_id: null, period_start: '2026-06-01', period_end: '2026-06-13', with_pay: true, kind: 'clock', stated_days: [], gap_from: null, gap_to: null, snapshot, send: { how: 'link' } }
  const file = { action: 'file_on_matter', statement_id: USER, matter_id: JOB, title: 'Signed hours statement HS-1042-0001 · Marcus Reyes', shows: 'the line', original_name: 'HS-1042-0001 signed.pdf', mime: 'application/pdf', size_bytes: 5, sha256: 'c'.repeat(64), dated_on: '2026-11-02' }

  it('are on the allowlist over a migration gated is_dev(), closed to anon, that writes the row itself and the matter copy through the live document wrapper', () => {
    expect(WRITE_VERBS.plan_hours_statement).toEqual({ rpc: 'dev_hours_statement_write', step: 'plan' })
    expect(WRITE_VERBS.apply_hours_statement).toEqual({ rpc: 'dev_hours_statement_write', step: 'apply' })
    expect(planVerbFor('apply_hours_statement')).toBe('plan_hours_statement')
    expect(HOURS_MIGRATION.startsWith("SET lock_timeout = '3s';")).toBe(true)
    expect(HOURS_MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.dev_hours_statement_write(p jsonb, p_dry_run boolean DEFAULT true, p_file jsonb DEFAULT NULL)')
    expect(HOURS_MIGRATION).toContain('IF auth.uid() IS NULL OR NOT public.is_dev() THEN')
    expect(HOURS_MIGRATION).toContain('REVOKE EXECUTE ON FUNCTION public.dev_hours_statement_write(jsonb, boolean, jsonb) FROM PUBLIC, anon;')
    expect(HOURS_MIGRATION).toContain('GRANT EXECUTE ON FUNCTION public.dev_hours_statement_write(jsonb, boolean, jsonb) TO authenticated;')
    expect(HOURS_MIGRATION).not.toMatch(/CREATE TABLE/i)
    expect(HOURS_MIGRATION).toContain('INSERT INTO public.hours_statements (job_ledger_id, person_id, user_id, period_start, period_end, with_pay, kind, stated_days, gap_from, gap_to, snapshot, prepared_by, prepared_at, state, record_id)')
    expect(HOURS_MIGRATION).toContain('public.dev_legal_document_write(v_doc, p_dry_run, p_file)')
    expect(HOURS_MIGRATION).not.toContain('FUNCTION public.dev_legal_document_write')
    expect(HOURS_MIGRATION).toContain("v_action NOT IN ('make', 'mark_sent', 'file_on_matter')")
    // The record id as the window mints it: one past the job's highest n, whatever job number the older ids name.
    expect(HOURS_MIGRATION).toContain("regexp_match(record_id, '-(\\d{4,})$')")
  })

  it('make POSTs { p, p_dry_run } with the server-shaped row and its snapshot, the send kept; file_on_matter with the file facts; the shape is checked', () => {
    const plan = writeRpcBody('plan_hours_statement', { statement: make })
    expect(plan).toMatchObject({ ok: true, rpc: 'dev_hours_statement_write', step: 'plan', target: JOB })
    expect(pOf(plan)).toMatchObject({ action: 'make', job_ledger_id: JOB, user_id: USER, person_id: null, period_start: '2026-06-01', with_pay: true, kind: 'clock', stated_days: [], gap_from: null, snapshot, send: { how: 'link' } })
    expect(plan.ok && plan.body.p_dry_run).toBe(true)
    const apply = writeRpcBody('apply_hours_statement', { statement: file, plan_hash: HASH })
    expect(apply).toMatchObject({ ok: true, step: 'apply', target: JOB, planHash: HASH })
    expect(pOf(apply)).toEqual({ action: 'file_on_matter', statement_id: USER, matter_id: JOB, title: 'Signed hours statement HS-1042-0001 · Marcus Reyes', shows: 'the line', original_name: 'HS-1042-0001 signed.pdf', mime: 'application/pdf', size_bytes: 5, sha256: 'c'.repeat(64), dated_on: '2026-11-02' })
    expect(apply.ok && apply.body.p_dry_run).toBe(false)
    expect(apply.ok && apply.dryRunBody?.p_dry_run).toBe(true)
    expect(writeRpcBody('apply_hours_statement', { statement: make })).toMatchObject({ ok: false, error: expect.stringContaining('needs plan_hash') })
    expect(writeRpcBody('plan_hours_statement', { statement: { ...make, kind: 'punch' } })).toMatchObject({ ok: false, error: expect.stringContaining('the server shapes it') })
    expect(writeRpcBody('plan_hours_statement', { statement: { ...make, snapshot: null } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_hours_statement', { statement: { ...file, sha256: 'short' } })).toMatchObject({ ok: false, error: expect.stringContaining("signed PDF's facts") })
    expect(writeRpcBody('plan_hours_statement', { statement: { action: 'mark_sent', statement_id: USER } })).toMatchObject({ ok: false })
  })

  it('the plan reply points at apply_hours_statement, a repeat apply says the statement is under the job, and the server declares the three verbs at 0.20.0', () => {
    const reply = planReply('plan_hours_statement', { dry_run: true, record_id: 'HS-1042-0001' }, HASH) as { next: string; record_id: string }
    expect(reply.next).toContain('call apply_hours_statement')
    expect(reply.record_id).toBe('HS-1042-0001')
    expect(alreadyApplied('apply_hours_statement', { target: JOB, at: '2026-11-03T01:00:00Z' })).toBe('Nothing written: this plan was already applied on this job at 2026-11-03T01:00:00Z. The statement is under the job’s Hours statements (read_rows on hours_statements by job_ledger_id); plan another span, or file_on_matter once it is signed.')
    for (const verb of ['get_hours_statement', 'plan_hours_statement', 'apply_hours_statement']) {
      expect(SERVER).toContain(`name: '${verb}'`)
      expect(SERVER).toContain(`case '${verb}':`)
    }
    expect(SERVER).toContain("const SERVER_VERSION = '0.54.0'")
    expect(SERVER).toContain('plan_hours_statement → apply_hours_statement')
    expect(SERVER).toContain('sixty-seven verbs')
  })
})

describe('the clock session verbs (v2.6437)', () => {
  const SESSION = '0e4dcd2b-a524-4056-b93c-16713041a6e7'
  const JOB = '11111111-2222-4333-8444-555555555555'
  const ops = [
    { op: 'times', session_id: SESSION, start: '2026-03-10T08:00:00-06:00', end: '2026-03-10T16:30:00-06:00' },
    { op: 'note', session_id: SESSION, note: ' trench, north wall ' },
    { op: 'move', session_id: SESSION, job_id: JOB },
    { op: 'approve', session_id: SESSION },
  ]
  const sessions = { reason: 'the day was punched on the wrong job', ops }

  it('are on the allowlist, plan before apply, and POST { p, p_dry_run } with the ops as the door takes them', () => {
    expect(isWriteVerb('plan_clock_sessions')).toBe(true)
    expect(isWriteVerb('apply_clock_sessions')).toBe(true)
    expect(WRITE_VERBS.plan_clock_sessions).toEqual({ rpc: 'dev_clock_session_write', step: 'plan' })
    expect(WRITE_VERBS.apply_clock_sessions).toEqual({ rpc: 'dev_clock_session_write', step: 'apply' })
    expect(planVerbFor('apply_clock_sessions')).toBe('plan_clock_sessions')
    const plan = writeRpcBody('plan_clock_sessions', { sessions })
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.rpc).toBe('dev_clock_session_write')
    expect(plan.body.p_dry_run).toBe(true)
    expect(plan.target).toBe('4 clock session ops')
    const p = pOf(plan)
    expect(p.reason).toBe('the day was punched on the wrong job')
    expect(p.ops).toEqual([
      { op: 'times', session_id: SESSION, start: '2026-03-10T08:00:00-06:00', end: '2026-03-10T16:30:00-06:00' },
      { op: 'note', session_id: SESSION, note: ' trench, north wall ' },
      { op: 'move', session_id: SESSION, job_id: JOB },
      { op: 'approve', session_id: SESSION },
    ])
    const apply = writeRpcBody('apply_clock_sessions', { sessions, plan_hash: HASH })
    expect(apply.ok).toBe(true)
    if (!apply.ok) return
    expect(apply.body.p_dry_run).toBe(false)
    expect(apply.dryRunBody).toEqual({ p, p_dry_run: true })
    expect(apply.planHash).toBe(HASH)
    const noHash = writeRpcBody('apply_clock_sessions', { sessions })
    expect(noHash.ok).toBe(false)
    if (!noHash.ok) expect(noHash.error).toContain('plan_clock_sessions')
  })

  it('refuses in words a missing reason, an unknown op, an end before its start, a day over 24 hours, a bad id and more than 50 ops', () => {
    const bad = (input: Record<string, unknown>) => {
      const r = writeRpcBody('plan_clock_sessions', { sessions: input })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toContain('plan_clock_sessions needs sessions')
    }
    bad({ ops })
    bad({ reason: 'why', ops: [] })
    bad({ reason: 'why', ops: [{ op: 'split', session_id: SESSION }] })
    bad({ reason: 'why', ops: [{ op: 'times', session_id: SESSION, start: '2026-03-10T16:00:00-06:00', end: '2026-03-10T08:00:00-06:00' }] })
    bad({ reason: 'why', ops: [{ op: 'times', session_id: SESSION, start: '2026-03-10T08:00:00-06:00', end: '2026-03-11T09:00:00-06:00' }] })
    bad({ reason: 'why', ops: [{ op: 'times', session_id: SESSION, start: 'yesterday', end: 'today' }] })
    bad({ reason: 'why', ops: [{ op: 'move', session_id: SESSION, job_id: 'J1042' }] })
    bad({ reason: 'why', ops: [{ op: 'note', session_id: 'not-a-uuid', note: 'x' }] })
    bad({ reason: 'why', ops: [{ op: 'note', session_id: SESSION, note: 'x'.repeat(2001) }] })
    bad({ reason: 'why', ops: Array.from({ length: 51 }, () => ({ op: 'approve', session_id: SESSION })) })
  })

  it('the migration creates the door gated is_dev(), closed to anon, pasting the two live RPCs whole with one line each; the plan reply points at apply_clock_sessions; a repeat apply says the sessions already read that way', async () => {
    expect(CLOCK_MIGRATION.startsWith("SET lock_timeout = '3s';")).toBe(true)
    expect(CLOCK_MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.dev_clock_session_write(p jsonb, p_dry_run boolean DEFAULT true)')
    expect(CLOCK_MIGRATION).toContain('IF auth.uid() IS NULL OR NOT public.is_dev() THEN')
    expect(CLOCK_MIGRATION).toContain("RAISE EXCEPTION USING ERRCODE = 'P0DRY', MESSAGE = 'dry run';")
    expect(CLOCK_MIGRATION).toContain('REVOKE ALL ON FUNCTION public.dev_clock_session_write(jsonb, boolean) FROM anon;')
    expect(CLOCK_MIGRATION).toContain('GRANT EXECUTE ON FUNCTION public.dev_clock_session_write(jsonb, boolean) TO authenticated;')
    expect(CLOCK_MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.approve_clock_sessions(p_session_ids uuid[])')
    expect(CLOCK_MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.recompute_people_hours_after_session_edit(p_session_id uuid, p_old_work_date date DEFAULT NULL::date)')
    expect(CLOCK_MIGRATION).toContain('OR public.is_dev();')
    expect(CLOCK_MIGRATION).toContain('or public.is_dev()')
    expect(CLOCK_MIGRATION).toContain('PERFORM public.recompute_people_hours_after_session_edit(v_sid, v_old_date);')
    expect(CLOCK_MIGRATION).toContain('SELECT * INTO v_appr FROM public.approve_clock_sessions_v2(ARRAY[v_sid]);')
    expect(CLOCK_MIGRATION).not.toMatch(/CREATE TABLE/i) // no table → no read-only fence appliers owed
    for (const verb of ['plan_clock_sessions', 'apply_clock_sessions']) {
      expect(SERVER).toContain(`name: '${verb}'`)
      expect(SERVER).toContain(`case '${verb}':`)
    }
    expect(SERVER).toContain("const SERVER_VERSION = '0.54.0'")
    const reply = { dry_run: true, applied: 1, held: 0, refused: 0, ops: [{ seq: 1, op: 'note', outcome: 'applied' }] }
    const hash = await planHash('plan_clock_sessions', { reason: 'why', ops: [ops[1]] }, reply)
    expect(planReply('plan_clock_sessions', reply, hash).next).toContain('apply_clock_sessions')
    expect(planCommitment('plan_clock_sessions', reply)).toEqual({ applied: 1, held: 0, refused: 0, ops: [{ seq: 1, op: 'note', outcome: 'applied' }] })
    expect(alreadyApplied('apply_clock_sessions', { target: '1 clock session op', at: '2026-11-03T05:00:00Z' })).toContain('on those sessions at 2026-11-03T05:00:00Z')
    expect(alreadyApplied('apply_clock_sessions', { target: null, at: null })).toContain('read_rows on clock_sessions')
    expect(planMismatch('apply_clock_sessions', 'a'.repeat(64), 'b'.repeat(64))).toContain('plan_clock_sessions')
  })

  it('an approve plan hashes the same on two runs seconds apart, since the after image\'s approval stamp is left out (v2.6524); a session whose times or job moved hashes differently', async () => {
    const image = (over: Record<string, unknown>) => ({ job: { id: JOB, number: '1042', name: 'Ridgeway Lofts' }, hours: 8, notes: 'a day', bid_id: null, origin: 'imported', work_date: '2026-03-10', approved_at: null, clocked_in_at: '2026-03-10T14:00:00+00:00', clocked_out_at: '2026-03-10T22:00:00+00:00', ...over })
    const run = (stamp: string, before: Record<string, unknown> = {}) => ({
      dry_run: true, reason: 'why', by: 'Robert', applied: 1, held: 0, refused: 0,
      ops: [{ seq: 1, op: 'approve', session_id: SESSION, person: 'Marcus', outcome: 'applied', words: 'approved', before: image(before), after: image({ approved_at: stamp }) }],
    })
    const p = { reason: 'why', ops: [{ op: 'approve', session_id: SESSION }] }
    const first = await planHash('plan_clock_sessions', p, run('2026-11-05T01:13:45.954878+00:00'))
    expect(first).toBe(await planHash('apply_clock_sessions', p, run('2026-11-05T01:15:02.118204+00:00')))
    const { approved_at: _stamp, ...afterNoStamp } = image({})
    expect(planCommitment('plan_clock_sessions', run('2026-11-05T01:13:45.954878+00:00'))).toMatchObject({ applied: 1, ops: [{ op: 'approve', before: image({}), after: afterNoStamp }] })
    expect((planCommitment('plan_clock_sessions', run('x')) as { ops: Array<{ after: Record<string, unknown> }> }).ops[0]!.after).not.toHaveProperty('approved_at')
    // The world moved: a different end, a different job, or the session already approved, and the plan no longer matches.
    expect(first).not.toBe(await planHash('plan_clock_sessions', p, run('x', { clocked_out_at: '2026-03-10T23:00:00+00:00' })))
    expect(first).not.toBe(await planHash('plan_clock_sessions', p, run('x', { job: { id: SESSION, number: '7', name: 'Other' } })))
    expect(first).not.toBe(await planHash('plan_clock_sessions', p, run('x', { approved_at: '2026-11-04T00:00:00+00:00' })))
    // A refused op carries no after image and still hashes.
    const refused = { ...run('x'), applied: 0, refused: 1, ops: [{ seq: 1, op: 'approve', session_id: SESSION, person: 'Marcus', outcome: 'refused', words: 'the session is already approved', before: image({}), after: null }] }
    expect(planCommitment('plan_clock_sessions', refused)).toMatchObject({ refused: 1, ops: [{ outcome: 'refused', after: null }] })
    expect(clockOpCommitment('not an op')).toBe('not an op')
  })
})

describe('the license verbs (punch list #255)', () => {
  const LICENSE = '7b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d'
  it('are on the allowlist, plan before apply, and write the words the logbook way', () => {
    expect(isWriteVerb('plan_license')).toBe(true)
    expect(planVerbFor('apply_license')).toBe('plan_license')
    expect(WRITE_VERBS.plan_license.rpc).toBe('dev_person_license_write')
    const add = writeRpcBody('plan_license', { license: { person_name: ' Tristen ', trade: 'plumbing', level: 'apprentice', number: '#191717', expires: '2027-08-31', note: 'TSBPE search 2026-11-03' } })
    expect(add).toMatchObject({
      ok: true,
      rpc: 'dev_person_license_write',
      step: 'plan',
      target: 'Tristen',
      body: { p: { action: 'add', person_name: 'Tristen', license_type: 'Plumber Apprentice #191717', date_of_expiry: '2027-08-31', note: 'TSBPE search 2026-11-03' }, p_dry_run: true },
    })
    const update = writeRpcBody('apply_license', { license: { license_id: LICENSE, trade: 'hvac', level: 'contractor', number: 'TACLA39079E', expires: '2027-06-13' }, plan_hash: 'e'.repeat(64) })
    expect(update).toMatchObject({ ok: true, step: 'apply', target: LICENSE, body: { p: { action: 'update', license_id: LICENSE, license_type: 'AC Contractor #TACLA39079E', date_of_expiry: '2027-06-13' }, p_dry_run: false }, dryRunBody: { p_dry_run: true } })
    expect(writeRpcBody('plan_license', { license: { person_name: 'Paige', trade: 'other', other_name: 'Notary', number: '135545090', expires: '2030-01-07' } })).toMatchObject({ ok: true, body: { p: { license_type: 'Notary #135545090' } } })
  })
  it('refuses a license it cannot write the logbook way, in words with the shape', () => {
    expect(writeRpcBody('plan_license', {})).toMatchObject({ ok: false, error: expect.stringContaining('needs license') })
    expect(writeRpcBody('plan_license', { license: { person_name: 'Tristen', trade: 'gas', level: 'apprentice', number: '1', expires: '2027-01-01' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_license', { license: { person_name: 'Tristen', trade: 'hvac', level: 'journeyman', number: '1', expires: '2027-01-01' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_license', { license: { person_name: 'Tristen', trade: 'plumbing', level: 'apprentice', number: ' ', expires: '2027-01-01' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_license', { license: { person_name: 'Tristen', trade: 'plumbing', level: 'apprentice', number: '1', expires: '08/31/2027' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_license', { license: { trade: 'plumbing', level: 'apprentice', number: '1', expires: '2027-01-01' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_license', { license: { license_id: 'the plumbing one', trade: 'plumbing', level: 'apprentice', number: '1', expires: '2027-01-01' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('apply_license', { license: { person_name: 'Tristen', trade: 'plumbing', level: 'apprentice', number: '1', expires: '2027-01-01' } })).toMatchObject({ ok: false, error: expect.stringContaining('plan_hash') })
  })
  it('says what a replay means for a license, and the server carries the three tools', () => {
    expect(alreadyApplied('apply_license', { target: LICENSE, at: null })).toContain('on this license')
    expect(SERVER).toContain("name: 'plan_license'")
    expect(SERVER).toContain("name: 'apply_license'")
    expect(SERVER).toContain("name: 'check_license'")
    expect(SERVER).toContain("case 'plan_license':")
    expect(SERVER).toContain("case 'check_license':")
  })
})

describe("the person document verbs (v2.6608)", () => {
  const PERSON = 'a1b2c3d4-0000-4000-8000-000000000091'
  it('are on the allowlist, plan before apply, and POST { p, p_dry_run } to dev_person_doc_write with the whole text or the ops', () => {
    expect(isWriteVerb('plan_person_doc')).toBe(true)
    expect(planVerbFor('apply_person_doc')).toBe('plan_person_doc')
    expect(WRITE_VERBS.plan_person_doc.rpc).toBe('dev_person_doc_write')
    const text = '## Trajectory\n\nSteady.'
    expect(writeRpcBody('plan_person_doc', { doc: { person_id: PERSON, kind: 'summary', markdown: text } })).toEqual({
      ok: true, rpc: 'dev_person_doc_write', step: 'plan',
      body: { p: { person_id: PERSON, kind: 'summary', markdown: text }, p_dry_run: true },
      dryRunBody: { p: { person_id: PERSON, kind: 'summary', markdown: text }, p_dry_run: true },
      target: PERSON, planHash: null,
    })
    const ops = [{ op: 'replace_section', heading: 'Pay', markdown: 'Paid weekly.' }, { op: 'append', markdown: '## Watch items\n\nNone.' }]
    expect(writeRpcBody('apply_person_doc', { doc: { person_id: PERSON, kind: 'narrative', ops, expect_updated_at: '2026-11-06T22:00:00Z' }, plan_hash: 'b'.repeat(64) })).toMatchObject({
      ok: true, step: 'apply', target: PERSON, planHash: 'b'.repeat(64),
      body: { p: { person_id: PERSON, kind: 'narrative', ops, expect_updated_at: '2026-11-06T22:00:00Z' }, p_dry_run: false },
    })
  })

  it('refuses a missing plan_hash, a bad person, a kind outside summary | narrative, both or neither of markdown and ops, and more than 20 ops', () => {
    expect(writeRpcBody('apply_person_doc', { doc: { person_id: PERSON, kind: 'summary', markdown: 'x' } })).toMatchObject({ ok: false, error: expect.stringContaining('plan_hash') })
    expect(writeRpcBody('plan_person_doc', { doc: { person_id: 'nope', kind: 'summary', markdown: 'x' } })).toMatchObject({ ok: false, error: expect.stringContaining('person_id') })
    expect(writeRpcBody('plan_person_doc', { doc: { person_id: PERSON, kind: 'history', markdown: 'x' } })).toMatchObject({ ok: false, error: expect.stringContaining('summary | narrative') })
    expect(writeRpcBody('plan_person_doc', { doc: { person_id: PERSON, kind: 'summary', markdown: 'x', ops: [{ op: 'append', markdown: 'y' }] } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_person_doc', { doc: { person_id: PERSON, kind: 'summary' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_person_doc', { doc: { person_id: PERSON, kind: 'summary', ops: [] } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_person_doc', { doc: { person_id: PERSON, kind: 'summary', ops: Array.from({ length: 21 }, () => ({ op: 'append', markdown: 'x' })) } })).toMatchObject({ ok: false })
  })

  it('v2.6713: evidence_id ties a named document to the record it transcribes — alone with doc_id, null to untie, never on the fixed two', () => {
    const docId = '22222222-3333-4444-8555-666666666666'
    const recordId = '33333333-4444-4555-8666-777777777777'
    expect(writeRpcBody('plan_person_doc', { doc: { person_id: PERSON, doc_id: docId, evidence_id: recordId } })).toMatchObject({
      ok: true, target: docId, body: { p: { person_id: PERSON, doc_id: docId, evidence_id: recordId }, p_dry_run: true },
    })
    expect(writeRpcBody('plan_person_doc', { doc: { person_id: PERSON, doc_id: docId, evidence_id: null } })).toMatchObject({ ok: true, body: { p: { person_id: PERSON, doc_id: docId, evidence_id: null } } })
    expect(writeRpcBody('plan_person_doc', { doc: { person_id: PERSON, title: 'Transcript of the call', markdown: '## The call', evidence_id: recordId, counsel_only: true } })).toMatchObject({
      ok: true, body: { p: { person_id: PERSON, title: 'Transcript of the call', markdown: '## The call', counsel_only: true, evidence_id: recordId } },
    })
    expect(writeRpcBody('plan_person_doc', { doc: { person_id: PERSON, kind: 'narrative', markdown: 'x', evidence_id: recordId } })).toMatchObject({ ok: false, error: expect.stringContaining('evidence_id') })
    expect(writeRpcBody('plan_person_doc', { doc: { person_id: PERSON, doc_id: docId, evidence_id: 'not-a-uuid' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_person_doc', { doc: { person_id: PERSON, title: 'New', evidence_id: recordId } })).toMatchObject({ ok: false })
  })

  it('the plan reply points at apply_person_doc, and a repeat apply says the document already reads that way', () => {
    expect(String(planReply('plan_person_doc', { person: { id: PERSON } }, 'a'.repeat(64)).next)).toContain('apply_person_doc')
    expect(alreadyApplied('apply_person_doc', { target: PERSON, at: '2026-11-06T22:00:00Z' })).toContain('already reads that way')
  })

  it('the migration: devs only, one of markdown or ops, the three ops against the headings, the updated_at guard, the no-change refusal and the upsert the archive trigger watches', () => {
    expect(DOC_MIGRATION).toMatch(/^SET lock_timeout = '3s';/)
    expect(DOC_MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.hr_doc_headings(md text)')
    expect(DOC_MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.dev_person_doc_write(p jsonb, p_dry_run boolean DEFAULT true)')
    expect(DOC_MIGRATION).toContain('IF auth.uid() IS NULL OR NOT public.is_dev() THEN')
    expect(DOC_MIGRATION).toContain("IF (p ? 'markdown') = (p ? 'ops') THEN")
    expect(DOC_MIGRATION).toContain("IF v_opname NOT IN ('replace_section', 'insert_after', 'append') THEN")
    expect(DOC_MIGRATION).toContain('IF abs(extract(epoch FROM (v_row.updated_at - v_expect))) > 0.001 THEN')
    expect(DOC_MIGRATION).toContain('IF v_after = v_before THEN')
    expect(DOC_MIGRATION).toContain('ON CONFLICT (person_id, kind) DO UPDATE')
    expect(DOC_MIGRATION).toContain('REVOKE EXECUTE ON FUNCTION public.dev_person_doc_write(jsonb, boolean) FROM PUBLIC, anon;')
    expect(DOC_MIGRATION).not.toContain('CREATE TABLE')
  })
})

describe('named documents on the HR file (v2.6613, punch list #277)', () => {
  const PERSON = 'a1b2c3d4-0000-4000-8000-000000000091'
  const DOC = 'd1d2c3d4-0000-4000-8000-000000000012'
  it('a named document by doc_id, with ops, the mark or the archive alone; a new one by title with its text and mark', () => {
    const ops = [{ op: 'replace_section', heading: 'The training course', markdown: 'Rebooked for the autumn.' }]
    expect(writeRpcBody('plan_person_doc', { doc: { person_id: PERSON, doc_id: DOC, ops, expect_updated_at: '2026-11-07T20:00:00Z' } })).toMatchObject({
      ok: true, target: DOC, body: { p: { person_id: PERSON, doc_id: DOC, ops, expect_updated_at: '2026-11-07T20:00:00Z' }, p_dry_run: true },
    })
    expect(writeRpcBody('plan_person_doc', { doc: { person_id: PERSON, doc_id: DOC, counsel_only: true } })).toMatchObject({ ok: true, body: { p: { person_id: PERSON, doc_id: DOC, counsel_only: true } } })
    expect(writeRpcBody('plan_person_doc', { doc: { person_id: PERSON, doc_id: DOC, archive: true } })).toMatchObject({ ok: true, body: { p: { person_id: PERSON, doc_id: DOC, archive: true } } })
    expect(writeRpcBody('plan_person_doc', { doc: { person_id: PERSON, title: ' Interview guide ', markdown: '## Before the call', counsel_only: true } })).toMatchObject({
      ok: true, target: PERSON, body: { p: { person_id: PERSON, title: 'Interview guide', markdown: '## Before the call', counsel_only: true } } })
  })

  it('refuses two targets or none, a bad doc_id, a title over 160, a new title with no text or with archive, and the mark or archive on the fixed two', () => {
    expect(writeRpcBody('plan_person_doc', { doc: { person_id: PERSON, kind: 'summary', doc_id: DOC, markdown: 'x' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_person_doc', { doc: { person_id: PERSON, markdown: 'x' } })).toMatchObject({ ok: false, error: expect.stringContaining('one target') })
    expect(writeRpcBody('plan_person_doc', { doc: { person_id: PERSON, doc_id: 'nope', markdown: 'x' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_person_doc', { doc: { person_id: PERSON, title: 't'.repeat(161), markdown: 'x' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_person_doc', { doc: { person_id: PERSON, title: 'New' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_person_doc', { doc: { person_id: PERSON, title: 'New', markdown: 'x', archive: true } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_person_doc', { doc: { person_id: PERSON, kind: 'summary', markdown: 'x', counsel_only: true } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_person_doc', { doc: { person_id: PERSON, doc_id: DOC } })).toMatchObject({ ok: false })
  })

  it('the migration: the two tables with their trigger and dev-only policies, the index view, the function taking doc_id or title, and the four fences', () => {
    expect(NAMED_DOCS_MIGRATION).toMatch(/^SET lock_timeout = '3s';/)
    expect(NAMED_DOCS_MIGRATION).toContain('CREATE TABLE IF NOT EXISTS public.person_documents (')
    expect(NAMED_DOCS_MIGRATION).toContain('CREATE TABLE IF NOT EXISTS public.person_document_revisions (')
    expect(NAMED_DOCS_MIGRATION).toContain('CREATE TRIGGER person_documents_archive_revision')
    expect(NAMED_DOCS_MIGRATION).toContain('ALTER TABLE public.person_documents ENABLE ROW LEVEL SECURITY;')
    expect(NAMED_DOCS_MIGRATION).toContain('ALTER TABLE public.person_document_revisions ENABLE ROW LEVEL SECURITY;')
    expect(NAMED_DOCS_MIGRATION).toContain('FOR SELECT USING (public.is_dev());')
    expect(NAMED_DOCS_MIGRATION).not.toMatch(/FOR DELETE/)
    expect(NAMED_DOCS_MIGRATION).toContain('CREATE OR REPLACE VIEW public.person_document_index\nWITH (security_invoker = true) AS')
    expect(NAMED_DOCS_MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.dev_person_doc_write(p jsonb, p_dry_run boolean DEFAULT true)')
    expect(NAMED_DOCS_MIGRATION).toContain("name the target — kind (summary | narrative), doc_id (a named document) or title (a new named document), one of the three")
    expect(NAMED_DOCS_MIGRATION).toContain("IF NOT v_named AND (v_archive IS NOT NULL OR v_counsel IS NOT NULL) THEN")
    expect(NAMED_DOCS_MIGRATION).toContain('REVOKE EXECUTE ON FUNCTION public.dev_person_doc_write(jsonb, boolean) FROM PUBLIC, anon;')
    for (const fence of ['apply_read_only_write_blocks', 'apply_read_only_stmt_blocks', 'apply_digital_twin_write_blocks', 'apply_archived_read_blocks']) expect(NAMED_DOCS_MIGRATION).toContain(`SELECT public.${fence}();`)
  })
})
