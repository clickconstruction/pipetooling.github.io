import { describe, expect, it } from 'vitest'
import { findAuthUserByEmail, type ListAuthUsersPage } from '../../supabase/functions/_shared/authUserByEmail'

interface U {
  id: string
  email?: string | null
}

/** Pages of `size` accounts, `total` in all, each named `user<n>@x.test`; `nextPage` as supabase-js reads it. */
function pagesOf(total: number, size: number, extra: Record<number, U[]> = {}): { list: ListAuthUsersPage<U>; asked: number[] } {
  const asked: number[] = []
  const list: ListAuthUsersPage<U> = async (page, perPage) => {
    asked.push(page)
    expect(perPage).toBe(size)
    const start = (page - 1) * size
    const users: U[] = []
    for (let n = start; n < Math.min(total, start + size); n += 1) users.push({ id: `u${n}`, email: `user${n}@x.test` })
    for (const u of extra[page] ?? []) users.push(u)
    const last = Math.max(1, Math.ceil(total / size))
    return { data: { users, nextPage: page < last ? page + 1 : null }, error: null }
  }
  return { list, asked }
}

describe('findAuthUserByEmail (v2.5724, punch list #142 PR 0)', () => {
  it('finds an account on the first page and reads no further', async () => {
    const { list, asked } = pagesOf(120, 50)
    const found = await findAuthUserByEmail(list, 'user7@x.test', 50)
    expect(found.user?.id).toBe('u7')
    expect(found.error).toBeNull()
    expect(asked).toEqual([1])
  })

  it('finds an account on the third page', async () => {
    const { list, asked } = pagesOf(120, 50)
    const found = await findAuthUserByEmail(list, 'user110@x.test', 50)
    expect(found.user?.id).toBe('u110')
    expect(found.pages).toBe(3)
    expect(asked).toEqual([1, 2, 3])
  })

  it('answers no user after a short last page, and after an empty first page', async () => {
    const { list, asked } = pagesOf(120, 50)
    const missing = await findAuthUserByEmail(list, 'nobody@x.test', 50)
    expect(missing).toEqual({ user: null, error: null, pages: 3 })
    expect(asked).toEqual([1, 2, 3])
    const empty = await findAuthUserByEmail(pagesOf(0, 50).list, 'nobody@x.test', 50)
    expect(empty).toEqual({ user: null, error: null, pages: 1 })
  })

  it('stops on a full last page the server marks as the last, without asking for one more', async () => {
    const { list, asked } = pagesOf(100, 50)
    const missing = await findAuthUserByEmail(list, 'nobody@x.test', 50)
    expect(missing.user).toBeNull()
    expect(asked).toEqual([1, 2])
  })

  it('matches the address trimmed and case-insensitively, on both sides', async () => {
    const { list } = pagesOf(10, 50, { 1: [{ id: 'mixed', email: ' Walk-Tester@Walk.PipeTooling.local ' }] })
    const found = await findAuthUserByEmail(list, '  walk-tester@walk.pipetooling.LOCAL', 50)
    expect(found.user?.id).toBe('mixed')
    const upper = await findAuthUserByEmail(list, 'USER3@X.TEST', 50)
    expect(upper.user?.id).toBe('u3')
  })

  it('stops on an error with its words and no user', async () => {
    const asked: number[] = []
    const list: ListAuthUsersPage<U> = async (page) => {
      asked.push(page)
      if (page === 2) return { data: null, error: { message: 'rate limited' } }
      const users: U[] = []
      for (let n = 0; n < 50; n += 1) users.push({ id: `u${n}`, email: `user${n}@x.test` })
      return { data: { users, nextPage: 2 }, error: null }
    }
    const found = await findAuthUserByEmail(list, 'user99@x.test', 50)
    expect(found).toEqual({ user: null, error: 'rate limited', pages: 2 })
    expect(asked).toEqual([1, 2])
  })

  it('copes with an account that has no email', async () => {
    const { list } = pagesOf(2, 50, { 1: [{ id: 'phone-only', email: null }] })
    const found = await findAuthUserByEmail(list, 'user1@x.test', 50)
    expect(found.user?.id).toBe('u1')
  })
})
