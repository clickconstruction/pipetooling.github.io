// @vitest-environment jsdom
/**
 * `useStripeMemoBackfill` (the Job form map's second pass, cut 3): the read the Job form makes on open for sent
 * Stripe bills that still lack their memo or footer. The edge function, the token and the job re-read are
 * stand-ins that record what was asked and in what order.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { JobWithDetails } from '../types/jobWithDetails'

const io = vi.hoisted(() => ({
  log: [] as string[],
  invokes: [] as Array<{ name: string; body: Record<string, unknown>; headers: Record<string, string> }>,
  token: 'tok-1' as string | null,
  reread: null as unknown,
  /** When set, each invoke waits on this before it answers. */
  gate: null as Promise<void> | null,
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: async (name: string, opts: { body: Record<string, unknown>; headers: Record<string, string> }) => {
        io.log.push(`invoke:${String(opts.body.jobs_ledger_invoice_id)}`)
        io.invokes.push({ name, body: opts.body, headers: opts.headers })
        if (io.gate) await io.gate
        io.log.push(`answered:${String(opts.body.jobs_ledger_invoice_id)}`)
        return { data: null, error: null }
      },
    },
  },
}))
vi.mock('../lib/supabaseAccessTokenForEdge', () => ({ getAccessTokenForEdgeFunctions: async () => io.token }))
vi.mock('../lib/fetchJobWithDetailsById', () => ({
  fetchJobWithDetailsById: async (id: string) => {
    io.log.push(`reread:${id}`)
    return io.reread
  },
}))
vi.mock('../lib/billingStripeModePref', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/billingStripeModePref')>()
  return { ...real, getBillingStripeModePref: () => 'test' }
})

import { useStripeMemoBackfill } from './useStripeMemoBackfill'

const inv = (id: string, over: Record<string, unknown> = {}) => ({ id, status: 'billed', stripe_invoice_id: `in_${id}`, hosted_invoice_url: `https://pay.example.com/${id}`, stripe_invoice_memo: null, stripe_invoice_footer: null, ...over })
const job = (invoices: unknown[], id = 'job-1') => ({ id, invoices }) as unknown as JobWithDetails
const settle = async () => {
  await act(async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve()
  })
}

beforeEach(() => {
  io.log = []
  io.invokes = []
  io.token = 'tok-1'
  io.reread = null
  io.gate = null
})

function mount(editing: JobWithDetails | null, authRole: 'dev' | 'assistant' = 'assistant') {
  const setEditing = vi.fn()
  const view = renderHook((p: { editing: JobWithDetails | null }) => useStripeMemoBackfill({ editing: p.editing, setEditing, authRole }), { initialProps: { editing } })
  return { setEditing, ...view }
}

describe('useStripeMemoBackfill', () => {
  it('asks Stripe for each waiting bill, one after the other, then reads the job again and shows it', async () => {
    const filled = job([inv('a', { stripe_invoice_memo: 'm', stripe_invoice_footer: 'f' }), inv('b', { stripe_invoice_memo: 'm', stripe_invoice_footer: 'f' })])
    io.reread = filled
    const { setEditing } = mount(job([inv('a'), inv('b')]))
    await settle()
    expect(io.log).toEqual(['invoke:a', 'answered:a', 'invoke:b', 'answered:b', 'reread:job-1'])
    expect(setEditing).toHaveBeenCalledTimes(1)
    expect(setEditing).toHaveBeenCalledWith(filled)
  })

  it('calls get-stripe-invoice-details with the bill, the caller’s token and live Stripe for everyone but a dev', async () => {
    mount(job([inv('a')]), 'assistant')
    await settle()
    expect(io.invokes).toEqual([{ name: 'get-stripe-invoice-details', body: { jobs_ledger_invoice_id: 'a', stripe_mode: 'live' }, headers: { Authorization: 'Bearer tok-1' } }])
  })

  it('a dev’s own Stripe mode rides the call', async () => {
    mount(job([inv('a')]), 'dev')
    await settle()
    expect(io.invokes[0]?.body).toEqual({ jobs_ledger_invoice_id: 'a', stripe_mode: 'test' })
  })

  it('asks nothing when no bill waits, and nothing with no job open', async () => {
    const quiet = mount(job([inv('a', { stripe_invoice_memo: 'm', stripe_invoice_footer: 'f' }), inv('b', { status: 'ready_to_bill' })]))
    await settle()
    const none = mount(null)
    await settle()
    expect(io.log).toEqual([])
    expect(quiet.setEditing).not.toHaveBeenCalled()
    expect(none.setEditing).not.toHaveBeenCalled()
  })

  it('asks nothing without a token', async () => {
    io.token = null
    const { setEditing } = mount(job([inv('a')]))
    await settle()
    expect(io.log).toEqual([])
    expect(setEditing).not.toHaveBeenCalled()
  })

  it('a re-read with the same bills waiting does not ask again', async () => {
    const { rerender } = mount(job([inv('a')]))
    await settle()
    expect(io.invokes).toHaveLength(1)
    // A new job object and a new invoice array, the same bill still waiting: the key holds.
    rerender({ editing: job([inv('a', { amount: 250 })]) })
    await settle()
    expect(io.invokes).toHaveLength(1)
  })

  it('a bill that starts waiting later is asked about, with the ones still waiting', async () => {
    const { rerender } = mount(job([inv('a')]))
    await settle()
    rerender({ editing: job([inv('a'), inv('b')]) })
    await settle()
    expect(io.invokes.map((c) => c.body.jobs_ledger_invoice_id)).toEqual(['a', 'a', 'b'])
  })

  it('a job the re-read cannot find is left as it was', async () => {
    io.reread = null
    const { setEditing } = mount(job([inv('a')]))
    await settle()
    expect(io.log).toEqual(['invoke:a', 'answered:a', 'reread:job-1'])
    expect(setEditing).not.toHaveBeenCalled()
  })

  it('a form closed mid-read stops: no further call, no re-read, nothing set', async () => {
    let open: () => void = () => {}
    io.gate = new Promise<void>((resolve) => {
      open = resolve
    })
    io.reread = job([])
    const { setEditing, unmount } = mount(job([inv('a'), inv('b')]))
    await settle()
    expect(io.log).toEqual(['invoke:a'])
    unmount()
    open()
    await settle()
    expect(io.log).toEqual(['invoke:a', 'answered:a'])
    expect(setEditing).not.toHaveBeenCalled()
  })
})
