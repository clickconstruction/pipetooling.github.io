import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  COLLECTIONS_RPC,
  CONTRACT_ENDED_HOWS,
  JOB_MARK_VERBS,
  MARK_JOB_COLS,
  PAYMENT_BONDS,
  collectionsRpcBody,
  contractEndedPatch,
  isJobMarkVerb,
  jobMarkAppliedWords,
  jobMarkDryRun,
  jobMarkInput,
  readMarkJob,
  type JobMarkPayload,
  type MarkJobRow,
} from '../../../supabase/functions/_shared/devMcpJobMarks'
import { WRITE_VERBS, alreadyApplied, isWriteVerb, planHash, planReply, planVerbFor, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { LIEN_CONTRACT_ENDED_HOW } from '../jobs/lienDeskRetainage'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const FLAG_CLIENT = readFileSync('src/lib/setJobCollectionsFlag.ts', 'utf8')
const LIEN_ROW = readFileSync('src/components/jobs/JobFormLienContractRow.tsx', 'utf8')
const RETAINAGE_MIGRATION = readFileSync('supabase/migrations/20260923200000_lien_retainage_notice.sql', 'utf8')
const FLAG_MIGRATION = readFileSync('supabase/migrations/20261007170000_job_uncollectible.sql', 'utf8')

const JOB = '99999999-1111-4111-8111-111111111111'
const DEV = 'ffffffff-1111-4111-8111-111111111111'
const HASH = 'a'.repeat(64)
const row = (over: Partial<MarkJobRow> = {}): MarkJobRow => ({
  id: JOB, job_name: 'ZZ TEST seat walk', click_number: '', hcp_number: '', status: 'billed', updated_at: '2026-11-09T15:00:00+00:00',
  collections_at: null, collections_by: null, collections_note: null, uncollectible_at: null,
  lien_contract_ended_on: null, lien_contract_ended_how: null, lien_contract_ended_set_at: null, lien_contract_ended_set_by: null, lien_retainage_held: null, lien_payment_bond: 'unknown', last_work_date: '2026-10-20',
  ...over,
})
const flag = (over: Record<string, unknown> = {}): JobMarkPayload => {
  const built = jobMarkInput('plan_collections_flag', { flag: { job_id: JOB, flagged: true, note: 'no answer in 60 days', ...over } })
  if (!built.ok) throw new Error(built.error)
  return built.p
}
const ended = (over: Record<string, unknown> = {}): JobMarkPayload => {
  const built = jobMarkInput('plan_contract_ended', { contract: { job_id: JOB, ended_on: '2026-10-22', how: 'terminated', ...over } })
  if (!built.ok) throw new Error(built.error)
  return built.p
}

describe('devMcpJobMarks — the verbs on the allowlist', () => {
  it('are four write verbs with no RPC in the table, plan before apply, named by the server and the README', () => {
    expect(JOB_MARK_VERBS).toEqual(['plan_collections_flag', 'apply_collections_flag', 'plan_contract_ended', 'apply_contract_ended'])
    for (const v of JOB_MARK_VERBS) {
      expect(isJobMarkVerb(v)).toBe(true)
      expect(isWriteVerb(v)).toBe(true)
      expect(WRITE_VERBS[v].rpc).toBeNull()
      expect(SERVER).toContain(`case '${v}':`)
      expect(SERVER).toContain(`name: '${v}',`)
    }
    expect(planVerbFor('apply_collections_flag')).toBe('plan_collections_flag')
    expect(planVerbFor('apply_contract_ended')).toBe('plan_contract_ended')
    expect(SERVER).toContain('Writes are one hundred and nine verbs and nothing else:')
    expect(README).toContain('`plan_collections_flag(flag)` · `apply_collections_flag(flag, plan_hash)`')
    expect(README).toContain('`plan_contract_ended(contract)` · `apply_contract_ended(contract, plan_hash)`')
  })
  it('holds the hows and the bond to the table’s CHECKs and the Lien desk’s list, and the flag to the Job window’s RPC', () => {
    expect([...CONTRACT_ENDED_HOWS]).toEqual(LIEN_CONTRACT_ENDED_HOW.map((h) => h.key))
    expect(RETAINAGE_MIGRATION).toContain("CHECK (lien_contract_ended_how IS NULL OR lien_contract_ended_how IN ('complete', 'terminated', 'abandoned'))")
    expect(RETAINAGE_MIGRATION).toContain("CHECK (lien_payment_bond IN ('yes', 'no', 'unknown'))")
    expect([...PAYMENT_BONDS]).toEqual(['yes', 'no', 'unknown'])
    expect(COLLECTIONS_RPC).toBe('set_job_collections_flag')
    expect(FLAG_CLIENT).toContain("supabase.rpc('set_job_collections_flag', {")
    expect(FLAG_MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.set_job_collections_flag(p_job_id uuid, p_flagged boolean, p_note text DEFAULT NULL::text)')
    expect(FLAG_MIGRATION).toContain("IF v_status <> 'billed' THEN")
    expect(SERVER).toContain('await restPost(session, `rpc/${COLLECTIONS_RPC}`, collectionsRpcBody(p))')
    expect(SERVER).toContain("await restRows(session, 'PATCH', 'jobs_ledger', `id=eq.${p.job_id}`, patch)")
  })
})

describe('jobMarkInput — the shape', () => {
  it('the flag: the job, true or false, a note with true only', () => {
    expect(flag()).toEqual({ action: 'collections_flag', job_id: JOB, flagged: true, note: 'no answer in 60 days' })
    expect(flag({ flagged: false, note: undefined })).toEqual({ action: 'collections_flag', job_id: JOB, flagged: false })
    expect(jobMarkInput('plan_collections_flag', { flag: { job_id: JOB } })).toMatchObject({ ok: false, error: expect.stringContaining('flagged is true or false') })
    expect(jobMarkInput('plan_collections_flag', { flag: { job_id: JOB, flagged: 'yes' } })).toMatchObject({ ok: false })
    expect(jobMarkInput('plan_collections_flag', { flag: { job_id: JOB, flagged: false, note: 'x' } })).toMatchObject({ ok: false, error: expect.stringContaining('a note goes with flagged: true') })
    expect(jobMarkInput('plan_collections_flag', { flag: { job_id: 'JP891', flagged: true } })).toMatchObject({ ok: false, error: expect.stringContaining('find_job') })
    expect(jobMarkInput('plan_collections_flag', {})).toMatchObject({ ok: false, error: expect.stringContaining('plan_collections_flag needs flag') })
    expect(jobMarkInput('apply_collections_flag', { flag: { job_id: JOB, flagged: true } })).toMatchObject({ ok: false, error: expect.stringContaining('plan_hash') })
    expect(writeRpcBody('apply_collections_flag', { flag: { job_id: JOB, flagged: true }, plan_hash: HASH })).toMatchObject({ ok: true, rpc: null, step: 'apply', planHash: HASH, target: JOB })
  })
  it('the contract: the day and the how, the retainage as dollars, the bond; or clear', () => {
    expect(ended()).toEqual({ action: 'contract_ended', job_id: JOB, ended_on: '2026-10-22', how: 'terminated' })
    expect(ended({ how: 'Abandoned', retainage_held: '$1,678.04', payment_bond: 'unknown' })).toMatchObject({ how: 'abandoned', retainage_held: 1678.04, payment_bond: 'unknown' })
    expect(ended({ retainage_held: 0 })).toMatchObject({ retainage_held: 0 })
    expect(jobMarkInput('plan_contract_ended', { contract: { job_id: JOB, clear: true } })).toMatchObject({ ok: true, p: { action: 'contract_ended', job_id: JOB, clear: true } })
    expect(jobMarkInput('plan_contract_ended', { contract: { job_id: JOB, how: 'terminated' } })).toMatchObject({ ok: false, error: expect.stringContaining('ended_on') })
    expect(jobMarkInput('plan_contract_ended', { contract: { job_id: JOB, ended_on: '2026-10-22', how: 'quit' } })).toMatchObject({ ok: false, error: expect.stringContaining('complete, terminated or abandoned') })
    expect(jobMarkInput('plan_contract_ended', { contract: { job_id: JOB, ended_on: '2026-10-22', how: 'complete', retainage_held: -1 } })).toMatchObject({ ok: false, error: expect.stringContaining('retainage_held') })
    expect(jobMarkInput('plan_contract_ended', { contract: { job_id: JOB, ended_on: '2026-10-22', how: 'complete', payment_bond: 'maybe' } })).toMatchObject({ ok: false, error: expect.stringContaining('payment_bond') })
    expect(jobMarkInput('apply_contract_ended', { contract: { job_id: JOB, clear: true }, plan_hash: HASH })).toMatchObject({ ok: true, planHash: HASH })
  })
})

describe('the read, the RPC body and the patch', () => {
  it('reads the job with the mark columns', async () => {
    const seen: string[] = []
    const job = await readMarkJob({ rows: async (table, query) => { seen.push(`${table}?${query}`); return [row()] } }, JOB)
    expect(seen).toEqual([`jobs_ledger?select=${MARK_JOB_COLS}&id=eq.${JOB}`])
    expect(job?.id).toBe(JOB)
  })
  it('the RPC body is setJobCollectionsFlag’s: the note only when given', () => {
    expect(collectionsRpcBody(flag() as Extract<JobMarkPayload, { action: 'collections_flag' }>)).toEqual({ p_job_id: JOB, p_flagged: true, p_note: 'no answer in 60 days' })
    expect(collectionsRpcBody(flag({ flagged: false, note: undefined }) as Extract<JobMarkPayload, { action: 'collections_flag' }>)).toEqual({ p_job_id: JOB, p_flagged: false })
  })
  it('the patch is the Lien contract row’s save, with the caller stamped; clear nulls the four ended columns as the row does', () => {
    const now = '2026-11-09T16:00:00.000Z'
    expect(contractEndedPatch(ended({ retainage_held: 1678.04, payment_bond: 'no' }) as Extract<JobMarkPayload, { action: 'contract_ended' }>, { userId: DEV }, now)).toEqual({ lien_contract_ended_on: '2026-10-22', lien_contract_ended_how: 'terminated', lien_contract_ended_set_at: now, lien_contract_ended_set_by: DEV, lien_retainage_held: 1678.04, lien_payment_bond: 'no' })
    expect(contractEndedPatch(ended() as Extract<JobMarkPayload, { action: 'contract_ended' }>, { userId: DEV }, now)).not.toHaveProperty('lien_retainage_held')
    const clear = contractEndedPatch({ action: 'contract_ended', job_id: JOB, clear: true }, { userId: DEV }, now)
    expect(clear).toEqual({ lien_contract_ended_on: null, lien_contract_ended_how: null, lien_contract_ended_set_by: null, lien_contract_ended_set_at: null })
    expect(LIEN_ROW).toContain('save({ lien_contract_ended_on: null, lien_contract_ended_how: null, lien_contract_ended_set_by: null, lien_contract_ended_set_at: null }')
    expect(LIEN_ROW).toContain('save({ lien_contract_ended_on: day, lien_contract_ended_how: how, lien_contract_ended_set_at: new Date().toISOString() }')
  })
})

describe('jobMarkDryRun — the plan', () => {
  it('the flag: before → after, the activity line, refused off Billed or when it already reads that way', () => {
    const dry = jobMarkDryRun(flag(), row(), { userId: DEV })
    if (!dry.ok) throw new Error(dry.refused)
    expect(dry.reply).toMatchObject({ action: 'collections_flag', job: { id: JOB, label: 'ZZ TEST seat walk', status: 'billed' }, before: { collections_at: null }, after: { collections_at: 'now', collections_by: DEV, collections_note: 'no answer in 60 days' }, rpc: 'set_job_collections_flag', activity: 'Moved to Collections — no answer in 60 days' })
    const clear = jobMarkDryRun(flag({ flagged: false, note: undefined }), row({ collections_at: '2026-10-01T00:00:00+00:00', uncollectible_at: '2026-10-15T00:00:00+00:00' }), { userId: DEV })
    if (!clear.ok) throw new Error(clear.refused)
    expect(clear.reply).toMatchObject({ after: { collections_at: null, uncollectible_at: null, note: expect.stringContaining('Uncollectible') }, activity: 'Returned to Billed Awaiting Payment' })
    expect(jobMarkDryRun(flag(), row({ status: 'ready_to_bill' }), { userId: DEV })).toMatchObject({ ok: false, refused: expect.stringContaining('Billed job') })
    expect(jobMarkDryRun(flag(), row({ collections_at: '2026-10-01T00:00:00+00:00', collections_note: 'old' }), { userId: DEV })).toMatchObject({ ok: false, refused: expect.stringContaining('already in Collections') })
    expect(jobMarkDryRun(flag({ flagged: false, note: undefined }), row(), { userId: DEV })).toMatchObject({ ok: false, refused: expect.stringContaining('not in Collections') })
    expect(jobMarkDryRun(flag(), null, { userId: DEV })).toMatchObject({ ok: false, refused: expect.stringContaining('find_job') })
  })
  it('the contract: before → after with the clocks’ footing, clear, and the no-op refused', () => {
    const dry = jobMarkDryRun(ended({ how: 'abandoned', retainage_held: 1678.04 }), row(), { userId: DEV })
    if (!dry.ok) throw new Error(dry.refused)
    expect(dry.reply).toMatchObject({ action: 'contract_ended', job: { label: 'ZZ TEST seat walk', last_work_date: '2026-10-20' }, before: { lien_contract_ended_on: null }, after: { lien_contract_ended_on: '2026-10-22', lien_contract_ended_how: 'abandoned', lien_contract_ended_set_at: 'now', lien_contract_ended_set_by: DEV, lien_retainage_held: 1678.04 } })
    expect(String(dry.reply.clocks)).toContain('an abandoned contract ended 2026-10-22')
    const already = row({ lien_contract_ended_on: '2026-10-22', lien_contract_ended_how: 'terminated', lien_retainage_held: '1678.04' })
    expect(jobMarkDryRun(ended(), already, { userId: DEV })).toMatchObject({ ok: false, refused: expect.stringContaining('already reads ended') })
    expect(jobMarkDryRun(ended({ retainage_held: 1678.04 }), already, { userId: DEV })).toMatchObject({ ok: false })
    expect(jobMarkDryRun(ended({ retainage_held: 2000 }), already, { userId: DEV })).toMatchObject({ ok: true })
    expect(jobMarkDryRun(ended({ how: 'abandoned' }), already, { userId: DEV })).toMatchObject({ ok: true })
    const clear = jobMarkDryRun({ action: 'contract_ended', job_id: JOB, clear: true }, already, { userId: DEV })
    expect(clear).toMatchObject({ ok: true, reply: { after: { lien_contract_ended_on: null, lien_contract_ended_how: null } } })
    expect(jobMarkDryRun({ action: 'contract_ended', job_id: JOB, clear: true }, row(), { userId: DEV })).toMatchObject({ ok: false, refused: expect.stringContaining('not marked ended') })
  })
  it('hashes the job’s updated_at and the mark’s columns, so a change since refuses the apply', async () => {
    const p = ended()
    const a = jobMarkDryRun(p, row(), { userId: DEV })
    const b = jobMarkDryRun(p, row({ updated_at: '2026-11-09T15:01:00+00:00' }), { userId: DEV })
    if (!a.ok || !b.ok) throw new Error('refused')
    const ha = await planHash('plan_contract_ended', p, a.reply)
    expect(await planHash('plan_contract_ended', p, a.reply)).toBe(ha)
    expect(await planHash('plan_contract_ended', p, b.reply)).not.toBe(ha)
    expect(planReply('plan_contract_ended', a.reply, ha).next).toContain('apply_contract_ended')
    expect(alreadyApplied('apply_contract_ended', { target: JOB, at: null })).toContain('Lien desk')
    expect(alreadyApplied('apply_collections_flag', { target: JOB, at: null })).toContain('flag already reads that way')
  })
  it('the words after', () => {
    expect(String(jobMarkAppliedWords(flag(), 'JP891', { ok: true, detail: { rpc: { ok: true, flagged: true } } }).next)).toContain('is in Collections')
    expect(String(jobMarkAppliedWords(flag({ flagged: false, note: undefined }), 'JP891', { ok: true }).next)).toContain('back at Billed')
    expect(String(jobMarkAppliedWords(ended(), 'JP879', { ok: true }).next)).toContain('ended 2026-10-22 (terminated)')
    expect(jobMarkAppliedWords(ended(), 'JP879', { ok: false, error: 'RLS let no row through' })).toMatchObject({ ok: false, error: 'RLS let no row through' })
  })
})
