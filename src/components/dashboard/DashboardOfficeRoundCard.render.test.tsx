// @vitest-environment jsdom
/**
 * The office's round as a week (punch list #424) over a week the kernel built: six cells, a missed workday drawn as
 * a hole that says so once, today outlined, what the last round left, and one press. A started round's press opens
 * Quickfill and its leftovers are doors; a missed one's press starts the round.
 */
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { officeRoundWeek, type RoundCloseEvent } from '../../lib/quickfill/roundClose'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { OfficeRoundWeekView } from './DashboardOfficeRoundCard'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

// Central daylight time written as UTC (+5). Today is Friday 2026-10-23.
const TODAY = '2026-10-23'
function ev(ymd: string, hhmm: string, section_id: string, outstanding_count: number | null, outcome: string | null = null, who = 'Dana Whitfield'): RoundCloseEvent {
  const [h, m] = hhmm.split(':').map(Number)
  return { section_id, marked_at: `${ymd}T${String(h! + 5).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`, outstanding_count, outcome, marked_by_name: who }
}
const label = (id: string) => ({ warnings: 'Warnings', 'billed-awaiting': 'Billed Awaiting Payment', prospects: 'Prospects' })[id] ?? id

afterEach(cleanup)

describe("DashboardOfficeRoundCard · the office's round as a week", () => {
  it('draws five workdays and today, a missed day as a hole, and starts the round from the one press', () => {
    const week = officeRoundWeek([ev('2026-10-20', '09:17', 'warnings', 0, 'done'), ev('2026-10-20', '09:27', 'billed-awaiting', 50, 'worked'), ev('2026-10-21', '09:40', 'prospects', 3, 'question')], TODAY, label)
    const onStart = vi.fn()
    const onQuickfill = vi.fn()
    renderWithProviders(<OfficeRoundWeekView week={week} onStart={onStart} onQuickfill={onQuickfill} onStation={vi.fn()} />)
    const card = screen.getByTestId('dashboard-office-round')
    expect(card.getAttribute('data-round-tone')).toBe('amber')
    const cells = within(card).getAllByRole('listitem')
    expect(cells.map((c) => c.getAttribute('data-round-day'))).toEqual(['missed', 'missed', 'ran', 'ran', 'missed', 'today'])
    expect(cells[2]!.getAttribute('aria-label')).toBe('Tue, Oct 20: 2 stations looked at, mostly by Dana Whitfield.')
    // The cell shows the first name alone, and the count as a value the app worked out.
    expect(cells[2]!.textContent).toContain('Dana')
    expect(cells[2]!.textContent).not.toContain('Whitfield')
    expect(cells[2]!.querySelector('[data-value="worked-out"]')?.textContent).toBe('2')
    expect(cells[4]!.textContent).toContain('missed')
    // The miss is said by its cell and nowhere else, and the card says what a round is in one line.
    expect(card.textContent!.match(/missed/g)).toHaveLength(3)
    expect(card.textContent).toContain('each workday on Quickfill')
    // What the last round that ran left: counts, not doors, since those stations may have moved since.
    const left = card.querySelector('[data-round-left]')!
    expect(left.textContent).toBe('Wed left1 question')
    expect(left.querySelector('button')).toBeNull()
    const press = card.querySelector('[data-round-press]') as HTMLButtonElement
    expect(press.getAttribute('data-round-press')).toBe('start')
    expect(press.textContent).toBe('Start the round')
    // A small press drawn inside a thumb's height.
    expect(press.style.minHeight).toBe('44px')
    fireEvent.click(press)
    expect(onStart).toHaveBeenCalledTimes(1)
    expect(onQuickfill).not.toHaveBeenCalled()
  })

  it('once today has a mark, the leftovers are doors and the press only opens Quickfill', () => {
    const week = officeRoundWeek(
      [ev('2026-10-22', '09:17', 'warnings', 0, 'done'), ev(TODAY, '09:40', 'billed-awaiting', 12, 'worked'), ev(TODAY, '09:44', 'prospects', 3, 'question'), ev(TODAY, '09:51', 'warnings', 0, 'done')],
      TODAY,
      label,
    )
    const onStation = vi.fn()
    const onQuickfill = vi.fn()
    renderWithProviders(<OfficeRoundWeekView week={week} onStart={vi.fn()} onQuickfill={onQuickfill} onStation={onStation} />)
    const card = screen.getByTestId('dashboard-office-round')
    expect(card.getAttribute('data-round-tone')).toBe('green')
    const today = within(card).getAllByRole('listitem')[5]!
    expect(today.getAttribute('aria-label')).toBe('Today: 3 stations looked at, mostly by Dana Whitfield.')
    const doors = [...card.querySelectorAll('[data-round-door]')] as HTMLButtonElement[]
    expect(doors.map((d) => `${d.getAttribute('data-round-door')}:${d.textContent}`)).toEqual(['question:Prospects?', 'open:Billed Awaiting Payment12'])
    fireEvent.click(doors[1]!)
    expect(onStation).toHaveBeenCalledWith('billed-awaiting')
    const press = card.querySelector('[data-round-press]') as HTMLButtonElement
    expect(press.textContent).toBe('Open Quickfill')
    fireEvent.click(press)
    expect(onQuickfill).toHaveBeenCalledTimes(1)
  })

  it('three missed workdays in a row turn the card red, and a weekend that owes no round is quiet', () => {
    const red = renderWithProviders(<OfficeRoundWeekView week={officeRoundWeek([ev('2026-10-19', '09:17', 'warnings', 0, 'done')], TODAY, label)} onStart={vi.fn()} onQuickfill={vi.fn()} onStation={vi.fn()} />)
    expect(screen.getByTestId('dashboard-office-round').getAttribute('data-round-tone')).toBe('red')
    expect(screen.getByTestId('dashboard-office-round').querySelector('[data-round-left]')!.textContent).toBe('Mon leftclean')
    red.unmount()
    renderWithProviders(<OfficeRoundWeekView week={officeRoundWeek([ev('2026-10-23', '11:52', 'warnings', 0, 'done')], '2026-10-25', label)} onStart={vi.fn()} onQuickfill={vi.fn()} onStation={vi.fn()} />)
    const card = screen.getByTestId('dashboard-office-round')
    expect(card.getAttribute('data-round-tone')).toBe('quiet')
    const sunday = within(card).getAllByRole('listitem')[5]!
    expect(sunday.getAttribute('data-round-day')).toBe('off')
    expect(sunday.textContent).toContain('none due')
    expect(card.querySelector('[data-round-press]')!.textContent).toBe('Open Quickfill')
  })
})
