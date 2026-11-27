/**
 * The bench's one remove (`removeGcBenchCompany`, finding 338): the function's own refusal is passed on as a
 * `BenchRemoveRefused` whose words are the function's sentence alone, and every other failure is left as it was. The
 * client is a stub that answers what each case hands it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const next = vi.hoisted(() => ({ answer: { data: null as unknown, error: null as unknown, status: 200 }, calls: [] as { fn: string; args: Record<string, unknown> }[] }))

vi.mock('../supabase', () => ({
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => {
      next.calls.push({ fn, args })
      return Promise.resolve(next.answer)
    },
  },
}))

import { formatErrorMessage } from '../../utils/errorHandling'
import { BENCH_REMOVE_FAILED, BenchRemoveRefused } from './benchRemove'
import { removeGcBenchCompany } from './gcIo'

beforeEach(() => {
  next.calls.length = 0
  next.answer = { data: null, error: null, status: 200 }
})

describe('removeGcBenchCompany', () => {
  it('asks the function for the one company', async () => {
    await removeGcBenchCompany('zz-walk')
    expect(next.calls).toEqual([{ fn: 'gc_remove_bench_company', args: { p_company_id: 'zz-walk' } }])
  })

  it('passes the function’s refusal on in its own words, with nothing in front of them', async () => {
    next.answer = { data: null, error: { message: 'ZZ Test Walk Co stays on the bench, since we emailed them.', code: 'P0001' }, status: 400 }
    const thrown = await removeGcBenchCompany('zz-walk').catch((e: unknown) => e)
    expect(thrown).toBeInstanceOf(BenchRemoveRefused)
    // What the row draws: the reason alone, where it read *Failed to remove the company from the bench: ZZ Test Walk Co stays…*.
    expect(formatErrorMessage(thrown, BENCH_REMOVE_FAILED)).toBe('ZZ Test Walk Co stays on the bench, since we emailed them.')
  })

  it('leaves a failure that is no refusal as it was: the role’s own answer, and a lost signal', async () => {
    next.answer = { data: null, error: { message: 'Only the office removes a company from the bench.', code: '42501' }, status: 403 }
    const denied = await removeGcBenchCompany('zz-walk').catch((e: unknown) => e)
    expect(denied).not.toBeInstanceOf(BenchRemoveRefused)
    expect(formatErrorMessage(denied, BENCH_REMOVE_FAILED)).toBe("You don't have permission to remove the company from the bench.")
    next.answer = { data: null, error: { message: 'TypeError: Failed to fetch' }, status: 0 }
    const lost = await removeGcBenchCompany('zz-walk').catch((e: unknown) => e)
    expect(lost).not.toBeInstanceOf(BenchRemoveRefused)
  })
})
