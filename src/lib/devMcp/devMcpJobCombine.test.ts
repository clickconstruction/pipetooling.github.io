import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  COMBINE_JOB_COLS,
  COMBINE_MOVES,
  COMBINE_NO_UNDO,
  COMBINE_RPC,
  JOB_COMBINE_VERBS,
  combineBoxPhotos,
  combineRpcBody,
  isJobCombineVerb,
  jobCombineAppliedWords,
  jobCombineDryRun,
  jobCombineInput,
  paymentsOnBoth,
  priorNumbersAfter,
  readJobCombineWorld,
  type CombineStop,
  type JobCombinePayload,
} from '../../../supabase/functions/_shared/devMcpJobCombine'
import { WRITE_VERBS, alreadyApplied, isWriteVerb, planHash, planVerbFor, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { CATALOG_RPCS, CATALOG_TABLES } from '../../../supabase/functions/dev-mcp/catalog'
import { rpcArgNames } from '../../../supabase/functions/_shared/devMcpDoor'
import { BILL, CUSTOMER, OTHER_CUSTOMER, REAL, REAL_PAY, SHELL, SHELL_PAY, WIRE, bill, fakeRest, realJob, realPayment, shellJob, shellPayment, standingWorld } from './jobMoneyFixture'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const MODAL = readFileSync('src/components/jobs/JobsCombineSeparateModal.tsx', 'utf8')

/** The newest migration that defines a function, and its body. */
function newestBody(fn: string): string {
  const files = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()
  const defining = files.filter((f) => readFileSync(`supabase/migrations/${f}`, 'utf8').includes(`CREATE OR REPLACE FUNCTION public.${fn}(`))
  const text = readFileSync(`supabase/migrations/${defining[defining.length - 1]}`, 'utf8')
  const from = text.slice(text.indexOf(`CREATE OR REPLACE FUNCTION public.${fn}(`))
  return from.slice(0, from.indexOf('$function$;'))
}
const RPC_BODY = newestBody(COMBINE_RPC)

const PAIR = { from_job_id: SHELL, to_job_id: REAL }
const shaped = (combine: Record<string, unknown> = PAIR): JobCombinePayload => {
  const built = jobCombineInput('plan_job_combine', { combine })
  if (!built.ok) throw new Error(built.error)
  return built.p
}
type Data = Parameters<typeof fakeRest>[0]
const plan = async (data: Data = standingWorld(), combine: Record<string, unknown> = PAIR) => {
  const p = shaped(combine)
  const world = await readJobCombineWorld(fakeRest(data), p)
  const dry = jobCombineDryRun(p, world)
  if (!dry.ok) throw new Error(dry.refused)
  return { p, world, reply: dry.reply as Record<string, unknown> & { stops: CombineStop[]; warnings?: string[]; can_apply: boolean } }
}
const codes = (r: { stops: CombineStop[] }): string[] => r.stops.map((s) => s.code)
/** The shell once verb 1 took its unbacked row off and the status went back: nothing on it stops a combine. */
const fixedWorld = (over: Data = {}): Data => standingWorld({ jobs_ledger: [shellJob({ status: 'working', payments_made: 0 }), realJob()], jobs_ledger_payments: [realPayment()], ...over })

describe('devMcpJobCombine — the verbs on the allowlist', () => {
  it('are two write verbs with no RPC in the table, plan before apply, named by the server and the README', () => {
    expect(JOB_COMBINE_VERBS).toEqual(['plan_job_combine', 'apply_job_combine'])
    for (const v of JOB_COMBINE_VERBS) {
      expect(isJobCombineVerb(v)).toBe(true)
      expect(isWriteVerb(v)).toBe(true)
      expect(WRITE_VERBS[v].rpc).toBeNull()
      expect(SERVER).toContain(`case '${v}':`)
      expect(SERVER).toContain(`name: '${v}',`)
    }
    expect(planVerbFor('apply_job_combine')).toBe('plan_job_combine')
    expect(Object.keys(WRITE_VERBS)).toHaveLength(103)
    expect(README).toContain('`plan_job_combine(combine)` · `apply_job_combine(combine, plan_hash, confirm_no_undo)`')
    expect(alreadyApplied('apply_job_combine', { target: REAL, at: null })).toContain('The source job is gone')
  })
  it('is the Combine tab’s own RPC, with the arguments the tab sends', () => {
    expect(COMBINE_RPC).toBe('migrate_job_ledger_costs_and_delete')
    expect(MODAL).toContain("supabase.rpc('migrate_job_ledger_costs_and_delete', {")
    expect([...rpcArgNames(CATALOG_RPCS[COMBINE_RPC]!)].sort()).toEqual(['p_allow_billed', 'p_from', 'p_to'])
    expect(combineRpcBody(shaped())).toEqual({ p_from: SHELL, p_to: REAL })
    expect(combineRpcBody(shaped({ ...PAIR, allow_billed: true }))).toEqual({ p_from: SHELL, p_to: REAL, p_allow_billed: true })
    expect(SERVER).toContain('const res = await restPost(session, `rpc/${COMBINE_RPC}`, combineRpcBody(p))')
  })
  it('the server refuses an apply while a stop stands, before the RPC', () => {
    const branch = SERVER.slice(SERVER.indexOf("case 'apply_job_combine': {"), SERVER.indexOf("case 'plan_submittal_rows':"))
    expect(branch.indexOf('if (stops.length) return refused(')).toBeGreaterThan(0)
    expect(branch.indexOf('if (stops.length) return refused(')).toBeLessThan(branch.indexOf('restPost(session, `rpc/${COMBINE_RPC}`'))
    // The files follow, as the Combine tab's finish asks.
    expect(branch).toContain("invokeAsDev(session, 'photo-save', { refile_box_photos: p.to_job_id })")
    expect(MODAL).toContain('afterCombineBoxPhotos(cTargetId, role)')
  })
})

describe('devMcpJobCombine — the input', () => {
  const bad = (input: Record<string, unknown>, verb: 'plan_job_combine' | 'apply_job_combine' = 'plan_job_combine'): string => {
    const built = jobCombineInput(verb, input)
    if (built.ok) throw new Error('expected a refusal')
    return built.error
  }
  it('needs two different jobs by id', () => {
    expect(bad({})).toContain('needs combine')
    expect(bad({ combine: { from_job_id: 'JP5501', to_job_id: REAL } })).toContain('needs combine')
    expect(bad({ combine: { from_job_id: SHELL, to_job_id: SHELL } })).toContain('the same job')
    expect(bad({ combine: { ...PAIR, allow_billed: 'yes' } })).toContain('allow_billed is true or false')
    expect(shaped()).toEqual({ action: 'combine', from_job_id: SHELL, to_job_id: REAL, allow_billed: false, different_customers_ok: false })
  })
  it('apply needs the plan’s hash and confirm_no_undo: true, and says there is no undo', () => {
    expect(bad({ combine: PAIR }, 'apply_job_combine')).toContain('needs plan_hash')
    const noConfirm = bad({ combine: PAIR, plan_hash: 'a'.repeat(64) }, 'apply_job_combine')
    expect(noConfirm).toContain('needs confirm_no_undo: true')
    expect(noConfirm).toContain('There is no undo')
    expect(bad({ combine: PAIR, plan_hash: 'a'.repeat(64), confirm_no_undo: 'true' }, 'apply_job_combine')).toContain('confirm_no_undo')
    expect(writeRpcBody('apply_job_combine', { combine: PAIR, plan_hash: 'a'.repeat(64), confirm_no_undo: true })).toMatchObject({ ok: true, rpc: null, step: 'apply', target: REAL })
    expect(writeRpcBody('apply_job_combine', { combine: PAIR, plan_hash: 'a'.repeat(64) })).toMatchObject({ ok: false })
  })
})

describe('devMcpJobCombine — what moves is what the RPC moves', () => {
  it('every counted table and column is in the catalog and in the RPC’s newest body', () => {
    const carry = newestBody('on_site_carry_job')
    for (const m of COMBINE_MOVES) {
      expect(CATALOG_TABLES[m.table]?.columns, m.table).toHaveProperty(m.column)
      expect(`${RPC_BODY}\n${carry}`, m.table).toContain(`public.${m.table}`)
    }
    expect(new Set(COMBINE_MOVES.map((m) => m.table)).size).toBe(COMBINE_MOVES.length)
    for (const c of COMBINE_JOB_COLS.split(',')) expect(CATALOG_TABLES.jobs_ledger!.columns).toHaveProperty(c)
  })
  it('bills and payments are not among them: the RPC refuses them or lets them go with the source', () => {
    expect(COMBINE_MOVES.map((m) => m.table)).not.toContain('jobs_ledger_payments')
    expect(COMBINE_MOVES.map((m) => m.table)).not.toContain('jobs_ledger_invoices')
    expect(RPC_BODY).not.toContain('UPDATE public.jobs_ledger_payments')
    expect(RPC_BODY).not.toContain('UPDATE public.jobs_ledger_invoices')
    expect(RPC_BODY).toContain("WHEN (jl.status IS DISTINCT FROM 'working' AND jl.status IS DISTINCT FROM 'ready_to_bill') THEN")
    expect(RPC_BODY).toContain('WHEN COALESCE(jl.payments_made, 0) <> 0 THEN')
    expect(RPC_BODY).toContain('WHEN EXISTS (SELECT 1 FROM public.jobs_ledger_invoices i WHERE i.job_id = p_from) THEN')
    expect(RPC_BODY).toContain('WHEN EXISTS (SELECT 1 FROM public.job_collect_payment_flows c WHERE c.job_id = p_from) THEN')
    expect(RPC_BODY).toContain('SET revenue = COALESCE(jl_to.revenue, 0) + COALESCE(jl_from.revenue, 0)')
  })
  it('the read asks only for columns the tables have, and counts every kind on the source', async () => {
    const rest = fakeRest(standingWorld({ clock_sessions: [{ job_ledger_id: SHELL }, { job_ledger_id: SHELL }, { job_ledger_id: REAL }], jobs_ledger_fixtures: [{ job_id: SHELL }], job_box_photos: [{ job_id: SHELL }] }))
    const world = await readJobCombineWorld(rest, shaped())
    expect(world.counts).toHaveLength(COMBINE_MOVES.length)
    expect(world.counts.find((c) => c.table === 'clock_sessions')?.rows).toBe(2)
    expect(combineBoxPhotos(world)).toBe(1)
    expect(rest.asked.filter((a) => a.startsWith('count ')).length).toBe(COMBINE_MOVES.length + 5)
  })
  it('a count that fails takes only itself out', async () => {
    const rest = fakeRest(standingWorld())
    const world = await readJobCombineWorld({ rows: rest.rows, count: async (t, q) => (t === 'messages' ? Promise.reject(new Error('permission denied')) : rest.count(t, q)) }, shaped())
    const dry = jobCombineDryRun(shaped(), world)
    if (!dry.ok) throw new Error(dry.refused)
    expect(dry.reply.could_not_count).toEqual([{ what: 'texts, calls, emails and team notes', why: 'permission denied' }])
  })
  it('a job RLS hides refuses the plan', async () => {
    const p = shaped()
    expect(jobCombineDryRun(p, await readJobCombineWorld(fakeRest(standingWorld({ jobs_ledger: [realJob()] })), p))).toEqual({ ok: false, refused: expect.stringContaining(`No job ${SHELL}`) })
    expect(jobCombineDryRun(p, await readJobCombineWorld(fakeRest(standingWorld({ jobs_ledger: [shellJob()] })), p))).toEqual({ ok: false, refused: expect.stringContaining(`No job ${REAL}`) })
  })
})

describe('devMcpJobCombine — the shell beside the real job, as they stand', () => {
  it('shows both jobs with their payment rows and stops on every reason at once', async () => {
    const { reply } = await plan()
    expect(reply.source).toMatchObject({ id: SHELL, label: 'JP5501', status: 'paid', job_total: 1000, paid: 1000, payments: [expect.objectContaining({ id: SHELL_PAY, bank_row: null })] })
    expect(reply.target).toMatchObject({ id: REAL, label: 'JP9001', job_total: 1000, paid: 1000, payments: [expect.objectContaining({ id: REAL_PAY, bank_row: WIRE })], prior_numbers: ['HCP 4400'] })
    expect(codes(reply)).toEqual(['source_status', 'source_payments', 'payment_on_both'])
    expect(reply.can_apply).toBe(false)
    expect(String(reply.apply_with)).toContain('3 reasons stop it')
    expect(reply.no_undo).toBe(COMBINE_NO_UNDO)
    expect(reply.never_moves).toContain('never move')
  })
  it('warns in words that one deposit sits on both jobs, and names the order: the payment verb first', async () => {
    const { reply } = await plan()
    const both = reply.stops.find((s) => s.code === 'payment_on_both')!
    expect(both.words).toBe(`JP5501's $1,000.00 payment dated 2026-03-02 (no bank row, no type, no reference, id ${SHELL_PAY}) matches JP9001's $1,000.00 payment dated 2026-03-02 (a bank row behind it). One deposit, two rows: both jobs read paid for the same money.`)
    expect(both.fix).toContain("plan_job_payment { action: 'remove', payment_id, reason }")
    expect(both.fix).toContain('plan the combine again')
    expect(reply.stops.find((s) => s.code === 'source_payments')!.fix).toContain("plan_job_payment { action: 'remove' }")
  })
  it('warns that two equal job totals double', async () => {
    const { reply } = await plan()
    expect(reply.warnings![0]).toBe("Both jobs carry the same job total, $1,000.00. The combine adds them: JP9001 would read $2,000.00 against $1,000.00 paid. If this is one job entered twice the total doubles; zero the source's line items and total first, or correct the target's after.")
    expect(reply.after).toMatchObject({ target: { job_total: 2000, paid: 1000, balance: 1000, status: 'paid' } })
  })
  it('pairs each source payment with one target payment of the same amount, once', () => {
    const pairs = paymentsOnBoth([shellPayment(), shellPayment({ id: 'x2' }), shellPayment({ id: 'x3', amount: 40 })], [realPayment()])
    expect(pairs.map((w) => [w.source.id, w.target.id])).toEqual([[SHELL_PAY, REAL_PAY]])
  })
})

describe('devMcpJobCombine — once the payment is off', () => {
  it('nothing stops it: the plan lists what moves, the target after and the numbers kept', async () => {
    const { reply } = await plan(fixedWorld({ clock_sessions: [{ job_ledger_id: SHELL }, { job_ledger_id: SHELL }], jobs_ledger_fixtures: [{ job_id: SHELL }], job_box_photos: [{ job_id: SHELL }, { job_id: SHELL }] }))
    expect(reply.stops).toEqual([])
    expect(reply.can_apply).toBe(true)
    expect(reply.apply_with).toBe('apply_job_combine with the same combine, this plan_hash and confirm_no_undo: true')
    expect(reply.moves).toEqual([
      { group: 'labor', what: 'clock sessions', rows: 2 },
      { group: 'stage lines', what: 'line items (Specific Work)', rows: 1 },
      { group: 'Materials on site', what: 'box photos', rows: 2 },
    ])
    expect(String(reply.moves_words)).toContain('5 rows counted across 3 kinds move to JP9001')
    expect(reply.prior_numbers_kept).toEqual(['HCP 5501'])
    expect(reply.after).toMatchObject({ target: { job_total: 2000, paid: 1000, prior_numbers: ['HCP 4400', 'HCP 5501'] }, source: 'JP5501 is deleted' })
    expect(String(reply.photos)).toContain('2 box photos follow in Drive')
    expect(String(reply.door)).toContain('the Combine tab')
  })
  it('a source with no total adds none and warns of none', async () => {
    const { reply } = await plan(fixedWorld({ jobs_ledger: [shellJob({ status: 'working', payments_made: 0, revenue: 0, pct_complete: 0 }), realJob()] }))
    expect(reply.warnings).toBeUndefined()
    expect(reply.after).toMatchObject({ target: { job_total: 1000, paid: 1000, balance: 0 } })
  })
  it('warns when the source is further along than the target', async () => {
    const { reply } = await plan(fixedWorld({ jobs_ledger: [shellJob({ status: 'ready_to_bill', payments_made: 0, revenue: 0 }), realJob({ status: 'working', pct_complete: 40 })] }))
    expect(reply.warnings).toEqual(["JP5501 is further along (Ready to bill at 100%) than JP9001 (Working at 40%). Combining never changes the target's status or % done; the note on its activity keeps the source's."])
  })
  it('the hash commits to both jobs and what would move', async () => {
    const a = await plan(fixedWorld())
    const hash = await planHash('plan_job_combine', a.p, a.reply)
    const again = await plan(fixedWorld())
    expect(await planHash('plan_job_combine', again.p, again.reply)).toBe(hash)
    for (const data of [
      fixedWorld({ jobs_ledger: [shellJob({ status: 'working', payments_made: 0 }), realJob({ updated_at: '2026-11-11T16:00:00+00:00' })] }),
      fixedWorld({ clock_sessions: [{ job_ledger_id: SHELL }] }),
      fixedWorld({ jobs_ledger_payments: [realPayment(), realPayment({ id: 'p2', amount: 5, sequence_order: 1 })] }),
    ]) {
      const b = await plan(data)
      expect(await planHash('plan_job_combine', b.p, b.reply)).not.toBe(hash)
    }
  })
})

describe('devMcpJobCombine — every reason the combine would stop', () => {
  it('a bill or a collect flow on the source, in the RPC’s order', async () => {
    const { reply } = await plan(fixedWorld({ jobs_ledger_invoices: [bill()], job_collect_payment_flows: [{ job_id: SHELL }] }))
    expect(codes(reply)).toEqual(['source_bills', 'source_collect_flow'])
  })
  it('allow_billed lets the source’s bills and payments go with it, and says they are deleted, not moved', async () => {
    const { reply } = await plan(standingWorld({ jobs_ledger_invoices: [bill()] }), { ...PAIR, allow_billed: true })
    expect(reply.stops).toEqual([])
    expect(reply.warnings!.join(' ')).toContain("With allow_billed the source's rows are deleted with it, so JP9001's paid figure stays $1,000.00.")
    expect(reply.warnings!.join(' ')).toContain("allow_billed: JP5501's 1 payment row ($1,000.00) and 1 bill are deleted with it. They do not move to JP9001.")
    expect(String(reply.door)).toContain('Reassign to another job…')
    expect(reply.never_moves).toBe('Bills and payments are deleted with the source. They never move.')
  })
  it('allow_billed still stops on a source payment with a bank row behind it, and on a bill Stripe hosts', async () => {
    const data = standingWorld({ jobs_ledger_payments: [shellPayment({ mercury_transaction_id: WIRE }), realPayment({ mercury_transaction_id: null })], jobs_ledger_invoices: [bill({ stripe_invoice_id: 'in_zz_1' })] })
    const { reply } = await plan(data, { ...PAIR, allow_billed: true })
    expect(codes(reply)).toEqual(['source_banked_payment', 'source_stripe_bill'])
    expect(reply.stops[0]!.words).toContain('a real deposit would lose the job it paid')
  })
  it('a work order, an open agreement or pay applications on both, and supply shares past 100%', async () => {
    const data = fixedWorld({
      step_commitments: [
        { job_id: SHELL, person_id: 'sub-1', display_name: 'ZZ TEST Mechanical', step_id: null, labor_job_id: null, status: 'accepted' },
        { job_id: REAL, person_id: 'sub-1', display_name: 'ZZ TEST Mechanical', step_id: null, labor_job_id: null, status: 'offered' },
        { job_id: SHELL, person_id: 'sub-2', display_name: 'ZZ TEST Drains', step_id: null, labor_job_id: null, status: 'cancelled' },
        { job_id: REAL, person_id: 'sub-2', display_name: 'ZZ TEST Drains', step_id: null, labor_job_id: null, status: 'accepted' },
      ],
      job_contracts: [{ job_id: SHELL, status: 'draft' }, { job_id: REAL, status: 'sent' }],
      job_pay_applications: [{ job_id: SHELL, deleted_at: null }, { job_id: REAL, deleted_at: null }],
      supply_house_invoice_job_allocations: [{ job_id: SHELL, invoice_id: 'inv-1', pct: 60 }, { job_id: REAL, invoice_id: 'inv-1', pct: 50 }, { job_id: SHELL, invoice_id: 'inv-2', pct: 50 }, { job_id: REAL, invoice_id: 'inv-2', pct: 50 }],
    })
    const { reply } = await plan(data)
    expect(codes(reply)).toEqual(['work_order_collision', 'agreement_collision', 'pay_application_collision', 'supply_alloc_overflow'])
    expect(reply.stops[0]!.words).toBe('Both jobs hold a live work order for ZZ TEST Mechanical.')
    expect(reply.stops[3]!.words).toContain('one invoice (inv-1)')
    for (const words of ['Both jobs hold a live work order for %s. Cancel one of them, then combine.', 'Both jobs hold an open agreement. Void one of them, then combine.', "Both jobs hold pay applications. Delete one job''s applications, then combine.", 'Merging supply invoice allocations would exceed 100%%']) expect(RPC_BODY).toContain(words)
  })
  it('a signed agreement or a deleted application on one side is no collision', async () => {
    const { reply } = await plan(fixedWorld({ job_contracts: [{ job_id: SHELL, status: 'signed' }, { job_id: REAL, status: 'sent' }], job_pay_applications: [{ job_id: SHELL, deleted_at: '2026-10-01T00:00:00Z' }, { job_id: REAL, deleted_at: null }] }))
    expect(reply.stops).toEqual([])
  })
  it('two different customers stop it unless the caller says it is meant', async () => {
    const data = fixedWorld({ jobs_ledger: [shellJob({ status: 'working', payments_made: 0, customer_id: OTHER_CUSTOMER, customer_name: 'ZZ TEST Other Builder' }), realJob()] })
    const held = await plan(data)
    expect(codes(held.reply)).toEqual(['different_customers'])
    expect(held.reply.stops[0]!.words).toBe("JP5501 is on ZZ TEST Other Builder and JP9001 on ZZ TEST Builder. The combined job keeps the target's customer.")
    const meant = await plan(data, { ...PAIR, different_customers_ok: true })
    expect(meant.reply.stops).toEqual([])
    expect(meant.reply.warnings!.join(' ')).toContain('different customers; the combined job stays on ZZ TEST Builder')
    // A job with no customer on file is not a different customer.
    expect((await plan(fixedWorld({ jobs_ledger: [shellJob({ status: 'working', payments_made: 0, customer_id: null }), realJob({ customer_id: CUSTOMER })] }))).reply.stops).toEqual([])
  })
})

describe('devMcpJobCombine — the numbers and the words', () => {
  it('keeps the source’s numbers as the RPC does: the target’s own, then HCP #, C#, and the source’s priors, each once', () => {
    expect(priorNumbersAfter({ hcp_number: ' 5501 ', click_number: '77', prior_numbers: ['HCP 4400', 'C# 12'] }, { prior_numbers: ['HCP 4400'] })).toEqual(['HCP 4400', 'HCP 5501', 'C# 77', 'C# 12'])
    expect(priorNumbersAfter({ hcp_number: '', click_number: '', prior_numbers: null }, { prior_numbers: null })).toEqual([])
    expect(RPC_BODY).toContain("THEN ARRAY['HCP ' || trim(jl_from.hcp_number)]")
    expect(RPC_BODY).toContain("THEN ARRAY['C# ' || trim(jl_from.click_number)]")
  })
  it('the apply says what the RPC left, the target read back, and that nothing is undone', () => {
    const done = jobCombineAppliedWords({ source: 'JP5501', target: 'JP9001' }, { ok: true, rpc: { ok: true, note_body: 'Combined "ZZ TEST Maple Court shell" (Job #5501) into this job — source was Working at 100%', estimate_unlinked: true }, after: { job_total: 2000, paid: 1000 }, photos: { asked: true } })
    expect(done).toMatchObject({ ok: true, source: 'JP5501 is deleted', target: 'JP9001', note_on_activity: expect.stringContaining('Combined "ZZ TEST Maple Court shell"'), estimate: expect.stringContaining('stays on the Estimates page'), after: { job_total: 2000 }, photos: { asked: true } })
    expect(String(done.next)).toContain('There is no undo')
    expect(jobCombineAppliedWords({ source: 'JP5501', target: 'JP9001' }, { ok: false, error: 'Remove or resolve payments on this job before migrate-delete.' })).toMatchObject({ ok: false, standing: expect.stringContaining('everything or nothing') })
    expect(MODAL).toContain('Recently deleted')
    void BILL
  })
})
