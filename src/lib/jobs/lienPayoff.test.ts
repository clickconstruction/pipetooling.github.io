import { describe, expect, it } from 'vitest'
import { plainSentence } from '../valuesInPlace'
import { plainWordsFailures } from '../plainWords'
import type { BankCheck } from './checkCleared'
import {
  LIEN_PAYOFF_STEPS,
  lastPayment,
  lienPayoffBills,
  lienPayoffOtherLine,
  lienPayoffPlaces,
  lienPayoffStep,
  lienPayoffStepState,
  lienPayoffStrip,
  lienPlaceKey,
  payWayWords,
  releaseForAffidavit,
  type LienPayoffAffidavit,
  type LienPayoffFacts,
  type LienPayoffJob,
  type LienPayoffPayment,
  type LienPayoffRelease,
} from './lienPayoff'

// Every name, address, job, instrument and amount here is made up.
const TODAY = '2026-11-24'
const aff = (over: Partial<LienPayoffAffidavit> = {}): LienPayoffAffidavit => ({ id: 'a1', job_id: 'j1', amount: 7420, county: 'Travis', recording_number: '2026-0412207', filed_at: '2026-11-09', ...over })
const rel = (over: Partial<LienPayoffRelease> = {}): LienPayoffRelease => ({ id: 'r1', job_id: 'j1', created_at: '2026-11-24T18:00:00Z', filed_at: null, recording_number: '2026-0412207', fields: {}, ...over })
const check = (over: Partial<LienPayoffPayment> = {}): LienPayoffPayment => ({ amount: 7420, paid_on: '2026-11-24', payment_type: 'Check', reference_number: '1184', ...over })
/** The bank's deposit of check 1184: $16,455.50, deposited Nov 24, the bank's day Dec 2. */
const bank = (over: Partial<BankCheck> = {}): BankCheck => ({ id: 'b1', amount: 16455.5, status: 'pending', depositedYmd: '2026-11-24', postedYmd: null, bankDayYmd: '2026-12-02', checkNumber: '01184', failureReason: null, ...over })
const step = (over: Partial<Parameters<typeof lienPayoffStep>[0]> = {}) => lienPayoffStep({ affidavit: aff(), releases: [], affidavitsOnJob: 1, open: 0, payments: [], todayYmd: TODAY, ...over })

describe('lienPayoffStep', () => {
  it('asks for the payment while the bills still owe', () => {
    const s = step({ open: 7420 })
    expect(s.step).toBe('money')
    expect(plainSentence(s.say)).toBe('$7,420.00 is still open on this job’s bills.')
    expect(s.press).toEqual({ label: 'Record the payment ›', door: 'bill' })
    expect(s.warn).toBeNull()
  })

  it('says part paid when money came in and the lien is not covered', () => {
    const s = step({ open: 1455.5, payments: [check({ amount: 5964.5 })] })
    expect(s.step).toBe('money')
    expect(plainSentence(s.say)).toBe('Part paid. $1,455.50 is still open on this job’s bills.')
  })

  it('owes the release once the bills read paid by money that needs no bank', () => {
    const card = step({ payments: [check({ payment_type: 'Card (external)', reference_number: null })] })
    expect(card.step).toBe('release')
    expect(plainSentence(card.say)).toBe('Paid Nov 24 by card. The release is owed.')
    expect(card.warn).toBeNull()
    expect(card.press).toEqual({ label: 'Make the release ›', door: 'release' })
  })

  it('offers no release while the bank has not cleared the check', () => {
    const s = step({ payments: [check()], bank: [bank()] })
    expect(s.step).toBe('bank')
    expect(plainSentence(s.say)).toBe('Paid Nov 24 by check 1184.')
    expect(plainSentence(s.warn ?? '')).toBe('Check 1184 is at the bank. The bank says it clears Dec 2. The release waits until then.')
    expect(s.warnTone).toBe('amber')
    expect(s.press).toBeNull()
    // Posted is not cleared: the bank's own day still rules.
    const posted = step({ payments: [check()], bank: [bank({ status: 'sent', postedYmd: '2026-11-25' })], todayYmd: '2026-12-01' })
    expect(posted.step).toBe('bank')
    expect(plainSentence(posted.warn ?? '')).toBe('The bank posted check 1184 on Nov 25. It can still come back until Dec 2. The release waits until then.')
  })

  it('owes the release the day the bank clears the check', () => {
    const s = step({ payments: [check()], bank: [bank({ status: 'sent', postedYmd: '2026-11-25' })], todayYmd: '2026-12-02' })
    expect(s.step).toBe('release')
    expect(plainSentence(s.say)).toBe('Paid Nov 24 by check 1184. The release is owed.')
    expect(s.warn).toBeNull()
    expect(s.press).toEqual({ label: 'Make the release ›', door: 'release' })
  })

  it('waits seven days from the day typed when the bank shows no deposit of the check', () => {
    const s = step({ payments: [check()] })
    expect(s.step).toBe('bank')
    expect(plainSentence(s.warn ?? '')).toBe('The bank shows no deposit of check 1184. Without one it counts as cleared Dec 1. The release waits until then.')
    expect(step({ payments: [check()], todayYmd: '2026-12-01' }).step).toBe('release')
  })

  it('opens the bills in red when the check came back', () => {
    const s = step({ payments: [check()], bank: [bank({ status: 'failed', failureReason: 'Insufficient funds' })] })
    expect(s.step).toBe('bank')
    expect(plainSentence(s.warn ?? '')).toBe('Check 1184 came back. The bank said insufficient funds. The release waits for a payment that holds.')
    expect(s.warnTone).toBe('red')
    expect(s.press).toEqual({ label: 'Open the bills ›', door: 'bill' })
  })

  it('reads paid bills with no payment row', () => {
    expect(plainSentence(step().say)).toBe('The bills read paid. The release is owed.')
  })

  it('sends a saved release to the county, and names money still owed in red', () => {
    const s = step({ releases: [rel()], payments: [check()] })
    expect(s.step).toBe('county')
    expect(plainSentence(s.say)).toBe('The release was made Nov 24. Sign it before a notary. Then record it at the county.')
    expect(s.press).toEqual({ label: 'Record the county’s stamp ›', door: 'release' })
    expect(s.releaseId).toBe('r1')
    const owes = step({ releases: [rel()], open: 300 })
    expect(owes.warnTone).toBe('red')
    expect(plainSentence(owes.warn ?? '')).toBe('$300.00 is still open on this job’s bills.')
  })

  it('is released once the release carries the county’s day, with its own instrument when it has one', () => {
    const s = step({ releases: [rel({ filed_at: '2026-12-03', fields: { releasesFilingId: 'a1', releaseInstrument: '2026-0431955' } })] })
    expect(s.step).toBe('done')
    expect(plainSentence(s.say)).toBe('Released. The county recorded it Dec 3 as 2026-0431955.')
    expect(s.press).toBeNull()
    expect(plainSentence(step({ releases: [rel({ filed_at: '2026-12-03' })] }).say)).toBe('Released. The county recorded it Dec 3.')
  })

  it('keeps every sentence to plain words', () => {
    const all = [
      step({ open: 7420 }),
      step({ open: 1455.5, payments: [check({ amount: 5964.5 })] }),
      step({ payments: [check()] }),
      step({ payments: [check()], bank: [bank()] }),
      step({ payments: [check()], bank: [bank({ status: 'sent', postedYmd: '2026-11-25' })] }),
      step({ payments: [check()], bank: [bank()], todayYmd: '2026-12-03' }),
      step({ payments: [check()], bank: [bank({ status: 'failed', failureReason: 'There was an issue with this transaction' })] }),
      step({ payments: [check()], bank: [bank({ status: 'failed', failureReason: 'Insufficient funds' })] }),
      step({ payments: [check({ payment_type: 'Cash', reference_number: null })] }),
      step(),
      step({ releases: [rel()], open: 300 }),
      step({ releases: [rel({ filed_at: '2026-12-03', fields: { releaseInstrument: '2026-0431955' } })] }),
    ]
    for (const s of all) for (const line of [s.say, s.warn]) if (line) expect(plainWordsFailures(plainSentence(line))).toEqual([])
  })
})

describe('releaseForAffidavit', () => {
  it('takes the release that names the affidavit, over one that only shares the job', () => {
    const named = rel({ id: 'r2', fields: { releasesFilingId: 'a2' }, recording_number: 'x' })
    expect(releaseForAffidavit(aff({ id: 'a2' }), [rel(), named], 2)?.id).toBe('r2')
  })

  it('matches an older release by the instrument number it copied', () => {
    expect(releaseForAffidavit(aff(), [rel({ recording_number: ' 2026-0412207 ' })], 2)?.id).toBe('r1')
  })

  it('never hands a job’s loose release to the second of two liens', () => {
    const loose = rel({ recording_number: '' })
    expect(releaseForAffidavit(aff(), [loose], 1)?.id).toBe('r1')
    expect(releaseForAffidavit(aff(), [loose], 2)).toBeNull()
    expect(releaseForAffidavit(aff({ id: 'a2', recording_number: '2026-0412208' }), [rel()], 2)).toBeNull()
  })

  it('ignores another job’s release, and takes the newest of two', () => {
    expect(releaseForAffidavit(aff(), [rel({ job_id: 'j9' })], 1)).toBeNull()
    expect(releaseForAffidavit(aff(), [rel({ id: 'old', created_at: '2026-11-20T00:00:00Z' }), rel({ id: 'new' })], 1)?.id).toBe('new')
  })
})

describe('the small readers', () => {
  it('finds the newest dated payment', () => {
    expect(lastPayment([check({ paid_on: '2026-11-01' }), check({ paid_on: '2026-11-24', reference_number: '9' }), check({ paid_on: null }), check({ amount: 0, paid_on: '2026-12-30' })])?.reference_number).toBe('9')
    expect(lastPayment([])).toBeNull()
  })

  it('says how the money came', () => {
    expect(payWayWords({ payment_type: 'Check', reference_number: ' 1184 ' })).toBe('check 1184')
    expect(payWayWords({ payment_type: 'checkDeposit', reference_number: null })).toBe('check')
    expect(payWayWords({ payment_type: 'Cash', reference_number: null })).toBe('cash')
    expect(payWayWords({ payment_type: 'ACH', reference_number: null })).toBe('bank transfer')
    expect(payWayWords({ payment_type: 'Other', reference_number: null })).toBe('')
    expect(payWayWords({ payment_type: null, reference_number: null })).toBe('')
  })

  it('keys one place however its jobs spell it', () => {
    const one = lienPlaceKey('212 Larkspur Ct, Austin, TX 78701')
    expect(lienPlaceKey('212 Larkspur Court Austin, TX')).toBe(one)
    expect(lienPlaceKey('212 N. Larkspur Ct')).toBe(one)
    expect(lienPlaceKey('214 Larkspur Ct, Austin')).not.toBe(one)
    expect(lienPlaceKey('')).toBe('')
  })

  it('reads the three steps against where a lien stands', () => {
    expect(LIEN_PAYOFF_STEPS.map((s) => lienPayoffStepState('release', s.key))).toEqual(['done', 'now', 'later'])
    expect(LIEN_PAYOFF_STEPS.map((s) => lienPayoffStepState('done', s.key))).toEqual(['done', 'done', 'done'])
    expect(LIEN_PAYOFF_STEPS.map((s) => lienPayoffStepState('money', s.key))).toEqual(['now', 'later', 'later'])
  })
})

describe('lienPayoffPlaces and the strip', () => {
  const job = (id: string, n: string, address: string, customer = 'c1', name = 'Marisol Okafor'): LienPayoffJob => ({ id, hcp_number: null, click_number: n, job_name: `Okafor ${n}`, job_address: address, customer_id: customer, customer_name: name })
  const facts = (over: Partial<LienPayoffFacts> = {}): LienPayoffFacts => ({
    affidavits: [
      aff({ id: 'a1', job_id: 'j1', amount: 7420, recording_number: '2026-0412207' }),
      aff({ id: 'a2', job_id: 'j2', amount: 5160.5, recording_number: '2026-0412208' }),
      aff({ id: 'a3', job_id: 'j3', amount: 3875, recording_number: '2026-0412209' }),
      aff({ id: 'a4', job_id: 'j4', amount: 900, recording_number: '2026-0500001' }),
      aff({ id: 'draft', job_id: 'j1', filed_at: null }),
    ],
    releases: [],
    jobs: [job('j1', '2041', '212 Larkspur Court, Austin, TX'), job('j2', '2058', '212 Larkspur Ct Austin TX'), job('j3', '2063', '212 Larkspur Ct, Austin'), job('j4', '1987', '40 Calloway Road, Bastrop', 'c2', 'Calloway Homes')],
    openByJob: { j1: 7420, j2: 5160.5, j3: 3875, j4: 900 },
    paymentsByJob: {},
    todayYmd: TODAY,
    ...over,
  })

  it('groups the filed liens of one place and says what pays them off', () => {
    const places = lienPayoffPlaces(facts())
    expect(places.map((p) => [p.payer, p.rows.length])).toEqual([
      ['Marisol Okafor', 3],
      ['Calloway Homes', 1],
    ])
    expect(plainSentence(places[0]!.headline)).toBe('3 liens on record here. $16,455.50 pays them off.')
    expect(plainSentence(places[1]!.headline)).toBe('1 lien on record here. $900.00 pays it off.')
    expect(places[0]!.rows.map((r) => r.jobNumber)).toEqual(['2041', '2058', '2063'])
    expect(lienPayoffStrip(places)).toMatchObject({ owed: 0, county: 0, onRecord: 4, tone: 'plain' })
    expect(plainSentence(lienPayoffStrip(places).say ?? '')).toBe('4 filed liens on record.')
  })

  it('lifts a paid place to the top and counts its releases owed', () => {
    const places = lienPayoffPlaces(
      facts({ openByJob: { j1: 0, j2: 0, j3: 1455.5, j4: 900 }, paymentsByJob: { j1: [check({ paid_on: '2026-11-10' })], j2: [check({ amount: 5160.5, paid_on: '2026-11-10' })], j3: [check({ amount: 2419.5 })] } }),
    )
    expect(places[0]!.payer).toBe('Marisol Okafor')
    expect(places[0]!.rows.map((r) => r.step.step)).toEqual(['release', 'release', 'money'])
    expect(plainSentence(places[0]!.headline)).toBe('1 lien on record here. $1,455.50 pays it off. 2 more are paid.')
    const strip = lienPayoffStrip(places)
    expect(strip).toMatchObject({ owed: 2, onRecord: 2, tone: 'amber' })
    expect(plainSentence(strip.say ?? '')).toBe('2 liens are paid and still on record.')
  })

  it('walks a place through the county to released', () => {
    const paid = { openByJob: { j1: 0, j2: 0, j3: 0, j4: 900 } }
    const out = lienPayoffPlaces(facts({ ...paid, releases: [rel({ id: 'r1', job_id: 'j1' }), rel({ id: 'r2', job_id: 'j2', recording_number: '2026-0412208' }), rel({ id: 'r3', job_id: 'j3', recording_number: '2026-0412209' })] }))
    expect(plainSentence(out[0]!.headline)).toBe('3 releases wait for the county’s stamp.')
    expect(plainSentence(lienPayoffStrip(out).say ?? '')).toBe('3 releases wait for the county’s stamp.')
    const done = lienPayoffPlaces(
      facts({ ...paid, openByJob: { j1: 0, j2: 0, j3: 0, j4: 0 }, releases: ['j1', 'j2', 'j3', 'j4'].map((j, i) => rel({ id: `r${i}`, job_id: j, recording_number: '', filed_at: '2026-12-03' })) }),
    )
    expect(done.every((p) => p.rows.every((r) => r.step.step === 'done'))).toBe(true)
    expect(plainSentence(done.find((p) => p.payer === 'Marisol Okafor')!.headline)).toBe('Every lien here is released.')
    expect(plainSentence(lienPayoffStrip(done).say ?? '')).toBe('Every filed lien is released.')
  })

  it('keeps one place when its jobs sit under two customers, and names both', () => {
    const f = facts()
    const places = lienPayoffPlaces({ ...f, jobs: f.jobs.map((j) => (j.id === 'j3' ? { ...j, customer_id: 'c9', customer_name: 'Bright Fork Builders' } : j)) })
    expect(places.map((p) => [p.payer, p.rows.length])).toEqual([
      ['Marisol Okafor, Bright Fork Builders', 3],
      ['Calloway Homes', 1],
    ])
  })

  it('shows money open at a liened place on a job with no lien, and keeps it out of what pays the liens off', () => {
    const f = facts()
    const trip = { id: 'j9', hcp_number: null, click_number: '2071', job_name: 'Okafor trip charge', job_address: '212 Larkspur Ct, Austin', customer_id: 'c1', customer_name: 'Marisol Okafor' }
    const elsewhere = { ...trip, id: 'j8', click_number: '2099', job_address: '9 Other Road, Austin' }
    const paidUp = { ...trip, id: 'j7', click_number: '2100' }
    const places = lienPayoffPlaces({ ...f, otherJobs: [trip, elsewhere, paidUp, f.jobs[0]!], openByJob: { ...f.openByJob, j9: 640, j8: 500, j7: 0 } })
    const here = places.find((p) => p.payer === 'Marisol Okafor')!
    expect(here.other).toEqual([{ jobId: 'j9', jobNumber: '2071', jobName: 'Okafor trip charge', open: 640 }])
    expect(plainSentence(here.headline)).toBe('3 liens on record here. $16,455.50 pays them off.')
    expect(plainSentence(lienPayoffOtherLine(here.other) ?? '')).toBe('$640.00 more is open here on 2071. It is not liened.')
    expect(lienPayoffOtherLine([])).toBeNull()
    expect(places.find((p) => p.payer === 'Calloway Homes')!.other).toEqual([])
  })

  it('holds a place paid by a check the bank has not cleared, and counts it on the strip', () => {
    const paidByCheck = { openByJob: { j1: 0, j2: 0, j3: 0, j4: 900 }, paymentsByJob: { j1: [check()], j2: [check({ amount: 5160.5 })], j3: [check({ amount: 3875 })] }, bank: [bank()] }
    const places = lienPayoffPlaces(facts(paidByCheck))
    const here = places.find((p) => p.payer === 'Marisol Okafor')!
    expect(here.rows.map((r) => r.step.step)).toEqual(['bank', 'bank', 'bank'])
    expect(plainSentence(here.headline)).toBe('Paid by a check that has not cleared. 3 releases wait for the bank.')
    expect(places[0]).toBe(here)
    const strip = lienPayoffStrip(places)
    expect(strip).toMatchObject({ owed: 0, bank: 3, onRecord: 1, tone: 'plain' })
    expect(plainSentence(strip.say ?? '')).toBe('3 paid liens wait for the bank to clear a check.')
    // The day the bank clears it, the three releases are owed.
    const cleared = lienPayoffPlaces(facts({ ...paidByCheck, bank: [bank({ status: 'sent', postedYmd: '2026-11-25' })], todayYmd: '2026-12-02' }))
    expect(cleared[0]!.rows.map((r) => r.step.step)).toEqual(['release', 'release', 'release'])
    expect(plainSentence(lienPayoffStrip(cleared).say ?? '')).toBe('3 liens are paid and still on record.')
  })

  it('says a check for exactly what pays a place’s liens off is at the bank, before anything is recorded', () => {
    const places = lienPayoffPlaces(facts({ bank: [bank(), bank({ id: 'b2', amount: 16455.51, checkNumber: '9' })] }))
    const here = places.find((p) => p.payer === 'Marisol Okafor')!
    expect(here.bank?.check.id).toBe('b1')
    expect(plainSentence(here.bank?.say ?? '')).toBe('Check 01184 for $16,455.50 is at the bank. The bank says it clears Dec 2. Nothing is recorded until then.')
    expect(here.bank?.tone).toBe('amber')
    expect(here.rows.every((r) => r.step.step === 'money')).toBe(true)
    expect(places[0]).toBe(here)
    expect(places.find((p) => p.payer === 'Calloway Homes')!.bank).toBeNull()
    const strip = lienPayoffStrip(places)
    expect(strip).toMatchObject({ atBank: 1, toRecord: 0, tone: 'plain' })
    expect(plainSentence(strip.say ?? '')).toBe('1 check for liens on record is at the bank.')
  })

  it('says the check is ready to record the day the bank clears it, and lifts the strip to amber', () => {
    const places = lienPayoffPlaces(facts({ bank: [bank({ status: 'sent', postedYmd: '2026-11-25' })], todayYmd: '2026-12-02' }))
    const here = places[0]!
    expect(here.payer).toBe('Marisol Okafor')
    expect(plainSentence(here.bank?.say ?? '')).toBe('The bank cleared check 01184 for $16,455.50 on Dec 2. It is ready to record.')
    expect(here.bank?.tone).toBe('green')
    const strip = lienPayoffStrip(places)
    expect(strip).toMatchObject({ toRecord: 1, tone: 'amber' })
    expect(plainSentence(strip.say ?? '')).toBe('1 check has cleared for liens on record. Record it.')
  })

  it('reads a check as the place’s own when it also covers the money open there with no lien, and drops an old one', () => {
    const f = facts()
    const trip = { id: 'j9', hcp_number: null, click_number: '2071', job_name: 'Okafor trip charge', job_address: '212 Larkspur Ct, Austin', customer_id: 'c1', customer_name: 'Marisol Okafor' }
    const withTrip = { ...f, otherJobs: [trip], openByJob: { ...f.openByJob, j9: 640 } }
    expect(lienPayoffPlaces({ ...withTrip, bank: [bank({ amount: 17095.5 })] })[0]!.bank?.check.amount).toBe(17095.5)
    expect(lienPayoffPlaces({ ...withTrip, bank: [bank({ amount: 640 })] }).every((p) => p.bank === null)).toBe(true)
    expect(lienPayoffPlaces({ ...f, bank: [bank({ depositedYmd: '2026-10-20' })] }).every((p) => p.bank === null)).toBe(true)
    // The bank could not read it, or sent it back: said, with nothing to record.
    expect(plainSentence(lienPayoffPlaces({ ...f, bank: [bank({ status: 'failed', failureReason: 'Insufficient funds' })] })[0]!.bank?.say ?? '')).toBe('Check 01184 for $16,455.50 came back. The bank said insufficient funds. Nothing was recorded.')
    expect(plainSentence(lienPayoffPlaces({ ...f, bank: [bank({ status: 'failed', failureReason: 'There was an issue with this transaction' })] })[0]!.bank?.say ?? '')).toBe('The bank could not read check 01184 for $16,455.50. Deposit it again.')
  })

  it('says nothing when no lien is filed', () => {
    expect(lienPayoffStrip(lienPayoffPlaces(facts({ affidavits: [] }))).say).toBeNull()
  })

  it('keeps a lien whose job did not load', () => {
    const places = lienPayoffPlaces(facts({ jobs: [] }))
    expect(places).toHaveLength(4)
    expect(places[0]!.place).toBe('A job with no address')
  })
})

describe('lienPayoffBills', () => {
  const inv = (id: string, amount: number, status = 'billed', billed_at = '2026-11-09T12:00:00Z', stripe_invoice_id: string | null = null) => ({ id, amount, status, billed_at, sequence_order: 0, stripe_invoice_id })

  it('lists the sent bills that still owe, oldest first, net of what each was paid', () => {
    const out = lienPayoffBills('j1', [inv('late', 3000, 'billed', '2026-11-10T12:00:00Z', 'in_made_up'), inv('early', 4420, 'billed', '2026-11-02T12:00:00Z'), inv('done', 900, 'paid'), inv('draft', 50, 'ready_to_bill')], [{ invoice_id: 'early', amount: 420 }], 8370)
    expect(out).toEqual([
      { invoiceId: 'early', jobId: 'j1', open: 4000, billedYmd: '2026-11-02', stripe: false },
      { invoiceId: 'late', jobId: 'j1', open: 3000, billedYmd: '2026-11-10', stripe: true },
    ])
  })

  it('drops a bill paid in full, and gives a payment with no bill picked to the oldest bill', () => {
    expect(lienPayoffBills('j1', [inv('a', 100)], [{ invoice_id: 'a', amount: 100 }], 100)).toEqual([])
    expect(lienPayoffBills('j1', [inv('a', 100, 'billed', '2026-11-01T12:00:00Z'), inv('b', 100, 'billed', '2026-11-05T12:00:00Z')], [{ invoice_id: null, amount: 100 }], 200).map((b) => b.invoiceId)).toEqual(['b'])
  })
})

describe('the funds confirmed (punch list #435, piece 4)', () => {
  const FUNDS = { by: 'u1', name: 'Alex Rivera', at: '2026-11-26T15:04:00Z', note: 'the funds are good' }
  const JOB: LienPayoffJob = { id: 'j1', hcp_number: null, click_number: '2041', job_name: 'Okafor main house', job_address: '212 Larkspur Court, Austin, TX', customer_id: 'c1', customer_name: 'Marisol Okafor' }

  it('owes the release before the bank’s day once the funds are confirmed, and says whose word it rests on', () => {
    const s = step({ payments: [check()], bank: [bank()], funds: FUNDS })
    expect(s.step).toBe('release')
    expect(plainSentence(s.say)).toBe('Paid Nov 24 by check 1184. Alex Rivera confirmed the funds Nov 26. The release is owed.')
    expect(plainWordsFailures(plainSentence(s.say))).toEqual([])
    expect(s.press).toEqual({ label: 'Make the release ›', door: 'release' })
    expect(s.check?.state).toBe('at_bank')
    expect(s.paid).toEqual({ ymd: '2026-11-24', way: 'check 1184' })
  })

  it('keeps the lien on the bank when the check came back, confirmation or not', () => {
    const s = step({ payments: [check()], bank: [bank({ status: 'failed', postedYmd: '2026-11-25', failureReason: 'Insufficient funds' })], funds: FUNDS })
    expect(s.step).toBe('bank')
    expect(s.press).toEqual({ label: 'Open the bills ›', door: 'bill' })
    expect(s.check?.state).toBe('came_back')
  })

  it('carries the last payment, the bank’s answer and the recorded day on every step', () => {
    const done = step({ payments: [check()], releases: [rel({ filed_at: '2026-12-03', fields: { releasesFilingId: 'a1' } })] })
    expect(done.recordedYmd).toBe('2026-12-03')
    expect(done.paid).toEqual({ ymd: '2026-11-24', way: 'check 1184' })
    expect(done.check?.state).toBe('no_deposit')
    const owing = step({ open: 7420 })
    expect(owing.recordedYmd).toBeNull()
    expect(owing.paid).toBeNull()
    expect(owing.check).toBeNull()
  })

  it('puts the two facts off the affidavit row on its place row', () => {
    const fields = { releaseAskedYmd: '2026-11-24', fundsConfirmed: FUNDS }
    const places = lienPayoffPlaces({ affidavits: [aff({ fields })], releases: [], jobs: [JOB], openByJob: { j1: 0 }, paymentsByJob: { j1: [check()] }, bank: [bank()], todayYmd: TODAY })
    const row = places[0]!.rows[0]!
    expect(row.askedYmd).toBe('2026-11-24')
    expect(row.funds).toEqual(FUNDS)
    expect(row.fields).toEqual(fields)
    expect(row.step.step).toBe('release')
    const bare = lienPayoffPlaces({ affidavits: [aff()], releases: [], jobs: [JOB], openByJob: { j1: 7420 }, paymentsByJob: {}, todayYmd: TODAY })[0]!.rows[0]!
    expect(bare.askedYmd).toBe('')
    expect(bare.funds).toBeNull()
    expect(bare.fields).toBeNull()
  })
})
