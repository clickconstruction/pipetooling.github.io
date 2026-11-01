import { describe, expect, it } from 'vitest'
import {
  canSeeMessagePhotos,
  captionWords,
  dayGroups,
  firstName,
  jobWords,
  photoSearchFilter,
  photosNarrowed,
  sizeWords,
  sourceChips,
  sourceWords,
  threadPath,
  thumbSource,
  viewerTitle,
  whereChips,
  whereWords,
  whoWords,
  type UploadedPhotoRow,
} from './uploadedPhotos'

function row(over: Partial<UploadedPhotoRow> = {}): UploadedPhotoRow {
  return {
    source: 'report',
    id: 'p1',
    job_id: 'j1',
    bid_id: null,
    project_id: null,
    report_id: 'r1',
    container_id: null,
    question_id: null,
    message_id: null,
    contact_id: null,
    caption: 'Rough In',
    stage_name: 'Rough In',
    by_user_id: 'u1',
    by_name: 'Mateo Ruiz',
    direction: null,
    channel: null,
    taken_at: '2026-11-01T20:14:00Z',
    bytes: 310_000,
    original_bytes: 4_200_000,
    bucket: 'report-photos',
    storage_path: 'j1/p1.jpg',
    drive_file_id: null,
    filed_at: null,
    fail_why: null,
    status: null,
    job_hcp_number: '1042',
    job_click_number: null,
    job_name: 'Oak Hollow Apartments Building C',
    customer_name: 'Ridgeway Builders',
    bid_number: null,
    ...over,
  }
}

describe('who sees what', () => {
  it('shows the Texts & email chip to the office and the estimator only', () => {
    expect(canSeeMessagePhotos('assistant')).toBe(true)
    expect(canSeeMessagePhotos('estimator')).toBe(true)
    expect(canSeeMessagePhotos('primary')).toBe(false)
    expect(sourceChips('primary').map((c) => c.key)).toEqual(['all', 'report', 'box', 'checklist'])
    expect(sourceChips('dev').map((c) => c.key)).toEqual(['all', 'report', 'box', 'checklist', 'message'])
  })

  it('counts the waiting chip', () => {
    expect(whereChips(3)[2]!.label).toBe('Not in Drive yet · 3')
    expect(whereChips(0)[2]!.label).toBe('Not in Drive yet')
    expect(whereChips(null)[2]!.label).toBe('Not in Drive yet')
  })
})

describe('the search', () => {
  it('asks the server over the caption, the person, the job and the customer once two characters are typed', () => {
    expect(photoSearchFilter('O')).toBeNull()
    expect(photoSearchFilter('  Oak  Hollow ')).toBe(
      'caption.ilike.*Oak Hollow*,by_name.ilike.*Oak Hollow*,job_name.ilike.*Oak Hollow*,customer_name.ilike.*Oak Hollow*,job_hcp_number.ilike.*Oak Hollow*,job_click_number.ilike.*Oak Hollow*,stage_name.ilike.*Oak Hollow*',
    )
    expect(photoSearchFilter('a,b(c)')).toContain('*a b c*')
  })

  it('knows when a filter narrows the list', () => {
    expect(photosNarrowed({ source: 'all', where: 'everywhere', typed: 'o' })).toBe(false)
    expect(photosNarrowed({ source: 'box', where: 'everywhere', typed: '' })).toBe(true)
    expect(photosNarrowed({ source: 'all', where: 'waiting', typed: '' })).toBe(true)
    expect(photosNarrowed({ source: 'all', where: 'everywhere', typed: 'oak' })).toBe(true)
  })
})

describe('a row’s words', () => {
  it('names the source', () => {
    expect(sourceWords(row())).toBe('Report')
    expect(sourceWords(row({ source: 'box' }))).toBe('Tally box')
    expect(sourceWords(row({ source: 'checklist' }))).toBe('Checklist')
    expect(sourceWords(row({ source: 'message', channel: 'text' }))).toBe('Text')
    expect(sourceWords(row({ source: 'message', channel: 'email' }))).toBe('Email')
  })

  it('names who took it, the sender on a line that came in and the sender on one we sent', () => {
    expect(whoWords(row())).toBe('Mateo Ruiz')
    expect(whoWords(row({ source: 'message', direction: 'in', by_name: 'Greg Paulk <greg@ridgeway.com> to bids@' }))).toBe('from Greg Paulk')
    expect(whoWords(row({ source: 'message', direction: 'out', by_name: 'Carla Nguyen' }))).toBe('sent by Carla Nguyen')
    expect(whoWords(row({ source: 'message', direction: 'in', by_name: '' }))).toBe('from a number with no name')
    expect(whoWords(row({ by_name: '' }))).toBe('someone')
  })

  it('names the job, the bid, or no job', () => {
    expect(jobWords(row())).toBe('J1042 · Oak Hollow Apartments Building C · Ridgeway Builders')
    expect(jobWords(row({ job_hcp_number: null, job_click_number: '77' }))).toBe('J77 · Oak Hollow Apartments Building C · Ridgeway Builders')
    expect(jobWords(row({ job_id: null, bid_id: 'b1', bid_number: '556', job_hcp_number: null, job_name: 'Gun Dog Trail', customer_name: 'Ridgeway Builders' }))).toBe('Bid 556 · Gun Dog Trail · Ridgeway Builders')
    expect(jobWords(row({ job_id: null, job_hcp_number: null, job_name: null, customer_name: null }))).toBe('No job tied')
  })

  it('finds the caption', () => {
    expect(captionWords(row())).toBe('Rough In')
    expect(captionWords(row({ caption: '', stage_name: 'Top Out' }))).toBe('Top Out')
    expect(captionWords(row({ caption: '', stage_name: '' }))).toBe('Photo')
  })

  it('says the sizes before and after the shrink', () => {
    expect(sizeWords(row())).toBe('4.2 MB → 310 KB')
    expect(sizeWords(row({ original_bytes: 0 }))).toBe('310 KB')
    expect(sizeWords(row({ bytes: 0, original_bytes: 0 }))).toBe('')
  })

  it('titles the viewer by the caption and the job', () => {
    expect(viewerTitle(row())).toBe('Rough In · J1042 · Oak Hollow Apartments Building C · Ridgeway Builders')
    expect(viewerTitle(row({ job_id: null, job_hcp_number: null, job_name: null, customer_name: null }))).toBe('Rough In')
  })

  it('opens the thread at the line, or nowhere for a line with no contact', () => {
    expect(threadPath(row({ contact_id: 'c1', message_id: 'm1' }))).toBe('/messages?thread=c1&at=m1')
    expect(threadPath(row({ contact_id: null, message_id: 'm1' }))).toBeNull()
  })

  it('takes a first name', () => {
    expect(firstName('Jordan Pike')).toBe('Jordan')
    expect(firstName('  Mateo ')).toBe('Mateo')
    expect(firstName('')).toBe('')
  })
})

describe('where a photo is', () => {
  it('reads filed, on its way, held with the reason, and held with the folders press', () => {
    expect(whereWords(row({ drive_file_id: 'd1', filed_at: '2026-11-01T20:20:00Z' }))).toMatchObject({ text: 'In Drive', tone: 'filed', press: 'drive' })
    expect(whereWords(row({ drive_file_id: 'd1' })).sub).toBe('')
    expect(whereWords(row())).toMatchObject({ text: 'On its way to Drive', tone: 'waiting', press: null })
    expect(whereWords(row({ fail_why: 'That job has no Drive folder yet.' }))).toMatchObject({ text: 'Not in Drive yet', sub: 'That job has no Drive folder yet.', tone: 'held', press: 'folders' })
    expect(whereWords(row({ fail_why: 'Drive refused the copy.' }))).toMatchObject({ tone: 'held', press: null })
    expect(whereWords(row({ storage_path: null }))).toMatchObject({ text: 'Not in Drive yet', tone: 'held' })
  })

  it('reads a box photo kept on the phone or shared by hand', () => {
    expect(whereWords(row({ source: 'box', by_name: 'Jordan Pike', storage_path: null, status: 'on-phone' }))).toMatchObject({ text: 'Still on Jordan’s phone', tone: 'held' })
    expect(whereWords(row({ source: 'box', storage_path: null, status: 'shared' }))).toMatchObject({ text: 'Shared from the phone', tone: 'held' })
  })

  it('reads a text’s picture: our copy, left in Gmail or Quo, or filed', () => {
    expect(whereWords(row({ source: 'message', storage_path: 'g/1-a.jpg' }))).toMatchObject({ text: 'Our copy, not in Drive', tone: 'waiting', press: 'thread' })
    expect(whereWords(row({ source: 'message', storage_path: null, status: 'quo_not_copied' }))).toMatchObject({ text: 'No copy here · still in Quo', tone: 'held' })
    expect(whereWords(row({ source: 'message', storage_path: null, status: 'too_big' })).text).toBe('No copy here · still in Gmail')
    expect(whereWords(row({ source: 'message', storage_path: 'g/1-a.jpg', drive_file_id: 'd9' })).text).toBe('In Drive')
  })
})

describe('the thumbnail’s bytes', () => {
  it('come from the bucket while a shot waits, from Drive through the job once filed, and from our copy for a text’s picture', () => {
    expect(thumbSource(row())).toEqual({ kind: 'bucket', bucket: 'report-photos', path: 'j1/p1.jpg' })
    expect(thumbSource(row({ drive_file_id: 'd1', storage_path: null }))).toEqual({ kind: 'drive', jobId: 'j1', fileId: 'd1' })
    expect(thumbSource(row({ source: 'message', bucket: 'message-attachments', storage_path: 'g/1-a.jpg', drive_file_id: 'd1' }))).toEqual({ kind: 'bucket', bucket: 'message-attachments', path: 'g/1-a.jpg' })
    expect(thumbSource(row({ source: 'box', storage_path: null, status: 'shared' }))).toEqual({ kind: 'none' })
  })
})

describe('the days', () => {
  it('groups rows by the company’s day, naming today and yesterday', () => {
    const rows = [
      row({ id: 'a', taken_at: '2026-11-01T20:14:00Z' }),
      row({ id: 'b', taken_at: '2026-11-01T16:52:00Z' }),
      row({ id: 'c', taken_at: '2026-10-31T21:31:00Z' }),
      row({ id: 'd', taken_at: '2026-10-30T13:12:00Z' }),
    ]
    const groups = dayGroups(rows, '2026-11-01')
    expect(groups.map((g) => [g.label, g.rows.length])).toEqual([
      ['Today · Sun, Nov 1', 2],
      ['Yesterday · Sat, Oct 31', 1],
      ['Fri, Oct 30', 1],
    ])
  })

  it('puts a row with no readable time under No date', () => {
    expect(dayGroups([row({ taken_at: 'nope' })], '2026-11-01')[0]!.label).toBe('No date')
  })
})
