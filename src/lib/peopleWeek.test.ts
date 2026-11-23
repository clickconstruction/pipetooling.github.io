import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from './plainWords'
import {
  PEOPLE_WEEK_FOLD_OVER,
  PEOPLE_WEEK_SHEET_WORDS,
  cardLine,
  glancePerson,
  jobLine,
  peopleWeekAboutWords,
  peopleWeekChainWords,
  peopleWeekChains,
  peopleWeekGlance,
  peopleWeekHeadline,
  peopleWeekPickList,
  peopleWeekStartWords,
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
    expect(peopleWeekSubject(p)).toBe('The team’s week · Nov 2 to 8')
    expect(peopleWeekHeadline(p)).toBe('3 people · 2 cards done · 2 moved · 1 stuck')
  })
  it('reads a person, a card, a job and a stuck line', () => {
    const p = samplePeopleWeekPayload('2026-11-09')
    expect(personLine(p.people[0]!)).toBe('2 cards done · 1 moved · 4 photos')
    expect(personLine(p.people[2]!)).toBe('nothing moved')
    expect(cardLine(p.people[0]!.cards[0]!)).toBe('Put the plumbing tools in a neat home · 0 → 100 · done · 3 of 3 · 3 photos')
    expect(cardLine(p.people[0]!.cards[2]!)).toBe('Clear the back half of the floor · 25 → 75 · “puddy and the glue, Thursday” · 1 photo')
    expect(jobLine(p.people[0]!.jobs[0]!)).toBe('1105 · Morris Park kitchen · 65% done · 3 days · 2 reports')
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
    expect(html).toContain('The team’s week')
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

describe('the sheet’s picture and words (v2.8041)', () => {
  it('draws the email’s own lines about one made-up person, for the week just finished', () => {
    const g = peopleWeekGlance('2026-11-20')
    expect(g.subject).toBe('The team’s week · Nov 9 to 15')
    expect(g.name).toBe('Mateo')
    expect(g.line).toBe('2 cards done · 1 moved · 4 photos')
    expect(g.groups).toEqual([
      { label: 'Cards', line: 'Hang the shelves · 25 → 75 · 2 of 3 lines' },
      { label: 'Roadmap', line: 'Hang the shelves · Farm 1 › Containers · 75%' },
      { label: 'Jobs', line: '1105 · Morris Park · 65% done · 3 days' },
    ])
  })
  it('says nothing the email does not: every line and label of the picture is in the email about that person', () => {
    const g = peopleWeekGlance('2026-11-20')
    const html = renderPeopleWeekHtml({ week_start: '2026-11-09', week_end: '2026-11-15', people: [glancePerson()] }, 'https://x')
    const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    for (const words of [g.subject, g.name, g.line, ...g.groups.flatMap((x) => [x.label, x.line])]) expect(html).toContain(esc(words))
    // The five things the old paragraph listed, each shown once: cards moved or finished, lines ticked, photos, roadmap, jobs.
    const all = [g.line, ...g.groups.map((x) => x.line)].join(' | ')
    for (const shown of ['cards done', 'moved', 'photos', 'of 3 lines', 'Farm 1 ›', '3 days']) expect(all).toContain(shown)
  })
  it('names the first press whole: an email, every week, the day and the time', () => {
    expect(peopleWeekStartWords([1], '06:00')).toBe('Email me every Monday at 6:00 AM')
    expect(peopleWeekStartWords([4, 1], '13:30')).toBe('Email me every Mon and Thu at 1:30 PM')
    expect(peopleWeekStartWords([0, 1], '06:00')).toBe('Email me every Mon and Sun at 6:00 AM')
    expect(peopleWeekStartWords([1, 3, 5], '06:00')).toBe('Email me 3 days a week at 6:00 AM')
    expect(peopleWeekStartWords([0, 1, 2, 3, 4, 5, 6], '06:00')).toBe('Email me every day at 6:00 AM')
    expect(peopleWeekStartWords([1, 1], '')).toBe('Email me every Monday')
    expect(peopleWeekStartWords([], '06:00')).toBe('Pick a day')
  })
  it('says the cap only when it is reached', () => {
    expect(peopleWeekAboutWords(3)).toBe('About these people')
    expect(peopleWeekAboutWords(50)).toBe('About these people, 50 at most')
  })
  it('keeps the sheet’s words plain', () => {
    const words = [...Object.values(PEOPLE_WEEK_SHEET_WORDS), peopleWeekAboutWords(3), peopleWeekAboutWords(50), peopleWeekStartWords([1], '06:00'), peopleWeekStartWords([1, 4], '06:00'), peopleWeekStartWords([1, 3, 5], '06:00')]
    for (const w of words) expect(plainWordsFailures(w), w).toEqual([])
  })

  const many = Array.from({ length: 25 }, (_, i) => ({ id: `p${i}`, name: `Person ${String(i).padStart(2, '0')}` }))
  it('leads with the people picked and folds the rest of a long list behind a count', () => {
    expect(many.length).toBeGreaterThan(PEOPLE_WEEK_FOLD_OVER)
    const folded = peopleWeekPickList({ people: many, lead: ['p20', 'p3'], filter: '', unfolded: false })
    expect(folded.shown.map((p) => p.id)).toEqual(['p3', 'p20'])
    expect(folded.more).toBe(23)
    expect(folded.findBox).toBe(false)
    const open = peopleWeekPickList({ people: many, lead: ['p20', 'p3'], filter: '', unfolded: true })
    expect(open.shown.slice(0, 3).map((p) => p.id)).toEqual(['p3', 'p20', 'p0'])
    expect(open.shown).toHaveLength(25)
    expect(open.more).toBe(0)
    expect(open.findBox).toBe(true)
  })
  it('shows a short list whole, and a long one whole when nobody is picked yet or everyone is', () => {
    const few = many.slice(0, 10)
    expect(peopleWeekPickList({ people: few, lead: ['p9'], filter: '', unfolded: false })).toEqual({ shown: [few[9], ...few.slice(0, 9)], more: 0, findBox: false })
    expect(peopleWeekPickList({ people: many, lead: [], filter: '', unfolded: false }).shown).toHaveLength(25)
    expect(peopleWeekPickList({ people: many, lead: many.map((p) => p.id), filter: '', unfolded: false }).more).toBe(0)
  })
  it('finds across the whole list, picked or not, folded or not', () => {
    const found = peopleWeekPickList({ people: many, lead: ['p3'], filter: ' person 2 ', unfolded: false })
    expect(found.shown.map((p) => p.id)).toEqual(['p20', 'p21', 'p22', 'p23', 'p24'])
    expect(found.more).toBe(0)
  })
})
