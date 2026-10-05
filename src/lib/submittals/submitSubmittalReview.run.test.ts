/**
 * submit-submittal-review's own handler, run here (v2.4599, #62): the function's `index.ts` with
 * its two URL imports stood in for and a fake database that records every read and write. It
 * proves the office refusal sits in front of everything the function does, and that a reviewer
 * with no session goes the way they always went. Nothing here reaches a real database.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { OFFICE_REFUSAL, PREVIEW_REFUSAL, type RoomWriteAction } from '../../../supabase/functions/_shared/submittalReviewActions'

type Handler = (req: Request) => Promise<Response>
const box: { handler: Handler | null } = { handler: null }
const db: { calls: string[]; user: { id: string } | null; role: string | null } = { calls: [], user: null, role: null }

type Chain = { [method: string]: (...args: unknown[]) => unknown }
function table(name: string): Chain {
  let op = 'select'
  const done = () => {
    db.calls.push(`${op} ${name}`)
    return { data: name === 'users' && db.role ? { role: db.role } : null, error: null, count: 0 }
  }
  const chain: Chain = {}
  for (const m of ['select', 'eq', 'ilike', 'in', 'is', 'not', 'gte', 'order', 'limit']) chain[m] = () => chain
  for (const m of ['insert', 'update', 'delete', 'upsert']) chain[m] = () => ((op = m), chain)
  chain.maybeSingle = () => Promise.resolve(done())
  chain.single = () => Promise.resolve(done())
  chain.then = (resolve: unknown, reject: unknown) => Promise.resolve(done()).then(resolve as (v: unknown) => unknown, reject as (e: unknown) => unknown)
  return chain
}

vi.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({ serve: (h: Handler) => void (box.handler = h) }))
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({
  createClient: () => ({
    auth: {
      getUser: async () => {
        db.calls.push('auth.getUser')
        return db.user ? { data: { user: db.user }, error: null } : { data: { user: null }, error: { message: 'invalid JWT' } }
      },
    },
    from: (name: string) => table(name),
  }),
}))

const ENV: Record<string, string> = { SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_SERVICE_ROLE_KEY: 'service-key', SUPABASE_ANON_KEY: 'anon-key' }

// A Deno file: loaded by path at run time, so the app's typecheck does not follow it into Deno's globals.
const FUNCTION_FILE = '../../../supabase/functions/submit-submittal-review/index.ts'

beforeAll(async () => {
  ;(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => ENV[k] } }
  await import(/* @vite-ignore */ FUNCTION_FILE)
})
beforeEach(() => {
  db.calls = []
  db.user = null
  db.role = null
})

const BODIES: Record<RoomWriteAction, Record<string, unknown>> = {
  identify: { action: 'identify', token: 'room-token', name: 'Dana Whitfield', email: 'dana@example.com', role: 'architect', website: '' },
  message: { action: 'message', token: 'room-token', body: 'Is WC-1 in stock?', tags: ['WC-1'], website: '' },
  decide: { action: 'decide', token: 'person-token', submittalId: 'rev-1', decisions: [{ itemId: 'item-1', decision: 'approved' }] },
}
const actions = Object.keys(BODIES) as RoomWriteAction[]

async function post(action: RoomWriteAction, o: { preview?: boolean; bearer?: string } = {}) {
  const res = await box.handler!(new Request(`http://localhost/functions/v1/submit-submittal-review${o.preview ? '?preview=1' : ''}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${o.bearer ?? 'anon-key'}` },
    body: JSON.stringify(BODIES[action]),
  }))
  return { status: res.status, body: (await res.json()) as { error?: string; code?: string } }
}

describe('submit-submittal-review refuses the office (v2.4599, #62)', () => {
  it('the office’s preview: every write is refused before anything is read or written', async () => {
    for (const action of actions) {
      db.calls = []
      expect(await post(action, { preview: true })).toEqual({ status: 403, body: { error: PREVIEW_REFUSAL, code: 'preview' } })
      expect(db.calls).toEqual([])
    }
  })

  it('a verified office session: every write is refused; the only reads are the auth check and the role', async () => {
    db.user = { id: 'user-1' }
    db.role = 'assistant'
    for (const action of actions) {
      db.calls = []
      expect(await post(action, { bearer: 'office-jwt' })).toEqual({ status: 403, body: { error: OFFICE_REFUSAL[action], code: 'office' } })
      expect(db.calls).toEqual(['auth.getUser', 'select users'])
    }
  })

  it('a reviewer with no session goes the way it always went: no auth check, straight to the room', async () => {
    const expected: Record<RoomWriteAction, number> = { identify: 404, message: 404, decide: 401 }
    for (const action of actions) {
      db.calls = []
      const res = await post(action)
      expect(res.status).toBe(expected[action])
      expect(db.calls).not.toContain('auth.getUser')
      expect(db.calls[0]).toBe('select bid_submittal_rooms')
    }
  })

  it('a session the auth server does not resolve, or a role that is not the office, is not refused', async () => {
    expect((await post('identify', { bearer: 'forged-jwt' })).status).toBe(404)
    db.user = { id: 'user-2' }
    db.role = 'subcontractor'
    db.calls = []
    expect((await post('decide', { bearer: 'sub-jwt' })).status).toBe(401)
    expect(db.calls.slice(0, 3)).toEqual(['auth.getUser', 'select users', 'select bid_submittal_rooms'])
  })
})
