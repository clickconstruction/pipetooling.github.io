import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import type { JobLienFilingRow } from './lienDeadlines'
import {
  LIEN_SCAN_BATCH_WORDS,
  LIEN_SCAN_MATCH_WORDS,
  lienScanLeadWords,
  lienScanMatches,
  lienScanOutcome,
  lienScanPlan,
  lienScanPlanWords,
  lienScanTargetWords,
  lienScanTargetsFromDesk,
  type LienScanPiece,
  type LienScanTarget,
} from './lienScanBatch'

// Every name and number here is made up.
const target = (jobNumber: string, recordingNumber: string, over: Partial<LienScanTarget> = {}): LienScanTarget => ({ filingId: `f-${jobNumber}`, jobId: `job-${jobNumber}`, jobNumber, jobLabel: `${jobNumber} · Sample Job`, recordingNumber, filedYmd: '2026-11-13', county: 'Hays', hasScan: false, ...over })
const piece = (name: string, over: Partial<LienScanPiece> = {}): LienScanPiece => ({ key: name, name, size: 400_000, type: 'application/pdf', ...over })

const TARGETS = [target('2104', '2026-0041870'), target('2291', '2026-0041877'), target('2317', '2026-0041881')]

describe('lienScanTargetsFromDesk', () => {
  const filing = (id: string, job_id: string, over: Record<string, unknown> = {}) => ({ id, job_id, kind: 'affidavit', filed_at: '2026-11-13', voided_at: null, county: 'Hays', recording_number: `2026-${id}`, document_url: '', ...over }) as unknown as JobLienFilingRow

  it('takes every filed, live affidavit, by county and then by the job’s number, as a batch was printed for the clerk', () => {
    const targets = lienScanTargetsFromDesk({
      filingsByJob: {
        j1: [filing('a', 'j1'), filing('n', 'j1', { kind: 'notice_53_056' })],
        j2: [filing('b', 'j2', { county: 'Caldwell', document_url: ' https://drive.example/x ' })],
        j3: [filing('c', 'j3', { voided_at: '2026-11-14T00:00:00Z' })],
        j4: [filing('d', 'j4', { filed_at: null })],
        j5: [filing('e', 'j5')],
      },
      jobsById: { j1: { hcp_number: '2291', job_name: 'Cedar Hollow Lofts' }, j2: { hcp_number: '2400', job_name: null }, j5: { hcp_number: '310', job_name: 'Maple Court' } },
    })
    expect(targets.map((t) => [t.county, t.jobLabel, t.recordingNumber, t.hasScan])).toEqual([
      ['Caldwell', '2400', '2026-b', true],
      ['Hays', '310 · Maple Court', '2026-e', false],
      ['Hays', '2291 · Cedar Hollow Lofts', '2026-a', false],
    ])
    expect(lienScanLeadWords(targets)).toBe('2 filed liens have no scan yet.')
    expect(lienScanLeadWords([{ hasScan: false }])).toBe('1 filed lien has no scan yet.')
    expect(lienScanLeadWords([{ hasScan: true }])).toBe('Every filed lien has its scan.')
  })
})

describe('a job made in the app, with a Click number and no HCP number', () => {
  const filing = (id: string, job_id: string) => ({ id, job_id, kind: 'affidavit', filed_at: '2026-11-13', voided_at: null, county: 'Hays', recording_number: '', document_url: null }) as never

  it('carries its Click number on its label, and a scan named with that number finds it', () => {
    const targets = lienScanTargetsFromDesk({
      filingsByJob: { j1: [filing('a', 'j1')], j2: [filing('b', 'j2')], j3: [filing('c', 'j3')] },
      jobsById: { j1: { hcp_number: '', click_number: '863', job_name: 'Maple Court Service Visit' }, j2: { hcp_number: '2104', click_number: '880', job_name: 'Cedar Hollow Lofts' }, j3: { hcp_number: null, click_number: null, job_name: 'Sample Ridge Office' } },
    })
    expect(targets.map((t) => [t.jobNumber, t.jobLabel])).toEqual([
      ['', 'Sample Ridge Office'],
      ['863', '863 · Maple Court Service Visit'],
      ['2104', '2104 · Cedar Hollow Lofts'],
    ])
    expect(lienScanMatches([piece('Job 863 stamped.pdf')], targets)).toEqual({ 'Job 863 stamped.pdf': { filingId: 'a', by: 'job_number' } })
  })
})

describe('lienScanMatches', () => {
  it('matches a name that carries the recording number, however the number is punctuated', () => {
    const m = lienScanMatches([piece('doc 20260041877.pdf'), piece('2026-0041870 recorded.pdf')], TARGETS)
    expect(m).toEqual({ 'doc 20260041877.pdf': { filingId: 'f-2291', by: 'recording_number' }, '2026-0041870 recorded.pdf': { filingId: 'f-2104', by: 'recording_number' } })
  })

  it('then matches a name that carries the job’s number as a word of its own', () => {
    const m = lienScanMatches([piece('Job 2317 stamped.pdf'), piece('scan-2104.PDF'), piece('lien_12291.pdf')], TARGETS)
    expect(m['Job 2317 stamped.pdf']).toEqual({ filingId: 'f-2317', by: 'job_number' })
    expect(m['scan-2104.PDF']).toEqual({ filingId: 'f-2104', by: 'job_number' })
    // 12291 is not job 2291: it takes the lien that is left, by its place, and says so.
    expect(m['lien_12291.pdf']).toEqual({ filingId: 'f-2291', by: 'order' })
  })

  it('gives a name that says nothing the next lien nobody has, in the list’s order', () => {
    const m = lienScanMatches([piece('SCAN0001.pdf'), piece('Job 2104.pdf'), piece('SCAN0002.pdf'), piece('SCAN0003.pdf')], TARGETS)
    expect(m['Job 2104.pdf']).toEqual({ filingId: 'f-2104', by: 'job_number' })
    expect(m['SCAN0001.pdf']).toEqual({ filingId: 'f-2291', by: 'order' })
    expect(m['SCAN0002.pdf']).toEqual({ filingId: 'f-2317', by: 'order' })
    // More files than liens: the last has none.
    expect(m['SCAN0003.pdf']).toBeNull()
  })

  it('does not guess when a name fits two liens, or when a recording number is too short to trust', () => {
    const two = [target('7', '2026-0000001'), target('8', '2026-0000001')]
    expect(lienScanMatches([piece('2026-0000001.pdf')], two)['2026-0000001.pdf']).toEqual({ filingId: 'f-7', by: 'order' })
    const short = [target('40', '12'), target('41', '13')]
    expect(lienScanMatches([piece('page 13.pdf')], short)['page 13.pdf']).toEqual({ filingId: 'f-40', by: 'order' })
  })

  it('gives one lien to one file by its name', () => {
    const m = lienScanMatches([piece('2291 a.pdf'), piece('2291 b.pdf')], [target('2291', '')])
    expect(m).toEqual({ '2291 a.pdf': { filingId: 'f-2291', by: 'job_number' }, '2291 b.pdf': null })
  })
})

describe('lienScanPlan', () => {
  const pieces = [piece('a.pdf'), piece('b.pdf'), piece('c.pdf'), piece('notes.txt', { type: 'text/plain' }), piece('big.pdf', { size: 14 * 1024 * 1024 })]
  const matches = { 'a.pdf': { filingId: 'f-2104', by: 'order' as const }, 'b.pdf': { filingId: 'f-2104', by: 'hand' as const }, 'c.pdf': null, 'notes.txt': { filingId: 'f-2291', by: 'hand' as const }, 'big.pdf': { filingId: 'f-2317', by: 'hand' as const } }
  const plan = lienScanPlan(pieces, matches, TARGETS)

  it('saves what is ready and holds the rest, each with its reason', () => {
    expect(plan.ready.map((r) => [r.piece.name, r.target.jobNumber])).toEqual([['a.pdf', '2104']])
    expect(plan.held.map((h) => [h.piece.name, h.key, h.reason])).toEqual([
      ['b.pdf', 'second_for_lien', '2104 · Sample Job already has a scan above. A lien keeps one.'],
      ['c.pdf', 'no_lien', 'No lien is picked for it.'],
      ['notes.txt', 'bad_file', 'That file is not a scan or a photo. Add a PDF or a picture.'],
      ['big.pdf', 'bad_file', 'That file is 14 MB. The most a file can be is 10 MB. Scan this affidavit alone, or at a lower quality.'],
    ])
    expect(plan.without.map((t) => t.jobNumber)).toEqual(['2291', '2317'])
  })

  it('counts both on the press, and is dead only when nothing is ready', () => {
    expect(lienScanPlanWords(plan)).toEqual({ button: 'Save 1 scan · 4 held ▸', foot: '4 are held. They stay here with the reason. The 1 ready one saves now.', dead: false })
    expect(lienScanPlanWords(lienScanPlan([piece('a.pdf'), piece('b.pdf')], lienScanMatches([piece('a.pdf'), piece('b.pdf')], TARGETS), TARGETS)).button).toBe('Save 2 scans')
    expect(lienScanPlanWords(lienScanPlan([], {}, TARGETS))).toMatchObject({ button: 'Save', dead: true })
    expect(lienScanPlanWords(lienScanPlan([piece('c.pdf')], { 'c.pdf': null }, TARGETS)).dead).toBe(true)
  })

  it('does not send a piece to a lien that is not in the window', () => {
    expect(lienScanPlan([piece('a.pdf')], { 'a.pdf': { filingId: 'f-gone', by: 'hand' } }, TARGETS).held[0]?.key).toBe('no_lien')
  })
})

describe('the words', () => {
  it('names a lien by its job and the number the office reads off the stamp', () => {
    expect(lienScanTargetWords(TARGETS[1]!)).toBe('2291 · Sample Job · no. 2026-0041877')
    expect(lienScanTargetWords(target('9', ''))).toBe('9 · Sample Job · no recording number yet')
  })

  it('says what took and what did not', () => {
    expect(lienScanOutcome(12, 0)).toEqual({ line: 'Saved 12 scans.', head: null, tone: 'success' })
    expect(lienScanOutcome(3, 1)).toMatchObject({ line: 'Saved 3 scans. 1 did not save.', tone: 'warning' })
  })

  it('keeps every sentence plain', () => {
    const sentences = [LIEN_SCAN_BATCH_WORDS.how, LIEN_SCAN_BATCH_WORDS.check, LIEN_SCAN_BATCH_WORDS.where, ...Object.values(LIEN_SCAN_MATCH_WORDS)].flatMap((s) => s.split(/(?<=\.)\s+/)).filter(Boolean)
    for (const s of sentences) expect(plainWordsFailures(s), s).toEqual([])
  })
})
