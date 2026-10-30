// @vitest-environment jsdom
/**
 * The phone round list's two shapes (punch list #217, office-8): the head's counts as a
 * sentence and a grey line per row; **Show the strips** makes the counts chips that filter the
 * list and gives each row its two-week strip; `?sbs=1` draws both for a dev.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { installDomShims, renderWithProviders, SMOKE_AUTH_USER_ID } from '../../test/renderSmokeMocks'
import type { RoundRow } from '../../lib/quickfill/round'
import { QUICKFILL_RHYTHM_STRIP_KEY } from '../../lib/quickfill/stationRhythmStrip'
import { shapeViewStorageKey } from '../prototypes/SideBySide'
import { QuickfillRoundList } from './QuickfillRoundList'

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
  { sectionId: 'warnings', label: 'Warnings', personal: false, needsNote: false, state: 'never', rhythmDays: null, overDays: null, dueAtMs: null, count: null, countSource: 'none', lastMarkedAt: null, lastMarkedByName: null },
  { sectionId: 'supply-houses', label: 'Supply Houses', personal: false, needsNote: false, state: 'not_yet', rhythmDays: 7, overDays: null, dueAtMs: now.getTime() + 2 * 86_400_000, count: 1, countSource: 'last_look', lastMarkedAt: daysAgo(5), lastMarkedByName: null },
  { sectionId: 'email', label: 'Email', personal: false, needsNote: false, state: 'fresh', rhythmDays: 1, overDays: null, dueAtMs: null, count: 0, countSource: 'open', lastMarkedAt: daysAgo(0, 3), lastMarkedByName: 'Cora' },
  { sectionId: 'my-inbox', label: 'My Inbox', personal: true, needsNote: false, state: 'never', rhythmDays: null, overDays: null, dueAtMs: null, count: null, countSource: 'none', lastMarkedAt: null, lastMarkedByName: null },
]
const marks = new Map<string, string[]>([
  ['billed-awaiting-payment', [daysAgo(5), daysAgo(8), daysAgo(11)]],
  ['supply-houses', [daysAgo(5), daysAgo(12)]],
  ['email', [daysAgo(0, 3), daysAgo(1, 3), daysAgo(2, 3), daysAgo(3, 3)]],
])

function list(search = '', onSearch: (q: string) => void = () => {}) {
  return <QuickfillRoundList rows={rows} search={search} onSearch={onSearch} onOpen={() => {}} now={now} hourNow={15} marksOf={(id) => marks.get(id) ?? []} />
}

describe('QuickfillRoundList · the strips behind the switch', () => {
  it('opens on the sentence and the grey lines, and offers Show the strips', () => {
    renderWithProviders(list())
    expect(screen.getByText('2 due').parentElement?.textContent).toBe('2 due · 1 not yet · 1 fresh')
    expect(screen.getByText('every 3 d · 2 d over · Rosa')).toBeTruthy()
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByRole('button', { name: 'Show the strips' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Round · 2 ›' })).toBeTruthy()
  })

  it('the press makes the counts chips, each row a strip, and a chip filters the list', () => {
    renderWithProviders(list())
    fireEvent.click(screen.getByRole('button', { name: 'Show the strips' }))
    expect(screen.queryByText('2 due')).toBeNull()
    const due = screen.getByRole('button', { name: 'due · 2' })
    expect(screen.getByRole('button', { name: 'not yet · 1' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'fresh · 1' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^due today/ })).toBeNull()
    expect(screen.getAllByRole('img')).toHaveLength(5)
    expect(screen.getByText('2 d over')).toBeTruthy()
    expect(screen.getByText('never marked')).toBeTruthy()
    expect(screen.getByText(/^fresh · \d/)).toBeTruthy()
    expect(document.querySelector('[data-rhythm-axis]')?.textContent).toContain('today')

    fireEvent.click(due)
    expect(screen.getByRole('button', { name: 'due · 2 · showing only these' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getAllByRole('img')).toHaveLength(2)
    expect(screen.queryByText('Supply Houses')).toBeNull()
    expect(screen.queryByText('My Inbox')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'due · 2 · showing only these' }))
    expect(screen.getAllByRole('img')).toHaveLength(5)
    expect(window.localStorage.getItem(shapeViewStorageKey(QUICKFILL_RHYTHM_STRIP_KEY, SMOKE_AUTH_USER_ID))).toBe('1')
  })

  it('a chip that leaves nothing says so and offers Clear the filters', () => {
    window.localStorage.setItem(shapeViewStorageKey(QUICKFILL_RHYTHM_STRIP_KEY, SMOKE_AUTH_USER_ID), '1')
    renderWithProviders(<QuickfillRoundList rows={rows.filter((r) => r.state !== 'fresh')} search="" onSearch={() => {}} onOpen={() => {}} now={now} hourNow={15} />)
    expect(screen.queryByRole('button', { name: 'fresh · 1' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'not yet · 1' }))
    expect(screen.getAllByRole('img')).toHaveLength(1)
    // The strips draw bare with no marks given: a look-less strip, the line still placed.
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/^no look in two weeks · every 7 d · due /)
  })

  it('with ?sbs=1 a dev sees the sentence list above the chip list, captioned, with no switch', () => {
    render(
      <MemoryRouter initialEntries={['/quickfill?sbs=1']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        {list()}
      </MemoryRouter>,
    )
    const sbs = screen.getByTestId('quickfill-round-list-sbs')
    expect(sbs.querySelector('[data-side-by-side-today] p')?.textContent).toBe('Today')
    expect(sbs.querySelector('[data-side-by-side-shape] p')?.textContent).toBe('With the strip')
    expect(sbs.querySelector('[data-side-by-side-today]')?.textContent).toContain('2 due · 1 not yet · 1 fresh')
    expect(sbs.querySelectorAll('[data-side-by-side-shape] [role="img"]')).toHaveLength(5)
    expect(sbs.querySelectorAll('[data-side-by-side-today] [role="img"]')).toHaveLength(0)
    expect(document.querySelector('[data-shape-switch]')).toBeNull()
  })
})
