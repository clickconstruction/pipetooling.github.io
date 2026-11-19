// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { PermitFunnel } from '../../lib/research/permitBuilders'

const io = vi.hoisted(() => ({ loadPermitFunnel: vi.fn() }))
vi.mock('../../lib/research/permitResearchIo', () => io)

import { PermitCountStrip } from './PermitCountStrip'

/**
 * The count's six tiles on a phone (v2.7878): six across at 375 px left each tile 42 px for its word, where *investigating* needs 67,
 * so *investigating* drew as *investigati*. A phone now gets two rows of three. jsdom lays nothing
 * out, so this reads the grid the strip asks for; the widths were measured in a browser.
 */
const FUNNEL: PermitFunnel = { since: '2026-11-01', arrived: 212, skimmed: 198, kept: 31, passed: 160, pursuing: 7, has_plumber: 0, bid: 3, won: 1, by_person: [], pass_reasons: [], pursue_for: [] }
const WORDS = ['arrived', 'skimmed', 'investigating', 'pursuing', 'bid', 'won']

async function tiles(isMobile: boolean) {
  renderWithProviders(<PermitCountStrip city="New Braunfels" todayYmd="2026-11-18" refreshKey={0} isMobile={isMobile} />)
  await screen.findByText('investigating')
  return document.querySelector<HTMLElement>('[data-funnel-tiles]')!
}

beforeEach(() => {
  io.loadPermitFunnel.mockReset().mockResolvedValue(FUNNEL)
})
afterEach(cleanup)

describe('PermitCountStrip', () => {
  it('draws the six tiles three across on a phone, every word whole', async () => {
    const grid = await tiles(true)
    expect(grid.style.gridTemplateColumns).toBe('repeat(3, minmax(0, 1fr))')
    expect(Array.from(grid.children).map((t) => t.querySelector('span')?.textContent)).toEqual(WORDS)
    expect(screen.getByText('Permits, November so far')).toBeTruthy()
  })

  it('keeps the six in one row on a desk', async () => {
    const grid = await tiles(false)
    expect(grid.style.gridTemplateColumns).toBe('repeat(6, minmax(0, 1fr))')
    expect(grid.children).toHaveLength(6)
  })
})
