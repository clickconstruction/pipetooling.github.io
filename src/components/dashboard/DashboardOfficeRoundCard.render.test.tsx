// @vitest-environment jsdom
/**
 * Render smoke for the office's round and its prototype (punch list #217, office-5): invented
 * marks over the last ten workdays — a full day, a short day, a miss, today in progress. The
 * card reads as today until the person presses **Show the columns**; then it draws ten columns,
 * the miss as a ring, today's column marked, the counts as chips that address Quickfill, the
 * muted line under the strip. With `?sbs=1` a dev sees both shapes, captioned. The days are
 * built from the company's today, so the smoke holds on any weekday and on a weekend.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { installDomShims, renderWithProviders, settle, SMOKE_AUTH_USER_ID } from '../../test/renderSmokeMocks'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { formatMarkTime, isWorkdayYmd } from '../../lib/quickfill/markHistory'
import { roundColumnDays } from '../../lib/quickfill/roundColumns'
import { readShapeView, shapeViewStorageKey } from '../prototypes/SideBySide'
import { DashboardOfficeRoundCard, OFFICE_ROUND_SHAPE_KEY } from './DashboardOfficeRoundCard'

type Row = { section_id: string; marked_at: string; outstanding_count: number | null; outcome: string | null; users: { name: string } | null }

const TODAY = todayYmdInAppTz()
const DAYS = roundColumnDays(TODAY)
const STATIONS = ['messages', 'warnings', 'people-hours-new', 'billed-awaiting', 'prospects']

/** A mark at 10:00 AM central plus `minute` minutes, written as UTC; the same company day in either half of the year. */
function row(ymd: string, minute: number, section_id: string, outstanding_count: number | null = 0, outcome: string | null = 'done', name = 'Dana'): Row {
  return { section_id, marked_at: `${ymd}T15:${String(minute).padStart(2, '0')}:00.000Z`, outstanding_count, outcome, users: { name } }
}
function fullDay(ymd: string): Row[] {
  return STATIONS.map((s, i) => row(ymd, i, s))
}
/** The company-time words for a mark `minute` minutes after the hour, whichever half of the year it is. */
function at(ymd: string, minute: number): string {
  return formatMarkTime(row(ymd, minute, 'x').marked_at)
}

const ROWS: Row[] = [
  ...fullDay(DAYS[0]!),
  // A short second day: three of five.
  row(DAYS[1]!, 0, 'messages'),
  row(DAYS[1]!, 1, 'warnings', 2, 'worked'),
  row(DAYS[1]!, 2, 'people-hours-new', 25, 'worked'),
  ...fullDay(DAYS[2]!),
  ...fullDay(DAYS[3]!),
  ...fullDay(DAYS[4]!),
  ...fullDay(DAYS[5]!),
  ...fullDay(DAYS[6]!),
  // DAYS[7] is the miss.
  ...fullDay(DAYS[8]!),
  // The last column: today in progress on a workday (one still open, one question); a full Friday over a weekend.
  ...(isWorkdayYmd(TODAY) ? [row(TODAY, 0, 'messages', 4, 'worked'), row(TODAY, 1, 'prospects', 268, 'question')] : fullDay(DAYS[9]!)),
]

vi.mock('../../lib/supabase', () => {
  const builder: Record<string, unknown> = {}
  for (const m of ['select', 'gte', 'order', 'limit']) builder[m] = () => builder
  builder.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => Promise.resolve({ data: ROWS, error: null }).then(onFulfilled, onRejected)
  return { supabase: { from: () => builder } }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'dev' })
})

beforeAll(installDomShims)
afterEach(() => {
  cleanup()
  window.localStorage.removeItem(shapeViewStorageKey(OFFICE_ROUND_SHAPE_KEY, SMOKE_AUTH_USER_ID))
})

function expectColumns(card: HTMLElement) {
  const columns = card.querySelectorAll('[data-round-column]')
  expect(columns).toHaveLength(10)
  expect(Array.from(columns).map((c) => c.getAttribute('data-round-column'))).toEqual(DAYS)

  const misses = card.querySelectorAll('[data-miss="yes"]')
  expect(misses).toHaveLength(1)
  expect(misses[0]!.getAttribute('data-round-column')).toBe(DAYS[7])
  expect(misses[0]!.querySelector('[data-round-ring]')).toBeTruthy()
  expect(misses[0]!.getAttribute('title')).toContain('no round')

  // A full day stands at the top, the short day at three fifths.
  expect((columns[0]!.querySelector('[data-round-bar]') as HTMLElement).style.height).toBe('100%')
  expect((columns[1]!.querySelector('[data-round-bar]') as HTMLElement).style.height).toBe('60%')
  expect(columns[1]!.getAttribute('title')).toBe(`${new Date(DAYS[1] + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${at(DAYS[1]!, 2)} · Dana · 3 of 5`)

  const strip = card.querySelector('[data-testid="dashboard-office-round-strip"]')
  expect(strip?.getAttribute('title')).toContain('Missed')
  expect(card.querySelector('[data-round-label="first"]')).toBeTruthy()
  expect(card.querySelector('[data-round-label="miss"]')?.textContent).toContain('no round')

  if (isWorkdayYmd(TODAY)) {
    const today = card.querySelector('[data-today="yes"]')
    expect(today?.getAttribute('data-round-column')).toBe(TODAY)
    expect(today?.getAttribute('title')).toBe(`Today · ${at(TODAY, 1)} · Dana · 2 of 5 so far`)
    expect((today!.querySelector('[data-round-bar]') as HTMLElement).style.height).toBe('40%')
    const open = card.querySelector('[data-round-chip="open"]')
    expect(open?.textContent).toBe('still open 1 ›')
    expect(open?.getAttribute('title')).toBe('Opens Quickfill at Messages. Still open: Messages.')
    expect(card.querySelector('[data-round-chip="questions"]')?.textContent).toBe('question 1 ›')
    expect(card.textContent).toContain(`Today ${at(TODAY, 1)} · Dana · 2 of 5 stations`)
  } else {
    expect(card.querySelector('[data-today="yes"]')).toBeNull()
    expect(card.querySelector('[data-round-chip]')).toBeNull()
    expect(card.textContent).toContain('Last round')
  }
}

describe('DashboardOfficeRoundCard · today’s look, then the columns behind the switch (punch list #217, office-5)', () => {
  it('reads as today until the person presses Show the columns, and remembers the press', async () => {
    renderWithProviders(<DashboardOfficeRoundCard enabled />)
    await settle()
    const card = await screen.findByTestId('dashboard-office-round')
    expect(card.getAttribute('aria-label')).toBe("The office's round")
    expect(card.getAttribute('data-shape')).toBe('today')
    expect(card.querySelector('[data-round-column]')).toBeNull()
    if (isWorkdayYmd(TODAY)) {
      // Today's shape: the question and the open station as doors.
      expect(screen.getByRole('button', { name: 'Answer' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Open' })).toBeTruthy()
      expect(card.textContent).toContain('1 still open · 1 question')
    } else {
      expect(card.textContent).toContain('No round is due on the weekend.')
    }
    expect(readShapeView(OFFICE_ROUND_SHAPE_KEY, SMOKE_AUTH_USER_ID)).toBe(false)

    const press = screen.getByRole('button', { name: 'Show the columns' })
    expect(press.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(press)
    await settle()
    const columns = screen.getByTestId('dashboard-office-round')
    expect(columns.getAttribute('data-shape')).toBe('columns')
    expectColumns(columns)
    expect(screen.getByRole('button', { name: 'Open Quickfill ›' })).toBeTruthy()
    expect(readShapeView(OFFICE_ROUND_SHAPE_KEY, SMOKE_AUTH_USER_ID)).toBe(true)

    // Back to today's look.
    fireEvent.click(screen.getByRole('button', { name: "Show today's look" }))
    await settle()
    expect(screen.getByTestId('dashboard-office-round').getAttribute('data-shape')).toBe('today')
    expect(readShapeView(OFFICE_ROUND_SHAPE_KEY, SMOKE_AUTH_USER_ID)).toBe(false)
  })

  it('opens on the columns when the person turned them on before', async () => {
    window.localStorage.setItem(shapeViewStorageKey(OFFICE_ROUND_SHAPE_KEY, SMOKE_AUTH_USER_ID), '1')
    renderWithProviders(<DashboardOfficeRoundCard enabled />)
    await settle()
    const card = await screen.findByTestId('dashboard-office-round')
    expect(card.getAttribute('data-shape')).toBe('columns')
    expectColumns(card)
  })

  it('with ?sbs=1 a dev sees today’s look and the columns one above the other, captioned, with no switch', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard?sbs=1']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DashboardOfficeRoundCard enabled />
      </MemoryRouter>,
    )
    await settle()
    const sbs = await screen.findByTestId('dashboard-office-round-sbs')
    const cards = sbs.querySelectorAll('[data-testid="dashboard-office-round"]')
    expect(cards).toHaveLength(2)
    expect(cards[0]!.getAttribute('data-shape')).toBe('today')
    expect(cards[1]!.getAttribute('data-shape')).toBe('columns')
    expect(sbs.querySelector('[data-side-by-side-today] p')?.textContent).toBe('Today')
    expect(sbs.querySelector('[data-side-by-side-shape] p')?.textContent).toBe('With the columns')
    expectColumns(cards[1] as HTMLElement)
    expect(sbs.querySelector('[data-shape-switch]')).toBeNull()
  })

  it('draws nothing while off', async () => {
    renderWithProviders(<DashboardOfficeRoundCard enabled={false} />)
    await settle()
    expect(screen.queryByTestId('dashboard-office-round')).toBeNull()
  })
})
