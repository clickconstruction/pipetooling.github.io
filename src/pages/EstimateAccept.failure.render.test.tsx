// @vitest-environment jsdom
/**
 * The customer's estimate page when something fails (v2.5965): a lost signal on the load reads No
 * connection with Try again; an expired link keeps the page's own words; a refused approval reads the
 * office's sentence in the approval window, never the function's words.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import { installDomShims, settle } from '../test/renderSmokeMocks'
import EstimateAccept from './EstimateAccept'

const line = (description: string, cents: number) => ({ line_item: '', description, quantity: 1, unit_price_cents: cents, amount_cents: cents })
const ESTIMATE = { id: 'est-1', title: 'Water heater', line_items_snapshot: [line('Heater', 480000)], terms_snapshot: 'Net 15.', total_cents: 480000, valid_until: null }
const ok = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body }) as unknown as Response

function mount() {
  return render(
    <MemoryRouter initialEntries={['/estimate?t=tok-1']}>
      <EstimateAccept />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  installDomShims()
  vi.stubGlobal('scrollTo', vi.fn())
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('EstimateAccept failures (v2.5965)', () => {
  it('a lost signal on the load reads No connection with Try again, which opens the estimate', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Load failed'))
      .mockImplementation(async () => ok(ESTIMATE))
    vi.stubGlobal('fetch', fetchMock)
    mount()
    expect(await screen.findByText('No connection. Check your signal and try again.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Water heater')).toBeTruthy()
  })

  it('an expired link keeps the page’s own words; a gone link reads as one, never the function’s words', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok({ error: 'Link expired', code: 'expired' }, 410)))
    mount()
    expect(await screen.findByText(/This link has expired. Reply to our email or call the office/)).toBeTruthy()
    expect(screen.queryByText('Link expired')).toBeNull()
    cleanup()
    vi.stubGlobal('fetch', vi.fn(async () => ok({ error: 'Not found' }, 404)))
    mount()
    expect(await screen.findByText('This link is no longer active. Please call the office for a new one.')).toBeTruthy()
  })

  it('a refused approval reads the office’s sentence in the approval window, never the function’s words', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url.includes('accept-estimate') ? ok({ error: 'printedName is required' }, 400) : ok(ESTIMATE))))
    mount()
    await screen.findByText('Water heater')
    fireEvent.click(screen.getAllByRole('button', { name: /^(Accept|Approve)/ })[0]!)
    await settle()
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Pat Customer' } })
    for (const box of within(dialog).getAllByRole('checkbox')) if (!(box as HTMLInputElement).checked) fireEvent.click(box)
    await settle()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Submit acceptance' }))
    expect(await within(dialog).findByText("We couldn't record that. Please try again later.")).toBeTruthy()
    expect(screen.queryByText('printedName is required')).toBeNull()
  })

  it('an approval the function refuses in a sentence it writes for the customer reads that sentence (v2.5965)', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url.includes('accept-estimate') ? ok({ error: 'Estimate was already accepted or is no longer available to accept' }, 409) : ok(ESTIMATE))))
    mount()
    await screen.findByText('Water heater')
    fireEvent.click(screen.getAllByRole('button', { name: /^(Accept|Approve)/ })[0]!)
    await settle()
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Pat Customer' } })
    for (const box of within(dialog).getAllByRole('checkbox')) if (!(box as HTMLInputElement).checked) fireEvent.click(box)
    await settle()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Submit acceptance' }))
    expect(await within(dialog).findByText('Estimate was already accepted or is no longer available to accept')).toBeTruthy()
  })
})
