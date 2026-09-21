import { describe, expect, it } from 'vitest'
import { contractLinkFieldState } from './jobContractLinkField'

const link = 'https://drive.google.com/file/d/abc123/view'

describe('jobContractLinkField', () => {
  it('is offered only while nothing is signed or out for signature', () => {
    expect(contractLinkFieldState({ coverageKind: 'none', link: '', signerName: 'TF Harper' }).show).toBe(true)
    expect(contractLinkFieldState({ coverageKind: 'draft', link: '', signerName: 'TF Harper' }).show).toBe(true)
    expect(contractLinkFieldState({ coverageKind: 'sent', link, signerName: 'TF Harper' })).toMatchObject({ show: false, canFile: false })
    expect(contractLinkFieldState({ coverageKind: 'signed', link, signerName: 'TF Harper' })).toMatchObject({ show: false, canFile: false })
  })

  it('files a real link signed by the job’s customer, and says why it cannot otherwise', () => {
    expect(contractLinkFieldState({ coverageKind: 'none', link: `  ${link} `, signerName: 'TF Harper' })).toEqual({ show: true, canFile: true, invalid: false, hint: null })
    const typed = contractLinkFieldState({ coverageKind: 'none', link: 'mission hills contract', signerName: 'TF Harper' })
    expect(typed).toMatchObject({ canFile: false, invalid: true })
    expect(typed.hint).toContain('Share → Copy link')
    const noCustomer = contractLinkFieldState({ coverageKind: 'none', link, signerName: '  ' })
    expect(noCustomer).toMatchObject({ canFile: false, invalid: false })
    expect(noCustomer.hint).toContain('Put a customer on the job first')
    expect(contractLinkFieldState({ coverageKind: 'none', link: '', signerName: '' })).toMatchObject({ canFile: false, invalid: false, hint: null })
  })
})
