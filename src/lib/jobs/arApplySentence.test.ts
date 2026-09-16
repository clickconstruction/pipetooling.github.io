import { describe, expect, it } from 'vitest'
import { arApplySentence, arNextDepositId } from './arApplySentence'

const targets = new Map([
  ['inv-992', { hcpNumber: '992', jobName: 'Johnson pretest', customerName: 'Done Right Foundation', remaining: 250 }],
  ['inv-868', { hcpNumber: '868', jobName: 'Service visit', customerName: '', remaining: 2650 }],
])
const payments = new Map([['pay-1', { amount: 2918.22, hcp_number: '989', job_name: 'Take 5 Seguin' }]])

describe('arApplySentence', () => {
  it('waits for a pick', () => {
    const s = arApplySentence({ lines: [{ kind: 'billed', targetKey: '', amountStr: '' }], targetByKey: targets, paymentById: payments, depositRemaining: 1855.7, validation: null })
    expect(s).toEqual({ text: 'Remaining $1,855.70 — pick a bill, or link a recorded payment.', tone: 'waiting', total: 0 })
  })
  it('names the tip as a third way out when the strip is on screen (v2.3496)', () => {
    const s = arApplySentence({ lines: [{ kind: 'billed', targetKey: '', amountStr: '' }], targetByKey: targets, paymentById: payments, depositRemaining: 50, validation: null, tipOffered: true })
    expect(s).toEqual({ text: 'Remaining $50.00 — pick a bill, link a recorded payment, or add it as a tip.', tone: 'waiting', total: 0 })
  })
  it('one bill, settled', () => {
    const s = arApplySentence({ lines: [{ kind: 'billed', targetKey: 'inv-992', amountStr: '250.00' }], targetByKey: targets, paymentById: payments, depositRemaining: 250, validation: null })
    expect(s.text).toBe('Applies $250.00 to 992 · Done Right Foundation. The bill is settled.')
    expect(s.tone).toBe('ready')
    expect(s.total).toBe(250)
  })
  it('one bill, partly, with money left on the deposit', () => {
    const s = arApplySentence({ lines: [{ kind: 'billed', targetKey: 'inv-868', amountStr: '2,000' }], targetByKey: targets, paymentById: payments, depositRemaining: 2500, validation: null })
    expect(s.text).toBe('Applies $2,000.00 to 868 · Service visit. $650.00 stays open on it. $500.00 of the deposit stays unapplied.')
  })
  it('several lines', () => {
    const s = arApplySentence({
      lines: [
        { kind: 'billed', targetKey: 'inv-992', amountStr: '250' },
        { kind: 'billed', targetKey: 'inv-868', amountStr: '2,650' },
      ],
      targetByKey: targets,
      paymentById: payments,
      depositRemaining: 2900,
      validation: null,
    })
    expect(s.text).toBe('Applies $2,900.00 across 2 lines — $250.00 to 992 · Done Right Foundation, $2,650.00 to 868 · Service visit.')
    expect(s.total).toBe(2900)
  })
  it('a linked recorded payment says no new payment is created', () => {
    const s = arApplySentence({ lines: [{ kind: 'payment', targetKey: 'pay-1', amountStr: '2,918.22' }], targetByKey: targets, paymentById: payments, depositRemaining: 2918.22, validation: null })
    expect(s.text).toBe('Links this deposit to the $2,918.22 payment already on 989 · Take 5 Seguin — no new payment is created.')
  })
  it('a validation message wins, and a spent deposit says so', () => {
    expect(arApplySentence({ lines: [], targetByKey: targets, paymentById: payments, depositRemaining: 100, validation: 'Amount exceeds remaining on X.' })).toEqual({ text: 'Amount exceeds remaining on X.', tone: 'warn', total: 0 })
    expect(arApplySentence({ lines: [], targetByKey: targets, paymentById: payments, depositRemaining: 0, validation: null }).text).toBe('Nothing left to allocate on this deposit.')
  })
})

describe('arNextDepositId', () => {
  it('the row below, else the row above, else nothing', () => {
    expect(arNextDepositId(['a', 'b', 'c'], 'a')).toBe('b')
    expect(arNextDepositId(['a', 'b', 'c'], 'c')).toBe('b')
    expect(arNextDepositId(['a'], 'a')).toBeNull()
    expect(arNextDepositId(['a', 'b'], 'zzz')).toBeNull()
    expect(arNextDepositId(['a', 'b'], null)).toBeNull()
  })
})

describe('arApplySentence · applied means income', () => {
  it('one bill: the clause rides on the act, before the settled tail', () => {
    const s = arApplySentence({ lines: [{ kind: 'billed', targetKey: 'inv-992', amountStr: '250.00' }], targetByKey: targets, paymentById: payments, depositRemaining: 250, validation: null, booksIncome: true })
    expect(s.text).toBe('Applies $250.00 to 992 · Done Right Foundation and books it as Income. The bill is settled.')
  })
  it('several lines: one trailing sentence', () => {
    const s = arApplySentence({
      lines: [
        { kind: 'billed', targetKey: 'inv-992', amountStr: '250' },
        { kind: 'billed', targetKey: 'inv-868', amountStr: '2,650' },
      ],
      targetByKey: targets,
      paymentById: payments,
      depositRemaining: 2900,
      validation: null,
      booksIncome: true,
    })
    expect(s.text).toBe('Applies $2,900.00 across 2 lines — $250.00 to 992 · Done Right Foundation, $2,650.00 to 868 · Service visit. Books the deposit as Income.')
  })
  it('linking a recorded payment books it too — the link is the first payment on the deposit', () => {
    const s = arApplySentence({ lines: [{ kind: 'payment', targetKey: 'pay-1', amountStr: '' }], targetByKey: targets, paymentById: payments, depositRemaining: 2918.22, validation: null, booksIncome: true })
    expect(s.text).toBe('Links this deposit to the $2,918.22 payment already on 989 · Take 5 Seguin — no new payment is created. Books the deposit as Income.')
  })
  it('a hand-set label is named and left alone', () => {
    const s = arApplySentence({ lines: [{ kind: 'billed', targetKey: 'inv-992', amountStr: '250.00' }], targetByKey: targets, paymentById: payments, depositRemaining: 250, validation: null, bankLabelStays: 'Taxes and Licenses' })
    expect(s.text).toBe('Applies $250.00 to 992 · Done Right Foundation. The bill is settled. Stays Taxes and Licenses in Banking.')
  })
  it('says nothing about Banking when the switch is off or the label is already Income', () => {
    const s = arApplySentence({ lines: [{ kind: 'billed', targetKey: 'inv-992', amountStr: '250.00' }], targetByKey: targets, paymentById: payments, depositRemaining: 250, validation: null, booksIncome: false, bankLabelStays: null })
    expect(s.text).toBe('Applies $250.00 to 992 · Done Right Foundation. The bill is settled.')
  })
  it('the waiting and nothing-left texts are untouched', () => {
    const w = arApplySentence({ lines: [{ kind: 'billed', targetKey: '', amountStr: '' }], targetByKey: targets, paymentById: payments, depositRemaining: 100, validation: null, booksIncome: true })
    expect(w.text).toBe('Remaining $100.00 — pick a bill, or link a recorded payment.')
    const n = arApplySentence({ lines: [], targetByKey: targets, paymentById: payments, depositRemaining: 0, validation: null, booksIncome: true })
    expect(n.text).toBe('Nothing left to allocate on this deposit.')
  })
})
