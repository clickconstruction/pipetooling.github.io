import { describe, expect, it } from 'vitest'
import {
  TASK_CHECKLIST_PATH,
  WHERE_FILES_GO_PATH,
  aboutWords,
  canSeeMessagePhotos,
  captionWords,
  dayGroups,
  firstName,
  jobWords,
  photoSearchFilter,
  photosNarrowed,
  sizeWords,
  sourceChips,
  sourceDoorOpensJob,
  sourceDoorWords,
  sourceWords,
  taskStandWords,
  threadPath,
  thumbSource,
  viewerTitle,
  whereChips,
  whereWords,
  waitsOnTasksFolder,
  whoWords,
  type UploadedPhotoRow,
} from './uploadedPhotos'

/** A task card's shot as the view's sixth branch lists it (punch list #273): no job, the title as the caption, the shot's caption as the stage, its kind as the status. */
function taskRow(over: Partial<UploadedPhotoRow> = {}): UploadedPhotoRow {
  return row({ source: 'task', id: 'tp1', job_id: null, report_id: null, caption: 'Put the plumbing tools in a neat home', stage_name: '75%', status: 'progress', bucket: 'task-photos', storage_path: 'inst-1/tp1.jpg', job_hcp_number: null, job_name: null, customer_name: null, ...over })
}

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
    expect(sourceChips('primary').map((c) => c.key)).toEqual(['all', 'report', 'box', 'checklist', 'job', 'task'])
    expect(sourceChips('dev').map((c) => c.key)).toEqual(['all', 'report', 'box', 'checklist', 'job', 'task', 'message'])
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
    expect(sourceWords(taskRow())).toBe('Task card')
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

  it('a task card’s shot comes from its bucket while the copy is there, never through the job, and from nowhere without it', () => {
    expect(thumbSource(taskRow())).toEqual({ kind: 'bucket', bucket: 'task-photos', path: 'inst-1/tp1.jpg' })
    expect(thumbSource(taskRow({ drive_file_id: 'd9' }))).toEqual({ kind: 'bucket', bucket: 'task-photos', path: 'inst-1/tp1.jpg' })
    expect(thumbSource(taskRow({ storage_path: null, drive_file_id: 'd9' }))).toEqual({ kind: 'none' })
  })
})

// Punch list #273, v2.6635: a task card's shot on the list.
describe('a task card’s shot', () => {
  it('reads where the card stood instead of a job, in the row and in the viewer’s title', () => {
    expect(taskStandWords(taskRow())).toBe('At 75%')
    expect(taskStandWords(taskRow({ status: 'finish', stage_name: 'finish' }))).toBe('The finishing photo')
    expect(taskStandWords(taskRow({ status: 'line', stage_name: 'Pipe is racked by size' }))).toBe('Done when… Pipe is racked by size')
    expect(taskStandWords(taskRow({ status: 'line', stage_name: '' }))).toBe('A Done when… line')
    expect(taskStandWords(taskRow({ status: 'progress', stage_name: 'progress' }))).toBe('A photo on the card')
    expect(aboutWords(taskRow())).toBe('At 75%')
    expect(aboutWords(row())).toBe('J1042 · Oak Hollow Apartments Building C · Ridgeway Builders')
    expect(captionWords(taskRow())).toBe('Put the plumbing tools in a neat home')
    expect(viewerTitle(taskRow())).toBe('Put the plumbing tools in a neat home · At 75%')
  })

  it('opens the checklist, never a job, and is drawn as waiting or filed as any row is', () => {
    expect(sourceDoorWords(taskRow())).toBe('Open the checklist')
    expect(sourceDoorOpensJob(taskRow())).toBe(false)
    expect(TASK_CHECKLIST_PATH).toBe('/checklist?tab=today')
    expect(whereWords(taskRow())).toMatchObject({ text: 'On its way to Drive', tone: 'waiting', press: null })
    expect(whereWords(taskRow({ drive_file_id: 'd9', filed_at: '2026-11-07T20:20:00Z' }))).toMatchObject({ text: 'In Drive', tone: 'filed', press: 'drive' })
  })

  it('a shot waiting on the Tasks folder presses Where files go; any other reason reads as it is', () => {
    const waiting = taskRow({ fail_why: 'The Tasks folder is not set yet. Set it on Documents → Where files go.' })
    expect(waitsOnTasksFolder(waiting)).toBe(true)
    expect(whereWords(waiting)).toEqual({ text: 'Not in Drive yet', sub: waiting.fail_why, tone: 'held', press: 'tasks-folder' })
    expect(WHERE_FILES_GO_PATH).toBe('/documents?tab=where-files-go')
    expect(waitsOnTasksFolder(row({ fail_why: 'The Tasks folder is not set yet.' }))).toBe(false)
    expect(whereWords(taskRow({ fail_why: 'Drive did not let the app in: 403' }))).toMatchObject({ text: 'Not in Drive yet', press: null })
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

describe('sourceDoorOpensJob (punch list #244: one Open the job in the viewer)', () => {
  it('is true for a checklist photo and a job photo, whose own door is Open the job', () => {
    expect(sourceDoorOpensJob({ source: 'checklist' })).toBe(true)
    expect(sourceDoorOpensJob({ source: 'job' })).toBe(true)
  })

  it('is false for a report, a box and a text, whose doors open something else', () => {
    expect(sourceDoorOpensJob({ source: 'report' })).toBe(false)
    expect(sourceDoorOpensJob({ source: 'box' })).toBe(false)
    expect(sourceDoorOpensJob({ source: 'message' })).toBe(false)
  })
})
