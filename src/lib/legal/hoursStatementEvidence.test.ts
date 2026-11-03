/**
 * A signed hours statement onto the matter (punch list #212, PR 4): the title, the shows line, the file name, why Add
 * to evidence is held, the orchestration (the link, the bytes, the add, the tie), and the copy taken off again when
 * the tie fails.
 */
import { describe, expect, it, vi } from 'vitest'
import { addHoursStatementToEvidence, hoursStatementEvidenceFileName, hoursStatementEvidenceProblem, hoursStatementEvidenceShows, hoursStatementEvidenceTitle, hoursStatementOnMatterWords, type HoursStatementEvidenceIo } from './hoursStatementEvidence'

// Every name, job and number here is made up.
const statement = { id: 'hs-1', recordId: 'HS-1042-0007', workerName: 'Marcus Reyes', hours: 118.5, periodLabel: 'June 1 – June 28, 2026', withPay: true, statedDays: 0, signedOn: '2026-11-02', contractDocumentId: 'doc-7', matterDocumentId: null, signed: true, state: 'signed' }

describe('the words', () => {
  it('titles the copy, writes the shows line and names the file', () => {
    expect(hoursStatementEvidenceTitle(statement)).toBe('Signed hours statement HS-1042-0007 · Marcus Reyes')
    expect(hoursStatementEvidenceShows(statement, { label: '1042', site: '12 Elm St' })).toBe('Marcus Reyes signed for 118.5 h of work on job 1042 at 12 Elm St, June 1 – June 28, 2026 and what the company paid for it, from the clock and the pay reports as they stood.')
    expect(hoursStatementEvidenceShows({ ...statement, hours: 8, withPay: false, statedDays: 2 }, { label: '1042', site: null })).toBe('Marcus Reyes signed for 8 h of work on job 1042, June 1 – June 28, 2026, from the clock and the pay reports as they stood. 2 days are as the worker states them, not as the company recorded them.')
    expect(hoursStatementEvidenceFileName('HS-1042-0007')).toBe('HS-1042-0007 signed.pdf')
    expect(hoursStatementOnMatterWords('HS-1042-0007')).toContain('HS-1042-0007 is on the matter')
  })

  it('holds Add to evidence until the statement is signed, has a copy, is not on the matter yet, and the matter is there and ours', () => {
    expect(hoursStatementEvidenceProblem({ ...statement, signed: false }, { id: 'm1', canEdit: true })).toBe('Only a signed statement goes on the matter.')
    expect(hoursStatementEvidenceProblem({ ...statement, contractDocumentId: null }, { id: 'm1', canEdit: true })).toBe('This statement has no signed copy to add.')
    expect(hoursStatementEvidenceProblem({ ...statement, matterDocumentId: 'ld-1' }, { id: 'm1', canEdit: true })).toBe('Already on the matter.')
    expect(hoursStatementEvidenceProblem(statement, { id: null, canEdit: true })).toBe('Make the matter first: save the narrative or send the account to the firm.')
    expect(hoursStatementEvidenceProblem(statement, { id: 'm1', canEdit: false })).toBe('The matter is not yours to change.')
    expect(hoursStatementEvidenceProblem(statement, { id: 'm1', canEdit: true })).toBeNull()
  })
})

describe('addHoursStatementToEvidence', () => {
  const io = (over: Partial<HoursStatementEvidenceIo> = {}): HoursStatementEvidenceIo & { calls: string[] } => {
    const calls: string[] = []
    return {
      calls,
      signedPdfUrl: vi.fn(async (id) => {
        calls.push(`url:${id}`)
        return 'https://files.example.com/signed.pdf'
      }),
      fetchBytes: vi.fn(async (url) => {
        calls.push(`fetch:${url}`)
        return new Blob(['%PDF-1.7'], { type: 'application/pdf' })
      }),
      addDocument: vi.fn(async (matterId, draft, file) => {
        calls.push(`add:${matterId}:${draft.title}:${file.name}:${draft.datedOn}:${draft.state}`)
        return 'ld-9'
      }),
      linkStatement: vi.fn(async (id, docId) => {
        calls.push(`link:${id}:${docId}`)
      }),
      retireDocument: vi.fn(async (docId) => {
        calls.push(`retire:${docId}`)
      }),
      ...over,
    }
  }

  it('fetches the signed PDF through the gate, files it on the matter dated the signing day, and ties the statement to it', async () => {
    const fake = io()
    const out = await addHoursStatementToEvidence(fake, { matterId: 'm1', statement, job: { label: '1042', site: '12 Elm St' } })
    expect(out).toEqual({ matterDocumentId: 'ld-9' })
    expect(fake.calls).toEqual(['url:doc-7', 'fetch:https://files.example.com/signed.pdf', 'add:m1:Signed hours statement HS-1042-0007 · Marcus Reyes:HS-1042-0007 signed.pdf:2026-11-02:final', 'link:hs-1:ld-9'])
  })

  it('takes the copy off again when the tie fails, and says why', async () => {
    const fake = io({ linkStatement: vi.fn(async () => { throw new Error('the row is read-only') }) })
    await expect(addHoursStatementToEvidence(fake, { matterId: 'm1', statement, job: { label: '1042', site: null } })).rejects.toThrow('the row is read-only')
    expect(fake.calls[fake.calls.length - 1]).toBe('retire:ld-9')
  })

  it('refuses a statement with no signed copy before any call', async () => {
    const fake = io()
    await expect(addHoursStatementToEvidence(fake, { matterId: 'm1', statement: { ...statement, contractDocumentId: null }, job: { label: '1042', site: null } })).rejects.toThrow('no signed copy')
    expect(fake.calls).toEqual([])
  })
})
