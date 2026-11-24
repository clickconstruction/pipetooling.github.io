import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { documentBuilderById, type DocumentBuilderEntry } from './builders'
import { firstDraftOf } from './firstDrafts'
import { INSURANCE_SHEET_FIXTURE } from './insuranceSheet.fixture'
import { SHEET_NEW, coverPath, parseSheetDef, sheetDefProblems, startJobSheet, withJobWords, withUsualWords, fieldPath, type SheetDef } from './sheet'
import { sheetPrintHtml, sheetPrintTitle, SHEET_SENT_KIND } from './sheetPrint'
import { layOver } from './sheet'
import {
  filledRowChips,
  sheetCountChip,
  sheetCounts,
  jobHasOwnChanges,
  jobHasSomethingToPublish,
  gcJobOver,
  jobIsBehind,
  jobPickLabel,
  listedJobs,
  jobIsOnUsual,
  jobsOnUsual,
  jobPublishPress,
  readPress,
  sheetBarChips,
  sheetCaption,
  sheetNote,
  sheetStamp,
  USUAL_PRESS_MOVED,
  usualJobsHead,
  usualPlanChip,
  usualPlanFor,
  usualPublishPress,
  type JobSheetState,
} from './sheetScreen'
import { builderRecordFromRow, type BuilderRecord } from './standing'
import { sentKindGroup } from '../sent/sentCopies'

const INSURANCE = documentBuilderById('insurance') as DocumentBuilderEntry
const USUAL: SheetDef = { ...INSURANCE_SHEET_FIXTURE, cover: INSURANCE_SHEET_FIXTURE.cover.map((c, i) => ({ ...c, limit: `Made-up amount ${i + 1}` })) }
const OWN = () => startJobSheet({ name: 'Cedar Park Medical Office', place: '410 Sample Street, Cedar Park, TX 78613', insured: ['Pecan Ridge Holdings, Ltd.'] })

const rec = (over: Record<string, unknown> = {}) =>
  builderRecordFromRow({ key: 'insurance', kind: 'filled', draft: USUAL, published: null, revision: 0, published_at: null, read_revision: null, read_by_name: '', read_on: null, updated_at: null, ...over }) as BuilderRecord
const published = (revision = 1, over: Record<string, unknown> = {}) => rec({ published: USUAL, revision, ...over })
const job = (over: Partial<JobSheetState> = {}): JobSheetState => ({ id: 's1', own: OWN(), published: null, revision: 0, usualRevision: null, ...over })
const out = (over: Partial<JobSheetState> = {}): JobSheetState => job({ published: OWN(), revision: 1, usualRevision: 1, ...over })

describe('where a job’s sheet stands', () => {
  it('has something to publish before its first publish, after a change of its own, and behind the usual', () => {
    expect(jobHasSomethingToPublish(job(), 1)).toBe(true)
    expect(jobHasSomethingToPublish(out(), 1)).toBe(false)
    const changed = out({ own: withJobWords(USUAL, OWN(), coverPath('umb', 'limit'), 'Made-up amount 9') })
    expect(jobHasOwnChanges(changed)).toBe(true)
    expect(jobHasSomethingToPublish(changed, 1)).toBe(true)
    expect(jobIsBehind(out(), 2)).toBe(true)
    expect(jobIsBehind(out(), 1)).toBe(false)
    expect(jobIsBehind(job(), 2)).toBe(false)
    expect(jobHasSomethingToPublish(out(), 2)).toBe(true)
  })

  it('words the press that publishes a job’s sheet, dead with what is missing', () => {
    expect(jobPublishPress(job(), { def: USUAL, revision: 1 })).toEqual({ label: "Publish this job's sheet", dead: false, why: [] })
    expect(jobPublishPress(job(), { def: USUAL, revision: 0 })).toEqual({ label: "Publish this job's sheet", dead: true, why: ['Publish your usual sheet first.'] })
    expect(jobPublishPress(out(), { def: USUAL, revision: 1 })).toEqual({ label: 'Nothing to publish', dead: true, why: [] })
  })

  it('says under the switch what is being changed and what subs see', () => {
    const clean = { revision: 1, dirty: false }
    expect(sheetNote('usual', null, clean)).toBe('You are changing your usual sheet. Every job starts on it.')
    expect(sheetNote('job', null, clean)).toBe('Pick a job you run as the GC.')
    expect(sheetNote('job', job(), clean)).toBe('No sub sees a sheet for this job until you publish.')
    expect(sheetNote('job', out(), { revision: 2, dirty: false })).toBe('Your usual changed since this sheet was published. Publish to bring it up.')
    expect(sheetNote('job', out({ own: withJobWords(USUAL, OWN(), coverPath('umb', 'limit'), 'Made-up amount 9') }), clean)).toBe('Changed. Subs see revision 1 until you publish.')
    expect(sheetNote('job', out(), { revision: 1, dirty: true })).toBe('Your usual has changes not yet published. This sheet does not show them.')
    expect(sheetNote('job', out(), clean)).toBe('Subs see what you see.')
  })

  it('captions and stamps the sheet', () => {
    expect(sheetCaption('usual', true)).toBe('The standing sheet. Press any words to change them for every job.')
    expect(sheetCaption('job', true)).toBe("This job's sheet. Press any words to change them.")
    expect(sheetCaption('job', false)).toBe('The sheet, as a sub sees it')
    expect(sheetStamp('usual', null, 1)).toBe('The standing sheet. No job is on it.')
    expect(sheetStamp('job', { ...job(), name: 'Cedar Park Medical Office' }, 1)).toBe('Draft. Not published.')
    expect(sheetStamp('job', { ...out(), name: 'Cedar Park Medical Office' }, 1)).toBe('Revision 1 · Cedar Park Medical Office')
    expect(sheetStamp('job', { ...out(), name: 'Cedar Park Medical Office' }, 2)).toBe('Revision 2, not yet published · Cedar Park Medical Office')
  })
})

describe('the usual’s publish', () => {
  const jobs = [
    { projectId: 'cedar', name: 'Cedar Park Medical Office' },
    { projectId: 'mesa', name: 'Mesa Verde Retail Shell' },
    { projectId: 'pike', name: 'Pike Street Clinic' },
  ]
  const sheets = new Map<string, JobSheetState>([
    ['cedar', out()],
    ['pike', out({ own: withJobWords(USUAL, OWN(), coverPath('umb', 'limit'), 'Made-up amount 9') })],
  ])

  it('plans where a change goes from every job the company runs as the GC', () => {
    expect(usualPlanFor(jobs, sheets)).toEqual([
      { id: 'cedar', name: 'Cedar Park Medical Office', gets: true, asRevision: 2 },
      { id: 'mesa', name: 'Mesa Verde Retail Shell', gets: false, why: 'no-sheet' },
      { id: 'pike', name: 'Pike Street Clinic', gets: false, why: 'own-changes' },
    ])
  })

  it('says its count on the press, and still publishes the usual when no job is ready', () => {
    const changed = withUsualWords(USUAL, fieldPath('foot'), 'A new foot line.')
    expect(usualPublishPress(changed, published(), usualPlanFor(jobs, sheets))).toEqual({ label: 'Publish to 1 job', dead: false, why: [] })
    expect(usualPublishPress(changed, published(), usualPlanFor(jobs, new Map()))).toEqual({ label: 'Publish your usual', dead: false, why: [] })
    expect(usualPublishPress(USUAL, rec(), [])).toEqual({ label: 'Publish your usual', dead: false, why: [] })
    expect(usualPublishPress(USUAL, published(), usualPlanFor(jobs, sheets))).toEqual({ label: 'Nothing to publish', dead: true, why: [] })
  })

  it('is dead while an amount is still the placeholder, and says which', () => {
    const press = usualPublishPress(INSURANCE_SHEET_FIXTURE, rec({ draft: INSURANCE_SHEET_FIXTURE }), [])
    expect(press.dead).toBe(true)
    expect(press.why[0]).toBe('Commercial general liability has no amount yet.')
  })

  it('says in plain words that the jobs moved and nothing was published', () => {
    expect(USUAL_PRESS_MOVED.line).toBe('Nothing was published yet.')
    expect([USUAL_PRESS_MOVED.line, USUAL_PRESS_MOVED.why].flatMap((t) => plainWordsFailures(t))).toEqual([])
  })

  it('chips each job with where the change goes', () => {
    const plan = usualPlanFor(jobs, sheets)
    expect(plan.map((row) => usualPlanChip(row, true, 1))).toEqual([
      { tone: 'ok', words: 'Gets it, as revision 2' },
      { tone: 'wait', words: 'Held. It has no sheet yet.' },
      { tone: 'warn', words: 'Held. It has changes of its own waiting.' },
    ])
    expect(usualPlanChip(plan[0]!, false, 1)).toEqual({ tone: 'ok', words: 'Revision 1' })
  })

  it('lists a job that is bid, bought out or built, and one that is over only when its sheet went out', () => {
    expect(gcJobOver({ stage: 'bidding', lostOn: null, closedOn: null })).toBeNull()
    expect(gcJobOver({ stage: 'buyout', lostOn: null, closedOn: null })).toBeNull()
    expect(gcJobOver({ stage: 'building', lostOn: null, closedOn: null })).toBeNull()
    expect(gcJobOver({ stage: 'bidding', lostOn: '2026-11-02', closedOn: null })).toBe('lost')
    expect(gcJobOver({ stage: 'closed', lostOn: '2026-11-02', closedOn: '2026-11-03' })).toBe('lost')
    expect(gcJobOver({ stage: 'closed', lostOn: null, closedOn: null })).toBe('closed')
    expect(gcJobOver({ stage: 'building', lostOn: null, closedOn: '2026-11-03' })).toBe('closed')
    const all = [
      { projectId: 'alder', over: null },
      { projectId: 'birch', over: 'lost' as const },
      { projectId: 'cedar', over: 'closed' as const },
      { projectId: 'dune', over: 'lost' as const },
    ]
    const revision = (id: string) => ({ cedar: 2, dune: 0 })[id] ?? 0
    expect(listedJobs(all, revision).map((j) => j.projectId)).toEqual(['alder', 'cedar'])
    expect(jobPickLabel({ name: 'Alder Row Shops', over: null }, 0)).toBe('Alder Row Shops, no sheet yet')
    expect(jobPickLabel({ name: 'Alder Row Shops' }, 1)).toBe('Alder Row Shops')
    expect(jobPickLabel({ name: 'Cedar Park Medical Office', over: 'closed' }, 2)).toBe('Cedar Park Medical Office, closed')
  })

  it('holds a lost or closed job when the usual is published, whatever its sheet reads', () => {
    const over = [{ ...jobs[0]!, over: 'closed' as const }, jobs[1]!, { ...jobs[2]!, over: 'lost' as const }]
    const plan = usualPlanFor(over, sheets)
    expect(plan).toEqual([
      { id: 'cedar', name: 'Cedar Park Medical Office', gets: false, why: 'closed' },
      { id: 'mesa', name: 'Mesa Verde Retail Shell', gets: false, why: 'no-sheet' },
      { id: 'pike', name: 'Pike Street Clinic', gets: false, why: 'lost' },
    ])
    expect(usualPlanChip(plan[0]!, true, 1)).toEqual({ tone: 'wait', words: 'Held. This job is closed.' })
    expect(usualPlanChip(plan[2]!, true, 1)).toEqual({ tone: 'wait', words: 'Held. This job was lost.' })
    const changed = withUsualWords(USUAL, fieldPath('foot'), 'A new foot line.')
    expect(usualPublishPress(changed, published(), plan).label).toBe('Publish your usual')
    expect(['Held. This job is closed.', 'Held. This job was lost.'].flatMap((t) => plainWordsFailures(t))).toEqual([])
  })

  it('says a job is behind on its row when no change waits, and still says it gets a change that does', () => {
    const plan = usualPlanFor(jobs, sheets)
    expect(usualPlanChip(plan[0]!, false, 1, true)).toEqual({ tone: 'warn', words: 'Revision 1, behind your usual' })
    expect(usualPlanChip(plan[0]!, true, 1, true)).toEqual({ tone: 'ok', words: 'Gets it, as revision 2' })
    expect(usualPlanChip(plan[2]!, false, 1, true)).toEqual({ tone: 'warn', words: 'Held. It has changes of its own waiting.' })
  })

  it('counts a job as on the usual only while its published sheet is on the newest revision', () => {
    expect(jobIsOnUsual(out(), 1)).toBe(true)
    expect(jobIsOnUsual(out({ own: withJobWords(USUAL, OWN(), coverPath('umb', 'limit'), 'Made-up amount 9') }), 1)).toBe(true)
    expect(jobIsOnUsual(out(), 2)).toBe(false)
    expect(jobIsOnUsual(job(), 1)).toBe(false)
    expect(jobIsOnUsual(undefined, 1)).toBe(false)
    expect(jobsOnUsual(jobs, sheets, 1)).toBe(2)
    expect(jobsOnUsual(jobs, sheets, 2)).toBe(0)
    expect(jobsOnUsual(jobs, new Map([['cedar', out({ usualRevision: 2 })], ['pike', out()]]), 2)).toBe(1)
  })

  it('heads the list of jobs with how many are on the usual, and says every only when every one is', () => {
    expect(usualJobsHead(true, 0, 3)).toBe('Where this change goes')
    expect(usualJobsHead(false, 3, 3)).toBe('Every job is on your usual')
    expect(usualJobsHead(false, 2, 3)).toBe('2 of 3 jobs are on your usual')
    expect(usualJobsHead(false, 1, 2)).toBe('1 of 2 jobs is on your usual')
    expect(usualJobsHead(false, 0, 2)).toBe('No job is on your usual yet')
    expect(usualJobsHead(false, 0, 0)).toBe('No job is on your usual yet')
    expect(['Every job is on your usual', '2 of 3 jobs are on your usual', 'No job is on your usual yet', 'Revision 1, behind your usual'].flatMap((t) => plainWordsFailures(t))).toEqual([])
  })
})

describe('the chips and the read mark', () => {
  it('chips the open bar: the usual’s revision, a job’s revision, and how much differs from a checked usual', () => {
    expect(sheetBarChips('usual', null, rec(), USUAL)).toEqual([{ tone: 'wait', words: 'Your usual, not published' }])
    expect(sheetBarChips('usual', null, published(2), USUAL)).toEqual([{ tone: 'ok', words: 'Your usual, revision 2' }])
    expect(sheetBarChips('job', job(), published(), USUAL)).toEqual([{ tone: 'wait', words: 'No sheet yet' }])
    const checked = published(1, { read_revision: 1, read_by_name: 'Jo Ferris', read_on: '2026-11-20' })
    const differs = out({ own: withJobWords(USUAL, OWN(), coverPath('umb', 'limit'), 'Made-up amount 9') })
    expect(sheetBarChips('job', differs, checked, USUAL)).toEqual([
      { tone: 'ok', words: 'Published, revision 1' },
      { tone: 'warn', words: '1 thing differs from the checked usual' },
    ])
    expect(sheetBarChips('job', differs, published(), USUAL)).toEqual([{ tone: 'ok', words: 'Published, revision 1' }])
  })

  it('offers the mark only on a published usual, and names who checked it once marked', () => {
    expect(readPress(INSURANCE, rec())).toEqual({ read: false, words: 'Not checked by your insurance agent', canMark: false, formLabel: 'The agent who checked your usual sheet', pressLabel: 'Mark your usual, revision 0, as checked' })
    expect(readPress(INSURANCE, published(2))).toMatchObject({ read: false, words: 'Not checked by your insurance agent. Mark it checked', canMark: true, pressLabel: 'Mark your usual, revision 2, as checked' })
    expect(readPress(INSURANCE, published(2, { read_revision: 2, read_by_name: 'Jo Ferris', read_on: '2026-11-20' }))).toEqual({ read: true, words: 'Checked by Jo Ferris, Nov 20' })
    expect(readPress(INSURANCE, published(3, { read_revision: 2, read_by_name: 'Jo Ferris', read_on: '2026-11-20' })).read).toBe(false)
  })

  it('chips the list row', () => {
    expect(filledRowChips(INSURANCE, null, null)).toEqual([{ tone: 'wait', words: 'Not loaded yet' }])
    expect(filledRowChips(INSURANCE, rec(), null)).toEqual([
      { tone: 'wait', words: 'Your usual, not published' },
      { tone: 'warn', words: 'Not checked by your insurance agent' },
    ])
    expect(filledRowChips(INSURANCE, published(2, { read_revision: 2, read_by_name: 'Jo Ferris', read_on: '2026-11-20' }), { jobs: 3, withSheet: 1 })).toEqual([
      { tone: 'ok', words: 'Your usual, revision 2' },
      { tone: 'ok', words: 'A sheet on 1 of 3 jobs' },
      { tone: 'ok', words: 'Checked by Jo Ferris, Nov 20' },
    ])
  })

  it('counts the jobs the Job box lists, and of them the ones with a published sheet (punch list #416)', () => {
    const jobs = [
      { projectId: 'built', over: null },
      { projectId: 'bid', over: null },
      { projectId: 'draft', over: null },
      { projectId: 'lost-with-sheet', over: 'lost' as const },
      { projectId: 'lost', over: 'lost' as const },
      { projectId: 'closed', over: 'closed' as const },
    ]
    // A draft never published is revision 0: nobody outside reads it, so it is not counted as a sheet.
    const revisions: Record<string, number> = { built: 3, draft: 0, 'lost-with-sheet': 1 }
    const rev = (id: string) => revisions[id] ?? 0
    expect(sheetCounts(jobs, rev)).toEqual({ jobs: 4, withSheet: 2 })
    expect(sheetCounts([], rev)).toEqual({ jobs: 0, withSheet: 0 })
    expect(sheetCounts([{ projectId: 'lost', over: 'lost' }], rev)).toEqual({ jobs: 0, withSheet: 0 })
  })

  it('says the count on the row, and says so when there is no job to count', () => {
    expect(sheetCountChip({ jobs: 4, withSheet: 2 })).toEqual({ tone: 'ok', words: 'A sheet on 2 of 4 jobs' })
    expect(sheetCountChip({ jobs: 1, withSheet: 1 })).toEqual({ tone: 'ok', words: 'A sheet on 1 of 1 job' })
    expect(sheetCountChip({ jobs: 3, withSheet: 0 })).toEqual({ tone: 'wait', words: 'A sheet on 0 of 3 jobs' })
    expect(sheetCountChip({ jobs: 0, withSheet: 0 })).toEqual({ tone: 'wait', words: 'No job you run as the GC yet' })
    expect(filledRowChips(INSURANCE, published(1), { jobs: 0, withSheet: 0 }).map((c) => c.words)).toEqual(['Your usual, revision 1', 'No job you run as the GC yet', 'Not checked by your insurance agent'])
    expect(['A sheet on 2 of 4 jobs', 'No job you run as the GC yet'].flatMap((t) => plainWordsFailures(t))).toEqual([])
  })

  it('reads in plain words', () => {
    const texts = [
      sheetNote('usual', null, { revision: 1, dirty: false }),
      sheetNote('job', job(), { revision: 1, dirty: false }),
      sheetNote('job', out(), { revision: 2, dirty: false }),
      sheetNote('job', out(), { revision: 1, dirty: true }),
      sheetCaption('usual', true),
      sheetCaption('job', true),
      sheetCaption('job', false),
      sheetStamp('usual', null, 1),
      readPress(INSURANCE, published(2)).words,
    ]
    expect(texts.flatMap((t) => plainWordsFailures(t))).toEqual([])
  })
})

describe('the first draft for the company', () => {
  it('carries the company’s own name, and address lines to type when its record has none', () => {
    const draft = firstDraftOf(INSURANCE, { name: 'Acme Construction', legalName: 'Acme Construction, LLC', address: '' })
    const parsed = parseSheetDef(JSON.parse(JSON.stringify(draft)))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.def.fields.co).toBe('Acme Construction')
    expect(parsed.def.fields.hName).toBe('Acme Construction, LLC')
    expect(parsed.def.fields.addr1).toBe(SHEET_NEW.address1)
    expect(parsed.def.fields.hAddr2).toBe(SHEET_NEW.address2)
    expect(sheetDefProblems(parsed.def)).toContain('Your address, first line has not been typed yet.')
  })

  it('splits an address the record does hold into its two lines', () => {
    const draft = firstDraftOf(INSURANCE, { name: 'Acme Construction', legalName: '', address: '2200 Made Up Road, Austin, TX 78700' }) as SheetDef
    expect([draft.fields.addr1, draft.fields.addr2]).toEqual(['2200 Made Up Road', 'Austin, TX 78700'])
    expect(draft.fields.hName).toBe('Acme Construction')
  })
})

describe('the printed page', () => {
  const sheet = layOver(USUAL, OWN())

  it('is one page with every piece of the sheet, and is filed as a kind the Documents page knows how to name', () => {
    const html = sheetPrintHtml(sheet, 'Revision 1 · Cedar Park Medical Office')
    for (const words of ['Acme Plumbing', 'INSURANCE REQUIREMENTS', 'For subcontractors on Cedar Park Medical Office', 'Pecan Ridge Holdings, Ltd.', '410 Sample Street, Cedar Park, TX 78613', 'Commercial general liability', 'Made-up amount 5', 'Revision 1 · Cedar Park Medical Office']) expect(html).toContain(words)
    expect(html).toContain('Workers&#39; compensation')
    expect(html).not.toContain('<script')
    expect(sheetPrintTitle(sheet)).toBe('INSURANCE REQUIREMENTS For subcontractors on Cedar Park Medical Office')
    expect(SHEET_SENT_KIND).toMatch(/^[a-z][a-z0-9_]{1,60}$/)
    expect(sentKindGroup(SHEET_SENT_KIND)).toBe('contracts')
  })

  it('escapes what a person typed', () => {
    const html = sheetPrintHtml({ ...sheet, foot: '<b>bold</b> & "quoted"' }, 'Draft')
    expect(html).toContain('&lt;b&gt;bold&lt;/b&gt; &amp; &quot;quoted&quot;')
  })
})
