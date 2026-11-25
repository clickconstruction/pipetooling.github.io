import { describe, expect, it } from 'vitest'
import { parseDecided, parseJobPaperProposal } from './jobPaperProposalsIo'

describe('jobPaperProposalsIo · what the office reads of a GC’s proposal', () => {
  it('reads a row loosely, and none without an id and a paper', () => {
    expect(parseJobPaperProposal({ id: 'p-1', required_paper_id: 'row-1', proposed_by_name: ' Greta Sample ', proposed_at: '2026-11-25T02:00:00+00:00', from_settings: { photos: 'standard', n: 3 }, settings: { photos: 'strict' } })).toEqual({
      id: 'p-1',
      requiredPaperId: 'row-1',
      byName: 'Greta Sample',
      proposedAt: '2026-11-25T02:00:00+00:00',
      fromPicks: { photos: 'standard' },
      picks: { photos: 'strict' },
    })
    expect(parseJobPaperProposal({ id: 'p-1' })).toBeNull()
    expect(parseJobPaperProposal({ required_paper_id: 'row-1' })).toBeNull()
    expect(parseJobPaperProposal(null)).toBeNull()
    expect(parseJobPaperProposal({ id: 'p-1', required_paper_id: 'row-1', settings: ['photos'] })).toEqual({ id: 'p-1', requiredPaperId: 'row-1', byName: '', proposedAt: null, fromPicks: {}, picks: {} })
  })

  it('reads the database’s answer to a take and to a decline', () => {
    expect(parseDecided({ proposal: 'taken', state: 'revised', sign_again: 3 })).toEqual({ took: true, signAgain: 3 })
    expect(parseDecided({ proposal: 'taken', state: 'saved', sign_again: 0 })).toEqual({ took: true, signAgain: 0 })
    expect(parseDecided({ proposal: 'declined', id: 'row-1' })).toEqual({ took: false, signAgain: 0 })
    expect(parseDecided(null)).toEqual({ took: false, signAgain: 0 })
  })
})
