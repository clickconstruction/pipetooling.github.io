import { describe, expect, it } from 'vitest'
import { PHOTO_TICK_WORDS, lineHasPhoto, photoSaveArgs, photoSaveColumn, photoTickDone, photoTickJob, photoTickNote } from './photoTick'
import type { LineFile } from '../messages/lineFiles'

// The prototype's Helotes Dental Office and the photos its customer texted (quo-messages-mockup.html draft 9, spike/gc-mode).
const HELOTES = 'a0000000-0000-4000-8000-000000000001'
const BOERNE_BID = 'b0000000-0000-4000-8000-000000000002'
const PIPELINE_JOB = 'c0000000-0000-4000-8000-000000000003'

type F = Pick<LineFile, 'kept' | 'mime' | 'name'>
const tile: F = { kept: 'copy', mime: 'image/jpeg', name: 'Ceiling tile, op 3.jpg' }
const quote: F = { kept: 'copy', mime: 'application/pdf', name: 'quote.pdf' }
const heicByName: F = { kept: 'quoNotCopied', mime: null, name: 'IMG_2201.HEIC' }
const photoLink: F = { kept: 'link', mime: null, name: 'tile.jpg' }

describe('photoTickJob: which job’s tick a line shows', () => {
  it('shows the tick for the job the line is tied to, when a picture came with it', () => {
    expect(photoTickJob({ jobId: `project:${HELOTES}`, files: [quote, tile] })).toBe(`project:${HELOTES}`)
    expect(photoTickJob({ jobId: `bid:${BOERNE_BID}`, files: [heicByName] })).toBe(`bid:${BOERNE_BID}`)
  })

  it('shows none on a line on the person, a line with no picture, a link to a picture, or a key that is not a job', () => {
    expect(photoTickJob({ jobId: null, files: [tile] })).toBeNull()
    expect(photoTickJob({ jobId: `project:${HELOTES}`, files: [quote] })).toBeNull()
    expect(photoTickJob({ jobId: `project:${HELOTES}`, files: [photoLink] })).toBeNull()
    expect(photoTickJob({ jobId: `project:${HELOTES}` })).toBeNull()
    expect(photoTickJob({ jobId: 'customer:x', files: [tile] })).toBeNull()
    expect(lineHasPhoto(undefined)).toBe(false)
  })
})

describe('photoSaveArgs and photoSaveColumn: the job, as set_photo_save and photo_saves take it', () => {
  it('sets exactly one of the three ids', () => {
    expect(photoSaveArgs(`project:${HELOTES}`)).toEqual({ p_bid_id: null, p_project_id: HELOTES, p_jobs_ledger_id: null })
    expect(photoSaveArgs(`bid:${BOERNE_BID}`)).toEqual({ p_bid_id: BOERNE_BID, p_project_id: null, p_jobs_ledger_id: null })
    expect(photoSaveArgs(`pipeline:${PIPELINE_JOB}`)).toEqual({ p_bid_id: null, p_project_id: null, p_jobs_ledger_id: PIPELINE_JOB })
    expect(photoSaveArgs('nothing')).toBeNull()
  })

  it('names the column the tick is kept under', () => {
    expect(photoSaveColumn(`project:${HELOTES}`)).toEqual({ column: 'project_id', id: HELOTES })
    expect(photoSaveColumn(`bid:${BOERNE_BID}`)).toEqual({ column: 'bid_id', id: BOERNE_BID })
    expect(photoSaveColumn(`pipeline:${PIPELINE_JOB}`)).toEqual({ column: 'jobs_ledger_id', id: PIPELINE_JOB })
    expect(photoSaveColumn('')).toBeNull()
  })
})

describe('the tick’s words', () => {
  it('keeps the prototype’s sentence', () => {
    expect(PHOTO_TICK_WORDS).toBe('Save every photo on this job to Drive as it comes in')
  })

  it('says since when once it is on, and nothing while it is off', () => {
    // 2026-10-13 at 9:05 in Texas.
    expect(photoTickNote('2026-10-13T14:05:00.000Z')).toBe('On since Tue Oct 13. Photos that came in before then are not copied.')
    expect(photoTickNote(null)).toBe('')
    expect(photoTickNote('not a day')).toBe('')
  })

  it('names the setting in the toast, never a copy', () => {
    expect(photoTickDone(true)).toBe('This job is set to save its photos to Drive.')
    expect(photoTickDone(false)).toBe('This job is set not to save its photos to Drive.')
  })
})
