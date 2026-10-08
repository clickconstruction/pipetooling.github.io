// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { GcBoard } from './GcBoard'
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
    fireEvent.click(within(card).getByRole('button', { name: 'Open the project' }))
    expect(onOpen).toHaveBeenCalledWith('p1')
  })
})
