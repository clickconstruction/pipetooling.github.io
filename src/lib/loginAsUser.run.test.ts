/**
 * login-as-user's own handler, run here (punch list #230, v2.6290): the function behind Imitate and View as. Since
 * v2.6290 every imitation is on record before its link exists. The function writes `user_imitations` as the service
 * role, and opens no imitation it cannot record, since gmail-mine reads the record to refuse the session the link opens
 * (`src/lib/myMail/imitation.ts`). Its two URL imports are stood in for. Nothing here reaches a real database or GoTrue.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

type Handler = (req: Request) => Promise<Response>
const box: { handler: Handler | null } = { handler: null }

// Made-up accounts: Robert the dev, Mia a master, Rosa an assistant, Marisol an estimator.
const ACCOUNTS = [
  { id: 'u-dev', email: 'robert@douglasmining.example', role: 'dev' },
  { id: 'u-mia', email: 'mia@clickplumbing.example', role: 'master_technician' },
  { id: 'u-rosa', email: 'rosa@clickplumbing.example', role: 'assistant' },
  { id: 'u-marisol', email: 'marisol@clickplumbing.example', role: 'estimator' },
]
const fake = {
  callerId: 'u-dev',
  /** What the function did, in order: `insert user_imitations`, `generateLink <email>`. */
  steps: [] as string[],
  recorded: [] as Record<string, unknown>[],
  recordError: null as { message: string } | null,
}

const roleOf = (id: string) => {
  const account = ACCOUNTS.find((a) => a.id === id)
  return account ? { data: { role: account.role }, error: null } : { data: null, error: { message: 'no row' } }
}
/** `from('users').select('role').eq('id', id).single()`, and the service role's insert into `user_imitations`. */
const from = (table: string) => {
  let id = ''
  const chain = {
    select: () => chain,
    eq: (_column: string, value: string) => ((id = value), chain),
    single: async () => (table === 'users' ? roleOf(id) : { data: null, error: { message: 'no row' } }),
    insert: async (row: Record<string, unknown>) => {
      fake.steps.push(`insert ${table}`)
      if (fake.recordError) return { data: null, error: fake.recordError }
      fake.recorded.push(row)
      return { data: null, error: null }
    },
  }
  return chain
}

vi.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({ serve: (h: Handler) => void (box.handler = h) }))
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({
  createClient: (_url: string, key: string) =>
    key === 'service-key'
      ? {
          from,
          auth: {
            admin: {
              listUsers: async () => ({ data: { users: ACCOUNTS.map(({ id, email }) => ({ id, email })), nextPage: null }, error: null }),
              generateLink: async (args: { email: string }) => {
                fake.steps.push(`generateLink ${args.email}`)
                return { data: { properties: { action_link: 'https://project.supabase.example/auth/v1/verify?token=hashed&type=magiclink' } }, error: null }
              },
            },
          },
        }
      : { from, auth: { getUser: async () => ({ data: { user: { id: fake.callerId } }, error: null }) } },
}))

const ENV: Record<string, string> = { SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_ANON_KEY: 'anon-key', SUPABASE_SERVICE_ROLE_KEY: 'service-key' }
// A Deno file: loaded by path at run time, so the app's typecheck does not follow it into Deno's globals.
const FUNCTION_FILE = '../../supabase/functions/login-as-user/index.ts'

beforeAll(async () => {
  ;(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => ENV[k] } }
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  await import(/* @vite-ignore */ FUNCTION_FILE)
})
afterAll(() => {
  vi.restoreAllMocks()
})
beforeEach(() => {
  fake.callerId = 'u-dev'
  fake.steps = []
  fake.recorded = []
  fake.recordError = null
})

async function imitate(email: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await box.handler!(
    new Request('http://localhost/functions/v1/login-as-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer caller-jwt' },
      body: JSON.stringify({ email, redirectTo: 'https://pipetooling.com/messages?tab=my-email' }),
    }),
  )
  return { status: res.status, body: (await res.json()) as Record<string, unknown> }
}

describe('login-as-user: every imitation on record before its link', () => {
  it('records who imitated whom as the service role, then makes the link and hands it out', async () => {
    const res = await imitate('Marisol@ClickPlumbing.example')
    expect(res).toEqual({ status: 200, body: { success: true, action_link: 'https://project.supabase.example/auth/v1/verify?token=hashed&type=magiclink' } })
    expect(fake.recorded).toEqual([{ operator_id: 'u-dev', target_id: 'u-marisol' }])
    expect(fake.steps).toEqual(['insert user_imitations', 'generateLink Marisol@ClickPlumbing.example'])
  })

  it('records an assistant’s imitation the same way', async () => {
    fake.callerId = 'u-rosa'
    expect((await imitate('marisol@clickplumbing.example')).status).toBe(200)
    expect(fake.recorded).toEqual([{ operator_id: 'u-rosa', target_id: 'u-marisol' }])
  })

  it('opens no imitation it cannot record: no link is made and none comes back', async () => {
    fake.recordError = { message: 'new row violates row-level security policy for table "user_imitations"' }
    const res = await imitate('marisol@clickplumbing.example')
    expect(res).toEqual({ status: 500, body: { error: 'The app could not record this imitation, so it did not open one.' } })
    expect(fake.steps).toEqual(['insert user_imitations'])
  })

  it('records nothing when it refuses: a dev as the target, an assistant on a master, a caller who may not imitate', async () => {
    expect(await imitate('robert@douglasmining.example')).toMatchObject({ status: 403, body: { error: 'Cannot impersonate a dev' } })
    fake.callerId = 'u-rosa'
    expect(await imitate('mia@clickplumbing.example')).toMatchObject({ status: 403, body: { error: 'Assistants cannot impersonate masters' } })
    fake.callerId = 'u-marisol'
    expect((await imitate('rosa@clickplumbing.example')).status).toBe(403)
    expect(fake.steps).toEqual([])
    expect(fake.recorded).toEqual([])
  })
})
