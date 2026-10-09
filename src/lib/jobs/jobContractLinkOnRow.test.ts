import { describe, expect, it } from 'vitest'
import { JOB_CONTRACT_LINK_HANDOUT_MARGIN_DAYS, jobContractLinkOnRow } from './jobContractLifecycle'

/** The link a sent agreement already carries, handed out without a send (punch list #104, v2.5119). */
const NOW = Date.parse('2026-10-09T23:00:00Z')
const DAY = 86_400_000
const origin = 'https://app.example/'
const sent = { status: 'sent', voided_at: null, public_token: 'tok 1', public_token_expires_at: '2027-01-07T00:00:00Z' }
const expiresIn = (ms: number) => ({ ...sent, public_token_expires_at: new Date(NOW + ms).toISOString() })

describe('jobContractLinkOnRow — which link the link doors hand out', () => {
  it('a sent row with a live token: its own link, built as the signed rail builds it', () => {
    expect(jobContractLinkOnRow(sent, origin, NOW)).toBe('https://app.example/contract/sign?t=tok%201')
    // No expiry reads as live, as sign-job-contract reads it.
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

  it(`a link with ${JOB_CONTRACT_LINK_HANDOUT_MARGIN_DAYS} days or less left is not handed out, so the send renews it`, () => {
    expect(JOB_CONTRACT_LINK_HANDOUT_MARGIN_DAYS).toBe(7)
    expect(jobContractLinkOnRow(expiresIn(7 * DAY + 1), origin, NOW)).toBe('https://app.example/contract/sign?t=tok%201')
    expect(jobContractLinkOnRow(expiresIn(7 * DAY), origin, NOW)).toBeNull()
    expect(jobContractLinkOnRow(expiresIn(2 * DAY), origin, NOW)).toBeNull()
    expect(jobContractLinkOnRow(expiresIn(0), origin, NOW)).toBeNull()
    expect(jobContractLinkOnRow(expiresIn(-DAY), origin, NOW)).toBeNull()
  })
})
