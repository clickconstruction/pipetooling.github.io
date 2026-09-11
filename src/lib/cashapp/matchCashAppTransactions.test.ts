import { describe, expect, it } from 'vitest'
import { matchCashAppTransactions, summarizeCashAppMatches, type CashAppTxForMatch, type RecordedPaymentForMatch } from './matchCashAppTransactions'

const tx = (id: string, date: string, amt: number, note: string, person: string | null, alt?: string[]): CashAppTxForMatch => ({
  id,
  occurredDate: date,
  amountSent: amt,
  note,
  personName: person,
  altPersonNames: alt,
})
const pay = (id: string, person: string, amt: number, paidAt: string, memo: string | null = null): RecordedPaymentForMatch => ({ id, personName: person, amount: amt, paidAt, memo })

describe('matchCashAppTransactions', () => {
  it('rule a: an id in the memo wins regardless of amount or date, and consumes the payment', () => {
    const { results } = matchCashAppTransactions(
      [tx('#D-19JXG5RJ', '2026-03-28', 250, 'For week', 'Chelsea'), tx('#D-OTHER', '2026-03-28', 250, 'For week', 'Chelsea')],
      [pay('p1', 'Chelsea', 251, '2026-04-20', 'CashApp "For week" #D-19JXG5RJ'), pay('p2', 'Chelsea', 250, '2026-03-28')],
    )
    expect(results.find((r) => r.txId === '#D-19JXG5RJ')).toMatchObject({ outcome: 'matched', rule: 'id', paymentIds: ['p1'] })
    expect(results.find((r) => r.txId === '#D-OTHER')).toMatchObject({ outcome: 'matched', rule: 'amount', paymentIds: ['p2'] })
  })

  it('rule b: same person + amount inside the window, nearest date first; outside the window is unmatched', () => {
    const { results } = matchCashAppTransactions(
      [tx('t1', '2026-08-22', 500, 'Week', 'Darren'), tx('t2', '2026-06-01', 300, 'Week', 'Darren')],
      [pay('far', 'Darren', 500, '2026-08-29'), pay('near', 'Darren', 500, '2026-08-23'), pay('late', 'Darren', 300, '2026-06-20')],
    )
    expect(results[0]).toMatchObject({ txId: 't1', outcome: 'matched', rule: 'amount', paymentIds: ['near'] })
    expect(results[1]).toMatchObject({ txId: 't2', outcome: 'unmatched', personName: 'Darren', noteKind: 'pay' })
  })

  it('rule c: one send equal to the sum of two or three recorded splits', () => {
    const { results, unmatchedPaymentIds } = matchCashAppTransactions(
      [tx('t1', '2026-05-27', 1073.94, 'Week', 'Bryan')],
      [pay('a', 'Bryan', 106.64, '2026-05-27'), pay('b', 'Bryan', 509.83, '2026-05-27'), pay('c', 'Bryan', 457.47, '2026-05-27'), pay('d', 'Bryan', 999, '2026-05-27')],
    )
    expect(results[0]).toMatchObject({ outcome: 'matched', rule: 'split' })
    expect([...(results[0] as { paymentIds: string[] }).paymentIds].sort()).toEqual(['a', 'b', 'c'])
    expect(unmatchedPaymentIds).toEqual(['d'])
  })

  it('a proxy account tries the alternate person after the primary', () => {
    const { results } = matchCashAppTransactions([tx('t1', '2026-06-22', 537.99, 'week', 'Taunya', ['Tristen'])], [pay('p', 'Tristen', 537.99, '2026-06-22')])
    expect(results[0]).toMatchObject({ outcome: 'matched', rule: 'amount', personName: 'Tristen' })
  })

  it('rule d: before that person\'s first report is before_records; an unknown person is unmatched with its note kind', () => {
    const { results } = matchCashAppTransactions(
      [tx('old', '2026-01-10', 800, 'Week', 'Paige'), tx('adv', '2026-09-10', 500, 'Advance', 'Malachi'), tx('who', '2026-09-01', 300, 'Gas', null)],
      [],
      { firstReportStartByPerson: { Paige: '2026-03-01' } },
    )
    expect(results[0]).toMatchObject({ outcome: 'before_records', personName: 'Paige', firstReportStart: '2026-03-01' })
    expect(results[1]).toMatchObject({ outcome: 'unmatched', personName: 'Malachi', noteKind: 'advance' })
    expect(results[2]).toMatchObject({ outcome: 'unmatched', personName: null, noteKind: 'expense' })
  })

  it('a company-wide floor applies when a person has no reports, and to unknown names', () => {
    const { results } = matchCashAppTransactions([tx('t', '2026-02-01', 100, 'Week', 'Kyle'), tx('u', '2021-12-05', 440, 'ice', null)], [], { recordsBeginYmd: '2026-03-01' })
    expect(results[0]).toMatchObject({ outcome: 'before_records', firstReportStart: '2026-03-01' })
    expect(results[1]).toMatchObject({ outcome: 'before_records', personName: null, firstReportStart: '2026-03-01' })
  })

  it('summarizes a batch', () => {
    const { results } = matchCashAppTransactions(
      [tx('a', '2026-08-22', 500, 'Week', 'Darren'), tx('b', '2026-09-10', 500, 'Advance', 'Malachi'), tx('c', '2026-01-01', 10, 'Week', 'Paige'), tx('d', '2026-09-01', 5, 'gas', null)],
      [pay('p', 'Darren', 500, '2026-08-22')],
      { firstReportStartByPerson: { Paige: '2026-03-01' } },
    )
    expect(summarizeCashAppMatches(results)).toEqual({ matched: 1, byRule: { id: 0, amount: 1, split: 0 }, beforeRecords: 1, unmatched: 2, unmatchedByKind: { pay: 0, advance: 1, expense: 1 }, unknownPerson: 1 })
  })
})
