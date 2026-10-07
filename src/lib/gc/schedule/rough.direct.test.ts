/**
 * Main's own tests for the rough schedule while we bid (G-45; the schedule's PR 1b): its weeks and its
 * stages, the weeks kept as they went when our bid goes in or at award, and the first draft against
 * the weeks we bid, run through the kernels on the test data. The spike's own cases: Boerne Retail
 * Shell, bidding to Cibolo Creek Partners, drawn from Mon Nov 2. The rough is kept as Draw the rough
 * keeps it; our bid going in and the award keep its weeks as the spike's reducer does.
 */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../../plainWords'
import type { GcProject } from '../types'
import { scheduleDraft } from './draft'
import { bidSentWeeksWords, drawWeeks, firstDraftAgainstBid, keepRough, proposalWeeksWords, roughDraw, roughDrawnWords, roughFirstDraftWords, roughStages, roughWeeks, roughWeeksWords } from './rough'
import { daysBetween } from './schedule'
import { initialGcState } from './testState'

/** Boerne Retail Shell: bidding to Cibolo Creek Partners, our bid due Thu Oct 8, no schedule. */
const shell = () => initialGcState().projects.find((p) => p.name === 'Boerne Retail Shell')!
/** The rough as Draw the rough keeps it, from Mon Nov 2. */
const drawn = (days: Record<string, number> = {}): GcProject => ({ ...shell(), rough: { start: '2026-11-02', days, by: 'Robert Douglas', on: '2026-10-02' } })
/** Our bid went in today: the rough's weeks kept as they went. */
const bidSent = (p: GcProject): GcProject => ({ ...p, rough: keepRough(p, '2026-10-02', 'bid') })
/** Won today: the job goes to buyout with the rough's weeks kept. */
const won = (p: GcProject): GcProject => ({ ...p, stage: 'buyout', rough: keepRough(p, '2026-10-02', 'award') })

describe('a rough schedule while we bid (G-45)', () => {
  it('draws Boerne Retail Shell from Mon Nov 2: 14 weeks to Tue Feb 2, by its stages, and nothing in the schedule', () => {
    const p = drawn()
    expect(roughWeeks(p)).toEqual({ weeks: 14, start: '2026-11-02', finish: '2027-02-02', kept: null })
    expect(p.schedule ?? null).toBeNull()
    expect(roughWeeksWords(p)).toBe('If work starts Mon Nov 2, substantial completion is Tue Feb 2. That is 14 weeks.')
    expect(proposalWeeksWords(p)).toBe('We will build Boerne Retail Shell in 14 weeks from the day work starts.')
    expect(roughDrawnWords(p)).toBe('Drew a rough schedule for our bid on Boerne Retail Shell. It takes 14 weeks if work starts Mon Nov 2.')
    const st = roughStages(p)
    expect(st?.rows.map((r) => r.label)).toEqual(['Site prep', 'Foundations', 'Underground', 'Slab', 'Structure', 'Dry-in', 'Rough-in', 'Trim', 'Site finish', 'Closeout'])
    expect(st?.rows.find((r) => r.key === 'structure')).toEqual({ key: 'structure', label: 'Structure', days: 15, usual: 15, start: '2026-12-02', finish: '2026-12-16' })
    expect(st?.inspections).toEqual({ start: '2027-01-14', finish: '2027-01-30' })
    expect(st?.milestones).toEqual([
      { label: 'Dry-in', on: '2026-12-28' },
      { label: 'Rough-in inspection', on: '2027-01-15' },
      { label: 'Substantial completion', on: '2027-02-02' },
    ])
  })

  it('takes the job’s own stage days, by the draw, not by adding them up', () => {
    const p = drawn({ structure: 25 })
    const st = roughStages(p)?.rows.find((r) => r.key === 'structure')
    expect(st).toMatchObject({ days: 25, usual: 15 })
    // Structural steel's three lines take ceil(25 / 3) = 9 days each, one after another, instead of 5.
    expect(st && daysBetween(st.start, st.finish) + 1).toBe(27)
    expect(roughWeeks(p)?.weeks).toBe(15)
    expect(roughWeeks(p)?.weeks).toBe(drawWeeks(roughDraw(p)!)?.weeks)
  })

  it('has no rough and no weeks before one is drawn', () => {
    const p = shell()
    expect([roughDraw(p), roughWeeks(p), roughStages(p), roughWeeksWords(p), proposalWeeksWords(p), keepRough(p, '2026-10-02', 'bid')]).toEqual([null, null, null, null, null, undefined])
  })
})

describe('the weeks kept as they went', () => {
  it('locks when our bid goes in: the weeks read as they went, whatever the draw would say', () => {
    expect(bidSentWeeksWords(drawn())).toBe('It takes 14 weeks to build, by the rough schedule.')
    const p = bidSent(drawn())
    expect(p.rough?.kept).toEqual({ on: '2026-10-02', weeks: 14, finish: '2027-02-02', at: 'bid' })
    expect(roughWeeksWords(p)).toBe('Our bid went in Fri Oct 2 with 14 weeks to build. The rough stays as it went.')
    // Kept once: the award does not count it again.
    expect(keepRough(p, '2026-10-09', 'award')).toBe(p.rough)
    // The record cannot drift from the proposal: were the draw to say 15 weeks, the weeks stay 14.
    const drifted = { ...p, rough: { ...p.rough!, days: { structure: 25 } } }
    expect(drawWeeks(roughDraw(drifted)!)?.weeks).toBe(15)
    expect(roughWeeks(drifted)?.weeks).toBe(14)
    expect(proposalWeeksWords(drifted)).toBe('We will build Boerne Retail Shell in 14 weeks from the day work starts.')
  })

  it('at award keeps the rough as the weeks we bid, and the first draft starts from its start day and lengths', () => {
    const p = won(drawn({ structure: 25 }))
    expect(p.rough?.kept).toEqual({ on: '2026-10-02', weeks: 15, finish: roughWeeks(p)?.finish, at: 'award' })
    expect(p.schedule ?? null).toBeNull()
    expect(roughWeeksWords(p)).toBe('We won it with 15 weeks to build on the rough. The rough stays as it was.')
    expect(roughFirstDraftWords(p)).toBe('We bid 15 weeks, from the rough schedule. The first draft starts from its start day and its stage lengths.')
    // Drawn from the rough's start and lengths, the first draft keeps the weeks we bid.
    const fromRough = { ...p, schedule: scheduleDraft(p, p.rough!.start, p.rough!.days) }
    const steel = fromRough.packages.find((k) => k.trade === 'Structural steel')
    expect(fromRough.schedule.activities.filter((a) => a.packageId === steel?.id).map((a) => daysBetween(a.start, a.finish) + 1)).toEqual([9, 9, 9])
    expect(firstDraftAgainstBid(fromRough)).toBe('The first draft runs the 15 weeks we bid.')
    // Drawn with the usual lengths instead, it says so against the bid.
    expect(firstDraftAgainstBid({ ...p, schedule: scheduleDraft(p, '2026-11-02') })).toBe('The first draft runs 14 weeks. We bid 15.')
  })

  it('says every sentence in plain words', () => {
    const p = drawn()
    const w = won(drawn())
    const words = [roughWeeksWords(p), proposalWeeksWords(p), roughDrawnWords(p), bidSentWeeksWords(p), roughWeeksWords(bidSent(p)), roughWeeksWords(w), roughFirstDraftWords(w), firstDraftAgainstBid({ ...w, schedule: scheduleDraft(w, '2026-11-02') })]
    for (const t of words) {
      expect(t).not.toBeNull()
      expect(plainWordsFailures(t ?? '')).toEqual([])
    }
  })
})
