// @vitest-environment jsdom
/**
 * Render smoke for the Materials strip's three groups (punch list #304): a caption over each group, the tabs under
 * it, a badge only where one is handed in, Scan a label and Print labels as presses at the right end of On site's row. And the folds
 * (v2.6871): a strip too wide for its row folds the groups that do not fit to their name, a folded name opens its
 * group without changing the page, and on a phone the names take a row with the open group's tabs under them. A test's
 * DOM has no layout, so the widths are handed in (`measured`); with none the strip draws every group open.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { materialsGroupsFor, materialsPressesFor } from '../../lib/materials/materialsGroups'
import type { MaterialsTab } from '../../lib/materials/materialsTabs'
import MaterialsGroupStrip, { type StripMeasured } from './MaterialsGroupStrip'

/** The office strip's widths, near what a browser measures. All open is 380 + 590 + 320 + 2 gaps of 21 = 1,332. */
const widths = (available: number): StripMeasured => ({ available, openWidths: { plan: 380, purchase: 590, track: 320 }, foldWidths: { plan: 90, purchase: 120, track: 170 } })

function setup(role: string, activeTab: MaterialsTab, measured?: StripMeasured) {
  const onTab = vi.fn()
  const onPress = vi.fn()
  renderWithProviders(
    <MaterialsGroupStrip
      groups={materialsGroupsFor(role)}
      activeTab={activeTab}
      onTab={onTab}
      presses={materialsPressesFor(role)}
      onPress={onPress}
      badges={{ track: [{ text: '3 due a count', tone: 'amber' }] }}
      measured={measured}
    />,
  )
  return { onTab, onPress }
}
const groupNames = () => screen.getAllByRole('group').map((g) => g.getAttribute('aria-label'))

afterEach(cleanup)

describe('MaterialsGroupStrip', () => {
  it('draws the office three groups in order, each with its tabs, and the badge on the third', () => {
    setup('dev', 'parts-book')
    const groups = screen.getAllByRole('group')
    expect(groups.map((g) => g.getAttribute('aria-label'))).toEqual(['Plan', 'Purchase', 'Track'])
    expect(within(groups[0]!).getAllByRole('button').map((b) => b.textContent)).toEqual(['Parts Book', 'Assembly Book', 'PO Builder'])
    expect(within(groups[1]!).getAllByRole('button').map((b) => b.textContent)).toEqual(['Purchase Orders', 'PO Generator', 'Supply houses', 'Held for suppliers', 'What we buy'])
    expect(within(groups[2]!).getAllByRole('button').map((b) => b.textContent)).toEqual(['On site', 'Scan a label', 'Print labels'])
    expect(groups[2]!.textContent).toContain('3 due a count')
    expect(groups[0]!.textContent).not.toContain('due a count')
    expect(screen.getByRole('button', { name: 'Parts Book' }).getAttribute('aria-current')).toBe('page')
  })

  it('a tab calls onTab and a press calls onPress, never the other', () => {
    const { onTab, onPress } = setup('dev', 'parts-book')
    fireEvent.click(screen.getByRole('button', { name: 'On site' }))
    expect(onTab).toHaveBeenCalledWith('on-site')
    fireEvent.click(screen.getByRole('button', { name: 'Print labels' }))
    fireEvent.click(screen.getByRole('button', { name: 'Scan a label' }))
    expect(onPress.mock.calls.map((c) => c[0])).toEqual(['print-labels', 'scan-label'])
    expect(onTab).toHaveBeenCalledTimes(1)
  })

  it('gives a primary Plan and the third group, with no Purchase', () => {
    setup('primary', 'parts-book')
    expect(screen.getAllByRole('group').map((g) => g.getAttribute('aria-label'))).toEqual(['Plan', 'Track'])
    expect(screen.queryByRole('button', { name: 'Purchase Orders' })).toBeNull()
  })

  it('with no room measured the strip draws whole, and nothing is folded', () => {
    setup('dev', 'on-site')
    expect(screen.getByTestId('materials-group-strip').getAttribute('data-strip-shape')).toBe('row')
    expect(groupNames()).toEqual(['Plan', 'Purchase', 'Track'])
    expect(screen.queryByTestId('materials-group-folded-plan')).toBeNull()
  })

  it('a row too short folds what does not fit to its name: the open tab stays, a fold keeps its badge', () => {
    // 1,180 wide on Purchase Orders: Purchase stays, Track fits beside it, Plan folds
    const { onTab } = setup('dev', 'purchase-orders', widths(1180))
    expect(groupNames()).toEqual(['Purchase', 'Track'])
    const plan = screen.getByTestId('materials-group-folded-plan')
    expect(plan.getAttribute('aria-expanded')).toBe('false')
    expect(plan.getAttribute('aria-label')).toBe('Plan. Show its tabs.')
    expect(screen.queryByRole('button', { name: 'Parts Book' })).toBeNull()

    // pressing the name opens Plan and changes no page. Purchase no longer fits beside it (380 + 590 + 170 + 42 is
    // 1,182), so it folds and names the tab the page is still on; Track does fit, badge and all
    fireEvent.click(plan)
    expect(onTab).not.toHaveBeenCalled()
    expect(groupNames()).toEqual(['Plan', 'Track'])
    expect(document.activeElement?.textContent).toBe('Parts Book')
    const purchase = screen.getByTestId('materials-group-folded-purchase')
    expect(purchase.getAttribute('aria-label')).toBe('Purchase, on Purchase Orders. Show its tabs.')
    expect(purchase.textContent).toContain('Purchase Orders')
    expect(screen.getByRole('group', { name: 'Track' }).textContent).toContain('3 due a count')

    // a tab inside the opened group is the page changing
    fireEvent.click(screen.getByRole('button', { name: 'Assembly Book' }))
    expect(onTab).toHaveBeenCalledWith('assembly-book')
  })

  it('a folded group that holds the open tab says which tab it is', () => {
    // 760 wide on On site, Plan pressed open: 380 + 120 + 170 + 42 fits, and Track folds with its tab and its badge
    setup('dev', 'on-site', widths(760))
    expect(groupNames()).toEqual(['Track'])
    fireEvent.click(screen.getByTestId('materials-group-folded-plan'))
    expect(groupNames()).toEqual(['Plan'])
    const track = screen.getByTestId('materials-group-folded-track')
    expect(track.getAttribute('aria-label')).toBe('Track, on On site, 3 due a count. Show its tabs.')
    expect(track.textContent).toContain('On site')
    expect(track.textContent).toContain('3 due a count')
  })

  it('a primary’s two groups fold the same way: the books stay, Track folds with its badge', () => {
    // Plan 230 + Track 320 + one gap is 571; at 500 the books stay open and Track is its name
    setup('primary', 'parts-book', { available: 500, openWidths: { plan: 230, track: 320 }, foldWidths: { plan: 70, track: 170 } })
    expect(groupNames()).toEqual(['Plan'])
    expect(screen.getByTestId('materials-group-folded-track').getAttribute('aria-label')).toBe('Track, 3 due a count. Show its tabs.')
    fireEvent.click(screen.getByTestId('materials-group-folded-track'))
    expect(groupNames()).toEqual(['Track'])
    expect(screen.getByTestId('materials-group-folded-plan').getAttribute('aria-label')).toBe('Plan, on Parts Book. Show its tabs.')
  })

  it('on a phone the names take a row, the open group shows its tabs, and a name opens its group without changing the page', () => {
    const { onTab } = setup('dev', 'on-site', widths(343))
    expect(screen.getByTestId('materials-group-strip').getAttribute('data-strip-shape')).toBe('rows')
    const track = screen.getByRole('button', { name: 'Track, 3 due a count' })
    expect(track.getAttribute('aria-expanded')).toBe('true')
    expect(within(screen.getByRole('group', { name: 'Track' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['On site', 'Scan a label', 'Print labels'])
    expect(screen.queryByRole('button', { name: 'Parts Book' })).toBeNull()

    const purchase = screen.getByRole('button', { name: 'Purchase. Show its tabs.' })
    expect(purchase.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(purchase)
    expect(onTab).not.toHaveBeenCalled()
    expect(within(screen.getByRole('group', { name: 'Purchase' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['Purchase Orders', 'PO Generator', 'Supply houses', 'Held for suppliers', 'What we buy'])
    // Track is where the page still is, and its name says so
    expect(screen.getByRole('button', { name: 'Track, on On site, 3 due a count. Show its tabs.' }).getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: 'Supply houses' }))
    expect(onTab).toHaveBeenCalledWith('supply-houses')
  })
})
