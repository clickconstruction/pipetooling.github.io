import { describe, expect, it } from 'vitest'
import {
  cardLine,
  jobLine,
  peopleWeekChainWords,
  peopleWeekChains,
  peopleWeekHeadline,
  peopleWeekSubject,
  personLine,
  planPeopleWeekEdit,
  renderPeopleWeekHtml,
  renderPeopleWeekText,
  samplePeopleWeekPayload,
  stuckLine,
  timeWords,
  weekWords,
} from './peopleWeek'

describe('the words', () => {
  it('names the week, the subject and the headline', () => {
    expect(weekWords('2026-11-02', '2026-11-08')).toBe('Nov 2 to 8')
    expect(weekWords('2026-11-30', '2026-12-06')).toBe('Nov 30 to Dec 6')
    const p = samplePeopleWeekPayload('2026-11-09')
    expect(p.week_start).toBe('2026-11-02')
    expect(p.week_end).toBe('2026-11-08')
    expect(peopleWeekSubject(p)).toBe('Your people’s week · Nov 2 to 8')
    expect(peopleWeekHeadline(p)).toBe('3 people · 2 cards done · 2 moved · 1 stuck')
  })
  it('reads a person, a card, a job and a stuck line', () => {
    const p = samplePeopleWeekPayload('2026-11-09')
    expect(personLine(p.people[0]!)).toBe('2 cards done · 1 moved · 4 photos')
    expect(personLine(p.people[2]!)).toBe('nothing moved')
    expect(cardLine(p.people[0]!.cards[0]!)).toBe('Put the plumbing tools in a neat home · 0 → 100 · done · 3 of 3 · 3 photos')
    expect(cardLine(p.people[0]!.cards[2]!)).toBe('Clear the back half of the floor · 25 → 75 · “puddy and the glue, Thursday” · 1 photo')
    expect(jobLine(p.people[0]!.jobs[0]!)).toBe('1105 · Madison Park kitchen · 65% done · 3 days · 2 reports')
    expect(stuckLine(p.people[2]!.stuck[0]!)).toBe('One marker every mile · 32 days, no move')
  })
  it('renders text and html with every person and the Review link, escaping the html', () => {
    const p = samplePeopleWeekPayload('2026-11-09')
    const text = renderPeopleWeekText(p, 'https://x/checklist?tab=review')
    expect(text).toContain('Mateo · 2 cards done')
    expect(text).toContain('Stuck')
    expect(text).toContain('Open Review: https://x/checklist?tab=review')
    const html = renderPeopleWeekHtml({ ...p, people: [{ ...p.people[0]!, name: 'A <b>' }] }, 'https://x')
    expect(html).toContain('A &lt;b&gt;')
    expect(html).toContain('Your people’s week')
  })
  it('says the time plainly', () => {
    expect(timeWords('06:00')).toBe('6:00 AM')
    expect(timeWords('13:30')).toBe('1:30 PM')
    expect(timeWords('00:15')).toBe('12:15 AM')
  })
})

describe('the chains', () => {
  const rows = [
    { id: 'r1', requested_by: 'me', recipient_user_id: 'me', people_user_ids: ['a', 'b'], send_at: '2026-11-09T12:00:00Z', repeat_weekly: true, sent_at: null },
    { id: 'r0', requested_by: 'me', recipient_user_id: 'me', people_user_ids: ['a'], send_at: '2026-11-02T12:00:00Z', repeat_weekly: true, sent_at: '2026-11-02T12:01:00Z' },
  ]
  it('groups the pending weekly rows with the newest row’s people', () => {
    const chains = peopleWeekChains(rows)
    expect(chains).toHaveLength(1)
    expect(chains[0]!.peopleUserIds).toEqual(['a', 'b'])
    expect(chains[0]!.weekdays).toEqual([1])
    expect(peopleWeekChainWords(chains[0]!, (id) => ({ a: 'Mateo', b: 'Rosa' })[id] ?? '')).toBe('Mateo and Rosa · Monday 6:00 AM · every week')
  })
  it('plans an edit: new people re-create the chain, no people refuses, no weekdays stops it', () => {
    const current = peopleWeekChains(rows)[0]!
    const same = planPeopleWeekEdit({ userId: 'me', peopleUserIds: ['b', 'a'], desiredWeekdays: [1], desiredTimeHm: current.timeHm, current })
    expect(same.ok).toBe(false)
    const changed = planPeopleWeekEdit({ userId: 'me', peopleUserIds: ['a', 'b', 'c'], desiredWeekdays: [1], desiredTimeHm: current.timeHm, current })
    expect(changed.ok && changed.inserts[0]?.people_user_ids).toEqual(['a', 'b', 'c'])
    expect(changed.ok && changed.cancelIds).toEqual(['r1'])
    expect(planPeopleWeekEdit({ userId: 'me', peopleUserIds: [], desiredWeekdays: [1], desiredTimeHm: '06:00', current: null })).toEqual({ ok: false, error: 'Pick at least one person.' })
    const stop = planPeopleWeekEdit({ userId: 'me', peopleUserIds: ['a', 'b'], desiredWeekdays: [], desiredTimeHm: current.timeHm, current })
    expect(stop.ok && stop.cancelIds).toEqual(['r1'])
  })
})
