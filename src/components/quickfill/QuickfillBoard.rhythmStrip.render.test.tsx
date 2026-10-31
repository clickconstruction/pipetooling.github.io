// @vitest-environment jsdom
/**
 * The Board's two shapes (punch list #217, office-8): the cards as they are, with the grey
 * rhythm line; **Show the strips** turns every group into a row with its two-week strip and its
 * state chip, remembered per person; `?sbs=1` draws both for a dev, captioned, with no switch.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { installDomShims, renderWithProviders, SMOKE_AUTH_USER_ID } from '../../test/renderSmokeMocks'
import type { RoundRow } from '../../lib/quickfill/round'
import { QUICKFILL_RHYTHM_STRIP_KEY } from '../../lib/quickfill/stationRhythmStrip'
import { shapeViewStorageKey } from '../prototypes/SideBySide'
import { QuickfillBoard } from './QuickfillBoard'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

beforeAll(installDomShims)
afterEach(() => {
  cleanup()
  window.localStorage.removeItem(shapeViewStorageKey(QUICKFILL_RHYTHM_STRIP_KEY, SMOKE_AUTH_USER_ID))
})

const now = new Date('2026-10-28T20:00:00Z')
const daysAgo = (d: number, h = 0) => new Date(now.getTime() - d * 86_400_000 - h * 3_600_000).toISOString()

const rows: RoundRow[] = [
  { sectionId: 'billed-awaiting-payment', label: 'Billed Awaiting Payment', personal: false, needsNote: false, state: 'due', rhythmDays: 3, overDays: 2, dueAtMs: null, count: 4, countSource: 'open', lastMarkedAt: daysAgo(5), lastMarkedByName: 'Rosa' },
  { sectionId: 'supply-houses', label: 'Supply Houses', personal: false, needsNote: false, state: 'not_yet', rhythmDays: 7, overDays: null, dueAtMs: now.getTime() + 2 * 86_400_000, count: 1, countSource: 'last_look', lastMarkedAt: daysAgo(5), lastMarkedByName: null },
  { sectionId: 'my-inbox', label: 'My Inbox', personal: true, needsNote: false, state: 'never', rhythmDays: null, overDays: null, dueAtMs: null, count: null, countSource: 'none', lastMarkedAt: null, lastMarkedByName: null },
]
const marks = new Map<string, string[]>([
  ['billed-awaiting-payment', [daysAgo(5), daysAgo(8), daysAgo(11)]],
  ['supply-houses', [daysAgo(5), daysAgo(12)]],
])
const marksOf = (id: string) => marks.get(id) ?? []

function board() {
  return <QuickfillBoard rows={rows} currentId="supply-houses" questionOf={() => 'Who owes us?'} now={now} hourNow={15} onPick={() => {}} onClose={() => {}} marksOf={marksOf} />
}

describe('QuickfillBoard · the strips behind the switch', () => {
  it('opens on the cards with the grey rhythm line, and offers Show the strips', () => {
    renderWithProviders(board())
    expect(document.querySelector('[data-board-cards]')).toBeTruthy()
    expect(screen.getByText('every 3 d · 2 d over · Rosa')).toBeTruthy()
    expect(document.querySelector('[data-board-strips]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Show the strips' })).toBeTruthy()
  })

  it('the press draws every group as a row with its strip and chip, and is remembered', () => {
    renderWithProviders(board())
    fireEvent.click(screen.getByRole('button', { name: 'Show the strips' }))
    expect(document.querySelector('[data-board-strips]')).toBeTruthy()
    expect(document.querySelector('[data-board-cards]')).toBeNull()
    const strips = screen.getAllByRole('img')
    expect(strips).toHaveLength(3)
    expect(strips[0]!.getAttribute('aria-label')).toMatch(/^3 looks in two weeks · every 3 d · due .* · 2 d over · Rosa$/)
    expect(strips[2]!.getAttribute('aria-label')).toBe('no mark · opens the page')
    expect(screen.getByText('2 d over')).toBeTruthy()
    expect(screen.getByText('opens the page')).toBeTruthy()
    // The due station's run past its line is red; the door has no line.
    const first = strips[0]!
    expect(first.querySelectorAll('[data-rhythm-cell="look"]')).toHaveLength(3)
    expect(first.querySelectorAll('[data-rhythm-cell="late"]')).toHaveLength(2)
    expect(first.querySelector('[data-rhythm-due="1"]')).toBeTruthy()
    expect(strips[2]!.querySelector('[data-rhythm-due="1"]')).toBeNull()
    expect(document.querySelector('[data-rhythm-axis]')?.textContent).toContain('today')
    expect(screen.getByRole('button', { name: 'Supply Houses — 2 looks in two weeks · every 7 d · due ' + new Date(now.getTime() + 2 * 86_400_000).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) }).getAttribute('aria-current')).toBe('step')
    expect(window.localStorage.getItem(shapeViewStorageKey(QUICKFILL_RHYTHM_STRIP_KEY, SMOKE_AUTH_USER_ID))).toBe('1')
    fireEvent.click(screen.getByRole('button', { name: "Show today's look" }))
    expect(document.querySelector('[data-board-cards]')).toBeTruthy()
    cleanup()
    window.localStorage.setItem(shapeViewStorageKey(QUICKFILL_RHYTHM_STRIP_KEY, SMOKE_AUTH_USER_ID), '1')
    renderWithProviders(board())
    expect(document.querySelector('[data-board-strips]')).toBeTruthy()
  })

  it('with ?sbs=1 a dev sees the cards above the strips, captioned, with no switch', () => {
    render(
      <MemoryRouter initialEntries={['/quickfill?sbs=1']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        {board()}
      </MemoryRouter>,
    )
    const sbs = screen.getByTestId('quickfill-board-sbs')
    expect(sbs.querySelector('[data-side-by-side-today] p')?.textContent).toBe('Today')
    expect(sbs.querySelector('[data-side-by-side-shape] p')?.textContent).toBe('With the strip')
    expect(sbs.querySelector('[data-side-by-side-today] [data-board-cards]')).toBeTruthy()
    expect(sbs.querySelector('[data-side-by-side-shape] [data-board-strips]')).toBeTruthy()
    expect(document.querySelector('[data-shape-switch]')).toBeNull()
  })
})
