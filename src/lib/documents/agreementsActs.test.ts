/**
 * Documents → Agreements, what a line can do where it sits: which lines carry Send again and Copy the signing link,
 * which job papers open the Contract window, and the words around a new link. Every name here is made up.
 */
import { describe, expect, it } from 'vitest'
import { SEND_LABEL, agreementCanBeSent, agreementCanBeSentAgain, agreementOpensContractWindow, copySigningLinkConfirm, signingLinkByHandPrompt, signingLinkCopiedWords } from './agreementsActs'

describe('agreementCanBeSentAgain', () => {
  it('is a staff, sub or partner paper that is out and not signed', () => {
    expect(agreementCanBeSentAgain({ kind: 'person_agreement', state: 'waiting', facts: { status: 'sent' } })).toBe(true)
    expect(agreementCanBeSentAgain({ kind: 'partner_agreement', state: 'waiting', facts: { status: 'sent', signer_last_viewed_at: '2026-11-10T15:00:00Z' } })).toBe(true)
  })
  it('is an outside party’s paper that is out and not signed too', () => {
    for (const kind of ['customer_agreement', 'supply_house_agreement', 'trade_agreement', 'outside_agreement']) {
      expect(agreementCanBeSentAgain({ kind, state: 'waiting', facts: { status: 'sent', party_kind: 'none' } }), kind).toBe(true)
      expect(agreementCanBeSentAgain({ kind, state: 'signed', facts: { status: 'signed' } }), kind).toBe(false)
    }
  })
  it('is never a signed one, a replaced one, or one whose facts did not come', () => {
    expect(agreementCanBeSentAgain({ kind: 'person_agreement', state: 'signed', facts: { status: 'signed' } })).toBe(false)
    expect(agreementCanBeSentAgain({ kind: 'person_agreement', state: 'ended', facts: { status: 'signed', replaced: true } })).toBe(false)
    expect(agreementCanBeSentAgain({ kind: 'person_agreement', state: 'waiting', facts: { status: 'sent', replaced: true } })).toBe(false)
    expect(agreementCanBeSentAgain({ kind: 'person_agreement', state: 'waiting', facts: null })).toBe(false)
  })
  it('leaves every other kind to its own window: a job contract, a work order, a trade company’s paper', () => {
    expect(agreementCanBeSentAgain({ kind: 'job_contract', state: 'waiting', facts: { status: 'sent' } })).toBe(false)
    expect(agreementCanBeSentAgain({ kind: 'work_order', state: 'waiting', facts: { status: 'offered' } })).toBe(false)
    expect(agreementCanBeSentAgain({ kind: 'company_agreement', state: 'waiting', facts: { status: 'sent' } })).toBe(false)
    expect(agreementCanBeSentAgain({ kind: 'sow', state: 'waiting', facts: { status: 'sent' } })).toBe(false)
  })
})

describe('agreementCanBeSent', () => {
  it('is an outside party’s paper that was made and never sent', () => {
    for (const kind of ['customer_agreement', 'supply_house_agreement', 'trade_agreement', 'outside_agreement']) {
      expect(agreementCanBeSent({ kind, state: 'not_sent', job_id: null, facts: { status: 'unsent' } }), kind).toBe(true)
    }
    expect(SEND_LABEL).toBe('Send')
  })
  it('is never a paper that is out or signed: that one is sent again, or is done', () => {
    expect(agreementCanBeSent({ kind: 'supply_house_agreement', state: 'waiting', job_id: null, facts: { status: 'sent' } })).toBe(false)
    expect(agreementCanBeSent({ kind: 'supply_house_agreement', state: 'signed', job_id: null, facts: { status: 'signed' } })).toBe(false)
    expect(agreementCanBeSent({ kind: 'supply_house_agreement', state: 'ended', job_id: null, facts: { status: 'unsent', replaced: true } })).toBe(false)
  })
  it('needs the state and the status to agree, so a row half read sends nothing', () => {
    expect(agreementCanBeSent({ kind: 'supply_house_agreement', state: 'not_sent', job_id: null, facts: { status: 'sent' } })).toBe(false)
    expect(agreementCanBeSent({ kind: 'supply_house_agreement', state: 'waiting', job_id: null, facts: { status: 'unsent' } })).toBe(false)
    expect(agreementCanBeSent({ kind: 'supply_house_agreement', state: 'not_sent', job_id: null, facts: null })).toBe(false)
  })
  it('leaves a paper a job requires to its job, and every other kind to its own page', () => {
    expect(agreementCanBeSent({ kind: 'customer_agreement', state: 'not_sent', job_id: 'j1', facts: { status: 'unsent' } })).toBe(false)
    for (const kind of ['person_agreement', 'partner_agreement', 'company_agreement', 'job_contract', 'work_order', 'sow']) {
      expect(agreementCanBeSent({ kind, state: 'not_sent', job_id: null, facts: { status: 'unsent' } }), kind).toBe(false)
    }
  })
  it('a line carries Send or Send again, never both', () => {
    for (const [state, status] of [['not_sent', 'unsent'], ['waiting', 'sent'], ['signed', 'signed']] as const) {
      const row = { kind: 'outside_agreement', state, job_id: null, facts: { status } }
      expect(agreementCanBeSent(row) && agreementCanBeSentAgain(row)).toBe(false)
    }
  })
})

describe('agreementOpensContractWindow', () => {
  it('opens the window for a signed job paper and for one that waits', () => {
    expect(agreementOpensContractWindow({ kind: 'job_contract', state: 'signed', facts: { status: 'signed', signed_at: '2026-11-14T18:00:00Z' } })).toBe(true)
    expect(agreementOpensContractWindow({ kind: 'job_contract', state: 'waiting', facts: { status: 'sent' } })).toBe(true)
    expect(agreementOpensContractWindow({ kind: 'job_warranty', state: 'waiting', facts: { status: 'sent' } })).toBe(true)
  })
  it('keeps the preview for a voided one, which the window never opens on', () => {
    expect(agreementOpensContractWindow({ kind: 'job_contract', state: 'ended', facts: { status: 'voided', voided_at: '2026-10-15T12:00:00Z' } })).toBe(false)
  })
  it('opens a signed their paper, and keeps the preview for one that is not signed', () => {
    expect(agreementOpensContractWindow({ kind: 'their_paper', state: 'signed', facts: { status: 'signed', signed_at: '2026-11-01T12:00:00Z' } })).toBe(true)
    expect(agreementOpensContractWindow({ kind: 'their_paper', state: 'waiting', facts: { status: 'sent' } })).toBe(false)
  })
  it('is no for a paper that is not a job’s', () => {
    expect(agreementOpensContractWindow({ kind: 'person_agreement', state: 'waiting', facts: { status: 'sent' } })).toBe(false)
  })
})

describe('the words around a new link', () => {
  it('the confirm says the earlier link stops working, and its button names the act', () => {
    expect(copySigningLinkConfirm({ with_name: 'Priya Nair' })).toEqual({
      title: 'Copy the signing link',
      message: 'This makes a new signing link for Priya Nair. The link sent before stops working. Nothing is emailed.',
      confirmLabel: 'Make and copy the link',
    })
    expect(copySigningLinkConfirm({ with_name: '  ' }).message).toBe('This makes a new signing link for this person. The link sent before stops working. Nothing is emailed.')
  })
  it('the toast says who to send it to and how long it works', () => {
    expect(signingLinkCopiedWords({ with_name: 'Priya Nair' })).toBe('Signing link copied. Send it to Priya Nair. It works for 14 days.')
  })
  it('a closed clipboard shows the link to copy by hand', () => {
    expect(signingLinkByHandPrompt('https://x/contract/accept?t=1')).toEqual({
      title: 'Copy the signing link',
      message: 'The app could not reach the clipboard. Select the link below and copy it.',
      defaultValue: 'https://x/contract/accept?t=1',
      confirmLabel: 'I copied it',
    })
  })
})
