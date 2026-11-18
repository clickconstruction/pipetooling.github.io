// @vitest-environment jsdom
/**
 * The Stripe memo backfill, on the form itself (the Job form map's second pass, cut 3). `useStripeMemoBackfill`
 * and its kernel have their own tests; this pins the wiring: an open job with a sent Stripe bill that lacks its
 * memo is asked about once and read again, and the bill view's close re-reads the job until the bill has both
 * or three tries are spent. The bill view is a stand-in with one press, since the loop is the form's.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

const io = vi.hoisted(() => ({
  invokes: [] as Array<{ name: string; body: Record<string, unknown> }>,
  rereads: 0,
  /** What each read of the job answers, in turn; the last one repeats. */
  jobs: [] as unknown[],
}))

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as unknown as Record<string, unknown>
  return {
    supabase: {
      ...stub,
      functions: {
        invoke: async (name: string, opts: { body: Record<string, unknown> }) => {
          io.invokes.push({ name, body: opts.body })
          return { data: null, error: null }
        },
      },
    },
  }
})
vi.mock('../../lib/supabaseAccessTokenForEdge', () => ({ getAccessTokenForEdgeFunctions: async () => 'tok-1' }))
vi.mock('../../lib/fetchJobWithDetailsById', () => ({
  fetchJobWithDetailsById: async () => {
    const answer = io.jobs[Math.min(io.rereads, io.jobs.length - 1)]
    io.rereads += 1
    return answer
  },
}))
vi.mock('./BilledBillViewModal', () => ({
  default: ({ invoice, onClose }: { invoice: { id: string } | null; onClose: () => void }) =>
    invoice ? (
      <button type="button" onClick={onClose}>
        close the bill view of {invoice.id}
      </button>
    ) : null,
}))

import { makeInvoice, makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import JobFormModal from './JobFormModal'

const line = (id: string, name: string, price: number, seq: number, invoiceId: string | null) => ({ id, job_id: 'job-elm', name, count: 1, line_unit_price: price, line_description: null, invoice_id: invoiceId, sequence_order: seq, line_kind: 'work', stage_kind: null, shared_with_gc: false })
const stripeBill = (over: Record<string, unknown> = {}) =>
  makeInvoice({ id: 'inv-elm', job_id: 'job-elm', amount: 1_200, status: 'billed', sequence_order: 0, billed_at: '2026-10-01T15:00:00Z', stripe_invoice_id: 'in_elm', hosted_invoice_url: 'https://pay.example.com/in_elm', stripe_invoice_memo: null, stripe_invoice_footer: null, ...over })
const elmStreet = (bill: unknown) => makeJob({ id: 'job-elm', hcp_number: '963', job_name: 'Elm Street', status: 'working', revenue: 2_000, fixtures: [line('f-rough', 'Rough-in', 1_200, 0, 'inv-elm'), line('f-final', 'Final', 800, 1, null)], invoices: [bill] })
const waiting = () => elmStreet(stripeBill())
const filled = () => elmStreet(stripeBill({ stripe_invoice_memo: 'Rough-in', stripe_invoice_footer: 'Thank you' }))

beforeEach(() => {
  io.invokes = []
  io.rereads = 0
  io.jobs = []
})

async function openElmStreet() {
  renderWithProviders(
    <JobFormModal mode="edit" editJobId="job-elm" initialJob={null} billingCustomerHighlightInitial={false} fixturesSectionHighlightInitial={false} jobPicturesLinkHighlightInitial={false} alsoOpenCreateCustomerModal={false} onClose={() => {}} onSaved={null} />,
  )
  await settle()
  await screen.findByDisplayValue('Elm Street')
  await settle()
}

const memoCalls = () => io.invokes.filter((c) => c.name === 'get-stripe-invoice-details')

describe('Edit Job: the Stripe memo backfill', () => {
  it('a sent Stripe bill with no memo is asked about once on open, and the job is read again and shown', async () => {
    // The re-read answers with a second bill on the job, so what it read is seen on the form.
    const reread = elmStreet(stripeBill({ stripe_invoice_memo: 'Rough-in', stripe_invoice_footer: 'Thank you' }))
    reread.invoices.push(stripeBill({ id: 'inv-elm-2', amount: 300, sequence_order: 1, stripe_invoice_id: 'in_elm2', hosted_invoice_url: 'https://pay.example.com/in_elm2', stripe_invoice_memo: 'Final', stripe_invoice_footer: 'Thank you' }))
    io.jobs = [waiting(), reread]
    await openElmStreet()
    expect(memoCalls()).toEqual([{ name: 'get-stripe-invoice-details', body: { jobs_ledger_invoice_id: 'inv-elm', stripe_mode: 'live' } }])
    // The open's own read, then the backfill's.
    expect(io.rereads).toBe(2)
    await waitFor(() => expect(screen.getAllByTitle('Open this bill')).toHaveLength(2))
  })

  it('a bill whose memo never comes is not asked about over and over: the same bill waiting keys one read', async () => {
    io.jobs = [waiting()]
    await openElmStreet()
    expect(memoCalls()).toHaveLength(1)
    expect(io.rereads).toBe(2)
  })

  it('a job whose bills have their memo and footer asks Stripe nothing', async () => {
    io.jobs = [filled()]
    await openElmStreet()
    expect(memoCalls()).toEqual([])
    expect(io.rereads).toBe(1)
  })

  it('closing the bill view re-reads the job once when the bill has its memo and footer', async () => {
    io.jobs = [filled()]
    await openElmStreet()
    fireEvent.click(screen.getAllByTitle('Open this bill')[0]!)
    fireEvent.click(await screen.findByText('close the bill view of inv-elm'))
    await waitFor(() => expect(io.rereads).toBe(2))
    await new Promise((r) => setTimeout(r, 700))
    expect(io.rereads).toBe(2)
  })

  it('closing the bill view while the bill still lacks its memo re-reads three times, then stops', async () => {
    io.jobs = [waiting()]
    await openElmStreet()
    const before = io.rereads
    fireEvent.click(screen.getAllByTitle('Open this bill')[0]!)
    fireEvent.click(await screen.findByText('close the bill view of inv-elm'))
    await waitFor(() => expect(io.rereads).toBe(before + 3), { timeout: 3000 })
    await new Promise((r) => setTimeout(r, 700))
    expect(io.rereads).toBe(before + 3)
  })

  it('closing the bill view stops re-reading as soon as the memo and footer arrive', async () => {
    io.jobs = [waiting(), waiting(), waiting(), filled()]
    await openElmStreet()
    expect(io.rereads).toBe(2)
    fireEvent.click(screen.getAllByTitle('Open this bill')[0]!)
    fireEvent.click(await screen.findByText('close the bill view of inv-elm'))
    // The first try reads a bill still waiting, the second reads it filled: two, not three.
    await waitFor(() => expect(io.rereads).toBe(4), { timeout: 3000 })
    await new Promise((r) => setTimeout(r, 700))
    expect(io.rereads).toBe(4)
  })
})
