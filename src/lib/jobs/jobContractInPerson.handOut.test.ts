import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The in-person door outside the Contract window (the Dashboard's Hand the phone, punch list #104,
 * v2.5119): a sent agreement with a live link opens on the link it already carries and calls
 * nothing, so a PDF emailed to sign stays a PDF send. A link near its end still goes through the send.
 */
const state: { rows: Record<string, unknown>[]; invoked: string[] } = { rows: [], invoked: [] }
vi.mock('../supabase', () => {
  const builder = (table: string) => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'is', 'order', 'limit', 'in']) b[m] = () => b
    b.maybeSingle = () => Promise.resolve({ data: null, error: null })
    b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: table === 'job_contracts' ? state.rows : [], error: null }).then(ok)
    return b
  }
  return {
    supabase: {
      from: (table: string) => builder(table),
      functions: {
        invoke: (name: string) => {
          state.invoked.push(name)
          return Promise.resolve({ data: { ok: true, sign_url: 'https://app.example/contract/sign?t=minted' }, error: null })
        },
      },
    },
  }
})
vi.mock('../fetchJobWithDetailsById', () => ({ fetchJobWithDetailsById: () => Promise.resolve({ id: 'j1', customer_name: 'Michael Palmer' }) }))

const { openInPersonSigning } = await import('./jobContractInPerson')

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString()
const sent = (p: Record<string, unknown> = {}) => ({ id: 'c1', job_id: 'j1', status: 'sent', voided_at: null, sent_channel: 'pdf_email', public_token: 'tok-pdf', public_token_expires_at: inDays(60), recipient_email: 'palmer@example.com', recipient_name: 'Michael Palmer', ...p })

beforeEach(() => {
  state.invoked = []
})

describe('openInPersonSigning — a sent agreement opens on its own link (#104)', () => {
  it('a PDF emailed to sign with a live link: its own link with the in-person flag, and no send', async () => {
    state.rows = [sent()]
    await expect(openInPersonSigning({ jobId: 'j1', authUserId: 'u1', origin: 'https://app.example' })).resolves.toEqual({
      ok: true,
      url: 'https://app.example/contract/sign?t=tok-pdf&inperson=1',
    })
    expect(state.invoked).toEqual([])
  })

  it('a link with a week or less left goes through the send, which renews it', async () => {
    state.rows = [sent({ public_token_expires_at: inDays(5) })]
    await expect(openInPersonSigning({ jobId: 'j1', authUserId: 'u1', origin: 'https://app.example' })).resolves.toEqual({
      ok: true,
      url: 'https://app.example/contract/sign?t=minted&inperson=1',
    })
    expect(state.invoked).toEqual(['send-job-contract'])
  })
})
