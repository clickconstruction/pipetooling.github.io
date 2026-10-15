// @vitest-environment jsdom
/**
 * The stage-health strip under a project's title (the Board's B2b-vii, from the design spike's own render test): the
 * verdict and its next step, the clock, the tiles and the numbers in each stage; Next opens its part of the card, and a
 * job buying out with no start date can set one right there. The real build's changes: a step the reader may not open
 * is words alone, the start date is Get started's own press, and the money's rows are Our number's readers' only.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { GcStageHealth } from './GcStageHealth'
import { initialGcState } from '../../lib/gc/schedule/testState'
import type { HealthTab } from '../../lib/gc/stageHealth'

afterEach(cleanup)

const state = initialGcState()
const project = (id: string) => {
  const p = state.projects.find((x) => x.id === id)
  if (!p) throw new Error(id)
  return p
}
const any = () => true

describe('the stage-health strip', () => {
  it('bidding: behind, the holes named, Next opens the trades', () => {
    const tabs: HealthTab[] = []
    render(<GcStageHealth state={state} project={project('boerne')} canOpen={any} onTab={(t) => tabs.push(t)} moneyShown />)
    expect(screen.getByText('Behind')).toBeTruthy()
    expect(screen.getByText('6 days left and 2 trades have no quote: Structural steel and Fire sprinkler.')).toBeTruthy()
    expect(screen.getByText('Fire sprinkler')).toBeTruthy()
    expect(screen.getByText('Questions close')).toBeTruthy()
    expect(screen.getByText('Bid due')).toBeTruthy()
    expect(screen.getByText('9 of 14')).toBeTruthy()
    expect(screen.getByLabelText(/^Thu Oct 1\. 4 quotes in: Tri-County Site/)).toBeTruthy()
    fireEvent.click(screen.getByText(/Next: Ask more companies for Structural steel/))
    expect(tabs).toEqual(['packages'])
  })

  it('bidding with quiet weeks: each is one rectangle with its dates and its working days', () => {
    render(<GcStageHealth state={state} project={project('padb')} canOpen={any} onTab={() => undefined} moneyShown />)
    expect(screen.getByLabelText('Oct 5 – 9: 5 working days')).toBeTruthy()
    expect(screen.getByLabelText('Oct 12 – 16: 5 working days')).toBeTruthy()
    expect(screen.getByLabelText('Sat Oct 10')).toBeTruthy()
    expect(screen.getByLabelText('Sun Oct 18')).toBeTruthy()
    expect(screen.getByText('Sep 28 – Oct 4')).toBeTruthy()
    expect(screen.getByText('Pricing set')).toBeTruthy()
    expect(screen.getByText('Today')).toBeTruthy()
  })

  it('buying out: no start date, and setting one goes through the page’s press', async () => {
    const set = vi.fn(() => Promise.resolve())
    render(<GcStageHealth state={state} project={project('helotes')} canOpen={any} onTab={() => undefined} onSetStartDate={set} moneyShown />)
    expect(screen.getByText('Watch')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Set a start date'), { target: { value: '2026-10-19' } })
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(set).toHaveBeenCalledWith('2026-10-19'))
  })

  it('buying out: a start date that does not save says so in words, and no box without the press', async () => {
    render(<GcStageHealth state={state} project={project('helotes')} canOpen={any} onTab={() => undefined} onSetStartDate={() => Promise.reject(new Error('the day is taken'))} moneyShown />)
    fireEvent.change(screen.getByLabelText('Set a start date'), { target: { value: '2026-10-19' } })
    fireEvent.click(screen.getByText('Save'))
    expect((await screen.findByRole('alert')).textContent).toBe('The start date did not save: the day is taken')
    cleanup()
    render(<GcStageHealth state={state} project={project('helotes')} canOpen={any} onTab={() => undefined} moneyShown />)
    expect(screen.queryByLabelText('Set a start date')).toBeNull()
  })

  it('building: work against the plan and money against work, for Our number’s readers', () => {
    render(<GcStageHealth state={state} project={project('fairoaksd')} canOpen={any} onTab={() => undefined} moneyShown />)
    expect(screen.getByText('72% · plan 76%')).toBeTruthy()
    expect(screen.getByText('64% · work 74%')).toBeTruthy()
    expect(screen.getByText('about $149,000')).toBeTruthy()
    expect(screen.getByLabelText(/^Week of Sep 21\. Dry-in was due Sep 25/)).toBeTruthy()
  })

  it('building, outside the money team: the work against the plan, and no money row or number', () => {
    render(<GcStageHealth state={state} project={project('fairoaksd')} canOpen={any} onTab={() => undefined} moneyShown={false} />)
    expect(screen.getByText('72% · plan 76%')).toBeTruthy()
    expect(screen.queryByText('64% · work 74%')).toBeNull()
    expect(screen.queryByText('about $149,000')).toBeNull()
    expect(screen.queryByText(/Billed the customer|Paid us|Not billed yet/)).toBeNull()
  })

  it('a next step the reader may not open is said with no press', () => {
    const onTab = vi.fn()
    render(<GcStageHealth state={state} project={project('boerne')} canOpen={() => false} onTab={onTab} moneyShown />)
    expect(screen.queryByRole('button', { name: /^Next:/ })).toBeNull()
    expect(screen.getByText(/Next: Ask more companies for Structural steel/)).toBeTruthy()
  })
})

describe('the strip in shape D (to-do #108, PR 2): the verdict band, the clock, the trades', () => {
  // v2.5545: the verdict, Next and the numbers in one block tinted by the verdict; the stage rail gone; each key behind its link.
  it('puts the numbers in the verdict band, drops the rail, and keeps each key behind its Key link', () => {
    render(<GcStageHealth state={state} project={project('boerne')} canOpen={any} onTab={() => undefined} moneyShown foot={<span>Bill day Sun Oct 25</span>} />)
    const band = document.querySelector('[data-gc-verdict="behind"]') as HTMLElement
    expect(band).toBeTruthy()
    expect(band.querySelector('[data-gc-health-numbers]')).toBeTruthy()
    expect(band.textContent).toContain('Bill day Sun Oct 25')
    expect(screen.queryByLabelText('Where the job is')).toBeNull()
    expect(screen.queryByText('Buying out')).toBeNull()
    // The clock band: the calendar's key shows on Key and goes on Hide the key.
    const clock = screen.getByRole('region', { name: 'The clock' })
    expect(within(clock).queryByText('gone by')).toBeNull()
    fireEvent.click(within(clock).getByRole('button', { name: 'Key' }))
    expect(within(clock).getByText('gone by')).toBeTruthy()
    fireEvent.click(within(clock).getByRole('button', { name: 'Hide the key' }))
    expect(within(clock).queryByText('gone by')).toBeNull()
    // The trades band: the tiles, their count, and the colours' key behind its own link.
    const trades = screen.getByRole('region', { name: 'The trades' })
    expect(within(trades).getByText('Fire sprinkler')).toBeTruthy()
    expect(within(trades).queryByText('done for this stage')).toBeNull()
    fireEvent.click(within(trades).getByRole('button', { name: 'Key' }))
    expect(within(trades).getByText('done for this stage')).toBeTruthy()
  })
})
