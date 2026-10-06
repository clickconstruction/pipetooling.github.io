import { describe, expect, it } from 'vitest'
import { jobContractSignatureAuditLine, jobContractSignatureBlocks, jobContractSignersAuditLine } from './jobContractLifecycle'

/** A second signer in the agreement's audit line and printed blocks (v2.4590). */
const STATUTES = ' · 15 U.S.C. § 7001 · Tex. Bus. & Com. Code ch. 322'
const one = {
  id: 'abcdef12-0000-0000-0000-000000000000',
  recipient_name: 'Sam Owner',
  signed_at: '2026-09-29T19:05:00Z',
  signer_printed_name: 'Sam Owner',
  signer_mode: 'type',
  signer_consented_at: '2026-09-29T19:00:00Z',
}
const two = {
  ...one,
  co_signer_name: 'Alex Owner',
  co_signed_at: '2026-09-29T19:05:00Z',
  co_signer_printed_name: 'Alex Owner',
  co_signer_mode: 'draw',
  co_signer_consented_at: '2026-09-29T19:05:00Z',
}

/** A paper filed with both names: the second frame marked paper, stamped with the record (v2.4657). */
const paperTwo = {
  ...one,
  signer_mode: 'paper',
  signer_consented_at: null,
  co_signer_name: 'Alex Owner',
  co_signed_at: one.signed_at,
  co_signer_printed_name: 'Alex Owner',
  co_signer_mode: 'paper',
  co_signer_consented_at: null,
}

/** The first frame filed from a paper; the second signed through the link before it came back (v2.4657). */
const paperAfterLink = { ...paperTwo, co_signer_mode: 'draw', co_signer_consented_at: '2026-09-29T19:05:00Z' }

describe('jobContractSignersAuditLine — the line in History and Documents', () => {
  it('one signer reads exactly as the one-block line', () => {
    expect(jobContractSignersAuditLine(one)).toBe(jobContractSignatureAuditLine(one))
    expect(jobContractSignersAuditLine(one)).toBe(`Signed electronically by Sam Owner (typed) · Sep 29, 2026, 2:05 PM CT · consent recorded${STATUTES}`)
  })

  it('two signers: both named, each way they signed, the agreement stamp', () => {
    expect(jobContractSignersAuditLine(two)).toBe(`Signed electronically by Sam Owner and Alex Owner (typed and drawn) · Sep 29, 2026, 2:05 PM CT · consent recorded${STATUTES}`)
    expect(jobContractSignersAuditLine({ ...two, co_signer_mode: 'type' })).toBe(`Signed electronically by Sam Owner and Alex Owner (typed) · Sep 29, 2026, 2:05 PM CT · consent recorded${STATUTES}`)
  })

  it('a paper record keeps its own line; an unsigned row has none', () => {
    const paper = { ...two, signer_mode: 'paper', signer_consented_at: null, co_signed_at: null, co_signer_printed_name: null, signer_printed_name: 'Sam Owner and Alex Owner' }
    expect(jobContractSignersAuditLine(paper)).toBe('Signed on paper by Sam Owner and Alex Owner · recorded Sep 29, 2026, 2:05 PM CT')
    expect(jobContractSignersAuditLine({ ...two, signed_at: null, co_signed_at: null, co_signer_printed_name: null })).toBeNull()
  })

  it('a paper signed by two names both frames; a second signer who did not sign is left out (v2.4657)', () => {
    expect(jobContractSignersAuditLine(paperTwo)).toBe('Signed on paper by Sam Owner and Alex Owner · recorded Sep 29, 2026, 2:05 PM CT')
    const named = { ...paperTwo, co_signed_at: null, co_signer_printed_name: null, co_signer_mode: null }
    expect(jobContractSignersAuditLine(named)).toBe('Signed on paper by Sam Owner · recorded Sep 29, 2026, 2:05 PM CT')
  })

  it('a paper filed after the second signer signed through the link names only the paper’s signer (v2.4657)', () => {
    expect(jobContractSignersAuditLine(paperAfterLink)).toBe('Signed on paper by Sam Owner · recorded Sep 29, 2026, 2:05 PM CT')
  })
})

describe('jobContractSignatureBlocks — what every print draws', () => {
  it('one signer: the block the prints drew before, nothing second', () => {
    const b = jobContractSignatureBlocks(one, { signatureUrl: 'https://x.test/a.png' })
    expect(b).toEqual({
      signature: { printedName: 'Sam Owner', auditLine: jobContractSignatureAuditLine(one), imageUrl: 'https://x.test/a.png', paper: false },
      coSignerName: null,
      coSignature: null,
    })
    // the record's print adds the record id and the stamp beside the name
    expect(jobContractSignatureBlocks(one, { record: { jobNumber: '1053' } }).signature).toMatchObject({ recordId: 'J1053-ABCDEF', whenLabel: 'Sep 29, 2026, 2:05 PM CT' })
    expect(jobContractSignatureBlocks({ ...one, signed_at: null }).signature).toBeNull()
  })

  it('both signed: a block per frame, each with its own stamp and image', () => {
    const b = jobContractSignatureBlocks(two, { signatureUrl: 'https://x.test/a.png', coSignatureUrl: 'https://x.test/b.png', record: { jobNumber: '1053' } })
    expect(b.signature).toMatchObject({ printedName: 'Sam Owner', imageUrl: 'https://x.test/a.png', whenLabel: 'Sep 29, 2026, 2:00 PM CT' })
    expect(b.signature?.auditLine).toBe(`Signed electronically by Sam Owner (typed) · Sep 29, 2026, 2:00 PM CT · consent recorded${STATUTES}`)
    expect(b.coSignerName).toBe('Alex Owner')
    expect(b.coSignature).toMatchObject({ printedName: 'Alex Owner', imageUrl: 'https://x.test/b.png', whenLabel: 'Sep 29, 2026, 2:05 PM CT' })
    expect(b.coSignature?.auditLine).toBe(`Signed electronically by Alex Owner (drawn) · Sep 29, 2026, 2:05 PM CT · consent recorded${STATUTES}`)
  })

  it('one of two signed (still out): the first block signed, the second open with its name', () => {
    const half = { ...two, signed_at: null, co_signed_at: null, co_signer_printed_name: null, co_signer_mode: null, co_signer_consented_at: null }
    const b = jobContractSignatureBlocks(half)
    expect(b.signature?.printedName).toBe('Sam Owner')
    expect(b.coSignerName).toBe('Alex Owner')
    expect(b.coSignature).toBeNull()
  })

  it('a second signer named on a draft: both blocks open', () => {
    const draft = { id: '', signed_at: null, signer_printed_name: null, signer_mode: null, signer_consented_at: null, recipient_name: 'Sam Owner', co_signer_name: ' Alex Owner ' }
    expect(jobContractSignatureBlocks(draft)).toEqual({ signature: null, coSignerName: 'Alex Owner', coSignature: null })
  })

  it('a paper record draws one Signed on paper block: the signatures are on the scan', () => {
    const paper = { ...one, signer_mode: 'paper', signer_consented_at: null, co_signer_name: 'Alex Owner' }
    const b = jobContractSignatureBlocks(paper)
    expect(b.signature).toMatchObject({ printedName: 'Sam Owner', paper: true })
    expect(b.coSignerName).toBeNull()
  })

  it('a paper signed by two is still one block, and it names both (v2.4657)', () => {
    const b = jobContractSignatureBlocks(paperTwo, { record: { jobNumber: '1053' } })
    expect(b.signature).toMatchObject({
      printedName: 'Sam Owner and Alex Owner',
      auditLine: 'Signed on paper by Sam Owner and Alex Owner · recorded Sep 29, 2026, 2:05 PM CT',
      paper: true,
      whenLabel: 'Sep 29, 2026, 2:05 PM CT',
    })
    expect(b.coSignerName).toBeNull()
    expect(b.coSignature).toBeNull()
  })

  it('a second signature given through the link before the paper came back keeps its own block (v2.4657)', () => {
    const b = jobContractSignatureBlocks(paperAfterLink, { coSignatureUrl: 'https://x.test/b.png' })
    expect(b.signature).toMatchObject({ printedName: 'Sam Owner', auditLine: 'Signed on paper by Sam Owner · recorded Sep 29, 2026, 2:05 PM CT', paper: true })
    expect(b.coSignerName).toBe('Alex Owner')
    expect(b.coSignature).toMatchObject({
      printedName: 'Alex Owner',
      auditLine: `Signed electronically by Alex Owner (drawn) · Sep 29, 2026, 2:05 PM CT · consent recorded${STATUTES}`,
      imageUrl: 'https://x.test/b.png',
      paper: false,
    })
  })
})
