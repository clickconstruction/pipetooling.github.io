// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PayLink from './PayLink'
import { payLinkView } from '../lib/billing/payLinkView'
import { SAMPLE_TOKEN } from '../lib/customerSample'

const ID = '8f3c2a1e-6b7d-4c9a-9e21-5d0f7a3b1c44'
const open = { ok: true, state: 'open', url: 'https://invoice.stripe.com/i/fresh', number: '1025-2609180905', jobName: 'Lago Vista St', company: 'Click Plumbing and Electrical', phone: '(512) 360-0599', amountRemainingCents: 466000, currency: 'usd', paidOn: null }

function mount(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/pay/${id}`]}>
      <Routes>
        <Route path="/pay/:id" element={<PayLink />} />
      </Routes>
    </MemoryRouter>,
  )
}

function answer(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ status, ok: status < 400, json: async () => body })))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('payLinkView — the state from the answer', () => {
  it('maps the function answer to the page state', () => {
    expect(payLinkView(200, open)).toEqual({ kind: 'open', payload: expect.objectContaining({ state: 'open' }), url: 'https://invoice.stripe.com/i/fresh' })
    expect(payLinkView(200, { ...open, state: 'paid', amountRemainingCents: 0, paidOn: '2026-09-30' }).kind).toBe('paid')
    expect(payLinkView(200, { ...open, state: 'void' }).kind).toBe('void')
    expect(payLinkView(200, { ...open, url: null }).kind).toBe('no_link')
    expect(payLinkView(404, { error: 'not_found' })).toEqual({ kind: 'not_found' })
    expect(payLinkView(429, { error: 'Too many requests — try again in a minute.' })).toEqual({ kind: 'error', message: 'Too many requests — try again in a minute.' })
    expect(payLinkView(500, null).kind).toBe('error')
  })
})

describe('PayLink page', () => {
  it('names the bill, shows what is owed and offers Pay now on an open bill', async () => {
    answer(200, open)
    mount(ID)
    expect((await screen.findByTestId('pay-link-amount')).textContent).toBe('$4,660.00')
    expect(screen.getByText('Invoice #1025-2609180905 · Lago Vista St')).toBeTruthy()
    expect(screen.getByTestId('pay-link-pay-now').getAttribute('href')).toBe('https://invoice.stripe.com/i/fresh')
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toContain(`/functions/v1/pay-link?id=${ID}`)
  })

  it('says Paid, with the day, and never offers to pay again', async () => {
    answer(200, { ...open, state: 'paid', amountRemainingCents: 0, paidOn: '2026-09-30' })
    mount(ID)
    expect((await screen.findByTestId('pay-link-paid')).textContent).toContain('Paid')
    expect(screen.getByText(/paid on September 30, 2026/)).toBeTruthy()
    expect(screen.queryByTestId('pay-link-pay-now')).toBeNull()
  })

  it('an id that is not a bill never calls the function', async () => {
    answer(200, open)
    mount('not-a-bill')
    expect(await screen.findByText(/could not find that bill/)).toBeTruthy()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('a 404 says the code may be from an old letter, with the office number to call', async () => {
    answer(404, { error: 'not_found' })
    mount(ID)
    expect(await screen.findByText(/could not find that bill/)).toBeTruthy()
    await waitFor(() => expect(screen.getByText(/Call \(512\) 360-0599/).getAttribute('href')).toBe('tel:5123600599'))
  })
})

describe('PayLink page — the sample (What customers see)', () => {
  it('renders the sample bill for the sample token, never calls the function and never forwards', async () => {
    answer(200, open)
    mount(SAMPLE_TOKEN)
    expect(screen.getByTestId('pay-link-sample')).toBeTruthy()
    expect(screen.getByTestId('pay-link-amount').textContent).toBe('$4,660.00')
    expect(screen.getByTestId('pay-link-pay-now').getAttribute('href')).toBe('#sample')
    expect(fetch).not.toHaveBeenCalled()
  })
})
