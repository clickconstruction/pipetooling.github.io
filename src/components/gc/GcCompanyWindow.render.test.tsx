// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { GcCompanyWindow } from './GcCompanyWindow'
import { PartnerName } from './GcPartnerName'
import { GcCompanyOpenerContext } from './gcCompanyOpener'
import { boardStateFromRows, type BoardRows } from '../../lib/gc/boardRows'
import { clinicBoardRows } from '../../lib/gc/boardTestRows'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()

/** The clinic with Lonestar's bookkeeper named, and Hillside's no on the sitework written down. */
function rows(): BoardRows {
  const base = clinicBoardRows()
  return {
    ...base,
    companies: base.companies.map((c) => (c.id === 'lonestar' ? { ...c, contact_gets: ['quotes', 'job'] } : c)),
    people: [{ id: 'pp1', company_id: 'lonestar', name: 'Ana Ruiz', email: 'ana@lonestar.test', role: 'Bookkeeper', gets: ['pay'] }],
    invites: base.invites.map((i) => (i.id === 'i2' ? { ...i, status: 'declined', declined_why: 'wont', decline_reason: 'busy', decline_note: 'crews on a school job', declined_on: '2026-10-06' } : i)),
  }
}

function open(companyId: string, over: { onLanguage?: (lang: 'en' | 'es') => Promise<void>; onClose?: () => void } = {}) {
  const state = boardStateFromRows(rows())
  const partner = state.partners.find((p) => p.id === companyId)!
  const onLanguage = over.onLanguage ?? vi.fn(() => Promise.resolve())
  const onClose = over.onClose ?? vi.fn()
  render(<GcCompanyWindow state={state} partner={partner} lang="en" onLanguage={onLanguage} onClose={onClose} onOpenProject={() => undefined} />)
  return { onLanguage, onClose, dialog: screen.getByRole('dialog', { name: partner.company }) }
}

describe('GcCompanyWindow', () => {
  it('shows how they answer, their vetting, where they drive from, and who gets our emails', () => {
    const { dialog } = open('lonestar')
    expect(within(dialog).getByText('quoted 1 of 1 asks')).toBeTruthy()
    expect(within(dialog).getByText('a company we know')).toBeTruthy()
    expect(within(dialog).getByText('4410 Boerne Stage Rd, San Antonio, up to 60 mi')).toBeTruthy()
    const people = dialog.querySelector('[data-gc-company-people="lonestar"]') as HTMLElement
    expect(within(people).getByText('Ray Ortiz')).toBeTruthy()
    expect(within(people).getByText('Ana Ruiz')).toBeTruthy()
    expect(within(people).getByText('Bookkeeper')).toBeTruthy()
    expect(within(people).getByText('Pay and papers')).toBeTruthy()
    expect(within(people).getByText('Quotes and plans')).toBeTruthy()
  })

  it('says no email is on file rather than making one up', () => {
    const { dialog } = open('lonestar')
    const people = dialog.querySelector('[data-gc-company-people="lonestar"]') as HTMLElement
    expect(within(people).getByText('no email on file')).toBeTruthy()
    expect(people.textContent).not.toMatch(/\.example/)
    expect(within(people).getByRole('link', { name: 'ana@lonestar.test' })).toBeTruthy()
  })

  it('lists the times they passed with the reason written down, and its vetting for a company new to us', () => {
    const { dialog } = open('hillside')
    expect(within(dialog).getByText('Times they passed')).toBeTruthy()
    expect(within(dialog).getByText(/too busy: crews on a school job/)).toBeTruthy()
    expect(within(dialog).getByText('not vetted yet. Their form is not in yet.')).toBeTruthy()
    expect(within(dialog).getByText('address not set')).toBeTruthy()
  })

  it('sets the language, and shows the problem in words when it does not save', async () => {
    const onLanguage = vi.fn(() => Promise.reject(new Error('That did not save.')))
    const { dialog } = open('hillside', { onLanguage })
    fireEvent.change(within(dialog).getByLabelText('Language for Hillside Excavation'), { target: { value: 'es' } })
    expect(onLanguage).toHaveBeenCalledWith('es')
    await within(dialog).findByText('That did not save.')
  })

  it('closes on Escape and on its close button', () => {
    const onClose = vi.fn()
    const { dialog } = open('hillside', { onClose })
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

describe('PartnerName', () => {
  it('is plain text where no window can open, and opens the company where one can', async () => {
    const onOpen = vi.fn()
    render(
      <>
        <PartnerName partnerId="plain" company="Plain Co" />
        <GcCompanyOpenerContext.Provider value={{ openPartner: onOpen }}>
          <PartnerName partnerId="linked" company="Linked Co" />
        </GcCompanyOpenerContext.Provider>
      </>,
    )
    expect(screen.getByText('Plain Co').tagName).toBe('STRONG')
    fireEvent.click(screen.getByRole('button', { name: 'Linked Co' }))
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith('linked'))
  })
})
