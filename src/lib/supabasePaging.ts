import { databaseErrorFromResult, type SupabaseClientResult } from '../utils/errorHandling'

/** PostgREST's configured `max_rows` — responses without `.range()` are silently capped here. */
export const SUPABASE_PAGE_SIZE = 1000

/** `.in()` id-list chunk size (URL-length safety; matches the repo's existing chunking idioms). */
export const SUPABASE_IN_CHUNK_SIZE = 150

/**
 * Fetches every row of a PostgREST query by paging `.range(from, to)` until a
 * short page arrives. PostgREST silently caps un-ranged responses at
 * `max_rows` (1000) — a company-wide multi-year fetch that crosses the cap
 * returns an arbitrary subset with NO error (the Crew P&L v2.976/v2.978
 * incident class). `buildPage` must construct a FRESH query per call and
 * apply a stable `.order()` (or call an RPC with a deterministic ORDER BY)
 * so pages don't shuffle between requests.
 *
 * Throws DatabaseError on any page error — callers must not treat a failure
 * as an empty result.
 */
export async function fetchAllRows<T>(
  buildPage: (from: number, to: number) => PromiseLike<SupabaseClientResult<T[]>>,
  label: string,
  pageSize: number = SUPABASE_PAGE_SIZE,
): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += pageSize) {
    const res = await buildPage(from, from + pageSize - 1)
    if (res.error) {
      throw databaseErrorFromResult(res.error, label, res.status)
    }
    const rows = res.data ?? []
    all.push(...rows)
    if (rows.length < pageSize) break
  }
  return all
}

/** Splits `ids` into chunks of `size` (last chunk may be shorter). */
export function chunkIds<T>(ids: T[], size: number = SUPABASE_IN_CHUNK_SIZE): T[][] {
  const out: T[][] = []
  for (let i = 0; i < ids.length; i += size) {
    out.push(ids.slice(i, i + size))
  }
  return out
}

/**
 * Runs an `.in(column, chunk)` query per id-chunk, paging each chunk with
 * {@link fetchAllRows}, and concatenates the results. Covers both silent
 * truncation (a 150-id chunk can still return >1000 child rows) and 414
 * URI-too-long failures from unbounded id lists. Returns [] for empty `ids`.
 */
export async function fetchAllRowsChunkedIn<T, Id>(
  ids: Id[],
  buildPage: (chunk: Id[], from: number, to: number) => PromiseLike<SupabaseClientResult<T[]>>,
  label: string,
  opts?: { chunkSize?: number; pageSize?: number },
): Promise<T[]> {
  const out: T[] = []
  for (const chunk of chunkIds(ids, opts?.chunkSize ?? SUPABASE_IN_CHUNK_SIZE)) {
    out.push(...(await fetchAllRows((from, to) => buildPage(chunk, from, to), label, opts?.pageSize)))
  }
  return out
}
