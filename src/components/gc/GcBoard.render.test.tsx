// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { GcBoard } from './GcBoard'
import { GcCustomerOpenerContext } from './gcCustomerOpener'
import { boardStateFromRows } from '../../lib/gc/boardRows'
import { awardedClinicBoardRows, clinicBoardRows } from '../../lib/gc/boardTestRows'
import { initialGcState } from '../../lib/gc/schedule/testState'
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

  it('each row carries Who to call when the page gives Follow up, its job’s share; none without (B2b-ii)', () => {
    const state = boardStateFromRows(awardedClinicBoardRows())
    const onChase = vi.fn()
    const { unmount } = render(<GcBoard state={state} onOpen={() => undefined} onPlans={() => undefined} onChase={onChase} />)
    const people = document.querySelector('[data-gc-board-people="p1"]') as HTMLElement
    fireEvent.click(within(people).getByRole('button', { name: /^1 to call/ }))
    fireEvent.click(within(people).getByRole('button', { name: 'Open Follow up' }))
    expect(onChase).toHaveBeenCalledTimes(1)
    unmount()
    render(<GcBoard state={state} onOpen={() => undefined} onPlans={() => undefined} />)
    expect(document.querySelector('[data-gc-board-people]')).toBeNull()
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

describe('GcBoard, By customer (the Board’s B2b-iii)', () => {
  /** The made-up data with Hollis Family Pharmacy's Stone Oak closed and Cibolo Creek's PADB lost. */
  const closedAndLost = () => {
    const s = initialGcState()
    return { ...s, projects: s.projects.map((p) => (p.id === 'stoneoak' ? { ...p, closedOn: '2026-09-30' } : p.id === 'padb' ? { ...p, lostOn: '2026-09-29' } : p)) }
  }
  const nameOf = (s: ReturnType<typeof initialGcState>, id: string) => s.projects.find((p) => p.id === id)!.name

  it('opens on By stage, and By customer puts each customer’s jobs under a heading per stage with their worth', () => {
    const state = initialGcState()
    render(<GcBoard state={state} onOpen={() => undefined} onPlans={() => undefined} />)
    expect(screen.getByRole('button', { name: 'By stage' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('navigation', { name: 'Jump to a stage' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'By customer' }))
    expect(screen.getByRole('navigation', { name: 'Jump to a customer' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Jump to Cibolo Creek Partners, 3 jobs' })).toBeTruthy()
    const cibolo = [...document.querySelectorAll<HTMLElement>('[data-gc-board-customer]')].find((el) => el.textContent?.includes('Cibolo Creek Partners'))!
    expect(within(cibolo).getByText('bidding $977,823 · under contract $1,488,762')).toBeTruthy()
    expect(within(cibolo).getByText('Bidding to the customer')).toBeTruthy()
    expect(within(cibolo).getByText('Building')).toBeTruthy()
    // The band names the customer, so its rows leave the name out.
    const row = cibolo.querySelector('[data-gc-board-row="fairoaksd"]') as HTMLElement
    expect(within(row).queryByText('Cibolo Creek Partners')).toBeNull()
    expect(screen.queryByText(/nothing billed yet|owes us/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'By stage' }))
    expect(screen.getByRole('navigation', { name: 'Jump to a stage' })).toBeTruthy()
    expect(document.querySelector('[data-gc-board-customer]')).toBeNull()
  })

  it('a customer’s name opens their window, and closed and lost jobs fold into one Also line that opens the job', () => {
    const state = closedAndLost()
    const openCustomer = vi.fn()
    const onOpen = vi.fn()
    render(
      <GcCustomerOpenerContext.Provider value={{ openCustomer }}>
        <GcBoard state={state} onOpen={onOpen} onPlans={() => undefined} />
      </GcCustomerOpenerContext.Provider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'By customer' }))
    const hollis = state.customers.find((c) => c.name === 'Hollis Family Pharmacy')!
    const band = document.querySelector(`[data-gc-board-customer="${hollis.id}"]`) as HTMLElement
    expect(within(band).getByText('Nothing open with them right now.')).toBeTruthy()
    fireEvent.click(within(band).getByRole('button', { name: 'Hollis Family Pharmacy' }))
    expect(openCustomer).toHaveBeenCalledWith(hollis.id)
    const also = document.querySelector(`[data-gc-board-also="${hollis.id}"]`) as HTMLElement
    expect(also.textContent).toBe(`Also: ${nameOf(state, 'stoneoak')}, closed Sep 30`)
    fireEvent.click(within(also).getByRole('button', { name: nameOf(state, 'stoneoak') }))
    expect(onOpen).toHaveBeenCalledWith('stoneoak')
    const cibolo = state.customers.find((c) => c.name === 'Cibolo Creek Partners')!
    expect((document.querySelector(`[data-gc-board-also="${cibolo.id}"]`) as HTMLElement).textContent).toBe(`Also: ${nameOf(state, 'padb')}, lost`)
  })
})
