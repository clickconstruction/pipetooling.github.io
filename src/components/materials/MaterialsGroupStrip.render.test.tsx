// @vitest-environment jsdom
/**
 * Render smoke for the Materials strip's three groups (punch list #304): a caption over each group, the tabs under
 * it, a badge only where one is handed in, Scan a label and Print labels as presses at the right end of On site's row. And the folds
 * (v2.6871): a strip too wide for its row folds the groups that do not fit to their name, a folded name opens its
 * group without changing the page, and on a phone the names take a row with the open group's tabs under them. Since
 * v2.8282 a one-tab group (Track) is opened by its name, and its presses are two icons on that row. A test's
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

function setup(role: string, activeTab: MaterialsTab, measured?: StripMeasured, phone = false) {
  const onTab = vi.fn()
  const onPress = vi.fn()
  const onPrint = vi.fn()
  renderWithProviders(
    <MaterialsGroupStrip
      groups={materialsGroupsFor(role)}
      activeTab={activeTab}
      onTab={onTab}
      presses={materialsPressesFor(role)}
      onPress={onPress}
      onPrint={onPrint}
      phone={phone}
      badges={{ track: [{ text: '3 due a count', tone: 'amber' }] }}
      measured={measured}
    />,
  )
  return { onTab, onPress, onPrint }
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
    expect(within(groups[2]!).getAllByRole('button').map((b) => b.textContent)).toEqual(['On site', 'Scan a label', 'Print labels', 'Print future stickers'])
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
    fireEvent.click(screen.getByRole('button', { name: 'Print future stickers' }))
    expect(onPress.mock.calls.map((c) => c[0])).toEqual(['print-labels', 'scan-label', 'print-stickers'])
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

  it('on a phone the names take a row, Track is On site with no tab row, and its presses are two icons (v2.8282)', () => {
    const { onTab, onPress, onPrint } = setup('dev', 'on-site', widths(343))
    expect(screen.getByTestId('materials-group-strip').getAttribute('data-strip-shape')).toBe('rows')
    // Track holds one tab: its name is the page, and there is no row of tabs under the names
    const track = screen.getByRole('button', { name: 'Track, 3 due a count' })
    expect(track.getAttribute('aria-current')).toBe('page')
    expect(track.getAttribute('aria-expanded')).toBeNull()
    expect(screen.queryByRole('group', { name: 'Track' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'On site' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Print labels' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Parts Book' })).toBeNull()

    // scan, then print, each an icon with its name, after the three names
    const row = screen.getByTestId('materials-group-name-track').parentElement!
    expect(within(row).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Plan. Show its tabs.', 'Purchase. Show its tabs.', 'Track, 3 due a count', 'Scan a label', 'Print'])
    const scan = screen.getByRole('button', { name: 'Scan a label' })
    expect(scan.getAttribute('title')).toBe('Scan a label')
    expect(scan.textContent).toBe('')
    expect(scan.style.width).toBe('40px')
    expect(scan.style.height).toBe('40px')
    fireEvent.click(scan)
    expect(onPress.mock.calls.map((c) => c[0])).toEqual(['scan-label'])
    fireEvent.click(screen.getByRole('button', { name: 'Print' }))
    expect(onPrint).toHaveBeenCalledTimes(1)
    expect(onPress).toHaveBeenCalledTimes(1)

    // Purchase holds several tabs: its name opens its row and changes no page, and the icons leave with Track
    const purchase = screen.getByRole('button', { name: 'Purchase. Show its tabs.' })
    expect(purchase.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(purchase)
    expect(onTab).not.toHaveBeenCalled()
    expect(within(screen.getByRole('group', { name: 'Purchase' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['Purchase Orders', 'PO Generator', 'Supply houses', 'Held for suppliers', 'What we buy'])
    expect(screen.queryByRole('button', { name: 'Print' })).toBeNull()
    // Track is where the page still is: one press on its name goes back to On site
    fireEvent.click(screen.getByRole('button', { name: 'Track, 3 due a count' }))
    expect(onTab).toHaveBeenCalledWith('on-site')
    expect(screen.queryByRole('group', { name: 'Purchase' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Print' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Purchase. Show its tabs.' }))
    fireEvent.click(screen.getByRole('button', { name: 'Supply houses' }))
    expect(onTab).toHaveBeenCalledWith('supply-houses')
  })

  it('from another tab one press on Track opens On site (v2.8282)', () => {
    const { onTab } = setup('dev', 'parts-book', widths(343))
    // Plan is open with its tabs, and no icon is drawn while Track is not the open group
    expect(within(screen.getByRole('group', { name: 'Plan' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['Parts Book', 'Assembly Book', 'PO Builder'])
    expect(screen.queryByRole('button', { name: 'Scan a label' })).toBeNull()
    const track = screen.getByRole('button', { name: 'Track, 3 due a count. Open On site.' })
    expect(track.getAttribute('aria-current')).toBeNull()
    fireEvent.click(track)
    expect(onTab).toHaveBeenCalledWith('on-site')
  })

  it('a phone draws the row of names even where one row would fit, and a role with no print press of its own still has Print', () => {
    // nothing measured reads as everything fits; the phone still gets its names and icons
    setup('estimator', 'on-site', undefined, true)
    expect(screen.getByTestId('materials-group-strip').getAttribute('data-strip-shape')).toBe('rows')
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Plan. Show its tabs.', 'Purchase. Show its tabs.', 'Track, 3 due a count', 'Scan a label', 'Print'])
  })

  it('a role with no press on On site’s row has no icon on the row of names', () => {
    renderWithProviders(<MaterialsGroupStrip groups={materialsGroupsFor('dev')} activeTab="on-site" onTab={() => {}} presses={[]} onPress={() => {}} phone />)
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Plan. Show its tabs.', 'Purchase. Show its tabs.', 'Track'])
  })
})
