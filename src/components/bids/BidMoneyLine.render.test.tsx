// @vitest-environment jsdom
/**
 * Render smoke for the money line under a won bid (v2.5647, punch list #129): the words and the tone from a given
 * line, Send the pay page offered only with a pay page and a way to reach the customer, and the press opening the
 * customer's sheet already on Text. The read itself is the hook's (`useBidMoneyStrip`), mocked away by the given line.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { BidMoneyLine } from './BidMoneyLine'
import { bidMoneyLine, type BidMoneyStripEntry } from '../../lib/bids/bidMoneyLine'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'estimator' })
})

vi.mock('../../lib/messages/messagesIo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/messages/messagesIo')>()),
  loadCustomerContact: async () => ({
    id: 'c-dana', kind: 'customer', name: 'Dana Whitfield', goesBy: null, company: '', record: { table: 'customers', id: 'c-dana' },
    channels: [{ id: 'ch-dana-email', kind: 'email', value: 'dana@example.com', optedOutAt: null }],
    jobIds: ['pipeline:j1032'], defaultJobId: null, customerId: 'c-dana', gcCompanyId: null,
  }),
}))

afterEach(() => cleanup())

const PAY_ID = '11111111-1111-4111-8111-111111111111'

function entry(over: Partial<BidMoneyStripEntry> = {}, job: Partial<BidMoneyStripEntry['job']> = {}): BidMoneyStripEntry {
  return {
    bidId: 'b512',
    job: {
      id: 'j1032', status: 'billed', revenue: 4200, payments_made: 0, collections_at: null, uncollectible_at: null,
      job_name: 'Whitfield repipe', hcp_number: '1032', click_number: null, billing_only: false,
      customer_id: 'c-dana', customer_name: 'Dana Whitfield', customer_phone: '210-555-0100', customer_email: 'dana@example.com', created_at: '2026-09-12T15:00:00Z',
      ...job,
    },
    invoices: [{ id: PAY_ID, job_id: 'j1032', status: 'billed', amount: 4200, sequence_order: 0, billed_at: '2026-09-30T15:00:00Z', created_at: null, stripe_invoice_id: 'in_1' }],
    payments: [],
    promises: [{ id: 'p1', jobId: 'j1032', customerId: 'c-dana', promisedYmd: '2026-10-25', saidBy: 'Dana', heardByName: 'Theo', channel: 'text', source: 'office', note: null, createdAt: '2026-10-14T20:12:00Z' }],
    ...over,
  }
}

describe('BidMoneyLine', () => {
  it('says the stage, the money and the word, red past the day', async () => {
    const { container } = renderWithProviders(<BidMoneyLine bidId="b512" line={bidMoneyLine(entry(), '2026-10-29')} />)
    await settle()
    const line = container.querySelector('[data-bid-money-line="b512"]')!
    expect(line.getAttribute('data-bid-money-tone')).toBe('red')
    expect(line.textContent).toContain('1032')
    expect(line.textContent).toContain('Billed Sep 30')
    expect(line.textContent).toContain('$4,200 open')
    expect(line.textContent).toContain('Said Oct 25 · 4 days past')
    expect(line.textContent).toContain('Dana · by text · heard by Theo')
    expect(screen.getByRole('button', { name: 'Send the pay page' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Dana Whitfield/ })).toBeTruthy()
  })
  it('offers no pay page for a bill outside Stripe, and draws nothing with no line', async () => {
    const { container } = renderWithProviders(
      <BidMoneyLine bidId="b512" line={bidMoneyLine(entry({ invoices: [{ id: PAY_ID, job_id: 'j1032', status: 'billed', amount: 4200, sequence_order: 0, billed_at: null, created_at: null, stripe_invoice_id: null }], promises: [] }), '2026-10-19')} />,
    )
    await settle()
    expect(container.querySelector('[data-bid-money-line]')!.getAttribute('data-bid-money-tone')).toBe('amber')
    expect(screen.getByText('no word yet')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Send the pay page' })).toBeNull()
    cleanup()
    const none = renderWithProviders(<BidMoneyLine bidId="b512" line={null} />)
    expect(none.container.querySelector('[data-bid-money-line]')).toBeNull()
  })
  it('Send the pay page opens the customer sheet already on Text', async () => {
    renderWithProviders(<BidMoneyLine bidId="b512" line={bidMoneyLine(entry(), '2026-10-19')} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Send the pay page' }))
    await settle()
    expect(screen.getByRole('radiogroup', { name: 'Write as' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Text' }).getAttribute('aria-checked')).toBe('true')
  })
  it("Send the pay page opens the box on the open bill's words and its pay page (v2.5657)", async () => {
    renderWithProviders(<BidMoneyLine bidId="b512" line={bidMoneyLine(entry({}, { customer_phone: null }), '2026-10-19')} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Send the pay page' }))
    await settle()
    const box = document.querySelector('textarea') as HTMLTextAreaElement | null
    expect(box?.value).toMatch(/^Dana, here is your bill 1032 for Whitfield repipe\. \$4,200 is open\. You can pay it here: /)
    expect(box?.value).toContain(PAY_ID)
  })
  it('the speech bubble opens the box empty', async () => {
    renderWithProviders(<BidMoneyLine bidId="b512" line={bidMoneyLine(entry({}, { customer_phone: null }), '2026-10-19')} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /Dana Whitfield/ }))
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /^Email/ }))
    await settle()
    const box = document.querySelector('textarea') as HTMLTextAreaElement | null
    expect(box).toBeTruthy()
    expect(box!.value).toBe('')
  })
})
