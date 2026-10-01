// @vitest-environment jsdom
/**
 * View bill's paperwork card (v2.4299): on a GC job the lien waiver row leads with the move owed
 * and opens the Release of Lien window on this bill; the GC's missing waiver email is filled from
 * the bill's, only over a blank; a homeowner job with no waiver shows no waiver row and leaves
 * Send contract as the card's filled button.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { makeInvoice, makeJob, renderSettled, settle } from '../../test/renderSmokeMocks'
import BillPaperworkCard from './BillPaperworkCard'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'assistant-1' }, role: 'assistant', profileName: 'Taunya' }) }))

const seen = vi.hoisted(() => ({
  contractQuiet: [] as boolean[],
  windowFor: null as string | null,
  gcEmail: null as string | null,
  updates: [] as Array<{ payload: Record<string, unknown>; filters: string[] }>,
}))

vi.mock('./JobContractStrip', () => ({
  default: ({ quiet }: { quiet?: boolean }) => {
    seen.contractQuiet.push(Boolean(quiet))
    return <div data-testid="contract-row-stub">{quiet ? 'quiet' : 'filled'}</div>
  },
}))
vi.mock('./JobWorkOrderStrip', () => ({ default: () => <div data-testid="work-order-row-stub" /> }))
vi.mock('./LienReleaseModal', () => ({
  default: ({ open, invoice }: { open: boolean; invoice: { id: string } | null }) => {
    if (open) seen.windowFor = invoice?.id ?? null
    return open ? <div data-testid="release-window-stub">{invoice?.id}</div> : null
  },
}))

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as { from: (t: string) => unknown }
  const realFrom = stub.from.bind(stub)
  stub.from = (table: string) => {
    if (table !== 'customers') return realFrom(table)
    const filters: string[] = []
    let payload: Record<string, unknown> | null = null
    const builder: Record<string, unknown> = {}
    builder.select = () => builder
    builder.eq = (c: string, v: unknown) => {
      filters.push(`eq:${c}=${String(v)}`)
      return builder
    }
    builder.is = (c: string, v: unknown) => {
      filters.push(`is:${c}=${String(v)}`)
      return builder
    }
    builder.update = (p: Record<string, unknown>) => {
      payload = p
      return builder
    }
    builder.maybeSingle = () => Promise.resolve({ data: { billing_email: seen.gcEmail }, error: null })
    builder.then = (ok: (v: unknown) => unknown) => {
      if (payload) {
        seen.updates.push({ payload, filters: [...filters] })
        seen.gcEmail = String(payload.billing_email)
      }
      return Promise.resolve({ data: null, error: null }).then(ok)
    }
    return builder
  }
  return { supabase: stub }
})

afterEach(() => {
  cleanup()
  seen.contractQuiet = []
  seen.windowFor = null
  seen.gcEmail = null
  seen.updates = []
})

const bill = makeInvoice({ id: 'inv-251', status: 'billed', amount: 4720, sequence_order: 2 })

describe('BillPaperworkCard (v2.4299)', () => {
  it('a GC job with no waiver: the row leads, the door opens the window on this bill, Send contract goes plain', async () => {
    const job = makeJob({ id: 'j251', gc_customer_id: 'gc-palmer', gcCustomer: { id: 'gc-palmer', name: 'Michael Palmer' }, invoices: [bill], payments: [], revenue: 23600 })
    const { loaded: row } = await renderSettled(<BillPaperworkCard job={job} invoice={bill} billEmail="palmercustomhomes@gmail.com" dueUnix={null} />, {
      loaded: () => screen.findByTestId('paperwork-waiver-row'),
    })
    expect(row.textContent).toContain('Conditional for $4,720 not sent')
    expect(row.getAttribute('data-tone')).toBe('amber')
    expect(screen.getByTestId('paperwork-waiver-sub').textContent).toBe('A GC often waits for this waiver before it pays.')
    expect(seen.contractQuiet[seen.contractQuiet.length - 1]).toBe(true)

    fireEvent.click(screen.getByTestId('paperwork-waiver-door'))
    expect((await screen.findByTestId('release-window-stub')).textContent).toBe('inv-251')
  })

  it('the GC has no waiver email: the bill’s email fills the blank, and only a blank', async () => {
    const job = makeJob({ id: 'j251', gc_customer_id: 'gc-palmer', gcCustomer: { id: 'gc-palmer', name: 'Michael Palmer' }, invoices: [bill], payments: [] })
    await renderSettled(<BillPaperworkCard job={job} invoice={bill} billEmail="palmercustomhomes@gmail.com" dueUnix={null} />, {
      loaded: () => screen.findByTestId('paperwork-waiver-email-fix'),
    })
    fireEvent.click(screen.getByRole('button', { name: 'Use palmercustomhomes@gmail.com' }))
    await settle()
    await waitFor(() => expect(screen.queryByTestId('paperwork-waiver-email-fix')).toBeNull())
    expect(seen.updates).toEqual([{ payload: { billing_email: 'palmercustomhomes@gmail.com' }, filters: ['eq:id=gc-palmer', 'is:billing_email=null'] }])
  })

  it('a homeowner job with no waiver: no waiver row, Send contract stays the filled button', async () => {
    const job = makeJob({ id: 'j473', gc_customer_id: null, invoices: [bill], payments: [] })
    await renderSettled(<BillPaperworkCard job={job} invoice={bill} billEmail={null} dueUnix={null} />, {
      loaded: () => screen.findByTestId('work-order-row-stub'),
    })
    await settle()
    expect(screen.queryByTestId('paperwork-waiver-row')).toBeNull()
    expect(seen.contractQuiet[seen.contractQuiet.length - 1]).toBe(false)
  })
})
