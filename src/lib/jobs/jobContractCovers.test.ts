import { describe, expect, it } from 'vitest'
import {
  buildCoverableJobs,
  contractCoversLine,
  coversEditDiff,
  coversGroupKey,
  coversSheetWords,
  groupPapers,
  isLivePaperFiling,
  joinJobNumbers,
  siblingOfferWords,
  siblingPaperOffers,
  streetOf,
  type PaperRowLike,
} from './jobContractCovers'

const paper = (o: Partial<PaperRowLike> & { id: string; job_id: string }): PaperRowLike => ({
  status: 'signed',
  voided_at: null,
  signer_mode: 'paper',
  signed_at: '2025-03-14T12:00:00Z',
  signer_printed_name: 'Michael Palmer',
  signed_document_url: 'https://docs.google.com/document/d/abc',
  paper_upload_path: null,
  covers_group_id: null,
  created_at: '2026-10-01T10:00:00Z',
  ...o,
})

describe('words', () => {
  it('joins job numbers the way a person says them', () => {
    expect(joinJobNumbers([])).toBe('')
    expect(joinJobNumbers(['251'])).toBe('251')
    expect(joinJobNumbers(['251', '825'])).toBe('251 and 825')
    expect(joinJobNumbers(['251', '825', '843'])).toBe('251, 825 and 843')
  })
  it('says nothing extra for a paper that covers only its own job', () => {
    expect(contractCoversLine(['251'])).toBeNull()
    expect(contractCoversLine(['251', '825', '843'])).toBe('Covers jobs 251, 825 and 843')
    expect(contractCoversLine(['1064', '1054'])).toBe('Covers jobs 1054 and 1064')
  })
  it('keeps the street of an address', () => {
    expect(streetOf('180 Go Away Rd, Blanco, TX 78606')).toBe('180 Go Away Rd')
    expect(streetOf(null)).toBe('')
  })
  it('the sheet names the jobs and the button counts them', () => {
    expect(coversSheetWords(['251'], 'add')).toEqual({ summary: 'Job 251 will read signed and on file.', button: 'File for this job' })
    expect(coversSheetWords(['251', '825', '843'], 'add')).toEqual({
      summary: 'Jobs 251, 825 and 843 will read signed and on file. One paper covers all 3.',
      button: 'File for 3 jobs',
    })
    expect(coversSheetWords(['1054', '1064'], 'add').summary).toBe('Jobs 1054 and 1064 will read signed and on file. One paper covers both.')
    expect(coversSheetWords([], 'add').button).toBe('File it')
    expect(coversSheetWords(['251', '825'], 'edit').summary).toBe('The paper will cover jobs 251 and 825.')
    expect(coversSheetWords([], 'edit').button).toBe('Save')
  })
  it('the offer names the jobs the paper covers', () => {
    expect(siblingOfferWords(['251'])).toBe('A signed paper on file covers job 251. Does it name this job too?')
    expect(siblingOfferWords(['843', '251', '825'])).toBe('A signed paper on file covers jobs 251, 825 and 843. Does it name this job too?')
  })
})

describe('buildCoverableJobs', () => {
  const jobs = [
    { id: 'a', hcp_number: '251', click_number: null, job_name: 'Michael Palmer', job_address: '180 Go Away Rd, Blanco, TX', status: 'billed' },
    { id: 'b', hcp_number: '843', click_number: null, job_name: 'x', job_address: '102 Jacob Roberts, Blanco', status: 'billed' },
    { id: 'c', hcp_number: '', click_number: 'J922', job_name: 'y', job_address: '138 W Pat Dolan, Blanco', status: 'working' },
    { id: 'd', hcp_number: '620', click_number: null, job_name: 'z', job_address: null, status: 'paid' },
    { id: 'e', hcp_number: '825', click_number: null, job_name: 'w', job_address: '121 North Calvin Barrett', status: 'billed' },
  ]
  it('leaves out the anchor job, puts open jobs first by number, paid last', () => {
    const out = buildCoverableJobs(jobs, 'a', new Set())
    expect(out.map((j) => j.num)).toEqual(['825', '843', 'J922', '620'])
    expect(out[3]).toMatchObject({ paid: true, where: 'z', statusWord: 'Paid' })
    expect(out[2]).toMatchObject({ where: '138 W Pat Dolan', statusWord: 'Working' })
  })
  it('flags a job another paper covers', () => {
    const out = buildCoverableJobs(jobs, null, new Set(['b']))
    expect(out.find((j) => j.id === 'b')?.coveredElsewhere).toBe(true)
    expect(out.find((j) => j.id === 'a')?.coveredElsewhere).toBe(false)
  })
})

describe('coversEditDiff', () => {
  it('adds the new ticks and removes the cleared ones', () => {
    expect(coversEditDiff(['a', 'b', 'c'], ['a', 'c', 'd'])).toEqual({ add: ['d'], remove: ['b'] })
  })
})

describe('papers', () => {
  it('groups rows filed together and keeps a lone filing as its own paper', () => {
    const rows = [
      paper({ id: 'r1', job_id: 'a', covers_group_id: 'r1' }),
      paper({ id: 'r2', job_id: 'b', covers_group_id: 'r1' }),
      paper({ id: 'r3', job_id: 'c' }),
    ]
    expect(coversGroupKey(rows[1]!)).toBe('r1')
    expect(coversGroupKey(rows[2]!)).toBe('r3')
    const papers = groupPapers(rows)
    expect(papers).toHaveLength(2)
    expect(papers.find((p) => p.key === 'r1')?.jobIds).toEqual(['a', 'b'])
  })
  it('only a live signed paper filing with a link or a scan counts', () => {
    expect(isLivePaperFiling(paper({ id: '1', job_id: 'a' }))).toBe(true)
    expect(isLivePaperFiling(paper({ id: '1', job_id: 'a', voided_at: '2026-10-01' }))).toBe(false)
    expect(isLivePaperFiling(paper({ id: '1', job_id: 'a', signer_mode: 'draw' }))).toBe(false)
    expect(isLivePaperFiling(paper({ id: '1', job_id: 'a', signed_document_url: null }))).toBe(false)
    expect(isLivePaperFiling(paper({ id: '1', job_id: 'a', signed_document_url: null, paper_upload_path: 'x/paper.pdf' }))).toBe(true)
  })
  it('offers a job only the papers that do not already cover it', () => {
    const papers = groupPapers([paper({ id: 'r1', job_id: 'a', covers_group_id: 'r1' }), paper({ id: 'r2', job_id: 'b', covers_group_id: 'r1' }), paper({ id: 'r3', job_id: 'c' })])
    expect(siblingPaperOffers(papers, 'a').map((p) => p.key)).toEqual(['r3'])
    expect(siblingPaperOffers(papers, 'z')).toHaveLength(2)
  })
})
