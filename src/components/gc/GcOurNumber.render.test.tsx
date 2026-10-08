// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { GcOurNumber } from './GcOurNumber'
import { boardStateFromRows } from '../../lib/gc/boardRows'
import { clinicBoardRows } from '../../lib/gc/boardTestRows'
import { installDomShims } from '../../test/renderSmokeMocks'

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
