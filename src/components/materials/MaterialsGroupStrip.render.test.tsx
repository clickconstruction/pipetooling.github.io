// @vitest-environment jsdom
/**
 * Render smoke for the Materials strip's three groups (punch list #304): a caption over each group, the tabs under
 * it, a badge only where one is handed in, Print labels and Scan a label as presses beside On site, and on a phone the
 * three words as chips with the open group's tabs under them.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { materialsGroupsFor, materialsPressesFor } from '../../lib/materials/materialsGroups'
import type { MaterialsTab } from '../../lib/materials/materialsTabs'
import MaterialsGroupStrip from './MaterialsGroupStrip'

function setup(role: string, activeTab: MaterialsTab, phone = false) {
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
      phone={phone}
    />,
  )
  return { onTab, onPress }
}

afterEach(cleanup)

describe('MaterialsGroupStrip', () => {
  it('draws the office three groups in order, each with its tabs, and the badge on the third', () => {
    setup('dev', 'parts-book')
    const groups = screen.getAllByRole('group')
    expect(groups.map((g) => g.getAttribute('aria-label'))).toEqual(['Plan', 'Purchase', 'Track'])
    expect(within(groups[0]!).getAllByRole('button').map((b) => b.textContent)).toEqual(['Parts Book', 'Assembly Book', 'PO Builder'])
    expect(within(groups[1]!).getAllByRole('button').map((b) => b.textContent)).toEqual(['Purchase Orders', 'PO Generator', 'Supply houses', 'Held for suppliers'])
    expect(within(groups[2]!).getAllByRole('button').map((b) => b.textContent)).toEqual(['On site', 'Print labels', 'Scan a label'])
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

  it('on a phone the words are chips, the open group shows its tabs, and a chip opens its first tab', () => {
    const { onTab } = setup('dev', 'on-site', true)
    expect(screen.getByRole('button', { name: 'Track, needs a hand' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(screen.getByRole('group', { name: 'Track' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['On site', 'Print labels', 'Scan a label'])
    expect(screen.queryByRole('button', { name: 'Parts Book' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Purchase' }))
    expect(onTab).toHaveBeenCalledWith('purchase-orders')
    fireEvent.click(screen.getByRole('button', { name: 'Track, needs a hand' }))
    expect(onTab).toHaveBeenCalledTimes(1)
  })
})
