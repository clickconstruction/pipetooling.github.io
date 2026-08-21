// @vitest-environment jsdom
/**
 * Render-smoke tests for the customer portal statement page (portal train
 * PR 1) — fetch mocked; asserts the statement anatomy: letterhead, ledger
 * rows, pay link vs check chip, double-rule total, error state.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CustomerPortal from './CustomerPortal'

const payload = {
  company: { name: 'Click Plumbing and Electrical', cityLine: 'San Antonio, Texas', licenseLine: '', phone: '', email: '' },
  customerName: 'Michael Hageman',
  audience: 'customer',
  bills: [
    { jobLabel: 'Water heater replacement · Job 612', jobNumber: '612', jobAddress: '3827 Sage Ridge Dr', amount: 1450, billedOn: '2026-08-04', payUrl: 'https://invoice.stripe.com/x', checkRef: '612' },
    { jobLabel: 'Service call · Job 655', jobNumber: '655', jobAddress: null, amount: 250, billedOn: '2026-08-18', payUrl: null, checkRef: '655' },
  ],
  totalDue: 1700,
  requestableJobs: [],
}

function mountAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <CustomerPortal />
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('CustomerPortal render smoke', () => {
  it('renders the statement: letterhead, ledger rows, pay link, check chip, total', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })))
    mountAt('/portal?t=abcdef1234567890abcdef')
    await waitFor(() => expect(screen.getByText('Michael Hageman')).toBeTruthy())
    expect(screen.getByText('Account statement')).toBeTruthy()
    expect(screen.getByText('Water heater replacement · Job 612')).toBeTruthy()
    const pay = screen.getByText('PAY ONLINE') as HTMLAnchorElement
    expect(pay.href).toBe('https://invoice.stripe.com/x')
    expect(screen.getByText('check · ref 655')).toBeTruthy()
    expect(screen.getByText('Total due')).toBeTruthy()
    expect(screen.getAllByText('$1,700.00').length).toBeGreaterThanOrEqual(2)
  })

  it('all-paid state', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ...payload, bills: [], totalDue: 0 }), { status: 200 })))
    mountAt('/portal?t=abcdef1234567890abcdef')
    await waitFor(() => expect(screen.getByText(/all paid up/)).toBeTruthy())
  })

  it('revoked-link error body is shown to the customer', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'This link is no longer active. Please contact our office for a new one.' }), { status: 404 })))
    mountAt('/portal?t=abcdef1234567890abcdef')
    await waitFor(() => expect(screen.getByText(/no longer active/)).toBeTruthy())
  })

  it('request forms render and a visit submission posts + confirms', async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL, _init?: RequestInit) => {
      if (String(url).includes('submit-portal-request')) {
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      return new Response(JSON.stringify({ ...payload, requestableJobs: [{ id: 'j1', label: 'Service call · Job 655' }] }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    mountAt('/portal?t=abcdef1234567890abcdef')
    await waitFor(() => expect(screen.getByText('Request a visit')).toBeTruthy())
    expect(screen.getByText('Ask us to bid your work')).toBeTruthy()
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.change(screen.getByLabelText(/What's going on/), { target: { value: 'Water heater is leaking again' } })
    fireEvent.click(screen.getByText('Send request'))
    await waitFor(() => expect(screen.getByText(/Got it — thank you/)).toBeTruthy())
    const submitCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('submit-portal-request'))!
    const sent = JSON.parse((submitCall[1] as RequestInit).body as string)
    expect(sent.kind).toBe('visit')
    expect(sent.description).toBe('Water heater is leaking again')
    expect(sent.website).toBe('')
  })

  it('missing token never fetches', () => {
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    mountAt('/portal')
    expect(screen.getByText(/missing its key/)).toBeTruthy()
    expect(f).not.toHaveBeenCalled()
  })
})
