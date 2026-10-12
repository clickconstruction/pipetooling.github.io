import { describe, expect, it } from 'vitest'
import { moneyLines, openChanges, paidPct, signedChanges, statementRows } from './moneyLines'
import { ELENA_CHANGES, ELENA_MONEY, PRIYA_CHANGES } from './portalTestPeople'

describe("a customer's six lines", () => {
  it("adds Elena's two signed changes to her contract and reads what is left to pay", () => {
    const lines = moneyLines(ELENA_MONEY)
    expect(lines).toEqual({ contract: 1284000, changesCount: 2, changes: 18450, revised: 1302450, billed: 486200, paid: 445000, balance: 857450 })
    expect(paidPct(lines)).toBe(34)
  })

  it('counts only the signed changes in the sum, never the open one', () => {
    const lines = moneyLines({ contract: 412000, changes: PRIYA_CHANGES, billed: 0, paid: 0 })
    expect(lines).toMatchObject({ changesCount: 1, changes: 6300, revised: 418300, balance: 418300 })
    expect(paidPct(lines)).toBe(0)
    expect(paidPct(moneyLines({ contract: 0, changes: [], billed: 0, paid: 0 }))).toBe(0)
  })

  it('takes a credit off the sum', () => {
    const credit = { id: 'c', number: 3, description: { en: 'drop the canopy', es: 'quitar el toldo' }, price: -500, days: 0, state: 'signed' as const }
    expect(moneyLines({ contract: 1000, changes: [credit], billed: 0, paid: 0 })).toMatchObject({ changes: -500, revised: 500 })
    expect(statementRows('en', moneyLines({ contract: 1000, changes: [credit], billed: 0, paid: 0 }))[1]).toEqual({ label: 'Changes signed', amount: '−$500', count: 1 })
  })

  it('holds the demo money to its own pay applications: billed is every one sent, paid every one paid', () => {
    expect(ELENA_MONEY.apps.reduce((a, x) => a + x.amount, 0)).toBe(ELENA_MONEY.billed)
    expect(ELENA_MONEY.apps.filter((x) => x.state === 'paid').reduce((a, x) => a + x.amount, 0)).toBe(ELENA_MONEY.paid)
  })

  it('writes the statement in either language', () => {
    expect(statementRows('en', moneyLines(ELENA_MONEY))).toEqual([
      { label: 'Contract', amount: '$1,284,000' },
      { label: 'Changes signed', amount: '+$18,450', count: 2 },
      { label: 'Revised sum', amount: '$1,302,450', sum: true },
      { label: 'Billed so far', amount: '$486,200' },
      { label: 'Paid so far', amount: '$445,000' },
      { label: 'Balance to finish', amount: '$857,450', sum: true },
    ])
    expect(statementRows('es', moneyLines(ELENA_MONEY)).map((r) => r.label)).toEqual(['Contrato', 'Cambios firmados', 'Suma revisada', 'Facturado', 'Pagado', 'Saldo por terminar'])
  })

  it('sorts the open and the signed change orders by number', () => {
    const shuffled = [...ELENA_CHANGES].reverse()
    expect(signedChanges(shuffled).map((c) => c.number)).toEqual([1, 2])
    expect(openChanges(PRIYA_CHANGES).map((c) => c.number)).toEqual([2])
  })
})
