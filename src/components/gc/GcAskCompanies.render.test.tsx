// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { GcAskCompanies } from './GcAskCompanies'
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

function open(over: { onAsk?: (ids: string[]) => Promise<void>; onClose?: () => void; tick?: string[] } = {}) {
  const onAsk = over.onAsk ?? vi.fn(() => Promise.resolve())
  const onClose = over.onClose ?? vi.fn()
  render(
    <GcAskCompanies state={boardStateFromRows(rows())} projectId="p1" packageId="k2" langs={{ alamo: 'es', border: 'en' }} onAsk={onAsk} onClose={onClose} {...(over.tick ? { tick: over.tick } : {})} />,
  )
  return { onAsk, onClose, dialog: screen.getByRole('dialog', { name: 'Ask for Concrete quotes' }) }
}

describe('GcAskCompanies', () => {
  it('ticks the company in range, offers the far one unticked, and says nothing is emailed yet', () => {
    const { dialog } = open()
    expect((within(dialog).getByLabelText('Ask Alamo Concrete') as HTMLInputElement).checked).toBe(true)
    expect((within(dialog).getByLabelText('Ask Border Flatwork') as HTMLInputElement).checked).toBe(false)
    expect(within(dialog).getByText('Too far, or declined')).toBeTruthy()
    const far = dialog.querySelector('[data-gc-ask-choice="border"]') as HTMLElement
    expect(within(far).getByText('no email on file')).toBeTruthy()
    expect(within(dialog).getByText(/1 email goes out/)).toBeTruthy()
    expect(within(dialog).getByText(/For now nothing is emailed/)).toBeTruthy()
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

  it('asks the ticked companies, then closes', async () => {
    const { onAsk, onClose, dialog } = open()
    fireEvent.click(within(dialog).getByLabelText('Ask Border Flatwork'))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ask 2 companies' }))
    await waitFor(() => expect(onAsk).toHaveBeenCalledWith(['alamo', 'border']))
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
