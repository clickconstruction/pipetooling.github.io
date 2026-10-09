import { describe, expect, it } from 'vitest'
import { jobContractLinkOnRow } from './jobContractLifecycle'

/** The link a sent agreement already carries, handed out without a send (punch list #104, v2.5119). */
const NOW = Date.parse('2026-10-09T23:00:00Z')
const origin = 'https://app.example/'
const sent = { status: 'sent', voided_at: null, public_token: 'tok 1', public_token_expires_at: '2027-01-07T00:00:00Z' }

describe('jobContractLinkOnRow — which link Copy link hands out', () => {
  it('a sent row with a live token: its own link, built as the signed rail builds it', () => {
    expect(jobContractLinkOnRow(sent, origin, NOW)).toBe('https://app.example/contract/sign?t=tok%201')
    expect(jobContractLinkOnRow({ ...sent, public_token_expires_at: null }, origin, NOW)).toBe('https://app.example/contract/sign?t=tok%201')
  })

  it('no link of its own: a draft (even one carrying the token Void & redo moved), a voided or signed row, no token', () => {
    expect(jobContractLinkOnRow({ ...sent, status: 'draft' }, origin, NOW)).toBeNull()
    expect(jobContractLinkOnRow({ ...sent, voided_at: '2026-10-09T22:00:00Z' }, origin, NOW)).toBeNull()
    expect(jobContractLinkOnRow({ ...sent, status: 'signed' }, origin, NOW)).toBeNull()
    expect(jobContractLinkOnRow({ ...sent, public_token: null }, origin, NOW)).toBeNull()
    expect(jobContractLinkOnRow({ ...sent, public_token: '  ' }, origin, NOW)).toBeNull()
    expect(jobContractLinkOnRow(null, origin, NOW)).toBeNull()
  })

  it('a lapsed link: none, so a send renews it', () => {
    expect(jobContractLinkOnRow({ ...sent, public_token_expires_at: '2026-10-09T22:59:59Z' }, origin, NOW)).toBeNull()
    expect(jobContractLinkOnRow({ ...sent, public_token_expires_at: '2026-10-09T23:00:00Z' }, origin, NOW)).toBeNull()
  })
})
