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
    fireEvent.click(screen.getByText(/Next: Ask more companies for Structural steel/))
    expect(tabs).toEqual(['packages'])
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
  })
})
