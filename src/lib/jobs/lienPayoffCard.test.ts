import { describe, expect, it } from 'vitest'
import { plainSentence } from '../valuesInPlace'
import { plainWordsFailures } from '../plainWords'
import type { BankCheck } from './checkCleared'
import { lienPayoffPlaces, type LienPayoffFacts, type LienPayoffRow } from './lienPayoff'
import { FUNDS_CONFIRM_ROLES, PAYOFF_CARD_WORDS, canConfirmFunds, lienPayoffCard, releaseDue, releaseDueWords } from './lienPayoffCard'

// Every name, address, job, instrument, check and amount here is made up.
const TODAY = '2026-11-24'
const FUNDS = { by: 'u1', name: 'Alex Rivera', at: '2026-11-26T15:04:00Z', note: 'the funds are good' }
/** The bank's deposit of check 1184 for the two liens, deposited Nov 24, the bank's day Dec 2. */
const AT_BANK: BankCheck = { id: 'b1', amount: 12580.5, status: 'pending', depositedYmd: '2026-11-24', postedYmd: null, bankDayYmd: '2026-12-02', checkNumber: '1184', failureReason: null }
const CLEARED: BankCheck = { ...AT_BANK, status: 'sent', depositedYmd: '2026-11-14', postedYmd: '2026-11-15', bankDayYmd: '2026-11-21' }
const CAME_BACK: BankCheck = { ...AT_BANK, status: 'failed', postedYmd: '2026-11-25', failureReason: 'Insufficient funds' }
const paid = (amount: number) => ({ amount, paid_on: '2026-11-24', payment_type: 'Check', reference_number: '1184' })
const jobs = [
  { id: 'j1', hcp_number: null, click_number: '2041', job_name: 'Okafor main house', job_address: '212 Larkspur Court, Austin, TX', customer_id: 'c1', customer_name: 'Marisol Okafor' },
  { id: 'j2', hcp_number: null, click_number: '2058', job_name: 'Okafor service visit', job_address: '212 Larkspur Ct Austin TX', customer_id: 'c1', customer_name: 'Marisol Okafor' },
]
const facts = (over: Partial<LienPayoffFacts> = {}): LienPayoffFacts => ({
  affidavits: [
    { id: 'a1', job_id: 'j1', amount: 7420, county: 'Travis', recording_number: '2026-0412207', filed_at: '2026-11-09', fields: {} },
    { id: 'a2', job_id: 'j2', amount: 5160.5, county: 'Travis', recording_number: '2026-0412208', filed_at: '2026-11-09', fields: {} },
  ],
  releases: [],
  jobs,
  openByJob: { j1: 7420, j2: 5160.5 },
  paymentsByJob: {},
  bank: [],
  todayYmd: TODAY,
  ...over,
})
const rows = (over: Partial<LienPayoffFacts> = {}): LienPayoffRow[] => lienPayoffPlaces(facts(over))[0]!.rows
const card = (over: Partial<LienPayoffFacts> = {}, today = TODAY) => lienPayoffCard(rows({ ...over, todayYmd: today }), today)
const states = (c: ReturnType<typeof lienPayoffCard>) => c.stops.map((s) => s.state)
const says = (c: ReturnType<typeof lienPayoffCard>) => c.stops.map((s) => plainSentence(s.say))
const bothPaid = { openByJob: { j1: 0, j2: 0 }, paymentsByJob: { j1: [paid(7420)], j2: [paid(5160.5)] } }

describe('lienPayoffCard, the five stops', () => {
  it('asks for the money first, with the sum still open, and every later stop waits', () => {
    const c = card()
    expect(states(c)).toEqual(['now', 'later', 'later', 'later', 'later'])
    expect(says(c)).toEqual(['$12,580.50 is still open on the liens’ bills.', 'After the money is recorded.', 'After the money is recorded.', 'After the notary.', 'After recording.'])
    expect(plainSentence(c.line)).toBe('$12,580.50 is still open here. Record it on each bill, or type one check.')
    expect(c.tone).toBe('plain')
    expect(c.offerFunds).toBe(false)
    expect(c.due).toBeNull()
  })

  it('counts the liens still owing when one is paid', () => {
    const c = card({ openByJob: { j1: 0, j2: 5160.5 }, paymentsByJob: { j1: [paid(7420)] }, bank: [CLEARED] })
    expect(c.stops[0]!.state).toBe('now')
    expect(plainSentence(c.stops[0]!.say)).toBe('$5,160.50 is still open on 1 of 2 liens’ bills.')
  })

  it('waits for the bank with its day, says nothing is owed today, and offers the funds press', () => {
    const c = card({ ...bothPaid, bank: [AT_BANK] })
    expect(states(c)).toEqual(['done', 'now', 'later', 'later', 'later'])
    expect(says(c)).toEqual(['Paid Nov 24 by check 1184.', 'The bank says Dec 2.', 'After the check clears.', 'After the notary.', 'After recording.'])
    expect(plainSentence(c.line)).toBe('Nothing to do today. The releases wait for the check to clear, about Dec 2.')
    expect(c.clearsYmd).toBe('2026-12-02')
    expect(c.cleared).toBe(false)
    expect(c.offerFunds).toBe(true)
    expect(c.fundsRows.map((r) => r.affidavitId)).toEqual(['a1', 'a2'])
    expect(c.askedRows.map((r) => r.affidavitId)).toEqual(['a1', 'a2'])
  })

  it('names the seven-day rule when the bank shows no deposit, and the bank’s late day', () => {
    expect(plainSentence(card(bothPaid).stops[1]!.say)).toBe('About Dec 1, seven days after the check.')
    const late = card({ ...bothPaid, bank: [AT_BANK] }, '2026-12-03')
    expect(late.stops[1]!.state).toBe('now')
    expect(plainSentence(late.stops[1]!.say)).toBe('The bank said Dec 2. It is not posted yet.')
  })

  it('reads the due day off the written request, beside the clearing day, and turns red once it has passed', () => {
    const asked = { affidavits: facts().affidavits.map((a) => ({ ...a, fields: { releaseAskedYmd: '2026-11-24' } })) }
    const c = card({ ...bothPaid, ...asked, bank: [AT_BANK] }, '2026-11-26')
    expect(c.askedYmd).toBe('2026-11-24')
    expect(c.due).toEqual({ askedYmd: '2026-11-24', dueYmd: '2026-12-04', daysLeft: 8 })
    expect(plainSentence(c.line)).toBe('Nothing to do today. The releases wait for the check to clear, about Dec 2. The releases are due Dec 4. That leaves 8 days.')
    const late = card({ ...bothPaid, ...asked, bank: [AT_BANK] }, '2026-12-06')
    expect(late.due?.daysLeft).toBe(-2)
    expect(late.tone).toBe('red')
    expect(plainSentence(late.line)).toBe('The releases wait for the check to clear, about Dec 2. The releases were due Dec 4. That was 2 days ago.')
  })

  it('moves the second stop to done on a confirmation of the funds, with no press left to offer', () => {
    const confirmed = { affidavits: facts().affidavits.map((a) => ({ ...a, fields: { fundsConfirmed: FUNDS } })) }
    const c = card({ ...bothPaid, ...confirmed, bank: [AT_BANK] })
    expect(states(c)).toEqual(['done', 'done', 'now', 'later', 'later'])
    expect(plainSentence(c.stops[1]!.say)).toBe('Alex Rivera confirmed the funds Nov 26.')
    expect(plainSentence(c.stops[2]!.say)).toBe('2 to make.')
    expect(plainSentence(c.line)).toBe('Make 2 releases. Press Make the release on each lien.')
    expect(c.cleared).toBe(true)
    expect(c.funds).toEqual(FUNDS)
    expect(c.offerFunds).toBe(false)
  })

  it('reads a cleared check, then the releases made, then the county, then the copies', () => {
    const cleared = card({ ...bothPaid, bank: [CLEARED] })
    expect(states(cleared)).toEqual(['done', 'done', 'now', 'later', 'later'])
    expect(plainSentence(cleared.stops[1]!.say)).toBe('Cleared Nov 21.')
    expect(cleared.tone).toBe('amber')

    const oneMade = card({ ...bothPaid, bank: [CLEARED], releases: [{ id: 'r1', job_id: 'j1', created_at: '2026-11-24T18:00:00Z', filed_at: null, recording_number: '2026-0412207', fields: { releasesFilingId: 'a1' } }] })
    expect(states(oneMade)).toEqual(['done', 'done', 'now', 'now', 'later'])
    expect(plainSentence(oneMade.stops[2]!.say)).toBe('1 made, 1 to make.')
    expect(plainSentence(oneMade.stops[3]!.say)).toBe('1 to record, after the notary.')

    const bothMade = card({
      ...bothPaid,
      bank: [CLEARED],
      releases: [
        { id: 'r1', job_id: 'j1', created_at: '2026-11-24T18:00:00Z', filed_at: null, recording_number: '2026-0412207', fields: { releasesFilingId: 'a1' } },
        { id: 'r2', job_id: 'j2', created_at: '2026-11-24T18:00:00Z', filed_at: '2026-12-03', recording_number: '2026-0412208', fields: { releasesFilingId: 'a2', releaseInstrument: '2026-0431955' } },
      ],
    })
    expect(states(bothMade)).toEqual(['done', 'done', 'done', 'now', 'later'])
    expect(plainSentence(bothMade.stops[2]!.say)).toBe('All 2 made.')
    expect(plainSentence(bothMade.stops[3]!.say)).toBe('1 recorded, 1 to record.')
    expect(plainSentence(bothMade.line)).toBe('Sign 1 release before a notary. Then record it at the county.')

    const recorded = card({
      ...bothPaid,
      bank: [CLEARED],
      releases: [
        { id: 'r1', job_id: 'j1', created_at: '2026-11-24T18:00:00Z', filed_at: '2026-12-03', recording_number: '2026-0412207', fields: { releasesFilingId: 'a1' } },
        { id: 'r2', job_id: 'j2', created_at: '2026-11-24T18:00:00Z', filed_at: '2026-12-04', recording_number: '2026-0412208', fields: { releasesFilingId: 'a2' } },
      ],
    })
    expect(states(recorded)).toEqual(['done', 'done', 'done', 'done', 'now'])
    expect(plainSentence(recorded.stops[3]!.say)).toBe('Recorded Dec 4.')
    expect(plainSentence(recorded.line)).toBe('Every lien here is released. Send the stamped copies to the payer.')
    expect(recorded.tone).toBe('green')
    expect(recorded.due).toBeNull()
  })

  it('turns red when the check came back, and holds the releases', () => {
    const c = card({ ...bothPaid, bank: [CAME_BACK] }, '2026-11-26')
    expect(states(c)).toEqual(['done', 'bad', 'bad', 'later', 'later'])
    expect(says(c).slice(1, 3)).toEqual(['The check came back.', 'Held. The check came back.'])
    expect(plainSentence(c.line)).toBe('The check came back. Open the bills and take the payments off.')
    expect(c.tone).toBe('red')
    expect(c.offerFunds).toBe(false)
  })

  it('does not offer the funds press on a check the bank could not read', () => {
    const c = card({ ...bothPaid, bank: [{ ...AT_BANK, status: 'failed', failureReason: null }] })
    expect(c.stops[1]!.state).toBe('bad')
    expect(plainSentence(c.stops[1]!.say)).toBe('The bank could not read the check. Deposit it again.')
    expect(c.offerFunds).toBe(false)
  })

  it('keeps every sentence to plain words', () => {
    const cards = [card(), card({ ...bothPaid, bank: [AT_BANK] }), card({ ...bothPaid, bank: [CAME_BACK] }), card(bothPaid), card({ ...bothPaid, bank: [CLEARED] }, '2026-12-06')]
    for (const c of cards) {
      for (const s of c.stops) expect(plainWordsFailures(plainSentence(s.say))).toEqual([])
      expect(plainWordsFailures(plainSentence(c.line))).toEqual([])
    }
    for (const words of Object.values(PAYOFF_CARD_WORDS)) if (typeof words === 'string' && /\.$/.test(words)) expect(plainWordsFailures(words)).toEqual([])
  })
})

describe('the due day', () => {
  it('is ten days after the written request, and counts the days left', () => {
    expect(releaseDue('2026-11-24', '2026-11-26')).toEqual({ askedYmd: '2026-11-24', dueYmd: '2026-12-04', daysLeft: 8 })
    expect(releaseDue('', TODAY)).toBeNull()
    expect(releaseDue('Nov 24', TODAY)).toBeNull()
  })

  it('says it in plain words for one release or several, today, and past', () => {
    expect(plainSentence(releaseDueWords({ askedYmd: '2026-11-24', dueYmd: '2026-12-04', daysLeft: 1 }, 1))).toBe('The release is due Dec 4. That leaves 1 day.')
    expect(plainSentence(releaseDueWords({ askedYmd: '2026-11-24', dueYmd: '2026-12-04', daysLeft: 0 }, 3))).toBe('The releases are due today.')
    expect(plainSentence(releaseDueWords({ askedYmd: '2026-11-24', dueYmd: '2026-12-04', daysLeft: -1 }, 1))).toBe('The release was due Dec 4. That was 1 day ago.')
  })
})

describe('who may confirm the funds', () => {
  it('is a leader, a controller or a dev, the owner’s answer of 2026-11-25', () => {
    expect([...FUNDS_CONFIRM_ROLES].sort()).toEqual(['controller', 'dev', 'master_technician'])
    expect(canConfirmFunds('master_technician')).toBe(true)
    expect(canConfirmFunds('controller')).toBe(true)
    expect(canConfirmFunds('dev')).toBe(true)
    expect(canConfirmFunds('assistant')).toBe(false)
    expect(canConfirmFunds(null)).toBe(false)
  })
})
