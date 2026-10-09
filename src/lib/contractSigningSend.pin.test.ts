/**
 * `send-contract-for-signature`'s person path, pinned byte for byte before the Board's B6-b-i adds a company branch
 * beside it (the lead's condition on call S, 2026-10-09): the function faces subs and customers every day, so what a
 * person's signing email says, who it is from and where it replies must not move. `contractSigningSend.pin.json`
 * holds the outputs main's own code gave on these inputs (origin/main abd08c17c, before the branch). Never regenerate
 * it to make this pass: a difference here is the person path changing.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildContractSigningEmail, type ContractSigningEmailInput } from '../../supabase/functions/_shared/contractSigningEmail'
import { EMAIL_FROM_FALLBACK } from '../../supabase/functions/_shared/emailFromAddress'
import { mailboxWithName } from '../../supabase/functions/_shared/mailboxWithName'

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
})
