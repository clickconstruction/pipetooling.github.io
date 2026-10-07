// @vitest-environment jsdom
/**
 * Render smoke for the Man hours "who made it up" list: a person with a few
 * minutes still reads as someone, and the side layout puts the doors above
 * the rows so they stay in view while the rows scroll.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { buildManHoursPeriods, type ManHoursEntry } from '../../lib/manHours/manHoursByPeriod'
import { buildManHoursWho } from '../../lib/manHours/manHoursWho'
import { ManHoursWho } from './ManHoursWho'

const entries: ManHoursEntry[] = [
  { workDate: '2026-09-01', userId: 'u1', side: 'field', hours: 40, pending: true },
  { workDate: '2026-09-02', userId: 'u2', side: 'office', hours: 0.2, pending: false },
  { workDate: '2026-09-03', userId: 'u2', side: 'unassigned', hours: 3, pending: false },
]
const names = new Map([
  ['u1', 'Abraham'],
  ['u2', 'Robert'],
])
const period = buildManHoursPeriods({ entries, zoom: 'month', todayYmd: '2026-10-04' }).periods[0]!
const rows = buildManHoursWho(entries, period, names)

afterEach(cleanup)

describe('ManHoursWho', () => {
  it('prints time under half an hour as "<1", not as a blank', () => {
    renderWithProviders(<ManHoursWho period={period} zoom="month" rows={rows} />)
    const robert = screen.getByText('Robert').closest('tr') as HTMLElement
    // Person · Field · Office · Bids · Not on a job · Total
    expect(within(robert).getAllByRole('cell').map((c) => c.textContent)).toEqual(['Robert', '—', '<1', '—', '3', '3'])
  })

  it('drops a waiting note under the name on a phone-width card, and keeps it beside the name on a wide one', () => {
    const noteDisplay = (compact: boolean) => {
      const { unmount } = renderWithProviders(<ManHoursWho period={period} zoom="month" rows={rows} compact={compact} />)
      const display = screen.getByText('40 h waiting').style.display
      unmount()
      return display
    }
    expect(noteDisplay(false)).toBe('inline')
    expect(noteDisplay(true)).toBe('block')
  })

  it('keeps the doors under the rows in the full-width panel and above them in the side panel', () => {
    const order = (layout: 'side' | 'below') => {
      const { container, unmount } = renderWithProviders(<ManHoursWho period={period} zoom="month" rows={rows} layout={layout} />)
      const section = container.querySelector('section') as HTMLElement
      const door = within(section).getByRole('link', { name: 'Approve waiting hours · 40 h' })
      const table = within(section).getByRole('table')
      const doorFirst = Boolean(door.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING)
      const layoutAttr = section.getAttribute('data-layout')
      unmount()
      return { doorFirst, layoutAttr }
    }
    expect(order('below')).toEqual({ doorFirst: false, layoutAttr: 'below' })
    expect(order('side')).toEqual({ doorFirst: true, layoutAttr: 'side' })
  })
})
