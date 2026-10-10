// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { GcBoard } from './GcBoard'
import { GcCustomerOpenerContext } from './gcCustomerOpener'
import { boardStateFromRows } from '../../lib/gc/boardRows'
import { clinicBoardRows } from '../../lib/gc/boardTestRows'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()

describe('GcBoard', () => {
  it('draws the strip and the sections, and the clinic under Bidding with its days left and price so far', () => {
    const state = boardStateFromRows(clinicBoardRows())
    render(<GcBoard state={state} onOpen={() => undefined} onPlans={() => undefined} />)
    expect(screen.getByRole('navigation', { name: 'Jump to a stage' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Jump to Bidding to the customer, 1 job' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Jump to Lost, 0 jobs' })).toBeTruthy()
    const row = document.querySelector('[data-gc-board-row="p1"]') as HTMLElement
    expect(within(row).getByText('Hill Country Clinic')).toBeTruthy()
    expect(within(row).getByText('12')).toBeTruthy()
    expect(within(row).getByText('days left')).toBeTruthy()
    expect(within(row).getByText(/so far, with 3 holes/)).toBeTruthy()
    expect(within(row).getByText(/Oak Street Partners/)).toBeTruthy()
  })

  it('the customer’s name opens their window where the page gives one, and stays plain where it does not (B6-d-ii)', () => {
    const state = boardStateFromRows(clinicBoardRows())
    const openCustomer = vi.fn()
    const onOpen = vi.fn()
    const { unmount } = render(
      <GcCustomerOpenerContext.Provider value={{ openCustomer }}>
        <GcBoard state={state} onOpen={onOpen} onPlans={() => undefined} />
      </GcCustomerOpenerContext.Provider>,
    )
    const row = document.querySelector('[data-gc-board-row="p1"]') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: 'Oak Street Partners' }))
    expect(openCustomer).toHaveBeenCalledWith('c1')
    expect(onOpen).not.toHaveBeenCalled()
    unmount()
    render(<GcBoard state={state} onOpen={() => undefined} onPlans={() => undefined} />)
    expect(within(document.querySelector('[data-gc-board-row="p1"]') as HTMLElement).queryByRole('button', { name: 'Oak Street Partners' })).toBeNull()
  })

  it('marks a price with a missing cost as + ?, on the row and on the carried trade in the price card', () => {
    const base = clinicBoardRows()
    const rows = clinicBoardRows({
      projects: base.projects.map((p) => ({ ...p, trades: p.trades.map((t) => (t.id === 'k1' ? { ...t, carriedInviteId: 'i1' } : t)) })),
      invites: base.invites.map((i) => (i.id === 'i1' ? { ...i, plugs: {} } : i)),
    })
    const onCompare = vi.fn()
    render(<GcBoard state={boardStateFromRows(rows)} onOpen={() => undefined} onPlans={() => undefined} onCompare={onCompare} />)
    const row = document.querySelector('[data-gc-board-row="p1"]') as HTMLElement
    expect(within(row).getByText(/In Sitework, 1 line has no cost yet: paving\./)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /so far, with 2 holes/ }))
    const card = screen.getByRole('dialog', { name: 'What the price of Hill Country Clinic is made of' })
    expect(within(card).getAllByText(/1 line has no cost yet: paving/).length).toBeGreaterThan(0)
    fireEvent.click(within(card).getByRole('button', { name: 'Set a cost' }))
    expect(onCompare).toHaveBeenCalledWith('p1', 'k1')
    expect(screen.queryByRole('dialog', { name: 'What the price of Hill Country Clinic is made of' })).toBeNull()
  })

  it('outside the money team, the row and the price card read the trades alone', () => {
    const state = boardStateFromRows(clinicBoardRows({ money: [], moneyShown: false }))
    render(<GcBoard state={state} onOpen={() => undefined} onPlans={() => undefined} moneyShown={false} />)
    fireEvent.click(screen.getByRole('button', { name: /^trades so far, with 3 holes/ }))
    const card = screen.getByRole('dialog', { name: 'What the price of Hill Country Clinic is made of' })
    expect(within(card).getByText('Trades so far')).toBeTruthy()
    expect(within(card).queryByText('Price so far')).toBeNull()
    expect(within(card).queryByText('General conditions')).toBeNull()
    expect(within(card).queryByText(/Contingency/)).toBeNull()
  })

  it('opens the project from its row, the plans from the plans link, and the price card from the price line', () => {
    const onOpen = vi.fn()
    const onPlans = vi.fn()
    const state = boardStateFromRows(clinicBoardRows())
    render(<GcBoard state={state} onOpen={onOpen} onPlans={onPlans} />)
    fireEvent.click(screen.getByRole('button', { name: 'Plans, Hill Country Clinic' }))
    expect(onPlans).toHaveBeenCalledWith('p1')
    expect(onOpen).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /so far, with 3 holes/ }))
    const card = screen.getByRole('dialog', { name: 'What the price of Hill Country Clinic is made of' })
    expect(within(card).getByText(/Pick a quote to carry/)).toBeTruthy()
    expect(within(card).queryByRole('button', { name: 'Compare quotes' })).toBeNull()
    fireEvent.click(within(card).getByRole('button', { name: 'Open the project' }))
    expect(onOpen).toHaveBeenCalledWith('p1')
  })
})
