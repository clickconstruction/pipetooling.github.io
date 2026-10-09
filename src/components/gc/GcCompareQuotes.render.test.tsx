// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { GcCompareQuotes, type CompareWrites } from './GcCompareQuotes'
import { boardStateFromRows, type BoardRows } from '../../lib/gc/boardRows'
import { clinicBoardRows } from '../../lib/gc/boardTestRows'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()

function writes(): CompareWrites {
  return { setPlugs: vi.fn(() => Promise.resolve()), setCovers: vi.fn(() => Promise.resolve()), setTakenAlternates: vi.fn(() => Promise.resolve()), carry: vi.fn(() => Promise.resolve()) }
}

/**
 * The clinic's sitework with both companies quoting: Lonestar at $52,000 leaving paving out (a $9,000
 * plug), excluding dewatering and offering an alternate; Hillside at $60,000 with everything in.
 */
function rows(over: Partial<BoardRows> = {}): BoardRows {
  const base = clinicBoardRows()
  return {
    ...base,
    invites: base.invites.map((i) => (i.id === 'i2' ? { ...i, status: 'bid' } : i)),
    quotes: [
      ...base.quotes.map((q) => (q.id === 'q1' ? { ...q, exclusions: [{ name: 'Dewatering' }], alternates: [{ label: 'Thicker base', amount: 3000 }] } : q)),
      { id: 'q2', invite_id: 'i2', amount: 60000, based_on_rev: 0, submitted_on: '2026-10-06', includes: { s1: 'yes', s2: 'yes' }, note: '', good_for_days: null, alternates: [], quote_file: '', exclusions: null, exclusions_answered: ['Dewatering'], created_at: '2026-10-06T10:00:00Z' },
    ],
    ...over,
  }
}

function open(state = boardStateFromRows(rows()), w = writes()) {
  render(<GcCompareQuotes state={state} projectId="p1" packageId="k1" writes={w} onClose={() => undefined} />)
  return { w, dialog: screen.getByRole('dialog', { name: 'Compare Sitework quotes' }) }
}

describe('GcCompareQuotes', () => {
  it('puts both quotes side by side, with the cost to cover what one leaves out in its all-in number', () => {
    const { dialog } = open()
    expect(within(dialog).getByText('Lonestar Earthworks')).toBeTruthy()
    expect(within(dialog).getByText('Hillside Excavation')).toBeTruthy()
    expect(within(dialog).getByText('$52,000')).toBeTruthy()
    expect((within(dialog).getByLabelText('Cost to cover Paving in Lonestar Earthworks') as HTMLInputElement).value).toBe('9000')
    expect(dialog.querySelector('[data-gc-all-in="i1"]')?.textContent).toMatch(/\$61,000/)
    expect(dialog.querySelector('[data-gc-all-in="i2"]')?.textContent).toMatch(/\$60,000/)
  })

  it('saves a cost to cover a line when the box loses focus, not on each key', async () => {
    const { w, dialog } = open()
    const box = within(dialog).getByLabelText('Cost to cover Paving in Lonestar Earthworks')
    fireEvent.change(box, { target: { value: '5000' } })
    expect(w.setPlugs).not.toHaveBeenCalled()
    fireEvent.blur(box)
    await waitFor(() => expect(w.setPlugs).toHaveBeenCalledWith('i1', { s2: 5000 }))
  })

  it('shows each company’s answer on an exclusion and saves a cost to cover it', async () => {
    const { w, dialog } = open()
    expect(within(dialog).getByText('Dewatering')).toBeTruthy()
    expect(within(dialog).getByText('excluded')).toBeTruthy()
    expect(within(dialog).getByText('✓ included')).toBeTruthy()
    const cover = within(dialog).getByLabelText('Cost to cover Dewatering in Lonestar Earthworks')
    fireEvent.change(cover, { target: { value: '2500' } })
    fireEvent.keyDown(cover, { key: 'Enter' })
    await waitFor(() => expect(w.setCovers).toHaveBeenCalledWith('i1', { Dewatering: 2500 }))
  })

  it('takes an alternate, and carries a quote or our budget', async () => {
    const { w, dialog } = open()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Take it' }))
    await waitFor(() => expect(w.setTakenAlternates).toHaveBeenCalledWith('i1', ['Thicker base']))
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Carry this number' })[1]!)
    await waitFor(() => expect(w.carry).toHaveBeenCalledWith('k1', { inviteId: 'i2' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Carry our budget of $60,000 instead' }))
    await waitFor(() => expect(w.carry).toHaveBeenCalledWith('k1', 'budget'))
  })

  it('reads Carrying on the carried quote, and offers no carry once the bid is lost', () => {
    const carried = rows()
    open(boardStateFromRows({ ...carried, projects: carried.projects.map((p) => ({ ...p, trades: p.trades.map((t) => (t.id === 'k1' ? { ...t, carriedInviteId: 'i2' } : t)) })) }))
    expect(screen.getByRole('button', { name: 'Carrying. Stop' })).toBeTruthy()
  })

  it('once the job is won, awards a quote with who decided, and a company the gate stops says why', async () => {
    const won = rows()
    const state = boardStateFromRows({ ...won, projects: won.projects.map((p) => ({ ...p, stage: 'buyout' })) })
    const w = { ...writes(), award: vi.fn(() => Promise.resolve()) }
    render(<GcCompareQuotes state={state} projectId="p1" packageId="k1" writes={w} team={{ team: [{ id: 'u1', name: 'Rosa' }, { id: 'u2', name: 'Sam' }], me: 'u2' }} onClose={() => undefined} />)
    const dialog = screen.getByRole('dialog', { name: 'Compare Sitework quotes' })
    expect(within(dialog).queryByRole('button', { name: 'Carry this number' })).toBeNull()
    const lonestar = dialog.querySelector('[data-gc-award="i1"]') as HTMLElement
    const hillside = dialog.querySelector('[data-gc-award="i2"]') as HTMLElement
    expect((within(hillside).getByRole('button', { name: 'Award and draft the statement of work' }) as HTMLButtonElement).disabled).toBe(true)
    expect(within(hillside).getByText(/^Hillside Excavation is not vetted yet\./)).toBeTruthy()
    // The one pressing is named first; another estimator can be picked.
    expect((within(lonestar).getByLabelText('Estimator') as HTMLSelectElement).value).toBe('u2')
    fireEvent.change(within(lonestar).getByLabelText('Estimator'), { target: { value: 'u1' } })
    fireEvent.click(within(lonestar).getByRole('button', { name: 'Award and draft the statement of work' }))
    await waitFor(() => expect(w.award).toHaveBeenCalledWith('i1', 'u1'))
  })

  it('reads Awarded on the quote awarded, and holds the other quotes’ Award', () => {
    const won = rows()
    const awarded = boardStateFromRows({
      ...won,
      projects: won.projects.map((p) => ({ ...p, stage: 'buyout', trades: p.trades.map((t) => (t.id === 'k1' ? { ...t, awardedInviteId: 'i1', awardedOn: '2026-10-08' } : t)) })),
    })
    const { dialog } = open(awarded, { ...writes(), award: vi.fn(() => Promise.resolve()) })
    expect(within(dialog.querySelector('[data-gc-award="i1"]') as HTMLElement).getByText('Awarded')).toBeTruthy()
    expect((within(dialog.querySelector('[data-gc-award="i2"]') as HTMLElement).getByRole('button', { name: 'Award and draft the statement of work' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('offers no Award while we bid, nor to a reader who cannot award', () => {
    const { dialog } = open(boardStateFromRows(rows()), { ...writes(), award: vi.fn(() => Promise.resolve()) })
    expect(within(dialog).queryByRole('button', { name: 'Award and draft the statement of work' })).toBeNull()
    expect(within(dialog).getAllByRole('button', { name: 'Carry this number' }).length).toBe(2)
  })

  it('offers no Award to a reader without the award write, even once the job is won', () => {
    const won = rows()
    const { dialog } = open(boardStateFromRows({ ...won, projects: won.projects.map((p) => ({ ...p, stage: 'buyout' })) }))
    expect(within(dialog).queryByRole('button', { name: 'Award and draft the statement of work' })).toBeNull()
  })

  it('offers no carry on a lost bid', () => {
    const lost = rows()
    open(boardStateFromRows({ ...lost, projects: lost.projects.map((p) => ({ ...p, lostOn: '2026-10-07' })) }))
    expect(screen.queryByRole('button', { name: 'Carry this number' })).toBeNull()
  })
})
