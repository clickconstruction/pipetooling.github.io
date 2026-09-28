// @vitest-environment jsdom
/**
 * Render smokes for PlugInQuotesModal (RFQ Phase 1b) — the "Plug in quotes"
 * window where an estimator pastes a supply house's reply and saves it as a
 * quote on the bid. Pins: closed renders nothing and loads nothing; open shows
 * the title, the bid label and a supply house picker filled from the load; a
 * pasted reply becomes lines matched against the bid's rows, with what could
 * not be matched said out loud; Save waits for a house and a savable line; the
 * save writes the quote, its lines and the price memory, then reports; a
 * refused save says why and reports nothing; a dropped file flows through the
 * paste box, and one that cannot be read says so; and every way out calls
 * onClose.
 *
 * The parser's own rules live in lib/rfq/parseVendorReply.test.ts.
 */
import type { ComponentProps } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { PlugInQuotesModal } from './PlugInQuotesModal'

type Row = Record<string, unknown>

const state: {
  quotes: Row[]
  lines: Row[][]
  memory: Array<{ rows: Row[]; options: unknown }>
  /** supabase-js hands a refused write back as a plain object parsed from the response, not an Error. */
  quoteError: { message: string; code: string; details: string | null; hint: string | null } | null
} = { quotes: [], lines: [], memory: [], quoteError: null }

const { fetchHouses } = vi.hoisted(() => ({
  fetchHouses: vi.fn<() => Promise<Array<{ id: string; name: string }>>>(),
}))

vi.mock('../../lib/supplyHousePickerRows', () => ({
  fetchSupplyHousePickerRows: fetchHouses,
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'bid_quotes') {
        return {
          insert: (row: Row) => ({
            select: () => ({
              single: () => {
                if (state.quoteError) return Promise.resolve({ data: null, error: state.quoteError })
                state.quotes.push(row)
                return Promise.resolve({ data: { id: 'q-new' }, error: null })
              },
            }),
          }),
        }
      }
      if (table === 'bid_quote_lines') {
        return {
          insert: (rows: Row[]) => {
            state.lines.push(rows)
            return Promise.resolve({ data: null, error: null })
          },
        }
      }
      if (table === 'supply_house_fixture_prices') {
        return {
          upsert: (rows: Row[], options: unknown) => {
            state.memory.push({ rows, options })
            return Promise.resolve({ data: null, error: null })
          },
        }
      }
      throw new Error(`PlugInQuotesModal smoke: unexpected table ${table}`)
    },
  },
}))

const HOUSES = [
  { id: 'h-nws', name: 'National Wholesale Supply' },
  { id: 'h-ferg', name: 'Ferguson' },
]

const rows = [
  { id: 'r1', fixture: 'ft of 4IN WASTE', count: 752, unit: 'ft' },
  { id: 'r2', fixture: '3/4IN 90 WATER', count: 107, unit: null },
  { id: 'r3', fixture: 'WC-1', count: 4, unit: null },
]

/** Three lines the bid's rows answer, a priced line none of them answers, and a sign-off. */
const REPLY = ['4" cast iron 18.90/ft', '3/4 viega 90s $368/box of 50', 'wc carriers no stock til Oct', 'misc shop supplies 45.00', 'thanks, Dave'].join('\n')

type ModalProps = ComponentProps<typeof PlugInQuotesModal>

/** Mounts the window and lets the supply house load land before the test reads or clicks. */
async function mountModal(overrides: Partial<ModalProps> = {}) {
  const props: ModalProps = {
    open: true,
    onClose: () => {},
    onSaved: () => {},
    bidId: 'b359',
    bidVersionId: 'v-2',
    bidLabel: 'BP359 — Lakeline Retail',
    rows,
    ...overrides,
  }
  const result = renderWithProviders(<PlugInQuotesModal {...props} />)
  await settle()
  return result
}

/**
 * Drops the supply house list open, by the placeholder its trigger shows. Not named open…:
 * the settle sweep reads open…() as a render call, and this is a click on a settled window.
 */
function showHouseList() {
  fireEvent.click(screen.getByText('pick a supply house…'))
}

async function pickHouse(name: string) {
  showHouseList()
  fireEvent.click(await screen.findByRole('option', { name }))
}

function pasteAndMatch(text: string) {
  fireEvent.change(screen.getByPlaceholderText(/Paste the reply/), { target: { value: text } })
  fireEvent.click(screen.getByRole('button', { name: 'Match to fixtures' }))
}

function saveButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: /Save quote/ }) as HTMLButtonElement
}

beforeEach(() => {
  state.quotes = []
  state.lines = []
  state.memory = []
  state.quoteError = null
  fetchHouses.mockReset()
  fetchHouses.mockResolvedValue(HOUSES)
})

describe('PlugInQuotesModal', () => {
  it('renders nothing and loads nothing while it is closed', async () => {
    await mountModal({ open: false })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText('Plug in quotes')).toBeNull()
    expect(fetchHouses).not.toHaveBeenCalled()
  })

  it('opens with its title, the bid label and the supply houses from the load in the picker', async () => {
    await mountModal()
    expect(screen.getByRole('dialog', { name: 'Plug in quotes' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Plug in quotes' })).toBeTruthy()
    expect(screen.getByText(/BP359 — Lakeline Retail · paste the vendor’s reply/)).toBeTruthy()
    expect(screen.getByText('Paste and hit Match — or add lines by hand.')).toBeTruthy()
    expect(fetchHouses).toHaveBeenCalledTimes(1)

    showHouseList()
    expect(await screen.findByRole('option', { name: 'National Wholesale Supply' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Ferguson' })).toBeTruthy()
    fireEvent.click(screen.getByRole('option', { name: 'Ferguson' }))
    // The list closes and the picker shows the house that was picked.
    await waitFor(() => expect(screen.queryByRole('option')).toBeNull())
    expect(screen.getByText('Ferguson')).toBeTruthy()
    expect(screen.queryByText('pick a supply house…')).toBeNull()
  })

  it('still opens, with an empty picker, when the supply house load fails — and says the list did not load', async () => {
    fetchHouses.mockRejectedValue(new Error('supply_houses read refused'))
    await mountModal()
    expect(screen.getByRole('heading', { name: 'Plug in quotes' })).toBeTruthy()
    expect(await screen.findByText('supply_houses read refused')).toBeTruthy()
    showHouseList()
    expect(await screen.findByText('No matches')).toBeTruthy()
  })

  it('turns a pasted reply into lines matched to the bid’s rows, and shows what it could not match as unmatched', async () => {
    await mountModal()
    const match = screen.getByRole('button', { name: 'Match to fixtures' }) as HTMLButtonElement
    expect(match.disabled).toBe(true)

    pasteAndMatch(REPLY)

    // Each matched line sits on its row, labelled with the row's count.
    expect(await screen.findByText('ft of 4IN WASTE — 752 ft')).toBeTruthy()
    expect(screen.getByText('3/4IN 90 WATER — 107')).toBeTruthy()
    expect(screen.getByText('WC-1 — 4')).toBeTruthy()
    // The price is held per each: $368 for a box of 50 is 7.36.
    expect(screen.getByDisplayValue('18.90')).toBeTruthy()
    expect(screen.getByDisplayValue('7.36')).toBeTruthy()
    expect(screen.getByText('/box(50)')).toBeTruthy()
    // The words each line was matched from stay on screen; no stock reads as can't supply.
    expect(screen.getByText(/“4" cast iron 18\.90\/ft”/)).toBeTruthy()
    expect(screen.getByText(/can’t supply/)).toBeTruthy()
    // A price with no row to sit on waits for a fixture, and is not counted as savable.
    expect(screen.getByText('assign a fixture…')).toBeTruthy()
    expect(screen.getByDisplayValue('45.00')).toBeTruthy()
    expect(screen.getByText(/3 savable lines/)).toBeTruthy()
    // The sign-off matched nothing and carries no price.
    expect(screen.getByText(/Couldn’t match 1 line —/)).toBeTruthy()
    expect(screen.getByText('thanks, Dave')).toBeTruthy()
  })

  it('keeps Save disabled until there is a supply house and at least one savable line', async () => {
    await mountModal()
    expect(saveButton().disabled).toBe(true)
    expect(screen.getByText(/pick a supply house to save/)).toBeTruthy()

    // Lines, but no house.
    pasteAndMatch(REPLY)
    expect(await screen.findByText(/3 savable lines/)).toBeTruthy()
    expect(saveButton().disabled).toBe(true)

    // A house and lines.
    await pickHouse('Ferguson')
    await waitFor(() => expect(saveButton().disabled).toBe(false))
    expect(screen.queryByText(/pick a supply house to save/)).toBeNull()

    // A house, but the lines are gone.
    for (const remove of screen.getAllByRole('button', { name: 'Remove line' })) fireEvent.click(remove)
    expect(await screen.findByText(/0 savable lines/)).toBeTruthy()
    expect(saveButton().disabled).toBe(true)
  })

  it('saves the quote, its lines and the price memory, then reports saved and closes', async () => {
    const onSaved = vi.fn()
    const onClose = vi.fn()
    await mountModal({ onSaved, onClose })
    await pickHouse('Ferguson')
    fireEvent.change(screen.getByPlaceholderText('rep (optional)'), { target: { value: ' Dave ' } })
    fireEvent.change(screen.getByLabelText(/good until/), { target: { value: '2026-12-31' } })
    fireEvent.change(screen.getByLabelText(/freight \$/), { target: { value: '125' } })
    pasteAndMatch(REPLY)
    await waitFor(() => expect(saveButton().disabled).toBe(false))

    fireEvent.click(saveButton())
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(onClose).toHaveBeenCalledTimes(1)

    expect(state.quotes).toEqual([
      {
        bid_id: 'b359',
        bid_version_id: 'v-2',
        supply_house_id: 'h-ferg',
        quoted_by: 'Dave',
        source: 'pasted',
        valid_until: '2026-12-31',
        freight_cents: 12500,
        raw_paste: REPLY,
      },
    ])

    // The priced line that sits on no fixture is left out of the quote.
    expect(state.lines).toHaveLength(1)
    const written = state.lines[0] ?? []
    expect(written.map((l) => l.quote_id)).toEqual(['q-new', 'q-new', 'q-new'])
    expect(
      written.map((l) => ({
        fixture: l.fixture,
        unit_price_each_cents: l.unit_price_each_cents,
        price_basis: l.price_basis,
        basis_qty: l.basis_qty,
        cant_supply: l.cant_supply,
        matched_from: l.matched_from,
        lot_id: l.lot_id,
        lot_total_cents: l.lot_total_cents,
      })),
    ).toEqual([
      { fixture: 'ft of 4IN WASTE', unit_price_each_cents: 1890, price_basis: 'ft', basis_qty: 1, cant_supply: false, matched_from: '4" cast iron 18.90/ft', lot_id: null, lot_total_cents: null },
      { fixture: '3/4IN 90 WATER', unit_price_each_cents: 736, price_basis: 'box', basis_qty: 50, cant_supply: false, matched_from: '3/4 viega 90s $368/box of 50', lot_id: null, lot_total_cents: null },
      { fixture: 'WC-1', unit_price_each_cents: null, price_basis: 'each', basis_qty: 1, cant_supply: true, matched_from: 'wc carriers no stock til Oct', lot_id: null, lot_total_cents: null },
    ])

    // The price memory takes the priced lines only — a can't-supply line has nothing to remember.
    expect(state.memory).toHaveLength(1)
    expect(state.memory[0]?.options).toEqual({ onConflict: 'supply_house_id,fixture_key' })
    expect(
      (state.memory[0]?.rows ?? []).map((m) => ({
        supply_house_id: m.supply_house_id,
        fixture: m.fixture,
        unit_price_each_cents: m.unit_price_each_cents,
        source_bid_id: m.source_bid_id,
      })),
    ).toEqual([
      { supply_house_id: 'h-ferg', fixture: 'ft of 4IN WASTE', unit_price_each_cents: 1890, source_bid_id: 'b359' },
      { supply_house_id: 'h-ferg', fixture: '3/4IN 90 WATER', unit_price_each_cents: 736, source_bid_id: 'b359' },
    ])

    expect(await screen.findByText('Quote saved — 3 lines from Ferguson.')).toBeTruthy()
  })

  it('says why a save was refused, writes no lines and does not report saved', async () => {
    state.quoteError = { message: 'new row violates row-level security policy', code: '42501', details: null, hint: null }
    const onSaved = vi.fn()
    const onClose = vi.fn()
    await mountModal({ onSaved, onClose, bidVersionId: null })
    await pickHouse('National Wholesale Supply')
    pasteAndMatch(REPLY)
    await waitFor(() => expect(saveButton().disabled).toBe(false))

    fireEvent.click(saveButton())
    // The refusal arrives as a plain object; the window still says why.
    expect(await screen.findByText("You don't have permission to save the quote.")).toBeTruthy()
    // The window stays open on the same lines, ready for another try.
    await waitFor(() => expect(saveButton().disabled).toBe(false))
    expect(screen.getByText(/3 savable lines/)).toBeTruthy()
    expect(state.lines).toEqual([])
    expect(state.memory).toEqual([])
    expect(onSaved).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('reads a dropped file through the paste box, and says so when it cannot read one', async () => {
    await mountModal()
    fireEvent.change(screen.getByLabelText(/browse/), { target: { files: [new File(['not a quote'], 'reply.docx')] } })
    expect(await screen.findByText('Drop a .xlsx, .csv, or .pdf — or just paste the text.')).toBeTruthy()
    const paste = screen.getByPlaceholderText(/Paste the reply/) as HTMLTextAreaElement
    expect(paste.value).toBe('')

    const csv = 'Item,Unit price\n"4"" cast iron",18.90\n'
    // jsdom's File has no text(); the browser's does.
    const file = Object.assign(new File([csv], 'ferguson-reply.csv', { type: 'text/csv' }), { text: () => Promise.resolve(csv) })
    fireEvent.change(screen.getByLabelText(/browse/), { target: { files: [file] } })

    expect(await screen.findByText('ft of 4IN WASTE — 752 ft')).toBeTruthy()
    expect(paste.value).toBe('[file: ferguson-reply.csv — 2 lines]\nItem  Unit price\n4" cast iron  18.90')
    expect(screen.getByDisplayValue('18.90')).toBeTruthy()
    expect(screen.getByText(/1 savable line ·/)).toBeTruthy()
    // Only the sheet's heading row goes unmatched: the [file: …] line never reaches the match.
    expect(screen.getByText(/Couldn’t match 1 line —/)).toBeTruthy()
    expect(screen.getByText('Item Unit price')).toBeTruthy()
  })

  it('calls onClose from Cancel, the × and the Escape key', async () => {
    const onClose = vi.fn()
    await mountModal({ onClose })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(2)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(3)
  })
})
