// @vitest-environment jsdom
/**
 * Render smoke for "charges from Click" on a trade's job page (owner, 2026-10-05): Iron Horse sees
 * the charge for the cut power line, agrees to it in one press, or disputes it only once it says
 * why. Spanish draws the same block in its words.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { initialGcState, type GcAction } from '../../lib/gcMode/gcModel'
import { GcPortalBackCharges } from './GcPortalBackCharges'
import { PortalLangContext } from './gcPortalLang'

afterEach(cleanup)

const state = initialGcState()
const project = state.projects.find((p) => p.id === 'fairoaksd')
const pkg = project?.packages.find((k) => k.id === 'fsteel')

function draw(lang: 'en' | 'es' = 'en', partnerId = 'ironhorse') {
  if (!project || !pkg) throw new Error('no Fair Oaks steel')
  const dispatch = vi.fn<(a: GcAction) => void>()
  render(
    <PortalLangContext.Provider value={lang}>
      <GcPortalBackCharges project={project} pkg={pkg} partnerId={partnerId} today={state.today} dispatch={dispatch} />
    </PortalLangContext.Provider>,
  )
  return dispatch
}

const ids = { type: 'tradeAnswerBackCharge', projectId: 'fairoaksd', packageId: 'fsteel', chargeId: 'fsteel-bc-1' } as const

describe('charges from Click in the portal', () => {
  it('shows the charge with its reason and photo, and agrees in one press', () => {
    const dispatch = draw()
    expect(screen.getByText('Structural steel · charges from Click')).toBeTruthy()
    expect(screen.getByText('$1,250 · sent Sep 30')).toBeTruthy()
    expect(screen.getByText('photo: north-temp-power.jpg')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Agree' }))
    expect(dispatch).toHaveBeenCalledWith({ ...ids, agree: true, note: '' })
  })

  it('disputes it only with a reason', () => {
    const dispatch = draw()
    fireEvent.click(screen.getByRole('button', { name: 'Dispute it' }))
    const send = screen.getByRole('button', { name: 'Send to Click' }) as HTMLButtonElement
    expect(send.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Why you dispute it'), { target: { value: 'The line was not marked' } })
    fireEvent.click(send)
    expect(dispatch).toHaveBeenCalledWith({ ...ids, agree: false, note: 'The line was not marked' })
  })

  it('draws it in Spanish, and not for another company', () => {
    draw('es')
    expect(screen.getByText('Structural steel · cargos de Click')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Aceptar' })).toBeTruthy()
    cleanup()
    draw('en', 'bexar')
    expect(screen.queryByText('Structural steel · charges from Click')).toBeNull()
  })
})
