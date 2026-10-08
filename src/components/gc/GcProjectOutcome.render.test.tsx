// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { GcProjectOutcome, type OutcomeWrites } from './GcProjectOutcome'
import { boardStateFromRows } from '../../lib/gc/boardRows'
import { clinicBoardRows } from '../../lib/gc/boardTestRows'
import type { GcProject } from '../../lib/gc/types'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()

function writes(): OutcomeWrites {
  return { bidSent: vi.fn(() => Promise.resolve()), won: vi.fn(() => Promise.resolve()), lost: vi.fn(() => Promise.resolve()), bringBack: vi.fn(() => Promise.resolve()) }
}

const clinic = (over: Partial<GcProject> = {}): GcProject => ({ ...boardStateFromRows(clinicBoardRows()).projects[0]!, ...over })

describe('GcProjectOutcome', () => {
  it('marks our bid sent, then shows the day it went in', async () => {
    const w = writes()
    const { rerender } = render(<GcProjectOutcome project={clinic()} writes={w} />)
    fireEvent.click(screen.getByRole('button', { name: 'We sent our bid' }))
    await waitFor(() => expect(w.bidSent).toHaveBeenCalled())
    rerender(<GcProjectOutcome project={clinic({ ourBidSentOn: '2026-10-08' })} writes={w} />)
    expect(screen.getByText('our bid went in Oct 8')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'We sent our bid' })).toBeNull()
  })

  it('asks once more before a win, since it cannot be undone here', async () => {
    const w = writes()
    render(<GcProjectOutcome project={clinic()} writes={w} />)
    fireEvent.click(screen.getByRole('button', { name: 'We won this. Start buyout' }))
    expect(w.won).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Not yet' }))
    fireEvent.click(screen.getByRole('button', { name: 'We won this. Start buyout' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, we won it' }))
    await waitFor(() => expect(w.won).toHaveBeenCalledTimes(1))
  })

  it('marks it lost only once a reason is picked, with who won it and a note', async () => {
    const w = writes()
    render(<GcProjectOutcome project={clinic()} writes={w} />)
    fireEvent.click(screen.getByRole('button', { name: 'We lost this' }))
    const mark = screen.getByRole('button', { name: 'Mark it lost' }) as HTMLButtonElement
    expect(mark.disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Price too high' }))
    fireEvent.change(screen.getByPlaceholderText('the builder the customer picked'), { target: { value: ' Hill Country Builders ' } })
    fireEvent.change(screen.getByPlaceholderText('what the customer said'), { target: { value: 'We were 6% high.' } })
    fireEvent.click(mark)
    await waitFor(() => expect(w.lost).toHaveBeenCalledWith('price', 'Hill Country Builders', 'We were 6% high.'))
  })

  it('a lost bid shows why and can come back; a project past bidding shows nothing', async () => {
    const w = writes()
    const { rerender, container } = render(<GcProjectOutcome project={clinic({ lostOn: '2026-10-07', lostWhy: 'other_builder', wonBy: 'Hill Country Builders' })} writes={w} />)
    expect(screen.getByText('Lost Oct 7')).toBeTruthy()
    expect(screen.getByText('Went with another builder · Hill Country Builders won it')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Bring it back' }))
    await waitFor(() => expect(w.bringBack).toHaveBeenCalled())
    rerender(<GcProjectOutcome project={clinic({ stage: 'buyout' })} writes={w} />)
    expect(container.textContent).toBe('')
  })

  it('shows a write that failed', async () => {
    const w = { ...writes(), bidSent: vi.fn(() => Promise.reject(new Error('Only a project still bidding can send its bid.'))) }
    render(<GcProjectOutcome project={clinic()} writes={w} />)
    fireEvent.click(screen.getByRole('button', { name: 'We sent our bid' }))
    expect(await screen.findByText('Only a project still bidding can send its bid.')).toBeTruthy()
  })
})
