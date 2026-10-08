// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { GcTradePartners, type TradePartnerWrites } from './GcTradePartners'
import { boardStateFromRows } from '../../lib/gc/boardRows'
import { clinicBoardRows } from '../../lib/gc/boardTestRows'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()

function writes(): TradePartnerWrites {
  return { addCompany: vi.fn(() => Promise.resolve()), vetCompany: vi.fn(() => Promise.resolve()), setCoverage: vi.fn(() => Promise.resolve()) }
}

const hillsideForm = { company_id: 'hillside', license: 'TX 4471', insurance: 'Lone Star Mutual, $1M / $2M', years_in_business: 9, reference_list: 'Ana Ruiz 210-555-0120', past_jobs: 'Two clinics in Boerne', sent_on: '2026-10-04' }

describe('GcTradePartners', () => {
  it('puts a company new to us at the top with its form, and approves it with no limit or up to an amount', async () => {
    const w = writes()
    const state = boardStateFromRows(clinicBoardRows({ vettingForms: [hillsideForm] }))
    render(<GcTradePartners state={state} writes={w} onOpenProject={() => undefined} />)
    const row = document.querySelector('[data-gc-vet="hillside"]') as HTMLElement
    expect(within(row).getByText('Hillside Excavation')).toBeTruthy()
    expect(within(row).getByText('TX 4471')).toBeTruthy()
    expect(within(row).getByText('Two clinics in Boerne')).toBeTruthy()
    expect(document.querySelector('[data-gc-vet="lonestar"]')).toBeNull()

    fireEvent.click(within(row).getByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(w.vetCompany).toHaveBeenCalledWith('hillside', 'approved', null, ''))

    const upTo = within(row).getByRole('button', { name: 'Approve up to this' }) as HTMLButtonElement
    expect(upTo.disabled).toBe(true)
    fireEvent.change(within(row).getByLabelText('Approve up to this amount'), { target: { value: '$150,000' } })
    fireEvent.change(within(row).getByLabelText('A note on Hillside Excavation'), { target: { value: 'Ana vouched for them.' } })
    await waitFor(() => expect(upTo.disabled).toBe(false))
    fireEvent.click(upTo)
    await waitFor(() => expect(w.vetCompany).toHaveBeenCalledWith('hillside', 'approved', 150000, 'Ana vouched for them.'))
  })

  it('says when the form has not come in, declines, and shows the problem in words when it does not save', async () => {
    const w = writes()
    vi.mocked(w.vetCompany).mockRejectedValueOnce(new Error('Only a dev can decide while this is built.'))
    render(<GcTradePartners state={boardStateFromRows(clinicBoardRows())} writes={w} onOpenProject={() => undefined} />)
    const row = document.querySelector('[data-gc-vet="hillside"]') as HTMLElement
    expect(within(row).getByText(/Their form has not come in/)).toBeTruthy()
    fireEvent.click(within(row).getByRole('button', { name: 'Decline' }))
    await within(row).findByText('Only a dev can decide while this is built.')
    expect(w.vetCompany).toHaveBeenCalledWith('hillside', 'declined', null, '')
  })

  it('draws each trade with its companies, and a trade with none still gets a card to add the first', () => {
    render(<GcTradePartners state={boardStateFromRows(clinicBoardRows())} writes={writes()} onOpenProject={() => undefined} trades={['Sitework', 'Concrete', 'Roofing']} />)
    expect(screen.getByRole('navigation', { name: 'Jump to a trade' })).toBeTruthy()
    expect(document.querySelector('[data-gc-partner="lonestar"]')).toBeTruthy()
    expect(document.querySelector('[data-gc-partner="hillside"]')).toBeTruthy()
    const roofing = document.getElementById('gc-bench-roofing')?.parentElement as HTMLElement
    expect(within(roofing).getByText('No company does this trade yet. Press Add a company.')).toBeTruthy()
  })

  it('adds a company to a trade as new to us unless we say we have worked with them, then closes the form', async () => {
    const w = writes()
    render(<GcTradePartners state={boardStateFromRows(clinicBoardRows())} writes={w} onOpenProject={() => undefined} trades={['Roofing']} />)
    const roofing = document.getElementById('gc-bench-roofing')?.parentElement as HTMLElement
    fireEvent.click(within(roofing).getByRole('button', { name: 'Add a company' }))
    const add = within(roofing).getByRole('button', { name: 'Add to Roofing' }) as HTMLButtonElement
    expect(add.disabled).toBe(true)
    fireEvent.change(within(roofing).getByLabelText('Company name'), { target: { value: ' Cap Rock Roofing test, delete me ' } })
    fireEvent.change(within(roofing).getByLabelText('Who to call'), { target: { value: 'Lee Vance' } })
    fireEvent.change(within(roofing).getByLabelText('Their address'), { target: { value: '200 Main St, Boerne' } })
    fireEvent.change(within(roofing).getByLabelText(/How far they will go/), { target: { value: '40' } })
    fireEvent.click(add)
    await waitFor(() =>
      expect(w.addCompany).toHaveBeenCalledWith({ name: 'Cap Rock Roofing test, delete me', trades: ['Roofing'], contactName: 'Lee Vance', phone: '', email: '', address: '200 Main St, Boerne', maxMiles: 40, known: false }),
    )
    await waitFor(() => expect(within(roofing).queryByLabelText('Company name')).toBeNull())
  })

  it('opens the Ask window from a trade short of quotes, and from the assistants’ ask', () => {
    const onAsk = vi.fn()
    const base = clinicBoardRows()
    const withConcrete = clinicBoardRows({
      companies: [...base.companies, { ...base.companies[0]!, id: 'alamo', name: 'Alamo Concrete', trades: ['Concrete'], address: '9 Main St, Boerne' }],
    })
    render(<GcTradePartners state={boardStateFromRows(withConcrete)} writes={writes()} onOpenProject={() => undefined} onAsk={onAsk} />)
    const card = document.getElementById('gc-bench-concrete')?.parentElement as HTMLElement
    fireEvent.click(within(card).getByRole('button', { name: 'Ask the 1 we have not asked' }))
    expect(onAsk).toHaveBeenCalledWith('p1', 'k2')
  })

  it('changes where a company drives from, and Escape puts it back', async () => {
    const w = writes()
    render(<GcTradePartners state={boardStateFromRows(clinicBoardRows())} writes={w} onOpenProject={() => undefined} />)
    const line = document.querySelector('[data-gc-partner="hillside"]') as HTMLElement
    fireEvent.click(within(line).getByRole('button', { name: 'address not set' }))
    const address = screen.getByLabelText('Their address')
    fireEvent.change(address, { target: { value: '18 Elm St, Boerne' } })
    fireEvent.keyDown(address, { key: 'Escape' })
    expect(screen.queryByLabelText('Their address')).toBeNull()
    expect(w.setCoverage).not.toHaveBeenCalled()

    fireEvent.click(within(line).getByRole('button', { name: 'address not set' }))
    fireEvent.change(screen.getByLabelText('Their address'), { target: { value: '18 Elm St, Boerne' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(w.setCoverage).toHaveBeenCalledWith('hillside', '18 Elm St, Boerne', null))
  })
})
