import { describe, expect, it } from 'vitest'
import { firmStepDecision, LEGAL_FIRM_STEP_WORDS, LEGAL_FIRM_STEPS, LEGAL_PORTAL_STAGES, legalMatterOnPortal } from '../../../supabase/functions/_shared/legalStages'
import { legalRowChip, legalStageLabel, matterAwaitsClose, matterIsClosed, matterIsWithFirm, stageIsWithFirm, type LegalMatterRow } from './legalMatters'
import { legalEntryKindWords, stepProposalOf } from './legalAsks'
import type { LegalEntryRow } from './legalMatters'
import { buildLegalDigestEmail, buildLegalNowEmail } from '../legalEmails'

const matter = (over: Partial<LegalMatterRow>): LegalMatterRow => ({
  id: 'm1', payer_key: 'c:x', customer_id: 'x', payer_name: 'Lenox Builders', firm_id: 'f1', stage: 'judgment', ready_marked_by: null, ready_marked_at: null, released_at: null,
  handling_name: '', note_to_firm: '', review_requested_by: null, review_requested_at: null, review_request_note: '', held_overrides: {}, fees_to_statement: false, closed_at: null, closed_reason: '', updated_at: '', ...over,
})

describe('a matter on the portal (#85 item 16)', () => {
  it('stays on the portal at a firm end until the office closes it', () => {
    expect(legalMatterOnPortal({ stage: 'settled', closed_at: null })).toBe(true)
    expect(legalMatterOnPortal({ stage: 'settled', closed_at: '2026-10-06T00:00:00Z' })).toBe(false)
    expect(legalMatterOnPortal({ stage: 'payment_plan' })).toBe(true)
    expect(legalMatterOnPortal({ stage: 'review' })).toBe(false)
    expect(legalMatterOnPortal({ stage: 'written_down' })).toBe(false)
    expect(LEGAL_PORTAL_STAGES).toEqual(['referred', 'demand', 'suit', 'judgment', 'post_judgment', 'payment_plan', 'settled', 'uncollectible', 'dismissed'])
  })
  it('the office kernel reads the same rule: with the firm, waiting to close, closed', () => {
    const open = matter({ stage: 'settled' })
    expect([matterIsWithFirm(open), matterAwaitsClose(open), matterIsClosed(open)]).toEqual([true, true, false])
    const shut = matter({ stage: 'settled', closed_at: '2026-10-06T00:00:00Z' })
    expect([matterIsWithFirm(shut), matterAwaitsClose(shut), matterIsClosed(shut)]).toEqual([false, false, true])
    expect(matterIsClosed(matter({ stage: 'written_down', closed_at: null }))).toBe(true)
    expect(stageIsWithFirm('post_judgment')).toBe(true)
    expect(stageIsWithFirm('settled')).toBe(false)
  })
  it('labels and chips every stage, an open end asking to be closed', () => {
    expect(['post_judgment', 'payment_plan', 'uncollectible', 'dismissed'].map(legalStageLabel)).toEqual(['With the firm · after judgment', 'With the firm · payment plan', 'Uncollectible', 'Dismissed'])
    expect(legalRowChip(matter({ stage: 'payment_plan' }))).toEqual({ label: '⚖ payment plan', tone: 'legal' })
    expect(legalRowChip(matter({ stage: 'settled' }))).toEqual({ label: '⚖ settled · close it', tone: 'legal' })
    expect(legalRowChip(matter({ stage: 'settled', closed_at: '2026-10-06T00:00:00Z' }))).toEqual({ label: '⚖ Settled', tone: 'neutral' })
    expect(LEGAL_FIRM_STEPS.every((s) => LEGAL_FIRM_STEP_WORDS[s].length > 0)).toBe(true)
  })
})

describe('firmStepDecision (#85 item 16)', () => {
  it('moves forward, keeps the same stage, and asks before any move back', () => {
    expect(firmStepDecision('referred', 'demand')).toBe('move')
    expect(firmStepDecision('demand', 'judgment')).toBe('move')
    expect(firmStepDecision('judgment', 'judgment')).toBe('same')
    expect(firmStepDecision('judgment', 'demand')).toBe('ask')
    expect(firmStepDecision('post_judgment', 'suit')).toBe('ask')
  })
  it('a payment plan sits beside the ladder; an end is reached from anywhere; after an end, the office decides', () => {
    expect(firmStepDecision('judgment', 'payment_plan')).toBe('move')
    expect(firmStepDecision('payment_plan', 'demand')).toBe('move')
    expect(firmStepDecision('demand', 'settled')).toBe('move')
    expect(firmStepDecision('settled', 'suit')).toBe('ask')
    expect(firmStepDecision('settled', 'dismissed')).toBe('ask')
  })
  it('the office reads a held step as a proposal', () => {
    const e = { kind: 'step', meta: { stage: 'demand', proposed: true, from: 'judgment' } } as Pick<LegalEntryRow, 'kind' | 'meta' | 'via_portal'>
    expect(stepProposalOf(e)).toEqual({ stage: 'demand', from: 'judgment' })
    expect(stepProposalOf({ kind: 'step', meta: { stage: 'demand' } })).toBeNull()
    expect(legalEntryKindWords({ ...e, via_portal: true })).toBe('step · asks to move the stage back')
  })
})

describe('the pull-back email carries the reason (#85 item 16)', () => {
  it('says why, and what stays readable', () => {
    const mail = buildLegalNowEmail({ companyName: 'Click', firmName: 'Example Law', trigger: 'pulled', payer: 'Ridgeway Dental', reason: 'Paid in full on 10-03', portalUrl: 'https://x', unsubscribeUrl: 'https://y' })
    expect(mail.subject).toBe('Referral withdrawn: Ridgeway Dental')  // the firm's words (v2.4625)
    expect(mail.html).toContain('Why: <i>Paid in full on 10-03</i>')
    expect(mail.html).toContain('stay readable on the portal')
    const digest = buildLegalDigestEmail({ companyName: 'Click', recipientName: 'Dana', matters: [], events: [{ createdAt: '2026-10-04T15:00:00Z', trigger: 'pulled', payer: 'Ridgeway Dental', reason: 'Paid in full' }], portalUrl: 'https://x', unsubscribeUrl: 'https://y' })
    expect(digest.html).toContain('Ridgeway Dental</b> — Paid in full')
  })
})
