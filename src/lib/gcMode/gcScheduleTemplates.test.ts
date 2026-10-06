import { describe, expect, it } from 'vitest'
import { initialGcState } from './gcFixture'
import { gcReducer } from './gcReducer'
import { plainWordsFailures } from '../plainWords'
import type { GcAction, GcProject, GcState } from './gcTypes'
import { scheduleLinesOf } from './gcBuildingSchedule'
import { scheduleDraft } from './gcNewProject'
import { drawWeeks, roughDraw, roughFirstDraftWords, roughWeeks } from './gcRoughSchedule'
import { customerSchedulePicture } from './gcCustomerSchedule'
import { keptPlaces } from './gcPlaces'
import {
  drawnFromWords,
  roughTemplateWords,
  stagesCovered,
  templateAsideWords,
  templateCovers,
  templateFitWords,
  templateSavedWords,
  templateShape,
  templateSizeWords,
  templateUsedLines,
  templateUses,
  templateWeeks,
  templatesOffered,
} from './gcScheduleTemplates'

/**
 * GC mode design spike: schedule templates (G-44). Fair Oaks Shops, Building D is being built, 72%
 * done on the made-up today, Fri Oct 2: 23 weeks from Mon Jul 6 to substantial completion on Fri Dec
 * 11. Boerne Retail Shell, still bidding, has nearly the same trades and lines; Helotes Dental Office,
 * in buyout, shares only some.
 */

const job = (s: GcState, id: string) => s.projects.find((p) => p.id === id)!
const play = (s: GcState, ...actions: GcAction[]) => actions.reduce((x, a) => gcReducer(x, a), s)
const save = (name = 'Fair Oaks Shops, Building D'): GcAction => ({ type: 'saveScheduleTemplate', projectId: 'fairoaksd', name, by: 'Robert' })
/** Fair Oaks D saved as a template, the made-up data otherwise as it is. */
const saved = () => play(initialGcState(), save())
const lineIdOf = (p: GcProject, trade: string, label: string) => scheduleLinesOf(p.packages.find((k) => k.trade === trade)!).find((l) => l.label === label)!.lineId
const BOERNE_START = '2026-11-02'

describe('saving a job’s shape (G-44)', () => {
  it('keeps Fair Oaks D’s lines with their days, waits and offsets, and its stages and weeks', () => {
    const s = saved()
    const [t] = s.scheduleTemplates ?? []
    expect(t).toMatchObject({ id: 'tpl-1', name: 'Fair Oaks Shops, Building D', on: '2026-10-02', by: 'Robert', from: { projectId: 'fairoaksd', name: 'Fair Oaks Shops, Building D', donePct: 72 }, weeks: 23 })
    expect(t?.lines.filter((l) => l.trade !== '')).toHaveLength(27)
    expect(t?.lines.filter((l) => l.trade === '').map((l) => l.label)).toEqual(['Rough-in inspection', 'Final inspection'])
    const line = (trade: string, label: string) => t?.lines.find((l) => l.trade === trade && l.label === label)
    // Erection ran 26 days, starting 2 days after Structural steel finished.
    expect(line('Structural steel', 'Erection')).toEqual({ trade: 'Structural steel', label: 'Erection', stage: 'structure', days: 26, after: [{ trade: 'Structural steel', label: 'Structural steel' }], offset: 2 })
    // Utilities waited on nothing: 19 days, from 7 days after the job's first day.
    expect(line('Sitework', 'Utilities to 5 ft of the building')).toMatchObject({ days: 19, after: [], offset: 7 })
    // Fire alarm: 19 days, 9 after the last of what it waited on, Lighting.
    expect(line('Electrical', 'Fire alarm')).toMatchObject({ days: 19, after: [{ trade: 'Electrical', label: 'Lighting' }, { trade: '', label: 'Rough-in inspection' }], offset: 9 })
    // Each stage's span there, first start to last finish: site finish ran from paving in August to site lighting in October.
    expect(t?.stages).toEqual([
      { key: 'sitePrep', days: 12 },
      { key: 'foundations', days: 19 },
      { key: 'underground', days: 26 },
      { key: 'slab', days: 19 },
      { key: 'structure', days: 47 },
      { key: 'dryIn', days: 31 },
      { key: 'roughIn', days: 61 },
      { key: 'trim', days: 82 },
      { key: 'siteFinish', days: 82 },
      { key: 'closeout', days: 5 },
    ])
    expect(t && templateSavedWords(t)).toBe('Saved Fri Oct 2 from Fair Oaks Shops, Building D, with 72% of the work done.')
    expect(t && templateSizeWords(t)).toBe('27 lines of 7 trades and its 2 inspections. 23 weeks to build there.')
  })

  it('holds no dates, companies, percents or moves', () => {
    const t = saved().scheduleTemplates?.[0]
    const shape = JSON.stringify({ lines: t?.lines, stages: t?.stages })
    expect(shape).not.toMatch(/\d{4}-\d{2}-\d{2}/)
    for (const p of initialGcState().partners) expect(shape).not.toContain(p.company)
    // Only these fields, so no percent, actual date, move, start, finish or limit rides along. A kept place and a split line's
    // parts join a line only where the office kept or split one, and the made-up job has none.
    expect([...new Set(t?.lines.flatMap((l) => Object.keys(l)))].sort()).toEqual(['after', 'days', 'label', 'offset', 'stage', 'trade'])
    expect([...new Set(t?.lines.flatMap((l) => l.after.flatMap((w) => Object.keys(w))))].sort()).toEqual(['label', 'trade'])
    // The electrical service inspection was Fair Oaks D's own, not one the first draft draws: it stays with its job.
    expect(shape).not.toContain('Electrical service inspection')
  })

  it('keeps a gap the office set on a wait, and the draw sets it again', () => {
    const base = initialGcState()
    const fo = job(base, 'fairoaksd')
    const steel = lineIdOf(fo, 'Structural steel', 'Structural steel')
    const footings = lineIdOf(fo, 'Concrete', 'Foundations')
    // Seven days of cure after the foundations: steel still starts Aug 17, 9 days after they finished.
    const cured: GcState = { ...base, projects: base.projects.map((p) => (p.id === 'fairoaksd' && p.schedule ? { ...p, schedule: { ...p.schedule, activities: p.schedule.activities.map((a) => (a.lineId === steel ? { ...a, lag: { [footings]: 7 } } : a)) } } : p)) }
    const t = templateShape(cured, job(cured, 'fairoaksd'))
    expect(t?.lines.find((l) => l.label === 'Structural steel')).toMatchObject({ after: [{ trade: 'Concrete', label: 'Foundations', gap: 7 }], offset: 9 })
    const redrawn = scheduleDraft(job(cured, 'fairoaksd'), '2026-07-06', undefined, t?.lines)
    expect(redrawn.activities.find((a) => a.lineId === steel)).toMatchObject({ start: '2026-08-17', lag: { [footings]: 7 } })
  })
})

describe('a kept place and a split line ride with the line (G-83, G-39)', () => {
  it('keeps them on the template and writes them on the same line of the next job, with nothing done', () => {
    const base = initialGcState()
    const fo = job(base, 'fairoaksd')
    const roughIn = lineIdOf(fo, 'Plumbing', 'Rough in')
    const lighting = lineIdOf(fo, 'Electrical', 'Lighting')
    let s = play(
      base,
      { type: 'setActivityPlaces', projectId: 'fairoaksd', places: { [roughIn]: 'Inside' } },
      { type: 'splitActivity', projectId: 'fairoaksd', lineId: lighting, parts: [{ name: 'Sales floor', start: '2026-09-14', finish: '2026-10-09' }, { name: 'Back of house', start: '2026-10-05', finish: '2026-10-23' }], by: 'Robert' },
      save(),
    )
    const t = s.scheduleTemplates?.[0]
    expect(t?.lines.find((l) => l.label === 'Rough in')?.place).toBe('Inside')
    const split = job(s, 'fairoaksd').schedule?.activities.find((a) => a.lineId === lighting)?.parts ?? []
    expect(t?.lines.find((l) => l.label === 'Lighting')?.parts).toEqual(split.map((x) => ({ name: x.name, from: x.from, days: x.days, share: x.share })))
    expect(split.map((x) => [x.name, x.from, x.days])).toEqual([
      ['Sales floor', 0, 26],
      ['Back of house', 21, 19],
    ])
    // Helotes Dental Office has a plumbing rough-in and lighting by the same names: the place is kept there, the parts split, nothing done.
    s = play(s, { type: 'draftSchedule', projectId: 'helotes', start: '2026-10-12', templateId: 'tpl-1' })
    const helotes = job(s, 'helotes')
    expect(keptPlaces(helotes).get(lineIdOf(helotes, 'Plumbing', 'Rough in'))).toBe('Inside')
    const lit = helotes.schedule?.activities.find((a) => a.lineId === lineIdOf(helotes, 'Electrical', 'Lighting'))
    expect(lit?.parts?.map((x) => [x.id, x.name, x.from, x.days, x.pct])).toEqual([
      [`${lit?.lineId}-p1`, 'Sales floor', 0, 26, 0],
      [`${lit?.lineId}-p2`, 'Back of house', 21, 19, 0],
    ])
  })
})

describe('the pin: a job redrawn from its own template lands on its own dates', () => {
  it('draws every trade line and both inspections of Fair Oaks D on its own dates, from Mon Jul 6', () => {
    const s = saved()
    const fo = job(s, 'fairoaksd')
    const redrawn = scheduleDraft(fo, '2026-07-06', undefined, s.scheduleTemplates?.[0]?.lines)
    const was = fo.schedule?.activities ?? []
    const trades = was.filter((a) => !a.inspection)
    expect(trades).toHaveLength(27)
    for (const a of trades) expect([a.lineId, ...[redrawn.activities.find((b) => b.lineId === a.lineId)].map((b) => [b?.start, b?.finish])]).toEqual([a.lineId, [a.start, a.finish]])
    for (const label of ['Rough-in inspection', 'Final inspection']) {
      const a = was.find((x) => x.inspection?.label === label)
      const b = redrawn.activities.find((x) => x.inspection?.label === label)
      expect([label, b?.start, b?.finish]).toEqual([label, a?.start, a?.finish])
    }
    expect(drawWeeks(redrawn)).toMatchObject({ weeks: 23, start: '2026-07-06', finish: '2026-12-11' })
  })

  it('draws exactly today’s first draft with no template: the empty one changes nothing on any job', () => {
    // With neither optional argument the draw is G-45's, and its snapshot of every fixture job holds that (gcRoughSchedule.test.ts).
    const s = initialGcState()
    for (const p of s.projects) expect(scheduleDraft(p, '2026-10-12', undefined, [])).toEqual(scheduleDraft(p, '2026-10-12'))
  })
})

describe('the rough while bidding, from a template', () => {
  it('draws Boerne Retail Shell like Fair Oaks D: 27 of 31 lines covered, 27 weeks, not 14', () => {
    const s = saved()
    const boerne = job(s, 'boerne')
    const t = templatesOffered(s)[0]!
    expect(templateCovers(t.lines, boerne)).toEqual({ covered: 27, total: 31 })
    expect(templateWeeks(boerne, BOERNE_START, t.lines)).toEqual({ weeks: 27, finish: '2027-05-04', without: 14 })
    // Its fire sprinkler, which Fair Oaks D had none of, is drawn by the first draft's rules: the mains after the
    // roof, and the rough-in inspection after the mains. Without it, the shell takes Fair Oaks D's own 23 weeks.
    const shell = { ...boerne, packages: boerne.packages.filter((k) => k.trade !== 'Fire sprinkler') }
    expect(templateWeeks(shell, BOERNE_START, t.lines)).toEqual({ weeks: 23, finish: '2027-04-09', without: 14 })
    // The fit, before anything is drawn.
    expect(templateFitWords(t, boerne, BOERNE_START)).toBe(
      'The template Fair Oaks Shops, Building D covers 27 of the 31 lines here. Those run as they ran there. The other 4 take the stage days. It makes 27 weeks to build. Without it, 14 weeks.',
    )
    const drawn = play(s, { type: 'setRough', projectId: 'boerne', start: BOERNE_START, days: {}, by: 'Robert', templateId: 'tpl-1' })
    const rough = job(drawn, 'boerne').rough
    expect(rough?.template).toEqual({ id: 'tpl-1', name: 'Fair Oaks Shops, Building D', on: '2026-10-02' })
    expect(rough?.like).toEqual(t.lines)
    expect(roughWeeks(job(drawn, 'boerne'))).toMatchObject({ weeks: 27, finish: '2027-05-04' })
    expect(roughTemplateWords(job(drawn, 'boerne'))).toBe('Drawn from the template Fair Oaks Shops, Building D. It covers 27 of the 31 lines here.')
    // Its 4 other lines are the first draft's own: the fire sprinkler's design and permit takes site prep's 10 days.
    const permit = roughDraw(job(drawn, 'boerne'))?.activities.find((a) => a.lineId === lineIdOf(boerne, 'Fire sprinkler', 'Design and permit'))
    expect(permit).toMatchObject({ start: BOERNE_START, finish: '2026-11-11' })
    // Every stage but the four with those lines takes its days from the template.
    expect([...stagesCovered(t.lines, boerne)].sort()).toEqual(['closeout', 'dryIn', 'siteFinish', 'slab', 'structure', 'underground'])
  })

  it('takes a copy: renaming the template or setting it aside never changes the rough', () => {
    const drawn = play(saved(), { type: 'setRough', projectId: 'boerne', start: BOERNE_START, days: {}, by: 'Robert', templateId: 'tpl-1' })
    const before = roughDraw(job(drawn, 'boerne'))
    const later = play(drawn, { type: 'renameScheduleTemplate', templateId: 'tpl-1', name: 'Retail shell' }, { type: 'setAsideScheduleTemplate', templateId: 'tpl-1', aside: true, by: 'Robert' })
    expect(later.scheduleTemplates?.[0]).toMatchObject({ name: 'Retail shell', asideOn: '2026-10-02' })
    expect(roughDraw(job(later, 'boerne'))).toEqual(before)
    expect(job(later, 'boerne').rough?.template?.name).toBe('Fair Oaks Shops, Building D')
    // A redraw keeps the rough's template, even set aside; null goes back to the stage days alone.
    const redrawn = play(later, { type: 'setRough', projectId: 'boerne', start: BOERNE_START, days: { structure: 20 }, by: 'Robert' })
    expect(job(redrawn, 'boerne').rough?.template?.id).toBe('tpl-1')
    const plain = play(later, { type: 'setRough', projectId: 'boerne', start: BOERNE_START, days: {}, by: 'Robert', templateId: null })
    expect(job(plain, 'boerne').rough?.template).toBeUndefined()
    expect(roughWeeks(job(plain, 'boerne'))?.weeks).toBe(14)
  })
})

describe('the first draft, from a template', () => {
  it('draws Helotes Dental Office from it, records it, and tells the customer nothing', () => {
    const s = saved()
    const helotes = job(s, 'helotes')
    const t = templatesOffered(s)[0]!
    expect(templateCovers(t.lines, helotes)).toEqual({ covered: 8, total: 17 })
    expect(templateFitWords(t, helotes, '2026-10-12')).toBe(
      'The template Fair Oaks Shops, Building D covers 8 of the 17 lines here. Those run as they ran there. The other 9 take the stage days. It makes 19 weeks to build. Without it, 10 weeks.',
    )
    const drawn = play(s, { type: 'draftSchedule', projectId: 'helotes', start: '2026-10-12', templateId: 'tpl-1' })
    const schedule = job(drawn, 'helotes').schedule
    expect(schedule?.template).toEqual({ id: 'tpl-1', name: 'Fair Oaks Shops, Building D', on: '2026-10-02' })
    expect(schedule && drawWeeks(schedule)?.weeks).toBe(19)
    expect(schedule?.template && drawnFromWords(schedule.template)).toBe('Drawn from the template Fair Oaks Shops, Building D, Fri Oct 2.')
    expect(drawn.log[0]?.text).toBe('Drew a first draft of the schedule on Helotes Dental Office: 19 activities from Mon Oct 12. It is drawn from the template Fair Oaks Shops, Building D.')
    expect(JSON.stringify(customerSchedulePicture(drawn, job(drawn, 'helotes')))).not.toMatch(/template|Fair Oaks/)
  })

  it('draws at award as the rough did, from the rough’s copy, even with the template set aside', () => {
    let s = play(saved(), { type: 'setRough', projectId: 'boerne', start: BOERNE_START, days: {}, by: 'Robert', templateId: 'tpl-1' })
    s = play(s, { type: 'setAsideScheduleTemplate', templateId: 'tpl-1', aside: true, by: 'Robert' })
    // Won: Boerne goes to buyout with its rough.
    s = { ...s, projects: s.projects.map((p) => (p.id === 'boerne' ? { ...p, stage: 'buyout' } : p)) }
    expect(roughFirstDraftWords(job(s, 'boerne'))).toBe('We bid 27 weeks, from the rough schedule drawn from a template. The first draft starts from it the same way.')
    const rough = job(s, 'boerne').rough!
    const drawn = play(s, { type: 'draftSchedule', projectId: 'boerne', start: rough.start, days: rough.days, templateId: 'tpl-1' })
    const schedule = job(drawn, 'boerne').schedule
    expect(schedule?.activities).toEqual(scheduleDraft(job(s, 'boerne'), rough.start, rough.days, rough.like).activities)
    expect(schedule?.template).toEqual({ id: 'tpl-1', name: 'Fair Oaks Shops, Building D', on: '2026-10-02' })
  })
})

describe('what is refused', () => {
  it('saves only a job being built with a schedule, under a name of its own', () => {
    const s = initialGcState()
    const refused: GcAction[] = [
      // Stone Oak Pharmacy is being built with nothing drawn; Helotes is in buyout.
      { type: 'saveScheduleTemplate', projectId: 'stoneoak', name: 'Pharmacy', by: 'Robert' },
      { type: 'saveScheduleTemplate', projectId: 'helotes', name: 'Dental', by: 'Robert' },
      save('   '),
      save('x'.repeat(61)),
    ]
    for (const a of refused) expect(gcReducer(s, a)).toBe(s)
    const one = saved()
    expect(gcReducer(one, save('fair oaks shops,  building d'))).toBe(one)
    expect(gcReducer(one, { type: 'renameScheduleTemplate', templateId: 'tpl-1', name: '' })).toBe(one)
    const two = play(one, { type: 'saveScheduleTemplate', projectId: 'fairoaksd', name: 'Retail shell', by: 'Robert' })
    expect(two.scheduleTemplates?.map((t) => t.id)).toEqual(['tpl-1', 'tpl-2'])
    expect(gcReducer(two, { type: 'renameScheduleTemplate', templateId: 'tpl-2', name: 'Fair Oaks Shops, Building D' })).toBe(two)
  })

  it('draws from no template set aside or unknown', () => {
    const aside = play(saved(), { type: 'setAsideScheduleTemplate', templateId: 'tpl-1', aside: true, by: 'Robert' })
    expect(templatesOffered(aside)).toEqual([])
    expect(aside.scheduleTemplates?.[0] && templateAsideWords(aside.scheduleTemplates[0])).toBe('Set aside Fri Oct 2. New jobs are not offered it. The jobs drawn from it keep what they drew.')
    for (const a of [
      { type: 'setRough', projectId: 'boerne', start: BOERNE_START, days: {}, by: 'Robert', templateId: 'tpl-1' },
      { type: 'draftSchedule', projectId: 'helotes', start: '2026-10-12', templateId: 'tpl-1' },
      { type: 'draftSchedule', projectId: 'helotes', start: '2026-10-12', templateId: 'tpl-9' },
    ] satisfies GcAction[])
      expect(gcReducer(aside, a)).toBe(aside)
    // Brought back, it is offered again.
    const back = play(aside, { type: 'setAsideScheduleTemplate', templateId: 'tpl-1', aside: false, by: 'Robert' })
    expect(templatesOffered(back).map((t) => t.id)).toEqual(['tpl-1'])
    expect(back.scheduleTemplates?.[0]?.asideOn).toBeUndefined()
  })
})

describe('where each job came from', () => {
  it('lists the jobs drawn from a template, from their own records', () => {
    const s = play(
      saved(),
      { type: 'setRough', projectId: 'boerne', start: BOERNE_START, days: {}, by: 'Robert', templateId: 'tpl-1' },
      { type: 'draftSchedule', projectId: 'helotes', start: '2026-10-12', templateId: 'tpl-1' },
    )
    expect(templateUses(s, 'tpl-1')).toEqual([
      { projectId: 'boerne', name: 'Boerne Retail Shell', what: 'rough', on: '2026-10-02' },
      { projectId: 'helotes', name: 'Helotes Dental Office', what: 'firstDraft', on: '2026-10-02' },
    ])
    const t = s.scheduleTemplates?.[0]
    expect(t && templateUsedLines(s, t)).toEqual(["Boerne Retail Shell's rough schedule, Fri Oct 2.", "Helotes Dental Office's first draft, Fri Oct 2."])
  })

  it('says every sentence in plain words', () => {
    const s = play(saved(), { type: 'setRough', projectId: 'boerne', start: BOERNE_START, days: {}, by: 'Robert', templateId: 'tpl-1' })
    const t = s.scheduleTemplates?.[0]
    if (!t) throw new Error('no template saved')
    const aside = play(s, { type: 'setAsideScheduleTemplate', templateId: 'tpl-1', aside: true, by: 'Robert' }).scheduleTemplates?.[0]
    const sentences = [
      templateSavedWords(t),
      templateSizeWords(t),
      ...templateUsedLines(s, t),
      aside ? (templateAsideWords(aside) ?? '') : '',
      templateFitWords(t, job(s, 'boerne'), BOERNE_START),
      templateFitWords(t, job(s, 'helotes'), '2026-10-12'),
      roughTemplateWords(job(s, 'boerne')) ?? '',
      drawnFromWords({ id: t.id, name: t.name, on: t.on }),
      s.log[0]?.text ?? '',
    ]
    expect(sentences.flatMap(plainWordsFailures)).toEqual([])
  })
})
