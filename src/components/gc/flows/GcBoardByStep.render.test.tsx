// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BAND_NAMES_KEY } from '../../../lib/flows/bandNamesPref'
import { contextFor, CUSTOMER_FLOW, CUSTOMERS, TRADE_FLOW, TRADES } from '../../../lib/flows/boardFixtures'
import { installDomShims } from '../../../test/renderSmokeMocks'
import { BoardPickers, EveryStepSwitch, GcBoardByStep, type BoardPresses } from './GcBoardByStep'

installDomShims()

const presses = (): BoardPresses => ({ onCompany: vi.fn(), onRowPress: vi.fn(), onNeedsAHand: vi.fn() })
const row = (stepId: string) => document.querySelector(`[data-board-step="${stepId}"]`) as HTMLElement
const band = (name: string) => screen.getByRole('region', { name })
const today = () => document.querySelector('[data-board-today]') as HTMLElement
const clusters = (shape: 'dots' | 'names') => document.querySelectorAll(`[data-board-cluster="${shape}"]`).length

describe('GcBoardByStep', () => {
  beforeEach(() => window.localStorage.clear())

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
    expect(within(band('Quoting')).getByRole('button', { name: '5 companies, 1 late, 1 over usual' })).toBeTruthy()
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

  it('v2.6540 · with Every step off, the rows nobody is on fold to one line per band and the rows with someone on them stay', () => {
    render(<GcBoardByStep ctx={contextFor(TRADE_FLOW)} companies={TRADES} presses={presses()} everyStep={false} />)
    expect(row('invited')).toBeNull()
    expect(row('portal')).toBeNull()
    expect(within(band('Getting set up')).queryByText(/lands here\./)).toBeNull()
    expect(within(band('Getting set up')).getByText(/^Nobody on 2 steps: .+ · .+\.$/)).toBeTruthy()
    expect(row('papers')).toBeTruthy()
    expect(within(row('papers')).getByText('insurance expired')).toBeTruthy()
    expect(within(row('ask')).getByText('late 2 days')).toBeTruthy()
  })

  it('v2.6540 · the Every step switch reads its state and presses the other way', () => {
    const onChange = vi.fn()
    render(<EveryStepSwitch on onChange={onChange} />)
    const sw = screen.getByRole('switch', { name: 'Every step' })
    expect(sw.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(sw)
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('v2.6542 · the band head’s dots are one press that unfolds to the names, worst first, each a chip that opens its company, and Fold folds them back', () => {
    const p = presses()
    render(<GcBoardByStep ctx={contextFor(TRADE_FLOW)} companies={TRADES} presses={p} />)
    const quoting = band('Quoting')
    expect(quoting.querySelector('[data-board-cluster="dots"]')).toBeTruthy()
    expect(within(quoting).queryByRole('button', { name: 'Hillside Excavation: Asked to quote' })).toBeNull()
    const dots = within(quoting).getByRole('button', { name: '5 companies, 1 late, 1 over usual' })
    expect(dots.querySelectorAll('span').length).toBe(5)
    expect((dots.querySelector('span') as HTMLElement).style.width).toBe('16px')
    fireEvent.click(dots)
    expect(quoting.querySelector('[data-board-cluster="dots"]')).toBeNull()
    const chips = within(within(quoting).getByRole('group', { name: '5 companies, 1 late, 1 over usual' })).getAllByRole('button')
    expect(chips.map((c) => c.getAttribute('aria-label') ?? c.textContent)).toEqual(['Fold', 'Hillside Excavation: Asked to quote', 'Tejas Power: Compared', 'Lone Star Mechanical: Asked to quote', 'Kerr Electric: Asked to quote', 'Cibolo Fence: Asked to quote'])
    fireEvent.click(chips[1]!)
    expect(p.onCompany).toHaveBeenCalledWith(expect.objectContaining({ contactId: 'greg', jobId: 'boerne', step: expect.objectContaining({ id: 'ask' }) }))
    fireEvent.click(within(quoting).getByRole('button', { name: 'Fold' }))
    expect(quoting.querySelector('[data-board-cluster="dots"]')).toBeTruthy()
    expect(within(quoting).queryByRole('button', { name: 'Hillside Excavation: Asked to quote' })).toBeNull()
    expect(p.onCompany).toHaveBeenCalledTimes(1)
  })

  it('v2.6542 · one press changes every band, the board keeps the state on the device, and absent reads as dots; the Every step fold is untouched', () => {
    const { unmount } = render(<GcBoardByStep ctx={contextFor(TRADE_FLOW)} companies={TRADES} presses={presses()} everyStep={false} />)
    expect([clusters('dots'), clusters('names')]).toEqual([3, 0])
    fireEvent.click(within(band('Quoting')).getByRole('button', { name: '5 companies, 1 late, 1 over usual' }))
    expect([clusters('dots'), clusters('names')]).toEqual([0, 3])
    expect(window.localStorage.getItem(BAND_NAMES_KEY)).toBe('1')
    expect(document.querySelector('[data-board-folded="setup"]')).toBeTruthy()
    unmount()
    render(<GcBoardByStep ctx={contextFor(TRADE_FLOW)} companies={TRADES} presses={presses()} />)
    expect([clusters('dots'), clusters('names')]).toEqual([0, 3])
    fireEvent.click(within(band('Building')).getByRole('button', { name: 'Fold' }))
    expect([clusters('dots'), clusters('names')]).toEqual([3, 0])
    expect(window.localStorage.getItem(BAND_NAMES_KEY)).toBe('0')
  })

  it('opens a company from its chip and from its name on the band head, gives each row its own press, and opens Follow up from the today line', () => {
    const p = presses()
    render(<GcBoardByStep ctx={contextFor(TRADE_FLOW)} companies={TRADES} presses={p} />)
    fireEvent.click(within(row('compare')).getByRole('button', { name: /Tejas Power/ }))
    expect(p.onCompany).toHaveBeenCalledWith(expect.objectContaining({ contactId: 'bill', step: expect.objectContaining({ id: 'compare' }) }))
    fireEvent.click(within(band('Quoting')).getByRole('button', { name: '5 companies, 1 late, 1 over usual' }))
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
