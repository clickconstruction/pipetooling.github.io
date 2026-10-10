// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { GcOurNumber } from './GcOurNumber'
import { boardStateFromRows } from '../../lib/gc/boardRows'
import { clinicBoardRows } from '../../lib/gc/boardTestRows'
import { installDomShims } from '../../test/renderSmokeMocks'
import { proposalWeeksWords, roughWeeks } from '../../lib/gc/schedule/rough'
import type { GcProject } from '../../lib/gc/types'

installDomShims()

/** The clinic with Lonestar's quote carried on sitework: $52,000 plus the $9,000 cost to cover paving. */
function carriedState() {
  const base = clinicBoardRows()
  return boardStateFromRows({ ...base, projects: base.projects.map((p) => ({ ...p, trades: p.trades.map((t) => (t.id === 'k1' ? { ...t, carriedInviteId: 'i1' } : t)) })) })
}

function open(onSave = vi.fn(() => Promise.resolve())) {
  const state = carriedState()
  render(<GcOurNumber state={state} project={state.projects[0]!} onSave={onSave} />)
  return { onSave, panel: document.querySelector('[data-gc-our-number="p1"]') as HTMLElement }
}

describe('GcOurNumber', () => {
  it('adds our costs and fee to the trades we carry, and names each hole', () => {
    const { panel } = open()
    // $61,000 of trades, $12,000 of general conditions, 3% contingency ($2,190), 8% fee ($6,015).
    // The trades' total, and sitework's carried number in the table.
    expect(within(panel).getAllByText('$61,000')).toHaveLength(2)
    expect(within(panel).getByText('$2,190')).toBeTruthy()
    expect(within(panel).getByText('$6,015')).toBeTruthy()
    expect(within(panel).getByText('Price to Oak Street Partners')).toBeTruthy()
    expect(within(panel).getByText('$81,205')).toBeTruthy()
    expect(within(panel).getByText('Concrete: no number')).toBeTruthy()
    expect(within(panel).getByText('Plumbing: no number')).toBeTruthy()
    expect(within(panel).getByText('Lonestar Earthworks')).toBeTruthy()
    expect(within(panel).getByText('ours · not priced yet')).toBeTruthy()
  })

  it('saves a box on blur or Enter with the other two as they stand, never on each key', async () => {
    const { onSave, panel } = open()
    const fee = within(panel).getByLabelText('Fee')
    fireEvent.change(fee, { target: { value: '10' } })
    expect(onSave).not.toHaveBeenCalled()
    fireEvent.blur(fee)
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ generalConditions: 12000, contingencyPct: 3, feePct: 10 }))
    const gc = within(panel).getByLabelText('General conditions')
    fireEvent.change(gc, { target: { value: '15000' } })
    fireEvent.keyDown(gc, { key: 'Enter' })
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ generalConditions: 15000, contingencyPct: 3, feePct: 8 }))
  })

  it('refuses a percent over 100 and says why, and shows a save that failed', async () => {
    const onSave = vi.fn(() => Promise.reject(new Error('Could not save our number.')))
    const { panel } = open(onSave)
    const contingency = within(panel).getByLabelText('Contingency')
    fireEvent.change(contingency, { target: { value: '140' } })
    fireEvent.blur(contingency)
    expect(screen.getByText('Type a number from 0 to 100.')).toBeTruthy()
    expect(onSave).not.toHaveBeenCalled()
    fireEvent.change(contingency, { target: { value: '5' } })
    fireEvent.blur(contingency)
    expect(await screen.findByText('Could not save our number.')).toBeTruthy()
  })
})

describe('GcOurNumber: weeks to build from the rough (the schedule’s PR 12b, G-45)', () => {
  const weeksBlock = () => document.querySelector('[data-tour="gc-bid-weeks"]') as HTMLElement | null
  function openWith(change: (p: GcProject) => GcProject) {
    const state = carriedState()
    const project = change(state.projects[0]!)
    render(<GcOurNumber state={state} project={project} onSave={vi.fn(() => Promise.resolve())} />)
    return project
  }

  it('says the weeks are not drawn yet while we bid with no rough, after the price card’s own rows', () => {
    openWith((p) => ({ ...p, stage: 'pursuing' }))
    expect(within(weeksBlock()!).getByText('not drawn')).toBeTruthy()
    expect(within(weeksBlock()!).getByText('Weeks to build: not drawn yet. Draw a rough schedule from the project’s Schedule.'.replace('’', "'"))).toBeTruthy()
    // After the price card's own rows, not between them.
    const panel = document.querySelector('[data-gc-our-number="p1"]') as HTMLElement
    const texts = [...panel.querySelectorAll('*')].map((el) => el.getAttribute('data-tour') ?? el.textContent)
    expect(texts.indexOf('gc-bid-weeks')).toBeGreaterThan(texts.findIndex((t) => t?.startsWith('Price to')))
  })

  it('says the weeks from the rough and the proposal’s line, with Copy', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const project = openWith((p) => ({ ...p, stage: 'pursuing', rough: { start: '2026-11-02', days: {}, by: 'Robert', on: '2026-10-01' } }))
    const weeks = roughWeeks(project)!
    expect(within(weeksBlock()!).getByText(String(weeks.weeks))).toBeTruthy()
    expect(within(weeksBlock()!).getByText(proposalWeeksWords(project)!)).toBeTruthy()
    fireEvent.click(within(weeksBlock()!).getByRole('button', { name: 'Copy' }))
    expect(writeText).toHaveBeenCalledWith(proposalWeeksWords(project))
    expect(await within(weeksBlock()!).findByRole('button', { name: 'Copied' })).toBeTruthy()
  })

  it('shows no weeks past bidding with no rough', () => {
    openWith((p) => ({ ...p, stage: 'buyout' }))
    expect(weeksBlock()).toBeNull()
  })
})
