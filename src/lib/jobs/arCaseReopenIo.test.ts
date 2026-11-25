import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ answers: [] as Array<{ data: unknown; error: unknown }>, rpcs: [] as Array<{ fn: string; args: unknown }> }))
vi.mock('../supabase', () => ({
  supabase: {
    rpc: (fn: string, args: unknown) => {
      db.rpcs.push({ fn, args })
      return Promise.resolve(db.answers.shift() ?? { data: null, error: null })
    },
  },
}))

import { readArCasesWithClosed, reopenArTestCase } from './arCaseReopenIo'

const zz = { job_id: 'j-zz', job_number: '900', job_name: 'ZZ TEST walk job', removed_at: null, removed_by: null }
const real = { job_id: 'j-real', job_number: '412', job_name: 'Larkfield Lot 9', removed_at: null, removed_by: null }
const row = (over: Record<string, unknown> = {}) => ({ mercury_transaction_id: 'case-1', source: 'bank', closed_at: '2026-11-24T18:00:00Z', closed_reason: 'not_coming', live_payments: [], last_job: zz, recorded_payment: null, ...over })
const ok = (data: unknown) => ({ data, error: null })

beforeEach(() => {
  db.answers.length = 0
  db.rpcs.length = 0
})

describe('readArCasesWithClosed', () => {
  it('reads the cases with the closed ones, and throws when the read fails', async () => {
    db.answers.push(ok([row(), null, { nothing: true }]))
    expect((await readArCasesWithClosed()).map((r) => r.mercury_transaction_id)).toEqual(['case-1'])
    expect(db.rpcs).toEqual([{ fn: 'list_ar_return_cases', args: { p_include_closed: true } }])
    db.answers.push({ data: null, error: { message: 'no signal' } })
    await expect(readArCasesWithClosed()).rejects.toEqual({ message: 'no signal' })
  })
})

describe('reopenArTestCase', () => {
  it('reads the cases again, then calls the function of the case’s own table, once', async () => {
    db.answers.push(ok([row()]), ok({ ok: true }))
    await reopenArTestCase('case-1')
    expect(db.rpcs).toEqual([
      { fn: 'list_ar_return_cases', args: { p_include_closed: true } },
      { fn: 'reopen_ar_return_case', args: { p_mercury_transaction_id: 'case-1' } },
    ])
    db.rpcs.length = 0
    db.answers.push(ok([row({ source: 'unbanked' })]), ok({ ok: true }))
    await reopenArTestCase('case-1')
    expect(db.rpcs[1]).toEqual({ fn: 'reopen_ar_unbanked_check_case', args: { p_case_id: 'case-1' } })
    db.rpcs.length = 0
    db.answers.push(ok([row({ source: 'stripe_debit', last_job: null, stripe_case: zz })]), ok({ ok: true }))
    await reopenArTestCase('case-1')
    expect(db.rpcs[1]).toEqual({ fn: 'reopen_ar_stripe_case', args: { p_case_id: 'case-1' } })
  })
  it('refuses a case on a real job on the fresh read, and calls nothing', async () => {
    db.answers.push(ok([row({ last_job: real })]))
    await expect(reopenArTestCase('case-1')).rejects.toThrow('Only a case on a test job can be reopened. This one names a real job.')
    expect(db.rpcs.map((r) => r.fn)).toEqual(['list_ar_return_cases'])
  })
  it('refuses a case that is open by now, closed as replaced, or gone, and calls nothing', async () => {
    db.answers.push(ok([row({ closed_at: null, closed_reason: null })]))
    await expect(reopenArTestCase('case-1')).rejects.toThrow('This case is open already.')
    db.answers.push(ok([row({ closed_reason: 'replaced' })]))
    await expect(reopenArTestCase('case-1')).rejects.toThrow(/settled another way or as not coming/)
    db.answers.push(ok([row({ mercury_transaction_id: 'another' })]))
    await expect(reopenArTestCase('case-1')).rejects.toThrow(/not there any more/)
    expect(db.rpcs.every((r) => r.fn === 'list_ar_return_cases')).toBe(true)
  })
  it('passes on the function’s own refusal', async () => {
    db.answers.push(ok([row()]), { data: null, error: { message: 'This case cannot be opened again.', code: 'P0001' } })
    await expect(reopenArTestCase('case-1')).rejects.toMatchObject({ message: 'This case cannot be opened again.' })
    db.answers.push(ok([row()]), ok({ error: 'not authorized' }))
    await expect(reopenArTestCase('case-1')).rejects.toThrow('not authorized')
  })
  it('calls nothing when the read fails', async () => {
    db.answers.push({ data: null, error: { message: 'no signal' } })
    await expect(reopenArTestCase('case-1')).rejects.toEqual({ message: 'no signal' })
    expect(db.rpcs.map((r) => r.fn)).toEqual(['list_ar_return_cases'])
  })
})
