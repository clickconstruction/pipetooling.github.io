// @vitest-environment jsdom
/**
 * Render smoke for the Settings rail (v2.4041): the doors row the page passes in sits between
 * the search box and the Recent chips, on the wide rail and on the phone's select, and the
 * zone tabs still render under it.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const matchMedia = vi.fn<(q: string) => boolean>(() => true)
vi.mock('../../hooks/useMatchMedia', () => ({ useMatchMedia: (q: string) => matchMedia(q) }))

import { SettingsRail } from './SettingsRail'
import { getZonedSettingsGroups } from '../../lib/settingsGroups'

function railProps() {
  const groups = getZonedSettingsGroups('dev')
  return {
    groups,
    activeId: groups[0]!.id,
    onSelect: vi.fn(),
    search: <input aria-label="Search settings" />,
    doors: (
      <div aria-label="Doors">
        <button type="button">View as…</button>
        <a href="/punch-list">Punch list</a>
      </div>
    ),
    recent: [groups[1]!],
    hiddenNote: null,
    footer: <button type="button">Sign out</button>,
  }
}

describe('SettingsRail', () => {
  it('wide: search, then the doors, then Recent, then the zone tabs', () => {
    matchMedia.mockReturnValue(true)
    const { container } = render(<SettingsRail {...railProps()} />)
    const order = Array.from(container.querySelectorAll('[aria-label="Search settings"], [aria-label="Doors"], [aria-label="Recent"], [role="tablist"]')).map((el) => el.getAttribute('aria-label') ?? el.getAttribute('role'))
    expect(order.slice(0, 4)).toEqual(['Search settings', 'Doors', 'Recent', 'You'])
    expect(screen.getByRole('button', { name: 'View as…' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Punch list' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Your account' })).toBeTruthy()
  })
  it('narrow: the same doors sit above the section select', () => {
    matchMedia.mockReturnValue(false)
    const { container } = render(<SettingsRail {...railProps()} />)
    const order = Array.from(container.querySelectorAll('[aria-label="Doors"], [aria-label="Settings section"]')).map((el) => el.getAttribute('aria-label'))
    expect(order).toEqual(['Doors', 'Settings section'])
    expect(screen.getByRole('link', { name: 'Punch list' })).toBeTruthy()
  })
})
