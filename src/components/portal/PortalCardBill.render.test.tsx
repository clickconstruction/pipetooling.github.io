// @vitest-environment jsdom
/**
 * GC mode (O8b): Pay by card's panel in the customer's portal. It says the bill, the 3% fee and what the card pays in
 * the plan's words; Go to the card page posts the token and the bill to gc-card-bill and points the tab it opened at
 * the card page; a refusal shows the function's words with our office's line; a sample token only says what would
 * happen; Close closes it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PortalCardBillPanel, PortalCardBillPress } from './PortalCardBill'
import { CARD_BILL_WORDS, withOfficeLine } from '../../lib/portal/portalCardBill'
import { SAMPLE_TOKEN_OWNER } from '../../lib/customerSample'
import type { PortalCardBill } from '../../lib/portal/portalPayload'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()

const CARD: PortalCardBill = { invoiceId: '11111111-2222-3333-4444-555555555555', state: 'offer', base: 288_879, fee: 8_666.37, total: 297_545.37 }
const TOKEN = 'abcdef1234567890abcdef'
const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fetchMock = vi.fn()
const tab = { opener: {} as unknown, location: { href: '' }, close: vi.fn() }
const openMock = vi.fn(() => tab)

beforeEach(() => {
  fetchMock.mockReset()
  openMock.mockClear()
  tab.opener = {}
  tab.location.href = ''
  tab.close.mockClear()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('open', openMock)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const mount = (token = TOKEN, onClose = vi.fn()) => {
  render(<PortalCardBillPanel token={token} card={CARD} formatUsd={usd} phone="(512) 360-0599" onClose={onClose} />)
  return onClose
}

describe('Pay by card in the portal', () => {
  it('the press reads PAY BY CARD and says whether its panel is open', () => {
    const onOpen = vi.fn()
    render(<PortalCardBillPress open={false} onOpen={onOpen} />)
    const press = screen.getByRole('button', { name: 'PAY BY CARD' })
    expect(press.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(press)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('the panel says the bill, the fee, what the card pays, cards only, and the way to pay by check', () => {
    mount()
    expect(screen.getByText('Pay this bill by card')).toBeTruthy()
    expect(screen.getByText('This bill is $288,879.00.')).toBeTruthy()
    expect(screen.getByText('Paying by card adds a 3% card fee of $8,666.37.')).toBeTruthy()
    expect(screen.getByText('Your card pays $297,545.37 in all.')).toBeTruthy()
    expect(screen.getByText('After this, the bill takes cards only.')).toBeTruthy()
    expect(screen.getByText('To pay by check with no fee, close this and mail your check.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Go to the card page' })).toBeTruthy()
  })

  it('Go to the card page posts the token and the bill, and points the tab it opened at the card page', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, url: 'https://invoice.stripe.com/i/acct_1/test_card' }), { status: 200 }))
    const onClose = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Go to the card page' }))
    await waitFor(() => expect(tab.location.href).toBe('https://invoice.stripe.com/i/acct_1/test_card'))
    expect(openMock).toHaveBeenCalledWith('', '_blank')
    expect(tab.opener).toBeNull()
    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toMatch(/\/functions\/v1\/gc-card-bill$/)
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ token: TOKEN, invoiceId: CARD.invoiceId })
    expect(onClose).toHaveBeenCalled()
  })

  it('a refusal shows the function’s words with our office’s line, and closes the blank tab', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'refused', words: 'A payment is on this bill already, so it cannot move to card.' }), { status: 409 }))
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Go to the card page' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('A payment is on this bill already, so it cannot move to card. Call our office at (512) 360-0599.'))
    expect(tab.close).toHaveBeenCalled()
  })

  it('words that already say to call our office are left as they are; no words reads as the plain failure', async () => {
    expect(withOfficeLine('This bill went back to a check bill. Call our office to pay it by card.', '(512) 360-0599')).toBe('This bill went back to a check bill. Call our office to pay it by card.')
    expect(withOfficeLine('This bill is paid already.', null)).toBe('This bill is paid already. Call our office.')
    fetchMock.mockResolvedValue(new Response('not json', { status: 502 }))
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Go to the card page' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(CARD_BILL_WORDS.failed))
  })

  it('a sample token only says what would happen, and calls nothing', async () => {
    mount(SAMPLE_TOKEN_OWNER)
    fireEvent.click(screen.getByRole('button', { name: 'Go to the card page' }))
    await waitFor(() => expect(screen.getByText(CARD_BILL_WORDS.sample)).toBeTruthy())
    expect(fetchMock).not.toHaveBeenCalled()
    expect(openMock).not.toHaveBeenCalled()
  })

  it('Close closes it', () => {
    const onClose = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
