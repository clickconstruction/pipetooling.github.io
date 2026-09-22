import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { WRITE_VERBS, canonicalJson, isWriteVerb, planCommitment, planHash, planMismatch, planReply, planVerbFor, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'

const COST_MIGRATION = readFileSync('supabase/migrations/20260909161532_cost_batches.sql', 'utf8')
const HR_MIGRATION = readFileSync('supabase/migrations/20260922102017_dev_hr_entry_write.sql', 'utf8')
const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')

const PERSON = '11111111-2222-4333-8444-555555555555'
const BATCH = { label: 'ZZ test', reason: 'a test', ops: [{ op: 'thread_note', job_id: '0e4dcd2b-a524-4056-b93c-16713041a6e7', body: 'hello' }] }
const HASH = 'a'.repeat(64)

describe('devMcpWrites — the allowlist', () => {
  it('names only RPCs a migration creates, each gated is_dev() inside and closed to anon', () => {
    const rpcs = new Set(Object.values(WRITE_VERBS).map((v) => v.rpc))
    expect([...rpcs].sort()).toEqual(['cost_batch_apply', 'cost_batch_revert', 'dev_hr_entry_write'])
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
})
