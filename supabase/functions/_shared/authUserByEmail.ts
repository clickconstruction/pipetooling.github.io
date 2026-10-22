/**
 * Find an auth account by its email, page after page (v2.5724, punch list #142 PR 0).
 *
 * `auth.admin.listUsers()` with no page answers the first 50 accounts and nothing else. Prod held
 * exactly 50 the day the walk kit was planned, so the 51st account (the kit's tester, or a new
 * hire) could push any account past the page, the dev-login identity included, and every
 * session's sign-in would then answer *User not found*. This asks for 1,000 a page and keeps
 * going until the address is found, a page comes back short, or the server names no next page.
 *
 * Deno-free on purpose: `src/lib/devLoginLookup.test.ts` imports this file directly (the
 * `estimateEventLine.ts` pattern). The caller hands in the page reader, so the test feeds pages.
 */

export interface AuthUserLike {
  id: string
  email?: string | null
}

export interface AuthUsersPage<U extends AuthUserLike> {
  users: U[]
  /** supabase-js reads it off the Link header; null on the last page. */
  nextPage?: number | null
}

export type ListAuthUsersPage<U extends AuthUserLike> = (
  page: number,
  perPage: number,
) => Promise<{ data: AuthUsersPage<U> | null; error: { message: string } | null }>

export interface AuthUserLookup<U extends AuthUserLike> {
  user: U | null
  /** The first page read's error, when one stopped the walk. */
  error: string | null
  /** How many pages were read. */
  pages: number
}

export const AUTH_USERS_PER_PAGE = 1000

/** A hard stop so a server that always names a next page cannot keep this reading forever. */
const PAGES_MAX = 100

/**
 * The account whose email is `email` (trimmed, case-insensitive), reading pages until it is found.
 * An error on any page ends the walk with that error and no user.
 */
export async function findAuthUserByEmail<U extends AuthUserLike>(
  listPage: ListAuthUsersPage<U>,
  email: string,
  perPage: number = AUTH_USERS_PER_PAGE,
): Promise<AuthUserLookup<U>> {
  const wanted = email.trim().toLowerCase()
  let page = 1
  let pages = 0
  while (pages < PAGES_MAX) {
    const { data, error } = await listPage(page, perPage)
    pages += 1
    if (error) return { user: null, error: error.message, pages }
    const users = data?.users ?? []
    const hit = users.find((u) => (u.email ?? '').trim().toLowerCase() === wanted)
    if (hit) return { user: hit, error: null, pages }
    if (users.length === 0) break
    const next = data?.nextPage
    if (typeof next === 'number' && next > page) {
      page = next
      continue
    }
    // null is the server's own word that this was the last page; undefined means it said nothing.
    if (next === null || users.length < perPage) break
    page += 1
  }
  return { user: null, error: null, pages }
}
