// @vitest-environment jsdom
/**
 * The trade's portal names the period (Messages cut 9, wave 2): the pay application's door says when the next one is due
 * and the bill it goes on, from the cut-off the portal's read carries, and a new one opens with its period running to that
 * bill day. Hillside Excavation's door on Stone Oak, from the prototype's demo draws.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { billDayJob, billDayState } from '../../test/fixtures/billDayDemo'
import { installDomShims } from '../../test/renderSmokeMocks'
import { PortalBillDayContext } from './gcTradePortalBillDay'
import { GcBuildingPayAppDoor } from './GcTradePortalPayApp'

installDomShims()
afterEach(cleanup)

function door(today: string, cutoffDays: number | null) {
  const state = billDayState(today)
  const project = billDayJob(state, 'stoneoak')
  const pkg = project.packages.find((k) => k.id === 'so-site')
  const partner = state.partners.find((p) => p.id === 'bd-hillside')
  if (!pkg || !partner) throw new Error('no Hillside on Stone Oak')
  render(
    <PortalBillDayContext.Provider value={cutoffDays}>
      <GcBuildingPayAppDoor project={project} pkg={pkg} partner={partner} today={today} />
    </PortalBillDayContext.Provider>,
  )
}

describe('the pay application door names the period', () => {
  it('says when the next one is due, for this month’s bill', () => {
    door('2026-10-02', null)
    expect(document.querySelector('[data-portal-due]')?.textContent).toBe('Send pay application 3 by Mon Oct 19. It goes on our bill of Oct 25.')
  })

  it('reads the cut-off the portal carries, and rolls to next month after it', () => {
    door('2026-10-02', 8)
    expect(document.querySelector('[data-portal-due]')?.textContent).toBe('Send pay application 3 by Sat Oct 17. It goes on our bill of Oct 25.')
    cleanup()
    door('2026-10-21', null)
    expect(document.querySelector('[data-portal-due]')?.textContent).toBe('Send pay application 3 by Thu Nov 19. It goes on our bill of Nov 25.')
  })

  it('opens a new one with its period running to the bill day', () => {
    door('2026-10-02', null)
    fireEvent.click(screen.getByRole('button', { name: 'Fill out pay application 3' }))
    const period = screen.getByLabelText('Period ends') as HTMLInputElement
    expect(period.value).toBe('2026-10-25')
  })
})
