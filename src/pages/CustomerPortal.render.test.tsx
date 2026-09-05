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
    { jobLabel: 'Water heater replacement · Job 612', jobNumber: '612', jobName: 'Water heater replacement', serviceTag: 'plum', jobAddress: '3827 Sage Ridge Dr, San Antonio, TX 78258', amount: 1450, billedOn: '2026-08-04', payUrl: 'https://invoice.stripe.com/x', checkRef: '612' },
    { jobLabel: 'Service call · Job 655', jobNumber: '655', jobName: 'Service call', jobAddress: null, amount: 250, billedOn: '2026-08-18', payUrl: null, checkRef: '655' },
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
    // Trade-first job line (v2.2041): TRADE tag + number + street; city on the quiet line.
    expect(screen.getByText('PLUM')).toBeTruthy()
    expect(screen.getByText('612')).toBeTruthy()
    expect(screen.getByText('3827 Sage Ridge Dr')).toBeTruthy()
    expect(screen.getByText('San Antonio, TX 78258')).toBeTruthy()
    // No-address bill falls back to its bare name; no trade tag renders for it.
    expect(screen.getByText('Service call')).toBeTruthy()
    // getAllByText: the ledger header carries a hidden pay-button twin for column sizing.
    const pay = screen.getAllByText('PAY ONLINE').find((el) => el.tagName === 'A') as HTMLAnchorElement
    expect(pay.href).toBe('https://invoice.stripe.com/x')
    expect(screen.getByText('check · ref 655')).toBeTruthy()
    expect(screen.getByText('Total due')).toBeTruthy()
    expect(screen.getAllByText('$1,700.00').length).toBeGreaterThanOrEqual(2)
  })

  it('groups a job’s bills under one band with payments and the boxed recap (v2.2318)', async () => {
    const grouped = {
      ...payload,
      bills: [
        { jobLabel: 'Water heater replacement · Job 612', jobNumber: '612', jobName: 'Water heater replacement', serviceTag: 'plum', jobAddress: '3827 Sage Ridge Dr, San Antonio, TX 78258', amount: 1450, billedOn: '2026-08-04', payUrl: 'https://invoice.stripe.com/x', checkRef: '612', totalPaid: 550, payments: [{ date: '2026-07-20', method: 'other', amount: 550 }] },
        { jobLabel: 'Water heater replacement · Job 612', jobNumber: '612', jobName: 'Water heater replacement', serviceTag: 'plum', jobAddress: '3827 Sage Ridge Dr, San Antonio, TX 78258', amount: 300, billedOn: '2026-07-01', payUrl: null, checkRef: '612', totalPaid: 200, payments: [{ date: '2026-06-15', method: 'check · 1042', amount: 200 }] },
      ],
      totalDue: 1750,
    }
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(grouped), { status: 200 })))
    mountAt('/portal?t=abcdef1234567890abcdef')
    await waitFor(() => expect(screen.getByText('Michael Hageman')).toBeTruthy())
    // One band for the job, not one line per bill.
    expect(screen.getAllByText('612')).toHaveLength(1)
    expect(screen.getByText('3827 Sage Ridge Dr')).toBeTruthy()
    // Bill row shows what was originally billed when money has landed.
    expect(screen.getByText('$2,000.00')).toBeTruthy()
    // The recap box is the payment ledger (v2.2320): each payment by date, no
    // aggregate Paid-to-date line. Generic "other" rows are date-only
    // (v2.2322); a real method keeps its suffix.
    expect(screen.getByText('Billed to date')).toBeTruthy()
    expect(screen.getByText('$2,500.00')).toBeTruthy()
    expect(screen.getByText(/Paid Jul 20, 2026/)).toBeTruthy()
    expect(screen.queryByText(/· Payment/)).toBeNull()
    expect(screen.getByText(/· check · 1042/)).toBeTruthy()
    expect(screen.queryByText(/other/)).toBeNull()
    expect(screen.queryByText('Paid to date')).toBeNull()
    expect(screen.getByText('Balance on this job')).toBeTruthy()
    // Balance figure appears in the recap and again as the grand total.
    expect(screen.getAllByText('$1,750.00').length).toBeGreaterThanOrEqual(2)
  })

  it('multi-bill unpaid job gets a recap without a zero Paid to date row', async () => {
    const grouped = {
      ...payload,
      bills: [
        { jobLabel: 'Repipe · Job 898', jobNumber: '898', jobName: 'Repipe', serviceTag: 'plum', jobAddress: '9 Elm St, Austin, TX 78701', amount: 1200, billedOn: '2026-07-31', payUrl: null, checkRef: '898' },
        { jobLabel: 'Repipe · Job 898', jobNumber: '898', jobName: 'Repipe', serviceTag: 'plum', jobAddress: '9 Elm St, Austin, TX 78701', amount: 3600, billedOn: '2026-07-06', payUrl: null, checkRef: '898' },
      ],
      totalDue: 4800,
    }
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(grouped), { status: 200 })))
    mountAt('/portal?t=abcdef1234567890abcdef')
    await waitFor(() => expect(screen.getByText('Balance on this job')).toBeTruthy())
    expect(screen.getByText('Billed to date')).toBeTruthy()
    expect(screen.queryByText('Paid to date')).toBeNull()
  })

  it('single unpaid bill renders no recap box', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })))
    mountAt('/portal?t=abcdef1234567890abcdef')
    await waitFor(() => expect(screen.getByText('Michael Hageman')).toBeTruthy())
    expect(screen.queryByText('Balance on this job')).toBeNull()
    expect(screen.queryByText(/^Paid /)).toBeNull()
  })

  it('aggregate-only paid total falls back to one Paid to date line', async () => {
    const grouped = {
      ...payload,
      bills: [
        { jobLabel: 'Remodel · Job 512', jobNumber: '512', jobName: 'Remodel', serviceTag: 'plum', jobAddress: '2 Oak Ave, Austin, TX 78701', amount: 400, billedOn: '2026-08-01', payUrl: null, checkRef: '512', totalPaid: 150, payments: [] },
      ],
      totalDue: 400,
    }
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(grouped), { status: 200 })))
    mountAt('/portal?t=abcdef1234567890abcdef')
    await waitFor(() => expect(screen.getByText('Balance on this job')).toBeTruthy())
    expect(screen.getByText('Paid to date')).toBeTruthy()
  })

  it('Print all (v2.2331): button + per-job print headings + closing page', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })))
    mountAt('/portal?t=abcdef1234567890abcdef')
    await waitFor(() => expect(screen.getByText('Michael Hageman')).toBeTruthy())
    expect(screen.getByLabelText('Print the statement, one job per page')).toBeTruthy()
    // Two jobs → two self-identifying print page headers + the closing page.
    expect(screen.getByText(/Job 1 of 2/)).toBeTruthy()
    expect(screen.getByText(/Job 2 of 2/)).toBeTruthy()
    expect(screen.getByText(/· Closing/)).toBeTruthy()
    expect(screen.getByText(/2 jobs — each on its own page/)).toBeTruthy()
    // PAY ONLINE never prints.
    const pay = screen.getAllByText('PAY ONLINE').find((el) => el.tagName === 'A')
    expect(pay?.getAttribute('data-screen-only')).not.toBeNull()
  })

  it('phone layout (J21-F2): ledger has no inline min-width; bills are stacked-card hooks; print still collapses the grid', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })))
    mountAt('/portal?t=abcdef1234567890abcdef')
    await waitFor(() => expect(screen.getByText('Michael Hageman')).toBeTruthy())
    // jsdom has no layout, so this asserts the markup branch the CSS keys on.
    // The old `style={{ minWidth: 560 }}` was what pushed every amount and PAY
    // ONLINE off a 375px screen; the stylesheet owns the width now.
    const ledger = document.querySelector('[data-portal-ledger]') as HTMLElement
    expect(ledger).toBeTruthy()
    expect(ledger.style.minWidth).toBe('')
    const scroll = ledger.closest('[data-portal-ledger-scroll]') as HTMLElement
    expect(scroll).toBeTruthy()
    // The sideways-scroll region is stylesheet-owned too, so the phone query
    // can switch it off (an inline overflow would outrank the rule).
    expect(scroll.style.overflowX).toBe('')
    // Every bill row is a restackable card; the pay link and check chip carry
    // the hooks the phone query targets; the header row is hideable.
    const rows = document.querySelectorAll('[data-portal-bill]')
    expect(rows).toHaveLength(2)
    rows.forEach((row) => expect(row.getAttribute('style') ?? '').not.toMatch(/grid-template-columns/))
    expect(document.querySelectorAll('[data-portal-bill] [data-bill-amount]')).toHaveLength(2)
    expect(document.querySelector('a[data-bill-pay]')?.textContent).toBe('PAY ONLINE')
    expect(document.querySelector('[data-bill-check]')?.textContent).toBe('check · ref 655')
    expect(document.querySelector('[data-portal-ledger-head]')).toBeTruthy()
    expect(rows[rows.length - 1]?.hasAttribute('data-last')).toBe(true)
    // The stylesheet carries the phone restack (screen-only, so paper never
    // matches it) and still exempts the grid width in print.
    const css = Array.from(document.querySelectorAll('style')).map((el) => el.textContent ?? '').join('\n')
    expect(css).toMatch(/\[data-portal-ledger-scroll\]\{overflow-x:auto\}/)
    expect(css).toMatch(/\[data-portal-ledger\]\{min-width:560px\}/)
    expect(css).toMatch(/@media screen and \(max-width:559px\)/)
    expect(css).toMatch(/\[data-portal-ledger-scroll\]\{overflow-x:visible\}/)
    expect(css).toMatch(/\[data-portal-bill\][^}]*grid-template-columns:1fr/)
    expect(css).toMatch(/\[data-bill-pay\]\{display:block/)
    expect(css).toMatch(/@media print \{[\s\S]*\[data-portal-ledger\]\{min-width:0 !important\}/)
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
