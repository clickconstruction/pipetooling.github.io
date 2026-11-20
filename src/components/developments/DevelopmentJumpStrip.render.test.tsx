// @vitest-environment jsdom
/**
 * The Development page's strip of looks (punch list #208; the phone's row since v2.6377). On a phone it is one
 * row with a cell for each look, the look's name over one figure; on a desk, the numbered chips under a cap.
 * Both name the strip from its own list of looks, and the phone row's CSS names no column count, so a look
 * added to the strip stays in the row (Photos, v2.6371, dropped to a second row of a five-column grid).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import { DevelopmentJumpStrip, type DevelopmentJumpKey, type DevelopmentLook } from './DevelopmentJumpStrip'

const screenState = vi.hoisted(() => ({ phone: true }))
vi.mock('../../hooks/useMatchMedia', () => ({ useMatchMedia: () => screenState.phone }))

beforeAll(installDomShims)
afterEach(() => {
  cleanup()
  screenState.phone = true
})

const looks: Record<DevelopmentJumpKey, DevelopmentLook> = {
  changed: { n: 0, count: '0 new', need: null },
  pieces: { n: 12, count: '12', need: '3 likely pairs' },
  money: { n: 1, count: '$186,116.84 left', need: null },
  plans: { n: 4, count: '34 sets on 4 parts', need: '18 jobs follow no plans yet' },
  questions: { n: 0, count: '0', need: null },
  photos: { n: 1, count: '1 photo', need: null },
}

/** The `.developmentPhoneStrip` rule of index.css. */
function phoneStripRule(): string {
  const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')
  return css.match(/^\.developmentPhoneStrip \{[^}]*\}/m)?.[0] ?? ''
}

describe('DevelopmentJumpStrip', () => {
  it('on a phone draws one cell for each look, the name over one figure, under the strip’s counted name', () => {
    renderWithProviders(<DevelopmentJumpStrip looks={looks} />)
    const nav = screen.getByTestId('development-phone-strip')
    expect(nav.getAttribute('aria-label')).toBe('Six looks at the site')
    const cells = screen.getAllByTestId('development-jump')
    expect(cells.map((c) => c.querySelector('.developmentPhoneLookName')?.textContent)).toEqual(['History', 'Jobs & bids', 'Money', 'Plans', 'Questions', 'Photos'])
    expect(cells.map((c) => c.querySelector('.developmentPhoneLookFigure')?.textContent)).toEqual(['0', '3', '$186k', '18', '0', '1'])
    expect(cells[1]!.getAttribute('data-need')).toBe('1')
  })

  it('the phone row names no column count, so every look stays in the one row', () => {
    const rule = phoneStripRule()
    expect(rule).toContain('display: flex')
    expect(rule).not.toMatch(/grid-template-columns|repeat\(/)
  })

  it('draws Trips as a seventh look only when it is given one, and names the strip by its count', () => {
    screenState.phone = false
    renderWithProviders(<DevelopmentJumpStrip looks={{ ...looks, trips: { n: 3, count: '3 trips', need: '1 out now' } }} />)
    expect(screen.getByTestId('review-cap').textContent).toBe('Seven looks')
    const cells = screen.getAllByTestId('development-jump')
    expect(cells).toHaveLength(7)
    expect(cells[6]!.textContent).toContain('Trips')
    expect(cells[6]!.textContent).toContain('3 trips · 1 out now')
    expect(cells[6]!.getAttribute('data-need')).toBe('1')
  })

  it('on a phone the seventh look is one more cell in the one row', () => {
    renderWithProviders(<DevelopmentJumpStrip looks={{ ...looks, trips: { n: 3, count: '3 trips', need: null } }} />)
    expect(screen.getByTestId('development-phone-strip').getAttribute('aria-label')).toBe('Seven looks at the site')
    expect(screen.getAllByTestId('development-jump').map((c) => c.querySelector('.developmentPhoneLookName')?.textContent)).toEqual(['History', 'Jobs & bids', 'Money', 'Plans', 'Questions', 'Photos', 'Trips'])
  })

  it('draws Schedule after the looks a site has, and the cap’s tell names every look from the list (punch list #382)', () => {
    screenState.phone = false
    renderWithProviders(<DevelopmentJumpStrip looks={{ ...looks, schedule: { n: 4, count: '4 stages', need: '3 answers owed' } }} />)
    const cap = screen.getByTestId('review-cap')
    expect(cap.textContent).toBe('Seven looks')
    expect(cap.getAttribute('title')).toBe('Seven looks at the site, top to bottom: the history, the jobs and bids, the money, the plans, the questions, the photos, the schedule. The filled number is where you are.')
    const cells = screen.getAllByTestId('development-jump')
    expect(cells[6]!.textContent).toContain('Schedule')
    expect(cells[6]!.textContent).toContain('4 stages · 3 answers owed')
    cleanup()
    renderWithProviders(<DevelopmentJumpStrip looks={{ ...looks, trips: { n: 3, count: '3 trips', need: null }, schedule: { n: 4, count: '4 stages', need: null } }} />)
    expect(screen.getByTestId('review-cap').textContent).toBe('Eight looks')
    expect(screen.getByTestId('review-cap').getAttribute('title')).toContain('the photos, the trips, the schedule.')
    expect(screen.getAllByTestId('development-jump').map((c) => c.querySelector('.stagesStageSegName')?.textContent)).toEqual(['History', 'Jobs & bids', 'Money', 'Plans', 'Questions', 'Photos', 'Trips', 'Schedule'])
  })

  it('the tell of six and of seven with Trips reads as it did', () => {
    screenState.phone = false
    renderWithProviders(<DevelopmentJumpStrip looks={looks} />)
    expect(screen.getByTestId('review-cap').getAttribute('title')).toBe('Six looks at the site, top to bottom: the history, the jobs and bids, the money, the plans, the questions, the photos. The filled number is where you are.')
    cleanup()
    renderWithProviders(<DevelopmentJumpStrip looks={{ ...looks, trips: { n: 1, count: '1 trip', need: null } }} />)
    expect(screen.getByTestId('review-cap').getAttribute('title')).toBe('Seven looks at the site, top to bottom: the history, the jobs and bids, the money, the plans, the questions, the photos, the trips. The filled number is where you are.')
  })

  it('on a desk the cap and the nav carry the same counted name', () => {
    screenState.phone = false
    renderWithProviders(<DevelopmentJumpStrip looks={looks} />)
    expect(screen.getByTestId('review-cap').textContent).toBe('Six looks')
    expect(screen.getByRole('navigation', { name: 'Six looks at the site' })).toBeTruthy()
    expect(screen.getAllByTestId('development-jump')).toHaveLength(6)
  })
})
