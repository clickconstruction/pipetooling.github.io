// @vitest-environment jsdom
/**
 * Render smoke for the superintendent's morning list (G-118): today's companies with their phones
 * and work, the inspection, the foot while the day has no log, the day steps, and the red line for
 * a company the day's log does not have.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GcMorningList } from './GcMorningList'
import { initialGcState } from '../../lib/gcMode/gcFixture'
import type { GcState } from '../../lib/gcMode/gcTypes'

afterEach(cleanup)

const fairOaks = (state: GcState) => state.projects.find((p) => p.id === 'fairoaksd')!

describe('the morning list', () => {
  it('reads today: who, doing what, the phone to call, the inspection, and the log still to write', () => {
    const state = initialGcState()
    const { container } = render(<GcMorningList state={state} project={fairOaks(state)} day={state.today} onDay={vi.fn()} />)
    expect(screen.getByText('Who should be on site · Fri Oct 2')).toBeTruthy()
    expect(screen.getByText('5 companies on 6 activities, and an inspection.')).toBeTruthy()
    expect(screen.getByText('Summit Roofing')).toBeTruthy()
    expect(screen.getByText('(210) 555-0150').closest('a')?.getAttribute('href')).toBe('tel:2105550150')
    expect(screen.getByText('TPO membrane')).toBeTruthy()
    expect(screen.getByText('day 12 of 19')).toBeTruthy()
    expect(container.querySelectorAll('[data-morning-company]').length).toBe(5)
    expect(screen.getByText(/It is seen again today\. It failed Mon Sep 28/)).toBeTruthy()
    expect(screen.getByText("No log for today yet. Each company's count comes in when it is written.")).toBeTruthy()
  })

  it('steps to the day before, and no further than today', () => {
    const state = initialGcState()
    const onDay = vi.fn()
    render(<GcMorningList state={state} project={fairOaks(state)} day={state.today} onDay={onDay} />)
    fireEvent.click(screen.getByRole('button', { name: '‹ Thu' }))
    expect(onDay).toHaveBeenCalledWith('2026-10-01')
    expect(screen.queryByRole('button', { name: /›$/ })).toBeNull()
  })

  it('puts the one the day’s log does not have first, in red words', () => {
    const base = initialGcState()
    const state: GcState = {
      ...base,
      projects: base.projects.map((p) => (p.id !== 'fairoaksd' ? p : { ...p, dailyLogs: (p.dailyLogs ?? []).map((l) => (l.date === '2026-10-01' ? { ...l, crews: l.crews.filter((c) => c.packageId !== 'froof') } : l)) })),
    }
    const { container } = render(<GcMorningList state={state} project={fairOaks(state)} day="2026-10-01" onDay={vi.fn()} />)
    expect(container.querySelector('[data-morning-company]')?.getAttribute('data-morning-company')).toBe('froof')
    expect(screen.getByText('Not on the log for Thu Oct 1. Last on it Tue Sep 29 with 5.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Fri ›' })).toBeTruthy()
  })
})
