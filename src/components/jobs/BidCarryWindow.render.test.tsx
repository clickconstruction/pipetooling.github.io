// @vitest-environment jsdom
/**
 * Render smoke for the carry window (punch list #397, PR 3): the three answers, the press that
 * names each, the chips, and what goes back to the job form. Nothing here writes.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { AwardBidBreakdown } from '../../lib/jobs/awardBaseline'
import { DEFAULT_LINE_BUDGET_SETTINGS } from '../../lib/jobs/lineBudgets'
import { BidCarryWindow, type BidCarryAnswer, type BidCarryAsk } from './BidCarryWindow'

afterEach(cleanup)

const breakdown: AwardBidBreakdown = {
  has_estimate: true,
  labor_hours: 480,
  labor_rate: 45,
  labor_usd: 21_600,
  materials_usd: 14_400,
  completeness: { rows_total: 10, rows_with_hours: 10, rate_set: true, usable: true },
  labor_hours_by_stage: { rough: 210, top: 150, trim: 120 },
}

const ask = (over: Partial<BidCarryAsk> = {}): BidCarryAsk => ({
  carryValue: 48_000,
  agreedValue: 48_000,
  bid: { bid_number: '482', project_name: 'Oak Ridge' },
  gcName: 'Ridgeway Builders',
  schedule: null,
  breakdown,
  customerType: 'commercial',
  settings: DEFAULT_LINE_BUDGET_SETTINGS,
  ...over,
})

const open = (over: Partial<BidCarryAsk> = {}) => {
  const onAnswer = vi.fn<(answer: BidCarryAnswer) => void>()
  render(<BidCarryWindow ask={ask(over)} onAnswer={onAnswer} />)
  return onAnswer
}
const confirm = () => screen.getByTestId('bid-carry-confirm')
const rows = () => screen.getAllByTestId('bid-carry-row').map((r) => r.textContent)

describe('BidCarryWindow', () => {
  it('opens on stages, split by the company’s terms, with each stage’s hours from the bid', () => {
    open()
    expect(screen.getByRole('dialog').textContent).toContain('How should $48,000 come onto the job?')
    expect(screen.getByRole('dialog').textContent).toContain('That is B482 · Oak Ridge’s agreed value.')
    // The bid says 210, 150 and 120 h. A line keeps its labor as a whole percent of its price, so it reads within a couple of hours.
    expect(rows()).toEqual(['Rough In211 h$14,400.00', 'Top Out150 h$14,400.00', 'Trim Set122 h$14,400.00', 'Finalno hours$4,800.00'])
    expect(screen.getByTestId('bid-carry-total').textContent).toBe('$48,000.00')
    expect(screen.getByRole('dialog').textContent).toContain('Dollars: the company’s 30/30/30/10. Hours: B482 · Oak Ridge’s Labor tab. Each line arrives Any time.')
    expect(confirm().textContent).toBe('Bring 4 stages · $48,000')
  })

  it('hands back the stage lines, every one Any time, adding up to the price', () => {
    const onAnswer = open()
    fireEvent.click(confirm())
    expect(onAnswer).toHaveBeenCalledTimes(1)
    const answer = onAnswer.mock.calls[0]![0]
    expect(answer.choice).toBe('stages')
    if (answer.choice !== 'stages') return
    expect(answer.lines.map((l) => l.name)).toEqual(['Rough In', 'Top Out', 'Trim Set', 'Final'])
    expect(answer.lines.every((l) => l.stage_kind === 'any' && l.invoice_id === null)).toBe(true)
    expect(answer.lines.reduce((t, l) => t + l.line_unit_price, 0)).toBe(48_000)
  })

  it('lights the other split when its chip is pressed, and the press follows', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Residential 40/40/20' }))
    expect(rows().map((r) => r!.replace(/\d+ h/, ''))).toEqual(['Rough In$19,200.00', 'Top Out$19,200.00', 'Trim Set$9,600.00'])
    expect(confirm().textContent).toBe('Bring 3 stages · $48,000')
    expect(screen.getByRole('button', { name: 'Residential 40/40/20' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('starts a residential customer on 40/40/20', () => {
    open({ customerType: 'residential' })
    expect(confirm().textContent).toBe('Bring 3 stages · $48,000')
  })

  it('offers the bid’s own schedule first when it has one', () => {
    const line = (label: string, scheduledValue: number) => ({ id: label, label, scheduledValue, labor: null, stage: null, fromPrevious: 0, thisPeriod: 0, stored: 0 })
    open({ schedule: { lines: [line('Underground', 12_000), line('Rough In', 36_000)], splitLaborMaterial: false, shape: 'lines' } })
    expect(screen.getByRole('button', { name: 'The bid’s schedule' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('dialog').textContent).toContain('Dollars: B482 · Oak Ridge’s schedule of values.')
    expect(confirm().textContent).toBe('Bring 2 stages · $48,000')
  })

  it('carries one line, as the old Yes did', () => {
    const onAnswer = open()
    fireEvent.click(screen.getByTestId('bid-carry-one'))
    expect(confirm().textContent).toBe('Carry $48,000 over')
    fireEvent.click(confirm())
    expect(onAnswer).toHaveBeenCalledWith({ choice: 'one' })
  })

  it('starts at $0, as the old No did', () => {
    const onAnswer = open()
    fireEvent.click(screen.getByTestId('bid-carry-zero'))
    expect(confirm().textContent).toBe('Start at $0')
    fireEvent.click(confirm())
    expect(onAnswer).toHaveBeenCalledWith({ choice: 'zero' })
  })

  it('cancels the import by its press and by Escape', () => {
    const onAnswer = open()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel import' }))
    expect(onAnswer).toHaveBeenLastCalledWith({ choice: 'cancel' })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onAnswer).toHaveBeenCalledTimes(2)
    expect(onAnswer).toHaveBeenLastCalledWith({ choice: 'cancel' })
  })

  it('says the hours are assumed when the bid cannot give them, and why', () => {
    open({ breakdown: null })
    expect(screen.getByRole('dialog').textContent).toContain('Hours: assumed from the company’s split. B482 has no cost estimate.')
    expect(rows()[0]).toContain('≈ ')
  })

  it('says a carried figure is recorded on the bid when the bid has no agreed value, and not when the job starts at $0', () => {
    open({ agreedValue: null })
    const text = () => screen.getByRole('dialog').textContent ?? ''
    expect(text()).toContain('That is what Ridgeway Builders was sent on B482 · Oak Ridge.')
    expect(text()).toContain('Bringing it over also records it on the bid as the agreed value.')
    fireEvent.click(screen.getByTestId('bid-carry-zero'))
    expect(text()).not.toContain('records it on the bid')
  })
})
