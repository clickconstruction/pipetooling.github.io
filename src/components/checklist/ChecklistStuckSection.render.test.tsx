// @vitest-environment jsdom
/**
 * The office's Stuck list on Review (punch list #369, step C6): who is stuck on what and why, oldest first, and one
 * press, Sorted, that takes the mark off and tells that person. Nothing stuck draws nothing.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ChecklistStuckSection } from './ChecklistStuckSection'

const ROWS = [
  { instanceId: 'i1', title: 'Check the truck fluids', byUserId: 'u-theo', byName: 'Theo', reason: 'Waiting on a part', at: '2026-11-15T15:00:00Z' },
  { instanceId: 'i2', title: 'Sort the fittings wall', byUserId: 'u-hal', byName: 'Hal', reason: '', at: '2026-11-16T15:00:00Z' },
]

describe('ChecklistStuckSection', () => {
  it('draws nothing when nothing is stuck', async () => {
    const load = vi.fn(async () => ({ rows: [], error: null }))
    const { container } = render(<ChecklistStuckSection authUserId="u-office" load={load} />)
    await waitFor(() => expect(load).toHaveBeenCalled())
    expect(container.querySelector('[data-stuck-list]')).toBeNull()
  })

  it('lists who is stuck on what and why, under a label with the count', async () => {
    render(<ChecklistStuckSection authUserId="u-office" load={async () => ({ rows: ROWS, error: null })} />)
    await screen.findByText('Check the truck fluids')
    expect(screen.getByRole('heading', { name: 'Stuck · 2' })).toBeTruthy()
    expect(document.querySelector('[data-stuck-row="i1"]')?.textContent).toContain('Theo: Waiting on a part')
    expect(document.querySelector('[data-stuck-row="i2"]')?.textContent).toContain('Hal is stuck')
  })

  it('Sorted takes the mark off as the office, tells the person, and reads the list again', async () => {
    let rows = ROWS
    const load = vi.fn(async () => ({ rows, error: null }))
    const saySorted = vi.fn(async (_a: { instanceId: string; userId: string; kind: 'stuck' | 'unstuck'; words: string }) => {
      rows = ROWS.slice(1)
      return null
    })
    const tell = vi.fn(async (_a: { giverId: string | null; instanceId: string; title: string; body: string }) => {})
    render(<ChecklistStuckSection authUserId="u-office" load={load} saySorted={saySorted} tell={tell} nameOf={async () => 'Imani'} />)
    await screen.findByText('Check the truck fluids')
    fireEvent.click(screen.getAllByRole('button', { name: 'Sorted' })[0]!)
    await waitFor(() => expect(saySorted).toHaveBeenCalledWith({ instanceId: 'i1', userId: 'u-office', kind: 'unstuck', words: '' }))
    await waitFor(() => expect(tell).toHaveBeenCalledTimes(1))
    expect(tell.mock.calls[0]![0]).toMatchObject({ giverId: 'u-theo', title: 'Your task is sorted', body: 'Imani says "Check the truck fluids" is sorted. You can carry on.' })
    await waitFor(() => expect(screen.queryByText('Check the truck fluids')).toBeNull())
    expect(screen.getByRole('heading', { name: 'Stuck · 1' })).toBeTruthy()
  })

  it('a refusal is shown and the row stays', async () => {
    render(<ChecklistStuckSection authUserId="u-office" load={async () => ({ rows: ROWS, error: null })} saySorted={async () => 'That did not save.'} tell={vi.fn()} />)
    await screen.findByText('Check the truck fluids')
    fireEvent.click(screen.getAllByRole('button', { name: 'Sorted' })[0]!)
    await screen.findByText('That did not save.')
    expect(screen.getByText('Check the truck fluids')).toBeTruthy()
  })

  it('a list that did not load says why', async () => {
    render(<ChecklistStuckSection authUserId="u-office" load={async () => ({ rows: [], error: 'The stuck tasks did not load.' })} />)
    await screen.findByText('The stuck tasks did not load.')
  })
})
