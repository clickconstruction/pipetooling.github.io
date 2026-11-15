import { describe, expect, it } from 'vitest'
import {
  beforeAfterRows,
  canMoveOnSite,
  labelsChangedWords,
  MOVE_JOB_ROLES,
  MOVE_SEARCH_MAX,
  moveDoneWords,
  movedRows,
  movePressLabel,
  moveTargetChoices,
  photosFollowWords,
  placesFoldedWords,
  planHeadWords,
  readMovePlan,
  searchFoundWords,
} from './onSiteMoveJob'
import { PLAN_FROM as FROM, PLAN_TO as TO, PLAN_REPLY, planCounts as counts } from './onSiteMoveJob.fixture'

const plan = readMovePlan(PLAN_REPLY)!

describe('who may press', () => {
  it('the four roles that may combine two jobs, and nobody else', () => {
    expect([...MOVE_JOB_ROLES]).toEqual(['dev', 'master_technician', 'assistant', 'controller'])
    for (const r of MOVE_JOB_ROLES) expect(canMoveOnSite(r)).toBe(true)
    for (const r of ['estimator', 'primary', 'superintendent', 'helpers', 'subcontractor', '', null, undefined]) expect(canMoveOnSite(r)).toBe(false)
  })
})

describe('readMovePlan', () => {
  it('reads the seat’s plan into the window’s plan', () => {
    expect(plan.dryRun).toBe(true)
    expect(plan.from).toEqual({ id: FROM, label: 'JP224', name: 'Materials: Phase 2 draws' })
    expect(plan.to.label).toBe('JP1091')
    expect(plan.by).toBe('Taunya')
    expect(plan.moved.containers).toBe(92)
    expect(plan.moved.retired_containers).toBe(6)
    expect(plan.placesMerged).toEqual([{ name: 'Gun dog', containers: 5 }])
    expect(plan.unsortedFolded).toBeNull()
    expect(plan.labelsRenamed).toEqual([{ code: '7D759246', kind: 'cage', from: 'G6', to: 'G95' }])
    expect(plan.photos).toMatchObject({ rows: 91, inDrive: 90, waiting: 1 })
    expect(plan.ties.into).toBe('site')
    expect(plan.onHand.holds).toBe(true)
    expect(plan.before.to.parts_on_hand).toBe(3)
    expect(plan.after.to.containers).toBe(94)
    expect(plan.after.from.containers).toBe(0)
  })
  it('reads an Unsorted fold, a dropped pair and counts sent as strings', () => {
    const p = readMovePlan({ ...PLAN_REPLY, unsorted_folded: { code: 'A1B2C3D4', into_code: 'E5F6A7B8', movements: '7', container_moves: 0, photos: 1 }, ties: { into: 'job', dropped: [{ a: '2in elbow', b: '2 inch elbow', kept: 'target' }], words: 'x' }, on_hand: { holds: false, words: 'do not add up' } })!
    expect(p.unsortedFolded).toEqual({ code: 'A1B2C3D4', intoCode: 'E5F6A7B8', movements: 7, containerMoves: 0, photos: 1 })
    expect(p.ties).toEqual({ into: 'job', dropped: [{ a: '2in elbow', b: '2 inch elbow', kept: 'target' }], words: 'x' })
    expect(p.onHand.holds).toBe(false)
  })
  it('reads an older reply with no photos, ties or on_hand, every missing count 0', () => {
    const older: Record<string, unknown> = { ...PLAN_REPLY, moved: { containers: 92, movements: 280 } }
    for (const k of ['photos', 'ties', 'on_hand', 'next']) delete older[k]
    const p = readMovePlan(older)!
    expect(p.moved).toMatchObject({ containers: 92, movements: 280, photos: 0, part_renames: 0 })
    expect(p.photos).toEqual({ rows: 0, inDrive: 0, waiting: 0, words: '' })
    expect(p.ties).toEqual({ into: null, dropped: [], words: '' })
    expect(p.onHand.holds).toBe(true)
    expect(p.next).toBe('')
  })
  it('is null for anything that is not a plan', () => {
    expect(readMovePlan(null)).toBeNull()
    expect(readMovePlan('dry run')).toBeNull()
    expect(readMovePlan({ ok: false, error: 'refused' })).toBeNull()
    expect(readMovePlan({ ...PLAN_REPLY, from: null })).toBeNull()
    expect(readMovePlan({ ...PLAN_REPLY, to: { id: TO } })).toBeNull()
    expect(readMovePlan({ ...PLAN_REPLY, moved: undefined })).toBeNull()
    expect(readMovePlan({ ...PLAN_REPLY, after: undefined })).toBeNull()
  })
})

describe('the plan as rows', () => {
  it('lists what moves, table by table, only the tables with rows, the retired boxes said on the boxes’ row', () => {
    expect(movedRows(plan)).toEqual([
      { key: 'containers', label: 'cages and boxes, 6 of them retired', n: 92 },
      { key: 'places', label: 'places', n: 3 },
      { key: 'movements', label: 'presses on the ledger', n: 284 },
      { key: 'container_moves', label: 'box moves', n: 4 },
      { key: 'photos', label: 'photos', n: 91 },
    ])
  })
  it('names the four tables when the job has rows in them, one of a kind in the singular', () => {
    const p = readMovePlan({ ...PLAN_REPLY, moved: counts({ containers: 1, movements: 1, part_renames: 1, sticker_runs: 2, ties: 1, prices: 3 }), before: { ...PLAN_REPLY.before, from: counts({ places: 1, containers: 1 }) } })!
    expect(movedRows(p).map((r) => `${r.n} ${r.label}`)).toEqual(['1 cage or box', '1 place', '1 press on the ledger', '1 part rename', '2 sticker runs', '1 Same part? answer', '3 prices'])
  })
  it('says which places become one and which labels change', () => {
    expect(placesFoldedWords(plan)).toEqual(['Gun dog joins JP1091’s Gun dog with its 5 boxes.'])
    expect(labelsChangedWords(plan)).toEqual(['G6 becomes G95. The code 7D759246 on its label still opens it.'])
    const folded = readMovePlan({ ...PLAN_REPLY, places_merged: [], unsorted_folded: { code: 'A1B2C3D4', into_code: 'E5F6A7B8', movements: 1, container_moves: 0, photos: 0 } })!
    expect(placesFoldedWords(folded)).toEqual(['JP224’s Unsorted folds into JP1091’s Unsorted with 1 press.'])
  })
  it('reads each job’s boxes and parts before and after, the source first', () => {
    expect(beforeAfterRows(plan)).toEqual([
      { label: 'JP224', name: 'Materials: Phase 2 draws', boxesBefore: 92, boxesAfter: 0, partsBefore: 2230, partsAfter: 0 },
      { label: 'JP1091', name: 'Lift stations and site visit', boxesBefore: 2, boxesAfter: 94, partsBefore: 3, partsAfter: 2233 },
    ])
  })
  it('says the photos’ files follow by the sweep, not that they stay', () => {
    expect(photosFollowWords(plan)).toBe('The 91 photos move with their boxes. 90 files already in Drive follow to JP1091’s Drive folder by the photo sweep. That takes a minute or two and finishes by itself. 1 file is still waiting to be filed and lands in JP1091’s folder.')
    expect(photosFollowWords(readMovePlan({ ...PLAN_REPLY, photos: { rows: 1, in_drive: 1, waiting: 0, words: '' } })!)).toBe('The 1 photo moves with its box. Its 1 file already in Drive follows to JP1091’s Drive folder by the photo sweep. That takes a minute or two and finishes by itself.')
    expect(photosFollowWords(readMovePlan({ ...PLAN_REPLY, photos: { rows: 0, in_drive: 0, waiting: 0, words: 'No photos to move.' } })!)).toBe('No photos to move.')
  })
  it('heads the plan with both jobs', () => {
    expect(planHeadWords(plan)).toBe('Everything on site on JP224 moves to JP1091.')
  })
})

describe('the confirm button and the sentence after', () => {
  it('carries the verb, the counts and the target', () => {
    expect(movePressLabel(plan)).toBe('Move 92 boxes and 284 presses to JP1091')
    expect(movePressLabel(readMovePlan({ ...PLAN_REPLY, moved: counts({ containers: 1, movements: 1 }) })!)).toBe('Move 1 box and 1 press to JP1091')
    expect(movePressLabel(readMovePlan({ ...PLAN_REPLY, moved: counts({ containers: 3 }) })!)).toBe('Move 3 boxes to JP1091')
    expect(movePressLabel(readMovePlan({ ...PLAN_REPLY, moved: counts({ movements: 2 }) })!)).toBe('Move 2 presses to JP1091')
    // A job whose rows are a sticker run alone has no box and no press to count.
    expect(movePressLabel(readMovePlan({ ...PLAN_REPLY, moved: counts({ sticker_runs: 1 }) })!)).toBe('Move everything on site to JP1091')
  })
  it('says what is now true, with the photos’ sentence when files are on their way', () => {
    expect(moveDoneWords(plan)).toBe('JP1091 now holds the 92 boxes that were on JP224. JP224 has nothing on site. A note is on both jobs.')
    expect(moveDoneWords(plan, 'Its 90 box photos are moving to the job’s Drive folder.')).toBe('JP1091 now holds the 92 boxes that were on JP224. JP224 has nothing on site. A note is on both jobs. Its 90 box photos are moving to the job’s Drive folder.')
    expect(moveDoneWords(readMovePlan({ ...PLAN_REPLY, moved: counts({ containers: 1 }) })!)).toContain('the 1 box that was on')
  })
})

describe('picking the receiving job', () => {
  const jobs = [
    { id: FROM, label: 'JP224 · Materials: Phase 2 draws' },
    { id: TO, label: 'JP1091 · Lift stations and site visit' },
    { id: 'j3', label: 'JP1111 · ZZ Test bio walk' },
    { id: 'j4', label: 'JP1200 · Gun Dog clubhouse' },
  ]
  const siteOfJob = new Map<string, string | null>([[FROM, 'gun-dog'], [TO, 'gun-dog'], ['j3', null], ['j4', 'gun-dog']])
  it('lists the other jobs on the source’s site first, and the search finds the rest', () => {
    const c = moveTargetChoices(jobs, FROM, siteOfJob, '')
    expect(c.sameSite.map((j) => j.id)).toEqual([TO, 'j4'])
    expect(c.found).toEqual([])
    const s = moveTargetChoices(jobs, FROM, siteOfJob, 'zz')
    expect(s.sameSite.map((j) => j.id)).toEqual([TO, 'j4'])
    expect(s.found.map((j) => j.id)).toEqual(['j3'])
    // A same-site job is never listed twice, and the source never at all.
    expect(moveTargetChoices(jobs, FROM, siteOfJob, 'jp').found.map((j) => j.id)).toEqual(['j3'])
  })
  it('has no same-site list for a job on no site, or with no source picked yet', () => {
    expect(moveTargetChoices(jobs, 'j3', siteOfJob, '').sameSite).toEqual([])
    expect(moveTargetChoices(jobs, null, siteOfJob, '1091').found.map((j) => j.id)).toEqual([TO])
  })
  it('caps the search and says so', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ id: `m${i}`, label: `JP${2000 + i} · Many ${i}` }))
    const c = moveTargetChoices(many, null, new Map(), 'many')
    expect(c.found).toHaveLength(MOVE_SEARCH_MAX)
    expect(searchFoundWords(c.found, 'many')).toBe(`The first ${MOVE_SEARCH_MAX}. Type more to narrow them.`)
    expect(searchFoundWords([], 'xyz')).toBe('No job matches “xyz”.')
    expect(searchFoundWords([], '')).toBeNull()
    expect(searchFoundWords(many.slice(0, 1), 'many 0')).toBeNull()
  })
})
