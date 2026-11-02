import { describe, expect, it } from 'vitest'
import {
  CHANGES_PRESS,
  addSetPressWords,
  asBuiltLineWords,
  buildJobPlansView,
  buildingFromLine,
  changesLineWords,
  changesMissing,
  changesPlaceholder,
  compareSets,
  defaultAsBuiltName,
  defaultSetName,
  emptyNewSetDraft,
  jobShortLabel,
  newSetDraftProblem,
  otherPlansNotice,
  partNameForJob,
  partTimeline,
  setLineWords,
  shortDayWords,
  timelineEntryFor,
  type PlanPartRow,
  type PlanSetRow,
} from './planSets'

import { setRowDayWords, setRowLineWords } from './planSets'

function set(over: Partial<PlanSetRow> & { id: string }): PlanSetRow {
  return {
    part_id: 'p1',
    name: 'Issued set',
    kind: 'issued',
    source: 'gc',
    dated: null,
    came_at: '2026-10-01T12:00:00Z',
    memo: '',
    link: 'https://drive.google.com/drive/folders/abc',
    replaces_set_id: null,
    changes: '',
    marks_up_set_id: null,
    job_id: null,
    file_name: null,
    file_size: null,
    file_count: null,
    checked_at: null,
    check_note: null,
    created_by: null,
    created_at: '2026-10-01T12:00:00Z',
    updated_at: '2026-10-01T12:00:00Z',
    ...over,
  }
}

const part: PlanPartRow = { id: 'p1', development_id: null, job_id: 'j1', name: 'Harlow Ranch gas test', position: 0, current_set_id: 's2', current_set_by: 'u1', current_set_at: '2026-10-20T15:00:00Z', created_by: 'u1', created_at: '2026-10-01T12:00:00Z', updated_at: '2026-10-20T15:00:00Z' }

describe('buildJobPlansView', () => {
  const issued = set({ id: 's1', dated: '2026-08-11' })
  const permit = set({ id: 's2', name: 'Permit set', kind: 'permit', dated: '2026-10-14', replaces_set_id: 's1', came_at: '2026-10-20T15:00:00Z' })
  const asBuilt = set({ id: 's3', name: 'As-built · JP972 · 2026-11-01', kind: 'as_built', source: 'ours', marks_up_set_id: 's2', job_id: 'j1', came_at: '2026-11-01T18:00:00Z' })
  const other = set({ id: 'x1', part_id: 'p9' })

  it('finds the current set, the one it replaced, the older sets and our as-builts', () => {
    const v = buildJobPlansView(part, [issued, asBuilt, permit, other])
    expect(v.current?.id).toBe('s2')
    expect(v.replaced?.id).toBe('s1')
    expect(v.older.map((s) => s.id)).toEqual(['s1'])
    expect(v.asBuilts.map((s) => s.id)).toEqual(['s3'])
  })

  it('reads as nothing with no part, and with no current set lists every plain set as older', () => {
    expect(buildJobPlansView(null, [issued])).toEqual({ part: null, current: null, replaced: null, older: [], asBuilts: [] })
    const v = buildJobPlansView({ ...part, current_set_id: null }, [issued, permit])
    expect(v.current).toBeNull()
    expect(v.older.map((s) => s.id)).toEqual(['s2', 's1'])
  })

  it('orders newest dated first, undated after, the latest to come first among equals', () => {
    const a = set({ id: 'a', dated: '2026-09-01' })
    const b = set({ id: 'b', dated: null, came_at: '2026-10-05T00:00:00Z' })
    const c = set({ id: 'c', dated: '2026-10-01' })
    const d = set({ id: 'd', dated: null, came_at: '2026-10-09T00:00:00Z' })
    expect([a, b, c, d].sort(compareSets).map((s) => s.id)).toEqual(['c', 'a', 'd', 'b'])
  })
})

describe('the words', () => {
  it('writes a set’s line from its kind, source and date', () => {
    expect(setLineWords(set({ id: 's', kind: 'permit', source: 'gc', dated: '2026-10-14' }))).toBe('Permit set · the GC · dated Oct 14, 2026')
    expect(setLineWords(set({ id: 's', kind: 'assembled', source: 'ours', dated: null, came_at: '2026-10-30T12:00:00Z' }))).toMatch(/^Assembled set · ours · came Oct 30$/)
    expect(setLineWords(set({ id: 's', source: 'architect' }))).toContain('the architect')
  })

  it('writes the line under Building from, and nothing with no current set', () => {
    const v = buildJobPlansView(part, [set({ id: 's1' }), set({ id: 's2', name: 'Permit set', replaces_set_id: 's1' })])
    expect(buildingFromLine(v, 'Taunya')).toBe('replaced Issued set on Oct 20 · set by Taunya')
    expect(buildingFromLine(v, null)).toBe('replaced Issued set on Oct 20')
    expect(buildingFromLine({ part, current: v.current, replaced: null }, null)).toBeNull()
    expect(buildingFromLine({ part: null, current: null, replaced: null }, 'Taunya')).toBeNull()
  })

  it('writes an as-built’s line with who made it and what it marks up', () => {
    const sets = [set({ id: 's2', name: 'Permit set' })]
    expect(asBuiltLineWords(set({ id: 'a', came_at: '2026-11-01T18:00:00Z', marks_up_set_id: 's2' }), 'Malachi', sets)).toBe('Nov 1 · Malachi · marks up Permit set')
    expect(asBuiltLineWords(set({ id: 'a', came_at: '2026-11-01T18:00:00Z', marks_up_set_id: null }), null, sets)).toBe('Nov 1')
  })

  it('says when another part of the site carries a set, naming the parts, and nothing when none does', () => {
    const parts = [
      { id: 'p1', name: 'Bunker', hasSet: true },
      { id: 'p2', name: 'Lodge', hasSet: true },
      { id: 'p3', name: 'ATV building', hasSet: false },
    ]
    expect(otherPlansNotice({ developmentName: 'Quail Ridge', myPartId: 'p1', parts })).toBe('Quail Ridge has plans on another part of the site: Lodge. A set on another part may touch this job.')
    expect(otherPlansNotice({ developmentName: 'Quail Ridge', myPartId: null, parts })).toBe('Quail Ridge has plans on 2 other parts of the site: Bunker and Lodge. A set on another part may touch this job.')
    expect(otherPlansNotice({ developmentName: null, myPartId: 'p1', parts: [{ id: 'p2', name: 'Lodge', hasSet: true }, { id: 'p3', name: 'Pool house', hasSet: true }, { id: 'p4', name: 'Barn', hasSet: true }] })).toBe(
      'This site has plans on 3 other parts of the site: Lodge, Pool house and Barn. A set on another part may touch this job.',
    )
    expect(otherPlansNotice({ developmentName: 'Quail Ridge', myPartId: 'p1', parts: [parts[0]!, parts[2]!] })).toBeNull()
  })

  it('names the press by whether a set is current', () => {
    expect(addSetPressWords(null)).toEqual({ makeCurrent: 'Add the set', keep: null })
    expect(addSetPressWords({ name: 'Issued set' })).toEqual({ makeCurrent: 'Add the set and build from it', keep: 'Add it, keep Issued set current' })
  })

  it('reads a day from a stamp or a civil date', () => {
    expect(shortDayWords('2026-10-20')).toBe('Oct 20')
    expect(shortDayWords(null)).toBe('')
    expect(shortDayWords('not a day')).toBe('')
  })

  it("leads an older-sets row with the date on the sheets, else the day it came, and keeps the date out of its line", () => {
    const dated = set({ id: 's', kind: 'revised', source: 'architect', dated: '2026-08-11', came_at: '2026-08-28T12:00:00Z' })
    expect(setRowDayWords(dated)).toBe('Aug 11, 2026')
    expect(setRowLineWords(dated)).toBe('Revised set · the architect')
    const undated = set({ id: 's', kind: 'assembled', source: 'ours', dated: null, came_at: '2026-10-30T12:00:00Z' })
    expect(setRowDayWords(undated)).toBe('came Oct 30, 2026')
    expect(setRowLineWords(undated)).toBe('Assembled set · ours')
    expect(setRowDayWords(set({ id: 's', dated: 'not a day', came_at: 'nor this' }))).toBe('')
    expect(setRowDayWords(set({ id: 's', dated: null, came_at: '2025-12-30' }))).toBe('came Dec 30, 2025')
  })
})

describe('a new set', () => {
  it('needs a name, a link that starts with https when given, and a day that reads as one', () => {
    const d = emptyNewSetDraft('addendum')
    expect(d.source).toBe('gc')
    expect(emptyNewSetDraft('as_built').source).toBe('ours')
    expect(newSetDraftProblem(d)).toBe('Give the set a name.')
    expect(newSetDraftProblem({ ...d, name: 'Addendum 1', link: 'drive.google.com/x' })).toMatch(/^Paste the set’s link/)
    expect(newSetDraftProblem({ ...d, name: 'Addendum 1', dated: '10/14/2026' })).toMatch(/reads as a day/)
    expect(newSetDraftProblem({ ...d, name: 'Addendum 1' })).toBeNull()
    expect(newSetDraftProblem({ ...d, name: 'Addendum 1', link: 'https://drive.google.com/x', dated: '2026-10-14' })).toBeNull()
  })

  it('starts a numbered kind at the next number and a plain kind at its label', () => {
    const existing = [set({ id: '1', name: 'Addendum 1' }), set({ id: '2', name: 'Issued set' })]
    expect(defaultSetName('addendum', existing)).toBe('Addendum 2')
    expect(defaultSetName('bulletin', existing)).toBe('Bulletin 1')
    expect(defaultSetName('permit', existing)).toBe('Permit set')
    expect(defaultSetName('issued', existing)).toBe('Issued set 2')
    expect(defaultAsBuiltName('JP972', '2026-11-01')).toBe('As-built · JP972 · 2026-11-01')
  })

  it('labels the job by its number, else its name, and names its own part after it', () => {
    expect(jobShortLabel({ click_number: '972', job_name: 'Harlow Ranch gas test' })).toBe('JP972')
    expect(jobShortLabel({ click_number: '', hcp_number: 'HCP-9', job_name: 'x' })).toBe('HCP-9')
    expect(jobShortLabel({ job_name: 'Harlow Ranch gas test' })).toBe('Harlow Ranch gas test')
    expect(jobShortLabel({})).toBe('this job')
    expect(partNameForJob({ job_name: '  Harlow Ranch gas test ', click_number: '972' })).toBe('Harlow Ranch gas test')
    expect(partNameForJob({ job_name: '', click_number: '972' })).toBe('JP972')
  })
})

describe('what changed between sets (v2.6356)', () => {
  const issued = set({ id: 'a', name: 'Issued set', dated: '2026-06-01' })
  const add1 = set({ id: 'b', name: 'Addendum 1', kind: 'addendum', dated: '2026-07-01', replaces_set_id: 'a', changes: 'P-201 redrawn: the riser moved to the north wall.' })
  const add2 = set({ id: 'c', name: 'Addendum 2', kind: 'addendum', dated: '2026-08-01' })
  const asBuilt = set({ id: 'd', name: 'As-built', kind: 'as_built', source: 'ours', dated: '2026-09-01', marks_up_set_id: 'c' })

  it('runs the plain sets newest first, each with the set before it, as-builts aside', () => {
    const t = partTimeline([asBuilt, issued, add2, add1])
    expect(t.map((e) => [e.set.id, e.previous?.id ?? null])).toEqual([
      ['c', 'b'],
      ['b', 'a'],
      ['a', null],
    ])
  })

  it('takes the set a row says it replaces over the date order', () => {
    const t = partTimeline([issued, add2, { ...add1, replaces_set_id: 'c' }])
    expect(timelineEntryFor(t, add1).previous?.id).toBe('c')
    expect(timelineEntryFor(t, set({ id: 'zz' })).previous).toBeNull()
  })

  it('reads the change line with the set before it, and nothing until someone writes it', () => {
    const t = partTimeline([issued, add1, add2])
    expect(changesLineWords(timelineEntryFor(t, add1))).toBe('What changed from Issued set: P-201 redrawn: the riser moved to the north wall.')
    expect(changesLineWords(timelineEntryFor(t, add2))).toBeNull()
    expect(changesLineWords({ set: { ...issued, changes: 'The first set.' }, previous: null })).toBe('What changed: The first set.')
    expect(changesLineWords({ set: { ...add2, changes: '   ' }, previous: add1 })).toBeNull()
  })

  it('offers Write what changed on a set that followed another with nothing written, never on the first set', () => {
    const t = partTimeline([issued, add1, add2])
    expect(changesMissing(timelineEntryFor(t, add2))).toBe(true)
    expect(changesMissing(timelineEntryFor(t, add1))).toBe(false)
    expect(changesMissing(timelineEntryFor(t, issued))).toBe(false)
    expect(CHANGES_PRESS).toEqual({ write: 'Write what changed', edit: 'Edit what changed', save: 'Save what changed' })
  })

  it('cues the form with the set the new one replaces, and a draft starts with no change words', () => {
    expect(changesPlaceholder({ name: 'Issued set' })).toBe('What moved from Issued set: which sheets or areas, and what it means for our work. Nothing, for a reissue.')
    expect(changesPlaceholder(null)).toBe('What this set settles, in a line. Leave it empty on a first set.')
    expect(emptyNewSetDraft('addendum').changes).toBe('')
  })
})
