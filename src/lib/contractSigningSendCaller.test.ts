/**
 * Who may send a paper for signature (`send-contract-for-signature`, the person path). The function writes with the
 * service role, so it says who its caller may be itself: the four roles the papers' own write policy takes, never a
 * training account and never a digital twin. The kernel is `signingCallerRefusal`; the second block holds the handler
 * to asking it before it reads the paper.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SIGNING_SEND_ROLES, signingCallerRefusal } from '../../supabase/functions/_shared/contractSigningSend'

const OFFICE_ONLY = { status: 403, error: 'Only the office sends a paper for signature.' }
const NO_TRAINING = { status: 403, error: 'A training account cannot send a paper for signature.' }

describe('signingCallerRefusal', () => {
  it('takes the four roles that write a paper', () => {
    expect([...SIGNING_SEND_ROLES]).toEqual(['dev', 'master_technician', 'assistant', 'controller'])
    for (const role of SIGNING_SEND_ROLES) expect(signingCallerRefusal({ role })).toBeNull()
  })

  it.each(['estimator', 'primary', 'superintendent', 'helpers', 'subcontractor', '', 'DEV'])('refuses the role %j', (role) => {
    expect(signingCallerRefusal({ role })).toEqual(OFFICE_ONLY)
  })

  it('refuses a caller with no account row and one with no role', () => {
    expect(signingCallerRefusal(null)).toEqual(OFFICE_ONLY)
    expect(signingCallerRefusal(undefined)).toEqual(OFFICE_ONLY)
    expect(signingCallerRefusal({})).toEqual(OFFICE_ONLY)
    expect(signingCallerRefusal({ role: null })).toEqual(OFFICE_ONLY)
  })

  it('refuses a training account and a digital twin whatever their role', () => {
    expect(signingCallerRefusal({ role: 'assistant', read_only: true })).toEqual(NO_TRAINING)
    expect(signingCallerRefusal({ role: 'dev', is_digital_twin: true })).toEqual(NO_TRAINING)
    expect(signingCallerRefusal({ role: 'assistant', read_only: false, is_digital_twin: false })).toBeNull()
  })

  it('says the role first, so a twin who is an estimator reads the office line', () => {
    expect(signingCallerRefusal({ role: 'estimator', is_digital_twin: true })).toEqual(OFFICE_ONLY)
  })
})

describe('send-contract-for-signature, the handler', () => {
  const source = readFileSync(resolve(__dirname, '../../supabase/functions/send-contract-for-signature/index.ts'), 'utf8')
  // The person path is everything after the company branch hands off.
  const personPath = source.slice(source.indexOf('if (body.trade_email !== undefined)'))

  it('asks who the caller is before it reads the paper', () => {
    const gate = personPath.indexOf('signingCallerRefusal(')
    const read = personPath.indexOf(".from('person_contract_documents')")
    expect(gate).toBeGreaterThan(-1)
    expect(read).toBeGreaterThan(-1)
    expect(gate).toBeLessThan(read)
  })

  it('reads the caller with the service role, by the id the token named', () => {
    expect(personPath).toMatch(/admin\s*\.from\('users'\)\s*\.select\('role, read_only, is_digital_twin'\)\s*\.eq\('id', user\.id\)/)
  })

  it('refuses an archived caller before the gate, and still once', () => {
    const archived = personPath.indexOf('refuseArchivedCaller(')
    expect(archived).toBeGreaterThan(-1)
    expect(archived).toBeLessThan(personPath.indexOf('signingCallerRefusal('))
    expect(personPath.split('refuseArchivedCaller(').length - 1).toBe(1)
  })
})
