import { describe, expect, it } from 'vitest'
import { lienStopProof, type LienStopProofFiling } from './lienStopProof'

// Every name and number here is made up.
const filed = (over: Partial<LienStopProofFiling> = {}): LienStopProofFiling => ({ kind: 'affidavit', sends: [], served_at: null, fields: null, document_url: 'https://drive.example/scan', document_note: '', ...over }) as LienStopProofFiling
const cards = (f: LienStopProofFiling, isSub: boolean) => lienStopProof(f, { isSub })!.envelopes.map((e) => e.recipient)

describe('a stop window’s reading of a filed lien’s proof', () => {
  it('counts the contractor’s copy on a job under a GC before that copy has any record', () => {
    const p = lienStopProof(filed(), { isSub: true })!
    expect(p.envelopes.map((e) => [e.recipient, e.line])).toEqual([
      ['owner', 'Not mailed yet'],
      ['original_contractor', 'Not mailed yet'],
    ])
    // The stamped scan and two receipts: three pieces, one on file.
    expect(p.chip).toBe('Mail proof: 1 of 3 on file')
  })

  it('shows the owner’s card alone on a job contracted with the owner', () => {
    const p = lienStopProof(filed(), { isSub: false })!
    expect(p.envelopes.map((e) => e.recipient)).toEqual(['owner'])
    expect(p.chip).toBe('Mail proof: 1 of 2 on file')
  })

  it('takes the paper’s own answer over the job’s, as the copies window does', () => {
    // The lien was drawn while the job sat under a GC. The job has none today.
    expect(cards(filed({ fields: { isSub: true } as never }), false)).toEqual(['owner', 'original_contractor'])
    // Drawn as a direct contract. The job sits under a GC today.
    expect(cards(filed({ fields: { isSub: false } as never }), true)).toEqual(['owner'])
    // A paper that keeps no answer follows the job.
    expect(cards(filed({ fields: { ownerName: 'Maple Row LLC' } as never }), true)).toEqual(['owner', 'original_contractor'])
  })

  it('still shows a contractor’s copy that has a record, whatever the job says', () => {
    const f = filed({ sends: [{ recipient: 'original_contractor', method: 'certified_mail', tracking: '9507 02', sent_on: '2026-11-17' }] as never })
    expect(cards(f, false)).toEqual(['owner', 'original_contractor'])
  })

  it('reads a notice from its sends and lists its mailed files when the screen holds them', () => {
    const sends = [{ recipient: 'owner', method: 'certified_mail', tracking: '9507 01', sent_on: '2026-11-17' }]
    const copies = [{ url: 'https://drive.example/file/1', driveFileId: 'd1', name: 'Lien notice as mailed · 1042.pdf', at: '2026-11-17T15:00:00Z', by: 'u1' }]
    // A notice has an envelope for each send and no more: the job's GC adds none.
    const bare = lienStopProof(filed({ kind: 'notice_53_056', sends: sends as never, document_url: '' }), { isSub: true })!
    expect(bare.envelopes.map((e) => e.recipient)).toEqual(['owner'])
    expect(bare.files).toEqual([])
    const withFiles = lienStopProof(filed({ kind: 'notice_53_056', sends: sends as never, document_url: '' }), { isSub: true, mailedCopies: copies })!
    expect(withFiles.files.map((f) => f.name)).toEqual(['Lien notice as mailed · 1042.pdf'])
  })

  it('reads nothing for a paper that is not mailed with proof', () => {
    expect(lienStopProof(filed({ kind: 'release_of_record' }), { isSub: true })).toBeNull()
  })
})
