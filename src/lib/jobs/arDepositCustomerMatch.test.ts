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
    expect(payerNameTokens('Weiss Services, LLC')).toEqual(['weiss', 'services'])
    expect(payerNameTokens('The T.F. Harper & Assoc. LP')).toEqual(['tf', 'harper', 'assoc'])
  })

  it('keeps short distinctive names and dedupes repeats', () => {
    expect(payerNameTokens('DRF')).toEqual(['drf'])
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
    target('t-876', 'Weiss Services LLC'),
    target('t-868', 'Weiss Services LLC'),
    target('t-915', 'Reliant Health'),
    target('t-880', 'Reliant Health'),
    target('t-883', '', 'TF Harper Associates'),
    target('t-946', 'Wildflower Pottery'),
  ]

  it('matches an exact counterparty to every target of that customer', () => {
    const m = matchArDepositToPayer(dep({ counterparty_name: 'WEISS SERVICES LLC' }), targets)
    expect(m).toEqual({ name: 'Weiss Services LLC', source: 'counterparty', targetKeys: ['t-876', 't-868'] })
  })

  it('matches when the customer name is contained in a longer counterparty', () => {
    const m = matchArDepositToPayer(dep({ counterparty_name: 'RELIANT HEALTH PROVIDERS OF TEXAS' }), targets)
    expect(m?.name).toBe('Reliant Health')
    expect(m?.targetKeys).toEqual(['t-915', 't-880'])
  })

  it('matches GC names too (payer on GC jobs)', () => {
    const m = matchArDepositToPayer(dep({ counterparty_name: 'TF HARPER ASSOCIATES LP' }), targets)
    expect(m?.name).toBe('TF Harper Associates')
    expect(m?.targetKeys).toEqual(['t-883'])
  })

  it('one shared generic token is not enough', () => {
    // "services" alone must not pull Weiss Services.
    expect(matchArDepositToPayer(dep({ counterparty_name: 'Quality Services' }), targets)).toBeNull()
  })

  it('a tie between two different payers returns null instead of guessing', () => {
    const tied = [target('a', 'Johnson Brothers Plumbing'), target('b', 'Johnson Brothers Electric')]
    expect(matchArDepositToPayer(dep({ counterparty_name: 'Johnson Brothers' }), tied)).toBeNull()
  })

  it('falls back to the note, then the memo (check services put the customer there)', () => {
    const withMontolongo = [...targets, target('t-mon', 'Montolongo Homes')]
    const viaNote = matchArDepositToPayer(
      dep({ counterparty_name: 'DRF', note: 'Montolongo' }),
      withMontolongo,
    )
    expect(viaNote).toEqual({ name: 'Montolongo Homes', source: 'note', targetKeys: ['t-mon'] })

    const viaMemo = matchArDepositToPayer(
      dep({ counterparty_name: 'DRF', external_memo: 'check 1042 montolongo homes' }),
      withMontolongo,
    )
    expect(viaMemo?.source).toBe('memo')
    expect(viaMemo?.name).toBe('Montolongo Homes')
  })

  it('matches a bank acronym against the full customer name (DRF → Done Right Foundation)', () => {
    const withDrf = [...targets, target('t-drf1', 'Done Right Foundation'), target('t-drf2', 'Done Right Foundation')]
    const m = matchArDepositToPayer(dep({ counterparty_name: 'DRF' }), withDrf)
    expect(m).toEqual({ name: 'Done Right Foundation', source: 'counterparty', targetKeys: ['t-drf1', 't-drf2'] })
  })

  it('two customers sharing an acronym tie to null', () => {
    const tied = [target('a', 'Done Right Foundation'), target('b', 'Dependable Roofing Fabricators')]
    expect(matchArDepositToPayer(dep({ counterparty_name: 'DRF' }), tied)).toBeNull()
  })

  it('counterparty wins over note when both would match', () => {
    const m = matchArDepositToPayer(
      dep({ counterparty_name: 'Wildflower Pottery', note: 'Reliant Health' }),
      targets,
    )
    expect(m?.name).toBe('Wildflower Pottery')
    expect(m?.source).toBe('counterparty')
  })

  it('returns null with no deposit text or no named targets', () => {
    expect(matchArDepositToPayer(dep({}), targets)).toBeNull()
    expect(matchArDepositToPayer(dep({ counterparty_name: 'Weiss Services' }), [target('x', '', '')])).toBeNull()
  })
})
