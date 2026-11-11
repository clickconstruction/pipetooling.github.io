/**
 * Materials on site (punch list #297, the finish line, v2.6927): the strip a job's screens draw while its box photos'
 * files are on their way to its Drive folder, and the sentence a combine's finish adds. Made-up file names only.
 */
import { describe, expect, it } from 'vitest'
import { REFILE_MAX_ROUNDS, combinePhotosSentence, mayAskRefile, refileAsksAgain, refileStripView, type RefileMark } from './boxPhotoRefileStrip'

const mark = (n: number, failWhy: string | null = null): RefileMark => ({ id: `p${n}`, fileName: `2026-11-0${n} Dana · A${n} after Count.jpg`, dueAt: '2026-11-11T15:00:00.000Z', failWhy })
const TRASH = 'That file is in Drive’s trash. Restore it there, then ask again.'

describe('the strip', () => {
  it('is not drawn when nothing is due: an empty strip is the good state', () => {
    expect(refileStripView([], 0, 12)).toEqual({ kind: 'none' })
    expect(refileStripView([], 12, 12)).toEqual({ kind: 'none' })
  })

  it('says how many are moving, and that the page can be left', () => {
    expect(refileStripView([mark(1), mark(2), mark(3)], 3, 3)).toEqual({
      kind: 'moving',
      head: '3 box photos are moving to this job’s Drive folder',
      sub: 'You can leave this page: the rest follow by themselves.',
      progress: null,
      held: [],
    })
    expect(refileStripView([mark(1)], 1, 1)).toMatchObject({ head: '1 box photo is moving to this job’s Drive folder' })
  })

  it('counts up once this screen has seen the number go down', () => {
    const view = refileStripView([mark(1), mark(2), mark(3), mark(4), mark(5), mark(6), mark(7)], 12, 12)
    expect(view).toMatchObject({ kind: 'moving', head: '7 box photos are moving to this job’s Drive folder', sub: '5 of 12 moved. You can leave this page: the rest follow by themselves.' })
    expect(view.kind === 'moving' && view.progress).toBeCloseTo(5 / 12)
  })

  it('names a held file with its reason while the others still move', () => {
    const view = refileStripView([mark(1), mark(2, TRASH)], 2, 2)
    expect(view).toMatchObject({ kind: 'moving', head: '1 box photo is moving to this job’s Drive folder', held: [{ id: 'p2', fileName: '2026-11-02 Dana · A2 after Count.jpg', why: TRASH }] })
  })

  it('once only held files are left, says how many are in the folder and offers the press with its count', () => {
    expect(refileStripView([mark(4, TRASH)], 12, 12)).toEqual({
      kind: 'held',
      head: '11 of 12 box photos are in this job’s Drive folder',
      sub: '1 was held. It still opens from its box. A held file is tried again by itself a day later.',
      held: [{ id: 'p4', fileName: '2026-11-04 Dana · A4 after Count.jpg', why: TRASH }],
      button: 'Try 1 held file again',
    })
    expect(refileStripView([mark(1, TRASH), mark(2, 'Drive answered 403 when the app moved a file: forbidden')], 2, 3)).toMatchObject({
      head: '1 of 3 box photos is in this job’s Drive folder',
      sub: '2 were held. They still open from their boxes. A held file is tried again by itself a day later.',
      button: 'Try 2 held files again',
    })
    // The job's filed count not read yet: the line still says what happened.
    expect(refileStripView([mark(1, TRASH)], 1, null)).toMatchObject({ head: '1 box photo could not move to this job’s Drive folder' })
  })
})

describe('after a combine', () => {
  it('the finish adds one sentence when photos are on their way, and nothing when none is', () => {
    expect(combinePhotosSentence(0)).toBe('')
    expect(combinePhotosSentence(1)).toBe('Its 1 box photo is moving to the job’s Drive folder. That takes a minute or two and finishes by itself.')
    expect(combinePhotosSentence(12)).toBe('Its 12 box photos are moving to the job’s Drive folder. That takes a minute or two and finishes by itself.')
  })

  it('the app asks for the roles that may combine, and leaves the rest to the sweep', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller']) expect(mayAskRefile(role)).toBe(true)
    for (const role of ['estimator', 'helpers', null]) expect(mayAskRefile(role)).toBe(false)
  })

  it('asks again only while files were left and the last round moved some', () => {
    expect(refileAsksAgain({ left: 55, moved: [1, 2] }, 1)).toBe(true)
    expect(refileAsksAgain({ left: 0, moved: [1] }, 1)).toBe(false)
    // A round that moved nothing would loop for nothing: the sweep has the rest.
    expect(refileAsksAgain({ left: 55, moved: [] }, 1)).toBe(false)
    expect(refileAsksAgain(null, 1)).toBe(false)
    expect(refileAsksAgain({ left: 55, moved: [1] }, REFILE_MAX_ROUNDS)).toBe(false)
  })
})
