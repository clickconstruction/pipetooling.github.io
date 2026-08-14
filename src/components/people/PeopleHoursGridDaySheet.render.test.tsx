// @vitest-environment jsdom
/**
 * Render smoke for the v2.1655 mobile day sheet: with the narrow-viewport hook
 * forced on, a grid cell renders as one whole-cell button with the status word
 * (no inline input, no !N badge, no corner triangle); tapping it opens the
 * bottom sheet with the hours editor, pending-approve row, and My Time row.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { createRef } from 'react'

vi.mock('../../hooks/useNarrowViewport640', () => ({ useNarrowViewport640: () => true }))

import { PeopleHoursGrid } from './PeopleHoursGrid'
import type { UserRow } from '../../hooks/usePeopleRoster'
import { pendingByCellKey, type PeopleHoursPendingByCellMap } from '../../lib/peopleHoursPendingByCell'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const PERSON = 'Alex Doe'
const DAY = '2026-07-27'

describe('PeopleHoursGrid mobile day sheet', () => {
  it('cells are whole-cell buttons; tapping opens the sheet with hours, pending, and My Time', () => {
    const openHoursMyTimeForGridCell = vi.fn()
    const setPendingCellPopover = vi.fn()
    const saveHours = vi.fn()
    const pendingMap: PeopleHoursPendingByCellMap = new Map([
      [
        pendingByCellKey(PERSON, DAY),
        {
          personName: PERSON,
          workDate: DAY,
          userId: 'u-1',
          count: 2,
          pendingHours: 11.25,
          peopleHoursValue: 8,
          diffHours: 3.25,
          sessionIds: ['s1', 's2'],
          sessions: [],
        },
      ],
    ])
    const { container } = renderWithProviders(
      <PeopleHoursGrid
        hoursTableScrollRef={createRef<HTMLDivElement>()}
        hoursGridFirstColW={160}
        hoursDays={[DAY]}
        showPeopleForHours={[PERSON]}
        peopleHoursPendingByCellMap={pendingMap}
        jobHighlightPeople={new Set()}
        jobHighlightCells={new Set()}
        hoursFlashWorkDate={null}
        hoursFlashPersonName={null}
        hoursDaysCorrect={new Set()}
        users={[{ id: 'u-1', email: null, name: PERSON, role: 'helpers', notes: null, phone: null } satisfies UserRow]}
        canEditCrewJobs={true}
        canAccessHours={true}
        canAccessPay={true}
        hasUnassignedCorrectDays={() => false}
        canEditHours={() => true}
        isCorrectDayMissingJob={() => false}
        getHoursGridDisplayHours={() => 8}
        moveHoursRow={() => {}}
        setHoursUnassignedModal={() => {}}
        setHoursDayAuditModal={() => {}}
        openHoursMyTimeForGridCell={openHoursMyTimeForGridCell}
        setPendingCellPopover={setPendingCellPopover}
        toggleHoursDayCorrect={() => {}}
        saveHours={saveHours}
        openManualHoursDraftFromBlur={() => {}}
      />,
    )

    // Narrow mode: no inline input in cells, no !N badge, one big cell button
    // wearing the status word.
    expect(container.querySelector('td input[type="text"]')).toBeNull()
    expect(screen.queryByText('!')).toBeNull()
    const cell = screen.getByRole('button', { name: `Open day actions for ${PERSON} on ${DAY}` })
    expect(cell.textContent).toContain('2 pending')

    fireEvent.click(cell)
    // Sheet: title, hours editor with Save, pending row, My Time row.
    expect(screen.getByRole('dialog', { name: `Day actions for ${PERSON} on ${DAY}` })).toBeTruthy()
    expect(screen.getByText(`${PERSON} · Mon Jul 27`)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
    fireEvent.click(screen.getByText(/2 pending sessions · \+3\.25 h/))
    expect(setPendingCellPopover).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('Open My Time'))
    expect(openHoursMyTimeForGridCell).toHaveBeenCalledWith(PERSON, DAY)
    // My Time closes the sheet.
    expect(screen.queryByRole('dialog', { name: `Day actions for ${PERSON} on ${DAY}` })).toBeNull()
  })
})
