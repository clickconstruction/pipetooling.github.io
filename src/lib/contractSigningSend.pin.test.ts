/**
 * `send-contract-for-signature`'s person path, pinned byte for byte before the Board's B6-b-i adds a company branch
 * beside it (the lead's condition on call S, 2026-10-09): the function faces subs and customers every day, so what a
 * person's signing email says, who it is from and where it replies must not move. `contractSigningSend.pin.json`
 * holds the outputs main's own code gave on these inputs (origin/main abd08c17c, before the branch). Never regenerate
 * it to make this pass: a difference here is the person path changing. The refusals and the sent copy below are main's
 * handler word for word (`send-contract-for-signature/index.ts` at abd08c17c, lines 138-153, 177-204 and 306-309), now
 * in `_shared/contractSigningSend.ts`, which the handler calls.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildContractSigningEmail, type ContractSigningEmailInput } from '../../supabase/functions/_shared/contractSigningEmail'
import { EMAIL_FROM_FALLBACK } from '../../supabase/functions/_shared/emailFromAddress'
import { mailboxWithName } from '../../supabase/functions/_shared/mailboxWithName'
import { personSigningSentCopy, signingDocRefusal, signingRequestRefusal, type SigningDoc } from '../../supabase/functions/_shared/contractSigningSend'

type Pinned = { input: ContractSigningEmailInput; mail: ReturnType<typeof buildContractSigningEmail>; from: string }
const cases = JSON.parse(readFileSync(resolve(__dirname, 'contractSigningSend.pin.json'), 'utf8')) as Record<string, Pinned>

describe('send-contract-for-signature, the person path as main sends it', () => {
  it('has both pinned cases', () => {
    expect(Object.keys(cases)).toEqual(['subAgreement', 'w9Overrides'])
  })

  it.each(Object.keys(cases))('%s: the email is byte for byte main’s', (name) => {
    const c = cases[name]!
    expect(buildContractSigningEmail(c.input)).toEqual(c.mail)
  })

  it.each(Object.keys(cases))('%s: it comes from the company on the verified address', (name) => {
    const c = cases[name]!
    expect(mailboxWithName(c.mail.fromName, EMAIL_FROM_FALLBACK)).toBe(c.from)
  })

  it('refuses a request as main did: both fields needed, then an address that looks like one', () => {
    const need = { status: 400, error: 'person_contract_document_id and signer_email required' }
    expect(signingRequestRefusal({ signer_email: 'dana@example.com' })).toEqual(need)
    expect(signingRequestRefusal({ person_contract_document_id: 'd1' })).toEqual(need)
    expect(signingRequestRefusal({ person_contract_document_id: 'd1', signer_email: '   ' })).toEqual(need)
    const bad = { status: 400, error: 'Invalid email' }
    expect(signingRequestRefusal({ person_contract_document_id: 'd1', signer_email: 'not-an-email' })).toEqual(bad)
    expect(signingRequestRefusal({ person_contract_document_id: 'd1', signer_email: 'a@b' })).toEqual(bad)
    expect(signingRequestRefusal({ person_contract_document_id: 'd1', signer_email: 'a b@c.d' })).toEqual(bad)
    expect(signingRequestRefusal({ person_contract_document_id: 'd1', signer_email: ' dana@example.com ' })).toBeNull()
  })

  it('refuses a document as main did, in main’s order: signed, then nothing to sign, then its status', () => {
    const doc = (over: Partial<SigningDoc>): SigningDoc => ({ status: 'unsent', signing_body_html: null, canonical_document_url: null, url: null, form_template_id: null, ...over })
    expect(signingDocRefusal(doc({ status: 'signed' }))).toEqual({ status: 400, error: 'This document is already signed' })
    expect(signingDocRefusal(doc({}))).toEqual({ status: 400, error: 'Add contract text, a canonical document URL, or a reference link before sending for signature.' })
    expect(signingDocRefusal(doc({ signing_body_html: '   ' }))).toEqual({ status: 400, error: 'Add contract text, a canonical document URL, or a reference link before sending for signature.' })
    expect(signingDocRefusal(doc({ status: 'void', url: 'https://x' }))).toEqual({ status: 400, error: 'Invalid status for sending' })
    expect(signingDocRefusal(doc({ form_template_id: 'f1' }))).toBeNull()
    expect(signingDocRefusal(doc({ status: 'sent', canonical_document_url: 'https://x' }))).toBeNull()
  })

  it('files the sent copy as main did: under the person the name found, to the trimmed address', () => {
    expect(
      personSigningSentCopy({
        doc: { id: 'd1', person_name: 'Dana Ruiz' },
        personId: 'p1',
        sentBy: 'u1',
        signerEmail: ' dana@example.com ',
        from: 'Click Plumbing and Electrical <team@noreply.clicktooling.com>',
        subject: 'Please sign: Master Subcontract Agreement · Click Plumbing and Electrical',
        html: '<p>x</p>',
        resendEmailId: 're_1',
      }),
    ).toEqual([
      { kind: 'person_contract', recipientName: 'Dana Ruiz', personId: 'p1', source: { table: 'person_contract_documents', id: 'd1' }, sentBy: 'u1' },
      { to: ['dana@example.com'], from: 'Click Plumbing and Electrical <team@noreply.clicktooling.com>', subject: 'Please sign: Master Subcontract Agreement · Click Plumbing and Electrical', html: '<p>x</p>', resendEmailId: 're_1' },
    ])
  })
})
