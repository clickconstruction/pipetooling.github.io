import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { plainSentence } from '../valuesInPlace'
import type { LienPayoffBill, LienPayoffPlace, LienPayoffRow } from './lienPayoff'
import { PAYOFF_CHECK_WORDS, checkBills, checkPlan, liensPayoffAmount, parseCheckAmount, payoffCheckNote, spreadCheck, type CheckBill } from './lienPayoffCheck'

// Every job, bill, instrument and amount here is made up.
const bill = (invoiceId: string, jobId: string, open: number, billedYmd: string, stripe = false): LienPayoffBill => ({ invoiceId, jobId, open, billedYmd, stripe })
const row = (jobId: string, jobNumber: string, step: LienPayoffRow['step']['step'] = 'money'): LienPayoffRow => ({ affidavitId: `a-${jobId}`, jobId, jobNumber, jobName: `Okafor ${jobNumber}`, county: 'Travis', instrument: '', filedYmd: '2026-11-09', lienAmount: 0, open: 0, step: { step, say: '', warn: null, warnTone: null, press: null, releaseId: null } })
const place = (over: Partial<LienPayoffPlace> = {}): Pick<LienPayoffPlace, 'rows' | 'other'> => ({ rows: [row('j1', '2041'), row('j2', '2058'), row('j3', '2063')], other: [{ jobId: 'j4', jobNumber: '2071', jobName: 'Okafor trip charge', open: 640 }], ...over })
const BILLS: Record<string, LienPayoffBill[]> = {
  j1: [bill('b2', 'j1', 3000, '2026-11-10'), bill('b1', 'j1', 4420, '2026-11-02')],
  j2: [bill('b3', 'j2', 5160.5, '2026-11-09', true)],
  j3: [bill('b4', 'j3', 3875, '2026-08-18', true)],
  j4: [bill('b5', 'j4', 640, '2026-09-03')],
}
const bills = (): CheckBill[] => checkBills(place(), BILLS)
const plan = (check: number | null, pays?: Record<string, number>, number = '1184') => checkPlan({ check, number, bills: bills(), pays: pays ?? spreadCheck(check ?? 0, bills()) })

describe('checkBills', () => {
  it('lists the liened jobs’ bills first, each job’s oldest first, then the jobs with no lien', () => {
    expect(bills().map((b) => [b.invoiceId, b.jobNumber, b.liened])).toEqual([
      ['b1', '2041', true],
      ['b2', '2041', true],
      ['b3', '2058', true],
      ['b4', '2063', true],
      ['b5', '2071', false],
    ])
    expect(liensPayoffAmount(bills())).toBe(16455.5)
  })

  it('counts a released lien’s job as not liened, and drops a bill that owes nothing', () => {
    const out = checkBills(place({ rows: [row('j1', '2041', 'done'), row('j2', '2058')] }), { ...BILLS, j2: [bill('b3', 'j2', 0, '2026-11-09')] })
    expect(out.map((b) => [b.invoiceId, b.liened])).toEqual([
      ['b1', false],
      ['b2', false],
      ['b5', false],
    ])
  })
})

describe('spreadCheck', () => {
  it('pays the liened bills in order and leaves the rest of the place alone', () => {
    expect(spreadCheck(16455.5, bills())).toEqual({ b1: 4420, b2: 3000, b3: 5160.5, b4: 3875, b5: 0 })
  })

  it('runs out on the last bill it reaches, to the cent', () => {
    expect(spreadCheck(15000, bills())).toEqual({ b1: 4420, b2: 3000, b3: 5160.5, b4: 2419.5, b5: 0 })
    expect(spreadCheck(0.1 + 0.2, bills()).b1).toBe(0.3)
  })

  it('spills what is over the liens onto the job with no lien, and no further', () => {
    expect(spreadCheck(20000, bills())).toEqual({ b1: 4420, b2: 3000, b3: 5160.5, b4: 3875, b5: 640 })
  })

  it('keeps a value set by hand and spreads the rest around it', () => {
    expect(spreadCheck(16455.5, bills(), { b3: 0 })).toEqual({ b1: 4420, b2: 3000, b3: 0, b4: 3875, b5: 640 })
    expect(spreadCheck(5000, bills(), { b4: 3875 })).toEqual({ b1: 1125, b2: 0, b3: 0, b4: 3875, b5: 0 })
  })
})

describe('checkPlan', () => {
  it('reads a check that pays every lien: four ready, nothing held, the three totals', () => {
    const p = plan(16455.5)
    expect(p).toMatchObject({ check: 16455.5, placed: 16455.5, left: 0, ready: 4, held: 0, tone: 'green' })
    expect(p.words).toMatchObject({ button: 'Record 4 payments', dead: false, foot: null })
    expect(plainSentence(p.say)).toBe('Pays all 3 liens’ bills in full.')
  })

  it('holds a part payment on a Stripe bill and records the rest', () => {
    const p = plan(15000)
    expect(p.lines.map((l) => l.state)).toEqual(['ready', 'ready', 'ready', 'held', 'none'])
    expect(p.lines[3]!.why).toBe(PAYOFF_CHECK_WORDS.heldLine)
    expect(p).toMatchObject({ ready: 3, held: 1, left: 0, tone: 'amber' })
    expect(p.words.button).toBe('Record 3 payments · 1 pays part of a Stripe bill ▸')
    expect(p.words.dead).toBe(false)
    expect(plainSentence(p.say)).toBe('Pays 2 of 3 liens’ bills in full.')
  })

  it('takes a part payment on a bill that is not a Stripe bill', () => {
    const p = plan(3000)
    expect(p.lines.map((l) => l.state)).toEqual(['ready', 'none', 'none', 'none', 'none'])
    expect(p.words.button).toBe('Record 1 payment')
    expect(plainSentence(p.say)).toBe('Pays 0 of 3 liens’ bills in full.')
  })

  it('says what of the check is not placed', () => {
    const p = plan(20640.5)
    expect(p).toMatchObject({ placed: 17095.5, left: 3545, ready: 5, tone: 'amber' })
    expect(plainSentence(p.say)).toBe('Pays all 3 liens’ bills in full. $3,545.00 of the check is not placed.')
  })

  it('is dead with the reason: no amount, no number, lines over the check, a line over its bill', () => {
    expect(plan(null)).toMatchObject({ say: PAYOFF_CHECK_WORDS.noAmount, tone: 'red', words: { dead: true } })
    expect(plan(16455.5, undefined, '  ')).toMatchObject({ say: PAYOFF_CHECK_WORDS.noNumber, words: { dead: true } })
    const over = plan(1000, { b1: 4420 })
    expect(over.words.dead).toBe(true)
    expect(plainSentence(over.say)).toBe('The lines add up to $3,420.00 more than the check.')
    const overBill = plan(9000, { b1: 5000 })
    expect(overBill.lines[0]).toMatchObject({ state: 'over', why: PAYOFF_CHECK_WORDS.overLine })
    expect(overBill.words).toMatchObject({ dead: true })
  })

  it('keeps every sentence to plain words', () => {
    for (const p of [plan(16455.5), plan(15000), plan(20640.5), plan(null), plan(1000, { b1: 4420 })]) expect(plainWordsFailures(plainSentence(p.say))).toEqual([])
    for (const w of [PAYOFF_CHECK_WORDS.heldLine, PAYOFF_CHECK_WORDS.overLine, PAYOFF_CHECK_WORDS.amountHint]) expect(plainWordsFailures(w)).toEqual([])
  })
})

describe('the small pieces', () => {
  it('reads a typed amount', () => {
    expect(parseCheckAmount('$16,455.50')).toBe(16455.5)
    expect(parseCheckAmount(' 1,200 ')).toBe(1200)
    expect(parseCheckAmount('12.345')).toBeNull()
    expect(parseCheckAmount('0')).toBeNull()
    expect(parseCheckAmount('abc')).toBeNull()
    expect(parseCheckAmount('')).toBeNull()
  })

  it('writes the note every row of one check carries', () => {
    expect(payoffCheckNote(16455.5, ' 1184 ', 4)).toBe('Payoff check 1184, $16,455.50 over 4 bills')
    expect(payoffCheckNote(640, '9', 1)).toBe('Payoff check 9, $640.00 over 1 bill')
  })
})
