import { describe, expect, it } from 'vitest'
import { companyAtForStep, customerAtForStep } from './boardOpen'
import { SEED_FLOWS } from './seed'
import { flat } from './state'

const step = (kind: 'trade' | 'customer', id: string) => flat(SEED_FLOWS[kind]).find((s) => s.id === id) ?? null

describe('where a board press opens a trade partner', () => {
  it('opens Documents at the step’s first paper with a row there, with its send for a nudge', () => {
    expect(companyAtForStep(step('trade', 'papers'))).toEqual({ tab: 'documents', doc: 'w9' })
    expect(companyAtForStep(step('trade', 'msa'), true)).toEqual({ tab: 'documents', doc: 'msa', send: true })
  })

  it('opens Activity for a step with no paper on the company’s Documents', () => {
    expect(companyAtForStep(step('trade', 'compare'))).toEqual({ tab: 'activity' })
    expect(companyAtForStep(step('trade', 'ask'), true)).toEqual({ tab: 'activity' })
    expect(companyAtForStep(null)).toEqual({ tab: 'activity' })
  })
})

describe('where a board press opens a customer', () => {
  it('opens Documents at the job’s contract on the contract step, and Activity otherwise', () => {
    expect(customerAtForStep(step('customer', 'contract'), 'helotes')).toEqual({ tab: 'documents', doc: 'contract-helotes' })
    expect(customerAtForStep(step('customer', 'contract'), 'helotes', true)).toEqual({ tab: 'documents', doc: 'contract-helotes', send: true })
    expect(customerAtForStep(step('customer', 'contract'), null)).toEqual({ tab: 'activity' })
    expect(customerAtForStep(step('customer', 'start'), 'helotes')).toEqual({ tab: 'activity' })
  })
})
