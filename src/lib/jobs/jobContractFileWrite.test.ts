import { describe, expect, it } from 'vitest'
import { fileSignedContractDateBlocks, fileSignedContractReady, paperUploadPath } from './jobContractFileWrite'

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
})
