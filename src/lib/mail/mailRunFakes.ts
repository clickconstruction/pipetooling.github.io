/**
 * Fakes for the mail functions' handler tests (the Docsmit train, PR 3): a recording in-memory
 * database with the slice of the Supabase query builder the functions use, and a fake Docsmit
 * behind `fetch`. Nothing here reaches a network or a database.
 */

export type Row = Record<string, unknown>

export class FakeDb {
  tables: Record<string, Row[]> = {}
  writes: Array<{ table: string; op: 'insert' | 'update'; row: Row; where: Array<[string, unknown]> }> = []
  nextId = 1
  /** Database functions: each name's answer from its args, and every call recorded. */
  rpcAnswers: Record<string, (args: Record<string, unknown>) => unknown> = {}
  rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = []

  rpc(fn: string, args: Record<string, unknown>) {
    this.rpcCalls.push({ fn, args })
    const a = this.rpcAnswers[fn]
    const result = a ? { data: a(args), error: null } : { data: null, error: { message: `no function ${fn}` } }
    return { then: (res: (v: { data: unknown; error: { message: string } | null }) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(result).then(res, rej) }
  }

  from(table: string) {
    const rows = () => (this.tables[table] ??= [])
    const filters: Array<(r: Row) => boolean> = []
    const where: Array<[string, unknown]> = []
    let op: 'select' | 'update' | 'insert' = 'select'
    let patch: Row = {}
    let inserted: Row | null = null
    let lim = Infinity
    const run = () => {
      let list = rows().filter((r) => filters.every((f) => f(r)))
      if (op === 'update') {
        for (const r of list) Object.assign(r, patch)
        this.writes.push({ table, op: 'update', row: { ...patch }, where })
        return { data: list, error: null }
      }
      if (op === 'insert') {
        const row = { id: `id-${this.nextId++}`, ...inserted }
        rows().push(row)
        this.writes.push({ table, op: 'insert', row, where })
        list = [row]
        return { data: list, error: null }
      }
      if (lim !== Infinity) list = list.slice(0, lim)
      return { data: list, error: null }
    }
    const chain = {
      select: () => chain,
      eq: (k: string, v: unknown) => { filters.push((r) => r[k] === v); where.push([k, v]); return chain },
      in: (k: string, vs: unknown[]) => { filters.push((r) => vs.includes(r[k])); where.push([k, vs]); return chain },
      order: () => chain,
      limit: (n: number) => { lim = n; return chain },
      update: (p: Row) => { op = 'update'; patch = p; return chain },
      insert: (r: Row) => { op = 'insert'; inserted = r; return chain },
      single: async () => { const { data } = run(); return { data: (data as Row[])[0] ?? null, error: (data as Row[])[0] ? null : { message: 'no row' } } },
      maybeSingle: async () => { const { data } = run(); return { data: (data as Row[])[0] ?? null, error: null } },
      then: (res: (v: { data: unknown; error: null }) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(run()).then(res, rej),
    }
    return chain
  }
}

export type DocsmitCall = { method: string; path: string; body: unknown }
type Answer = { status?: number; body?: unknown; raw?: Uint8Array }

/** A Docsmit that answers from a script: each "METHOD /path" (or a ^regex) to its answer, and every call recorded. */
export class FakeDocsmit {
  calls: DocsmitCall[] = []
  answers: Record<string, Answer | ((call: DocsmitCall) => Answer)> = {}
  tokenCount = 0

  fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input instanceof Request ? input.url : input))
    const path = url.pathname.replace(/^\/api\/v1/, '')
    const method = init?.method ?? 'GET'
    let body: unknown = null
    if (typeof init?.body === 'string') { try { body = JSON.parse(init.body) } catch { body = init.body } }
    else if (init?.body instanceof FormData) body = { file: (init.body.get('file') as File | null)?.name ?? null }
    const call = { method, path, body }
    this.calls.push(call)
    if (path === '/token') {
      this.tokenCount++
      return new Response(JSON.stringify({ token: `tok-${this.tokenCount}` }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    const key = Object.keys(this.answers).find((k) => (k.startsWith('^') ? new RegExp(k).test(`${method} ${path}`) : k === `${method} ${path}`))
    const a = key ? this.answers[key] : undefined
    const ans = typeof a === 'function' ? a(call) : a
    if (!ans) return new Response(JSON.stringify({ message: `no answer for ${method} ${path}` }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    if (ans.raw) return new Response(ans.raw.buffer as ArrayBuffer, { status: ans.status ?? 200, headers: { 'Content-Type': 'application/pdf' } })
    return new Response(JSON.stringify(ans.body ?? {}), { status: ans.status ?? 200, headers: { 'Content-Type': 'application/json' } })
  }
}

/** A storage bucket behind the same `fetch`: the PDF the client wrote, and what the functions filed. */
export class FakeStorage {
  files: Record<string, Uint8Array> = {}
  fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input instanceof Request ? input.url : input)
    const m = url.match(/\/storage\/v1\/object\/(.+)$/)
    if (!m) return new Response('not storage', { status: 404 })
    const key = decodeURIComponent(m[1]!)
    if ((init?.method ?? 'GET') === 'POST') {
      this.files[key] = new Uint8Array(init?.body as ArrayBuffer)
      return new Response('{}', { status: 200 })
    }
    const f = this.files[key]
    if (!f) return new Response('missing', { status: 404 })
    return new Response(f.buffer as ArrayBuffer, { status: 200, headers: { 'Content-Type': 'application/pdf' } })
  }
}

/** One `fetch` for all three: Docsmit by host, storage by path, anything else refused. */
export function routeFetch(docsmit: FakeDocsmit, storage: FakeStorage): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input)
    if (url.includes('/storage/v1/')) return storage.fetch(input, init)
    if (url.includes('docsmit.com') || url.includes('tracksmit.com')) return docsmit.fetch(input, init)
    throw new Error(`unexpected fetch ${url}`)
  }) as typeof fetch
}
