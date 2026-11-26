import { describe, expect, it } from 'vitest'
import { plainSentence } from '../valuesInPlace'
import { plainWordsFailures } from '../plainWords'
import type { BankCheck } from './checkCleared'
import type { LienPayoffFacts, LienPayoffRelease } from './lienPayoff'
import { RELEASE_RUN_WORDS, buildLienReleaseRun, copiesDayCheck, notarizedDayCheck, releaseRunStage } from './lienReleaseRun'

// Every name, address, job, instrument, check and amount here is made up.
const TODAY = '2026-12-01'
const WHO = { by: 'u1', name: 'Alex Rivera', at: '2026-11-26T18:00:00Z' }
const rel = (id: string, job: string, affidavit: string, over: Partial<LienPayoffRelease> & { more?: Record<string, unknown> } = {}): LienPayoffRelease => {
  const { more, ...row } = over
  return { id, job_id: job, created_at: '2026-11-25T16:00:00Z', filed_at: null, recording_number: null, fields: { releasesFilingId: affidavit, paymentDate: '2026-11-24', ...more }, ...row }
}
const paid = (amount: number) => ({ amount, paid_on: '2026-11-10', payment_type: 'Check', reference_number: '1184' })
const facts = (releases: LienPayoffRelease[], over: Partial<LienPayoffFacts> = {}): LienPayoffFacts => ({
  affidavits: [
    { id: 'a1', job_id: 'j1', amount: 7420, county: 'Travis', recording_number: '2026-0412207', filed_at: '2026-11-09', fields: {} },
    { id: 'a2', job_id: 'j2', amount: 5160.5, county: 'Travis', recording_number: '2026-0412208', filed_at: '2026-11-09', fields: {} },
    { id: 'a3', job_id: 'j3', amount: 900, county: 'Bastrop', recording_number: '2026-0500001', filed_at: '2026-10-02', fields: {} },
  ],
  releases,
  jobs: [
    { id: 'j1', hcp_number: null, click_number: '2041', job_name: 'Okafor main house', job_address: '212 Larkspur Court, Austin, TX', customer_id: 'c1', customer_name: 'Marisol Okafor' },
    { id: 'j2', hcp_number: null, click_number: '2058', job_name: 'Okafor service visit', job_address: '212 Larkspur Ct Austin TX', customer_id: 'c1', customer_name: 'Marisol Okafor' },
    { id: 'j3', hcp_number: null, click_number: '1987', job_name: 'Calloway gate', job_address: '40 Calloway Road, Bastrop', customer_id: 'c2', customer_name: 'Calloway Homes' },
  ],
  openByJob: { j1: 0, j2: 0, j3: 0 },
  paymentsByJob: { j1: [paid(7420)], j2: [paid(5160.5)], j3: [paid(900)] },
  bank: [],
  todayYmd: TODAY,
  ...over,
})
const run = (releases: LienPayoffRelease[], over: Partial<LienPayoffFacts> = {}) => buildLienReleaseRun(facts(releases, over))

describe('releaseRunStage', () => {
  it('walks a saved release from the print to the copies', () => {
    expect(releaseRunStage(rel('r1', 'j1', 'a1'), TODAY)).toBe('print')
    expect(releaseRunStage(rel('r1', 'j1', 'a1', { more: { printedForNotary: WHO } }), TODAY)).toBe('notary')
    expect(releaseRunStage(rel('r1', 'j1', 'a1', { more: { printedForNotary: WHO, notarizedYmd: '2026-11-28' } }), TODAY)).toBe('county')
    expect(releaseRunStage(rel('r1', 'j1', 'a1', { filed_at: '2026-11-30', more: { notarizedYmd: '2026-11-28' } }), TODAY)).toBe('copies')
    expect(releaseRunStage(rel('r1', 'j1', 'a1', { filed_at: '2026-11-30', more: { copiesSent: { ...WHO, ymd: '2026-12-01' } } }), TODAY)).toBeNull()
  })

  it('takes a notary’s day typed with no print on record, and the county’s day over both', () => {
    expect(releaseRunStage(rel('r1', 'j1', 'a1', { more: { notarizedYmd: '2026-11-28' } }), TODAY)).toBe('county')
    expect(releaseRunStage(rel('r1', 'j1', 'a1', { filed_at: '2026-11-30' }), TODAY)).toBe('copies')
  })

  it('leaves alone a release the county recorded more than thirty days ago', () => {
    expect(releaseRunStage(rel('r1', 'j1', 'a1', { filed_at: '2026-11-01' }), TODAY)).toBe('copies')
    expect(releaseRunStage(rel('r1', 'j1', 'a1', { filed_at: '2026-10-31' }), TODAY)).toBeNull()
  })
})

describe('buildLienReleaseRun', () => {
  it('draws nothing with no saved release, or with every release done', () => {
    expect(run([]).show).toBe(false)
    expect(run([]).tally).toBe('')
    expect(run([rel('r3', 'j3', 'a3', { filed_at: '2026-10-05' })]).show).toBe(false)
  })

  it('lists each release under the act it is on, and counts them', () => {
    const r = run([
      rel('r1', 'j1', 'a1'),
      rel('r2', 'j2', 'a2', { more: { printedForNotary: WHO } }),
      rel('r3', 'j3', 'a3', { filed_at: '2026-11-30', more: { releaseInstrument: '2026-0500990', notarizedYmd: '2026-11-28' } }),
    ])
    expect(r.show).toBe(true)
    expect(r.lines.print.map((l) => l.releaseId)).toEqual(['r1'])
    expect(r.lines.notary.map((l) => l.releaseId)).toEqual(['r2'])
    expect(r.lines.county).toEqual([])
    expect(r.lines.copies.map((l) => l.releaseId)).toEqual(['r3'])
    expect(plainSentence(r.tally)).toBe('1 to print · 1 at the notary · 1 to send')
    expect(r.lines.print[0]).toMatchObject({ jobNumber: '2041', jobName: 'Okafor main house', instrument: '2026-0412207', place: '212 Larkspur Court, Austin, TX', madeYmd: '2026-11-25', held: null })
    expect(plainSentence(r.lines.notary[0]!.note)).toBe('Printed Nov 26 by Alex Rivera.')
    expect(plainSentence(r.lines.copies[0]!.note)).toBe('Recorded Nov 30 as 2026-0500990.')
    expect(r.lines.copies[0]!.recordedYmd).toBe('2026-11-30')
  })

  it('says the notary’s day on a release waiting for the county', () => {
    const r = run([rel('r1', 'j1', 'a1', { more: { printedForNotary: WHO, notarizedYmd: '2026-11-28' } })])
    expect(plainSentence(r.lines.county[0]!.note)).toBe('Notarized Nov 28.')
    expect(plainSentence(r.tally)).toBe('1 to record')
  })

  it('names the print press with its count, and is dead with nothing to print', () => {
    expect(run([rel('r1', 'j1', 'a1'), rel('r2', 'j2', 'a2')]).print).toMatchObject({ button: 'Print 2 releases for the notary', foot: null, dead: false })
    expect(run([rel('r1', 'j1', 'a1')]).print.button).toBe('Print 1 release for the notary')
    expect(run([rel('r2', 'j2', 'a2', { more: { printedForNotary: WHO } })]).print).toMatchObject({ button: 'Print', dead: true })
  })

  it('holds a release whose bills owe again, prints the rest, and says what it held', () => {
    const r = run([rel('r1', 'j1', 'a1'), rel('r2', 'j2', 'a2')], { openByJob: { j1: 0, j2: 5160.5, j3: 0 } })
    expect(r.print.button).toBe('Print 1 release for the notary · 1 is short ▸')
    expect(r.print.dead).toBe(false)
    expect(r.print.ready.map((l) => l.releaseId)).toEqual(['r1'])
    expect(r.print.held.map((l) => l.releaseId)).toEqual(['r2'])
    expect(r.lines.print.find((l) => l.releaseId === 'r2')).toMatchObject({ heldKind: 'short' })
    expect(plainSentence(r.lines.print.find((l) => l.releaseId === 'r2')!.held ?? '')).toBe('Held. $5,160.50 is open on this job’s bills again.')
  })

  it('does not hold a release that went out on a typed reason with money still open', () => {
    const r = run([rel('r2', 'j2', 'a2', { more: { releasedUnpaidReason: 'settled for less, per the owner' } })], { openByJob: { j1: 0, j2: 800, j3: 0 } })
    expect(r.lines.print[0]!.held).toBeNull()
    expect(r.print.button).toBe('Print 1 release for the notary')
  })

  it('holds a release whose check the bank sent back, on every act before the county’s', () => {
    const back: BankCheck = { id: 'b1', amount: 7420, status: 'failed', depositedYmd: '2026-11-10', postedYmd: '2026-11-11', bankDayYmd: '2026-11-18', checkNumber: '1184', failureReason: 'Insufficient funds' }
    const only = { paymentsByJob: { j1: [paid(7420)] }, bank: [back] }
    const printing = run([rel('r1', 'j1', 'a1')], only)
    expect(printing.lines.print[0]).toMatchObject({ heldKind: 'came_back' })
    expect(plainSentence(printing.lines.print[0]!.held ?? '')).toBe('Held. The check behind it came back.')
    expect(printing.print).toMatchObject({ button: 'Print ▸', dead: true })
    expect(run([rel('r1', 'j1', 'a1', { more: { printedForNotary: WHO, notarizedYmd: '2026-11-28' } })], only).lines.county[0]!.heldKind).toBe('came_back')
    // The county's record stands: the copies are not held.
    expect(run([rel('r1', 'j1', 'a1', { filed_at: '2026-11-30' })], only).lines.copies[0]!.held).toBeNull()
  })

  it('says a mix of held reasons as held', () => {
    const back: BankCheck = { id: 'b1', amount: 7420, status: 'failed', depositedYmd: '2026-11-10', postedYmd: '2026-11-11', bankDayYmd: '2026-11-18', checkNumber: '1184', failureReason: 'Insufficient funds' }
    const r = run([rel('r1', 'j1', 'a1'), rel('r2', 'j2', 'a2'), rel('r3', 'j3', 'a3')], { openByJob: { j1: 0, j2: 5160.5, j3: 0 }, paymentsByJob: { j1: [paid(7420)], j3: [{ ...paid(900), payment_type: 'Cash', reference_number: null }] }, bank: [back] })
    expect(r.print.button).toBe('Print 1 release for the notary · 2 are held ▸')
  })

  it('keeps every sentence to plain words', () => {
    const r = run([rel('r1', 'j1', 'a1'), rel('r2', 'j2', 'a2', { more: { printedForNotary: WHO } }), rel('r3', 'j3', 'a3', { filed_at: '2026-11-30' })], { openByJob: { j1: 3, j2: 0, j3: 0 } })
    for (const l of [...r.lines.print, ...r.lines.notary, ...r.lines.copies]) for (const s of [l.held ?? '', l.note]) expect(plainWordsFailures(plainSentence(s))).toEqual([])
    for (const s of [RELEASE_RUN_WORDS.lead, ...Object.values(RELEASE_RUN_WORDS.stageLead), RELEASE_RUN_WORDS.futureDay, RELEASE_RUN_WORDS.beforeMade, RELEASE_RUN_WORDS.beforeRecorded, RELEASE_RUN_WORDS.popup, RELEASE_RUN_WORDS.kept, RELEASE_RUN_WORDS.failed]) expect(plainWordsFailures(s)).toEqual([])
  })
})

describe('the two days typed in place', () => {
  it('refuses a notary’s day still to come, or before the release was made', () => {
    expect(notarizedDayCheck('2026-12-02', '2026-11-25', TODAY)).toBe(RELEASE_RUN_WORDS.futureDay)
    expect(notarizedDayCheck('2026-11-24', '2026-11-25', TODAY)).toBe(RELEASE_RUN_WORDS.beforeMade)
    expect(notarizedDayCheck('2026-11-25', '2026-11-25', TODAY)).toBeNull()
    expect(notarizedDayCheck('', '2026-11-25', TODAY)).toBeNull()
  })

  it('refuses a copies day still to come, or before the county recorded the release', () => {
    expect(copiesDayCheck('2026-12-02', '2026-11-30', TODAY)).toBe(RELEASE_RUN_WORDS.futureDay)
    expect(copiesDayCheck('2026-11-29', '2026-11-30', TODAY)).toBe(RELEASE_RUN_WORDS.beforeRecorded)
    expect(copiesDayCheck('2026-11-30', '2026-11-30', TODAY)).toBeNull()
  })
})
