/**
 * Where Quo's API key comes from (v2.5718, the Quo connection in Settings): Vault first, through the service-role
 * function `quo_secret_get` of migration 20261021020000, which the owner fills from Settings → Phone and texts through
 * `quo-config`; then the function's own `QUO_API_KEY` secret (`supabase secrets set`), so a key saved in Settings wins
 * and nothing breaks while Vault holds none. No Deno globals: the environment comes in as a getter.
 *
 * Quo's versioned API (`https://api.quo.com`, the `Quo-Api-Version: 2026-03-30` header on every call, the bare key as
 * the Authorization header) is read here too: `quoGet` fetches one list, every page, for `quo-config`'s pickers.
 */

export type QuoKeyDb = { rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> }

export type QuoKeySource = 'vault' | 'env' | 'none'

/** The key and where it came from. `key` is '' when neither Vault nor the environment holds one. */
export async function loadQuoApiKey(db: QuoKeyDb, envGet: (k: string) => string | undefined): Promise<{ key: string; source: QuoKeySource }> {
  try {
    const { data, error } = await db.rpc('quo_secret_get')
    if (!error && typeof data === 'string' && data.trim()) return { key: data.trim(), source: 'vault' }
  } catch {
    /* no Vault function yet: the environment answers */
  }
  const env = envGet('QUO_API_KEY')?.trim() ?? ''
  return env ? { key: env, source: 'env' } : { key: '', source: 'none' }
}

/** Quo's API, the versioned one. */
export const QUO_API_BASE = 'https://api.quo.com'
export const QUO_API_VERSION = '2026-03-30'
/** Quo's largest page. */
const PAGE = 50
/** Pages read before a list is called long enough (500 numbers or people). */
const MAX_PAGES = 10

export type QuoListAnswer = { ok: true; items: unknown[] } | { ok: false; status: number; words: string }

/** What Quo's refusal says, in a line: its title and message when the body has them. */
function refusalWords(status: number, body: unknown): string {
  const b = (body && typeof body === 'object' ? body : {}) as { title?: unknown; message?: unknown }
  const parts = [b.title, b.message].filter((p): p is string => typeof p === 'string' && p.trim() !== '')
  return parts.length ? `${status}: ${parts.join(', ')}` : `${status}`
}

/**
 * `GET <base><path>` with the key, every page (`limit` 50, `after` the answer's `nextCursor`), the items in one list.
 * A page Quo refuses ends the read with its status and words.
 */
export async function quoGet(path: string, key: string, fetchFn: typeof fetch = fetch, base = QUO_API_BASE): Promise<QuoListAnswer> {
  const items: unknown[] = []
  let after: string | null = null
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(`${base}${path}`)
    url.searchParams.set('limit', String(PAGE))
    if (after) url.searchParams.set('after', after)
    const res = await fetchFn(url.toString(), { headers: { Authorization: key, 'Quo-Api-Version': QUO_API_VERSION }, signal: AbortSignal.timeout(15_000) })
    const body = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, status: res.status, words: refusalWords(res.status, body) }
    const data = (body as { data?: unknown } | null)?.data
    if (Array.isArray(data)) items.push(...data)
    const next = (body as { nextCursor?: unknown } | null)?.nextCursor
    after = typeof next === 'string' && next ? next : null
    if (!after) break
  }
  return { ok: true, items }
}
