// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { contextFor, CUSTOMER_FLOW, CUSTOMERS, TRADE_FLOW, TRADES } from '../../../lib/flows/boardFixtures'
import { installDomShims } from '../../../test/renderSmokeMocks'
import { GcBoardByStep, type BoardPresses } from './GcBoardByStep'

installDomShims()

const presses = (): BoardPresses => ({ onCompany: vi.fn(), onRowPress: vi.fn(), onNeedsAHand: vi.fn() })
const row = (stepId: string) => document.querySelector(`[data-board-step="${stepId}"]`) as HTMLElement

describe('GcBoardByStep', () => {
  it('draws the tiles: a phase per tile with its companies, Off the flow, and Needs a hand', () => {
    render(<GcBoardByStep ctx={contextFor(TRADE_FLOW)} companies={TRADES} presses={presses()} />)
    const tiles = screen.getByRole('group', { name: 'Where everyone stands' })
    expect(within(tiles).getByText('Getting set up')).toBeTruthy()
    expect(within(tiles).getByText(/Quoting · on 2 bids/)).toBeTruthy()
    expect(within(tiles).getByText(/Building · on Stone Oak Pharmacy/)).toBeTruthy()
    expect(within(tiles).getByText('Off the flow')).toBeTruthy()
    expect(within(tiles).getByText('Needs a hand today')).toBeTruthy()
    expect(within(tiles).getByText('1 late')).toBeTruthy()
    expect(within(tiles).getByText('3 over usual')).toBeTruthy()
  })

  it('draws a row per step with its count and usual, the chips by job, and the folded empty steps', () => {
    render(<GcBoardByStep ctx={contextFor(TRADE_FLOW)} companies={TRADES} presses={presses()} />)
    expect(within(row('papers')).getByText('4 · 1 lapsed · 2 over usual · usually 3 d')).toBeTruthy()
    expect(within(row('papers')).getByText('insurance expired')).toBeTruthy()
    expect(within(row('ask')).getByText('Boerne Retail Shell · due Thu')).toBeTruthy()
    expect(within(row('ask')).getByText('late 2 days')).toBeTruthy()
    expect(within(row('invited')).getByText('Invited · Portal opened')).toBeTruthy()
    expect(within(row('invited')).getByText('A new invitation lands here.')).toBeTruthy()
    expect(within(row('closeout')).getByText("A trade's final waiver lands here.")).toBeTruthy()
  })

  it('opens a company from its chip and from its dot, and gives each row its own press', () => {
    const p = presses()
    render(<GcBoardByStep ctx={contextFor(TRADE_FLOW)} companies={TRADES} presses={p} />)
    fireEvent.click(within(row('compare')).getByRole('button', { name: /Tejas Power/ }))
    expect(p.onCompany).toHaveBeenCalledWith(expect.objectContaining({ contactId: 'bill', step: expect.objectContaining({ id: 'compare' }) }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Hillside Excavation: Asked to quote' })[0]!)
    expect(p.onCompany).toHaveBeenLastCalledWith(expect.objectContaining({ contactId: 'greg', jobId: 'boerne' }))
    fireEvent.click(within(row('papers')).getByRole('button', { name: 'Ask the 4 for papers' }))
    expect(p.onRowPress).toHaveBeenCalledWith(expect.objectContaining({ id: 'papers' }), expect.objectContaining({ kind: 'nudge', contactIds: ['g4', 'tom', 'greg', 'g3'] }), expect.any(Array))
    fireEvent.click(within(row('draws')).getByRole('button', { name: 'Bill day' }))
    expect(p.onRowPress).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'draws' }), { kind: 'bill-day', label: 'Bill day' }, expect.any(Array))
    fireEvent.click(screen.getByText('Needs a hand today'))
    expect(p.onNeedsAHand).toHaveBeenCalled()
  })

  it('narrows every row and tile to one job, and shows the companies off the flow on a press', () => {
    render(<GcBoardByStep ctx={contextFor(TRADE_FLOW)} companies={TRADES} presses={presses()} />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Which job' }), { target: { value: 'padb' } })
    expect(within(row('ask')).queryByText('Boerne Retail Shell · due Thu')).toBeNull()
    expect(within(row('ask')).getByText('Boerne Retail Pad B · due Oct 22')).toBeTruthy()
    expect(within(row('papers')).queryByRole('button', { name: /Bexar Steel Erectors/ })).toBeNull()
    fireEvent.change(screen.getByRole('combobox', { name: 'Which job' }), { target: { value: '' } })
    expect(within(row('off')).queryByText('Hill Country Paving')).toBeNull()
    fireEvent.click(within(row('off')).getByRole('button', { name: 'show' }))
    expect(within(row('off')).getByText(/Hill Country Paving/)).toBeTruthy()
  })

  it('reads the customers in their own words, a waiting pay application with no nudge', () => {
    render(<GcBoardByStep ctx={contextFor(CUSTOMER_FLOW)} companies={CUSTOMERS} presses={presses()} />)
    expect(screen.getByText(/Bidding · on 2 jobs/)).toBeTruthy()
    expect(within(row('payapp')).getByText('waiting on Jonah')).toBeTruthy()
    expect(within(row('payapp')).queryByRole('button', { name: /Remind/ })).toBeNull()
    expect(within(row('co')).getByRole('button', { name: 'Remind Priya' })).toBeTruthy()
  })
})
