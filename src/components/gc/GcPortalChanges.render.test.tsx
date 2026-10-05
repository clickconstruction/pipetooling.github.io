// @vitest-environment jsdom
/**
 * Render smoke for "changes to your work" on a trade's job page (owner, 2026-10-04): Tri-County sees
 * the rock it asked about, opens the form, cannot send until it says what and how much, and sends
 * what it typed. Spanish draws the same block in its words.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { initialGcState, type GcAction } from '../../lib/gcMode/gcModel'
import { GcPortalChanges } from './GcPortalChanges'
import { PortalLangContext } from './gcPortalLang'

afterEach(cleanup)

const state = initialGcState()
const project = state.projects.find((p) => p.id === 'fairoaksd')
const pkg = project?.packages.find((k) => k.id === 'fsite')

function draw(lang: 'en' | 'es' = 'en', partnerId = 'tricounty') {
  if (!project || !pkg) throw new Error('no Fair Oaks sitework')
  const dispatch = vi.fn<(a: GcAction) => void>()
  render(
    <PortalLangContext.Provider value={lang}>
      <GcPortalChanges project={project} pkg={pkg} partnerId={partnerId} dispatch={dispatch} />
    </PortalLangContext.Provider>,
  )
  return dispatch
}

describe('changes to your work in the portal', () => {
  it('shows the change Tri-County asked for and sends a new one', () => {
    const dispatch = draw()
    expect(screen.getByText('Sitework · changes to your work')).toBeTruthy()
    expect(screen.getByText('Rock at the north footings, about 390 cubic yards to break out and haul off')).toBeTruthy()
    expect(screen.getByText('Click is looking at it.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Ask for a change' }))
    const send = screen.getByRole('button', { name: 'Send to Click' }) as HTMLButtonElement
    expect(send.disabled).toBe(true)
    fireEvent.change(screen.getByPlaceholderText('What you found or were asked for, and where'), { target: { value: 'Two more yard lights for the owner' } })
    fireEvent.click(screen.getByLabelText('The customer asked for more'))
    expect(send.disabled).toBe(true)
    fireEvent.change(screen.getByPlaceholderText('$'), { target: { value: '$3,400' } })
    expect(send.disabled).toBe(false)
    fireEvent.click(send)
    expect(dispatch).toHaveBeenCalledWith({
      type: 'tradeAskChange',
      projectId: 'fairoaksd',
      packageId: 'fsite',
      partnerId: 'tricounty',
      description: 'Two more yard lights for the owner',
      reason: 'owner',
      amount: 3400,
      days: 0,
      file: null,
    })
  })

  it('draws it in Spanish', () => {
    draw('es')
    expect(screen.getByText('Sitework · cambios a su trabajo')).toBeTruthy()
    expect(screen.getByText('Click lo está revisando.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Pedir un cambio' })).toBeTruthy()
  })

  it('is not there for a company that is not on the work', () => {
    draw('en', 'hillside')
    expect(screen.queryByText('Sitework · changes to your work')).toBeNull()
  })
})
