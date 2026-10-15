// @vitest-environment jsdom
/**
 * The Customers list (v2.5557): a card per customer on a GC project with the person, the agreement, the portal and a row
 * per job; Open on the band, a job's name to its card, the step's own press, and the empty and reading words.
 */
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FlowBoard } from '../../hooks/useFlowBoard'
import { contextFor, CUSTOMER_FLOW, CUSTOMERS } from '../../lib/flows/boardFixtures'
import type { GcCustomer, GcProject } from '../../lib/gc/types'
import { installDomShims } from '../../test/renderSmokeMocks'
import { GcCustomerOpenerContext } from './gcCustomerOpener'

installDomShims()

const ctx = contextFor(CUSTOMER_FLOW)
const read: FlowBoard = {
  flow: CUSTOMER_FLOW,
  ctx,
  read: { kind: 'customer', companies: CUSTOMERS, readings: {}, jobs: ctx.jobs, firstNames: ctx.firstNames, refs: Object.fromEntries(CUSTOMERS.map((c) => [c.contactId, { companyId: null, customerId: `cu-${c.contactId}` }])) },
  loading: false,
  error: null,
  refresh: () => undefined,
}
let board: FlowBoard = read
vi.mock('../../hooks/useFlowBoard', () => ({ useFlowBoard: () => board }))
vi.mock('../../lib/flows/flowsIo', () => ({ loadCustomerPageOpens: () => Promise.resolve({ 'cu-priya': new Date().toISOString() }) }))

const { GcCustomersList } = await import('./GcCustomersList')

const customer = (contactId: string): GcCustomer => {
  const c = CUSTOMERS.find((x) => x.contactId === contactId)!
  return { id: `cu-${contactId}`, name: c.name, contact: c.personName ?? '', phone: '(210) 555-0100', email: `${contactId}@example.com`, address: '100 Test St, San Antonio', payDays: null, retainagePct: null, portalOn: true, contacts: [], past: [] }
}
const project = (id: string, customerId: string, stage: GcProject['stage'] = 'building'): GcProject => ({ id, name: ctx.jobs[id]?.name ?? id, customerId, stage, closedOn: null, lostOn: null }) as unknown as GcProject
const customers = CUSTOMERS.map((c) => customer(c.contactId))
const projects = CUSTOMERS.flatMap((c) => c.jobIds.map((jobId) => project(jobId, `cu-${c.contactId}`, c.contactId === 'g9' ? 'pursuing' : 'building')))

const openCustomer = vi.fn()
const onOpenProject = vi.fn()
const onBillDay = vi.fn()
const draw = (cs = customers, ps = projects) =>
  render(
    <GcCustomerOpenerContext.Provider value={{ openCustomer }}>
      <GcCustomersList customers={cs} projects={ps} onOpenProject={onOpenProject} onBillDay={onBillDay} />
    </GcCustomerOpenerContext.Provider>,
  )
const card = (id: string) => (document.querySelector(`[data-customer-card="${id}"]`) as HTMLElement).parentElement as HTMLElement

describe('GcCustomersList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    board = read
  })

  it('draws a card per customer with the band, the facts line and a row per job, the summary over them', async () => {
    draw()
    expect(screen.getByRole('region', { name: 'Customers list' })).toBeTruthy()
    expect(screen.getByText('4 customers on GC projects · 1 over usual · 1 waiting on someone else · 1 off the flow')).toBeTruthy()
    expect([...document.querySelectorAll('[data-customer-card]')].map((e) => e.getAttribute('data-customer-card'))).toEqual(['cu-g9', 'cu-elena', 'cu-priya', 'cu-g8', 'cu-marcus'])
    const priya = card('cu-priya')
    expect(within(priya).getByText('Helotes Dental Office', { selector: 'strong' })).toBeTruthy()
    expect(within(priya).getByText('1 job')).toBeTruthy()
    expect(within(priya).getByText('all quiet')).toBeTruthy()
    expect(within(priya).getByText('Dr. Priya Raman · (210) 555-0100 · priya@example.com')).toBeTruthy()
    expect(within(priya).getByText('100 Test St, San Antonio')).toBeTruthy()
    expect(within(priya).getByText('not yet')).toBeTruthy()
    expect(await within(priya).findByText('today')).toBeTruthy()
    const row = priya.querySelector('[data-customer-job="helotes"]') as HTMLElement
    expect(within(row).getByText('Building')).toBeTruthy()
    expect(within(row).getByText('Change orders')).toBeTruthy()
    expect(within(row).getByText('· 2 d')).toBeTruthy()
    expect(within(row).getByRole('button', { name: 'Remind Priya' })).toBeTruthy()
    expect(within(card('cu-elena')).getByText('signed')).toBeTruthy()
    expect(within(card('cu-elena')).getByText('· waiting on Jonah')).toBeTruthy()
    const bell = card('cu-marcus')
    expect(within(bell).getByText('off the flow since Sep 29')).toBeTruthy()
    expect(within(bell).getByText('Declined our bid, went with another plumber.')).toBeTruthy()
    expect(within(bell).queryByRole('table')).toBeNull()
  })

  it('opens the customer from the band, a job’s card from its name, the step’s paper from its press, and the card when the step is ours', () => {
    draw()
    fireEvent.click(within(card('cu-priya')).getByRole('button', { name: 'Open' }))
    expect(openCustomer).toHaveBeenCalledWith('cu-priya', { tab: 'flow' })
    fireEvent.click(within(card('cu-priya')).getByRole('button', { name: 'Helotes Dental Office' }))
    expect(onOpenProject).toHaveBeenCalledWith('helotes')
    fireEvent.click(within(card('cu-priya')).getByRole('button', { name: 'Remind Priya' }))
    expect(openCustomer).toHaveBeenLastCalledWith('cu-priya', expect.objectContaining({ tab: expect.any(String) }))
    // Our bid is ours to move: the row offers the card.
    fireEvent.click(within(card('cu-g8')).getByRole('button', { name: 'Open the card' }))
    expect(onOpenProject).toHaveBeenLastCalledWith('oakhills')
  })

  it('says when nobody is on a GC project yet, and reads the flow in words until it lands', () => {
    const { unmount } = draw([], [])
    expect(screen.getByText('No customer on a GC project yet. Press New project to add the first.')).toBeTruthy()
    unmount()
    board = { ...read, read: null, ctx: null, loading: true }
    draw()
    expect(screen.getByText('Reading where everyone stands…')).toBeTruthy()
    expect(within(card('cu-priya')).getByRole('button', { name: 'Open the card' })).toBeTruthy()
  })
})
