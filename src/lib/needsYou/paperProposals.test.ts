import { describe, expect, it } from 'vitest'
import { PAPER_PROPOSALS_ACTION, paperProposalsDetail, paperProposalsHref, paperProposalsTitle, paperProposalsWaiting, parsePaperProposalSource, type PaperProposalJobSource, type PaperProposalSource } from './paperProposals'

/** Every job, name and day here is made up. */
const job = (id: string, over: Partial<PaperProposalJobSource> = {}): PaperProposalJobSource => ({ id, hcp_number: null, click_number: '900', job_name: 'ZZ Test Oak', job_address: null, ...over })
const proposal = (id: string, job_id: string, over: Partial<PaperProposalSource> = {}): PaperProposalSource => ({ id, job_id, proposed_by_name: 'ZZ Test Pat', proposed_at: '2026-11-20T15:00:00Z', ...over })

describe('paperProposalsWaiting', () => {
  it('names a waiting proposal by its job and who proposed it', () => {
    const d = paperProposalsWaiting([proposal('p1', 'j1')], [job('j1')])
    expect(d.rows).toEqual([{ proposalId: 'p1', jobId: 'j1', jobLabel: '#900 ZZ Test Oak', byName: 'ZZ Test Pat', proposedAt: '2026-11-20T15:00:00Z' }])
    expect(d.jobIds).toEqual(['j1'])
  })

  it('puts the longest wait first, and lists a job once', () => {
    const d = paperProposalsWaiting(
      [proposal('p2', 'j2', { proposed_at: '2026-11-22T09:00:00Z' }), proposal('p1', 'j1', { proposed_at: '2026-11-20T15:00:00Z' }), proposal('p3', 'j2', { proposed_at: '2026-11-23T09:00:00Z' })],
      [job('j1'), job('j2', { click_number: '901', job_name: 'ZZ Test Elm' })],
    )
    expect(d.rows.map((r) => r.proposalId)).toEqual(['p1', 'p2', 'p3'])
    expect(d.jobIds).toEqual(['j1', 'j2'])
  })

  it('keeps a proposal whose job the read did not return, named by the job’s id', () => {
    const d = paperProposalsWaiting([proposal('p1', 'abcdef0123456789')], [])
    expect(d.rows[0]).toMatchObject({ jobId: 'abcdef0123456789', jobLabel: 'job abcdef01' })
  })

  it('trims the typed name, and reads a missing one as empty', () => {
    const d = paperProposalsWaiting([proposal('p1', 'j1', { proposed_by_name: '  ZZ Test Pat  ' }), proposal('p2', 'j1', { proposed_by_name: null, proposed_at: '2026-11-21T00:00:00Z' })], [job('j1')])
    expect(d.rows.map((r) => r.byName)).toEqual(['ZZ Test Pat', ''])
  })

  it('reads nothing as nothing', () => {
    expect(paperProposalsWaiting([], [])).toEqual({ rows: [], jobIds: [] })
  })
})

describe('parsePaperProposalSource', () => {
  it('reads a row of the table', () => {
    expect(parsePaperProposalSource({ id: 'p1', job_id: 'j1', proposed_by_name: 'ZZ Test Pat', proposed_at: '2026-11-20T15:00:00Z', state: 'waiting' })).toEqual({ id: 'p1', job_id: 'j1', proposed_by_name: 'ZZ Test Pat', proposed_at: '2026-11-20T15:00:00Z' })
  })

  it('refuses a row with no id or no job, and anything that is not a row', () => {
    expect(parsePaperProposalSource({ job_id: 'j1' })).toBeNull()
    expect(parsePaperProposalSource({ id: 'p1' })).toBeNull()
    expect(parsePaperProposalSource(null)).toBeNull()
    expect(parsePaperProposalSource(['p1'])).toBeNull()
    expect(parsePaperProposalSource('p1')).toBeNull()
  })

  it('reads a missing name or day as null', () => {
    expect(parsePaperProposalSource({ id: 'p1', job_id: 'j1', proposed_by_name: 7 })).toEqual({ id: 'p1', job_id: 'j1', proposed_by_name: null, proposed_at: null })
  })
})

describe('the line’s words', () => {
  it('says one proposal, then how many', () => {
    expect(paperProposalsTitle(1)).toBe('A GC proposed stricter settings')
    expect(paperProposalsTitle(3)).toBe('3 GC proposals wait on an answer')
  })

  it('names who proposed and the job, and that nothing changes until an answer', () => {
    const one = paperProposalsWaiting([proposal('p1', 'j1')], [job('j1')])
    expect(paperProposalsDetail(one)).toBe('ZZ Test Pat proposed them for the paper on #900 ZZ Test Oak. Nothing changes until you answer. Open the job to take it or decline.')
    const two = paperProposalsWaiting([proposal('p1', 'j1'), proposal('p2', 'j2', { proposed_at: '2026-11-22T09:00:00Z' })], [job('j1'), job('j2')])
    expect(paperProposalsDetail(two)).toBe('ZZ Test Pat proposed them for the paper on #900 ZZ Test Oak. 1 more. Nothing changes until you answer. Open a job to take it or decline.')
  })

  it('says The GC when no name was kept, and nothing with no proposal', () => {
    const d = paperProposalsWaiting([proposal('p1', 'j1', { proposed_by_name: null })], [job('j1')])
    expect(paperProposalsDetail(d)).toMatch(/^The GC proposed them for the paper on #900 ZZ Test Oak\./)
    expect(paperProposalsDetail({ rows: [] })).toBe('')
  })

  it('opens the job’s window on Documents, and the Pipeline when no job is known', () => {
    expect(PAPER_PROPOSALS_ACTION).toBe('Open the job')
    expect(paperProposalsHref('j1')).toBe('/jobs?tab=stages&jobDetail=j1&jobTab=documents')
    expect(paperProposalsHref(null)).toBe('/jobs?tab=stages')
  })
})
