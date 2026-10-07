/**
 * Main's own tests for schedule templates (G-44; the schedule's PR 1b): a template's name, its size,
 * what it covers on another job, the weeks it makes, and the jobs drawn from it, run through the
 * kernels on the test data. The spike's own cases: Fair Oaks Shops, Building D saved as a template on
 * Fri Oct 2, 23 weeks to build; Boerne Retail Shell, still bidding, has nearly the same trades and
 * lines; Helotes Dental Office, in buyout, shares only some. A template is kept as Save as a template
 * keeps it, and a rough or a first draft drawn from it as the spike's reducer draws them.
 */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../../plainWords'
import type { GcProject, GcState } from '../types'
import { weekdayDate } from '../words'
import { scheduleDraft } from './draft'
import { drawWeeks, roughWeeks } from './rough'
import {
  roughTemplateWords,
  stagesCovered,
  templateCovers,
  templateFitWords,
  templateNameProblem,
  templateSaveProblem,
  templateShape,
  templateSizeWords,
  templateUses,
  templateWeeks,
} from './templates'
import { initialGcState } from './testState'
import type { ScheduleTemplate } from './types'

const job = (s: GcState, id: string) => s.projects.find((p) => p.id === id)!
const withJob = (s: GcState, project: GcProject): GcState => ({ ...s, projects: s.projects.map((p) => (p.id === project.id ? project : p)) })
const BOERNE_START = '2026-11-02'

/** Fair Oaks D saved as a template, as Save as a template keeps it. */
function saved(s = initialGcState(), name = 'Fair Oaks Shops, Building D'): GcState {
  const all = s.scheduleTemplates ?? []
  const template: ScheduleTemplate = { id: `tpl-${all.length + 1}`, name, on: s.today, by: 'Robert', ...templateShape(s, job(s, 'fairoaksd'))! }
  return { ...s, scheduleTemplates: [...all, template] }
}
const tpl = (s: GcState) => s.scheduleTemplates![0]!
/** Boerne's rough drawn from the template: its lines copied onto the rough. */
const roughFrom = (s: GcState): GcState =>
  withJob(s, { ...job(s, 'boerne'), rough: { start: BOERNE_START, days: {}, by: 'Robert', on: s.today, template: { id: tpl(s).id, name: tpl(s).name, on: s.today }, like: tpl(s).lines } })
/** Helotes' first draft drawn from the template, from Mon Oct 12. */
const draftFrom = (s: GcState): GcState =>
  withJob(s, { ...job(s, 'helotes'), schedule: { ...scheduleDraft(job(s, 'helotes'), '2026-10-12', undefined, tpl(s).lines), template: { id: tpl(s).id, name: tpl(s).name, on: s.today } } })

describe('a template’s name and size', () => {
  it('says Fair Oaks D’s size: its lines, its trades, its inspections and its weeks there', () => {
    expect(templateSizeWords(tpl(saved()))).toBe('27 lines of 7 trades and its 2 inspections. 23 weeks to build there.')
  })

  it('refuses a name blank, too long, or another template’s, and lets a template keep its own', () => {
    const s = initialGcState()
    expect(templateNameProblem(s, '   ')).toBe('Give it a name.')
    expect(templateNameProblem(s, 'x'.repeat(61))).toBe('Keep the name to 60 letters.')
    expect(templateNameProblem(s, 'Fair Oaks Shops, Building D')).toBeNull()
    const one = saved()
    expect(templateNameProblem(one, 'fair oaks shops,  building d')).toBe('Another template has that name.')
    expect(templateNameProblem(one, 'Fair Oaks Shops, Building D', 'tpl-1')).toBeNull()
    expect(templateNameProblem(one, 'Retail shell')).toBeNull()
  })
})

describe('the rough while bidding, from a template', () => {
  it('fits Boerne Retail Shell like Fair Oaks D: 27 of 31 lines covered, 27 weeks, not 14', () => {
    const s = saved()
    const boerne = job(s, 'boerne')
    const t = tpl(s)
    expect(templateCovers(t.lines, boerne)).toEqual({ covered: 27, total: 31 })
    expect(templateWeeks(boerne, BOERNE_START, t.lines)).toEqual({ weeks: 27, finish: '2027-05-04', without: 14 })
    // Without its fire sprinkler, which Fair Oaks D had none of, the shell takes Fair Oaks D's own 23 weeks.
    const shell = { ...boerne, packages: boerne.packages.filter((k) => k.trade !== 'Fire sprinkler') }
    expect(templateWeeks(shell, BOERNE_START, t.lines)).toEqual({ weeks: 23, finish: '2027-04-09', without: 14 })
    expect(templateFitWords(t, boerne, BOERNE_START)).toBe(
      'The template Fair Oaks Shops, Building D covers 27 of the 31 lines here. Those run as they ran there. The other 4 take the stage days. It makes 27 weeks to build. Without it, 14 weeks.',
    )
    // Every stage but the four with those lines takes its days from the template.
    expect([...stagesCovered(t.lines, boerne)].sort()).toEqual(['closeout', 'dryIn', 'siteFinish', 'slab', 'structure', 'underground'])
  })

  it('says the rough was drawn from it, and nothing for a rough on the stage days alone', () => {
    const s = roughFrom(saved())
    expect(roughWeeks(job(s, 'boerne'))).toMatchObject({ weeks: 27, finish: '2027-05-04' })
    expect(roughTemplateWords(job(s, 'boerne'))).toBe('Drawn from the template Fair Oaks Shops, Building D. It covers 27 of the 31 lines here.')
    const plain = { ...job(s, 'boerne'), rough: { start: BOERNE_START, days: {}, by: 'Robert', on: s.today } }
    expect(roughTemplateWords(plain)).toBeNull()
  })
})

describe('the first draft, from a template, and where each job came from', () => {
  it('fits Helotes Dental Office: 8 of its 17 lines, 19 weeks, not 10', () => {
    const s = saved()
    expect(templateCovers(tpl(s).lines, job(s, 'helotes'))).toEqual({ covered: 8, total: 17 })
    expect(templateFitWords(tpl(s), job(s, 'helotes'), '2026-10-12')).toBe(
      'The template Fair Oaks Shops, Building D covers 8 of the 17 lines here. Those run as they ran there. The other 9 take the stage days. It makes 19 weeks to build. Without it, 10 weeks.',
    )
  })

  it('lists the jobs drawn from a template, from their own records', () => {
    const s = draftFrom(roughFrom(saved()))
    expect(templateUses(s, 'tpl-1')).toEqual([
      { projectId: 'boerne', name: 'Boerne Retail Shell', what: 'rough', on: '2026-10-02' },
      { projectId: 'helotes', name: 'Helotes Dental Office', what: 'firstDraft', on: '2026-10-02' },
    ])
    expect(templateUses(s, 'tpl-9')).toEqual([])
  })

  it('says every sentence in plain words', () => {
    const s = roughFrom(saved())
    const t = tpl(s)
    const sentences = [templateSizeWords(t), templateFitWords(t, job(s, 'boerne'), BOERNE_START), templateFitWords(t, job(s, 'helotes'), '2026-10-12'), roughTemplateWords(job(s, 'boerne')) ?? '']
    expect(sentences.flatMap(plainWordsFailures)).toEqual([])
  })
})

describe('saving a job as a template, or why not (the schedule’s PR 5)', () => {
  /** Fair Oaks D with its schedule changed. */
  const fairOaksWith = (s: GcState, change: (schedule: NonNullable<GcProject['schedule']>) => NonNullable<GcProject['schedule']>): GcProject => {
    const fo = job(s, 'fairoaksd')
    return { ...fo, schedule: change(fo.schedule!) }
  }

  it('lets Fair Oaks D go under a new name', () => {
    const s = initialGcState()
    expect(templateSaveProblem(s, job(s, 'fairoaksd'), 'Retail shell')).toBeNull()
  })

  it('refuses a job not being built, and a name the template rules refuse', () => {
    const s = initialGcState()
    expect(templateSaveProblem(s, job(s, 'helotes'), 'Clinic')).toBe('Only a job being built can be saved as a template.')
    const one = saved()
    expect(templateSaveProblem(one, job(one, 'fairoaksd'), 'fair oaks shops,  building d')).toBe('Another template has that name.')
    expect(templateSaveProblem(s, { ...job(s, 'fairoaksd'), schedule: undefined }, 'Retail shell')).toBe('Draw the schedule first.')
  })

  it('words a schedule with no trade’s line before the table refuses it', () => {
    const s = initialGcState()
    const bare = fairOaksWith(s, (sch) => ({ ...sch, activities: sch.activities.filter((a) => a.inspection) }))
    // What the table refuses: a template of inspections alone covers no line on another job.
    expect(templateShape(s, bare)?.lines.every((l) => l.trade === '')).toBe(true)
    expect(templateSaveProblem(s, bare, 'Inspections only')).toBe("A template keeps the trades' lines. This schedule has none yet.")
  })

  it('words a substantial completion planned before the first start before the table refuses its weeks', () => {
    const s = initialGcState()
    const early = fairOaksWith(s, (sch) => ({ ...sch, milestones: sch.milestones.map((m) => (/substantial completion/i.test(m.label) ? { ...m, planned: '2026-06-01' } : m)) }))
    // What the table refuses: weeks under one.
    expect(templateShape(s, early)?.weeks).toBeLessThan(1)
    const first = drawWeeks(early.schedule!)!.start
    expect(first > '2026-06-01').toBe(true)
    expect(templateSaveProblem(s, early, 'Too early')).toBe(`Substantial completion is planned Mon Jun 1, before the work starts ${weekdayDate(first)}. Move it to a day after the work starts.`)
  })

  it('says every refusal in plain words', () => {
    const s = initialGcState()
    const bare = fairOaksWith(s, (sch) => ({ ...sch, activities: sch.activities.filter((a) => a.inspection) }))
    const early = fairOaksWith(s, (sch) => ({ ...sch, milestones: sch.milestones.map((m) => (/substantial completion/i.test(m.label) ? { ...m, planned: '2026-06-01' } : m)) }))
    const sentences = [
      templateSaveProblem(s, job(s, 'helotes'), 'Clinic'),
      templateSaveProblem(s, { ...job(s, 'fairoaksd'), schedule: undefined }, 'Retail shell'),
      templateSaveProblem(s, bare, 'Inspections only'),
      templateSaveProblem(s, early, 'Too early'),
    ]
    expect(sentences.every(Boolean)).toBe(true)
    expect(sentences.flatMap((x) => plainWordsFailures(x ?? ''))).toEqual([])
  })
})
