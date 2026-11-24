// @vitest-environment jsdom
/**
 * Render smokes for the Sheet's rail and its fold (v2.8476, v2.8480), at a wide
 * and a narrow width. Wide: the rail beside the list with **Hide**, and that
 * choice kept on the browser. Narrow: it starts folded to the strip, **Show**
 * opens it over the list, and Hide, Esc or a press on the list puts it away
 * with nothing kept. jsdom lays nothing out, so each test says how wide the
 * measured sheet is.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, within } from '@testing-library/react'
import { TakeoffCostRailView } from './TakeoffCostRailView'
import { summarizeTakeoffCoverage } from '../../lib/bids/takeoffCoverage'
import { RAIL_FOLD_HINT_KEY, RAIL_FOLD_STORAGE_KEY } from '../../lib/bids/takeoffRailFold'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { BidCountRow } from '../../types/bids'
import type { TakeoffRoughPartLineRow } from '../../lib/bids/bidPricingEngineTypes'

function measuredAt(px: number) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ width: px, height: 0, top: 0, left: 0, right: px, bottom: 0, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect)
}

const WIDE = 1222 // a 1,400 px window
const NARROW = 722 // a 900 px window

beforeEach(() => {
  window.localStorage.removeItem(RAIL_FOLD_STORAGE_KEY)
  window.localStorage.removeItem(RAIL_FOLD_HINT_KEY)
})
afterEach(() => {
  vi.restoreAllMocks()
})

const row = (id: string, fixture: string, count: number) => ({ id, bid_id: 'bid-1', fixture, count, unit: null, tags: [], sequence_order: 0 }) as unknown as BidCountRow
const rows = [row('r1', 'Water closet', 12), row('r2', 'Lavatory', 8), row('r3', 'Mop sink', 2)]
const line = (id: string, countRowId: string, partId: string, unitPrice: number): TakeoffRoughPartLineRow => ({ id, countRowId, partId, quantity: 1, unitPrice, sourceMaterialPartPriceId: null, sourceTemplateId: null, sequenceOrder: 1, isSaved: true })
// r1 costs 12 × $14.25 = $171.00; r2 has one $0 line; r3 has no lines. Pricing shows two as "no cost".
const lines = [line('l1', 'r1', 'p1', 14.25), line('l2', 'r2', 'p2', 0)]
const coverage = summarizeTakeoffCoverage(rows, lines)
const names = new Map([['p1', 'ZZ closet flange'], ['p2', 'ZZ mixing valve']])

const onRequestQuotes = vi.fn()

function sheet() {
  return renderWithProviders(
    <TakeoffCostRailView
      countRows={rows}
      lines={lines}
      coverage={coverage}
      bookPlan={null}
      bookVersions={[]}
      selectedBookVersionId={null}
      onSelectBook={vi.fn()}
      materialTemplates={[]}
      partNameById={names}
      history={new Map()}
      renderLinesTable={() => (
        <table data-testid="lines-table">
          <tbody>
            <tr>
              <td>
                <button type="button">Remove part line</button>
              </td>
            </tr>
          </tbody>
        </table>
      )}
      fillButton={{ label: 'Fill from book · 0 matches', disabled: true, title: '' }}
      onFillAll={vi.fn()}
      onApplyBook={vi.fn(async () => {})}
      onCopyFromBid={vi.fn(async () => {})}
      onRequestQuotes={onRequestQuotes}
      onFocusView={vi.fn()}
      stagesPanel={
        <>
          <button type="button">Fill from rules &amp; book</button>
          <button type="button">Print schedule of values</button>
        </>
      }
    />,
  )
}

const view = () => screen.getByTestId('takeoff-cost-rail-view')
const strip = () => screen.getByTestId('takeoff-rail-strip')

describe('the Sheet in a wide window', () => {
  it('opens with the rail pinned beside the list, as it always was, with Hide in its heading', async () => {
    measuredAt(WIDE)
    sheet()
    await settle()
    expect(view().dataset.rail).toBe('beside')
    expect(screen.queryByTestId('takeoff-rail-strip')).toBeNull()
    const rail = screen.getByTestId('takeoff-rail')
    expect(rail.style.position).toBe('sticky')
    expect((rail.parentElement as HTMLElement).style.gridTemplateColumns).toBe('minmax(0, 1fr) 320px')
    const hide = within(rail).getByRole('button', { name: 'Hide What Pricing sees' })
    expect(hide.textContent).toBe('Hide')
    // The press has a name and a state: the rail is open.
    expect(hide.getAttribute('aria-expanded')).toBe('true')
  })

  it('never leaves the focus nowhere: Hide hands it to Show, and Show hands it back to Hide', async () => {
    measuredAt(WIDE)
    sheet()
    await settle()
    const hide = screen.getByRole('button', { name: 'Hide What Pricing sees' })
    hide.focus()
    fireEvent.click(hide)
    const show = screen.getByRole('button', { name: 'Show What Pricing sees' })
    expect(document.activeElement).toBe(show)
    expect(show.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(show)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Hide What Pricing sees' }))
    // A person who folded it is not told where it went.
    expect(screen.queryByTestId('takeoff-rail-strip-hint')).toBeNull()
  })

  it('folds to the strip on Hide and keeps that choice; Show opens it beside the list again and keeps that', async () => {
    measuredAt(WIDE)
    const first = sheet()
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Hide What Pricing sees' }))
    expect(view().dataset.rail).toBe('folded')
    expect(screen.queryByTestId('takeoff-rail')).toBeNull()
    expect(window.localStorage.getItem(RAIL_FOLD_STORAGE_KEY)).toBe('folded')
    expect(screen.queryByTestId('takeoff-rail-strip-hint')).toBeNull()

    // The next visit opens folded.
    first.unmount()
    sheet()
    await settle()
    expect(view().dataset.rail).toBe('folded')

    fireEvent.click(screen.getByRole('button', { name: 'Show What Pricing sees' }))
    expect(view().dataset.rail).toBe('beside')
    expect(screen.getByTestId('takeoff-rail').style.position).toBe('sticky')
    expect(window.localStorage.getItem(RAIL_FOLD_STORAGE_KEY)).toBe('open')
  })

  it('draws as it always did before anything is measured', async () => {
    sheet()
    await settle()
    expect(view().dataset.rail).toBe('beside')
  })
})

describe('the Sheet in a narrow window', () => {
  it('starts folded: the strip says the rail’s headline and the list has the whole width', async () => {
    measuredAt(NARROW)
    sheet()
    await settle()
    expect(view().dataset.rail).toBe('folded')
    expect(screen.queryByTestId('takeoff-rail')).toBeNull()
    const s = strip()
    expect(s.textContent).toContain('What Pricing sees')
    expect(s.textContent).toContain('Materials$171.00')
    expect(s.textContent).toContain('Costed2 of 3')
    const noCost = within(s).getByTestId('takeoff-rail-strip-no-cost')
    expect(noCost.textContent).toBe('2 no cost')
    expect(noCost.getAttribute('title')).toBe('2 fixtures carry no material cost. Pricing shows them as no cost.')
    // The amount draws its cents small, and the figures are values in place.
    expect(s.querySelectorAll('[data-value="worked-out"]')).toHaveLength(3)
    const press = within(s).getByRole('button', { name: 'Show What Pricing sees' })
    expect(press.textContent).toBe('Show')
    expect(press.getAttribute('aria-expanded')).toBe('false')
    expect((screen.getByTestId('takeoff-sheet-list').parentElement as HTMLElement).style.gridTemplateColumns).toBe('minmax(0, 1fr)')
    // The strip comes before the list.
    expect(s.compareDocumentPosition(screen.getByTestId('lines-table')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('says where the rail went until the person has opened it once, on this visit and the next', async () => {
    measuredAt(NARROW)
    const first = sheet()
    await settle()
    const hint = screen.getByTestId('takeoff-rail-strip-hint')
    expect(hint.textContent).toBe('Folded to fit this window. Show opens it.')
    expect(hint.getAttribute('role')).toBe('status')
    fireEvent.click(screen.getByRole('button', { name: 'Show What Pricing sees' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hide What Pricing sees' }))
    expect(screen.queryByTestId('takeoff-rail-strip-hint')).toBeNull()
    expect(window.localStorage.getItem(RAIL_FOLD_HINT_KEY)).toBe('seen')
    first.unmount()
    sheet()
    await settle()
    expect(view().dataset.rail).toBe('folded')
    expect(screen.queryByTestId('takeoff-rail-strip-hint')).toBeNull()
  })

  it('starts folded even for the person who chose open in a wide window', async () => {
    window.localStorage.setItem(RAIL_FOLD_STORAGE_KEY, 'open')
    measuredAt(NARROW)
    sheet()
    await settle()
    expect(view().dataset.rail).toBe('folded')
  })

  it('opens the whole rail over the list on Show, every panel and press in it, and keeps nothing', async () => {
    measuredAt(NARROW)
    sheet()
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Show What Pricing sees' }))
    expect(view().dataset.rail).toBe('over')
    const rail = screen.getByRole('region', { name: 'What Pricing sees' })
    expect(rail.className).toBe('takeoffRailOver')
    expect(strip().contains(rail)).toBe(true)
    for (const words of ['Materials on this bid', 'Costed fixtures', 'Per-fixture unit costs', 'Stages · materials by stage', 'Needs a price', 'Copy fixtures from a previous bid', 'Book ·']) {
      expect(rail.textContent).toContain(words)
    }
    expect(within(rail).getByRole('button', { name: 'Fill from rules & book' })).toBeTruthy()
    expect(within(rail).getByRole('button', { name: 'Print schedule of values' })).toBeTruthy()
    fireEvent.click(within(rail).getByRole('button', { name: 'Request quotes · 1 part' }))
    expect(onRequestQuotes).toHaveBeenCalledTimes(1)
    // The press turned into Hide where it stood; the rail's own heading carries none.
    const press = within(strip()).getByRole('button', { name: 'Hide What Pricing sees' })
    expect(press.getAttribute('aria-expanded')).toBe('true')
    expect(press.getAttribute('aria-controls')).toBe(rail.id)
    expect(within(rail).queryByRole('button', { name: 'Hide What Pricing sees' })).toBeNull()
    expect(window.localStorage.getItem(RAIL_FOLD_STORAGE_KEY)).toBeNull()
  })

  it('puts the open rail away on Hide, on Esc, and on any press on the list', async () => {
    measuredAt(NARROW)
    sheet()
    await settle()
    const show = () => fireEvent.click(screen.getByRole('button', { name: 'Show What Pricing sees' }))

    show()
    fireEvent.click(screen.getByRole('button', { name: 'Hide What Pricing sees' }))
    expect(view().dataset.rail).toBe('folded')

    show()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(view().dataset.rail).toBe('folded')

    show()
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Remove part line' }))
    expect(view().dataset.rail).toBe('folded')
    expect(window.localStorage.getItem(RAIL_FOLD_STORAGE_KEY)).toBeNull()
  })

  it('keeps the focus on the press through Show and Hide, and brings it back there when Esc closes the rail from inside', async () => {
    measuredAt(NARROW)
    sheet()
    await settle()
    const press = () => within(strip()).getByRole('button', { name: /What Pricing sees$/ })
    press().focus()
    fireEvent.click(press())
    expect(document.activeElement).toBe(press())
    // The rail is the next stop after the press.
    const inside = within(screen.getByRole('region', { name: 'What Pricing sees' })).getByRole('button', { name: 'Fill from rules & book' })
    expect(press().compareDocumentPosition(inside) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    inside.focus()
    fireEvent.keyDown(inside, { key: 'Escape' })
    expect(view().dataset.rail).toBe('folded')
    expect(document.activeElement).toBe(press())
    expect(press().textContent).toBe('Show')
  })

  it('puts the rail away when the Tab key walks out of it into the list, so a focused field is never under it', async () => {
    measuredAt(NARROW)
    sheet()
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Show What Pricing sees' }))
    const row = screen.getByRole('button', { name: 'Remove part line' })
    act(() => row.focus())
    expect(view().dataset.rail).toBe('folded')
    expect(document.activeElement).toBe(row)
  })

  it('leaves Esc to a window that is open on top of the rail', async () => {
    measuredAt(NARROW)
    sheet()
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Show What Pricing sees' }))
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    document.body.appendChild(dialog)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(view().dataset.rail).toBe('over')
    dialog.remove()
  })
})

describe('a browser that will not keep the choice', () => {
  it('still draws, still folds and still opens', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    measuredAt(WIDE)
    sheet()
    await settle()
    expect(view().dataset.rail).toBe('beside')
    fireEvent.click(screen.getByRole('button', { name: 'Hide What Pricing sees' }))
    expect(view().dataset.rail).toBe('folded')
    fireEvent.click(screen.getByRole('button', { name: 'Show What Pricing sees' }))
    expect(view().dataset.rail).toBe('beside')
  })
})
