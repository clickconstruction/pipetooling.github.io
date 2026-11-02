import { describe, expect, it } from 'vitest'
import type { PlanSetRow } from './planSets'
import { jobPlansPickerView, jobPlansPickerWords, jobPlansPress, type JobPlanSetsEntry } from './jobPlanSetsIcon'

function set(over: Partial<PlanSetRow> & { id: string }): PlanSetRow {
  return {
    part_id: 'p1',
    name: 'Issued set',
    kind: 'issued',
    source: 'gc',
    dated: null,
    came_at: '2026-10-01T12:00:00Z',
    memo: '',
    link: 'https://drive.google.com/drive/folders/issued',
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
  } as PlanSetRow
}
const issued = set({ id: 's1', dated: '2026-08-11' })
const permit = set({ id: 's2', name: 'Permit set', kind: 'permit', dated: '2026-10-14', link: 'https://drive.google.com/drive/folders/permit' })
const asBuilt = set({ id: 's3', name: 'As-built · JP972 · 2026-11-01', kind: 'as_built', source: 'ours', marks_up_set_id: 's2', job_id: 'j1', link: 'https://drive.google.com/drive/folders/asbuilt', came_at: '2026-11-01T18:00:00Z' })
const waiting = set({ id: 's4', name: 'Addendum 1', kind: 'addendum', link: '' })

describe('jobPlansPress', () => {
  it('a job with no part falls back to its old plans link, or draws nothing', () => {
    expect(jobPlansPress(null, 'https://drive.google.com/drive/folders/old ')).toEqual({ kind: 'open', link: 'https://drive.google.com/drive/folders/old', title: 'Job plans' })
    expect(jobPlansPress(null, null)).toEqual({ kind: 'none' })
    expect(jobPlansPress({ partId: 'p1', currentSetId: null, sets: [] }, '')).toEqual({ kind: 'none' })
  })
  it('one openable set opens it by name; a set still waiting on its link does not count', () => {
    const entry: JobPlanSetsEntry = { partId: 'p1', currentSetId: 's2', sets: [permit, waiting] }
    expect(jobPlansPress(entry, null)).toEqual({ kind: 'open', link: 'https://drive.google.com/drive/folders/permit', title: 'Job plans · Permit set' })
  })
  it('two or more open the picker, the title naming the set the job builds from', () => {
    expect(jobPlansPress({ partId: 'p1', currentSetId: 's2', sets: [issued, permit, asBuilt] }, null)).toEqual({ kind: 'pick', title: 'Job plans · Permit set · 3 sets', count: 3 })
    expect(jobPlansPress({ partId: 'p1', currentSetId: null, sets: [issued, permit] }, null)).toEqual({ kind: 'pick', title: 'Job plans · 2 sets', count: 2 })
  })
})

describe('jobPlansPickerView', () => {
  it('groups the current set, the older sets newest first and our as-builts', () => {
    const v = jobPlansPickerView({ partId: 'p1', currentSetId: 's2', sets: [issued, permit, asBuilt, waiting] })
    expect(v.current?.id).toBe('s2')
    expect(v.older.map((s) => s.id)).toEqual(['s1'])
    expect(v.asBuilts.map((s) => s.id)).toEqual(['s3'])
    expect(jobPlansPickerWords(v)).toBe('3 sets of plans on this job. Open the one you want.')
  })
  it('with no current set every drawing is an older set', () => {
    const v = jobPlansPickerView({ partId: 'p1', currentSetId: null, sets: [permit, issued] })
    expect(v.current).toBeNull()
    expect(v.older.map((s) => s.id)).toEqual(['s2', 's1'])
    expect(jobPlansPickerWords(v)).toBe('2 sets of plans on this job. Open the one you want.')
  })
})
