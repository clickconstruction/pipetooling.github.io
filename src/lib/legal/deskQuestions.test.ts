import { describe, expect, it } from 'vitest'
import { canWeSue, deskQuestions, howMuch, whatCouldGoWrong, whatsLeftForUs } from './deskQuestions'
import type { LegalPacket } from './legalPacket'
import { plainWordsFailures } from '../plainWords'

type Theory = LegalPacket['theory']
const job = (label: string, swornMissing: string[] = []) => ({ jobId: `job-${label}`, label, swornMissing }) as unknown as LegalPacket['account']['jobs'][number]
const packet = (over: { theory?: Partial<Theory>; jobs?: LegalPacket['account']['jobs']; oldestDays?: number | null; worth?: Partial<LegalPacket['worth']> } = {}) =>
  ({
    theory: { key: 'sworn', label: 'Sworn account', basis: '', ...over.theory },
    account: { jobs: over.jobs ?? [job('707'), job('717', ['a signed agreement']), job('718')], totals: { billed: 0, paid: 0, writtenDown: 0, balance: 15781.82, oldestDays: over.oldestDays === undefined ? 192 : over.oldestDays } },
    worth: { balance: 15781.82, retainageHeld: 0, retainageOnBills: 0, retainageAdded: 0, claim: 15781.82, contingencyPct: 0.33, fee: 5208, filingCost: 350, net: 10223.82, flags: [], verdict: 'worth it', openBills: [], retainageOnBillsByJob: {}, retainageHeldByJob: {}, claimLines: [], claimTyped: 0, ...over.worth },
  }) as unknown as Pick<LegalPacket, 'theory' | 'account' | 'worth'>

describe('Can we sue?', () => {
  it('answers yes, with the jobs that fall short named', () => {
    const q = canWeSue(packet())
    expect(q.answer).toBe('Yes, on 2 of 3 jobs')
    expect(q.why).toBe('As a sworn account. Job 717 still needs a signed agreement or field proof.')
  })
  it('answers yes alone when every job holds, and on a signed agreement', () => {
    expect(canWeSue(packet({ jobs: [job('707')] })).answer).toBe('Yes')
    expect(canWeSue(packet({ theory: { key: 'contract' } })).why).toContain('They signed an agreement')
  })
  it('answers only on the lien, and not yet', () => {
    expect(canWeSue(packet({ theory: { key: 'lien' } })).answer).toBe('Only on the lien')
    expect(canWeSue(packet({ theory: { key: 'none' } })).answer).toBe('Not yet')
  })
  it('carries the attorney’s read as a chip, and whose line it is (punch list #218 PR 2)', () => {
    const read = { tries: 'hard' as const, why: 'The GC disputes the change order.', costToTry: 2800, months: 9, entryId: 'e', ymd: '2026-10-22', by: 'firm' as const, byName: 'D. Reyes' }
    const q = canWeSue(packet({ theory: { key: 'contract' } }), read)
    expect(q.chip).toEqual({ text: 'hard to try', tone: 'warn' })
    expect(q.why).toBe("They signed an agreement. That is the strongest case we can bring. The firm's read, Oct 22: The GC disputes the change order.")
    expect(plainWordsFailures(q.why)).toEqual([])
    expect(canWeSue(packet(), { ...read, tries: 'easy', by: 'office', why: '' }).chip).toEqual({ text: 'easy to try', tone: 'ok' })
    expect(canWeSue(packet(), { ...read, by: 'office', why: '' }).why).toContain('Our read, Oct 22.')
    expect(deskQuestions(packet(), read)[0]!.chip?.text).toBe('hard to try')
    expect(canWeSue(packet()).chip).toBeUndefined()
  })
})

describe('How much? and What\'s left for us?', () => {
  it('says the balance, the jobs and the oldest bill', () => {
    expect(howMuch(packet())).toMatchObject({ answer: '$15,781.82', why: 'Owed on 3 jobs. The oldest bill is 192 days old.' })
    expect(howMuch(packet({ jobs: [job('707')], oldestDays: null })).why).toBe('Owed on 1 job.')
  })
  it('leads with the claim when the GC holds retainage, the open bills inside it (v2.5849, punch list #171)', () => {
    const q = howMuch(packet({ jobs: [job('891')], oldestDays: 108, worth: { balance: 2028.04, retainageHeld: 1678.04, retainageAdded: 1678.04, claim: 3706.08 } }))
    expect(q).toMatchObject({ answer: '$3,706.08', why: 'Open bills $2,028.04 inside it, plus retainage $1,678.04 that no bill asks for yet. The oldest bill is 108 days old.', chip: { text: 'the claim', tone: 'ok' } })
    expect(whatsLeftForUs(packet({ worth: { balance: 2028.04, retainageHeld: 1678.04, claim: 3706.08, fee: 1223.01, net: 2133.07 } })).why).toBe('The firm takes 33%, or $1,223.01 of the claim, and filing costs $350.00.')
    expect(plainWordsFailures(q.why)).toEqual([])
  })
  it('adds only the retainage no bill asks for, and says when the rest is already on a bill or all of it is (v2.6103, punch list #213)', () => {
    const part = howMuch(packet({ jobs: [job('891')], oldestDays: null, worth: { balance: 2028.04, retainageHeld: 1678.04, retainageOnBills: 1000, retainageAdded: 678.04, claim: 2706.08 } }))
    expect(part).toMatchObject({ answer: '$2,706.08', why: 'Open bills $2,028.04 inside it, plus retainage $678.04 that no bill asks for yet. Another $1,000.00 of the retainage held is already on a bill.', chip: { text: 'the claim', tone: 'ok' } })
    expect(plainWordsFailures(part.why)).toEqual([])
    // v2.6680 (punch list #171 step 2): the typed lines are the third part, with the retainage or alone.
    const line = (id: string, amount: number) => ({ id, kind: 'materials' as const, title: 'Materials left on site', amount, basis: '', documentId: null, documentTitle: '' })
    const both = howMuch(packet({ jobs: [job('891')], oldestDays: 94, worth: { balance: 14980, retainageHeld: 6420, retainageAdded: 6420, claim: 34084, claimLines: [line('a', 5310), line('b', 2800), line('c', 1074), line('d', 3500)], claimTyped: 12684 } }))
    expect(both).toMatchObject({ answer: '$34,084.00', why: 'Open bills $14,980.00 inside it, plus retainage $6,420.00 that no bill asks for yet and 4 typed lines, $12,684.00. The oldest bill is 94 days old.', chip: { text: 'the claim', tone: 'ok' } })
    const typedOnly = howMuch(packet({ jobs: [job('891')], oldestDays: null, worth: { balance: 2028.04, claim: 7338.04, claimLines: [line('a', 5310)], claimTyped: 5310 } }))
    expect(typedOnly.why).toBe('Open bills $2,028.04 inside it, plus one typed line, $5,310.00.')
    for (const q of [both, typedOnly]) expect(plainWordsFailures(q.why)).toEqual([])
    expect(whatsLeftForUs(packet({ worth: { balance: 2028.04, claim: 7338.04, claimTyped: 5310, fee: 2421.55, net: 4566.49 } })).why).toBe('The firm takes 33%, or $2,421.55 of the claim, and filing costs $350.00.')
    // A bill sent for the whole amount and paid short by the retainage: the balance is the claim, and the sentence says where the retainage sits.
    const all = howMuch(packet({ jobs: [job('891')], oldestDays: 108, worth: { balance: 1509.8, retainageHeld: 1509.8, retainageOnBills: 1509.8, retainageAdded: 0, claim: 1509.8 } }))
    expect(all).toMatchObject({ answer: '$1,509.80', why: 'Owed on 1 job. The retainage held $1,509.80 is already inside the open bills. The oldest bill is 108 days old.' })
    expect(all.chip).toBeUndefined()
    expect(plainWordsFailures(all.why)).toEqual([])
  })
  it('carries the cut and the verdict as a chip', () => {
    const q = whatsLeftForUs(packet())
    expect(q.answer).toBe('$10,223.82')
    expect(q.why).toBe('The firm takes 33%, or $5,208.00, and filing costs $350.00.')
    expect(q.chip).toEqual({ text: 'worth it', tone: 'ok' })
    expect(whatsLeftForUs(packet({ worth: { verdict: 'not worth it' } })).chip?.tone).toBe('stop')
  })
})

describe('What could go wrong?', () => {
  it('says nothing we know of when the record is clean', () => {
    expect(whatCouldGoWrong(packet())).toMatchObject({ answer: 'Nothing we know of' })
  })
  it('names one flag in plain words, and counts several', () => {
    expect(whatCouldGoWrong(packet({ worth: { flags: ['dispute on record'] } }))).toMatchObject({ answer: 'They dispute the work' })
    const two = whatCouldGoWrong(packet({ worth: { flags: ['“no money” note', '2 broken promises'] } }))
    expect(two.answer).toBe('2 things')
    expect(two.why).toContain('They say they cannot pay.')
    expect(two.why).toContain('2 broken promises.')
  })
  it('never says nothing we know of beside Not yet', () => {
    expect(whatCouldGoWrong(packet({ theory: { key: 'none' } })).answer).toBe('No case yet')
  })
})

describe('the words', () => {
  it('pass the plain-words rules on every card', () => {
    const all = [packet(), packet({ theory: { key: 'none' }, worth: { flags: ['payer is a name only', 'dispute on record'] } }), packet({ theory: { key: 'lien' } })]
    for (const p of all) for (const q of deskQuestions(p)) expect(plainWordsFailures(`${q.answer}. ${q.why}`), `${q.label}: ${q.answer}. ${q.why}`).toEqual([])
  })
})
