/**
 * Row-cap tripwire (v2.2756).
 *
 * PostgREST caps every un-ranged read at the project's `max_rows` (1,000) and
 * reports nothing — the response is a 200 with the first page. Five surfaces
 * have now been bitten as tables grew past the cap (Crew P&L v2.976/978, team
 * labor, People Review, Settings backups, and the Takeoffs parts catalog in
 * v2.2755, where "DI…" through Z silently vanished from the part search). Each
 * was fixed at its own call site; none could see the next one coming.
 *
 * This module wraps the Supabase client's `fetch`. Every REST response whose
 * `Content-Range` says exactly `max_rows` rows came back on a request that
 * asked for no `limit` is reported once per table per session — the caller
 * almost certainly wanted everything and got an arbitrary subset. Legitimate
 * exact-1,000 results with a known total (`count: 'exact'`) are not flagged.
 *
 * The wrapper never alters the request or the response; a reporter failure
 * can't break a query.
 */

/** PostgREST's configured `max_rows` — keep in step with `supabase/config.toml` and `SUPABASE_PAGE_SIZE`. */
export const ROW_CAP = 1000

export type RowCapFinding = {
  /** Table name, or `rpc:<function>` for a set-returning RPC. */
  table: string
  /** Rows the response carried (== ROW_CAP when flagged). */
  rows: number
  /** Request path + query, origin stripped. */
  path: string
}

export type RowCapProbe = {
  url: string
  method: string
  /** The response's `Content-Range` header, e.g. `0-999/*`, `0-999/1713`, or star-slash-zero for an empty set. */
  contentRange: string | null
}

/** Pure: the table (or `rpc:<fn>`) a PostgREST URL addresses, or null for non-REST URLs. */
export function restTableFromUrl(url: string): string | null {
  const m = /\/rest\/v1\/([^/?#]+)(?:\/([^/?#]+))?/.exec(url)
  if (!m) return null
  if (m[1] === 'rpc') return m[2] ? `rpc:${m[2]}` : null
  return m[1] ?? null
}

/** Pure: parse a PostgREST `Content-Range` into the row count and known total. */
export function parseContentRange(header: string | null): { rows: number; total: number | null } | null {
  if (!header) return null
  const m = /^\s*(\*|\d+)(?:-(\d+))?\/(\*|\d+)\s*$/.exec(header)
  if (!m) return null
  const total = m[3] === '*' ? null : Number(m[3])
  if (m[1] === '*' || m[2] == null) return { rows: 0, total }
  return { rows: Number(m[2]) - Number(m[1]) + 1, total }
}

/**
 * Pure: decide whether a response looks silently capped. Flags only when the
 * request carried no `limit` (postgrest-js writes `.limit()` / `.range()` as
 * `limit=` + `offset=` query params), the method can return a row set, and
 * the response holds exactly `cap` rows with an unknown or larger total.
 */
export function detectRowCap(probe: RowCapProbe, cap: number = ROW_CAP): RowCapFinding | null {
  const table = restTableFromUrl(probe.url)
  if (!table) return null
  const method = probe.method.toUpperCase()
  if (method !== 'GET' && !(method === 'POST' && table.startsWith('rpc:'))) return null
  let params: URLSearchParams
  try {
    params = new URL(probe.url, 'http://placeholder').searchParams
  } catch {
    return null
  }
  if (params.has('limit')) return null
  const parsed = parseContentRange(probe.contentRange)
  if (!parsed || parsed.rows !== cap) return null
  if (parsed.total != null && parsed.total <= cap) return null
  return { table, rows: parsed.rows, path: probe.url.replace(/^[a-z]+:\/\/[^/]+/i, '') }
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method
  if (typeof input !== 'string' && !(input instanceof URL)) return input.method
  return 'GET'
}

/**
 * Wraps a `fetch` so every REST response is probed with {@link detectRowCap}.
 * The response object is returned untouched (headers are read, the body is not).
 */
export function wrapFetchWithRowCapTripwire(
  baseFetch: FetchLike,
  report: (finding: RowCapFinding) => void,
  cap: number = ROW_CAP,
): FetchLike {
  return async (input, init) => {
    const res = await baseFetch(input, init)
    try {
      const finding = detectRowCap(
        { url: requestUrl(input), method: requestMethod(input, init), contentRange: res.headers.get('content-range') },
        cap,
      )
      if (finding) report(finding)
    } catch {
      // The tripwire must never turn a good response into a failure.
    }
    return res
  }
}

/**
 * Default reporter: one loud console error per table per session, naming the
 * fix. Kept as a factory so tests can assert the once-per-table throttle.
 */
export function makeConsoleRowCapReporter(
  log: (message: string, finding: RowCapFinding) => void = (m, f) => console.error(m, f),
): (finding: RowCapFinding) => void {
  const seen = new Set<string>()
  return (finding) => {
    if (seen.has(finding.table)) return
    seen.add(finding.table)
    log(
      `[row-cap] ${finding.table} returned exactly ${finding.rows} rows with no limit — PostgREST's max_rows cap silently truncated it. ` +
        `Page the read with fetchAllRows (src/lib/supabasePaging.ts) or bound it. See docs/TROUBLESHOOTING.md → "[row-cap]".`,
      finding,
    )
  }
}
