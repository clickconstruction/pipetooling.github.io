// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Saving an answer on a name (punch list #307): the Dashboard's Needs you line counts the names
 * still to answer, so an answer forgets the counts this browser remembered, and one that is not
 * saved leaves them. Every name here is made up.
 */
const { from, getSession, insert } = vi.hoisted(() => ({ from: vi.fn(), getSession: vi.fn(), insert: vi.fn() }))
vi.mock('../supabase', () => ({ supabase: { from, auth: { getSession } } }))

import { onNameAnswered, recordNameAnswer } from './bidSiteIo'
import { readLookAlikeCounts, rememberLookAlikeCount } from './lookAlikeCountMemory'

const ANSWER = { builderKey: 'tallpinedevelopmentgroup', customerId: 'c7', answer: 'works_for' as const, scope: 'all' as const, permitId: null, name: 'Tall Pine Development Group LLC' }

beforeEach(() => {
  window.localStorage.clear()
  getSession.mockReset().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
  insert.mockReset().mockResolvedValue({ data: null, error: null, status: 201 })
  from.mockReset().mockReturnValue({ insert })
  rememberLookAlikeCount('San Antonio', 9)
  rememberLookAlikeCount('Austin', 5)
})

describe('recordNameAnswer', () => {
  it('forgets every remembered count once the answer is saved, and tells the panels', async () => {
    const heard = vi.fn()
    const stop = onNameAnswered(heard)
    await recordNameAnswer(ANSWER)
    stop()
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ builder_key: 'tallpinedevelopmentgroup', customer_id: 'c7', answer: 'works_for', scope: 'all', answered_by: 'u1' }))
    expect(readLookAlikeCounts()).toEqual({})
    expect(heard).toHaveBeenCalledTimes(1)
  })

  it('keeps the counts when nobody is signed in and nothing was saved', async () => {
    getSession.mockResolvedValue({ data: { session: null } })
    await expect(recordNameAnswer(ANSWER)).rejects.toThrow('Sign in again to answer.')
    expect(insert).not.toHaveBeenCalled()
    expect(Object.keys(readLookAlikeCounts()).sort()).toEqual(['Austin', 'San Antonio'])
  })
})
