// @vitest-environment jsdom
/**
 * Render smokes for the Takeoffs tab in a narrow window (v2.8476): One at a
 * time's fixtures list beside the fixture or above it, and the line table's box
 * drawn roomy, snug or scrolling. The Sheet's rail is `TakeoffRailFold.render.test.tsx`.
 * jsdom lays nothing out, so each test says how wide the measured box is.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
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
const fillButton = { label: 'Fill from book · 0 matches', disabled: true, title: '' }
const linesTable = () => <table data-testid="lines-table" />

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

  it('judges nothing while the box is not the width it measured, so a resize leaves no false record (v2.8494)', () => {
    measuredAt(884)
    const view = renderWithProviders(<TakeoffLinesBox><table /></TakeoffLinesBox>)
    const fit = () => screen.getByTestId('takeoff-lines-box').dataset.fit
    expect(fit()).toBe('roomy')
    // The window narrows and the page draws again before the box has measured itself: the layout is 386 px
    // wide and the table overflows it, while the box still believes it is 884.
    vi.restoreAllMocks()
    measuredAt(386)
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(726)
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(386)
    view.rerender(<TakeoffLinesBox><table /></TakeoffLinesBox>)
    expect(fit()).toBe('roomy')
    // The window comes back to the width it had, where the table fits.
    vi.restoreAllMocks()
    measuredAt(884)
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(884)
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(884)
    view.rerender(<TakeoffLinesBox><table /></TakeoffLinesBox>)
    expect(fit()).toBe('roomy')
  })

  it('steps tighter when the table overflows a box its width called roomy, and stops at scroll', () => {
    measuredAt(780)
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(812)
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(780)
    expect(box().dataset.fit).toBe('scroll')
  })
})
