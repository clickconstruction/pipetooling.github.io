// @vitest-environment jsdom
/**
 * GC mode (O8b) on the customer's statement: a certified GC bill not on Stripe shows PAY BY CARD beside its check
 * chip, with "Card adds 3%" under its date, and opens its panel under the bill; a bill on card shows PAY ONLINE and
 * its fee; a payload with no card offers shows neither, as before. The owner sample shows the press.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CustomerPortal from './CustomerPortal'
import { sampleCustomerPortalResponse } from '../../supabase/functions/_shared/customerSampleFixtures'
import { SAMPLE_TOKEN_OWNER } from '../lib/customerSample'

const CERTIFIED = '11111111-2222-3333-4444-555555555555'
const ON_CARD = '66666666-7777-8888-9999-000000000000'

const payload = (cardBills: unknown[] | undefined) => ({
  company: { name: 'Click Plumbing and Electrical', cityLine: '', licenseLine: '', phone: '(512) 360-0599', email: '' },
  customerName: 'Oak Ridge Holdings',
  audience: 'customer',
  bills: [
    { invoiceId: CERTIFIED, jobLabel: 'Oak Ridge Clinic · Job 1042', jobNumber: '1042', jobName: 'Oak Ridge Clinic', jobAddress: null, amount: 42_750, billedOn: '2026-10-09', payUrl: null, checkRef: '1042-3' },
    { invoiceId: ON_CARD, jobLabel: 'Oak Ridge Clinic · Job 1042', jobNumber: '1042', jobName: 'Oak Ridge Clinic', jobAddress: null, amount: 5_150, billedOn: '2026-09-29', payUrl: 'https://invoice.stripe.com/i/test4', checkRef: '1042-4' },
  ],
  totalDue: 47_900,
  requestableJobs: [],
  ...(cardBills ? { cardBills } : {}),
})

function mountWith(body: unknown, url = '/portal?t=abcdef1234567890abcdef') {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })))
  return render(
    <MemoryRouter initialEntries={[url]}>
      <CustomerPortal />
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Pay by card on the statement (O8b)', () => {
  it('offers PAY BY CARD on the certified bill beside its check chip, and says the fee on the bill on card', async () => {
    mountWith(
      payload([
        { invoiceId: CERTIFIED, state: 'offer', base: 42_750, fee: 1_282.5, total: 44_032.5 },
        { invoiceId: ON_CARD, state: 'onCard', base: 5_000, fee: 150, total: 5_150 },
      ]),
    )
    await waitFor(() => expect(screen.getByText('Oak Ridge Holdings')).toBeTruthy())
    expect(screen.getByRole('button', { name: 'PAY BY CARD' })).toBeTruthy()
    expect(screen.getByText('Card adds 3%')).toBeTruthy()
    expect(screen.getByText('check · ref 1042-3')).toBeTruthy()
    expect(screen.getByText('Includes the $150.00 card fee.')).toBeTruthy()
    const pay = screen.getAllByText('PAY ONLINE').find((el) => el.tagName === 'A') as HTMLAnchorElement
    expect(pay.href).toBe('https://invoice.stripe.com/i/test4')
  })

  it('the press opens the panel under the bill, and Close shuts it', async () => {
    mountWith(payload([{ invoiceId: CERTIFIED, state: 'offer', base: 42_750, fee: 1_282.5, total: 44_032.5 }]))
    await waitFor(() => expect(screen.getByRole('button', { name: 'PAY BY CARD' })).toBeTruthy())
    expect(screen.queryByText('Pay this bill by card')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'PAY BY CARD' }))
    expect(screen.getByText('This bill is $42,750.00.')).toBeTruthy()
    expect(screen.getByText('Paying by card adds a 3% card fee of $1,282.50.')).toBeTruthy()
    expect(screen.getByText('Your card pays $44,032.50 in all.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByText('Pay this bill by card')).toBeNull()
  })

  it('with no card offers (the switch off, or a function from before it) the statement reads as before', async () => {
    mountWith(payload(undefined))
    await waitFor(() => expect(screen.getByText('Oak Ridge Holdings')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'PAY BY CARD' })).toBeNull()
    expect(screen.queryByText('Card adds 3%')).toBeNull()
    expect(screen.queryByText(/card fee/)).toBeNull()
    expect(screen.getByText('check · ref 1042-3')).toBeTruthy()
  })

  it('the owner sample on What customers see shows the press', async () => {
    mountWith(sampleCustomerPortalResponse({ name: 'Click Plumbing and Electrical', cityLine: '', licenseLine: '', phone: '(512) 360-0599', email: '' }, 'owner', '2026-10-09', 'https://example.test'), `/portal?t=${SAMPLE_TOKEN_OWNER}`)
    await waitFor(() => expect(screen.getByRole('button', { name: 'PAY BY CARD' })).toBeTruthy())
  })
})
