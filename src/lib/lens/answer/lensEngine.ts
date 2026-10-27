/**
 * The lens's engine (punch list #194): a sealed frame's every request to the Supabase address
 * lands here and is answered from the invented world, the way each server would answer it.
 * `/rest/v1` goes to the PostgREST reader; an RPC answers from its handler, or by the rule its
 * return type allows; `/auth/v1` answers for the frame's person; `/storage/v1` and
 * `/functions/v1` answer from handlers or with an error. The state knob is applied here: empty,
 * loading, slow, failing, offline and training mode are the world's answers, so no page needs a
 * line of code to show them. Every answer is reported as an ask, which the tab counts as gaps.
 *
 * This module is the lens's own chunk: only a sealed frame loads it, and the service worker does
 * not precache it (vite.config.ts), so nobody else downloads the world.
 */
import schema from 'virtual:lens-schema'
import { answerAuth } from '../lensAuth'
import type { LensConfig } from '../lensName'
import { buildLensWorld, type LensWorld, type LensWorldCtx } from '../world/lensWorld'
import { LensUnsupported } from './lensUnsupported'
import type { LensSchema } from './lensSchemaTypes'
import { answerRpcRows, answerTable, pgError, type RestAnswer, type RestCall, type Row } from './postgrest'

export type LensAskKind = 'table' | 'rpc' | 'function' | 'auth' | 'storage' | 'other'

/**
 * One request and who answered it: `world` from the world's rows or a handler, `rule` by rule
 * (a table the world holds nothing for, or an RPC with no handler that returns a set or a scalar),
 * `missing` an error because the world has no answer, `unread` a request the reader cannot read
 * yet, `mood` the state knob's answer, `refused` an error the real server would give too.
 */
export type LensAsk = { kind: LensAskKind; name: string; method: string; by: 'world' | 'rule' | 'missing' | 'unread' | 'mood' | 'refused'; status: number; detail?: string }

export type LensRequest = { method: string; headers: Headers; bodyText: string | null }

export type LensEngine = {
  world: LensWorld
  handle(url: URL, req: LensRequest): Promise<Response>
}

/** Read in every state but offline, so the frame keeps its person and its settings. */
const IDENTITY_TABLES = new Set(['users', 'app_settings'])

const FILTER_VALUE = /^(not\.)?(eq|neq|gt|gte|lt|lte|like|ilike|match|imatch|is|isdistinct|in|cs|cd|ov|fts|plfts|phfts|wfts)\./

function respond(a: RestAnswer): Response {
  const empty = a.status === 204 || a.status === 304 || a.body === undefined
  return new Response(empty ? null : JSON.stringify(a.body), { status: a.status, headers: a.headers })
}

function json(status: number, body: unknown): Response {
  return respond({ status, headers: { 'Content-Type': 'application/json; charset=utf-8' }, body })
}

function parseBody(text: string | null): unknown {
  if (text == null || text === '') return undefined
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function createLensEngine(cfg: LensConfig, opts: { report?: (a: LensAsk) => void; now?: () => Date; schema?: LensSchema; world?: LensWorld; slowMs?: number } = {}): LensEngine {
  const world = opts.world ?? buildLensWorld(cfg)
  const sch = opts.schema ?? schema
  const now = opts.now ?? (() => new Date())
  const report = (a: LensAsk) => opts.report?.(a)
  const ctx = (): LensWorldCtx => ({ viewer: world.viewer, mood: world.mood, store: world.store, now: now(), readOnly: world.readOnly })

  function rest(path: string, url: URL, req: LensRequest): Response {
    const body = parseBody(req.bodyText)
    if (path.startsWith('rpc/')) return rpc(path.slice(4), url, req, body)
    const table = decodeURIComponent(path)
    const call: RestCall = { method: req.method, table, params: url.searchParams, header: (n) => req.headers.get(n), body }
    // Training mode refuses writes, as the database's read-only trigger does, except the
    // person's own clock punches, which it allows.
    const readOnly = world.readOnly && table !== 'clock_sessions'
    let answer: RestAnswer
    try {
      answer = answerTable({ schema: sch, store: world.store, readOnly, now }, call)
    } catch (e) {
      if (!(e instanceof LensUnsupported)) throw e
      report({ kind: 'table', name: table, method: req.method, by: 'unread', status: 400, detail: e.message })
      return json(400, { code: 'LENS', message: e.message, details: null, hint: null })
    }
    const had = world.store.rows(table).length > 0
    const by = answer.status >= 400 ? 'refused' : req.method === 'GET' || req.method === 'HEAD' ? (had ? 'world' : 'rule') : 'world'
    report({ kind: 'table', name: table, method: req.method, by, status: answer.status })
    return respond(answer)
  }

  function rpc(name: string, url: URL, req: LensRequest, body: unknown): Response {
    // A GET RPC carries its arguments as query parameters; the rest of the query filters the result.
    const filters = new URLSearchParams()
    const args: Record<string, unknown> = body && typeof body === 'object' && !Array.isArray(body) ? { ...(body as Record<string, unknown>) } : {}
    for (const [k, v] of url.searchParams) {
      if (req.method !== 'POST' && !['select', 'order', 'limit', 'offset'].includes(k) && !k.includes('.') && k !== 'or' && k !== 'and' && !FILTER_VALUE.test(v)) args[k] = v
      else filters.append(k, v)
    }
    const call: RestCall = { method: req.method === 'HEAD' ? 'HEAD' : 'GET', table: `rpc/${name}`, params: filters, header: (n) => req.headers.get(n), body }
    const handler = world.rpc[name]
    const kind = sch.rpcs[name]
    if (!handler && !kind) {
      report({ kind: 'rpc', name, method: req.method, by: 'refused', status: 404 })
      return respond(pgError(404, 'PGRST202', `Could not find the function public.${name} without parameters in the schema cache`))
    }
    let value: unknown
    let by: LensAsk['by'] = 'world'
    if (handler) {
      value = handler(args, ctx())
    } else if (kind === 'set') {
      value = []
      by = 'rule'
    } else if (kind === 'scalar' || kind === 'void') {
      by = 'rule'
      report({ kind: 'rpc', name, method: req.method, by, status: kind === 'void' ? 204 : 200 })
      return kind === 'void' ? new Response(null, { status: 204 }) : json(200, null)
    } else {
      report({ kind: 'rpc', name, method: req.method, by: 'missing', status: 500 })
      return respond(pgError(500, 'LENS', `The lens has no answer for public.${name}() yet.`))
    }
    if (Array.isArray(value)) {
      try {
        const a = answerRpcRows({ schema: sch, store: world.store, now }, call, value as Row[])
        report({ kind: 'rpc', name, method: req.method, by, status: a.status })
        return respond(a)
      } catch (e) {
        if (!(e instanceof LensUnsupported)) throw e
        report({ kind: 'rpc', name, method: req.method, by: 'unread', status: 400, detail: e.message })
        return json(400, { code: 'LENS', message: e.message, details: null, hint: null })
      }
    }
    report({ kind: 'rpc', name, method: req.method, by, status: value === undefined ? 204 : 200 })
    return value === undefined ? new Response(null, { status: 204 }) : json(200, value)
  }

  function auth(path: string, url: URL, req: LensRequest): Response {
    if (path === 'token' && url.searchParams.get('grant_type') !== 'refresh_token') {
      report({ kind: 'auth', name: path, method: req.method, by: 'refused', status: 400 })
      return json(400, { code: 400, error_code: 'invalid_credentials', msg: 'The lens signs in its own invented people only.' })
    }
    const a = answerAuth(path, req.method, world.viewer, Math.floor(now().getTime() / 1000))
    report({ kind: 'auth', name: path, method: req.method, by: a.status >= 400 ? 'refused' : 'world', status: a.status })
    return a.status === 204 ? new Response(null, { status: 204 }) : json(a.status, a.body)
  }

  function storage(path: string, req: LensRequest): Response {
    const body = parseBody(req.bodyText) as { paths?: string[] } | undefined
    let out: { status: number; body: unknown }
    const signOne = path.match(/^object\/sign\/([^/]+)\/(.+)$/)
    const signMany = path.match(/^object\/sign\/([^/]+)$/)
    if (signOne) out = { status: 200, body: { signedURL: `/object/sign/${signOne[1]}/${signOne[2]}?token=lens` } }
    else if (signMany) out = { status: 200, body: (body?.paths ?? []).map((p) => ({ path: p, signedURL: `/object/sign/${signMany[1]}/${p}?token=lens`, error: null })) }
    else if (path.startsWith('object/list/')) out = { status: 200, body: [] }
    else if (path.startsWith('bucket')) out = { status: 200, body: [] }
    else if (req.method === 'POST' || req.method === 'PUT') out = { status: 200, body: { Key: path.replace(/^object\//, ''), Id: crypto.randomUUID() } }
    else if (req.method === 'DELETE') out = { status: 200, body: [] }
    else out = { status: 404, body: { statusCode: '404', error: 'not_found', message: 'The lens holds no files.' } }
    report({ kind: 'storage', name: path.split('/').slice(0, 2).join('/'), method: req.method, by: out.status >= 400 ? 'missing' : 'rule', status: out.status })
    return json(out.status, out.body)
  }

  function functions(name: string, req: LensRequest): Response {
    const handler = world.functions[name]
    if (!handler) {
      report({ kind: 'function', name, method: req.method, by: 'missing', status: 501 })
      return json(501, { error: `The lens has no answer for the ${name} function yet.` })
    }
    const value = handler(parseBody(req.bodyText), ctx())
    report({ kind: 'function', name, method: req.method, by: 'world', status: 200 })
    return json(200, value)
  }

  async function handle(url: URL, req: LensRequest): Promise<Response> {
    const m = url.pathname.match(/\/(rest|auth|storage|functions)\/v1\/?(.*)$/)
    if (!m) {
      report({ kind: 'other', name: url.pathname, method: req.method, by: 'missing', status: 404 })
      return json(404, { message: 'The lens answers the database, sign-in, files and functions only.' })
    }
    const svc = m[1]!
    const path = m[2] ?? ''
    const kind: LensAskKind = svc === 'rest' ? (path.startsWith('rpc/') ? 'rpc' : 'table') : svc === 'functions' ? 'function' : (svc as LensAskKind)
    const name = svc === 'rest' ? (path.startsWith('rpc/') ? path.slice(4) : path) : path
    if (world.mood === 'offline') {
      report({ kind, name, method: req.method, by: 'mood', status: 0 })
      throw new TypeError('Failed to fetch')
    }
    const identity = svc === 'auth' || (kind === 'table' && IDENTITY_TABLES.has(path))
    if (!identity) {
      if (world.mood === 'loading') {
        report({ kind, name, method: req.method, by: 'mood', status: 0 })
        return new Promise<Response>(() => undefined)
      }
      if (world.mood === 'slow') await sleep(opts.slowMs ?? 2500)
      if (world.mood === 'error') {
        report({ kind, name, method: req.method, by: 'mood', status: 503 })
        if (svc === 'functions') return json(503, { error: 'The lens is failing this request on purpose.' })
        return json(503, { code: 'PGRST000', message: 'The lens is failing this read on purpose.', details: null, hint: null })
      }
    }
    if (svc === 'rest') return rest(path, url, req)
    if (svc === 'auth') return auth(path, url, req)
    if (svc === 'storage') return storage(path, req)
    return functions(path.split('/')[0] ?? path, req)
  }

  return { world, handle }
}
