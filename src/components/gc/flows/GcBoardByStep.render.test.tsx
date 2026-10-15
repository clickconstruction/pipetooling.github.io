// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { contextFor, CUSTOMER_FLOW, CUSTOMERS, TRADE_FLOW, TRADES } from '../../../lib/flows/boardFixtures'
import { installDomShims } from '../../../test/renderSmokeMocks'
import { BoardPickers, GcBoardByStep, type BoardPresses } from './GcBoardByStep'

installDomShims()

const presses = (): BoardPresses => ({ onCompany: vi.fn(), onRowPress: vi.fn(), onNeedsAHand: vi.fn() })
const row = (stepId: string) => document.querySelector(`[data-board-step="${stepId}"]`) as HTMLElement
const band = (name: string) => screen.getByRole('region', { name })
const today = () => document.querySelector('[data-board-today]') as HTMLElement

describe('GcBoardByStep', () => {
  it('v2.5555 · draws the today line, then a band per phase with its count, its jobs, late and lapsed, its dots and its lanes', () => {
    render(<GcBoardByStep ctx={contextFor(TRADE_FLOW)} companies={TRADES} presses={presses()} />)
    expect(today().getAttribute('data-board-today')).toBe('loud')
    expect(today().textContent).toContain('Hillside Excavation needs a hand today: late 2 days on Asked to quote.')
    expect(today().textContent).toContain('3 over usual.')
    expect(today().textContent).toContain('2 off the flow.')
    expect(screen.getByRole('group', { name: 'Where everyone stands' })).toBeTruthy()
    expect([...document.querySelectorAll('[data-board-band]')].map((e) => e.getAttribute('data-board-band'))).toEqual(['setup', 'pricing', 'building'])
    expect(within(band('Getting set up')).getByText('5 companies')).toBeTruthy()
    expect(within(band('Getting set up')).getByText('the steps a company goes through once')).toBeTruthy()
    expect(within(band('Getting set up')).getByText('1 lapsed')).toBeTruthy()
    expect(within(band('Quoting')).getByText('on 2 bids')).toBeTruthy()
    expect(within(band('Quoting')).getByText('1 late')).toBeTruthy()
    expect(within(band('Quoting')).getByRole('button', { name: 'Hillside Excavation: Asked to quote' })).toBeTruthy()
    expect(within(band('Building')).getByText('on Stone Oak Pharmacy')).toBeTruthy()
    expect(within(band('Building')).getByText('once per job')).toBeTruthy()
  })

  it('keeps every step on its own row, whose move and the usual under its name, and says what lands on an empty one', () => {
    render(<GcBoardByStep ctx={contextFor(TRADE_FLOW)} companies={TRADES} presses={presses()} />)
    expect(within(band('Getting set up')).getAllByText(/lands here\./).length).toBe(2)
    expect(within(row('invited')).getByText('A new invitation lands here.')).toBeTruthy()
    expect(within(row('portal')).getByText('A company that opens its link lands here.')).toBeTruthy()
    expect(within(row('closeout')).getByText("A trade's final waiver lands here.")).toBeTruthy()
    expect(within(row('papers')).getByText(/1 lapsed · 2 over usual · usually 3 d$/)).toBeTruthy()
    expect(within(row('papers')).getByText('insurance expired')).toBeTruthy()
    expect(within(row('ask')).getByText('Boerne Retail Shell · due Thu')).toBeTruthy()
    expect(within(row('ask')).getByText('late 2 days')).toBeTruthy()
  })

  it('opens a company from its chip and from its dot, gives each row its own press, and opens Follow up from the today line', () => {
    const p = presses()
    render(<GcBoardByStep ctx={contextFor(TRADE_FLOW)} companies={TRADES} presses={p} />)
    fireEvent.click(within(row('compare')).getByRole('button', { name: /Tejas Power/ }))
    expect(p.onCompany).toHaveBeenCalledWith(expect.objectContaining({ contactId: 'bill', step: expect.objectContaining({ id: 'compare' }) }))
    fireEvent.click(screen.getByRole('button', { name: 'Hillside Excavation: Asked to quote' }))
    expect(p.onCompany).toHaveBeenLastCalledWith(expect.objectContaining({ contactId: 'greg', jobId: 'boerne' }))
    fireEvent.click(within(row('papers')).getByRole('button', { name: 'Ask the 4 for papers' }))
    expect(p.onRowPress).toHaveBeenCalledWith(expect.objectContaining({ id: 'papers' }), expect.objectContaining({ kind: 'nudge', contactIds: ['g4', 'tom', 'greg', 'g3'] }), expect.any(Array))
    fireEvent.click(within(row('draws')).getByRole('button', { name: 'Bill day' }))
    expect(p.onRowPress).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'draws' }), { kind: 'bill-day', label: 'Bill day' }, expect.any(Array))
    fireEvent.click(screen.getByRole('button', { name: 'Open Follow up →' }))
    expect(p.onNeedsAHand).toHaveBeenCalled()
  })

  it('lists the companies off the flow in a band at the foot, and narrows every row and band through the filter', () => {
    const { rerender } = render(<GcBoardByStep ctx={contextFor(TRADE_FLOW)} companies={TRADES} presses={presses()} />)
    expect(within(band('Off the flow')).getByText(/Hill Country Paving/)).toBeTruthy()
    expect(within(band('Off the flow')).getByText(/Medina Drywall/)).toBeTruthy()
    rerender(<GcBoardByStep ctx={contextFor(TRADE_FLOW)} companies={TRADES} presses={presses()} filter={{ jobId: 'padb', seat: null }} />)
    expect(within(row('ask')).queryByText('Boerne Retail Shell · due Thu')).toBeNull()
    expect(within(row('ask')).getByText('Boerne Retail Pad B · due Oct 22')).toBeTruthy()
    expect(within(row('papers')).queryByRole('button', { name: /Bexar Steel Erectors/ })).toBeNull()
  })

  it('the pickers are a real select each, with the chevron drawn inside, narrowing through onFilter', () => {
    const onFilter = vi.fn()
    render(<BoardPickers ctx={contextFor(CUSTOMER_FLOW)} companies={CUSTOMERS} filter={{ jobId: null, seat: null }} onFilter={onFilter} />)
    const job = screen.getByRole('combobox', { name: 'Which job' })
    expect(job.tagName).toBe('SELECT')
    expect((job as HTMLSelectElement).style.appearance).toBe('none')
    fireEvent.change(job, { target: { value: (job as HTMLSelectElement).options[1]!.value } })
    expect(onFilter).toHaveBeenCalledWith({ jobId: (job as HTMLSelectElement).options[1]!.value, seat: null })
    fireEvent.change(screen.getByRole('combobox', { name: 'Whose seat' }), { target: { value: 'Rosa' } })
    expect(onFilter).toHaveBeenLastCalledWith({ jobId: null, seat: 'Rosa' })
  })

  it('reads the customers in their own words: a quiet today line, the bands’ counts, a waiting pay application with no nudge', () => {
    render(<GcBoardByStep ctx={contextFor(CUSTOMER_FLOW)} companies={CUSTOMERS} presses={presses()} />)
    expect(today().getAttribute('data-board-today')).toBe('quiet')
    expect(today().textContent).toContain('Nobody needs a hand today.')
    expect(today().textContent).toContain('1 waiting on someone else.')
    expect(within(band('Setting up')).getByText('0 customers')).toBeTruthy()
    expect(within(band('Bidding')).getByText('2 customers')).toBeTruthy()
    expect(within(band('Bidding')).getByText('on 2 jobs')).toBeTruthy()
    expect(within(row('payapp')).getByText('waiting on Jonah')).toBeTruthy()
    expect(within(row('payapp')).getByText(/^both of us/)).toBeTruthy()
    expect(within(row('payapp')).queryByRole('button', { name: /Remind/ })).toBeNull()
    expect(within(row('co')).getByRole('button', { name: 'Remind Priya' })).toBeTruthy()
  })
})
