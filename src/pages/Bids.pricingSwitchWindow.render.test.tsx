// @vitest-environment jsdom
/**
 * Bids → Pricing, the short window after a price card is clicked (v2.5671, the gaps v2.5669 left).
 *
 * v2.5669 made only the newest read of the open price write its book and rows, and gave the screen
 * `pricingPricesReady`. Until the clicked price's reads land, the Workbench still holds the price you
 * left. Two things went wrong in that window. The strip and the rows read the left price's rows
 * through the open price's eyes: $0 and dashes. And a price write looked up "existing" rows and book
 * entries in that state, so "Fill from book" would point the open price at the other price's entry.
 *
 * Now the strip's figures and the rows' price cells read … until the reads land, and a price write in
 * the window waits with a toast. This renders the whole page on Pricing with a read-holding Supabase
 * stand-in (the engine test's, `useBidPricingEngine.priceSwitch.render.test.tsx`), clicks the
 * Alternate 1 card with its book and rows held back, and lets them land.
 */
import type { ReactElement, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '../contexts/ToastContext'
import { ConfirmDialogProvider } from '../contexts/ConfirmDialogContext'
import { ThemeProvider } from '../contexts/ThemeContext'

type Row = Record<string, unknown>

const page = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  /** Reads held until the test lets them land: a table plus the eq() filters that pick the read out. */
  holds: [] as Array<{ table: string; eqs: Record<string, unknown>; gate: Promise<void> }>,
  /** Every insert / update / upsert / delete the page sends, in order. */
  writes: [] as Array<{ table: string; op: string; payload: unknown }>,
}))

function holdNextRead(table: string, eqs: Record<string, unknown>): () => void {
  let release = () => {}
  const gate = new Promise<void>((r) => {
    release = r
  })
  page.holds.push({ table, eqs, gate })
  return release
}

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  const generic = makeSupabaseStub()
  /** The page's own role and bid list read whole, as the Bids smoke reads them; the pricing tables by their filters. */
  const UNFILTERED = new Set(['users', 'service_types', 'bids'])
  function makeBuilder(table: string) {
    let single = false
    let op: string | null = null
    let payload: unknown
    let signal: AbortSignal | null = null
    const eqs: Record<string, unknown> = {}
    const filters: ((r: Row) => boolean)[] = []
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'or', 'not', 'contains', 'filter', 'order', 'range', 'limit', 'setHeader']) b[m] = () => b
    for (const m of ['insert', 'update', 'upsert', 'delete']) {
      b[m] = (p?: unknown) => {
        op = m
        payload = p
        return b
      }
    }
    b.abortSignal = (s: AbortSignal) => {
      signal = s
      return b
    }
    b.eq = (col: string, val: unknown) => {
      eqs[col] = val
      filters.push((r) => r[col] === val)
      return b
    }
    b.is = (col: string, val: unknown) => {
      filters.push((r) => (r[col] ?? null) === val)
      return b
    }
    b.in = (col: string, vals: unknown[]) => {
      filters.push((r) => vals.includes(r[col]))
      return b
    }
    b.single = () => {
      single = true
      return b
    }
    b.maybeSingle = b.single
    let settled: Promise<unknown> | null = null
    const result = () => {
      settled ??= (async () => {
        if (op) {
          page.writes.push({ table, op, payload })
          // A write lands on the seeded rows (v2.6001), so the page's own reload after a save reads what it wrote.
          const rows = page.tables[table] ?? (page.tables[table] = [])
          if (op === 'update') for (const r of rows) if (filters.every((f) => f(r))) Object.assign(r, payload as Row)
          else if (op === 'insert' || op === 'upsert') rows.push(...(Array.isArray(payload) ? (payload as Row[]) : [payload as Row]))
          else if (op === 'delete') page.tables[table] = rows.filter((r) => !filters.every((f) => f(r)))
          return { data: single ? null : [], error: null }
        }
        const i = page.holds.findIndex((h) => h.table === table && Object.entries(h.eqs).every(([k, v]) => eqs[k] === v))
        if (i >= 0) {
          const [hold] = page.holds.splice(i, 1)
          await hold!.gate
        }
        if (signal?.aborted) return { data: null, error: { message: 'AbortError: signal is aborted without reason', code: '' }, status: 0 }
        const all = page.tables[table] ?? []
        const rows = UNFILTERED.has(table) ? all : all.filter((r) => filters.every((f) => f(r)))
        return { data: single ? (rows[0] ?? null) : rows, error: null, count: rows.length }
      })()
      return settled
    }
    b.then = (f?: (v: unknown) => unknown, r?: (e: unknown) => unknown) => result().then(f, r)
    b.catch = (r?: (e: unknown) => unknown) => result().catch(r)
    b.finally = (fin?: () => void) => result().finally(fin)
    return b
  }
  return { supabase: { ...generic, from: (table: string) => makeBuilder(table) } }
})

vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock()
})

import Bids from './Bids'
import { installDomShims, settle } from '../test/renderSmokeMocks'
import { OPEN_PRICE_LOADING_MESSAGE } from '../lib/bids/priceReadGate'

const BID: Row = {
  id: 'b1',
  bid_number: '398',
  project_name: 'ZZ Test Switch',
  address: '1 Test Way',
  service_type_id: 'st-1',
  outcome: null,
  bid_date_sent: null,
  bid_due_date: '2026-11-01',
  bid_value: null,
  customer_id: null,
  gc_builder_id: null,
  customers: null,
  bids_gc_builders: null,
  estimator_id: null,
  account_manager_id: null,
  created_by: 'someone-else',
  estimator: null,
  account_manager: null,
  adopted_into_bid_id: null,
  working_board_archived_at: null,
  materials_model: 'exact',
  selected_bid_version_id: 'ver-A',
  selected_price_book_version_id: 'pbv-wendi',
}

function seed() {
  page.tables = {
    users: [{ id: 'smoke-user', name: 'Smoke User', role: 'dev', estimator_service_type_ids: null, primary_service_type_ids: null, superintendent_service_type_ids: null }],
    service_types: [{ id: 'st-1', name: 'Plumbing', sequence_order: 1 }],
    bids: [BID],
    bid_versions: [{ id: 'ver-A', bid_id: 'b1', name: 'WENDI', sort_order: 0, starred_price_book_version_id: 'pbv-wendi' }],
    price_book_versions: [
      { id: 'pbv-wendi', bid_id: 'b1', bid_version_id: 'ver-A', name: 'WENDI', sort_order: 0 },
      { id: 'pbv-alt', bid_id: 'b1', bid_version_id: 'ver-A', name: 'Alternate 1', sort_order: 1, include_in_submission: true },
    ],
    // Two rows carry the plans' names and are priced through their assignments; the floor drain has
    // none on either price, and its name is a book entry's, so "Fill from book" offers it.
    bids_count_rows: [
      { id: 'r1', bid_id: 'b1', bid_version_id: 'ver-A', fixture: 'L-1 Lavatory', count: 3, sequence_order: 0 },
      { id: 'r2', bid_id: 'b1', bid_version_id: 'ver-A', fixture: 'WC-1 Water closet', count: 2, sequence_order: 1 },
      { id: 'r3', bid_id: 'b1', bid_version_id: 'ver-A', fixture: 'Floor drain', count: 1, sequence_order: 2 },
    ],
    cost_estimates: [{ id: 'ce1', bid_id: 'b1', labor_rate: 90 }],
    price_book_entries: [
      { id: 'e-w1', version_id: 'pbv-wendi', total_price: 100, sequence_order: 0, fixture_types: { name: 'Lavatory' } },
      { id: 'e-w2', version_id: 'pbv-wendi', total_price: 100, sequence_order: 1, fixture_types: { name: 'Water closet' } },
      { id: 'e-w3', version_id: 'pbv-wendi', total_price: 40, sequence_order: 2, fixture_types: { name: 'Floor drain' } },
      { id: 'e-a1', version_id: 'pbv-alt', total_price: 50, sequence_order: 0, fixture_types: { name: 'Lavatory' } },
      { id: 'e-a2', version_id: 'pbv-alt', total_price: 50, sequence_order: 1, fixture_types: { name: 'Water closet' } },
      { id: 'e-a3', version_id: 'pbv-alt', total_price: 20, sequence_order: 2, fixture_types: { name: 'Floor drain' } },
    ],
    bid_pricing_assignments: [
      { id: 'a-w1', bid_id: 'b1', price_book_version_id: 'pbv-wendi', count_row_id: 'r1', price_book_entry_id: 'e-w1', is_fixed_price: false, unit_price_override: null },
      { id: 'a-w2', bid_id: 'b1', price_book_version_id: 'pbv-wendi', count_row_id: 'r2', price_book_entry_id: 'e-w2', is_fixed_price: false, unit_price_override: null },
      { id: 'a-a1', bid_id: 'b1', price_book_version_id: 'pbv-alt', count_row_id: 'r1', price_book_entry_id: 'e-a1', is_fixed_price: false, unit_price_override: null },
      { id: 'a-a2', bid_id: 'b1', price_book_version_id: 'pbv-alt', count_row_id: 'r2', price_book_entry_id: 'e-a2', is_fixed_price: false, unit_price_override: null },
    ],
  }
}

/** jsdom has no `CSS.escape`; the tab strips use it to find the open tab's button. */
function installCssEscapeShim() {
  const g = globalThis as { CSS?: { escape?: (value: string) => string } }
  if (!g.CSS) g.CSS = {}
  if (!g.CSS.escape) g.CSS.escape = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`)
}

function renderPricing() {
  installDomShims()
  installCssEscapeShim()
  return render((<Bids />) as ReactElement, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ThemeProvider>
        <ToastProvider>
          <ConfirmDialogProvider>
            <MemoryRouter initialEntries={['/bids?tab=pricing&bidId=b1']} future={{ v7_startTransition: false, v7_relativeSplatPath: true }}>
              {children}
            </MemoryRouter>
          </ConfirmDialogProvider>
        </ToastProvider>
      </ThemeProvider>
    ),
  })
}

/** The strip's tile: its uppercase label and the value under it. */
function tile(label: string): string | null {
  const key = [...document.querySelectorAll('span')].find((s) => s.textContent === label && s.nextElementSibling)
  return key?.nextElementSibling?.textContent ?? null
}
const salePriceBox = (fixture: string) => screen.queryByLabelText(`Sale price per unit for ${fixture}`) as HTMLInputElement | null
const fillButton = () => screen.getByRole('button', { name: /matching from book|unassigned rows match the book/ })
const assignmentInserts = () => page.writes.filter((w) => w.table === 'bid_pricing_assignments' && w.op === 'insert')

// WENDI: 3 × $100 + 2 × $100 + the floor drain at its book's $40 by name. Alternate 1: 3 × $50 + 2 × $50 + $20.
// The strip prices to the cent since v2.5678 (AmountSmallCents — textContent carries the full figure).
const WENDI_REVENUE = '$540.00'
const ALT_REVENUE = '$270.00'

async function openOnWendi() {
  renderPricing()
  await waitFor(() => expect(tile('Revenue')).toBe(WENDI_REVENUE), { timeout: 4000 })
  await settle()
}

/** Click the Alternate 1 card with its book and rows held back; returns the hand that lets them land. */
async function clickAlternateHeld(): Promise<() => Promise<void>> {
  // The card's own book read and the book effect's, and the resolve effect's read of its rows.
  const releases = [
    holdNextRead('price_book_entries', { version_id: 'pbv-alt' }),
    holdNextRead('price_book_entries', { version_id: 'pbv-alt' }),
    holdNextRead('bid_pricing_assignments', { price_book_version_id: 'pbv-alt' }),
  ]
  const card = screen.getAllByTitle('View this price (doesn’t change what the GC sees)').find((el) => within(el).queryByText('Alternate 1'))
  expect(card).toBeTruthy()
  fireEvent.click(card!)
  await settle()
  return async () => {
    await act(async () => {
      for (const r of releases) r()
    })
  }
}

beforeEach(() => {
  seed()
  page.holds = []
  page.writes = []
})
afterEach(() => cleanup())

describe('Bids → Pricing: the window after a price card is clicked (v2.5671)', () => {
  it('the strip and the rows read … until the clicked price lands, then its own figures', async () => {
    await openOnWendi()
    expect(salePriceBox('L-1 Lavatory')?.value).toBe('$100.00')
    const land = await clickAlternateHeld()

    expect(tile('Revenue')).toBe('…')
    expect(tile('Profit')).toBe('…')
    expect(tile('Margin')).toBe('…')
    // No box to type into while the price loads: the row's price cell reads … too.
    expect(salePriceBox('L-1 Lavatory')).toBeNull()

    await land()
    await waitFor(() => expect(tile('Revenue')).toBe(ALT_REVENUE))
    expect(salePriceBox('L-1 Lavatory')?.value).toBe('$50.00')
    expect(tile('Profit')).not.toBe('…')
  })

  it('a price write in the window waits with a toast and writes nothing; once the price lands it writes to its own entry', async () => {
    await openOnWendi()
    const land = await clickAlternateHeld()

    // Held back, the book on screen is still WENDI's: a fill now would point Alternate 1 at WENDI's entry.
    fireEvent.click(fillButton())
    expect(await screen.findByText(OPEN_PRICE_LOADING_MESSAGE)).toBeTruthy()
    await settle()
    expect(assignmentInserts()).toEqual([])

    await land()
    await waitFor(() => expect(tile('Revenue')).toBe(ALT_REVENUE))
    fireEvent.click(fillButton())
    await waitFor(() => expect(assignmentInserts()).toHaveLength(1))
    expect(assignmentInserts()[0]!.payload).toEqual([{ bid_id: 'b1', count_row_id: 'r3', price_book_entry_id: 'e-a3', price_book_version_id: 'pbv-alt' }])
  })

  it('the open price\'s card reads … with the strip, never "No prices yet"', async () => {
    await openOnWendi()
    const land = await clickAlternateHeld()
    const open = screen.getByTitle('The price open on this Workbench')
    expect(within(open).getByText('Alternate 1')).toBeTruthy()
    expect(within(open).getByText('…')).toBeTruthy()
    expect(screen.queryByText('No prices yet')).toBeNull()
    await land()
    await waitFor(() => expect(tile('Revenue')).toBe(ALT_REVENUE))
    expect(within(screen.getByTitle('The price open on this Workbench')).queryByText('…')).toBeNull()
  })
})

describe('Bids → Pricing: a typed $0 is a price (v2.6001, Wendi: "why can\'t I make something zero?")', () => {
  it('typing 0 into a sale price saves $0.00; the cell keeps it after the reload and the strip follows', async () => {
    await openOnWendi()
    const box = salePriceBox('L-1 Lavatory')!
    expect(box.value).toBe('$100.00')
    fireEvent.focus(box)
    fireEvent.change(box, { target: { value: '0' } })
    fireEvent.blur(box)
    await waitFor(() =>
      expect(page.writes.some((w) => w.table === 'bid_pricing_assignments' && w.op === 'update' && (w.payload as { unit_price_override?: number }).unit_price_override === 0)).toBe(true),
    )
    await settle()
    // Not "—", not $100.00: the zero she typed, kept through the save's own reload.
    await waitFor(() => expect(salePriceBox('L-1 Lavatory')!.value).toBe('$0.00'))
    expect(tile('Revenue')).toBe('$240.00')
  })
})

