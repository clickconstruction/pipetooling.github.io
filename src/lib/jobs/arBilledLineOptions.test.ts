import { describe, expect, it } from 'vitest'
import type { BankPaymentTarget } from '../jobsStagesBoard'
import {
  arBilledLineFooterText,
  arBilledLineKindWords,
  arBilledLineRowParts,
  arBilledLineTier,
  arBilledLineTriggerText,
  orderArBilledLineTargets,
} from './arBilledLineOptions'

function target(over: Partial<BankPaymentTarget> & { key: string }): BankPaymentTarget {
  return {
    label: '1015 · Billed line',
    searchLabel: '',
    remaining: 250,
    invoiceId: null,
    jobId: `job-${over.key}`,
    hcpNumber: '1015',
    jobName: 'Montolongo Post Test',
    jobAddress: '545 Slippery Rock, Cibolo, TX 78108',
    lineKind: 'merged_billed',
    invoiceSequenceOrder: null,
    stripeHosted: false,
    customerName: 'Arturo Montolongo',
    gcName: '',
    ...over,
  }
}

describe('arBilledLineRowParts', () => {
  it('leads with the amount, then number and name, with payers · address · kind underneath', () => {
    const p = arBilledLineRowParts(target({ key: 'a' }))
    expect(p).toEqual({
      dollars: '$250.00',
      number: '1015',
      title: 'Montolongo Post Test',
      secondary: 'Arturo Montolongo · 545 Slippery Rock, Cibolo, TX 78108 · Billed line',
      stripe: false,
    })
  })

  it('drops a payer the job name already carries and adds the GC', () => {
    const p = arBilledLineRowParts(
      target({ key: 'b', jobName: 'Giesber Master Bath', customerName: 'Giesber', gcName: 'Hargrove Homes', lineKind: 'invoice', invoiceSequenceOrder: 3, stripeHosted: true }),
    )
    expect(p.secondary).toBe('Hargrove Homes · 545 Slippery Rock, Cibolo, TX 78108 · Invoice #3')
    expect(p.stripe).toBe(true)
  })

  it('uses the line kind as the title when the job has no name, and — for a missing number', () => {
    const p = arBilledLineRowParts(target({ key: 'c', jobName: '', hcpNumber: '', jobAddress: '', customerName: '', lineKind: 'job_balance' }))
    expect(p.number).toBe('—')
    expect(p.title).toBe('Job balance')
    expect(p.secondary).toBe('')
  })
})

describe('arBilledLineKindWords', () => {
  it('names each kind without the job number', () => {
    expect(arBilledLineKindWords(target({ key: 'a', lineKind: 'invoice', invoiceSequenceOrder: 2 }))).toBe('Invoice #2')
    expect(arBilledLineKindWords(target({ key: 'a', lineKind: 'invoice', invoiceSequenceOrder: null }))).toBe('Invoice')
    expect(arBilledLineKindWords(target({ key: 'a', lineKind: 'merged_billed' }))).toBe('Billed line')
    expect(arBilledLineKindWords(target({ key: 'a', lineKind: 'job_balance' }))).toBe('Job balance')
  })
})

describe('orderArBilledLineTargets', () => {
  const list = [
    target({ key: 'other-1', remaining: 780 }),
    target({ key: 'amount-only', remaining: 1855.7 }),
    target({ key: 'payer-small', remaining: 415 }),
    target({ key: 'payer-match', remaining: 1855.7 }),
    target({ key: 'other-2', remaining: 12400 }),
    target({ key: 'payer-big', remaining: 4320 }),
  ]
  const input = {
    payerKeys: new Set(['payer-small', 'payer-match', 'payer-big']),
    amountMatchKeys: new Set(['amount-only', 'payer-match']),
  }

  it('puts the payer’s deposit match first, the payer’s other bills largest first, then amount matches, then the rest in source order', () => {
    expect(orderArBilledLineTargets(list, input).map((t) => t.key)).toEqual([
      'payer-match',
      'payer-big',
      'payer-small',
      'amount-only',
      'other-1',
      'other-2',
    ])
  })

  it('names the tiers', () => {
    expect(arBilledLineTier(list[3]!, input)).toBe('payer_match')
    expect(arBilledLineTier(list[5]!, input)).toBe('payer')
    expect(arBilledLineTier(list[1]!, input)).toBe('amount_match')
    expect(arBilledLineTier(list[0]!, input)).toBe('other')
  })

  it('keeps the source order when nothing is known about the deposit', () => {
    const none = { payerKeys: new Set<string>(), amountMatchKeys: new Set<string>() }
    expect(orderArBilledLineTargets(list, none).map((t) => t.key)).toEqual(list.map((t) => t.key))
  })
})

describe('trigger and footer words', () => {
  it('the closed trigger says amount · number · name', () => {
    expect(arBilledLineTriggerText(target({ key: 'a' }))).toBe('$250.00 · 1015 · Montolongo Post Test')
  })

  it('the footer counts the bills and sums what is unpaid', () => {
    expect(arBilledLineFooterText([])).toBe('No open bills')
    expect(arBilledLineFooterText([target({ key: 'a' })])).toBe('1 open bill · $250.00 unpaid')
    expect(arBilledLineFooterText([target({ key: 'a' }), target({ key: 'b', remaining: 1855.7 })])).toBe('2 open bills · $2,105.70 unpaid')
  })
})
