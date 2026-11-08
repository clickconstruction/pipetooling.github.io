import { describe, expect, it } from 'vitest'
import {
  driveFileIdFromUrl,
  EVIDENCE_FILE_MAX_BYTES,
  evidenceCountWords,
  evidenceDraftProblem,
  evidenceDrivePathWords,
  evidenceDriveState,
  evidenceDriveWords,
  evidenceFileIsLinked,
  evidenceFileWhereWords,
  evidenceHashWords,
  evidenceFolderName,
  evidenceKindWords,
  evidenceMime,
  evidenceStoragePath,
  evidenceTitleFromName,
  sortEvidenceNewestFirst,
  type PersonEvidenceFile,
  evidenceCanBeSuperseded,
  evidenceIsDriveLinkOnly,
  evidenceSupersededWords,
} from './personEvidence'

const TODAY = '2026-11-02'
const draft = { datedOn: '2026-10-29', title: 'Left a mess at the site', memo: 'Two photos from the GC the morning after.' }
const file = (over: Partial<PersonEvidenceFile> = {}): PersonEvidenceFile => ({
  id: 'f1',
  evidence_id: 'r1',
  entry_id: null,
  filename: 'IMG_0412.jpg',
  mime_type: 'image/jpeg',
  size_bytes: 300_000,
  storage_path: 'p/evidence/r1/f1-IMG_0412.jpg',
  drive_file_id: null,
  drive_url: null,
  filed_at: null,
  fail_why: null,
  created_at: '2026-10-29T15:00:00Z',
  ...over,
})

describe('evidenceDraftProblem · every piece is required', () => {
  const one = [{ name: 'IMG_0412.jpg', size: 300_000 }]
  it('passes a whole draft', () => {
    expect(evidenceDraftProblem(draft, one, TODAY)).toBeNull()
  })
  it('names the missing piece, in order: the day, the title, the memo, a file', () => {
    expect(evidenceDraftProblem({ ...draft, datedOn: '' }, one, TODAY)).toBe('Pick the day it is about.')
    expect(evidenceDraftProblem({ ...draft, datedOn: '2026-11-03' }, one, TODAY)).toBe('The day it is about cannot be ahead of today.')
    expect(evidenceDraftProblem({ ...draft, title: '  ' }, one, TODAY)).toBe('Give it a title.')
    expect(evidenceDraftProblem({ ...draft, memo: '' }, one, TODAY)).toBe('Write a memo: what it shows and why it matters.')
    expect(evidenceDraftProblem(draft, [], TODAY)).toBe('Add at least one file, or a link to one already in Drive: a photo, a PDF, an email, a screenshot, a recording.')
  })

  it('a link to a file already in Drive stands in for a file; a bad link is named (v2.6541)', () => {
    expect(evidenceDraftProblem(draft, [], TODAY, [{ name: 'Call recording, Aug 29', driveUrl: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view' }])).toBeNull()
    expect(evidenceDraftProblem(draft, [], TODAY, [{ name: '', driveUrl: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view' }])).toBe('Give the linked file a name.')
    expect(evidenceDraftProblem(draft, [], TODAY, [{ name: 'Call', driveUrl: '' }])).toBe('Paste the Drive link for Call.')
    expect(evidenceDraftProblem(draft, [], TODAY, [{ name: 'Call', driveUrl: 'https://example.com/x.mp3' }])).toBe('Call: the link is not a Drive address (drive.google.com or docs.google.com).')
    expect(evidenceDraftProblem(draft, [], TODAY)).toBe('Add at least one file, or a link to one already in Drive: a photo, a PDF, an email, a screenshot, a recording.')
    expect(evidenceDraftProblem(draft, [{ name: 'call.m4a', size: EVIDENCE_FILE_MAX_BYTES + 1 }], TODAY)).toBe('call.m4a is over 10 MB. Put it in the person\'s Drive folder by hand and link it here.')
    expect(driveFileIdFromUrl('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing')).toBe('1AbCdEfGhIjKlMnOp')
    expect(driveFileIdFromUrl('https://drive.google.com/drive/folders/1FoLdErIdXyZ1234')).toBe('1FoLdErIdXyZ1234')
    expect(driveFileIdFromUrl('https://drive.google.com/open?id=1OpEnIdXyZ12345')).toBe('1OpEnIdXyZ12345')
    expect(driveFileIdFromUrl('https://docs.google.com/document/d/1DoCiDxYz123456/edit')).toBe('1DoCiDxYz123456')
    expect(driveFileIdFromUrl('https://drive.google.com/')).toBeNull()
  })

  it('a linked file counts as in Drive: the record reads filed, linked, and the chip says so', () => {
    const linked = file({ id: 'f2', storage_path: null, drive_file_id: '1AbCdEfGhIjKlMnOp', drive_url: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view', filed_at: '2026-11-05T00:00:00Z' })
    expect(evidenceFileIsLinked(linked)).toBe(true)
    expect(evidenceFileIsLinked(file())).toBe(false)
    expect(evidenceFileWhereWords(linked)).toBe('in Drive, linked')
    expect(evidenceFileWhereWords(file({ drive_url: 'https://drive.google.com/file/d/x/view', drive_file_id: 'x' }))).toBe('in Drive')
    expect(evidenceFileWhereWords(file())).toBe('kept here, on its way to Drive')
    const r = { fail_why: null, filed_at: null, files: [linked] }
    expect(evidenceDriveState(r)).toBe('filed')
    expect(evidenceDriveWords(r)).toBe('In Drive, linked')
    const mixed = { fail_why: null, filed_at: null, files: [linked, file({ drive_file_id: 'd1', drive_url: 'https://drive.google.com/file/d/d1/view' })] }
    expect(evidenceDriveWords(mixed)).toBe('In Drive')
    expect(evidenceDriveWords({ fail_why: null, filed_at: null, files: [linked, file()] })).toBe('1 of 2 files in Drive')
  })

  it('a custody hash reads on the chip as its first twelve characters, and nothing without one (v2.6544)', () => {
    expect(evidenceHashWords('3a7bd3e2360a3d29eea436fcfb7e44c735d117c42d1c1835420b6b9942dd4f1b')).toBe('sha256 3a7bd3e2360a…')
    expect(evidenceHashWords('3A7BD3E2360A3D29EEA436FCFB7E44C735D117C42D1C1835420B6B9942DD4F1B')).toBe('sha256 3a7bd3e2360a…')
    expect(evidenceHashWords(null)).toBe('')
    expect(evidenceHashWords('not a hash')).toBe('')
  })

  it('holds an empty file and one over the cap, naming it', () => {
    expect(evidenceDraftProblem(draft, [{ name: 'a.pdf', size: 0 }], TODAY)).toBe('a.pdf is empty.')
    expect(evidenceDraftProblem(draft, [{ name: 'big.mov', size: 11 * 1024 * 1024 }], TODAY)).toMatch(/^big\.mov is over 10 MB\./)
  })
})

describe('the Drive folder and the bucket path', () => {
  it('names the folder by the day and the title, slashes gone, cut at 120', () => {
    expect(evidenceFolderName({ dated_on: '2026-10-29', title: 'Left a mess / at the site' })).toBe('2026-10-29 · Left a mess at the site')
    expect(evidenceFolderName({ dated_on: '2026-10-29', title: 'x'.repeat(200) }).length).toBe(120)
  })
  it('says where it will sit', () => {
    expect(evidenceDrivePathWords('Pat Doe', { dated_on: '2026-10-29', title: 'Left a mess at the site' })).toBe('People › Pat Doe › 2026-10-29 · Left a mess at the site')
    expect(evidenceDrivePathWords('', { dated_on: '2026-10-29', title: 'T' })).toBe('People › this person › 2026-10-29 · T')
  })
  it('stages under the person, the record and the file id, with a safe name', () => {
    expect(evidenceStoragePath('p1', 'r1', 'f1', 'IMG 0412 (final).jpg')).toBe('p1/evidence/r1/f1-IMG 0412 _final_.jpg')
  })
})

describe('kinds and titles', () => {
  it('reads the mime from the browser, else the name, else a plain file', () => {
    expect(evidenceMime({ type: 'image/heic', name: 'x' })).toBe('image/heic')
    expect(evidenceMime({ type: '', name: 'thread.eml' })).toBe('message/rfc822')
    expect(evidenceMime({ type: '', name: 'memo' })).toBe('application/octet-stream')
  })
  it('words a kind', () => {
    expect(evidenceKindWords('application/pdf')).toBe('PDF')
    expect(evidenceKindWords('image/png')).toBe('Photo')
    expect(evidenceKindWords('message/rfc822')).toBe('Email')
    expect(evidenceKindWords('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('Word')
    expect(evidenceKindWords('audio/mp4')).toBe('Audio')
    expect(evidenceKindWords(null)).toBe('File')
  })
  it('starts the title from the first file', () => {
    expect(evidenceTitleFromName('2026-03-01_Sunbelt_Statement.pdf')).toBe('2026-03-01 Sunbelt Statement')
  })
})

describe('where a record stands with Drive', () => {
  it('filed when every file carries a Drive id; partly, waiting or held otherwise', () => {
    const filed = { fail_why: null, filed_at: '2026-10-29T16:00:00Z', files: [file({ drive_file_id: 'd1' }), file({ id: 'f2', drive_file_id: 'd2' })] }
    expect(evidenceDriveState(filed)).toBe('filed')
    expect(evidenceDriveWords(filed)).toBe('In Drive')
    const partly = { fail_why: null, filed_at: null, files: [file({ drive_file_id: 'd1' }), file({ id: 'f2' })] }
    expect(evidenceDriveWords(partly)).toBe('1 of 2 files in Drive')
    expect(evidenceDriveWords({ fail_why: null, filed_at: null, files: [file()] })).toBe('On its way to Drive')
    expect(evidenceDriveWords({ fail_why: 'The People folder is not set yet.', filed_at: null, files: [file()] })).toBe('Not in Drive: The People folder is not set yet.')
  })
  it('sorts newest day first, then newest written, and counts the view', () => {
    const rows = [
      { id: 'a', dated_on: '2026-10-01', created_at: '2026-10-01T10:00:00Z', fail_why: null, filed_at: null, files: [file({ drive_file_id: 'd' })] },
      { id: 'b', dated_on: '2026-10-29', created_at: '2026-10-29T10:00:00Z', fail_why: null, filed_at: null, files: [file(), file({ id: 'f2' })] },
      { id: 'c', dated_on: '2026-10-29', created_at: '2026-10-29T12:00:00Z', fail_why: null, filed_at: null, files: [file({ drive_file_id: 'd' })] },
    ]
    expect(sortEvidenceNewestFirst(rows).map((r) => r.id)).toEqual(['c', 'b', 'a'])
    expect(evidenceCountWords(rows)).toBe('3 pieces of evidence, 4 files. 1 not in Drive yet.')
    expect(evidenceCountWords([rows[0]!])).toBe('1 piece of evidence, 1 file.')
    expect(evidenceCountWords([])).toBe('')
  })
})

describe('counsel-only (v2.6554)', () => {
  const file = { id: 'f1', drive_file_id: null, storage_path: 'p/x', drive_url: null }
  const rec = (over: Record<string, unknown> = {}) => ({ fail_why: null, filed_at: null, files: [file], counsel_only: false, ...over }) as Parameters<typeof evidenceDriveWords>[0]
  it('a counsel-only record is kept here only, whatever its files say, and counts apart from the ones on their way to Drive', () => {
    expect(evidenceDriveState(rec({ counsel_only: true }))).toBe('counsel')
    expect(evidenceDriveWords(rec({ counsel_only: true }))).toBe('Kept here only, counsel-only')
    expect(evidenceDriveWords(rec({ counsel_only: true, files: [{ ...file, drive_file_id: 'd1' }] }))).toBe('Kept here only, counsel-only')
    expect(evidenceDriveState(rec())).toBe('waiting')
    expect(evidenceCountWords([rec({ counsel_only: true }), rec(), rec({ files: [{ ...file, drive_file_id: 'd1' }] })])).toBe('3 pieces of evidence, 3 files. 1 not in Drive yet. 1 counsel-only.')
    expect(evidenceCountWords([rec({ counsel_only: true }), rec({ counsel_only: true })])).toBe('2 pieces of evidence, 2 files. 2 counsel-only.')
  })
})

describe('superseded by a named document (v2.6704, punch list #277 open call 2)', () => {
  const linked = { id: 'f', evidence_id: 'r', entry_id: null, filename: 'history.md', mime_type: null, size_bytes: null, storage_path: null, drive_file_id: 'd', drive_url: 'https://drive.google.com/file/d/d/view', filed_at: '2026-11-07T00:00:00Z', fail_why: null, created_at: '2026-11-07T00:00:00Z', sha256: null }
  const staged = { ...linked, id: 'g', storage_path: 'p/evidence/r/g-scan.pdf', drive_url: null, drive_file_id: null }
  it('only a record whose every file is a Drive link can be superseded, and not twice', () => {
    expect(evidenceIsDriveLinkOnly({ files: [linked] })).toBe(true)
    expect(evidenceIsDriveLinkOnly({ files: [linked, staged] })).toBe(false)
    expect(evidenceIsDriveLinkOnly({ files: [] })).toBe(false)
    expect(evidenceCanBeSuperseded({ files: [linked], superseded_by_document_id: null })).toBe(true)
    expect(evidenceCanBeSuperseded({ files: [linked], superseded_by_document_id: 'doc-1' })).toBe(false)
    expect(evidenceCanBeSuperseded({ files: [staged], superseded_by_document_id: null })).toBe(false)
  })
  it('the chip names the document, the day and who, and falls back when the document is gone', () => {
    expect(evidenceSupersededWords({ title: 'Company history', dateWords: 'Nov 8, 2026', by: 'Robert' })).toBe('Superseded by Company history · Nov 8, 2026 · Robert')
    expect(evidenceSupersededWords({ title: null, dateWords: 'Nov 8, 2026', by: null })).toBe('Superseded by a named document · Nov 8, 2026')
  })
})
