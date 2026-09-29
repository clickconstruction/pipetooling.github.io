import { describe, expect, it } from 'vitest'
import { abbreviateUa, signedDoors, signedHowLine, signedShareLine } from './contractSignedDoors'

const online = { signer_mode: 'typed', signed_document_url: null, paper_upload_path: null, public_token: 'tok' }
const base = { phone: '', storedPdf: false, uploadedCopy: false, estimateId: null, estimateNumber: null }

describe('signedDoors — the Contract window\'s signed state', () => {
  it('a contract signed online: the customer\'s page to copy or text, a copy by email with the PDF, the stored PDF, print', () => {
    const d = signedDoors({ ...base, source: 'contract', row: online, phone: '5125550100', storedPdf: true })
    expect(d.verb).toBe('Signed')
    expect(d.copyLink).toBe(true)
    expect(d.textLink).toBe(true)
    expect(d.emailCopy).toEqual({ attachment: 'pdf', sub: 'PDF attached' })
    expect(d.downloadPdf).toBe('stored')
    expect(d.print).toBe(true)
    expect(d.document).toBeNull()
    expect(d.openUploaded).toBe(false)
    expect(d.openEstimate).toBeNull()
    // no phone on file: nothing to text; no stored PDF yet: share-job-contract builds one
    const d2 = signedDoors({ ...base, source: 'contract', row: online })
    expect(d2.textLink).toBe(false)
    expect(d2.downloadPdf).toBe('build')
    expect(signedHowLine({ source: 'contract', row: online, estimateDrawn: false })).toBe('Typed on their phone')
    expect(signedHowLine({ source: 'contract', row: { ...online, signer_mode: 'draw' }, estimateDrawn: false })).toBe('Drawn on their phone')
    expect(signedHowLine({ source: 'contract', row: { ...online, signer_mode: 'in_person' }, estimateDrawn: false })).toBe('Signed in person on our device')
  })

  it('a paper copy the office uploaded: the uploaded copy and a copy by email; no link, no build, no print', () => {
    const row = { signer_mode: 'paper', signed_document_url: null, paper_upload_path: 'jc/1/paper.jpg', public_token: null }
    const d = signedDoors({ ...base, source: 'paper', row, phone: '5125550100', uploadedCopy: true })
    expect(d.copyLink).toBe(false)
    expect(d.textLink).toBe(false)
    expect(d.emailCopy).toEqual({ attachment: 'pdf', sub: 'PDF attached' })
    expect(d.downloadPdf).toBeNull()
    expect(d.openUploaded).toBe(true)
    expect(d.print).toBe(false)
    expect(signedHowLine({ source: 'paper', row, estimateDrawn: false })).toBe('Signed on paper, uploaded by the office')
    // nothing uploaded and no link: no copy to email
    expect(signedDoors({ ...base, source: 'paper', row: { ...row, paper_upload_path: null } }).emailCopy).toBeNull()
  })

  it('a filed Google Doc: the document door, and the copy by email goes as the link', () => {
    const row = { signer_mode: 'paper', signed_document_url: 'https://docs.google.com/document/d/abc123/edit', paper_upload_path: null, public_token: null }
    const d = signedDoors({ ...base, source: 'paper', row })
    expect(d.document?.label).toBe('Open the signed Google Doc')
    expect(d.document?.gdoc).toBe(true)
    expect(d.emailCopy).toEqual({ attachment: 'link', sub: 'the link' })
    expect(d.downloadPdf).toBeNull()
    expect(d.openUploaded).toBe(false)
    expect(signedHowLine({ source: 'paper', row, estimateDrawn: false })).toBe('Signed outside the app · filed as a Google Doc')
  })

  it('an estimate or bid-room acceptance: Accepted, a copy by email and a built PDF, the door to where it lives', () => {
    const d = signedDoors({ ...base, source: 'estimate', row: null, estimateId: 'e1', estimateNumber: 12 })
    expect(d.verb).toBe('Accepted')
    expect(d.copyLink).toBe(false)
    expect(d.emailCopy).toEqual({ attachment: 'pdf', sub: 'PDF attached' })
    expect(d.downloadPdf).toBe('build')
    expect(d.print).toBe(false)
    expect(d.openEstimate).toBe('Open estimate #12')
    expect(signedDoors({ ...base, source: 'bid_room', row: null, estimateId: 'e1', estimateNumber: 7 }).openEstimate).toBe('Open proposal #7')
    // the estimates row not loaded yet: nothing to share
    expect(signedDoors({ ...base, source: 'estimate', row: null }).emailCopy).toBeNull()
    expect(signedHowLine({ source: 'estimate', row: null, estimateDrawn: true })).toBe('Drawn on the estimate page')
    expect(signedHowLine({ source: 'bid_room', row: null, estimateDrawn: false })).toBe('Typed on the estimate page')
  })

  it('the share line and the device', () => {
    const stamp = (iso: string) => iso.slice(0, 10)
    expect(signedShareLine(null, stamp)).toBe('Not shared yet')
    expect(signedShareLine({ to: ['a@x.com', 'b@x.com'], at: '2026-09-20T15:00:00Z', by: 'Robert' }, stamp)).toBe('↗ Shared with a@x.com, b@x.com · 2026-09-20 by Robert')
    expect(signedShareLine({ to: ['a@x.com'], at: '2026-09-20T15:00:00Z', by: null }, stamp)).toBe('↗ Shared with a@x.com · 2026-09-20')
    expect(abbreviateUa('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')).toBe('iPhone · Safari')
    expect(abbreviateUa('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36')).toBe('Windows · Chrome')
    expect(abbreviateUa(null)).toBe('—')
  })
})
