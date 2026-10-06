// @vitest-environment jsdom
/**
 * Render smoke for "Your dates moved" in the trade's portal (the Gantt, Phase 3, G-113): the block
 * shows the message as it went, and the two answers reach the office.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GcPortalDatesMoved } from './GcPortalDatesMoved'
import { PortalLangContext } from './gcPortalLang'
import { initialGcState } from '../../lib/gcMode/gcFixture'
import { gcReducer } from '../../lib/gcMode/gcReducer'
import { addDays } from '../../lib/gcMode/gcBuilding'

afterEach(cleanup)

function told() {
  const state = initialGcState()
  const project = state.projects.find((p) => p.id === 'fairoaksd')!
  const tpoId = project.packages.flatMap((k) => k.sow?.sov ?? []).find((l) => l.label === 'TPO membrane')!.id
  const a = project.schedule!.activities.find((x) => x.lineId === tpoId)!
  const moved = gcReducer(state, { type: 'setScheduleActivity', projectId: 'fairoaksd', lineId: a.lineId, start: addDays(a.start, 7), finish: addDays(a.finish, 7), after: a.after, why: { reason: 'weather', note: 'Rain stopped the roof.', by: 'Robert' } })
  const after = gcReducer(moved, { type: 'tellTradesMoves', projectId: 'fairoaksd', moveIds: ['move-1'], by: 'Robert' })
  const summit = after.partners.find((p) => p.company === 'Summit Roofing')!
  return { state: after, project: after.projects.find((p) => p.id === 'fairoaksd')!, summit }
}

describe('Your dates moved, in the portal', () => {
  it('shows nothing until the office has told them', () => {
    const state = initialGcState()
    const project = state.projects.find((p) => p.id === 'fairoaksd')!
    const summit = state.partners.find((p) => p.company === 'Summit Roofing')!
    const { container } = render(
      <PortalLangContext.Provider value="en">
        <GcPortalDatesMoved state={state} project={project} partner={summit} dispatch={() => undefined} />
      </PortalLangContext.Provider>,
    )
    expect(container.textContent).toBe('')
  })

  it('shows the message and sends "these dates work"', () => {
    const { state, project, summit } = told()
    const dispatch = vi.fn()
    render(
      <PortalLangContext.Provider value="en">
        <GcPortalDatesMoved state={state} project={project} partner={summit} dispatch={dispatch} />
      </PortalLangContext.Provider>,
    )
    expect(screen.getByText('Your dates moved on Fair Oaks Shops, Building D')).toBeTruthy()
    expect(screen.getByText('TPO membrane: Sep 28 to Oct 16, not Sep 21 to Oct 9.')).toBeTruthy()
    fireEvent.click(screen.getByText('These dates work'))
    expect(dispatch).toHaveBeenCalledWith({ type: 'tradeAnswerDates', projectId: 'fairoaksd', partnerId: summit.id, moveId: 'move-1', ok: true })
  })

  it('asks for another day with a note, in Spanish too', () => {
    const { state, project, summit } = told()
    const dispatch = vi.fn()
    render(
      <PortalLangContext.Provider value="es">
        <GcPortalDatesMoved state={state} project={project} partner={summit} dispatch={dispatch} />
      </PortalLangContext.Provider>,
    )
    expect(screen.getByText('Sus fechas cambiaron en Fair Oaks Shops, Building D')).toBeTruthy()
    fireEvent.click(screen.getByText('Necesito otra fecha'))
    fireEvent.change(screen.getByLabelText('La fecha en que puede'), { target: { value: '2026-10-19' } })
    fireEvent.change(screen.getByLabelText('Un comentario sobre el motivo, si gusta'), { target: { value: 'Estamos en otro techo.' } })
    fireEvent.click(screen.getByText('Enviar'))
    expect(dispatch).toHaveBeenCalledWith({ type: 'tradeAnswerDates', projectId: 'fairoaksd', partnerId: summit.id, moveId: 'move-1', ok: false, day: '2026-10-19', note: 'Estamos en otro techo.' })
  })
})
