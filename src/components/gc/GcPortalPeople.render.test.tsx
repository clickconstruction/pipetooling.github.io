// @vitest-environment jsdom
/**
 * Render smoke for "who gets our emails" on a company's home (owner, 2026-10-05): Pecan Valley's
 * bookkeeper gets pay and papers and Marcus the rest; the one tick a kind hangs on is locked; a new
 * person needs a name, an email and at least one kind before Add works.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { initialGcState, type GcAction, type Partner } from '../../lib/gcMode/gcModel'
import { GcPortalPeople } from './GcPortalPeople'
import { PortalLangContext } from './gcPortalLang'

afterEach(cleanup)

const state = initialGcState()
const pecan = state.partners.find((p) => p.id === 'pecanvalley') as Partner

function draw(lang: 'en' | 'es' = 'en') {
  const dispatch = vi.fn<(a: GcAction) => void>()
  render(
    <PortalLangContext.Provider value={lang}>
      <GcPortalPeople partner={pecan} dispatch={dispatch} />
    </PortalLangContext.Provider>,
  )
  return dispatch
}

/** The row of one person: the block that holds their name. */
function rowOf(name: string): HTMLElement {
  const el = screen.getByText(name).closest('div')?.parentElement
  if (!el) throw new Error(`no row for ${name}`)
  return el
}

describe('who gets our emails in the portal', () => {
  it('shows each person with what they get, and locks the tick a kind hangs on', () => {
    const dispatch = draw()
    expect(screen.getByText('Who gets our emails')).toBeTruthy()
    const dana = within(rowOf('Dana Whitfield'))
    expect(screen.getByText('Bookkeeper · dana@pecanvalleyelectric.example')).toBeTruthy()
    const danaPay = dana.getByLabelText('Pay and papers') as HTMLInputElement
    expect(danaPay.checked).toBe(true)
    expect(danaPay.disabled).toBe(true)

    const marcus = within(rowOf('Marcus Bell'))
    const marcusPay = marcus.getByLabelText('Pay and papers') as HTMLInputElement
    expect(marcusPay.checked).toBe(false)
    fireEvent.click(marcusPay)
    expect(dispatch).toHaveBeenCalledWith({ type: 'tradeSetGets', partnerId: 'pecanvalley', personId: null, gets: ['quotes', 'job', 'contracts', 'pay'] })
  })

  it('adds a person once the name, the email and a kind are in', () => {
    const dispatch = draw()
    fireEvent.click(screen.getByRole('button', { name: 'Add a person' }))
    const add = screen.getByRole('button', { name: 'Add' }) as HTMLButtonElement
    expect(add.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Leo Ortiz' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'leo@pecanvalleyelectric.example' } })
    fireEvent.change(screen.getByLabelText('What they do, like Bookkeeper'), { target: { value: 'Foreman' } })
    expect(add.disabled).toBe(true)
    const form = within(screen.getByText('Gets').closest('fieldset') as HTMLElement)
    fireEvent.click(form.getByLabelText('The job'))
    expect(add.disabled).toBe(false)
    fireEvent.click(add)
    expect(dispatch).toHaveBeenCalledWith({ type: 'tradeAddPerson', partnerId: 'pecanvalley', name: 'Leo Ortiz', email: 'leo@pecanvalleyelectric.example', role: 'Foreman', gets: ['job'] })
  })

  it('draws it in Spanish', () => {
    draw('es')
    expect(screen.getByText('Quién recibe nuestros correos')).toBeTruthy()
    expect(screen.getByText('contacto principal')).toBeTruthy()
  })
})
