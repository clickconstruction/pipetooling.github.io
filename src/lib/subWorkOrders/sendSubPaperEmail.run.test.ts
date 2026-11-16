/**
 * send-sub-paper-email's own handler, run here (punch list #350): the function that mails a sub their papers. It
 * goes to the roster's own address and nowhere else, only for the office roles who see sub pay, and each paper is
 * kept as a sent copy of its own. Its two URL imports are stood in for and `fetch` is recorded, so nothing here
 * reaches Resend, a bucket or a database.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

type Handler = (req: Request) => Promise<Response>
const box: { handler: Handler | null } = { handler: null }

// Made-up accounts and people.
const ROSA = '00000000-0000-4000-8000-0000000000c1'
const TARA = '00000000-0000-4000-8000-0000000000c2'
const MARISOL = '00000000-0000-4000-8000-0000000000c3'
const GAIL = '00000000-0000-4000-8000-0000000000c4'
const ACCOUNTS: Record<string, { role: string; name: string; read_only: boolean; archived_at: string | null }> = {
  [ROSA]: { role: 'assistant', name: 'Rosa Office', read_only: false, archived_at: null },
  [TARA]: { role: 'assistant', name: 'Tara Trainee', read_only: true, archived_at: null },
  [MARISOL]: { role: 'estimator', name: 'Marisol Estimator', read_only: false, archived_at: null },
  [GAIL]: { role: 'assistant', name: 'Gail Gone', read_only: false, archived_at: '2026-10-01T00:00:00Z' },
}
const HARLAN = '00000000-0000-4000-8000-0000000000e1'
const NO_EMAIL = '00000000-0000-4000-8000-0000000000e2'
const JOB_A = '00000000-0000-4000-8000-0000000000a1'
const JOB_B = '00000000-0000-4000-8000-0000000000a2'
const PEOPLE: Record<string, { id: string; name: string; email: string | null }> = {
  [HARLAN]: { id: HARLAN, name: 'Harlan Mechanical', email: ' harlan@harlanmechanical.example ' },
  [NO_EMAIL]: { id: NO_EMAIL, name: 'Ora Sub', email: null },
}

const fake = {
  callerId: ROSA as string | null,
  resendOk: true,
  /** Every request the function made, in order. */
  calls: [] as Array<{ url: string; body: unknown }>,
}

const from = (table: string) => {
  let id = ''
  const chain = {
    select: () => chain,
    eq: (_column: string, value: string) => ((id = value), chain),
    maybeSingle: async () => {
      if (table === 'users') return { data: ACCOUNTS[id] ?? null, error: null }
      if (table === 'people') return { data: PEOPLE[id] ?? null, error: null }
      return { data: null, error: null }
    },
  }
  return chain
}

vi.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({ serve: (h: Handler) => void (box.handler = h) }))
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({
  createClient: () => ({ from, auth: { getUser: async () => (fake.callerId ? { data: { user: { id: fake.callerId } }, error: null } : { data: { user: null }, error: { message: 'bad token' } }) } }),
}))

const ENV: Record<string, string> = { SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_ANON_KEY: 'anon-key', SUPABASE_SERVICE_ROLE_KEY: 'service-key', RESEND_API_KEY: 're_test' }
// A Deno file: loaded by path at run time, so the app's typecheck does not follow it into Deno's globals.
const FUNCTION_FILE = '../../../supabase/functions/send-sub-paper-email/index.ts'

beforeAll(async () => {
  ;(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => ENV[k] } }
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    let body: unknown = null
    try {
      body = typeof init?.body === 'string' ? JSON.parse(init.body) : null
    } catch {
      body = null
    }
    fake.calls.push({ url, body })
    if (url === 'https://api.resend.com/emails') return fake.resendOk ? new Response(JSON.stringify({ id: 'resend-1' }), { status: 200 }) : new Response(JSON.stringify({ message: 'The domain is not verified' }), { status: 403 })
    return new Response('{}', { status: 200 })
  })
  await import(/* @vite-ignore */ FUNCTION_FILE)
})
afterAll(() => {
  vi.unstubAllGlobals()
})
beforeEach(() => {
  fake.callerId = ROSA
  fake.resendOk = true
  fake.calls = []
})

// "%PDF" in base64: the function never opens the file, it carries it.
const PDF = 'JVBERi0='
const paper = (kind: string, file_name: string, job_ids: string[] = [JOB_A]) => ({ kind, title: file_name.replace(/\.pdf$/, ''), file_name, job_ids, pdf_base64: PDF })
const TWO = [paper('sub_statement_of_account', 'Statement of account.pdf', [JOB_A, JOB_B]), paper('sub_work_statement', 'Work statement 2041 Cedar Hollow Clinic.pdf')]

async function send(body: Record<string, unknown>, headers: Record<string, string> = { Authorization: 'Bearer caller-jwt' }): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await box.handler!(new Request('http://localhost/functions/v1/send-sub-paper-email', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }))
  return { status: res.status, body: (await res.json()) as Record<string, unknown> }
}
const mail = () => fake.calls.filter((c) => c.url === 'https://api.resend.com/emails')
const filed = () => fake.calls.filter((c) => c.url.endsWith('/rest/v1/sent_documents')).map((c) => c.body as Record<string, unknown>)

describe('send-sub-paper-email: who may send', () => {
  it('refuses a call with no login, and one whose token is not a session', async () => {
    expect((await send({ person_id: HARLAN, by: 'email', papers: TWO }, {})).status).toBe(401)
    fake.callerId = null
    expect((await send({ person_id: HARLAN, by: 'email', papers: TWO })).status).toBe(401)
    expect(fake.calls).toEqual([])
  })

  it('refuses an estimator, an account in training and an archived account, and sends nothing', async () => {
    fake.callerId = MARISOL
    expect(await send({ person_id: HARLAN, by: 'email', papers: TWO })).toEqual({ status: 403, body: { error: 'Only the office roles who see sub pay can send a sub paper.' } })
    fake.callerId = TARA
    expect(await send({ person_id: HARLAN, by: 'email', papers: TWO })).toEqual({ status: 403, body: { error: 'This account is in training mode and cannot send.' } })
    fake.callerId = GAIL
    expect((await send({ person_id: HARLAN, by: 'email', papers: TWO })).body.code).toBe('archived_caller')
    expect(fake.calls).toEqual([])
  })
})

describe('send-sub-paper-email: what it refuses, with the reason', () => {
  it('a texted link is not built, and is never sent as an email', async () => {
    expect(await send({ person_id: HARLAN, by: 'text', papers: TWO })).toEqual({ status: 400, body: { error: 'Texting a link to a paper is not built yet. Send by email, or copy the link.' } })
    expect(fake.calls).toEqual([])
  })

  it('no person, no paper, too many papers, a kind it does not know and a paper with no file', async () => {
    expect((await send({ person_id: 'harlan', by: 'email', papers: TWO })).body.error).toBe('person_id required')
    expect((await send({ person_id: HARLAN, by: 'email', papers: [] })).body.error).toBe('Send between 1 and 12 papers at a time.')
    expect((await send({ person_id: HARLAN, by: 'email', papers: Array.from({ length: 13 }, () => TWO[0]) })).body.error).toBe('Send between 1 and 12 papers at a time.')
    expect((await send({ person_id: HARLAN, by: 'email', papers: [paper('bill', 'Bill.pdf')] })).body.error).toBe('Unknown paper kind bill.')
    expect((await send({ person_id: HARLAN, by: 'email', papers: [{ ...TWO[0], pdf_base64: '' }] })).body.error).toBe('Statement of account.pdf is missing or too large to attach.')
    expect(fake.calls).toEqual([])
  })

  it('a person with no email on the roster names the door, and a person the caller cannot read is refused', async () => {
    expect(await send({ person_id: NO_EMAIL, by: 'email', papers: TWO })).toEqual({ status: 400, body: { error: 'Ora Sub has no email on the roster. Add one on People → Subs, then send.' } })
    expect((await send({ person_id: '00000000-0000-4000-8000-0000000000ff', by: 'email', papers: TWO })).status).toBe(403)
    expect(fake.calls).toEqual([])
  })
})

describe('send-sub-paper-email: the send', () => {
  it('goes to the roster’s own address as the company, whatever address the body names, with every PDF attached', async () => {
    const res = await send({ person_id: HARLAN, by: 'email', to_email: 'someone-else@elsewhere.example', subject: 'Your statement of account from Made-up Plumbing', message: 'Hi Harlan. <b>Here</b> is your statement.', papers: TWO })
    expect(res).toEqual({ status: 200, body: { ok: true, to: 'harlan@harlanmechanical.example', papers: 2, resend_email_id: 'resend-1' } })
    expect(mail()).toHaveLength(1)
    const sent = mail()[0]!.body as { from: string; to: string[]; subject: string; text: string; html: string; attachments: Array<{ filename: string; content: string }> }
    expect(sent.to).toEqual(['harlan@harlanmechanical.example'])
    // As the company by name, as every paper that leaves the office goes.
    expect(sent.from).toMatch(/^Click Plumbing and Electrical </)
    expect(sent.subject).toBe('Your statement of account from Made-up Plumbing')
    expect(sent.text).toBe('Hi Harlan. <b>Here</b> is your statement.')
    // What the office typed is words, never markup.
    expect(sent.html).toContain('Hi Harlan. &lt;b&gt;Here&lt;/b&gt; is your statement.')
    expect(sent.attachments).toEqual([{ filename: 'Statement of account.pdf', content: PDF }, { filename: 'Work statement 2041 Cedar Hollow Clinic.pdf', content: PDF }])
  })

  it('keeps each paper as a sent copy of its own, under its own kind, on the person and its jobs', async () => {
    await send({ person_id: HARLAN, by: 'email', subject: 'Your statement of account', message: 'Attached.', papers: TWO })
    const rows = filed()
    expect(rows.map((r) => r.kind)).toEqual(['sub_statement_of_account', 'sub_work_statement'])
    expect(rows.map((r) => r.job_ids)).toEqual([[JOB_A, JOB_B], [JOB_A]])
    for (const r of rows) {
      expect(r.person_id).toBe(HARLAN)
      expect(r.recipient_name).toBe('Harlan Mechanical')
      expect(r.recipient_emails).toEqual(['harlan@harlanmechanical.example'])
      expect(r.sent_by).toBe(ROSA)
      expect(r.how).toBe('email')
    }
    expect(rows.map((r) => (r.attachments as Array<{ name: string }>).map((a) => a.name))).toEqual([['Statement of account.pdf'], ['Work statement 2041 Cedar Hollow Clinic.pdf']])
  })

  it('a file name cannot carry a path, and a job id that is not an id is left off the filing', async () => {
    await send({ person_id: HARLAN, by: 'email', papers: [paper('sub_work_statement', '../../etc/passwd', ['not-an-id', JOB_A])] })
    expect((mail()[0]!.body as { attachments: Array<{ filename: string }> }).attachments[0]!.filename).toBe('.. .. etc passwd.pdf')
    expect(filed()[0]!.job_ids).toEqual([JOB_A])
  })

  it('an email Resend refuses says why, and no copy is filed for a paper that did not go', async () => {
    fake.resendOk = false
    expect(await send({ person_id: HARLAN, by: 'email', papers: TWO })).toEqual({ status: 502, body: { error: 'The email did not go: The domain is not verified' } })
    expect(filed()).toEqual([])
  })
})
