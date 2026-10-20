import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { JOB_CONTRACT_LINK_HANDOUT_MARGIN_DAYS, jobContractLiveToken } from '../../../supabase/functions/_shared/jobContractLinkLive'
import { JOB_CONTRACT_LINK_HANDOUT_MARGIN_DAYS as LIFECYCLE_MARGIN, jobContractLinkOnRow } from './jobContractLifecycle'

/**
 * One rule for handing out a signing link without a send (punch list #104): the app's link doors (v2.5119) and
 * send-job-contract's link mode (v2.5145). The function has no Deno harness here, so its source is pinned: link mode
 * answers a live link through the kernel before it writes anything.
 */
const NOW = Date.parse('2026-10-10T04:00:00Z')
const DAY = 86_400_000
const sent = { status: 'sent', voided_at: null, public_token: 'tok-1', public_token_expires_at: '2027-01-07T00:00:00Z' }
const expiresIn = (ms: number) => ({ ...sent, public_token_expires_at: new Date(NOW + ms).toISOString() })

describe('jobContractLiveToken — a link live enough to hand out as it is', () => {
  it('a sent row with a token and more than the margin left: its token; no expiry counts as live', () => {
    expect(jobContractLiveToken(sent, NOW)).toBe('tok-1')
    expect(jobContractLiveToken({ ...sent, public_token: '  tok-1 ' }, NOW)).toBe('tok-1')
    expect(jobContractLiveToken({ ...sent, public_token_expires_at: null }, NOW)).toBe('tok-1')
    expect(jobContractLiveToken({ ...sent, status: ' sent ' }, NOW)).toBe('tok-1')
  })

  it('no live link: a draft (even one carrying a moved token), a voided or signed row, no token', () => {
    expect(jobContractLiveToken({ ...sent, status: 'draft' }, NOW)).toBeNull()
    expect(jobContractLiveToken({ ...sent, voided_at: '2026-10-09T22:00:00Z' }, NOW)).toBeNull()
    expect(jobContractLiveToken({ ...sent, status: 'signed' }, NOW)).toBeNull()
    expect(jobContractLiveToken({ ...sent, public_token: null }, NOW)).toBeNull()
    expect(jobContractLiveToken({ ...sent, public_token: '   ' }, NOW)).toBeNull()
    expect(jobContractLiveToken(null, NOW)).toBeNull()
  })

  it(`a link with ${JOB_CONTRACT_LINK_HANDOUT_MARGIN_DAYS} days or less left is not live: the send renews it`, () => {
    expect(jobContractLiveToken(expiresIn(7 * DAY + 1), NOW)).toBe('tok-1')
    expect(jobContractLiveToken(expiresIn(7 * DAY), NOW)).toBeNull()
    expect(jobContractLiveToken(expiresIn(-DAY), NOW)).toBeNull()
  })

  it('the app’s link doors read the same rule and the same margin', () => {
    expect(LIFECYCLE_MARGIN).toBe(JOB_CONTRACT_LINK_HANDOUT_MARGIN_DAYS)
    for (const row of [sent, { ...sent, status: 'draft' }, { ...sent, voided_at: 'x' }, expiresIn(7 * DAY), expiresIn(7 * DAY + 1), { ...sent, public_token: null }]) {
      const token = jobContractLiveToken(row, NOW)
      expect(jobContractLinkOnRow(row, 'https://app.example', NOW)).toBe(token ? `https://app.example/contract/sign?t=${token}` : null)
    }
  })
})

describe('send-job-contract’s link mode stamps nothing on a row already out with a live link (v2.5145)', () => {
  const src = readFileSync(resolve(__dirname, '../../../supabase/functions/send-job-contract/index.ts'), 'utf8')
  const guard = src.indexOf("const liveToken = mode === 'link' ? jobContractLiveToken(c, Date.now()) : null")
  const answer = src.indexOf('if (liveToken) return json({ ok: true, emailed: false, sign_url: signingUrl(appOrigin(body.public_origin), liveToken), reused: true })')

  it('asks the shared rule, in link mode only, and answers the row’s own URL', () => {
    expect(src).toMatch(/import \{ jobContractLiveToken \} from '\.\.\/_shared\/jobContractLinkLive\.ts'/)
    expect(guard).toBeGreaterThan(-1)
    expect(answer).toBeGreaterThan(guard)
  })

  it('answers after the refusals and before anything is written: no update, no sent event, no email', () => {
    expect(guard).toBeGreaterThan(src.indexOf("return json({ error: 'This contract is already signed.' }, 409)"))
    expect(answer).toBeLessThan(src.indexOf("from('job_contracts')\n      .update({"))
    expect(answer).toBeLessThan(src.indexOf("event_type: 'sent'"))
    expect(answer).toBeLessThan(src.indexOf('sendEmailViaResend(recipientEmail'))
  })
})
