import { describe, expect, it } from 'vitest'
import { summarizeCostBatchOps, type CostBatchOp } from './costBatchPayload'
import { compareDryRunToPlan, costBatchPlanSignature, parseCostBatchApplyResult } from './costBatchDryRunCompare'

const A = '22222222-2222-4222-8222-222222222222'
const B = '33333333-3333-4333-8333-333333333333'
const TX = '11111111-1111-4111-8111-111111111111'
const SESSION = '55555555-5555-4555-8555-555555555555'

const ops: CostBatchOp[] = [
  { op: 'allocate', tx_id: TX, job_id: A, amount: 84.1, from_job_id: B },
  { op: 'allocate', tx_id: TX, job_id: A, amount: 0.2, from_job_id: B },
  { op: 'clock_repoint', session_id: SESSION, to_job_id: A },
  { op: 'thread_note', job_id: A, body: 'moved here' },
  { op: 'thread_note', job_id: B, body: 'moved away' },
]

describe('parseCostBatchApplyResult', () => {
  it('reads the RPC summary, numbers as numbers or strings, and a null batch id on a dry run', () => {
    const r = parseCostBatchApplyResult({
      batch_id: null,
      dry_run: true,
      op_count: 5,
      by_job: { [A]: { allocated: '84.30', clock_sessions: 1, notes: 1 }, [B]: { notes: '1' } },
      ops: [],
    })
    expect(r).toEqual({
      batchId: null,
      dryRun: true,
      opCount: 5,
      byJob: {
        [A]: { allocated: 84.3, supply: 0, clockSessions: 1, otherCharges: 0, notes: 1 },
        [B]: { allocated: 0, supply: 0, clockSessions: 0, otherCharges: 0, notes: 1 },
      },
    })
  })

  it('reads an applied batch id, and refuses anything that is not the summary', () => {
    expect(parseCostBatchApplyResult({ batch_id: 'b-1', dry_run: false, op_count: 1, by_job: {} })!.batchId).toBe('b-1')
    expect(parseCostBatchApplyResult('error')).toBeNull()
    expect(parseCostBatchApplyResult({ message: 'devs only' })).toBeNull()
    expect(parseCostBatchApplyResult(null)).toBeNull()
  })
})

describe('compareDryRunToPlan', () => {
  const plan = summarizeCostBatchOps(ops)

  it('matches when every job and field agrees to the cent', () => {
    const dry = parseCostBatchApplyResult({ batch_id: null, dry_run: true, op_count: 5, by_job: { [A]: { allocated: 84.3, clock_sessions: 1, notes: 1 }, [B]: { notes: 1 } } })!
    const c = compareDryRunToPlan(plan, dry)
    expect(c.matches).toBe(true)
    expect(c.problems).toEqual([])
    expect(c.lines.filter((l) => l.jobId === A).map((l) => [l.field, l.plan, l.dryRun, l.ok])).toEqual([
      ['allocated', 84.3, 84.3, true],
      ['supply', 0, 0, true],
      ['clockSessions', 1, 1, true],
      ['otherCharges', 0, 0, true],
      ['notes', 1, 1, true],
    ])
    expect(c.opCount).toEqual({ plan: 5, dryRun: 5 })
  })

  it('flags a cent of difference, a count, and a job only one side names', () => {
    const dry = parseCostBatchApplyResult({ batch_id: null, dry_run: true, op_count: 4, by_job: { [A]: { allocated: 84.31, clock_sessions: 1, notes: 1 }, ['44444444-4444-4444-8444-444444444444']: { notes: 1 } } })!
    const c = compareDryRunToPlan(plan, dry, (id) => (id === A ? 'Rough In' : id === B ? 'Diamondback' : 'Stray'))
    expect(c.matches).toBe(false)
    expect(c.problems).toEqual([
      'Rough In · Allocated: $84.30 planned, $84.31 in the dry run.',
      'The plan names Diamondback, which the dry run did not touch.',
      'The dry run touched Stray, which the plan does not name.',
      'Op count: 5 planned, 4 in the dry run.',
    ])
    expect(c.lines.find((l) => l.jobId === A && l.field === 'allocated')!.ok).toBe(false)
  })

  it('reads a half-cent of float noise as equal', () => {
    const dry = parseCostBatchApplyResult({ batch_id: null, dry_run: true, op_count: 5, by_job: { [A]: { allocated: 84.300000001, clock_sessions: 1, notes: 1 }, [B]: { notes: 1 } } })!
    expect(compareDryRunToPlan(plan, dry).matches).toBe(true)
  })
})

describe('costBatchPlanSignature', () => {
  it('changes with any change to the payload and holds still otherwise', () => {
    const a = costBatchPlanSignature({ label: 'x', ops })
    expect(costBatchPlanSignature({ label: 'x', ops })).toBe(a)
    expect(costBatchPlanSignature({ label: 'y', ops })).not.toBe(a)
    expect(costBatchPlanSignature({ label: 'x', ops: ops.slice(1) })).not.toBe(a)
  })
})
