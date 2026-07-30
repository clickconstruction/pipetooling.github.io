// @vitest-environment jsdom
/**
 * Render-smoke tests for the Hours-grid cell editor's keyboard commit
 * (v2.1109): Enter commits through the same blur path as click-away (so the
 * My Time modal opens with the new hours), and Escape cancels the edit
 * without committing. Event-wiring class — kernels can't pin this.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent } from '@testing-library/react'
import { createRef } from 'react'
import { PeopleHoursGrid } from './PeopleHoursGrid'
import type { UserRow } from '../../hooks/usePeopleRoster'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const PERSON = 'Alex Doe'
const DAY = '2026-07-27'

function renderGrid(overrides?: {
  openManualHoursDraftFromBlur?: (personName: string, workDate: string, hoursDecimal: number) => void
  saveHours?: (personName: string, workDate: string, hours: number) => void
}) {
  const openManualHoursDraftFromBlur = overrides?.openManualHoursDraftFromBlur ?? vi.fn()
  const saveHours = overrides?.saveHours ?? vi.fn()
  const utils = renderWithProviders(
    <PeopleHoursGrid
      hoursTableScrollRef={createRef<HTMLDivElement>()}
      hoursGridFirstColW={160}
      hoursDays={[DAY]}
      showPeopleForHours={[PERSON]}
      peopleHoursPendingByCellMap={new Map()}
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
      getHoursGridDisplayHours={() => 0}
      moveHoursRow={() => {}}
      setHoursUnassignedModal={() => {}}
      setHoursDayAuditModal={() => {}}
      openHoursMyTimeForGridCell={() => {}}
      setPendingCellPopover={() => {}}
      toggleHoursDayCorrect={() => {}}
      saveHours={saveHours}
      openManualHoursDraftFromBlur={openManualHoursDraftFromBlur}
    />,
  )
  const input = utils.container.querySelector<HTMLInputElement>('td input[type="text"]')
  if (!input) throw new Error('hours cell input not rendered')
  return { input, openManualHoursDraftFromBlur, saveHours }
}

describe('PeopleHoursGrid cell keyboard commit', () => {
  it('Enter commits the typed hours through the manual-session offer path', () => {
    const { input, openManualHoursDraftFromBlur } = renderGrid()
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '8' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    // jsdom does not fire blur from HTMLElement.blur(); dispatch it as the browser would.
    fireEvent.blur(input)
    expect(openManualHoursDraftFromBlur).toHaveBeenCalledTimes(1)
    expect(openManualHoursDraftFromBlur).toHaveBeenCalledWith(PERSON, DAY, 8)
  })

  it('click-away (plain blur) still commits — the pre-existing path is unchanged', () => {
    const { input, openManualHoursDraftFromBlur } = renderGrid()
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '6' } })
    fireEvent.blur(input)
    expect(openManualHoursDraftFromBlur).toHaveBeenCalledWith(PERSON, DAY, 6)
  })

  it('Escape cancels the edit without committing', () => {
    const { input, openManualHoursDraftFromBlur, saveHours } = renderGrid()
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '9' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    fireEvent.blur(input)
    expect(openManualHoursDraftFromBlur).not.toHaveBeenCalled()
    expect(saveHours).not.toHaveBeenCalled()
  })

  it('Escape only suppresses one commit — the next blur commits normally', () => {
    const { input, openManualHoursDraftFromBlur } = renderGrid()
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '9' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    fireEvent.blur(input)
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '4' } })
    fireEvent.blur(input)
    expect(openManualHoursDraftFromBlur).toHaveBeenCalledTimes(1)
    expect(openManualHoursDraftFromBlur).toHaveBeenCalledWith(PERSON, DAY, 4)
  })
})
