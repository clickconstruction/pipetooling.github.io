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
    worth: { balance: 15781.82, contingencyPct: 0.33, fee: 5208, filingCost: 350, net: 10223.82, flags: [], verdict: 'worth it', ...over.worth },
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
})

describe('How much? and What\'s left for us?', () => {
  it('says the balance, the jobs and the oldest bill', () => {
    expect(howMuch(packet())).toMatchObject({ answer: '$15,781.82', why: 'Owed on 3 jobs. The oldest bill is 192 days old.' })
    expect(howMuch(packet({ jobs: [job('707')], oldestDays: null })).why).toBe('Owed on 1 job.')
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
