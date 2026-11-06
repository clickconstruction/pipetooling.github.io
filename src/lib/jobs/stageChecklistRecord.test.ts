import { describe, expect, it } from 'vitest'
import {
  AMEND_WORDS,
  FILED_PAPER_WORDS,
  amendProblem,
  amendedToastWords,
  amendingChipWords,
  amendingRecordOf,
  buildChecklistPaperHtml,
  filedChipWords,
  filedFootWords,
  filedHeaderWords,
  filedJustNowWords,
  filedRecordOf,
  filedWhenWords,
  paperRowFromRecordRow,
  pickGlyph,
  recordCountWords,
  recordFromRow,
  recordPdfUrl,
  recordPdfWords,
  recordRowsFrom,
  recordsOfStage,
  skippedLineWords,
  stageIsFiled,
  versionsLineWords,
  type ChecklistRecord,
  type RecordRowDb,
} from './stageChecklistRecord'

// A made-up job and made-up questions.
const SNAPSHOT = {
  rows: [
    { questionId: 'q1', scope: 'company', words: 'Did the final water test hold?', sheet: null, why: null, addedBy: null, pick: 'yes', note: '', by: 'Luis Ortega', at: '2026-11-01T15:14:00.000Z', signature: { mode: 'draw', printedName: 'Luis Ortega', signedAt: '2026-11-01T15:14:00.000Z', storagePath: 'job-1/sig/a1-1.png' }, photo: null },
    { questionId: 'q2', scope: 'company', words: 'Are the cleanouts capped?', sheet: null, why: null, addedBy: null, pick: 'no', note: 'Roofer not here until Mon', by: 'Luis Ortega', at: '2026-11-01T15:20:00.000Z', signature: null, photo: { fileName: 'x.jpg', driveFileId: 'd1', filedAt: '2026-11-01T15:30:00.000Z' } },
    { questionId: 'j1', scope: 'job', words: 'Are the carriers set?', sheet: 'P-201 detail 4', why: 'the slab pours Thursday', addedBy: 'Pat Sample', pick: 'not_here', note: '', by: 'Luis Ortega', at: '2026-11-01T15:25:00.000Z', signature: null, photo: null },
    { questionId: 'bad', scope: 'company', words: 'A row with no pick', pick: null },
  ],
  skipped: [{ words: 'Is the grease interceptor set?', by: 'Pat Sample', why: 'the owner took it out' }, { words: '' }],
}
const ROW: RecordRowDb = {
  id: 'r1',
  job_id: 'job-1',
  fixture_id: 'f3',
  record_no: 1,
  version: 1,
  record_id: 'CL-1042-1',
  stage_name: 'Trim Set',
  stage_kind: 'trim_set',
  state: 'filed',
  filed_at: '2026-11-01T15:25:00.000Z',
  filed_by_name: 'Luis Ortega',
  snapshot: SNAPSHOT,
  answer_count: 3,
  signed_count: 1,
  no_count: 1,
  pdf_file_name: 'CL-1042-1 Trim Set checklist.pdf',
  pdf_drive_file_id: null,
  pdf_filed_at: null,
  pdf_fail_why: null,
}
const R1 = recordFromRow(ROW)
const R1_AMENDED: ChecklistRecord = { ...R1, state: 'amended', amendedAt: '2026-11-05T22:10:00.000Z', amendedBy: 'Jo Sample', amendWhy: 'the roofer came back' }
const R2: ChecklistRecord = { ...R1, id: 'r2', recordNo: 3, version: 2, recordId: 'CL-1042-3', filedAt: '2026-11-06T16:00:00.000Z', pdf: { fileName: 'CL-1042-3 Trim Set checklist.pdf', driveFileId: 'drive-9', filedAt: '2026-11-06T16:05:00.000Z', failWhy: null } }

describe('recordFromRow: the row as the client reads it', () => {
  it('reads the snapshot rows in order, leaving out a row with no pick and a skip with no words', () => {
    expect(R1.rows.map((r) => r.questionId)).toEqual(['q1', 'q2', 'j1'])
    expect(R1.rows[0]!.signature).toEqual({ mode: 'draw', printedName: 'Luis Ortega', signedAt: '2026-11-01T15:14:00.000Z', storagePath: 'job-1/sig/a1-1.png' })
    expect(R1.rows[1]!.photo).toEqual({ fileName: 'x.jpg', driveFileId: 'd1', filedAt: '2026-11-01T15:30:00.000Z' })
    expect(R1.rows[2]!.scope).toBe('job')
    expect(R1.skipped).toEqual([{ words: 'Is the grease interceptor set?', by: 'Pat Sample', why: 'the owner took it out' }])
    expect(R1.kind).toBe('trim_set')
    expect(R1.state).toBe('filed')
    expect(R1.pdf.driveFileId).toBeNull()
  })
  it('reads an empty or broken snapshot as no rows', () => {
    expect(recordRowsFrom(null)).toEqual({ rows: [], skipped: [] })
    expect(recordRowsFrom({ rows: 'x' })).toEqual({ rows: [], skipped: [] })
  })
})

describe('where a stage stands against its records', () => {
  it('reads as paper while its latest version is filed, open once amended, open with none', () => {
    expect(filedRecordOf([R1], 'f3')?.recordId).toBe('CL-1042-1')
    expect(stageIsFiled([R1], 'f3')).toBe(true)
    expect(filedRecordOf([R1_AMENDED], 'f3')).toBeNull()
    expect(amendingRecordOf([R1_AMENDED], 'f3')?.version).toBe(1)
    expect(stageIsFiled([], 'f3')).toBe(false)
    expect(filedRecordOf([R1], 'f9')).toBeNull()
  })
  it('the newest version wins', () => {
    expect(recordsOfStage([R1_AMENDED, R2], 'f3').map((r) => r.version)).toEqual([2, 1])
    expect(filedRecordOf([R1_AMENDED, R2], 'f3')?.recordId).toBe('CL-1042-3')
    expect(amendingRecordOf([R1_AMENDED, R2], 'f3')).toBeNull()
  })
})

describe('the words', () => {
  it('the header, the counts, the PDF and the foot', () => {
    expect(filedWhenWords('2026-11-01T15:25:00.000Z')).toBe('Nov 1 · 9:25 am')
    expect(filedWhenWords(null)).toBe('')
    expect(recordCountWords(R1)).toBe('3 answers, 1 signed · 1 No')
    expect(recordCountWords({ answerCount: 1, signedCount: 0, noCount: 0 })).toBe('1 answer')
    expect(recordPdfWords(R1)).toBe("PDF on its way to the job's Drive folder")
    expect(recordPdfWords(R2)).toBe("PDF in the job's Drive folder")
    expect(recordPdfWords({ pdf: { ...R1.pdf, failWhy: 'That job has no Drive folder yet.' } })).toBe('PDF not filed yet: That job has no Drive folder yet.')
    expect(recordPdfUrl(R1)).toBeNull()
    expect(recordPdfUrl(R2)).toBe('https://drive.google.com/file/d/drive-9/view')
    expect(filedHeaderWords(R1)).toBe("Record CL-1042-1 · v1 · Nov 1 · 9:25 am · 3 answers, 1 signed · 1 No · PDF on its way to the job's Drive folder")
    expect(filedJustNowWords(R1)).toBe('Filed as record CL-1042-1 with the last answer.')
    expect(filedFootWords('Trim Set', 0)).toBe('Trim Set now reads ready on the Pipeline.')
    expect(filedFootWords('Trim Set', 1)).toBe('Trim Set now reads ready on the Pipeline. One check reads No; the office acts on that.')
    expect(filedFootWords('Trim Set', 2)).toBe('Trim Set now reads ready on the Pipeline. 2 checks read No; the office acts on that.')
    expect(FILED_PAPER_WORDS.amending(1)).toBe('Amending v1. The filed version stays; the next completion files v2.')
  })
  it('the read-out: the chip, the versions line, Amend', () => {
    expect(filedChipWords(R1)).toBe('Filed · CL-1042-1')
    expect(amendingChipWords(R1_AMENDED, 3, 6)).toBe('Amending v1 · 3 of 6')
    expect(versionsLineWords([R1])).toBe('')
    expect(versionsLineWords([R2, R1_AMENDED])).toBe('Versions: CL-1042-1 v1 (amended by Jo Sample · Nov 5 · 4:10 pm: the roofer came back) · CL-1042-3 v2')
    expect(amendProblem('  ')).toBe('Say why the record is amended.')
    expect(amendProblem('the roofer came back')).toBeNull()
    expect(amendedToastWords('Trim Set', R1)).toBe('Amended. Trim Set is open again; the next completion files v2.')
    expect(AMEND_WORDS.confirm).toBe('Amend as a new version')
  })
})

describe('the paper', () => {
  it('a paper row from a snapshot row', () => {
    const [yes, no, notHere] = R1.rows.map(paperRowFromRecordRow)
    expect(yes).toMatchObject({ glyph: '✓', answer: 'Yes · Luis Ortega · Nov 1 · 9:14 am', signedBy: 'Luis Ortega', signatureMode: 'draw', signatureStoragePath: 'job-1/sig/a1-1.png', isNo: false, photo: '' })
    expect(no).toMatchObject({ glyph: '✗', answer: 'No · Luis Ortega · Nov 1 · 9:20 am', note: 'Roofer not here until Mon', photo: "photo in the job's Drive folder", isNo: true, signedBy: null })
    expect(notHere).toMatchObject({ glyph: '—', sheet: 'P-201 detail 4', answer: 'Not here · Luis Ortega · Nov 1 · 9:25 am' })
    expect(pickGlyph(null)).toBe('☐')
    expect(skippedLineWords(R1.skipped)).toBe('Not on this job: Is the grease interceptor set (the owner took it out, Pat Sample)')
    expect(skippedLineWords([])).toBe('')
  })
  it('the HTML holds the job, every stage, its rows, the signer in the cursive face and the foot, with the words escaped', () => {
    const html = buildChecklistPaperHtml({
      jobLabel: 'J1042',
      customer: 'Pruett & Vance',
      address: '12 Harbor Lane',
      printedAtIso: '2026-11-06T16:30:00.000Z',
      stages: [
        { name: 'Trim Set', standing: filedHeaderWords(R1), rows: R1.rows.map(paperRowFromRecordRow), skipped: skippedLineWords(R1.skipped), foot: filedFootWords('Trim Set', R1.noCount) },
        { name: 'Rough In', standing: 'Open · 0 of 2 answered', rows: [], skipped: '', foot: '' },
      ],
    })
    expect(html).toContain('<title>Stage checklists · J1042</title>')
    expect(html).toContain('J1042 · Pruett &amp; Vance · 12 Harbor Lane')
    expect(html).toContain('Trim Set <span class="standing">Record CL-1042-1 · v1')
    expect(html).toContain('1. Did the final water test hold?')
    expect(html).toContain('<span class="ink">Luis Ortega</span>')
    expect(html).toContain('<span class="no">· Roofer not here until Mon</span>')
    expect(html).toContain('Not on this job: Is the grease interceptor set')
    expect(html).toContain('One check reads No; the office acts on that.')
    expect(html).toContain('No questions on this stage.')
    expect(html).toContain('data-theme="light"')
    expect(html).toContain('Printed Nov 6 · 10:30 am')
  })
})
