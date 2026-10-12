// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FlowBoard } from '../../../hooks/useFlowBoard'
import { contextFor, CUSTOMER_FLOW, CUSTOMERS, TRADE_FLOW, TRADES } from '../../../lib/flows/boardFixtures'
import { installDomShims } from '../../../test/renderSmokeMocks'
import { GcCompanyOpenerContext } from '../gcCompanyOpener'
import { GcCustomerOpenerContext } from '../gcCustomerOpener'

installDomShims()

/** The read, as the test sets it: the demo people with each one's own record. */
let board: FlowBoard
const fromFixtures = (kind: 'trade' | 'customer'): FlowBoard => {
  const flow = kind === 'trade' ? TRADE_FLOW : CUSTOMER_FLOW
  const companies = kind === 'trade' ? TRADES : CUSTOMERS
  return {
    flow,
    ctx: contextFor(flow),
    read: {
      kind,
      companies,
      readings: {},
      jobs: contextFor(flow).jobs,
      firstNames: contextFor(flow).firstNames,
      refs: Object.fromEntries(companies.map((c) => [c.contactId, kind === 'trade' ? { companyId: `co-${c.contactId}`, customerId: null } : { companyId: null, customerId: `cu-${c.contactId}` }])),
    },
    loading: false,
    error: null,
    refresh: () => undefined,
  }
}
vi.mock('../../../hooks/useFlowBoard', () => ({ useFlowBoard: () => board }))

const { GcFlowBoard } = await import('./GcFlowBoard')

const openPartner = vi.fn()
const openCustomer = vi.fn()
const page = { onBy: vi.fn(), onFollowUp: vi.fn(), onOpenProject: vi.fn(), onBillDay: vi.fn() }
const withOpeners = (ui: ReactElement) =>
  render(
    <GcCompanyOpenerContext.Provider value={{ openPartner }}>
      <GcCustomerOpenerContext.Provider value={{ openCustomer }}>{ui}</GcCustomerOpenerContext.Provider>
    </GcCompanyOpenerContext.Provider>,
  )
const row = (stepId: string) => document.querySelector(`[data-board-step="${stepId}"]`) as HTMLElement

describe('GcFlowBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    board = fromFixtures('trade')
  })

  it('opens Trade partners on its list as it was, with By step one press away', () => {
    withOpeners(<GcFlowBoard kind="trade" by="list" list={<p>The list as it was</p>} {...page} />)
    expect(screen.getByText('The list as it was')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'By step' }))
    expect(page.onBy).toHaveBeenCalledWith('step')
  })

  it('opens a trade partner’s window on its Flow tab, and the row’s nudge at the paper with its send', () => {
    withOpeners(<GcFlowBoard kind="trade" by="step" list={<p>The list as it was</p>} {...page} />)
    fireEvent.click(within(row('msa')).getByRole('button', { name: /^Kerr Electric/ }))
    expect(openPartner).toHaveBeenLastCalledWith('co-g5', { tab: 'flow' })
    fireEvent.click(within(row('compare')).getByRole('button', { name: /Tejas Power/ }))
    expect(openPartner).toHaveBeenLastCalledWith('co-bill', { tab: 'flow' })
    fireEvent.click(within(row('papers')).getByRole('button', { name: 'Ask the 4 for papers' }))
    expect(openPartner).toHaveBeenLastCalledWith('co-g4', { tab: 'documents', doc: 'w9', send: true })
  })

  it('sends the compare to its project’s card, Bill day to Money, Needs a hand to Follow up, and Invite a company to the list', () => {
    withOpeners(<GcFlowBoard kind="trade" by="step" list={<p>The list as it was</p>} {...page} />)
    fireEvent.click(within(row('compare')).getByRole('button', { name: 'Open the compare' }))
    expect(page.onOpenProject).toHaveBeenCalledWith('boerne')
    fireEvent.click(within(row('draws')).getByRole('button', { name: 'Bill day' }))
    expect(page.onBillDay).toHaveBeenCalledWith('stoneoak')
    fireEvent.click(screen.getByText('Needs a hand today'))
    expect(page.onFollowUp).toHaveBeenCalled()
    fireEvent.click(within(row('invited')).getByRole('button', { name: 'Invite a company' }))
    expect(page.onBy).toHaveBeenCalledWith('list')
  })

  it('opens a customer’s own window on its Flow tab, and has no list view for customers', () => {
    board = fromFixtures('customer')
    withOpeners(<GcFlowBoard kind="customer" by="list" {...page} />)
    expect(screen.queryByRole('button', { name: 'List' })).toBeNull()
    fireEvent.click(within(row('start')).getByRole('button', { name: /Helotes Dental Office/ }))
    expect(openCustomer).toHaveBeenCalledWith('cu-priya', { tab: 'flow' })
  })

  it('shows By company with the Portal column and By trade, each opening the company on its Flow tab', () => {
    const { unmount } = withOpeners(<GcFlowBoard kind="trade" by="company" list={<p>The list as it was</p>} {...page} />)
    expect(screen.getByRole('button', { name: 'By trade' })).toBeTruthy()
    fireEvent.click(within(document.querySelector('[data-board-company="bill"]') as HTMLElement).getByRole('button', { name: 'Open' }))
    expect(openPartner).toHaveBeenLastCalledWith('co-bill', { tab: 'flow' })
    unmount()
    withOpeners(<GcFlowBoard kind="trade" by="trade" list={<p>The list as it was</p>} {...page} />)
    fireEvent.click(within(document.querySelector('[data-board-trade="Structural steel"]') as HTMLElement).getByRole('button', { name: /Bexar Steel Erectors/ }))
    expect(openPartner).toHaveBeenLastCalledWith('co-tom', { tab: 'flow' })
  })

  it('says it is reading, and says what went wrong in words', () => {
    board = { ...fromFixtures('trade'), read: null, ctx: null, loading: true }
    const { unmount } = withOpeners(<GcFlowBoard kind="trade" by="step" list={<p>The list as it was</p>} {...page} />)
    expect(screen.getByText('Reading where everyone stands…')).toBeTruthy()
    unmount()
    board = { ...fromFixtures('trade'), read: null, ctx: null, error: 'You need to be on the office team to see this.' }
    withOpeners(<GcFlowBoard kind="trade" by="step" list={<p>The list as it was</p>} {...page} />)
    expect(screen.getByText('You need to be on the office team to see this.')).toBeTruthy()
  })
})
