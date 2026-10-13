import { describe, expect, it } from 'vitest'
import { PHOTO_SAVE_BATCH, isPhoto, notSavedWhy, photoJobKey, photosToSave, switchesByJob, type PhotoRow, type PhotoSwitch } from './photoSave'

// The prototype's Helotes Dental Office and the photos its customer texted (quo-messages-mockup.html draft 8, spike/gc-mode).
const HELOTES = 'a0000000-0000-4000-8000-000000000001'
const BOERNE_BID = 'b0000000-0000-4000-8000-000000000002'
const PIPELINE_JOB = 'c0000000-0000-4000-8000-000000000003'

const on: PhotoSwitch = { bid_id: null, project_id: HELOTES, jobs_ledger_id: null, on_since: '2026-10-01T15:00:00.000Z' }

function photo(id: string, over: Partial<PhotoRow> = {}, line: Partial<PhotoRow['line']> = {}): PhotoRow {
  return {
    id,
    kind: 'file',
    name: 'picture-1.jpg',
    mime: 'image/jpeg',
    bucket_path: `quo/MS-1/${id}.jpg`,
    drive_file_id: null,
    sent_as: null,
    ...over,
    line: { direction: 'in', at: '2026-10-02T19:14:00.000Z', bid_id: null, project_id: HELOTES, jobs_ledger_id: null, ...line },
  }
}

describe('photosToSave: what the file agent copies to the job’s Photos now', () => {
  it('copies a photo that came in on a ticked job, once the tick is on', () => {
    expect(photosToSave([photo('tile')], [on]).map((r) => r.id)).toEqual(['tile'])
  })

  it('leaves each kind of file it should leave, and says why', () => {
    const switches = switchesByJob([on])
    expect(notSavedWhy(photo('pdf', { name: 'quote.pdf', mime: 'application/pdf' }), switches)).toBe('notAPhoto')
    expect(notSavedWhy(photo('link', { kind: 'link' }), switches)).toBe('notAPhoto')
    expect(notSavedWhy(photo('left', { bucket_path: null }), switches)).toBe('notKept')
    expect(notSavedWhy(photo('saved', { drive_file_id: '1AbCdEfGhIjKlMnOpQr' }), switches)).toBe('inDrive')
    expect(notSavedWhy(photo('sent', { sent_as: 'picture' }), switches)).toBe('ours')
    expect(notSavedWhy(photo('out', {}, { direction: 'out' }), switches)).toBe('ours')
    expect(notSavedWhy(photo('person', {}, { project_id: null }), switches)).toBe('noJob')
    expect(notSavedWhy(photo('early', {}, { at: '2026-09-30T12:00:00.000Z' }), switches)).toBe('before')
  })

  it('starts off on every job: no tick, or a tick turned off, copies nothing', () => {
    expect(photosToSave([photo('tile')], [])).toEqual([])
    expect(photosToSave([photo('tile')], [{ ...on, on_since: null }])).toEqual([])
    expect(notSavedWhy(photo('tile'), switchesByJob([]))).toBe('switchOff')
  })

  it('copies a photo whose line was tied to the job after it came, when it came after the tick', () => {
    // The sweep reads the line as it is now, so a tie made later is seen on the next run.
    expect(photosToSave([photo('tied-later', {}, { at: '2026-10-02T20:00:00.000Z' })], [on]).map((r) => r.id)).toEqual(['tied-later'])
  })

  it('reads a bid’s and a Pipeline job’s ticks the same way', () => {
    const bid: PhotoSwitch = { bid_id: BOERNE_BID, project_id: null, jobs_ledger_id: null, on_since: on.on_since }
    const pipeline: PhotoSwitch = { bid_id: null, project_id: null, jobs_ledger_id: PIPELINE_JOB, on_since: on.on_since }
    const rows = [photo('bid', {}, { project_id: null, bid_id: BOERNE_BID }), photo('pipe', {}, { project_id: null, jobs_ledger_id: PIPELINE_JOB })]
    expect(photosToSave(rows, [bid, pipeline]).map((r) => r.id).sort()).toEqual(['bid', 'pipe'])
    expect(photosToSave(rows, [on])).toEqual([])
  })

  it('takes a HEIC with no type as a photo, by its name', () => {
    expect(isPhoto({ kind: 'file', mime: null, name: 'IMG_2041.HEIC' })).toBe(true)
    expect(isPhoto({ kind: 'file', mime: 'image/heic', name: 'IMG_2041.HEIC' })).toBe(true)
    expect(isPhoto({ kind: 'file', mime: null, name: 'IMG_2041' })).toBe(false)
  })

  it('copies the oldest first, at most a run’s worth', () => {
    const rows = Array.from({ length: PHOTO_SAVE_BATCH + 5 }, (_, i) =>
      photo(`p${String(i).padStart(2, '0')}`, {}, { at: new Date(Date.parse('2026-10-02T19:00:00.000Z') - i * 60_000).toISOString() }),
    )
    const picked = photosToSave(rows, [on])
    expect(picked).toHaveLength(PHOTO_SAVE_BATCH)
    expect(picked[0]!.id).toBe(`p${PHOTO_SAVE_BATCH + 4}`)
    expect(photosToSave(rows, [on], 2).map((r) => r.id)).toEqual([`p${PHOTO_SAVE_BATCH + 4}`, `p${PHOTO_SAVE_BATCH + 3}`])
  })

  it('keys a job the way the save picks one: a GC project, then a bid, then a Pipeline job', () => {
    expect(photoJobKey({ bid_id: BOERNE_BID, project_id: HELOTES, jobs_ledger_id: null })).toBe(`project:${HELOTES}`)
    expect(photoJobKey({ bid_id: BOERNE_BID, project_id: null, jobs_ledger_id: PIPELINE_JOB })).toBe(`bid:${BOERNE_BID}`)
    expect(photoJobKey({ bid_id: null, project_id: null, jobs_ledger_id: PIPELINE_JOB })).toBe(`pipeline:${PIPELINE_JOB}`)
    expect(photoJobKey({ bid_id: null, project_id: null, jobs_ledger_id: null })).toBeNull()
  })
})
