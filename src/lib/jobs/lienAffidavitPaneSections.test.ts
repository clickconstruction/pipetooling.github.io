import { describe, expect, it } from 'vitest'
import { lienAffidavitPaneSections, lienAffidavitWindowWords, lienBondTail, lienOwnerAnswersFact, lienRetainagePaneSections, lienRetainageWindowWords } from './lienAffidavitPaneSections'
import type { OwnerCall } from './lienOwnerCall'

const monthLabel = (k: string) => ({ '2026-07': 'Jul 2026', '2026-08': 'Aug 2026' })[k] ?? k
const call = (over: Partial<OwnerCall> = {}): OwnerCall => ({ at: '2026-09-17T15:00:00Z', name: 'Taunya', owesGc: 'yes', owesAmount: 14_000, reserved: 'held', originalContractCompletedOn: null, note: '', ...over })

describe('the affidavit pane’s stacked heads (v2.7320)', () => {
  it('names the five sections in pane order, each with the fact a glance wants', () => {
    const heads = lienAffidavitPaneSections({
      nextWords: 'File the affidavit — 9 days.',
      gates: [{ key: 'owner', ok: true }, { key: 'legal', ok: true }, { key: 'contractor', ok: true }, { key: 'notice', ok: true }, { key: 'homestead', ok: true }],
      window: { lastMonth: '2026-08', fromCreation: false, fromBill: false },
      ownerCall: call(),
      bond: 'yes',
      months: { sworn: ['2026-07', '2026-08'], unsecured: 1 },
      claimWords: '$2,976',
      form: 'short',
      signer: 'Robert Douglas',
      monthLabel,
    })
    expect(heads.map((h) => [h.key, h.label, h.fact, h.tail])).toEqual([
      ['path', 'Where this affidavit is', 'File the affidavit — 9 days', ''],
      ['gates', 'Before it can be generated', '✓ all five clear', 'window from Aug 2026'],
      ['owner', "The owner's answers", 'Pile A · owner still owes the GC', 'payment bond on the project'],
      ['months', 'Months the affidavit claims', 'Jul 2026 + Aug 2026 · $2,976', '1 worked, not noticed'],
      ['paper', 'The paper', 'short form', 'Robert Douglas'],
    ])
  })

  it('counts the missing gates and names them short in the tail; no months head on a job that draws none', () => {
    const heads = lienAffidavitPaneSections({
      nextWords: null,
      gates: [{ key: 'owner', ok: false }, { key: 'legal', ok: false }, { key: 'contractor', ok: true }, { key: 'notice', ok: false }, { key: 'homestead', ok: true }],
      window: { lastMonth: '2026-08', fromCreation: true, fromBill: true },
      ownerCall: null,
      bond: 'unknown',
      months: null,
      claimWords: '$33,500',
      form: 'long',
      signer: '',
      monthLabel,
    })
    expect(heads.map((h) => h.key)).toEqual(['path', 'gates', 'owner', 'paper'])
    expect(heads[0]!.fact).toBe('nothing due')
    expect(heads[1]).toEqual({ key: 'gates', label: 'Before it can be generated', fact: '✗ 3 missing', tail: 'owner of record missing · county or legal description missing · no § 53.056 notice on the job' })
    expect(heads[2]).toEqual({ key: 'owner', label: "The owner's answers", fact: 'no call yet', tail: 'bond unknown' })
    expect(heads[3]).toEqual({ key: 'paper', label: 'The paper', fact: 'earlier form', tail: '' })
  })

  it('the gates head says where the notice stands when the desk knows: approved and not mailed is not *no notice on the job*', () => {
    const tail = (noticeStanding?: 'approved' | 'late') =>
      lienAffidavitPaneSections({
        nextWords: null,
        gates: [{ key: 'owner', ok: true }, { key: 'notice', ok: false }],
        noticeStanding,
        window: { lastMonth: '2026-08', fromCreation: false, fromBill: false },
        ownerCall: null,
        bond: 'unknown',
        months: null,
        claimWords: '$1,000',
        form: 'short',
        signer: '',
        monthLabel,
      })[1]!.tail
    expect(tail('approved')).toBe('§ 53.056 notice not mailed yet')
    expect(tail('late')).toBe('no § 53.056 notice on the job')
    expect(tail()).toBe('no § 53.056 notice on the job')
  })

  it('the months head reads no months with the claim, and no tail when every worked month was noticed', () => {
    const heads = lienAffidavitPaneSections({ nextWords: null, gates: [], window: { lastMonth: '2026-08', fromCreation: false, fromBill: false }, ownerCall: null, bond: 'no', months: { sworn: [], unsecured: 0 }, claimWords: '$0', form: 'short', signer: '', monthLabel })
    expect(heads.find((h) => h.key === 'months')).toEqual({ key: 'months', label: 'Months the affidavit claims', fact: 'no months · $0', tail: '' })
    expect(heads[1]!.fact).toBe('—')
  })

  it('the owner’s answers: the pile when they sort, a plain line when they do not, and the bond’s three states', () => {
    expect(lienOwnerAnswersFact(null)).toBe('no call yet')
    expect(lienOwnerAnswersFact(call({ owesGc: 'no', reserved: 'never' }))).toBe('Pile B · paid, never reserved the 10%')
    expect(lienOwnerAnswersFact(call({ owesGc: 'no', reserved: 'released' }))).toBe('Pile C · paid in full, holds nothing')
    expect(lienOwnerAnswersFact(call({ owesGc: 'unknown', reserved: 'unknown' }))).toBe('answers do not sort it yet')
    expect([lienBondTail('yes'), lienBondTail('no'), lienBondTail('unknown')]).toEqual(['payment bond on the project', 'no payment bond', 'bond unknown'])
  })

  it('the window words keep the old caption’s three sources', () => {
    expect(lienAffidavitWindowWords({ lastMonth: '2026-08', fromCreation: false, fromBill: false }, monthLabel)).toBe('§ 53.052 · window from Aug 2026, the last month worked')
    expect(lienAffidavitWindowWords({ lastMonth: '2026-08', fromCreation: true, fromBill: true }, monthLabel)).toBe('§ 53.052 · window from Aug 2026, the month of the bill, since the job has no clock hours')
    expect(lienAffidavitWindowWords({ lastMonth: '2026-08', fromCreation: true, fromBill: false }, monthLabel)).toBe('§ 53.052 · window from Aug 2026, the month the job was created — it has no clock hours')
  })
})

describe('the retainage pane’s stacked heads (v2.7320)', () => {
  it('names its three sections: the gates with the retainage and the contract’s end, the § 53.056 claim, the paper', () => {
    const heads = lienRetainagePaneSections({
      gates: [{ key: 'owner', ok: true }, { key: 'gc', ok: true }, { key: 'contract_ended', ok: true }, { key: 'retainage', ok: true }],
      endedWords: 'complete Sep 3',
      retainageWords: '$1,760',
      inClaim: true,
      pages: 2,
    })
    expect(heads.map((h) => [h.key, h.label, h.fact, h.tail])).toEqual([
      ['gates', 'Before it can go', '✓ all four clear', '$1,760 · complete Sep 3'],
      ['claim', 'The § 53.056 claim', 'inside a recorded notice', 'the owner may withhold it now'],
      ['paper', 'The paper', '2 pages · cover letter + the form', '§ 53.057(a-2)'],
    ])
  })

  it('counts the missing gates with their short words, and says the claim is not yet inside a notice', () => {
    const heads = lienRetainagePaneSections({ gates: [{ key: 'owner', ok: false }, { key: 'gc', ok: true }, { key: 'contract_ended', ok: false }, { key: 'retainage', ok: false }], endedWords: 'our contract still open', retainageWords: '$0', inClaim: false, pages: 2 })
    expect(heads[0]).toEqual({ key: 'gates', label: 'Before it can go', fact: '✗ 3 missing', tail: 'owner of record missing · our contract has not ended · no retainage recorded' })
    expect(heads[1]).toEqual({ key: 'claim', label: 'The § 53.056 claim', fact: 'not yet inside one', tail: 'the owner withholds once the affidavit is filed' })
    expect(lienRetainageWindowWords('our contract still open')).toBe('§ 53.057 · 30 days from the day our contract on the job ended · our contract still open')
  })
})
