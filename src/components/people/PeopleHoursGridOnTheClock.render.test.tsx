// @vitest-environment jsdom
/**
 * Render smoke for the Hours grid's on-the-clock box (punch list #446): a person still
 * clocked in draws a green press that opens My Time and writes nothing, never a field;
 * the row and day totals count the running time and read apart from a settled one; a
 * salaried day keeps its set hours; a session nobody clocked out of says so and adds no
 * time. Event wiring and which element a cell is, which the kernels cannot pin.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent } from '@testing-library/react'
import { createRef } from 'react'
import { PeopleHoursGrid, type PeopleHoursGridProps } from './PeopleHoursGrid'
import type { UserRow } from '../../hooks/usePeopleRoster'
import { hoursGridLiveCellKey, type HoursGridLiveByCell } from '../../lib/people/hoursGridLiveByCell'
import { pendingByCellKey, type PeopleHoursPendingByCellMap } from '../../lib/peopleHoursPendingByCell'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const AVERY = 'ZZ Test Avery'
const EMERY = 'ZZ Test Emery'
const YESTERDAY = '2026-07-26'
const TODAY = '2026-07-27'
// 20:00 UTC is 3:00 PM in the company's zone, well clear of midnight on either side.
const NOW = new Date('2026-07-27T20:00:00Z').getTime()

const user = (id: string, name: string): UserRow => ({ id, email: null, name, role: 'helpers', notes: null, phone: null, login_attached_at: '2026-07-01T12:00:00Z' })

function liveMap(...cells: Array<[string, string, number]>): HoursGridLiveByCell {
  return new Map(cells.map(([personName, workDate, hoursAgo]) => [hoursGridLiveCellKey(personName, workDate), { personName, workDate, clockInsMs: [NOW - hoursAgo * 3_600_000] }]))
}

function gridProps(overrides: Partial<PeopleHoursGridProps>): PeopleHoursGridProps {
  return {
    hoursTableScrollRef: createRef<HTMLDivElement>(),
    hoursGridFirstColW: 160,
    hoursDays: [YESTERDAY, TODAY],
    showPeopleForHours: [AVERY, EMERY],
    peopleHoursPendingByCellMap: new Map(),
    liveByCell: new Map(),
    jobHighlightPeople: new Set(),
    jobHighlightCells: new Set(),
    hoursFlashWorkDate: null,
    hoursFlashPersonName: null,
    hoursDaysCorrect: new Set(),
    users: [user('u-avery', AVERY), user('u-emery', EMERY)],
    canEditCrewJobs: true,
    canAccessHours: true,
    canAccessPay: true,
    hasUnassignedCorrectDays: () => false,
    canEditHours: () => true,
    isCorrectDayMissingJob: () => false,
    // Everyone has 8 h saved yesterday and nothing saved today.
    getHoursGridDisplayHours: (_person, workDate) => (workDate === YESTERDAY ? 8 : 0),
    moveHoursRow: () => {},
    setHoursUnassignedModal: () => {},
    setHoursDayAuditModal: () => {},
    openHoursMyTimeForGridCell: () => {},
    setPendingCellPopover: () => {},
    toggleHoursDayCorrect: () => {},
    saveHours: () => {},
    openManualHoursDraftFromBlur: () => {},
    ...overrides,
  }
}

const liveBox = (root: ParentNode, person: string, day: string) =>
  root.querySelector<HTMLButtonElement>(`button[data-hours-live-cell="${hoursGridLiveCellKey(person, day)}"]`)
const rowOf = (root: ParentNode, person: string) => {
  const row = root.querySelector<HTMLTableRowElement>(`tr[data-hours-person="${person}"]`)
  if (!row) throw new Error(`no row for ${person}`)
  return row
}

describe('PeopleHoursGrid on-the-clock box', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('a person still on the clock gets a green press in place of the field, and a press opens My Time and saves nothing', () => {
    const openHoursMyTimeForGridCell = vi.fn()
    const saveHours = vi.fn()
    const openManualHoursDraftFromBlur = vi.fn()
    // Clocked in 2 h 30 min ago.
    const { container } = renderWithProviders(
      <PeopleHoursGrid {...gridProps({ liveByCell: liveMap([AVERY, TODAY, 2.5]), openHoursMyTimeForGridCell, saveHours, openManualHoursDraftFromBlur })} />,
    )
    const box = liveBox(container, AVERY, TODAY)
    if (!box) throw new Error('the on-the-clock box was not drawn')
    expect(box.textContent).toBe('2:30on the clock')
    expect(box.getAttribute('aria-label')).toBe('ZZ Test Avery, Mon Jul 27: 2:30 so far, on the clock since 12:30 PM. Opens My Time.')
    expect(box.getAttribute('data-hours-live-tone')).toBe('running')
    // Avery's row: yesterday is still a field, today is not, and there is no My Time corner to press twice.
    expect(rowOf(container, AVERY).querySelectorAll('td input[type="text"]')).toHaveLength(1)
    expect(container.querySelector(`button[aria-label="Open My Time for ${AVERY} on ${TODAY}"]`)).toBeNull()
    // Emery clocked out: both days are fields, as before.
    expect(rowOf(container, EMERY).querySelectorAll('td input[type="text"]')).toHaveLength(2)

    fireEvent.click(box)
    expect(openHoursMyTimeForGridCell).toHaveBeenCalledWith(AVERY, TODAY)
    expect(saveHours).not.toHaveBeenCalled()
    expect(openManualHoursDraftFromBlur).not.toHaveBeenCalled()
  })

  it('the row, day and week totals count the running time and say which part is running', () => {
    const { container } = renderWithProviders(<PeopleHoursGrid {...gridProps({ liveByCell: liveMap([AVERY, TODAY, 2.5]) })} />)
    const averyTotal = rowOf(container, AVERY).querySelector<HTMLTableCellElement>('td[data-hours-row-total]')
    expect(averyTotal?.getAttribute('data-hours-row-total')).toBe('running')
    expect(averyTotal?.textContent).toBe('10:302:30 on the clock')
    expect(averyTotal?.getAttribute('title')).toBe('8:00:00 settled and 2:30 still running. The running part is not in payroll until it is clocked out and approved.')
    expect(rowOf(container, AVERY).lastElementChild?.textContent).toBe('10.50')
    // A row with nobody on the clock keeps its settled total, seconds and all.
    const emeryTotal = rowOf(container, EMERY).querySelector<HTMLTableCellElement>('td[data-hours-row-total]')
    expect(emeryTotal?.getAttribute('data-hours-row-total')).toBe('settled')
    expect(emeryTotal?.textContent).toBe('8:00:00')
    // The foot: yesterday settled, today running, and the week with the running time in it.
    const foot = [...container.querySelectorAll('tfoot tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent))
    expect(foot[0]?.slice(1, 4)).toEqual(['16:00:00', '2:30', '18:30'])
    expect(foot[1]?.slice(1, 3)).toEqual(['16.00', '2.50'])
    expect(foot[1]?.[4]).toBe('18.50')
    // The head keeps its count.
    expect(container.querySelector(`#people-hours-col-${TODAY}`)?.textContent).toContain('+1 on the clock')
  })

  it('a salaried person on the clock keeps the day’s set hours, grey, and adds nothing to a total', () => {
    const { container } = renderWithProviders(
      <PeopleHoursGrid
        {...gridProps({
          liveByCell: liveMap([AVERY, TODAY, 2.5]),
          canEditHours: (person) => person !== AVERY,
          getHoursGridDisplayHours: (person, workDate) => (person === AVERY || workDate === YESTERDAY ? 8 : 0),
        })}
      />,
    )
    const box = liveBox(container, AVERY, TODAY)
    expect(box?.textContent).toBe('8:00:00on the clock')
    expect(box?.getAttribute('aria-label')).toContain('A salaried day counts its set hours, 8:00:00.')
    const averyTotal = rowOf(container, AVERY).querySelector<HTMLTableCellElement>('td[data-hours-row-total]')
    expect(averyTotal?.getAttribute('data-hours-row-total')).toBe('settled')
    expect(averyTotal?.textContent).toBe('16:00:00')
  })

  it('a session nobody clocked out of says left open, adds no time, and still opens My Time', () => {
    const openHoursMyTimeForGridCell = vi.fn()
    const { container } = renderWithProviders(
      <PeopleHoursGrid {...gridProps({ liveByCell: liveMap([EMERY, YESTERDAY, 32]), getHoursGridDisplayHours: () => 0, openHoursMyTimeForGridCell })} />,
    )
    const box = liveBox(container, EMERY, YESTERDAY)
    if (!box) throw new Error('the left-open box was not drawn')
    expect(box.getAttribute('data-hours-live-tone')).toBe('leftOpen')
    expect(box.textContent).toBe('left opensince 7:00 AM')
    expect(rowOf(container, EMERY).querySelector('td[data-hours-row-total]')?.getAttribute('data-hours-row-total')).toBe('settled')
    const head = container.querySelector(`#people-hours-col-${YESTERDAY}`)
    expect(head?.textContent).toContain('1 left open')
    expect(head?.textContent).not.toContain('on the clock')
    fireEvent.click(box)
    expect(openHoursMyTimeForGridCell).toHaveBeenCalledWith(EMERY, YESTERDAY)
  })

  it('the amber pending badge of a closed morning stays beside the green box', () => {
    const pending: PeopleHoursPendingByCellMap = new Map([
      [pendingByCellKey(AVERY, TODAY), { personName: AVERY, workDate: TODAY, userId: 'u-avery', count: 1, pendingHours: 4, peopleHoursValue: 0, diffHours: 4, sessionIds: ['s1'], sessions: [] }],
    ])
    const { container } = renderWithProviders(
      <PeopleHoursGrid
        {...gridProps({
          liveByCell: liveMap([AVERY, TODAY, 1]),
          peopleHoursPendingByCellMap: pending,
          getHoursGridDisplayHours: (person, workDate) => (person === AVERY && workDate === TODAY ? 4 : 0),
        })}
      />,
    )
    // The morning's 4 h and the hour running.
    expect(liveBox(container, AVERY, TODAY)?.textContent).toBe('5:00on the clock')
    const cell = liveBox(container, AVERY, TODAY)?.closest('td')
    expect(cell?.querySelectorAll('button')).toHaveLength(2)
  })

  it('the box is in the tab order where the field was, and gets focus back when My Time closes', () => {
    const props = gridProps({ liveByCell: liveMap([AVERY, TODAY, 2.5]) })
    const { container, rerender } = renderWithProviders(<PeopleHoursGrid {...props} myTimeOpen={false} />)
    const box = liveBox(container, AVERY, TODAY)
    if (!box) throw new Error('the on-the-clock box was not drawn')
    expect(box.tabIndex).toBe(0)
    fireEvent.click(box)
    rerender(<PeopleHoursGrid {...props} myTimeOpen={true} />)
    box.blur()
    expect(document.activeElement).not.toBe(box)
    rerender(<PeopleHoursGrid {...props} myTimeOpen={false} />)
    expect(document.activeElement).toBe(box)
  })

  it('reads the clock again while the page stays open', () => {
    vi.useRealTimers()
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    const { container } = renderWithProviders(<PeopleHoursGrid {...gridProps({ liveByCell: liveMap([AVERY, TODAY, 2.5]) })} />)
    expect(liveBox(container, AVERY, TODAY)?.textContent).toBe('2:30on the clock')
    act(() => {
      vi.advanceTimersByTime(10 * 60_000)
    })
    expect(liveBox(container, AVERY, TODAY)?.textContent).toBe('2:40on the clock')
  })
})
