import { describe, expect, it } from 'vitest'
import { coSignatureOnFile, expectedCoSignerName, fileSignedContractDateBlocks, fileSignedContractReady, firstSignatureOnFile, paperCoSignerFields, paperFrameColumns, paperSignerAfterLink, paperUploadPath } from './jobContractFileWrite'
import type { JobContractRow } from './jobContractLifecycle'

describe('filing a signed contract', () => {
  it('names the upload by the row and a safe extension', () => {
    expect(paperUploadPath('abc', 'Subcontract (signed).PDF')).toBe('abc/paper.pdf')
    expect(paperUploadPath('abc', 'IMG_0042.jpeg')).toBe('abc/paper.jpeg')
    expect(paperUploadPath('abc', 'scan')).toBe('abc/paper.scan')
    expect(paperUploadPath('abc', 'weird.@#$')).toBe('abc/paper.pdf')
  })

  it('is ready with a name and either a link or a file — never a name alone', () => {
    const file = new File(['x'], 'scan.pdf', { type: 'application/pdf' })
    expect(fileSignedContractReady({ link: '', file: null, signerName: 'Dudley Mason' })).toBe(false)
    expect(fileSignedContractReady({ link: 'https://docs.google.com/document/d/1', file: null, signerName: 'Dudley Mason' })).toBe(true)
    expect(fileSignedContractReady({ link: 'not a link', file: null, signerName: 'Dudley Mason' })).toBe(false)
    expect(fileSignedContractReady({ link: '', file, signerName: 'Dudley Mason' })).toBe(true)
    expect(fileSignedContractReady({ link: '', file, signerName: ' ' })).toBe(false)
  })

  it('stops on a Signed-on date with its year half typed; a finished date or none (recorded as now) goes through', () => {
    expect(fileSignedContractDateBlocks('2026-09-30', 2026)).toBeNull()
    expect(fileSignedContractDateBlocks('', 2026)).toBeNull()
    expect(fileSignedContractDateBlocks('0026-09-30', 2026)).toBe('Finish the “Signed on” date before this is filed. Type the year in full, like 2026.')
  })

  describe('a paper signed by two (v2.4657)', () => {
    const at = '2026-10-02T12:00:00Z'
    const open = { co_signed_at: null, co_signer_printed_name: null }

    it('fills the second frame from the second name typed: marked paper, stamped with the record', () => {
      expect(paperCoSignerFields({ coSignerName: ' Alex Owner ', signedAt: at, expectedName: null, existing: null })).toEqual({
        co_signer_name: 'Alex Owner',
        co_signer_printed_name: 'Alex Owner',
        co_signed_at: at,
        co_signer_mode: 'paper',
        co_signer_consented_at: null,
      })
    })

    it('keeps the name the draft expected, as an e-signed frame does', () => {
      expect(paperCoSignerFields({ coSignerName: 'Alexandra Owner', signedAt: at, expectedName: 'Alex Owner', existing: open })).toMatchObject({
        co_signer_name: 'Alex Owner',
        co_signer_printed_name: 'Alexandra Owner',
      })
    })

    it('writes nothing with no second name: one signer, as before', () => {
      expect(paperCoSignerFields({ coSignerName: '', signedAt: at, expectedName: 'Alex Owner', existing: open })).toBeNull()
      expect(paperCoSignerFields({ coSignerName: '   ', signedAt: at, expectedName: null, existing: null })).toBeNull()
      expect(paperCoSignerFields({ coSignerName: undefined, signedAt: at, expectedName: null, existing: null })).toBeNull()
    })

    it('never replaces a second frame already signed through the link', () => {
      const signed = { co_signed_at: '2026-10-01T15:00:00Z', co_signer_printed_name: 'Alex Owner' }
      expect(coSignatureOnFile(signed)).toEqual({ name: 'Alex Owner', signedAt: '2026-10-01T15:00:00Z' })
      expect(paperCoSignerFields({ coSignerName: 'Alex Owner', signedAt: at, expectedName: 'Alex Owner', existing: signed })).toBeNull()
    })

    it("expects the window's second signer, even one it just took off, else the row's", () => {
      const row = { co_signer_name: 'Alex Owner' }
      expect(expectedCoSignerName({ co_signer_name: 'Alexandra Owner' }, row)).toBe('Alexandra Owner')
      expect(expectedCoSignerName({ co_signer_name: null }, row)).toBeNull()
      expect(expectedCoSignerName({}, row)).toBe('Alex Owner')
      expect(expectedCoSignerName(null, row)).toBe('Alex Owner')
      expect(expectedCoSignerName(null, null)).toBeNull()
    })

    it('reads an open second frame as nothing on file', () => {
      expect(coSignatureOnFile(open)).toBeNull()
      expect(coSignatureOnFile(null)).toBeNull()
      expect(coSignatureOnFile({ co_signed_at: '2026-10-01T15:00:00Z', co_signer_printed_name: '  ' })).toBeNull()
    })
  })
  describe('the first signer signed through the link before the paper came back (v2.5101)', () => {
    const at = '2026-10-09T12:00:00Z'
    // A PDF emailed to sign by hand, still out: the recipient signed through its link, the second frame is open.
    const out = {
      status: 'sent',
      sent_channel: 'pdf_email',
      voided_at: null,
      recipient_name: 'Sam Owner',
      signer_printed_name: 'Sam Owner',
      signer_mode: 'draw',
      signer_consented_at: '2026-10-01T15:00:00Z',
      co_signer_name: 'Alex Owner',
      co_signed_at: null,
      co_signer_printed_name: null,
    } as unknown as JobContractRow

    it('reads the first frame on file only on a row out on paper, signed through the link', () => {
      expect(firstSignatureOnFile(out)).toEqual({ name: 'Sam Owner', signedAt: '2026-10-01T15:00:00Z' })
      expect(firstSignatureOnFile({ ...out, sent_channel: 'link' })).toBeNull()
      expect(firstSignatureOnFile({ ...out, sent_channel: 'handed' })).toEqual({ name: 'Sam Owner', signedAt: '2026-10-01T15:00:00Z' })
      expect(firstSignatureOnFile({ ...out, status: 'signed' })).toBeNull()
      expect(firstSignatureOnFile({ ...out, voided_at: '2026-10-02T00:00:00Z' })).toBeNull()
      expect(firstSignatureOnFile({ ...out, signer_consented_at: null, signer_printed_name: null })).toBeNull()
      expect(firstSignatureOnFile({ ...out, signer_mode: 'paper' })).toBeNull()
      expect(firstSignatureOnFile(null)).toBeNull()
    })

    it('takes the paper’s signer from the second box, else a Signed by name that is not the one on file', () => {
      const onFile = { name: 'Sam Owner' }
      expect(paperSignerAfterLink({ signerName: 'Sam Owner', coSignerName: ' Alex Owner ', onFile })).toBe('Alex Owner')
      expect(paperSignerAfterLink({ signerName: 'Alex Owner', coSignerName: '', onFile })).toBe('Alex Owner')
      expect(paperSignerAfterLink({ signerName: ' sam owner ', coSignerName: null, onFile })).toBe('')
    })

    it('leaves the first frame and its consent stamp as they are, and files the paper as the second frame', () => {
      const cols = paperFrameColumns({ signerName: 'Alex Owner', coSignerName: 'Alex Owner', signedAt: at, expectedName: 'Alex Owner', existing: out })
      expect(cols).toEqual({ co_signer_name: 'Alex Owner', co_signer_printed_name: 'Alex Owner', co_signed_at: at, co_signer_mode: 'paper', co_signer_consented_at: null })
      expect(cols).not.toHaveProperty('signer_mode')
      expect(cols).not.toHaveProperty('signer_printed_name')
      expect(cols).not.toHaveProperty('signer_consented_at')
    })

    it('files the first frame from the paper, as before, when it was not signed through the link', () => {
      const open = { ...out, signer_printed_name: null, signer_mode: null, signer_consented_at: null } as JobContractRow
      expect(paperFrameColumns({ signerName: ' Sam Owner ', coSignerName: 'Alex Owner', signedAt: at, expectedName: 'Alex Owner', existing: open })).toEqual({
        signer_printed_name: 'Sam Owner',
        signer_mode: 'paper',
        signer_consented_at: null,
        co_signer_name: 'Alex Owner',
        co_signer_printed_name: 'Alex Owner',
        co_signed_at: at,
        co_signer_mode: 'paper',
        co_signer_consented_at: null,
      })
      expect(paperFrameColumns({ signerName: 'Sam Owner', coSignerName: '', signedAt: at, expectedName: null, existing: null })).toEqual({
        signer_printed_name: 'Sam Owner',
        signer_mode: 'paper',
        signer_consented_at: null,
      })
    })
  })
})
