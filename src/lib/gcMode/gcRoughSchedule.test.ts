import { describe, expect, it } from 'vitest'
import { initialGcState } from './gcFixture'
import { scheduleDraft } from './gcNewProject'
import { gcReducer } from './gcReducer'
import { customerSchedulePicture } from './gcCustomerSchedule'
import { daysBetween } from './gcBuildingSchedule'
import { plainWordsFailures } from '../plainWords'
import type { GcState } from './gcTypes'
import { drawWeeks, firstDraftAgainstBid, proposalWeeksWords, roughDraw, roughFirstDraftWords, roughStages, roughWeeks, roughWeeksWords, bidSentWeeksWords, roughDrawnWords } from './gcRoughSchedule'

/** Every fixture job's first draft from one day, as `scheduleDraft` drew it before G-45 gave it the optional stage days. */
function draws(days?: Record<string, number>) {
  const state = initialGcState()
  return state.projects.map((p) => {
    const s = days === undefined ? scheduleDraft(p, '2026-11-02') : scheduleDraft(p, '2026-11-02', days)
    return {
      job: p.name,
      activities: s.activities.map((a) => `${a.lineId} ${a.start} ${a.finish} after ${a.after.join(',')}${a.inspection ? ` (${a.inspection.label})` : ''}`),
      milestones: s.milestones.map((m) => `${m.label} ${m.planned}`),
    }
  })
}

describe('the first draft is unchanged for every caller that passes no stage days (G-45)', () => {
  it('draws every fixture job exactly as it drew before the optional argument', () => {
    expect(draws()).toMatchSnapshot()
  })
})

/** Boerne Retail Shell: bidding to Cibolo Creek Partners, our bid due Thu Oct 8, no schedule. */
const shell = (s: GcState) => {
  const p = s.projects.find((x) => x.name === 'Boerne Retail Shell')
  if (!p) throw new Error('the made-up data lost Boerne Retail Shell')
  return p
}
const lastLog = (s: GcState) => s.log[0]?.text ?? ''
const rough = (s: GcState, days: Record<string, number> = {}, start = '2026-11-02') => gcReducer(s, { type: 'setRough', projectId: shell(s).id, start, days, by: 'Robert Douglas' })

describe('a rough schedule while we bid (G-45)', () => {
  it('draws Boerne Retail Shell from Mon Nov 2: 14 weeks to Sun Feb 7, by its stages, and nothing in the schedule', () => {
    const s = rough(initialGcState())
    const p = shell(s)
    expect(p.rough).toEqual({ start: '2026-11-02', days: {}, by: 'Robert Douglas', on: '2026-10-02' })
    expect(roughWeeks(p)).toEqual({ weeks: 14, start: '2026-11-02', finish: '2027-02-07', kept: null })
    expect(p.schedule ?? null).toBeNull()
    expect(roughWeeksWords(p)).toBe('If work starts Mon Nov 2, substantial completion is Sun Feb 7. That is 14 weeks.')
    expect(proposalWeeksWords(p)).toBe('We will build Boerne Retail Shell in 14 weeks from the day work starts.')
    expect(lastLog(s)).toBe('Drew a rough schedule for our bid on Boerne Retail Shell. It takes 14 weeks if work starts Mon Nov 2.')
    const st = roughStages(p)
    expect(st?.rows.map((r) => r.label)).toEqual(['Site prep', 'Foundations', 'Underground', 'Slab', 'Structure', 'Dry-in', 'Rough-in', 'Trim', 'Site finish', 'Closeout'])
    expect(st?.rows.find((r) => r.key === 'structure')).toEqual({ key: 'structure', label: 'Structure', days: 15, usual: 15, start: '2026-12-02', finish: '2026-12-16' })
    expect(st?.inspections).toEqual({ start: '2027-01-14', finish: '2027-02-04' })
    expect(st?.milestones).toEqual([
      { label: 'Dry-in', on: '2026-12-28' },
      { label: 'Rough-in inspection', on: '2027-01-15' },
      { label: 'Substantial completion', on: '2027-02-07' },
    ])
  })

  it('takes the job’s own stage days, by the draw, not by adding them up', () => {
    const p = shell(rough(initialGcState(), { structure: 25 }))
    const st = roughStages(p)?.rows.find((r) => r.key === 'structure')
    expect(st).toMatchObject({ days: 25, usual: 15 })
    // Structural steel's three lines take ceil(25 / 3) = 9 days each, one after another, instead of 5.
    expect(st && daysBetween(st.start, st.finish) + 1).toBe(27)
    const w = roughWeeks(p)
    expect(w?.weeks).toBe(16)
    expect(w?.weeks).toBe(drawWeeks(roughDraw(p)!)?.weeks)
  })

  it('is our team’s alone: the customer’s picture reads nothing from it, and the schedule every view reads stays empty', () => {
    const s = rough(initialGcState())
    const picture = customerSchedulePicture(s, shell(s))
    expect(picture.stages).toEqual([])
    expect(picture.milestones).toEqual([])
    expect(shell(s).schedule ?? null).toBeNull()
  })

  it('locks when our bid goes in: setRough is refused and the weeks read as they went, whatever the draw would say', () => {
    let s = rough(initialGcState())
    s = gcReducer(s, { type: 'markBidSent', projectId: shell(s).id })
    const p = shell(s)
    expect(p.rough?.kept).toEqual({ on: '2026-10-02', weeks: 14, finish: '2027-02-07', at: 'bid' })
    expect(lastLog(s)).toBe('Our bid on Boerne Retail Shell went to Cibolo Creek Partners. It takes 14 weeks to build, by the rough schedule. Bid tabs can go out now.')
    expect(gcReducer(s, { type: 'setRough', projectId: p.id, start: '2026-11-02', days: { structure: 25 }, by: 'Robert Douglas' })).toBe(s)
    expect(roughWeeksWords(p)).toBe('Our bid went in Fri Oct 2 with 14 weeks to build. The rough stays as it went.')
    // The record cannot drift from the proposal: were the draw to say 16 weeks, the weeks stay 14.
    const drifted = { ...p, rough: { ...p.rough!, days: { structure: 25 } } }
    expect(drawWeeks(roughDraw(drifted)!)?.weeks).toBe(16)
    expect(roughWeeks(drifted)?.weeks).toBe(14)
    expect(proposalWeeksWords(drifted)).toBe('We will build Boerne Retail Shell in 14 weeks from the day work starts.')
  })

  it('is refused on a lost job and once won; without a rough, We sent our bid reads as it always did', () => {
    const s0 = initialGcState()
    const id = shell(s0).id
    const lost = gcReducer(s0, { type: 'markLost', projectId: id, why: 'price', wonBy: null, note: '' })
    expect(gcReducer(lost, { type: 'setRough', projectId: id, start: '2026-11-02', days: {}, by: 'Robert Douglas' })).toBe(lost)
    const won = gcReducer(s0, { type: 'markWon', projectId: id })
    expect(gcReducer(won, { type: 'setRough', projectId: id, start: '2026-11-02', days: {}, by: 'Robert Douglas' })).toBe(won)
    const sent = gcReducer(s0, { type: 'markBidSent', projectId: id })
    expect(lastLog(sent)).toBe('Our bid on Boerne Retail Shell went to Cibolo Creek Partners. Bid tabs can go out now.')
    expect(shell(sent).rough).toBeUndefined()
  })

  it('at award keeps the rough as the weeks we bid, leaves the schedule empty, and the first draft starts from its start day and lengths', () => {
    let s = rough(initialGcState(), { structure: 25 })
    const id = shell(s).id
    s = gcReducer(s, { type: 'markWon', projectId: id })
    let p = shell(s)
    expect(p.stage).toBe('buyout')
    expect(p.rough?.kept).toEqual({ on: '2026-10-02', weeks: 16, finish: roughWeeks(p)?.finish, at: 'award' })
    expect(p.schedule ?? null).toBeNull()
    expect(roughWeeksWords(p)).toBe('We won it with 16 weeks to build on the rough. The rough stays as it was.')
    expect(roughFirstDraftWords(p)).toBe('We bid 16 weeks, from the rough schedule. The first draft starts from its start day and its stage lengths.')
    // Drawn from the rough's start and lengths, the first draft keeps the weeks we bid.
    const fromRough = gcReducer(s, { type: 'draftSchedule', projectId: id, start: p.rough!.start, days: p.rough!.days })
    p = shell(fromRough)
    const steel = p.packages.find((k) => k.trade === 'Structural steel')
    const steelBars = (p.schedule?.activities ?? []).filter((a) => a.packageId === steel?.id)
    expect(steelBars.map((a) => daysBetween(a.start, a.finish) + 1)).toEqual([9, 9, 9])
    expect(firstDraftAgainstBid(p)).toBe('The first draft runs the 16 weeks we bid.')
    // Drawn with the usual lengths instead, it says so against the bid.
    const usual = shell(gcReducer(s, { type: 'draftSchedule', projectId: id, start: '2026-11-02' }))
    expect(firstDraftAgainstBid(usual)).toBe('The first draft runs 14 weeks. We bid 16.')
  })

  it('says every new sentence in plain words', () => {
    let s = rough(initialGcState())
    const id = shell(s).id
    const drawn = shell(s)
    s = gcReducer(s, { type: 'markBidSent', projectId: id })
    const sent = shell(s)
    const won = shell(gcReducer(rough(initialGcState()), { type: 'markWon', projectId: id }))
    const drafted = shell(gcReducer(gcReducer(rough(initialGcState()), { type: 'markWon', projectId: id }), { type: 'draftSchedule', projectId: id, start: '2026-11-02' }))
    const words = [roughWeeksWords(drawn), proposalWeeksWords(drawn), roughDrawnWords(drawn), bidSentWeeksWords(drawn), roughWeeksWords(sent), roughWeeksWords(won), roughFirstDraftWords(won), firstDraftAgainstBid(drafted)]
    for (const w of words) {
      expect(w).not.toBeNull()
      expect(plainWordsFailures(w ?? '')).toEqual([])
    }
  })
})
