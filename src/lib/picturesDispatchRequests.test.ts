import { describe, expect, it } from 'vitest'
import {
  decidePicturesDispatchRequest,
  jobIdsForPicturesRequestSweep,
  pickOrphanedPicturesRequestIds,
  PICTURES_DISPATCH_REQUEST_MESSAGES,
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
