// @vitest-environment jsdom
/**
 * Render smoke for the trade portal's paperwork block with a company we did not know (question 3):
 * it shows "Your company" not sent yet, opens the form, keeps Send shut until every line is in,
 * and sends the form; once the form is in it says the office is checking it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { gcReducer, initialGcState, type GcAction, type Partner } from '../../lib/gcMode/gcModel'
import { GcPortalPaperwork } from './GcPortalPaperwork'
import { PortalLangContext } from './gcPortalLang'

afterEach(cleanup)

const base = initialGcState()
const added = gcReducer(base, { type: 'addPartner', company: 'Brazos Steel', contact: 'Lupe Garza', trade: 'Structural steel', base: null, maxMiles: null, known: false })
const stranger = added.partners[added.partners.length - 1] as Partner

function draw(partner: Partner, lang: 'en' | 'es' = 'en') {
  const dispatch = vi.fn<(a: GcAction) => void>()
  render(
    <PortalLangContext.Provider value={lang}>
      <GcPortalPaperwork partner={partner} today={base.today} dispatch={dispatch} />
    </PortalLangContext.Provider>,
  )
  return dispatch
}

describe('the company form in the portal', () => {
  it('asks a new company for its form and sends it once every line is in', () => {
    const dispatch = draw(stranger)
    expect(screen.getByText('Your company')).toBeTruthy()
    expect(screen.getByText('not sent yet')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Tell us about your company' }))
    const send = screen.getByRole('button', { name: 'Send it to Click' }) as HTMLButtonElement
    expect(send.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Your license: its kind and number'), { target: { value: 'TX 12345' } })
    fireEvent.change(screen.getByLabelText('Your insurance company and your limits'), { target: { value: 'Lone Star Mutual, $1M / $2M' } })
    fireEvent.change(screen.getByLabelText('Years in business'), { target: { value: '12' } })
    fireEvent.change(screen.getByLabelText('Two or three people we can call, with their phone numbers'), { target: { value: 'Ana Ruiz 210-555-0100' } })
    fireEvent.change(screen.getByLabelText('Jobs like this one you have done'), { target: { value: 'Two retail shells in Seguin' } })
    expect(send.disabled).toBe(false)
    fireEvent.click(send)
    expect(dispatch).toHaveBeenCalledWith({
      type: 'tradeVettingForm',
      partnerId: stranger.id,
      form: { license: 'TX 12345', insurance: 'Lone Star Mutual, $1M / $2M', yearsInBusiness: 12, references: 'Ana Ruiz 210-555-0100', pastJobs: 'Two retail shells in Seguin' },
    })
  })

  it('says the office is checking it once the form is in, in Spanish too', () => {
    const sent = gcReducer(added, {
      type: 'tradeVettingForm',
      partnerId: stranger.id,
      form: { license: 'TX 12345', insurance: 'Lone Star Mutual', yearsInBusiness: 12, references: 'Ana Ruiz', pastJobs: 'Seguin' },
    })
    draw(sent.partners.find((p) => p.id === stranger.id) as Partner, 'es')
    expect(screen.getByText('Su empresa')).toBeTruthy()
    expect(screen.getByText(/^Click la está revisando · enviada el /)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Cuéntenos de su empresa' })).toBeNull()
  })

  it('shows nothing about vetting for a company we know', () => {
    draw(base.partners.find((p) => p.id === 'lonestar') as Partner)
    expect(screen.queryByText('Your company')).toBeNull()
  })
})
