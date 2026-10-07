/**
 * The tour's words and shape (the tour's round five, `to-dos/gc-mode/mockups/tour-round-five.md`):
 * every stop of both walks in plain words, each new stop three sentences, and each job's walk the
 * stops for its stage. That each stop's anchor is on the tab it names is `GcTour.render.test.tsx`.
 */
import { describe, expect, it } from 'vitest'
import { GC_PROJECT_TOUR_STEPS, GC_TOUR_STEPS, projectTourSteps } from './gcTour'
import { plainWordsFailures, plainWordsSentences } from '../plainWords'
import { initialGcState } from './gcFixture'

/** The stops round five added to Walk me through this job, by title. */
const ROUND_FIVE = [
  'A rough schedule while we bid',
  'Bars held up, and bars not covered',
  'A call list from the chart',
  'Spare days and people on site',
  'Print it or send the file',
  'Try moves on a copy',
  'Where the work is',
  'A job running late',
  'Their dates to meet',
  'Save the job as a template',
  'Who should be on site',
  'The log against the chart',
  'The trade’s own dates',
]
const projectStop = (title: string) => GC_PROJECT_TOUR_STEPS.find((s) => s.title === title)
const boardStop = (title: string) => GC_TOUR_STEPS.find((s) => s.title === title)

describe('the tour, round five', () => {
  it('every stop of both walks is in plain words: its title, its words, its Missing line and each bullet', () => {
    const failures = [...GC_TOUR_STEPS, ...GC_PROJECT_TOUR_STEPS].flatMap((s) =>
      [s.title, s.body, s.missingBody ?? '', ...(s.bullets ?? [])].flatMap((text) => plainWordsFailures(text).map((f) => `${s.title}: ${f}`)),
    )
    expect(failures).toEqual([])
  })

  it('each new stop is three sentences: what this is, then what you tap, then what happens after', () => {
    const fresh = [...ROUND_FIVE.map(projectStop), boardStop('A walk through one job')]
    expect(fresh.every(Boolean)).toBe(true)
    for (const s of fresh) {
      const sentences = plainWordsSentences(s?.body ?? '')
      expect(sentences, s?.title).toHaveLength(3)
      // The middle sentence is the doing: a tap on a control, or what the trade taps in its portal.
      expect(sentences[1], s?.title).toMatch(/\btaps?\b/i)
    }
  })

  it('each stop the walk opens a tab for says which stages it belongs to', () => {
    const withTab = GC_PROJECT_TOUR_STEPS.filter((s) => s.tab)
    expect(withTab.length).toBe(15)
    expect(withTab.filter((s) => !s.stages || s.stages.length === 0).map((s) => s.title)).toEqual([])
  })

  it('each job walks the stops for its stage: Boerne 16, Helotes 20, Fair Oaks D 30', () => {
    const state = initialGcState()
    const walk = (id: string) => projectTourSteps(state.projects.find((p) => p.id === id)!.stage).map((s) => s.title)
    expect(walk('boerne')).toHaveLength(16)
    expect(walk('helotes')).toHaveLength(20)
    expect(walk('fairoaksd')).toHaveLength(30)
    // A job still bidding walks the rough and no chart; a job being built walks the chart and not the rough.
    expect(walk('boerne')).toContain('A rough schedule while we bid')
    expect(walk('boerne')).not.toContain('The chart')
    expect(walk('fairoaksd')).not.toContain('A rough schedule while we bid')
    expect(walk('fairoaksd')).toEqual(expect.arrayContaining(ROUND_FIVE.slice(1)))
    // Buyout has a drawn chart, but the call list is built for a job being built only.
    expect(walk('helotes')).toContain('Try moves on a copy')
    expect(walk('helotes')).not.toContain('A call list from the chart')
    // Every walk keeps the stops on the tab buttons, in their order.
    for (const id of ['boerne', 'helotes', 'fairoaksd']) expect(walk(id).slice(0, 10)).toEqual(GC_PROJECT_TOUR_STEPS.slice(0, 10).map((s) => s.title))
  })

  it('New here? gains the door to every job’s own walk, just before Try it', () => {
    expect(GC_TOUR_STEPS).toHaveLength(19)
    const titles = GC_TOUR_STEPS.map((s) => s.title)
    expect(titles.indexOf('A walk through one job')).toBe(titles.indexOf('Try it') - 1)
  })
})
