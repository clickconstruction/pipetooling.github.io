import { beforeEach, describe, expect, it, vi } from 'vitest'

/** The read and the write behind an answer on a permit news line (punch list #401). Every bid and permit here is made up. */
const { from, getSession, insert, pages } = vi.hoisted(() => ({ from: vi.fn(), getSession: vi.fn(), insert: vi.fn(), pages: vi.fn() }))
vi.mock('../supabase', () => ({ supabase: { from, auth: { getSession } } }))

import { loadPermitAnswers, onPermitAnswered, recordPermitAnswer } from './bidPermitAnswersIo'

const PERMIT = { city: 'San Antonio', permit_number: 'PLB-2', permit_type: 'Plumbing General Permit' }

/** A table whose select resolves page by page through `pages`. */
function table() {
  const chain = { select: () => chain, order: () => chain, range: (a: number, b: number) => pages(a, b), insert }
  return chain
}

beforeEach(() => {
  getSession.mockReset().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
  insert.mockReset().mockResolvedValue({ data: null, error: null, status: 201 })
  pages.mockReset()
  from.mockReset().mockImplementation(() => table())
})

describe('loadPermitAnswers', () => {
  it('reads every row, past the first thousand', async () => {
    const first = Array.from({ length: 1000 }, (_, i) => ({ id: `a${i}` }))
    pages.mockResolvedValueOnce({ data: first, error: null }).mockResolvedValueOnce({ data: [{ id: 'last' }], error: null })
    const rows = await loadPermitAnswers()
    expect(from).toHaveBeenCalledWith('bid_permit_answers')
    expect(rows).toHaveLength(1001)
    expect(pages).toHaveBeenNthCalledWith(2, 1000, 1999)
  })

  it('reads a table that is not on the database yet as no answers', async () => {
    pages.mockResolvedValue({ data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.bid_permit_answers' in the schema cache" } })
    expect(await loadPermitAnswers()).toEqual([])
  })

  it('throws any other refusal, so a list can say why', async () => {
    pages.mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied for table bid_permit_answers' } })
    await expect(loadPermitAnswers()).rejects.toBeTruthy()
  })
})

describe('recordPermitAnswer', () => {
  it('appends one row as the person signed in, and tells whoever listens', async () => {
    const heard = vi.fn()
    const stop = onPermitAnswered(heard)
    await recordPermitAnswer({ bidId: 'b1', permit: PERMIT, answer: 'not_this_job' })
    stop()
    expect(insert).toHaveBeenCalledWith({ bid_id: 'b1', city: 'San Antonio', permit_number: 'PLB-2', permit_type: 'Plumbing General Permit', answer: 'not_this_job', answered_by: 'u1' })
    expect(heard).toHaveBeenCalledTimes(1)
    await recordPermitAnswer({ bidId: 'b1', permit: PERMIT, answer: 'taken_back' })
    expect(heard).toHaveBeenCalledTimes(1)
  })

  it('saves nothing and tells nobody when no one is signed in', async () => {
    getSession.mockResolvedValue({ data: { session: null } })
    const heard = vi.fn()
    const stop = onPermitAnswered(heard)
    await expect(recordPermitAnswer({ bidId: 'b1', permit: PERMIT, answer: 'this_job' })).rejects.toThrow('Sign in again to answer.')
    stop()
    expect(insert).not.toHaveBeenCalled()
    expect(heard).not.toHaveBeenCalled()
  })
})
