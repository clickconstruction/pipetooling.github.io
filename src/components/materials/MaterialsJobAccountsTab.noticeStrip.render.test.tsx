// @vitest-environment jsdom
/**
 * A house's notice window as a strip on Held for suppliers (punch list #217, people-docs-8, a
 * prototype): an open job's houses read *its own notice by …* and the red line reads its sentence
 * until a person presses *Show the window strips*; then each owed house gets a bar on one calendar
 * with its unpaid invoices as ticks, the day a house gave as a diamond, a *guessed* or *they said*
 * mark under the rows, and the red line reads as chips. With `?sbs=1` a dev sees both shapes.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { renderWithProviders, useAuthModuleMock, SMOKE_AUTH_USER_ID } from '../../test/renderSmokeMocks'
import { ConfirmDialogProvider } from '../../contexts/ConfirmDialogContext'
import { ToastProvider } from '../../contexts/ToastContext'
import { todayYmdInAppTz, ymdAddDays } from '../../utils/dateUtils'
import { shapeViewStorageKey } from '../prototypes/SideBySide'

import { MaterialsJobAccountsTab } from './MaterialsJobAccountsTab'

const TODAY = todayYmdInAppTz()
const INV_A = ymdAddDays(TODAY, -45)
const INV_B = ymdAddDays(TODAY, -40)
const INV_C = ymdAddDays(TODAY, -42)
const TOLD = ymdAddDays(TODAY, 21)
const KEY = shapeViewStorageKey('house-notice-window', SMOKE_AUTH_USER_ID)

/** One paid-in-full job, two houses still owed, every invoice in an earlier month so each window is open and already running; the second house told us its day. */
const ROWS: Record<string, unknown[]> = {
  supply_houses: [
    { id: 'h-blue', name: 'ZZ Bluebonnet Supply' },
    { id: 'h-oak', name: 'ZZ Lone Oak Plumbing' },
  ],
  supply_house_invoices: [
    { id: 'inv-a', supply_house_id: 'h-blue', amount: 3120.1, is_paid: false, due_date: INV_B, invoice_date: INV_A, invoice_number: 'A-1', on_job_account: false },
    { id: 'inv-b', supply_house_id: 'h-blue', amount: 2984, is_paid: false, due_date: TODAY, invoice_date: INV_B, invoice_number: 'A-2', on_job_account: false },
    { id: 'inv-c', supply_house_id: 'h-oak', amount: 2817.63, is_paid: false, due_date: TODAY, invoice_date: INV_C, invoice_number: 'C-1', on_job_account: false },
  ],
  supply_house_invoice_job_allocations: [
    { invoice_id: 'inv-a', job_id: 'j1', pct: 100 },
    { invoice_id: 'inv-b', job_id: 'j1', pct: 100 },
    { invoice_id: 'inv-c', job_id: 'j1', pct: 100 },
  ],
  supply_house_invoice_bid_allocations: [],
  supply_house_job_accounts: [],
  jobs_ledger: [{ id: 'j1', hcp_number: '1042', click_number: null, job_name: 'ZZ Cedar Bend', job_address: '', revenue: 23472, payments_made: 23472, customer_address_id: 'addr-1' }],
  customer_addresses: [{ id: 'addr-1', property_kind: 'residential' }],
  job_supply_house_words: [{ job_id: 'j1', supply_house_id: 'h-oak', their_balance: null, notice_on: TOLD, said_by: 'Marisol', note: '', noted_by_name: 'Grace', noted_at: `${ymdAddDays(TODAY, -9)}T18:00:00.000Z` }],
}

/** A read answers its table's rows whatever the chain; an rpc answers nothing. Every page is the whole table, so paging stops at once. */
function tableQuery(table: string): unknown {
  const q: Record<string, unknown> = {}
  const chain = () => q
  for (const m of ['select', 'in', 'eq', 'is', 'not', 'or', 'order', 'range', 'limit']) q[m] = chain
  q.then = (resolve: (v: { data: unknown[]; error: null }) => unknown) => Promise.resolve({ data: ROWS[table] ?? [], error: null }).then(resolve)
  return q
}
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => tableQuery(table),
    rpc: () => Promise.resolve({ data: [], error: null }),
  },
}))
vi.mock('../../hooks/useAuth', async () => useAuthModuleMock())

function tab() {
  return <MaterialsJobAccountsTab active myRole="dev" onOpenSupplyHouse={() => {}} authName="Grace" />
}

async function openTheJob(container: HTMLElement) {
  await waitFor(() => expect(container.querySelector('[data-held-job="j1"]')).toBeTruthy())
  fireEvent.click(container.querySelector('[data-held-job="j1"] [role="button"]')!)
  await waitFor(() => expect(container.querySelector('[data-held-risk-line]')).toBeTruthy())
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('MaterialsJobAccountsTab — a house’s notice window as a strip', () => {
  it('reads the notice words until the press; then each owed house gets its bar, ticks, told day and mark, and the red line reads as chips', async () => {
    const { container } = renderWithProviders(tab())
    await openTheJob(container)
    // Today's look: the words, no strip.
    expect(container.querySelectorAll('[data-held-house-notice]').length).toBe(2)
    expect(container.querySelector('[data-held-house-notice="open"]')?.textContent).toContain('its own notice by')
    expect(container.querySelector('[data-held-house-notice="said"]')?.textContent).toContain('its notice goes out')
    expect(container.querySelector('[data-held-risk-line] strong')?.textContent).toMatch(/^Paid in full · ZZ /)
    expect(container.querySelector('[data-held-notice-strip]')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Show the window strips' }))
    const strip = await screen.findByTestId('held-notice-strip-j1')
    expect(container.querySelectorAll('[data-held-house-notice]').length).toBe(0)
    expect(container.querySelector('[data-held-risk-line] strong')).toBeNull()
    expect(Array.from(container.querySelectorAll('[data-held-risk-line] [data-held-notice-chip]')).map((c) => c.textContent)).toEqual(['paid in full', '2 houses can still notice'])
    // Two rows: the bars by our count, the three invoices as ticks, the one told day as a diamond.
    expect(strip.querySelectorAll('[data-held-notice-row]').length).toBe(2)
    expect(strip.querySelectorAll('[data-held-notice-bar="open"], [data-held-notice-bar="soon"]').length).toBe(2)
    expect(strip.querySelectorAll('[data-held-notice-hatch]').length).toBe(2)
    expect(Array.from(strip.querySelectorAll('[data-held-notice-invoice]')).map((t) => t.getAttribute('data-held-notice-invoice'))).toEqual([INV_A, INV_B, INV_C])
    expect(strip.querySelector('[data-held-notice-told]')?.getAttribute('data-held-notice-told')).toBe(TOLD)
    expect(strip.querySelectorAll('[data-held-notice-today]').length).toBe(2)
    // The marks under the rows: the estimate guessed, the told day said, with who and when.
    expect(strip.querySelector('[data-held-notice-source-mark="guessed"]')?.textContent).toContain('ZZ Bluebonnet Supply · by ')
    expect(strip.querySelector('[data-held-notice-source-mark="guessed"]')?.textContent).toContain('guessed from the invoice months')
    expect(strip.querySelector('[data-held-notice-source-mark="said"]')?.textContent).toContain('they said · Marisol, ')
    // The guessed mark's arrow opens They told us… for that house.
    fireEvent.click(screen.getByRole('button', { name: 'They told us, for ZZ Bluebonnet Supply' }))
    expect(container.querySelector('[data-held-word-door="ZZ Bluebonnet Supply"]')?.getAttribute('aria-expanded')).toBe('true')
    // Remembered.
    expect(window.localStorage.getItem(KEY)).toBe('1')
    fireEvent.click(screen.getByRole('button', { name: 'Show today’s look' }))
    await waitFor(() => expect(container.querySelector('[data-held-notice-strip]')).toBeNull())
    expect(container.querySelectorAll('[data-held-house-notice]').length).toBe(2)
  })

  it('with ?sbs=1 a dev sees the words and the strips one above the other, captioned, with no switch', async () => {
    const { container } = render(
      <ToastProvider>
        <ConfirmDialogProvider>
          <MemoryRouter initialEntries={['/materials?tab=job-accounts&sbs=1']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            {tab()}
          </MemoryRouter>
        </ConfirmDialogProvider>
      </ToastProvider>,
    )
    await openTheJob(container)
    const sbs = await screen.findByTestId('held-sbs-j1')
    expect(sbs.querySelector('[data-side-by-side-today] p')?.textContent).toBe('Today')
    expect(sbs.querySelector('[data-side-by-side-shape] p')?.textContent).toBe('With the strip')
    expect(sbs.querySelectorAll('[data-side-by-side-today] [data-held-house-notice]').length).toBe(2)
    expect(sbs.querySelector('[data-side-by-side-today] [data-held-notice-strip]')).toBeNull()
    expect(sbs.querySelectorAll('[data-side-by-side-shape] [data-held-house-notice]').length).toBe(0)
    expect(sbs.querySelector('[data-side-by-side-shape] [data-held-notice-strip]')).toBeTruthy()
    expect(document.querySelector('[data-shape-switch]')).toBeNull()
  })
})
