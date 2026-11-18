// @vitest-environment jsdom
/**
 * What the price is made of, as a hook (decomposition queue row 1): the state and the writes that
 * stood inline in `BidsPricingTab`. A probe mounts the hook the way the tab calls it and keeps its
 * latest value. Pins: the marks are seeded from the count rows and seeded again when they change;
 * the bid's markup is its own factor, else the company's; the chip previews without writing and
 * writes once on leaving, behind the sent-bid lock, and goes back when the write fails; a row's
 * edit shows at once and is written to that row, a failed row is put back, and tags skip the lock;
 * the Markup and Tax tools write every row in scope, keep one Undo and close; the markup cell
 * writes only a changed number; the open splits are remembered per bid on this device.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, waitFor } from '@testing-library/react'
import { renderWithProviders, settle } from '../test/renderSmokeMocks'
import { usePricingRowMarks, type PricingRowMarks, type PricingRowMarksArgs } from './usePricingRowMarks'
import { withSplitMarkup } from '../lib/bids/rowMarksEdits'
import type { RowMarks } from '../lib/bids/rowKinds'

const toasts: Array<[string, string]> = []
vi.mock('../contexts/ToastContext', async (importActual) => {
  const actual = await importActual<typeof import('../contexts/ToastContext')>()
  return { ...actual, useToastContext: () => ({ showToast: (m: string, kind: string) => toasts.push([m, kind]), showActionToast: () => {} }) }
})

/** What the stubbed client was asked to write to `bids`, and what it answers. */
const bidWrites: Array<{ table: string; payload: unknown; id: unknown }> = []
let bidWriteError: { message: string } | null = null
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      update: (payload: unknown) => ({
        eq: async (_col: string, id: unknown) => {
          bidWrites.push({ table, payload, id })
          return { error: bidWriteError }
        },
      }),
    }),
  },
}))

let companyFactor = 1.4
vi.mock('../lib/bids/materialsByStageIo', async (importActual) => {
  const actual = await importActual<typeof import('../lib/bids/materialsByStageIo')>()
  return { ...actual, loadSovMaterialFactorDefault: async () => companyFactor }
})

/** Every row save the hook asked for, in order, and the rows that answer with a failure. */
const rowSaves: Array<[string, RowMarks]> = []
let rowSaveFails: Record<string, { error: string; missing: boolean }> = {}
vi.mock('../lib/bids/rowMarksIo', async (importActual) => {
  const actual = await importActual<typeof import('../lib/bids/rowMarksIo')>()
  return {
    ...actual,
    saveRowMarks: async (_client: unknown, rowId: string, m: RowMarks) => {
      rowSaves.push([rowId, m])
      return rowSaveFails[rowId] ?? { error: null, missing: false }
    },
  }
})

/** The open version's count rows as the engine hands them over: the marks ride on the row. */
const COUNT_ROWS = [
  { id: 'wc', fixture: 'Water closet', kind: 'fixture', tags: ['restrooms'], split_material_cents: null, split_markup_pct: 60, split_taxable: null },
  { id: 'lav', fixture: 'Lavatory', kind: null, tags: null, split_material_cents: 90000, split_markup_pct: null, split_taxable: null },
  { id: 'drain', fixture: 'Floor drain', kind: null, tags: null, split_material_cents: null, split_markup_pct: null, split_taxable: null },
]
const BID = { id: 'bid-1', sov_material_factor: 1.35 }

let guardAllows = true
let guardAsked = 0
const patched: Array<[string, Record<string, unknown>]> = []
let h: PricingRowMarks

function Probe(over: Partial<PricingRowMarksArgs>) {
  h = usePricingRowMarks({
    bid: BID,
    pricingCountRows: COUNT_ROWS,
    locked: false,
    guardPricingWrite: () => {
      guardAsked += 1
      return guardAllows
    },
    onPatchBid: (bidId, patch) => patched.push([bidId, patch]),
    ...over,
  })
  return <div data-testid="markup">{h.materialMarkup.toFixed(4)}</div>
}

async function mount(over: Partial<PricingRowMarksArgs> = {}) {
  const view = renderWithProviders(<Probe {...over} />)
  // The company number lands after the first paint; every case reads the settled hook.
  await waitFor(() => expect(h.sovFactorDefault).toBe(companyFactor))
  return view
}

beforeEach(() => {
  toasts.length = 0
  bidWrites.length = 0
  bidWriteError = null
  companyFactor = 1.4
  rowSaves.length = 0
  rowSaveFails = {}
  guardAllows = true
  guardAsked = 0
  patched.length = 0
  window.localStorage.clear()
})
afterEach(cleanup)

describe('usePricingRowMarks — the marks', () => {
  it('seeds every row from the count rows', async () => {
    await mount()
    expect(h.rowMarks).toEqual({
      wc: { kind: 'fixture', tags: ['restrooms'], split: { material: null, markup: 0.6, taxable: null } },
      lav: { kind: null, tags: [], split: { material: 900, markup: null, taxable: null } },
      drain: { kind: null, tags: [], split: null },
    })
    expect(rowSaves).toEqual([])
  })

  it('seeds again when the rows change, and writes nothing for it', async () => {
    const view = await mount()
    view.rerender(<Probe pricingCountRows={[{ id: 'tub' }]} />)
    await waitFor(() => expect(Object.keys(h.rowMarks)).toEqual(['tub']))
    expect(rowSaves).toEqual([])
  })

  it("one row's edit shows at once and is written to that row", async () => {
    await mount()
    act(() => h.updateRowMarks('drain', (m) => ({ ...m, kind: 'pipe' })))
    expect(h.rowMarks.drain).toEqual({ kind: 'pipe', tags: [], split: null })
    await settle()
    expect(rowSaves).toEqual([['drain', { kind: 'pipe', tags: [], split: null }]])
    expect(guardAsked).toBe(1)
    expect(toasts).toEqual([])
  })

  it('the lock refuses a kind or a split, and lets a tag through unasked', async () => {
    guardAllows = false
    await mount()
    act(() => h.updateRowMarks('drain', (m) => ({ ...m, kind: 'pipe' })))
    expect(h.rowMarks.drain?.kind).toBeNull()
    await settle()
    expect(rowSaves).toEqual([])

    act(() => h.updateRowMarks('drain', (m) => ({ ...m, tags: ['later'] }), { free: true }))
    expect(h.rowMarks.drain?.tags).toEqual(['later'])
    await settle()
    expect(rowSaves).toEqual([['drain', { kind: null, tags: ['later'], split: null }]])
    expect(guardAsked).toBe(1)
  })

  it('a row whose save fails is put back as it stood, with the reason', async () => {
    rowSaveFails = { drain: { error: 'permission denied for table bids_count_rows', missing: false } }
    await mount()
    act(() => h.updateRowMarks('drain', (m) => ({ ...m, kind: 'pipe' })))
    expect(h.rowMarks.drain?.kind).toBe('pipe')
    await waitFor(() => expect(h.rowMarks.drain?.kind).toBeNull())
    expect(toasts).toEqual([['Could not save the row: permission denied for table bids_count_rows', 'error']])
  })

  it('before the columns exist the edit is put back and the note shows once', async () => {
    rowSaveFails = { drain: { error: 'column not there', missing: true }, lav: { error: 'column not there', missing: true } }
    await mount()
    act(() => h.updateRowMarks('drain', (m) => ({ ...m, kind: 'pipe' })))
    await waitFor(() => expect(toasts).toHaveLength(1))
    act(() => h.updateRowMarks('lav', (m) => ({ ...m, kind: 'pipe' })))
    await waitFor(() => expect(h.rowMarks.lav?.kind).toBeNull())
    expect(toasts).toEqual([['Kinds, tags and the split save once the database update is in. They show on this screen until then.', 'warning']])
  })
})

describe('usePricingRowMarks — the bid markup', () => {
  it("is the bid's own factor less one", async () => {
    await mount()
    expect(h.materialMarkup).toBeCloseTo(0.35, 10)
    expect(h.sovFactorDefault).toBe(1.4)
  })

  it("is the company's when the bid has none", async () => {
    await mount({ bid: { id: 'bid-2', sov_material_factor: null } })
    expect(h.materialMarkup).toBeCloseTo(0.4, 10)
  })

  it('follows the bid on screen', async () => {
    const view = await mount()
    view.rerender(<Probe bid={{ id: 'bid-3', sov_material_factor: '1.2000' }} />)
    await waitFor(() => expect(h.materialMarkup).toBeCloseTo(0.2, 10))
    expect(bidWrites).toEqual([])
  })

  it('the chip previews as it is typed and writes nothing', async () => {
    await mount()
    act(() => h.previewBidMarkup(0.5))
    expect(h.materialMarkup).toBeCloseTo(0.5, 10)
    act(() => h.previewBidMarkup(null))
    expect(h.materialMarkup).toBeCloseTo(0.4, 10)
    expect(bidWrites).toEqual([])
    expect(guardAsked).toBe(0)
  })

  it('a locked bid does not preview', async () => {
    await mount({ locked: true })
    act(() => h.previewBidMarkup(0.5))
    expect(h.materialMarkup).toBeCloseTo(0.35, 10)
  })

  it('leaving the chip writes the factor to the bid and tells the parent', async () => {
    await mount()
    await act(async () => h.commitBidMarkup(0.25))
    expect(bidWrites).toEqual([{ table: 'bids', payload: { sov_material_factor: 1.25 }, id: 'bid-1' }])
    expect(patched).toEqual([['bid-1', { sov_material_factor: 1.25 }]])
    expect(h.materialMarkup).toBeCloseTo(0.25, 10)
    expect(toasts).toEqual([])
  })

  it('clearing the chip writes null, the company number again', async () => {
    await mount()
    await act(async () => h.commitBidMarkup(null))
    expect(bidWrites).toEqual([{ table: 'bids', payload: { sov_material_factor: null }, id: 'bid-1' }])
    expect(h.materialMarkup).toBeCloseTo(0.4, 10)
  })

  it('the markup already saved writes nothing and asks no lock', async () => {
    await mount()
    await act(async () => h.commitBidMarkup(0.35))
    expect(bidWrites).toEqual([])
    expect(guardAsked).toBe(0)
  })

  it('the lock refuses the write and the chip goes back', async () => {
    guardAllows = false
    await mount()
    act(() => h.previewBidMarkup(0.5))
    await act(async () => h.commitBidMarkup(0.5))
    expect(bidWrites).toEqual([])
    expect(patched).toEqual([])
    expect(h.materialMarkup).toBeCloseTo(0.35, 10)
  })

  it('a write that fails says why and the chip goes back', async () => {
    bidWriteError = { message: 'row is read only' }
    await mount()
    await act(async () => h.commitBidMarkup(0.25))
    expect(toasts).toEqual([['Could not save the markup: row is read only', 'error']])
    expect(patched).toEqual([])
    expect(h.materialMarkup).toBeCloseTo(0.35, 10)
  })

  it('no bid writes nothing', async () => {
    await mount({ bid: null })
    await act(async () => h.commitBidMarkup(0.25))
    expect(bidWrites).toEqual([])
  })
})

describe('usePricingRowMarks — the Markup and Tax tools', () => {
  it('Markup writes every row in scope, keeps one Undo and closes', async () => {
    await mount()
    act(() => h.setMarkupToolOpen(true))
    act(() => h.applyMarkupTool(['wc', 'drain'], 0.25))
    expect(h.markupToolOpen).toBe(false)
    expect(h.markupUndo).toEqual([
      { rowId: 'wc', markup: 0.6 },
      { rowId: 'drain', markup: undefined },
    ])
    expect(h.rowMarks.wc?.split).toEqual({ material: null, markup: 0.25, taxable: null })
    expect(h.rowMarks.drain?.split).toEqual({ markup: 0.25 })
    expect(h.rowMarks.lav?.split).toEqual({ material: 900, markup: null, taxable: null })
    await settle()
    expect(rowSaves.map(([id]) => id)).toEqual(['wc', 'drain'])
  })

  it('Undo writes each row back as it stood', async () => {
    await mount()
    act(() => h.applyMarkupTool(['wc', 'drain'], 0.25))
    await settle()
    rowSaves.length = 0
    act(() => h.undoMarkupTool())
    expect(h.markupUndo).toBeNull()
    expect(h.rowMarks.wc?.split?.markup).toBe(0.6)
    expect(h.rowMarks.drain?.split?.markup).toBeNull()
    await settle()
    expect(rowSaves).toEqual([
      ['wc', { kind: 'fixture', tags: ['restrooms'], split: { material: null, markup: 0.6, taxable: null } }],
      ['drain', { kind: null, tags: [], split: { markup: null } }],
    ])
  })

  it('the lock refuses the tool: no write, no Undo, and the tool stays open', async () => {
    guardAllows = false
    await mount()
    act(() => h.setMarkupToolOpen(true))
    act(() => h.applyMarkupTool(['wc'], 0.25))
    expect(h.markupToolOpen).toBe(true)
    expect(h.markupUndo).toBeNull()
    expect(h.rowMarks.wc?.split?.markup).toBe(0.6)
    await settle()
    expect(rowSaves).toEqual([])
  })

  it('a scope of no rows does nothing and asks no lock', async () => {
    await mount()
    act(() => h.setMarkupToolOpen(true))
    act(() => h.applyMarkupTool([], 0.25))
    expect(h.markupToolOpen).toBe(true)
    expect(h.markupUndo).toBeNull()
    expect(guardAsked).toBe(0)
  })

  it('Tax makes rows tax-free, keeps one Undo and closes; Undo puts the rule back', async () => {
    await mount()
    act(() => h.setTaxToolOpen(true))
    act(() => h.applyTaxTool(['wc', 'lav'], false))
    expect(h.taxToolOpen).toBe(false)
    expect(h.taxUndo).toEqual([
      { rowId: 'wc', taxable: null },
      { rowId: 'lav', taxable: null },
    ])
    expect(h.rowMarks.wc?.split?.taxable).toBe(false)
    expect(h.rowMarks.lav?.split).toEqual({ material: 900, markup: null, taxable: false })
    await settle()
    expect(rowSaves.map(([id]) => id)).toEqual(['wc', 'lav'])

    act(() => h.undoTaxTool())
    expect(h.taxUndo).toBeNull()
    expect(h.rowMarks.wc?.split?.taxable).toBeNull()
    expect(h.rowMarks.lav?.split?.taxable).toBeNull()
  })

  it('Undo with nothing to undo does nothing', async () => {
    await mount()
    act(() => h.undoMarkupTool())
    act(() => h.undoTaxTool())
    await settle()
    expect(rowSaves).toEqual([])
    expect(guardAsked).toBe(0)
  })
})

describe("usePricingRowMarks — a row's markup cell", () => {
  it('previews the typed markup on its row and writes nothing', async () => {
    await mount()
    expect(h.rowMarkupPreview).toBeNull()
    act(() => h.setWbMarkupDraft({ rowId: 'drain', text: '45' }))
    expect(h.rowMarkupPreview).toEqual({ rowId: 'drain', markup: 0.45 })
    act(() => h.setWbMarkupDraft({ rowId: 'drain', text: '4x' }))
    expect(h.rowMarkupPreview).toBeNull()
    await settle()
    expect(rowSaves).toEqual([])
  })

  it('leaving the cell writes a changed markup to the row', async () => {
    await mount()
    act(() => h.commitRowMarkupText('drain', '45%'))
    expect(h.rowMarks.drain).toEqual(withSplitMarkup({ kind: null, tags: [], split: null }, 0.45))
    await settle()
    expect(rowSaves).toEqual([['drain', { kind: null, tags: [], split: { markup: 0.45 } }]])
  })

  it("the row's own markup typed again, or text that is not a markup, writes nothing", async () => {
    await mount()
    act(() => h.commitRowMarkupText('wc', '60'))
    act(() => h.commitRowMarkupText('wc', 'abc'))
    act(() => h.commitRowMarkupText('drain', ''))
    await settle()
    expect(rowSaves).toEqual([])
    expect(guardAsked).toBe(0)
  })

  it("the cell emptied clears the row's own markup", async () => {
    await mount()
    act(() => h.commitRowMarkupText('wc', ''))
    expect(h.rowMarks.wc?.split?.markup).toBeNull()
    await settle()
    expect(rowSaves).toEqual([['wc', { kind: 'fixture', tags: ['restrooms'], split: { material: null, markup: null, taxable: null } }]])
  })

  it('the tag box opens on one row at a time', async () => {
    await mount()
    expect(h.tagEditRowId).toBeNull()
    act(() => h.setTagEditRowId('wc'))
    expect(h.tagEditRowId).toBe('wc')
    act(() => h.setTagEditRowId('lav'))
    expect(h.tagEditRowId).toBe('lav')
  })
})

describe('usePricingRowMarks — the open splits', () => {
  it('starts from what this device remembers for the bid', async () => {
    window.localStorage.setItem('pt.pricing.split.open.bid-1', JSON.stringify(['wc']))
    await mount()
    await waitFor(() => expect([...h.wbSplitOpen]).toEqual(['wc']))
  })

  it('a chevron opens and closes its row and the device remembers', async () => {
    await mount()
    act(() => h.toggleSplitRow('lav'))
    expect([...h.wbSplitOpen]).toEqual(['lav'])
    expect(window.localStorage.getItem('pt.pricing.split.open.bid-1')).toBe('["lav"]')
    act(() => h.toggleSplitRow('lav'))
    expect([...h.wbSplitOpen]).toEqual([])
    expect(window.localStorage.getItem('pt.pricing.split.open.bid-1')).toBe('[]')
  })

  it('Expand all and Collapse all write the whole set', async () => {
    await mount()
    act(() => h.writeSplitOpen(new Set(['wc', 'lav', 'drain'])))
    expect(window.localStorage.getItem('pt.pricing.split.open.bid-1')).toBe('["wc","lav","drain"]')
    act(() => h.writeSplitOpen(new Set()))
    expect([...h.wbSplitOpen]).toEqual([])
  })

  it("another bid reads its own rows, never the last bid's", async () => {
    window.localStorage.setItem('pt.pricing.split.open.bid-1', JSON.stringify(['wc']))
    window.localStorage.setItem('pt.pricing.split.open.bid-4', JSON.stringify(['tub']))
    const view = await mount()
    await waitFor(() => expect([...h.wbSplitOpen]).toEqual(['wc']))
    view.rerender(<Probe bid={{ id: 'bid-4', sov_material_factor: null }} />)
    await waitFor(() => expect([...h.wbSplitOpen]).toEqual(['tub']))
  })

  it('a remembered value that does not parse is none open', async () => {
    window.localStorage.setItem('pt.pricing.split.open.bid-1', '{not json')
    await mount()
    expect([...h.wbSplitOpen]).toEqual([])
  })
})
