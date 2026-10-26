// @vitest-environment jsdom
/**
 * Render smoke for DevDoorsCard (v2.5882): the title, one link per door with the door's own href, and the who chip
 * beside it. Nothing loads — the list is the kernel — so no supabase stub is needed.
 */
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import DevDoorsCard from './DevDoorsCard'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { DEV_DOORS, DEV_DOOR_WHO_LABEL } from '../../lib/settings/devDoors'

describe('DevDoorsCard', () => {
  it('draws every door as a link with who may open it beside it', () => {
    renderWithProviders(<DevDoorsCard />)
    expect(screen.getByText('Only devs and the controller see these')).toBeTruthy()
    const links = screen.getAllByRole('link')
    expect(links.length).toBe(DEV_DOORS.length)
    for (const d of DEV_DOORS) {
      const row = document.querySelector(`[data-dev-door="${d.id}"]`)
      expect(row, d.id).toBeTruthy()
      const a = row!.querySelector('a')!
      expect(a.getAttribute('href'), d.id).toBe(d.to)
      expect(a.textContent, d.id).toBe(d.label)
      expect(row!.textContent, d.id).toContain(DEV_DOOR_WHO_LABEL[d.who])
      expect(row!.textContent, d.id).toContain(d.what)
    }
  })
})
