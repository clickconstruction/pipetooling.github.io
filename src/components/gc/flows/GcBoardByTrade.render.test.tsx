// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { contextFor, TRADE_FLOW, TRADES } from '../../../lib/flows/boardFixtures'
import { installDomShims } from '../../../test/renderSmokeMocks'
import { GcBoardByTrade } from './GcBoardByTrade'

installDomShims()

const row = (trade: string) => document.querySelector(`[data-board-trade="${trade}"]`) as HTMLElement

describe('GcBoardByTrade', () => {
  it('reads one row per trade, A to Z, each company with its step, its job and its day, late first and off the flow last', () => {
    render(<GcBoardByTrade ctx={contextFor(TRADE_FLOW)} companies={TRADES} onOpen={vi.fn()} />)
    const trades = [...document.querySelectorAll('[data-board-trade]')].map((el) => el.getAttribute('data-board-trade'))
    expect(trades).toEqual(['Drywall', 'Electrical', 'Fencing', 'Low voltage', 'Mechanical', 'Paving', 'Sitework', 'Structural steel'])
    expect(within(row('Sitework')).getByText('1 company · 1 on a job · 1 late · 1 lapsed')).toBeTruthy()
    expect(within(row('Sitework')).getByRole('button', { name: /Hillside Excavation · Asked to quote · Boerne Retail Shell late 2 days/ })).toBeTruthy()
    const paving = within(row('Paving')).getAllByRole('button').map((b) => b.textContent)
    expect(paving).toEqual(['Rio Paving · Statement of work · Stone Oak Pharmacy1 d', 'Hill Country Pavingoff the flow'])
  })

  it('opens a company at the step its chip shows', () => {
    const onOpen = vi.fn()
    render(<GcBoardByTrade ctx={contextFor(TRADE_FLOW)} companies={TRADES} onOpen={onOpen} />)
    fireEvent.click(within(row('Fencing')).getByRole('button', { name: /Cibolo Fence/ }))
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ contactId: 'g4', step: expect.objectContaining({ id: 'papers' }) }))
    expect(screen.getAllByRole('button', { name: /Tejas Power/ })).toHaveLength(2)
  })

  it('an empty board says so and offers the views row’s List where the board gives it (punch list #184)', () => {
    const onList = vi.fn()
    render(<GcBoardByTrade ctx={contextFor(TRADE_FLOW)} companies={[]} onOpen={vi.fn()} onList={onList} />)
    expect((document.querySelector('[data-empty-state]') as HTMLElement).textContent).toBe('No trade partner yet. List shows everyone we work with.')
    fireEvent.click(screen.getByRole('button', { name: 'List' }))
    expect(onList).toHaveBeenCalledTimes(1)
  })
})
