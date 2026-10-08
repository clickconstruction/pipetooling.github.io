// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { GcAskCompanies } from './GcAskCompanies'
import type { AskOutcome } from '../../lib/gc/askEmail'
import { boardStateFromRows, type BoardRows, type CompanyRow } from '../../lib/gc/boardRows'
import { clinicBoardRows } from '../../lib/gc/boardTestRows'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()

const concrete = (over: Partial<CompanyRow>): CompanyRow => ({
  id: 'x',
  name: 'x',
  trades: ['Concrete'],
  contact_name: '',
  phone: '',
  email: '',
  address: '',
  max_miles: null,
  license: '',
  lang: 'en',
  vetting_status: null,
  vetting_limit: null,
  vetting_decided_on: null,
  vetting_decided_by: null,
  vetting_note: '',
  ...over,
})

/** The clinic with two concrete companies: one in Boerne that chose Spanish, one in Laredo that goes 40 miles. */
function rows(): BoardRows {
  const base = clinicBoardRows()
  return {
    ...base,
    companies: [
      ...base.companies,
      concrete({ id: 'alamo', name: 'Alamo Concrete', contact_name: 'Hector Luna', email: 'hector@alamo.test', address: '9 Main St, Boerne', max_miles: 60, lang: 'es' }),
      concrete({ id: 'border', name: 'Border Flatwork', contact_name: 'Ines Barrera', address: '2 Rio St, Laredo', max_miles: 40 }),
    ],
  }
}

function open(over: { onAsk?: (ids: string[], email: boolean) => Promise<AskOutcome[] | void>; onClose?: () => void; tick?: string[]; emails?: boolean } = {}) {
  const onAsk = over.onAsk ?? vi.fn(() => Promise.resolve())
  const onClose = over.onClose ?? vi.fn()
  render(
    <GcAskCompanies
      state={boardStateFromRows(rows())}
      projectId="p1"
      packageId="k2"
      langs={{ alamo: 'es', border: 'en' }}
      onAsk={onAsk}
      onClose={onClose}
      {...(over.tick ? { tick: over.tick } : {})}
      {...(over.emails ? { emails: true } : {})}
    />,
  )
  return { onAsk, onClose, dialog: screen.getByRole('dialog', { name: 'Ask for Concrete quotes' }) }
}

describe('GcAskCompanies', () => {
  it('ticks the company in range, offers the far one unticked, and says a dev sends the emails', () => {
    const { dialog } = open()
    expect((within(dialog).getByLabelText('Ask Alamo Concrete') as HTMLInputElement).checked).toBe(true)
    expect((within(dialog).getByLabelText('Ask Border Flatwork') as HTMLInputElement).checked).toBe(false)
    expect(within(dialog).getByText('Too far, or declined')).toBeTruthy()
    const far = dialog.querySelector('[data-gc-ask-choice="border"]') as HTMLElement
    expect(within(far).getByText('no email on file')).toBeTruthy()
    expect(within(dialog).getByText(/1 email goes out/)).toBeTruthy()
    expect(within(dialog).getByText('The asks are saved. A dev sends the invitation emails while GC mode is built.')).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Ask Alamo Concrete' })).toBeTruthy()
  })

  it('draws the invitation in the company’s own language, marked not sent yet, to its real address', () => {
    const { dialog } = open()
    const email = within(dialog).getByRole('article', { name: 'The invitation Alamo Concrete gets' })
    expect(within(email).getByText('not sent yet')).toBeTruthy()
    expect(within(email).getByText(/Hector Luna <hector@alamo.test>/)).toBeTruthy()
    expect(within(email).getByText('Foundations')).toBeTruthy()
    expect(email.textContent).toMatch(/Hill Country Clinic/)
    expect(email.textContent).toMatch(/Hola|cotiz/i)
  })

  it('for a dev, the email tick starts off until the owner names an inbox (call 3), and an untouched press sends nothing', async () => {
    const onAsk = vi.fn(() => Promise.resolve())
    const { dialog } = open({ emails: true, onAsk })
    const tick = within(dialog).getByRole('checkbox', { name: 'Email the invitations now' }) as HTMLInputElement
    expect(tick.checked).toBe(false)
    expect(within(dialog).getByText('The asks are saved without an email. Tick Email the invitations now to send them.')).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ask Alamo Concrete' }))
    await waitFor(() => expect(onAsk).toHaveBeenCalledWith(['alamo'], false))
  })

  it('a dev who ticks it sends the invitations with the press', async () => {
    const onAsk = vi.fn(() => Promise.resolve())
    const { dialog } = open({ emails: true, onAsk })
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Email the invitations now' }))
    expect(within(dialog).getByText('Each company gets this invitation by email now, with its portal link.')).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ask Alamo Concrete' }))
    await waitFor(() => expect(onAsk).toHaveBeenCalledWith(['alamo'], true))
  })

  it('anyone who cannot send gets no tick, and the asks wait for a dev', () => {
    const { dialog } = open()
    expect(within(dialog).queryByRole('checkbox', { name: 'Email the invitations now' })).toBeNull()
  })

  it('lists an invitation that did not go out with its reason, and closes on Done, not before', async () => {
    const onClose = vi.fn()
    const onAsk = vi.fn(() =>
      Promise.resolve<AskOutcome[]>([{ inviteId: 'n1', companyId: 'alamo', sent: false, words: 'No one at the company has an email for this kind of message. Call them.' }]),
    )
    const { dialog } = open({ emails: true, onAsk, onClose })
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Email the invitations now' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ask Alamo Concrete' }))
    const refused = await waitFor(() => {
      const el = dialog.querySelector('[data-gc-ask-refused]')
      expect(el).toBeTruthy()
      return el as HTMLElement
    })
    expect(within(refused).getByText('One invitation did not go out. The ask is saved.')).toBeTruthy()
    expect(within(refused).getByText(/Alamo Concrete: No one at the company has an email/)).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
    expect(within(dialog).queryByRole('button', { name: 'Ask Alamo Concrete' })).toBeNull()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('closes at once when every invitation went out', async () => {
    const onClose = vi.fn()
    const onAsk = vi.fn(() => Promise.resolve<AskOutcome[]>([{ inviteId: 'n1', companyId: 'alamo', sent: true, words: null }]))
    const { dialog } = open({ emails: true, onAsk, onClose })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ask Alamo Concrete' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('asks the ticked companies, then closes', async () => {
    const { onAsk, onClose, dialog } = open()
    fireEvent.click(within(dialog).getByLabelText('Ask Border Flatwork'))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ask 2 companies' }))
    await waitFor(() => expect(onAsk).toHaveBeenCalledWith(['alamo', 'border'], false))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('keeps the window open with the problem in words when the asks do not save', async () => {
    const onAsk = vi.fn(() => Promise.reject(new Error('We lost this bid. Nobody is asked on it.')))
    const { onClose, dialog } = open({ onAsk })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ask Alamo Concrete' }))
    await within(dialog).findByText('We lost this bid. Nobody is asked on it.')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('opens with only the companies it was given ticked, and asks nobody with none ticked', () => {
    const { dialog } = open({ tick: ['border'] })
    expect((within(dialog).getByLabelText('Ask Alamo Concrete') as HTMLInputElement).checked).toBe(false)
    fireEvent.click(within(dialog).getByLabelText('Ask Border Flatwork'))
    expect((within(dialog).getByRole('button', { name: 'Ask 0 companies' }) as HTMLButtonElement).disabled).toBe(true)
    expect(within(dialog).getByText('Tick a company to ask.')).toBeTruthy()
  })
})
