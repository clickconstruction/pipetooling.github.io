// @vitest-environment jsdom
/**
 * Render-smoke tests for the public supply-house quote page (/q/:token).
 * Journey-map J23 P4 (batch B3, v2.2906): the page's five states and the
 * draft round-trip had no automated coverage — the walk was the regression
 * suite. The decisions live in src/lib/rfq/quotePageState.ts; this checks
 * they are wired: a failed submit keeps the form, a dead link writes no
 * draft key, the closed screen recaps typed work, the footer counts freight.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../test/renderSmokeMocks'
import SupplyHouseQuotePage from './SupplyHouseQuotePage'

let mockToken = 'tok-1'
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useParams: () => ({ token: mockToken }) }
})

type FetchPlan = { get: { status: number; body?: unknown }; post?: { status: number; body?: unknown } }
let plan: FetchPlan

function jsonResponse(status: number, body: unknown = {}) {
  return { status, ok: status >= 200 && status < 300, json: () => Promise.resolve(body) } as unknown as Response
}

const openPage = {
  status: 'sent',
  bidName: '398 · ZZ Test',
  supplyHouse: 'Click Plumbing Supply',
  neededBy: '2026-09-09',
  lines: [
    { fixture: 'Toilets', count: 5, unit: 'ea' },
    { fixture: 'Kitchen sinks', count: 2, unit: 'ea' },
    { fixture: '3/4" copper', count: 120, unit: 'ft' },
  ],
}

beforeEach(() => {
  window.localStorage.clear()
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return Promise.resolve(jsonResponse(plan.post?.status ?? 500, plan.post?.body ?? {}))
      return Promise.resolve(jsonResponse(plan.get.status, plan.get.body ?? {}))
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SupplyHouseQuotePage render smoke', () => {
  it('form: header, lines, per-ft hint on footage, footer names the silent extras and the save promise', async () => {
    plan = { get: { status: 200, body: openPage } }
    renderWithProviders(<SupplyHouseQuotePage />)
    await waitFor(() => expect(screen.getByText('Price these parts')).toBeTruthy())
    expect(screen.getByText(/398 · ZZ Test · for Click Plumbing Supply · needed by 2026-09-09/)).toBeTruthy()
    expect((screen.getByLabelText('Price for 3/4" copper') as HTMLInputElement).placeholder).toBe('$ per ft')
    expect((screen.getByLabelText('Price for Toilets') as HTMLInputElement).placeholder).toBe('$ each')
    expect(screen.getByText('0 of 3 lines answered')).toBeTruthy()
    expect(screen.getByText('No freight quoted · no expiry date')).toBeTruthy()
    expect(screen.getByText('Saves on this phone as you go')).toBeTruthy()
    // The promise left the intro paragraph.
    expect(screen.queryByText(/Your entries save on this phone as you go/)).toBeNull()
  })

  it('typing counts lines AND freight in the footer, and persists the draft under the token key', async () => {
    plan = { get: { status: 200, body: openPage } }
    renderWithProviders(<SupplyHouseQuotePage />)
    await waitFor(() => expect(screen.getByText('Price these parts')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Price for Toilets'), { target: { value: '412.50' } })
    fireEvent.click(screen.getAllByText('can’t supply')[1]!)
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '45' } })
    expect(screen.getByText('2 of 3 lines answered — partial is fine')).toBeTruthy()
    expect(screen.getByText('Freight $45.00 · no expiry date')).toBeTruthy()
    expect(screen.getByText('Saved on this phone · nothing is sent until you tap Send quote')).toBeTruthy()
    const stored = JSON.parse(window.localStorage.getItem('rfqQuoteDraft_tok-1') ?? 'null')
    expect(stored.lines.Toilets.price).toBe('412.50')
    expect(stored.lines['Kitchen sinks'].cantSupply).toBe(true)
    expect(stored.freight).toBe('45')
  })

  it('a failed submit keeps the form mounted, shows the notice in the footer, and Send becomes Try again (J23-N1)', async () => {
    plan = { get: { status: 200, body: openPage }, post: { status: 500, body: { error: 'Something went wrong' } } }
    renderWithProviders(<SupplyHouseQuotePage />)
    await waitFor(() => expect(screen.getByText('Price these parts')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Price for Toilets'), { target: { value: '412.50' } })
    fireEvent.click(screen.getByText('Send quote'))
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    // A 5xx shows the friendly copy, not the server's bare "Something went wrong".
    expect(screen.getByRole('alert').textContent).toMatch(/Your entries are still on this phone/)
    // The typed price is still on screen and editable.
    expect((screen.getByLabelText('Price for Toilets') as HTMLInputElement).value).toBe('412.50')
    expect(screen.getByText('Try again')).toBeTruthy()
    // A retry that succeeds clears the notice and lands on the done screen.
    plan.post = { status: 200, body: { ok: true, savedLines: 1 } }
    fireEvent.click(screen.getByText('Try again'))
    await waitFor(() => expect(screen.getByText('✓ Quote sent')).toBeTruthy())
    expect(screen.queryByRole('alert')).toBeNull()
    expect(window.localStorage.getItem('rfqQuoteDraft_tok-1')).toBeNull()
  })

  it('410 on submit flips to the closed screen and recaps the typed work; the draft stays (J23-3)', async () => {
    plan = { get: { status: 200, body: openPage }, post: { status: 410, body: { error: 'This request is closed' } } }
    renderWithProviders(<SupplyHouseQuotePage />)
    await waitFor(() => expect(screen.getByText('Price these parts')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Price for Toilets'), { target: { value: '412.50' } })
    fireEvent.change(screen.getByLabelText('Note for Kitchen sinks'), { target: { value: 'alt brand: Elkay only' } })
    fireEvent.click(screen.getByText('Send quote'))
    await waitFor(() => expect(screen.getByText('This pricing request has been closed.')).toBeTruthy())
    expect(screen.getByText('Your typed prices stayed on this phone — nothing was sent.')).toBeTruthy()
    expect(screen.getByText('$412.50')).toBeTruthy()
    expect(screen.getByText(/alt brand: Elkay only/)).toBeTruthy()
    expect(screen.queryByText('Send quote')).toBeNull()
    expect(window.localStorage.getItem('rfqQuoteDraft_tok-1')).not.toBeNull()
  })

  it('a closed link on first open recaps an earlier draft from this phone', async () => {
    window.localStorage.setItem(
      'rfqQuoteDraft_tok-1',
      JSON.stringify({ quotedBy: 'Danny', validUntil: '', freight: '', lines: { Toilets: { price: '412.50', cantSupply: false, note: '' } } }),
    )
    plan = { get: { status: 200, body: { status: 'closed' } } }
    renderWithProviders(<SupplyHouseQuotePage />)
    await waitFor(() => expect(screen.getByText('This pricing request has been closed.')).toBeTruthy())
    expect(screen.getByText('Nothing needed — thanks for looking.')).toBeTruthy()
    expect(screen.getByText('$412.50')).toBeTruthy()
    expect(screen.getByText('from Danny')).toBeTruthy()
  })

  it('a closed link with no draft shows the plain closed screen', async () => {
    plan = { get: { status: 200, body: { status: 'closed' } } }
    renderWithProviders(<SupplyHouseQuotePage />)
    await waitFor(() => expect(screen.getByText('This pricing request has been closed.')).toBeTruthy())
    expect(screen.queryByText(/stayed on this phone/)).toBeNull()
  })

  it('404: the message renders, no Reload button, and NO draft key is written (J23-4)', async () => {
    mockToken = 'deadbeef'
    plan = { get: { status: 404 } }
    renderWithProviders(<SupplyHouseQuotePage />)
    await waitFor(() => expect(screen.getByText(/This quote link doesn’t exist/)).toBeTruthy())
    expect(screen.queryByText('Reload')).toBeNull()
    expect(window.localStorage.getItem('rfqQuoteDraft_deadbeef')).toBeNull()
    expect(window.localStorage.length).toBe(0)
    mockToken = 'tok-1'
  })

  it('a closed link writes no draft key either', async () => {
    plan = { get: { status: 200, body: { status: 'closed' } } }
    renderWithProviders(<SupplyHouseQuotePage />)
    await waitFor(() => expect(screen.getByText('This pricing request has been closed.')).toBeTruthy())
    expect(window.localStorage.length).toBe(0)
  })

  it('a failed load offers Reload', async () => {
    plan = { get: { status: 500 } }
    renderWithProviders(<SupplyHouseQuotePage />)
    await waitFor(() => expect(screen.getByText(/Couldn’t load the quote request/)).toBeTruthy())
    expect(screen.getByText('Reload')).toBeTruthy()
    expect(window.localStorage.length).toBe(0)
  })
})
