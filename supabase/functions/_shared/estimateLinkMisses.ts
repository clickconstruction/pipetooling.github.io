/**
 * The guard on guessing an estimate's link (v2.6677, punch list #281 PR 2). The text's link is now a ten-letter code
 * (`share_estimate_link`, migration 20261108053000): 31^10 codes against a few hundred live ones, so a guesser's odds
 * are nil, but the three functions that open an estimate from a link (get-estimate-for-customer, accept-estimate,
 * log-estimate-option-view) still count what each caller gets wrong. A lookup that finds no hash is a miss against its
 * source, the first hop of x-forwarded-for, kept only as a SHA-256 in `estimate_link_misses` by the hour through the
 * `estimate_link_miss` RPC, which answers the hour's count. Past ESTIMATE_LINK_MISS_LIMIT in the hour the function
 * answers 429 with ESTIMATE_LINK_LOCKED_WORDS instead of its 404: a customer who mistypes a code by hand never gets
 * there, a script does in its first minute. The lock is on misses only, so a customer with a working link behind the
 * same address is never turned away. The function does not know which code a miss aimed at, so there is nothing to
 * lock per code; a code is held by its own `expires_at` and by the count of live codes against 31^10.
 *
 * Fail open: a bump that fails (the RPC not yet pushed, a lost signal) is logged and counts as no lock, so the function
 * answers its 404 as before. Deno-free on purpose: `src/lib/estimateLinkMisses.test.ts` imports this file directly.
 */

/** Misses from one source in one hour past which its further misses answer 429. */
export const ESTIMATE_LINK_MISS_LIMIT = 20

/** The 429's words. The accept page shows a refusal by its class; these are for whoever reads the answer itself. */
export const ESTIMATE_LINK_LOCKED_WORDS = 'Too many wrong links from this connection in the last hour. Wait an hour, then open your link again.'

/** The 429's code, beside `expired` and `already_accepted`. */
export const ESTIMATE_LINK_LOCKED_CODE = 'locked'

/** The little of a Supabase client the guard uses, so a test hands a fake. */
export interface EstimateMissClient {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>
}

/** What the guard says about this miss: the hour's count from its source, and whether that source is locked. */
export interface EstimateLinkMiss {
  misses: number
  locked: boolean
}

/** Locked once the source passes the limit: the 21st miss in the hour and every one after it. A count that does not read is none. */
export function estimateLinkMissDecision(misses: unknown): EstimateLinkMiss {
  const n = typeof misses === 'number' && Number.isFinite(misses) && misses > 0 ? Math.floor(misses) : 0
  return { misses: n, locked: n > ESTIMATE_LINK_MISS_LIMIT }
}

/** The source of a request: the first hop of x-forwarded-for, else `none` (every address-less caller shares one count). */
export function estimateLinkSource(headers: { get(name: string): string | null }): string {
  const fwd = headers.get('x-forwarded-for')
  const first = fwd ? fwd.split(',')[0]?.trim() ?? '' : ''
  return first || 'none'
}

/** SHA-256 in lowercase hex, as the lookup hashes a token. */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Count this miss against its source and say whether the source is locked. Logs one line per miss (`estimate_link_miss`
 * with the function's name, the hour, the count and the lock), which lands in the function's logs. Never throws.
 */
export async function recordEstimateLinkMiss(
  admin: EstimateMissClient,
  req: { headers: { get(name: string): string | null } },
  fn: string,
  now: Date = new Date(),
): Promise<EstimateLinkMiss> {
  try {
    const sourceHash = await sha256Hex(estimateLinkSource(req.headers))
    const r = await admin.rpc('estimate_link_miss', { p_source_hash: sourceHash })
    if (r.error) {
      console.warn(JSON.stringify({ tag: 'estimate_link_miss', fn, failed: String((r.error as { message?: unknown })?.message ?? r.error) }))
      return { misses: 0, locked: false }
    }
    const d = estimateLinkMissDecision(r.data)
    console.warn(JSON.stringify({ tag: 'estimate_link_miss', fn, hour: now.toISOString().slice(0, 13), source: sourceHash.slice(0, 12), misses: d.misses, locked: d.locked }))
    return d
  } catch (e) {
    console.warn(JSON.stringify({ tag: 'estimate_link_miss', fn, failed: String(e) }))
    return { misses: 0, locked: false }
  }
}

/** The little of a Supabase client the lock's read uses, so a test hands a fake. */
export interface EstimateMissReader {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        eq(column: string, value: string): { maybeSingle(): PromiseLike<{ data: unknown; error: unknown }> }
      }
    }
  }
}

/** The hour a miss is counted under, as the database truncates it: the top of the UTC hour. */
export function estimateLinkMissHour(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours())).toISOString()
}

/**
 * Whether this source is locked this hour, read without counting anything (v2.7240, punch list #344 PR 5). An
 * estimate's link is ten letters, so its lock sits on misses alone and a right link always opens. A box's code is
 * eight characters of hex: a lock that still answers a right guess holds nothing, so `box-read` asks this before it
 * answers a hit and refuses a locked source either way. Fail open, as the count is: a read that fails is no lock.
 */
export async function readEstimateLinkLock(
  admin: EstimateMissReader,
  req: { headers: { get(name: string): string | null } },
  fn: string,
  now: Date = new Date(),
): Promise<EstimateLinkMiss> {
  try {
    const sourceHash = await sha256Hex(estimateLinkSource(req.headers))
    const r = await admin.from('estimate_link_misses').select('misses').eq('hour', estimateLinkMissHour(now)).eq('source_hash', sourceHash).maybeSingle()
    if (r.error) {
      console.warn(JSON.stringify({ tag: 'estimate_link_lock', fn, failed: String((r.error as { message?: unknown })?.message ?? r.error) }))
      return { misses: 0, locked: false }
    }
    return estimateLinkMissDecision((r.data as { misses?: unknown } | null)?.misses)
  } catch (e) {
    console.warn(JSON.stringify({ tag: 'estimate_link_lock', fn, failed: String(e) }))
    return { misses: 0, locked: false }
  }
}
