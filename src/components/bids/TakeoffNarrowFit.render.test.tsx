// @vitest-environment jsdom
/**
 * Render smokes for the Takeoffs tab in a narrow window (v2.8476): the Sheet's
 * rail beside the list or under it, One at a time's fixtures list beside the
 * fixture or above it, and the line table's box drawn roomy, snug or scrolling.
 * jsdom lays nothing out, so each test says how wide the measured box is.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { TakeoffCostRailView } from './TakeoffCostRailView'
import { TakeoffFocusView } from './TakeoffFocusView'
import { TakeoffLinesBox } from './TakeoffLinesBox'
import { summarizeTakeoffCoverage } from '../../lib/bids/takeoffCoverage'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { BidCountRow } from '../../types/bids'
import type { TakeoffRoughPartLineRow } from '../../lib/bids/bidPricingEngineTypes'

function measuredAt(px: number) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ width: px, height: 0, top: 0, left: 0, right: px, bottom: 0, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect)
}

afterEach(() => {
  vi.restoreAllMocks()
})

const row = (id: string, fixture: string, count: number) => ({ id, bid_id: 'bid-1', fixture, count, unit: null, tags: [], sequence_order: 0 }) as unknown as BidCountRow
const rows = [row('r1', 'Water closet', 12), row('r2', 'Lavatory', 8), row('r3', 'Mop sink', 2)]
const line = (id: string, countRowId: string, partId: string, unitPrice: number): TakeoffRoughPartLineRow => ({ id, countRowId, partId, quantity: 1, unitPrice, sourceMaterialPartPriceId: null, sourceTemplateId: null, sequenceOrder: 1, isSaved: true })
const lines = [line('l1', 'r1', 'p1', 14.25), line('l2', 'r2', 'p2', 0)]
const coverage = summarizeTakeoffCoverage(rows, lines)
const names = new Map([['p1', 'ZZ closet flange'], ['p2', 'ZZ mixing valve']])
const fillButton = { label: 'Fill from book · 0 matches', disabled: true, title: '' }
const linesTable = () => <table data-testid="lines-table" />

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
      renderLinesTable={linesTable}
      fillButton={fillButton}
      onFillAll={vi.fn()}
      onApplyBook={vi.fn(async () => {})}
      onCopyFromBid={vi.fn(async () => {})}
      onRequestQuotes={vi.fn()}
      onFocusView={vi.fn()}
      stagesPanel={<button type="button">Fill from rules &amp; book</button>}
    />,
  )
}

function focus() {
  return renderWithProviders(
    <TakeoffFocusView
      bidId="bid-1"
      countRows={rows}
      lines={lines}
      coverage={coverage}
      bookPlan={null}
      bookVersionName={null}
      materialTemplates={[]}
      renderLinesTable={linesTable}
      onApplyBook={vi.fn(async () => {})}
      onUseLines={vi.fn(async () => {})}
      onRemember={vi.fn(async () => false)}
      fillButton={fillButton}
      onFillAll={vi.fn()}
      onSheetView={vi.fn()}
      showToast={vi.fn()}
      history={new Map()}
    />,
  )
}

describe('the Sheet in a wide and a narrow window', () => {
  it('keeps the rail pinned beside the list where both fit (a 1,400 px window: the sheet is 1,222)', async () => {
    measuredAt(1222)
    sheet()
    await settle()
    expect(screen.getByTestId('takeoff-cost-rail-view').dataset.rail).toBe('beside')
    const rail = screen.getByTestId('takeoff-rail')
    expect(rail.style.position).toBe('sticky')
    expect((rail.parentElement as HTMLElement).style.gridTemplateColumns).toBe('minmax(0, 1fr) 320px')
  })

  it('puts the rail under the list where they do not (a 900 px window: 722), with every panel and press still there', async () => {
    measuredAt(722)
    sheet()
    await settle()
    expect(screen.getByTestId('takeoff-cost-rail-view').dataset.rail).toBe('under')
    const rail = screen.getByTestId('takeoff-rail')
    expect(rail.style.position).toBe('')
    // Under the list the panels sit in as many columns as fit, not one stretched across the sheet.
    expect(rail.style.gridTemplateColumns).toBe('repeat(auto-fit, minmax(280px, 1fr))')
    expect((rail.parentElement as HTMLElement).style.gridTemplateColumns).toBe('minmax(0, 1fr)')
    // The list comes first, so the rail is under it.
    expect(screen.getByTestId('lines-table').compareDocumentPosition(rail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(rail.textContent).toContain('What Pricing sees')
    expect(rail.textContent).toContain('Materials on this bid')
    expect(screen.getByRole('button', { name: 'Fill from rules & book' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Request quotes · 1 part' })).toBeTruthy()
    expect(rail.textContent).toContain('Copy fixtures from a previous bid')
  })

  it('draws as it always did before anything is measured', async () => {
    sheet()
    await settle()
    expect(screen.getByTestId('takeoff-cost-rail-view').dataset.rail).toBe('beside')
  })
})

describe('One at a time in a wide and a narrow window', () => {
  it('keeps the fixtures list pinned beside the fixture where both fit', async () => {
    measuredAt(1222)
    focus()
    await settle()
    expect(screen.getByTestId('takeoff-focus-view').dataset.list).toBe('beside')
    const list = screen.getByRole('listbox', { name: 'Fixtures' })
    expect(list.style.position).toBe('sticky')
    expect((list.parentElement as HTMLElement).style.gridTemplateColumns).toBe('minmax(220px, 300px) minmax(0, 1fr)')
  })

  it('puts the list above the fixture, a few rows tall, where they do not (a 960 px window: 782)', async () => {
    measuredAt(782)
    focus()
    await settle()
    expect(screen.getByTestId('takeoff-focus-view').dataset.list).toBe('above')
    const list = screen.getByRole('listbox', { name: 'Fixtures' })
    expect(list.style.position).toBe('relative')
    expect(list.style.maxHeight).toBe('13.5rem')
    expect((list.parentElement as HTMLElement).style.gridTemplateColumns).toBe('minmax(0, 1fr)')
    expect(screen.getAllByRole('option')).toHaveLength(3)
  })
})

describe('the line table’s box', () => {
  const box = () => {
    renderWithProviders(<TakeoffLinesBox><table /></TakeoffLinesBox>)
    return screen.getByTestId('takeoff-lines-box')
  }

  it('is roomy at 884 px, snug at 722 and scrolls at 290', () => {
    measuredAt(884)
    expect(box().dataset.fit).toBe('roomy')
    vi.restoreAllMocks()
    document.body.innerHTML = ''
    measuredAt(722)
    expect(box().dataset.fit).toBe('snug')
    vi.restoreAllMocks()
    document.body.innerHTML = ''
    measuredAt(290)
    expect(box().dataset.fit).toBe('scroll')
  })

  it('is roomy before anything is measured', () => {
    expect(box().dataset.fit).toBe('roomy')
  })

  it('steps tighter when the table overflows a box its width called roomy, and stops at scroll', () => {
    measuredAt(780)
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(812)
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(780)
    expect(box().dataset.fit).toBe('scroll')
  })
})
