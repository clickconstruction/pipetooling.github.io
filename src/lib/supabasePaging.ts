import { DatabaseError, type SupabaseClientResult } from '../utils/errorHandling'

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
  opts?: {
    /**
     * Hard ceiling on the rows returned (a *real* cap the caller can detect with
     * `rows.length >= maxRows`, unlike PostgREST's silent one). Paging stops once
     * the ceiling is reached; the result is trimmed to exactly `maxRows`.
     */
    maxRows?: number
  },
): Promise<T[]> {
  const all: T[] = []
  const maxRows = opts?.maxRows
  for (let from = 0; ; from += pageSize) {
    const res = await buildPage(from, from + pageSize - 1)
    if (res.error) {
      throw new DatabaseError(`Failed to ${label}: ${res.error.message}`, res.error.code, res.error.details)
    }
    const rows = res.data ?? []
    all.push(...rows)
    if (maxRows != null && all.length >= maxRows) {
      all.length = maxRows
      break
    }
    if (rows.length < pageSize) break
  }
  return all
}

const rowCapWarned = new Set<string>()

/**
 * Debug telemetry for reads that are still un-ranged: PostgREST's `max_rows`
 * cap returns exactly `SUPABASE_PAGE_SIZE` rows with NO error, so a response of
 * that exact size is the only signal that the table has outgrown the read
 * (J33-N1: a `.limit(15000)` over 13,065 transactions came back as 1,000).
 * Warns once per `label` per session so a polling loader can't spam the console.
 * Returns true when the cap was (probably) hit.
 */
export function warnIfRowCapHit(label: string, rowCount: number, pageSize: number = SUPABASE_PAGE_SIZE): boolean {
  if (rowCount !== pageSize) return false
  if (!rowCapWarned.has(label)) {
    rowCapWarned.add(label)
    console.warn(
      `[supabasePaging] row_cap_hit ${label}: an un-ranged read returned exactly ${pageSize} rows — PostgREST's max_rows cap was probably hit; page this read with fetchAllRows.`,
    )
  }
  return true
}

/** Test hook: forget which labels have already warned. */
export function resetRowCapHitWarningsForTests(): void {
  rowCapWarned.clear()
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
