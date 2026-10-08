// @vitest-environment jsdom
/**
 * Render smoke for the Ask window (the owner, 2026-10-05: "build the confirm window";
 * `to-dos/gc-mode/ask-companies-mockup.html`): nobody is asked until the button is pressed, an
 * unticked company is left out, and the invitation shows before it goes.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GcAskCompanies } from './GcAskCompanies.proto'
import { initialGcState } from '../../lib/gcMode/gcFixture'

afterEach(cleanup)

function padBConcrete() {
  const state = initialGcState()
  const project = state.projects.find((p) => p.name === 'Boerne Retail Pad B')!
  const pkg = project.packages.find((k) => k.trade === 'Concrete')!
  return { state, projectId: project.id, packageId: pkg.id }
}

describe('the Ask window', () => {
  it('shows who and the invitation, and asks only on the press', () => {
    const { state, projectId, packageId } = padBConcrete()
    const dispatch = vi.fn()
    const onClose = vi.fn()
    render(<GcAskCompanies state={state} dispatch={dispatch} projectId={projectId} packageId={packageId} onClose={onClose} />)
    expect(screen.getByRole('dialog', { name: 'Ask for Concrete quotes' })).toBeTruthy()
    expect(screen.getByLabelText('Ask Alamo Concrete')).toBeTruthy()
    expect(screen.getByLabelText('Ask Guadalupe Flatwork')).toBeTruthy()
    expect(screen.getByText('0 of 2 quotes')).toBeTruthy()
    // The invitation is on screen before anything goes.
    expect(screen.getAllByText(/Boerne Retail Pad B/).length).toBeGreaterThan(1)
    expect(dispatch).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Ask 2 companies'))
    expect(dispatch).toHaveBeenCalledTimes(2)
    expect(dispatch.mock.calls.every(([a]) => a.type === 'invite' && a.projectId === projectId && a.packageId === packageId)).toBe(true)
    expect(onClose).toHaveBeenCalled()
  })

  it('leaves out a company that is unticked, and names the one left', () => {
    const { state, projectId, packageId } = padBConcrete()
    const dispatch = vi.fn()
    render(<GcAskCompanies state={state} dispatch={dispatch} projectId={projectId} packageId={packageId} onClose={() => undefined} />)
    fireEvent.click(screen.getByLabelText('Ask Guadalupe Flatwork'))
    fireEvent.click(screen.getByText('Ask Alamo Concrete', { selector: 'button' }))
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(state.partners.find((p) => p.id === dispatch.mock.calls[0]![0].partnerId)?.company).toBe('Alamo Concrete')
  })

  it('opens with one company ticked from its own Ask chip, and Cancel asks nobody', () => {
    const { state, projectId, packageId } = padBConcrete()
    const alamo = state.partners.find((p) => p.company === 'Alamo Concrete')!
    const dispatch = vi.fn()
    const onClose = vi.fn()
    render(<GcAskCompanies state={state} dispatch={dispatch} projectId={projectId} packageId={packageId} tick={[alamo.id]} onClose={onClose} />)
    expect((screen.getByLabelText('Ask Alamo Concrete') as HTMLInputElement).checked).toBe(true)
    expect((screen.getByLabelText('Ask Guadalupe Flatwork') as HTMLInputElement).checked).toBe(false)
    fireEvent.click(screen.getByText('Cancel'))
    expect(dispatch).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
})
