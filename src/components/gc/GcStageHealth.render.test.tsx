// @vitest-environment jsdom
/**
 * Render smoke for the stage-health strip under a project's title (owner, 2026-10-04): the verdict
 * and its next step, the clock, the tiles and the numbers in each stage; Next opens its tab, and a
 * job buying out with no start date can set one right there.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GcStageHealth } from './GcStageHealth'
import { initialGcState } from '../../lib/gcMode/gcFixture'
import type { GcAction } from '../../lib/gcMode/gcTypes'

afterEach(cleanup)

const state = initialGcState()
const project = (id: string) => {
  const p = state.projects.find((x) => x.id === id)
  if (!p) throw new Error(id)
  return p
}

describe('the stage-health strip', () => {
  it('bidding: behind, the holes named, Next opens Trades', () => {
    const tabs: string[] = []
    render(<GcStageHealth state={state} project={project('boerne')} dispatch={() => undefined} onTab={(t) => tabs.push(t)} />)
    expect(screen.getByText('Behind')).toBeTruthy()
    expect(screen.getByText('6 days left and 2 trades have no quote: Structural steel and Fire sprinkler.')).toBeTruthy()
    expect(screen.getByText('Fire sprinkler')).toBeTruthy()
    // The calendar: a square a day, the deadlines under their days, the count over it.
    expect(screen.getByText('Questions close')).toBeTruthy()
    expect(screen.getByText('Bid due')).toBeTruthy()
    expect(screen.getByText('9 of 14')).toBeTruthy()
    expect(screen.getByLabelText(/^Thu Oct 1\. 4 quotes in: Tri-County Site/)).toBeTruthy()
    fireEvent.click(screen.getByText(/Next: Ask more companies for Structural steel/))
    expect(tabs).toEqual(['packages'])
  })

  it('bidding with quiet weeks: each is one rectangle with its dates and its working days', () => {
    render(<GcStageHealth state={state} project={project('padb')} dispatch={() => undefined} onTab={() => undefined} />)
    expect(screen.getByLabelText('Oct 5 – 9: 5 working days')).toBeTruthy()
    expect(screen.getByLabelText('Oct 12 – 16: 5 working days')).toBeTruthy()
    // Its weekend stands beside the rectangle, as in a busy week (the owner, 2026-10-05).
    expect(screen.getByLabelText('Sat Oct 10')).toBeTruthy()
    expect(screen.getByLabelText('Sun Oct 18')).toBeTruthy()
    // The busy weeks say both ends, and their labels never share a line.
    expect(screen.getByText('Sep 28 – Oct 4')).toBeTruthy()
    expect(screen.getByText('Pricing set')).toBeTruthy()
    expect(screen.getByText('Today')).toBeTruthy()
  })

  it('buying out: no start date, and setting one sends setStartDate', () => {
    const sent: GcAction[] = []
    render(<GcStageHealth state={state} project={project('helotes')} dispatch={(a) => sent.push(a)} onTab={() => undefined} />)
    expect(screen.getByText('Watch')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Set a start date'), { target: { value: '2026-10-19' } })
    fireEvent.click(screen.getByText('Save'))
    expect(sent).toEqual([{ type: 'setStartDate', projectId: 'helotes', date: '2026-10-19' }])
  })

  it('building: work against the plan and money against work', () => {
    render(<GcStageHealth state={state} project={project('fairoaksd')} dispatch={() => undefined} onTab={() => undefined} />)
    expect(screen.getByText('72% · plan 76%')).toBeTruthy()
    expect(screen.getByText('64% · work 74%')).toBeTruthy()
    expect(screen.getByText('about $149,000')).toBeTruthy()
    expect(screen.getByLabelText(/^Week of Sep 21\. Dry-in was due Sep 25/)).toBeTruthy()
  })
})
