/** Our contract's file (the Board's B6-d-ii): what a send takes, and the fingerprint a signature binds to. */
import { describe, expect, it } from 'vitest'
import { contractFileProblem, sha256Hex } from './ownerContractIo'

describe('the contract file', () => {
  it('takes a PDF up to 15 MB, and says why it takes nothing else', () => {
    expect(contractFileProblem({ name: 'Contract.pdf', type: 'application/pdf', size: 1000 })).toBeNull()
    expect(contractFileProblem({ name: 'Contract.PDF', type: '', size: 1000 })).toBeNull()
    expect(contractFileProblem({ name: 'Contract.docx', type: 'application/msword', size: 1000 })).toBe('Pick a PDF of the contract.')
    expect(contractFileProblem({ name: 'Contract.pdf', type: 'application/pdf', size: 0 })).toBe('That file is empty. Pick the contract again.')
    expect(contractFileProblem({ name: 'Contract.pdf', type: 'application/pdf', size: 16 * 1024 * 1024 })).toBe('That file is over 15 MB. Save a smaller PDF and pick it again.')
  })

  it('is fingerprinted as the SHA-256 of its bytes, in lowercase hex', async () => {
    expect(await sha256Hex(new TextEncoder().encode('abc').buffer)).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})
