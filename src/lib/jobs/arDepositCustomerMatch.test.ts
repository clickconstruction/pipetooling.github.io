import { describe, expect, it } from 'vitest'
import {
  matchArDepositToPayer,
  payerNameTokens,
  type ArDepositTextSlice,
  type PayerTargetSlice,
} from './arDepositCustomerMatch'

const dep = (over: Partial<ArDepositTextSlice>): ArDepositTextSlice => ({
  counterparty_name: null,
  note: null,
  external_memo: null,
  ...over,
})

const target = (key: string, customerName: string, gcName = ''): PayerTargetSlice => ({
  key,
  customerName,
  gcName,
})

describe('payerNameTokens', () => {
  it('lowercases, strips punctuation, drops legal suffixes and glue words', () => {
    expect(payerNameTokens('Welby Services, LLC')).toEqual(['welby', 'services'])
    expect(payerNameTokens('The T.F. Halden & Assoc. LP')).toEqual(['tf', 'halden', 'assoc'])
  })

  it('keeps short distinctive names and dedupes repeats', () => {
    expect(payerNameTokens('DLF')).toEqual(['dlf'])
    expect(payerNameTokens('Bob Bob Plumbing')).toEqual(['bob', 'plumbing'])
  })

  it('returns [] for blank / null / all-stop-word input', () => {
    expect(payerNameTokens(null)).toEqual([])
    expect(payerNameTokens('  ')).toEqual([])
    expect(payerNameTokens('The LLC')).toEqual([])
  })
})

describe('matchArDepositToPayer', () => {
  const targets = [
    target('t-876', 'Welby Services LLC'),
    target('t-868', 'Welby Services LLC'),
    target('t-915', 'Relwyn Health'),
    target('t-880', 'Relwyn Health'),
    target('t-883', '', 'TF Halden Associates'),
    target('t-946', 'Wildmoor Pottery'),
  ]

  it('matches an exact counterparty to every target of that customer', () => {
    const m = matchArDepositToPayer(dep({ counterparty_name: 'WELBY SERVICES LLC' }), targets)
    expect(m).toEqual({ name: 'Welby Services LLC', source: 'counterparty', targetKeys: ['t-876', 't-868'] })
  })

  it('matches when the customer name is contained in a longer counterparty', () => {
    const m = matchArDepositToPayer(dep({ counterparty_name: 'RELWYN HEALTH PROVIDERS OF TEXAS' }), targets)
    expect(m?.name).toBe('Relwyn Health')
    expect(m?.targetKeys).toEqual(['t-915', 't-880'])
  })

  it('matches GC names too (payer on GC jobs)', () => {
    const m = matchArDepositToPayer(dep({ counterparty_name: 'TF HALDEN ASSOCIATES LP' }), targets)
    expect(m?.name).toBe('TF Halden Associates')
    expect(m?.targetKeys).toEqual(['t-883'])
  })

  it('one shared generic token is not enough', () => {
    // "services" alone must not pull Welby Services.
    expect(matchArDepositToPayer(dep({ counterparty_name: 'Quality Services' }), targets)).toBeNull()
  })

  it('a tie between two different payers returns null instead of guessing', () => {
    const tied = [target('a', 'Johnson Brothers Plumbing'), target('b', 'Johnson Brothers Electric')]
    expect(matchArDepositToPayer(dep({ counterparty_name: 'Johnson Brothers' }), tied)).toBeNull()
  })

  it('falls back to the note, then the memo (check services put the customer there)', () => {
    const withMontelby = [...targets, target('t-mon', 'Montelby Homes')]
    const viaNote = matchArDepositToPayer(
      dep({ counterparty_name: 'DLF', note: 'Montelby' }),
      withMontelby,
    )
    expect(viaNote).toEqual({ name: 'Montelby Homes', source: 'note', targetKeys: ['t-mon'] })

    const viaMemo = matchArDepositToPayer(
      dep({ counterparty_name: 'DLF', external_memo: 'check 1042 montelby homes' }),
      withMontelby,
    )
    expect(viaMemo?.source).toBe('memo')
    expect(viaMemo?.name).toBe('Montelby Homes')
  })

  it('matches a bank acronym against the full customer name (DLF → Dead Level Foundation)', () => {
    const withDrf = [...targets, target('t-dlf1', 'Dead Level Foundation'), target('t-dlf2', 'Dead Level Foundation')]
    const m = matchArDepositToPayer(dep({ counterparty_name: 'DLF' }), withDrf)
    expect(m).toEqual({ name: 'Dead Level Foundation', source: 'counterparty', targetKeys: ['t-dlf1', 't-dlf2'] })
  })

  it('two customers sharing an acronym tie to null', () => {
    const tied = [target('a', 'Dead Level Foundation'), target('b', 'Dependable Lumber Fabricators')]
    expect(matchArDepositToPayer(dep({ counterparty_name: 'DLF' }), tied)).toBeNull()
  })

  it('counterparty wins over note when both would match', () => {
    const m = matchArDepositToPayer(
      dep({ counterparty_name: 'Wildmoor Pottery', note: 'Relwyn Health' }),
      targets,
    )
    expect(m?.name).toBe('Wildmoor Pottery')
    expect(m?.source).toBe('counterparty')
  })

  it('returns null with no deposit text or no named targets', () => {
    expect(matchArDepositToPayer(dep({}), targets)).toBeNull()
    expect(matchArDepositToPayer(dep({ counterparty_name: 'Welby Services' }), [target('x', '', '')])).toBeNull()
  })
})
