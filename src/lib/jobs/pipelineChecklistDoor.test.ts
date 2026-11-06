import { describe, expect, it } from 'vitest'
import type { StageChecklistState } from './stageChecklist'
import { checklistLeftChip, countJobsWithChecklistLeft, DOOR_SHEET_WORDS, doorEmptyWords, doorJobLabel, doorSheetTitle, filterJobsByChecklistLeft, jobHasChecklistLeft, pipelineChecklistDoor } from './pipelineChecklistDoor'

const notReady = (answered: number, asked: number, kind: StageChecklistState['kind'] = 'trim_set'): StageChecklistState => ({ kind, asked, answered, standing: 'not_ready', ready: false })
const filled = (asked: number, kind: StageChecklistState['kind'] = 'rough_in'): StageChecklistState => ({ kind, asked, answered: asked, standing: 'ready', ready: true })

const STAGES = [
  { id: 'f3', name: 'Trim Set', sequence_order: 3 },
  { id: 'f1', name: 'Rough In', sequence_order: 1 },
  { id: 'f2', name: 'Top Out', sequence_order: 2 },
  { id: 'f0', name: 'Permit', sequence_order: 0 },
]

describe('pipelineChecklistDoor: the row’s door, toned by the job’s standing', () => {
  it('is not drawn on a job with no stage that takes a checklist', () => {
    expect(pipelineChecklistDoor([{ id: 'a', name: 'Service call' }, { id: 'b', name: 'Permit' }], null).kind).toBe('none')
    expect(pipelineChecklistDoor([], new Map()).kind).toBe('none')
  })

  it('reads grey while the stages take a checklist but no question exists yet, and names them in order', () => {
    const door = pipelineChecklistDoor(STAGES, null)
    expect(door.kind).toBe('empty')
    expect(door.tone).toBe('muted')
    expect(door.count).toBe('')
    expect(door.title).toBe('Checklists · Rough In, Top Out and Trim Set have no questions yet · press to add the first')
    expect(door.aria).toBe('Checklists on this job · no questions yet')
    expect(door.badge).toBe('no questions yet')
    // One stage alone reads in the singular.
    expect(pipelineChecklistDoor([{ id: 'f1', name: 'Rough In' }], new Map()).title).toBe('Checklists · Rough In has no questions yet · press to add the first')
  })

  it('reads amber with the open stage’s count, the open stage first in the title, the filled and the empty after', () => {
    const marks = new Map<string, StageChecklistState>([
      ['f1', filled(4)],
      ['f3', notReady(3, 6)],
    ])
    const door = pipelineChecklistDoor(STAGES, marks)
    expect(door.kind).toBe('open')
    expect(door.tone).toBe('amber')
    expect(door.count).toBe('3/6')
    expect(door.answered).toBe(3)
    expect(door.asked).toBe(6)
    expect(door.title).toBe('Checklists · Trim Set 3 of 6 · Rough In filled · Top Out has no questions yet')
    expect(door.aria).toBe('Checklists on this job · 3 of 6 answered')
    expect(door.badge).toBe('3 of 6')
  })

  it('adds up what is left across two open stages, in stage order', () => {
    const marks = new Map<string, StageChecklistState>([
      ['f1', notReady(2, 4, 'rough_in')],
      ['f2', filled(3, 'top_out')],
      ['f3', notReady(3, 6)],
    ])
    const door = pipelineChecklistDoor(STAGES, marks)
    expect(door.count).toBe('5/10')
    expect(door.title).toBe('Checklists · Rough In 2 of 4 · Trim Set 3 of 6 · Top Out filled')
  })

  it('reads green once every stage with a list is filled, a stage with no questions left out of the count', () => {
    const marks = new Map<string, StageChecklistState>([
      ['f1', filled(4)],
      ['f3', filled(6, 'trim_set')],
    ])
    const door = pipelineChecklistDoor(STAGES, marks)
    expect(door.kind).toBe('filled')
    expect(door.tone).toBe('green')
    expect(door.count).toBe('')
    expect(door.title).toBe('Checklists · every stage filled · Rough In 4 of 4 · Trim Set 6 of 6')
    expect(door.aria).toBe('Checklists on this job · every stage filled')
    expect(door.badge).toBe('filled')
  })

  it('keeps the row’s own order when the line items carry no place', () => {
    const door = pipelineChecklistDoor([{ id: 'x', name: 'Top Out' }, { id: 'y', name: 'Rough In' }], new Map([['y', notReady(1, 2, 'rough_in')]]))
    expect(door.title).toBe('Checklists · Rough In 1 of 2 · Top Out has no questions yet')
  })

  it('a mark whose standing is none counts as no questions yet', () => {
    const none: StageChecklistState = { kind: 'rough_in', asked: 0, answered: 0, standing: 'none', ready: true }
    expect(pipelineChecklistDoor([{ id: 'f1', name: 'Rough In' }], new Map([['f1', none]])).kind).toBe('empty')
  })
})

describe('pipelineChecklistDoor: the sheet’s words', () => {
  it('titles the sheet with the job’s number and name, and never the name twice', () => {
    expect(doorJobLabel({ hcp_number: '1088', job_name: 'Riders Walk' })).toBe('JP1088 · Riders Walk')
    expect(doorJobLabel({ click_number: 'B12', job_name: '' })).toBe('B12')
    expect(doorJobLabel({ job_name: 'Big Easy sink drain' })).toBe('Big Easy sink drain')
    expect(doorSheetTitle('JP1088 · Riders Walk')).toBe('Checklists on JP1088 · Riders Walk')
  })
  it('names the next press when no stage takes a checklist, and the foot says what a press does', () => {
    expect(doorEmptyWords().main).toBe('No stages take a checklist on this job.')
    expect(doorEmptyWords().tail).toMatch(/Bill tab/)
    expect(DOOR_SHEET_WORDS.openOnJob).toBe('Open on the job')
    expect(DOOR_SHEET_WORDS.foot).toMatch(/under your name/)
  })
})

describe('the Checklist left chip (punch list #246, PR 2)', () => {
  const open = new Map<string, StageChecklistState>([['f3', notReady(3, 6)]])
  const done = new Map<string, StageChecklistState>([['f1', filled(4)], ['f3', filled(6)]])
  const JOBS = [
    { id: 'a', fixtures: STAGES },
    { id: 'b', fixtures: STAGES },
    { id: 'c', fixtures: [{ id: 'x', name: 'Service call' }] },
    { id: 'd', fixtures: STAGES },
  ]
  const marksFor = (j: { id: string }) => (j.id === 'a' || j.id === 'd' ? open : j.id === 'b' ? done : null)

  it('v2.6551 · a job has a question left only while a stage is open: not filled, not empty, not without a stage', () => {
    expect(jobHasChecklistLeft(STAGES, open)).toBe(true)
    expect(jobHasChecklistLeft(STAGES, done)).toBe(false)
    expect(jobHasChecklistLeft(STAGES, null)).toBe(false)
    expect(jobHasChecklistLeft([{ id: 'x', name: 'Service call' }], open)).toBe(false)
  })

  it('v2.6551 · counts the jobs with a question left, and the filter keeps only them in their order while on, every job while off', () => {
    expect(countJobsWithChecklistLeft(JOBS, marksFor)).toBe(2)
    expect(filterJobsByChecklistLeft(JOBS, true, marksFor).map((j) => j.id)).toEqual(['a', 'd'])
    expect(filterJobsByChecklistLeft(JOBS, false, marksFor).map((j) => j.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('v2.6551 · the chip reads the count, says what a press does either way, and is nothing with nothing left and the filter off', () => {
    expect(checklistLeftChip(0, false)).toBeNull()
    const off = checklistLeftChip(4, false)!
    expect(off.label).toBe('Checklist left · 4')
    expect(off.title).toBe('4 jobs have a question left on a stage checklist — tap to show only them')
    expect(off.aria).toBe('Show only the 4 jobs with a question left on a stage checklist')
    const one = checklistLeftChip(1, false)!
    expect(one.title).toBe('1 job has a question left on a stage checklist — tap to show only it')
    const on = checklistLeftChip(4, true)!
    expect(on.label).toBe('Checklist left · 4')
    expect(on.title).toBe('Showing only the 4 jobs with a question left on a stage checklist — tap to show every job')
    expect(on.aria).toBe('Clear the checklist filter: showing only the 4 jobs with a question left')
    // On with nothing left (the answers not read yet, or the last one answered): the chip stays so the filter can be cleared.
    expect(checklistLeftChip(0, true)!.label).toBe('Checklist left · 0')
  })
})
