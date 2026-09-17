import { describe, expect, it } from 'vitest'
import {
  decidePicturesDispatchRequest,
  jobIdsForPicturesRequestSweep,
  pickOrphanedPicturesRequestIds,
  PICTURES_DISPATCH_REQUEST_MESSAGES,
  pickOrphanedRequestIds,
  jobIdsForRequestSweep,
  SELF_HEALING_REQUESTS,
  type PicturesRequestSweepRow,
} from './picturesDispatchRequests'

describe('decidePicturesDispatchRequest', () => {
  it('creates when the job has no link and nothing is open', () => {
    const d = decidePicturesDispatchRequest({
      jobPicturesLink: null,
      existingOpenRequestId: null,
    })
    expect(d.action).toBe('create')
    expect(d.message).toBe(PICTURES_DISPATCH_REQUEST_MESSAGES.created)
    expect(d.orphanedRequestIdToClose).toBeNull()
  })

  it('reports already-open without creating a duplicate', () => {
    const d = decidePicturesDispatchRequest({
      jobPicturesLink: '',
      existingOpenRequestId: 'req-1',
    })
    expect(d.action).toBe('already-open')
    expect(d.orphanedRequestIdToClose).toBeNull()
  })

  it('refuses to create when the job already has a link', () => {
    const d = decidePicturesDispatchRequest({
      jobPicturesLink: 'https://drive.google.com/drive/folders/pics',
      existingOpenRequestId: null,
    })
    expect(d.action).toBe('already-linked')
    expect(d.message).toBe(PICTURES_DISPATCH_REQUEST_MESSAGES.alreadyLinked)
    expect(d.orphanedRequestIdToClose).toBeNull()
  })

  it('already-linked wins over already-open and surfaces the orphan to close', () => {
    // The Office / HCP 000 state: link set 2026-07-22, second request filed
    // 2026-08-04 that can never auto-close.
    const d = decidePicturesDispatchRequest({
      jobPicturesLink: 'https://drive.google.com/drive/folders/pics',
      existingOpenRequestId: 'req-orphan',
    })
    expect(d.action).toBe('already-linked')
    expect(d.orphanedRequestIdToClose).toBe('req-orphan')
  })

  it('treats whitespace-only links and ids as absent', () => {
    expect(
      decidePicturesDispatchRequest({ jobPicturesLink: '   ', existingOpenRequestId: '  ' }).action,
    ).toBe('create')
  })
})

const row = (over: Partial<PicturesRequestSweepRow> & { id: string }): PicturesRequestSweepRow => ({
  status: 'open',
  pending_action: 'link_job_pictures',
  job_ledger_id: 'job-1',
  ...over,
})

describe('pickOrphanedPicturesRequestIds', () => {
  it('picks open pictures requests whose job has a link', () => {
    const rows = [row({ id: 'a' })]
    const links = new Map([['job-1', 'https://drive.google.com/pics']])
    expect(pickOrphanedPicturesRequestIds(rows, links)).toEqual(['a'])
  })

  it('leaves requests whose job genuinely has no link', () => {
    const rows = [row({ id: 'a' })]
    expect(pickOrphanedPicturesRequestIds(rows, new Map([['job-1', null]]))).toEqual([])
    expect(pickOrphanedPicturesRequestIds(rows, new Map([['job-1', '  ']]))).toEqual([])
  })

  it('never sweeps a job whose link was not read (absent from the map)', () => {
    // Guards against a partial/RLS-filtered fetch closing something blind.
    expect(pickOrphanedPicturesRequestIds([row({ id: 'a' })], new Map())).toEqual([])
  })

  it('ignores closed rows and other pending actions', () => {
    const links = new Map([['job-1', 'https://drive.google.com/pics']])
    const rows = [
      row({ id: 'closed', status: 'closed' }),
      row({ id: 'other', pending_action: 'link_customer_phone' }),
      row({ id: 'none', pending_action: null }),
      row({ id: 'keep' }),
    ]
    expect(pickOrphanedPicturesRequestIds(rows, links)).toEqual(['keep'])
  })

  it('ignores rows with no job id', () => {
    const links = new Map([['job-1', 'https://x']])
    expect(pickOrphanedPicturesRequestIds([row({ id: 'a', job_ledger_id: null })], links)).toEqual([])
    expect(pickOrphanedPicturesRequestIds([row({ id: 'b', job_ledger_id: ' ' })], links)).toEqual([])
  })
})

describe('jobIdsForPicturesRequestSweep', () => {
  it('collects distinct job ids from open pictures requests only', () => {
    const rows = [
      row({ id: 'a', job_ledger_id: 'job-1' }),
      row({ id: 'b', job_ledger_id: 'job-1' }),
      row({ id: 'c', job_ledger_id: 'job-2' }),
      row({ id: 'd', job_ledger_id: 'job-3', status: 'closed' }),
      row({ id: 'e', job_ledger_id: 'job-4', pending_action: 'link_customer_phone' }),
    ]
    expect(jobIdsForPicturesRequestSweep(rows).sort()).toEqual(['job-1', 'job-2'])
  })

  it('returns an empty list when nothing qualifies', () => {
    expect(jobIdsForPicturesRequestSweep([])).toEqual([])
    expect(jobIdsForPicturesRequestSweep([row({ id: 'a', status: 'closed' })])).toEqual([])
  })
})

describe('the phone self-heal (add_job_phone against customer_phone)', () => {
  const phone = (over: Partial<PicturesRequestSweepRow> & { id: string }): PicturesRequestSweepRow => ({
    status: 'open',
    pending_action: 'add_job_phone',
    job_ledger_id: 'job-1',
    ...over,
  })

  it('names both kinds with the column each fills and its own closing note', () => {
    expect(SELF_HEALING_REQUESTS.map((s) => [s.action, s.column])).toEqual([
      ['link_job_pictures', 'job_pictures_link'],
      ['add_job_phone', 'customer_phone'],
    ])
    expect(new Set(SELF_HEALING_REQUESTS.map((s) => s.note)).size).toBe(2)
  })

  it('retires an open phone request whose job already has a number, and only that kind', () => {
    const rows = [phone({ id: 'p' }), row({ id: 'pics' })]
    const phones = new Map([['job-1', '(512) 555-0100']])
    expect(pickOrphanedRequestIds(rows, phones, 'add_job_phone')).toEqual(['p'])
    expect(pickOrphanedRequestIds(rows, phones, 'link_job_pictures')).toEqual(['pics'])
  })

  it('leaves a phone request whose job has no number, and never sweeps a job it did not read', () => {
    expect(pickOrphanedRequestIds([phone({ id: 'p' })], new Map([['job-1', null]]), 'add_job_phone')).toEqual([])
    expect(pickOrphanedRequestIds([phone({ id: 'p' })], new Map([['job-1', '  ']]), 'add_job_phone')).toEqual([])
    expect(pickOrphanedRequestIds([phone({ id: 'p' })], new Map(), 'add_job_phone')).toEqual([])
  })

  it('collects job ids per kind', () => {
    const rows = [phone({ id: 'a', job_ledger_id: 'job-1' }), phone({ id: 'b', job_ledger_id: 'job-2', status: 'closed' }), row({ id: 'c', job_ledger_id: 'job-3' })]
    expect(jobIdsForRequestSweep(rows, 'add_job_phone')).toEqual(['job-1'])
    expect(jobIdsForRequestSweep(rows, 'link_job_pictures')).toEqual(['job-3'])
  })
})
