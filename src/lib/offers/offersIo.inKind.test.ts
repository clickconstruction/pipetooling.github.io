import { describe, expect, it, vi } from 'vitest'
import { jobsOnDeal } from './offersIo'

/**
 * Work paid in kind (v2.8277, punch list #301): Today's sends reads which of its pay reminders' jobs an in kind
 * arrangement pays. The read asks for those jobs alone and only the ones on a deal, and a read that fails holds nothing.
 */

type Result = { data: Array<{ id: string }> | null; error: { message: string } | null }

const client = (result: Result | Error) => {
  const not = vi.fn(async () => {
    if (result instanceof Error) throw result
    return result
  })
  const isIn = vi.fn(() => ({ not }))
  const select = vi.fn(() => ({ in: isIn }))
  const from = vi.fn(() => ({ select }))
  return { db: { from }, from, select, isIn, not }
}

describe('jobsOnDeal', () => {
  it('reads the named jobs that are on an arrangement, and answers with their ids', async () => {
    const c = client({ data: [{ id: 'job-1312' }], error: null })
    expect(await jobsOnDeal(c.db, ['job-1312', 'job-2'])).toEqual(new Set(['job-1312']))
    expect(c.from).toHaveBeenCalledWith('jobs_ledger')
    expect(c.isIn).toHaveBeenCalledWith('id', ['job-1312', 'job-2'])
    expect(c.not).toHaveBeenCalledWith('in_kind_arrangement_id', 'is', null)
  })

  it('reads nothing when no pay reminder waits', async () => {
    const c = client({ data: [], error: null })
    expect(await jobsOnDeal(c.db, [])).toEqual(new Set())
    expect(c.from).not.toHaveBeenCalled()
  })

  it('holds nothing when the read is refused or the signal drops', async () => {
    expect(await jobsOnDeal(client({ data: null, error: { message: 'permission denied for table jobs_ledger' } }).db, ['job-1312'])).toEqual(new Set())
    expect(await jobsOnDeal(client(new TypeError('Failed to fetch')).db, ['job-1312'])).toEqual(new Set())
  })
})
