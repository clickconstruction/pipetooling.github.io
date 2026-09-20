import { describe, expect, it } from 'vitest'
import {
  DENIED_TABLES,
  QUERY_MAX_CHARS,
  REDACTED,
  REPLY_MAX_CHARS,
  ROWS_MAX_LIMIT,
  buildRowsQuery,
  buildRpcQuery,
  clampLimit,
  isSafeIdent,
  isSecretKey,
  redactSecrets,
  replyText,
  searchNames,
} from '../../../supabase/functions/_shared/devMcpDoor'

const decode = (q: string) => Object.fromEntries(new URLSearchParams(q))

describe('isSafeIdent', () => {
  it('takes snake_case names and nothing that could leave the path or the column list', () => {
    expect(isSafeIdent('jobs_ledger')).toBe(true)
    expect(isSafeIdent('rpc/../auth')).toBe(false)
    expect(isSafeIdent('Jobs')).toBe(false)
    expect(isSafeIdent('a;drop')).toBe(false)
    expect(isSafeIdent('')).toBe(false)
    expect(isSafeIdent(7)).toBe(false)
  })
})

describe('secrets', () => {
  it('names the columns that carry a bearer secret, and not the dates beside them', () => {
    for (const k of ['token', 'public_token', 'token_hash', 'ct_view_token', 'password', 'code_hash', 'stripe_api_key', 'client_secret', 'auth', 'p256dh']) expect(isSecretKey(k)).toBe(true)
    for (const k of ['public_token_expires_at', 'tokens_used', 'hashtag', 'name', 'secretary', 'author', 'auth_user_id']) expect(isSecretKey(k)).toBe(false)
  })

  it('redacts at any depth, keeps null as null', () => {
    const out = redactSecrets([{ id: 1, token: 'abc', link: { token_hash: 'h', expires_at: 'x' }, rows: [{ password: null, note: 'n' }] }])
    expect(out).toEqual([{ id: 1, token: REDACTED, link: { token_hash: REDACTED, expires_at: 'x' }, rows: [{ password: null, note: 'n' }] }])
  })

  it('never reads the credential tables', () => {
    for (const t of ['dev_mcp_credentials', 'twin_credentials', 'twin_setup_codes', 'inspection_portal_credentials', 'push_subscriptions']) expect(DENIED_TABLES.has(t)).toBe(true)
  })
})

describe('buildRpcQuery', () => {
  it('passes scalars as text, arrays as a Postgres array literal, objects as JSON, and omits nulls', () => {
    const q = buildRpcQuery({ search_text: 'J1032', p_job_ids: ['a-1', 'b"2'], p_opts: { deep: true }, p_skip: null, p_n: 3 })
    expect(q.ok).toBe(true)
    if (!q.ok) return
    expect(decode(q.query)).toEqual({ search_text: 'J1032', p_job_ids: '{"a-1","b\\"2"}', p_opts: '{"deep":true}', p_n: '3' })
  })

  it('adds a clamped limit and refuses a bad argument name or an over-long request', () => {
    const limited = buildRpcQuery({}, 9999)
    expect(limited.ok && decode(limited.query)).toEqual({ limit: String(ROWS_MAX_LIMIT) })
    expect(buildRpcQuery({ 'p;x': 1 }).ok).toBe(false)
    const big = buildRpcQuery({ p_ids: Array.from({ length: 400 }, (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`) })
    expect(big.ok).toBe(false)
    if (!big.ok) expect(big.error).toContain(String(QUERY_MAX_CHARS))
  })
})

describe('buildRowsQuery', () => {
  const cols = new Set(['id', 'job_name', 'status', 'created_at', 'token'])

  it('defaults to select=* and the default limit', () => {
    const q = buildRowsQuery({}, cols)
    expect(q.ok && decode(q.query)).toEqual({ select: '*', limit: '50' })
  })

  it('builds filters, order and an embed select', () => {
    const q = buildRowsQuery(
      {
        select: 'id, job_name, customers(name)',
        filters: [
          { column: 'status', op: 'in', value: ['open', 'paid'] },
          { column: 'job_name', op: 'ilike', value: '*acme*' },
          { column: 'created_at', op: 'is', value: null },
        ],
        order: [{ column: 'created_at', ascending: false }, { column: 'id' }],
        limit: 5,
      },
      cols,
    )
    expect(q.ok).toBe(true)
    if (!q.ok) return
    const p = new URLSearchParams(q.query)
    expect(p.get('select')).toBe('id,job_name,customers(name)')
    expect(p.get('status')).toBe('in.("open","paid")')
    expect(p.get('job_name')).toBe('ilike.*acme*')
    expect(p.get('created_at')).toBe('is.null')
    expect(p.get('order')).toBe('created_at.desc,id.asc')
    expect(p.get('limit')).toBe('5')
  })

  it('refuses an unknown column, an unknown op, a secret column as a filter, and a select that is not a column list', () => {
    expect(buildRowsQuery({ filters: [{ column: 'nope', op: 'eq', value: 1 }] }, cols).ok).toBe(false)
    expect(buildRowsQuery({ filters: [{ column: 'id', op: 'not.eq', value: 1 }] }, cols).ok).toBe(false)
    expect(buildRowsQuery({ filters: [{ column: 'token', op: 'eq', value: 'x' }] }, cols).ok).toBe(false)
    expect(buildRowsQuery({ filters: [{ column: 'id', op: 'in', value: [] }] }, cols).ok).toBe(false)
    expect(buildRowsQuery({ order: [{ column: 'nope' }] }, cols).ok).toBe(false)
    expect(buildRowsQuery({ select: 'id&limit=9999' }, cols).ok).toBe(false)
  })

  it('refuses a denied table reached through an embed, by name or by constraint name', () => {
    expect(buildRowsQuery({ select: 'id,push_subscriptions(*)' }, cols).ok).toBe(false)
    expect(buildRowsQuery({ select: 'id,subs:push_subscriptions!inner(endpoint)' }, cols).ok).toBe(false)
    expect(buildRowsQuery({ select: 'id,Twin_Credentials_twin_user_id_fkey(*)' }, cols).ok).toBe(false)
    expect(buildRowsQuery({ select: 'id,customers(name)' }, cols).ok).toBe(true)
  })

  it('clamps the limit both ways', () => {
    expect(clampLimit(0)).toBe(1)
    expect(clampLimit(10_000)).toBe(ROWS_MAX_LIMIT)
    expect(clampLimit('12')).toBe(50)
  })
})

describe('searchNames / replyText', () => {
  it('needs every word, puts the exact name first, then the shortest', () => {
    const names = ['get_jobs_ledger_by_ids', 'search_jobs_ledger', 'jobs_ledger', 'list_job_account_strip']
    expect(searchNames(names, 'jobs ledger')).toEqual(['jobs_ledger', 'search_jobs_ledger', 'get_jobs_ledger_by_ids'])
    expect(searchNames(names, 'jobs_ledger')[0]).toBe('jobs_ledger')
    expect(searchNames(names, '')).toEqual([])
  })

  it('cuts an over-long reply and says so', () => {
    const text = replyText({ blob: 'x'.repeat(REPLY_MAX_CHARS + 10) })
    expect(text.length).toBeLessThan(REPLY_MAX_CHARS + 200)
    expect(text).toContain('cut at')
  })
})
