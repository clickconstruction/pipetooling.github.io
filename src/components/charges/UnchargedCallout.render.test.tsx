// @vitest-environment jsdom
/**
 * Render smokes for the uncharged callout (v2.6484): a dev gets the doors to Who counts as what and to each desk; a
 * controller or a pay-approved master, who cannot open either, gets the names and the words to ask a dev, with no dead
 * link; and the count is the days a standing would fix, never every unpriced day.
 */
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { UnchargedCallout } from './UnchargedCallout'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const people = [
  { userId: 'u-t', name: 'Toby', days: 2 },
  { userId: 'u-j', name: 'Jordan', days: 1 },
]

describe('UnchargedCallout', () => {
  it('for a controller, names who counts as nobody with the words to ask a dev and no link to a screen they cannot open', () => {
    renderWithProviders(<UnchargedCallout people={people} unchargedDays={2} role="controller" />)
    const callout = screen.getByTestId('uncharged-callout')
    expect(callout.textContent).toContain('Toby and Jordan count as nobody on the rate card yet. 2 days price at nothing until someone out counts as a master, a tech or a helper.')
    expect(screen.getByTestId('uncharged-ask-dev').textContent).toBe('Ask a dev to set who counts as what in Settings, under Rates charged by crew. Toby · 2 days, Jordan · 1 day.')
    expect(screen.queryAllByRole('link')).toEqual([])
    expect(screen.queryByTestId('uncharged-who-counts')).toBeNull()
  })

  it('for a pay-approved master, the same words and no link', () => {
    renderWithProviders(<UnchargedCallout people={people} unchargedDays={1} role="master_technician" />)
    expect(screen.getByTestId('uncharged-callout').textContent).toContain('1 day prices at nothing')
    expect(screen.queryAllByRole('link')).toEqual([])
  })

  it('a person with no login (v2.6501) gets the door to their People record for a dev, and is marked for anyone else', () => {
    const mixed = [...people, { userId: 'person:p-h', name: 'Hal', days: 3 }]
    const first = renderWithProviders(<UnchargedCallout people={mixed} unchargedDays={3} role="dev" />)
    expect(screen.getByRole('link', { name: 'Hal’s People record (no login) · 3 days' }).getAttribute('href')).toBe('/people?tab=person&id=p%3Ap-h')
    expect(screen.getByRole('link', { name: 'Toby’s desk · 2 days' })).toBeTruthy()
    first.unmount()
    renderWithProviders(<UnchargedCallout people={mixed} unchargedDays={3} role="controller" />)
    expect(screen.getByTestId('uncharged-ask-dev').textContent).toContain('Hal · 3 days (no login)')
    expect(screen.queryAllByRole('link')).toEqual([])
  })

  it('for a dev, keeps the door to Who counts as what and to each desk', () => {
    renderWithProviders(<UnchargedCallout people={people} unchargedDays={2} role="dev" />)
    expect(screen.getByTestId('uncharged-who-counts').getAttribute('href')).toBe('/settings?tab=settings-jobs#who-counts-as-what')
    expect(screen.getByRole('link', { name: 'Toby’s desk · 2 days' }).getAttribute('href')).toBe('/people?tab=person&id=u%3Au-t')
    expect(screen.getByRole('link', { name: 'Jordan’s desk · 1 day' })).toBeTruthy()
    expect(screen.queryByTestId('uncharged-ask-dev')).toBeNull()
  })

  it('draws nothing when everyone out counts as something', () => {
    renderWithProviders(<UnchargedCallout people={[]} unchargedDays={0} role="dev" />)
    expect(screen.queryByTestId('uncharged-callout')).toBeNull()
  })
})
