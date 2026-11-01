import { describe, expect, it } from 'vitest'
import {
  COURTESY_BUTTON,
  COURTESY_FROM_DAY,
  courtesyCounts,
  courtesyEmailText,
  courtesyFooterSentence,
  courtesyGreeting,
  courtesyIsDue,
  courtesyOutcomeWords,
  courtesyOwnerSubject,
  courtesyPayLine,
  courtesyPlan,
  courtesyRecordWords,
  courtesySendButton,
  courtesyStatus,
  courtesySubject,
  courtesyTextBody,
  parseCourtesyRecords,
  withCourtesyRecord,
  type CourtesyFacts,
  type CourtesyRecord,
} from './lienCourtesyNotice'
import type { LetterTwoStatus } from './lienLetterTwo'

const TODAY = '2026-11-02'

function letterTwo(partial: Partial<LetterTwoStatus> = {}): LetterTwoStatus {
  return { state: 'waiting', day: 9, clock: { kind: 'recorded', at: '2026-10-24T15:00:00Z', why: '' }, firstItemId: 'first', firstSentAt: '2026-10-24T15:00:00Z', letterTwo: null, gcAuthorized: null, words: 'day 9', ...partial }
}

const affidavit = { deadline: '2026-11-16', filedAt: null, homestead: false, hasWorkMonth: true }

const record: CourtesyRecord = {
  at: '2026-10-31T14:00:00Z',
  by: 'Grace',
  lienDay: '2026-11-16',
  claim: 4850,
  to: [
    { who: 'original_contractor', name: 'Dana Ortiz', channel: 'email', address: 'dortiz@ridgeway.example', ok: true, id: 'em_1', reason: '' },
    { who: 'original_contractor', name: 'Dana Ortiz', channel: 'text', address: '(512) 555-0193', ok: true, id: 'ln_1', reason: '' },
    { who: 'owner', name: 'Cibolo Crossing Ltd', channel: 'email', address: 'office@cibolo.example', ok: true, id: 'em_2', reason: '' },
  ],
}

const facts: CourtesyFacts = {
  jobNumber: '741',
  jobName: 'Riverbend Dental',
  propertyAddress: '2200 Riverbend Dr, Austin, TX 78704',
  county: 'Travis',
  gcName: 'Ridgeway Builders',
  claimantName: 'Click Plumbing and Electrical',
  claim: 4850,
  monthsWords: 'August 2026',
  noticeSentOn: '2026-10-14',
  lienDay: '2026-11-16',
  payLinks: [{ address: 'clicktooling.com/pay/8f3a', amount: 4850 }],
  contactPerson: 'R. Douglas, Master Plumber',
  phone: '(512) 555-0147',
}

describe('the courtesy notice — where it stands on a sent notice', () => {
  it('is nothing with nothing out, waits before day 7, and is due from day 7', () => {
    expect(courtesyStatus({ letterTwo: null, records: [], openBalance: 4850, todayYmd: TODAY, affidavit }).state).toBe('none')
    expect(courtesyStatus({ letterTwo: letterTwo({ state: 'none', firstSentAt: null }), records: [], openBalance: 4850, todayYmd: TODAY, affidavit }).state).toBe('none')
    const early = courtesyStatus({ letterTwo: letterTwo({ day: 4 }), records: [], openBalance: 4850, todayYmd: TODAY, affidavit })
    expect(early).toMatchObject({ state: 'waiting', day: 4, words: `day 4 · courtesy from day ${COURTESY_FROM_DAY}`, lienDay: '2026-11-16' })
    const due = courtesyStatus({ letterTwo: letterTwo({ day: 9 }), records: [], openBalance: 4850, todayYmd: TODAY, affidavit })
    expect(due).toMatchObject({ state: 'due', day: 9, words: 'day 9 · nothing since the packet' })
    expect(courtesyIsDue(due)).toBe(true)
    expect(courtesyIsDue(early)).toBe(false)
    expect(COURTESY_BUTTON).toBe('Send a courtesy notice')
  })

  it('closes on a payment, the GC’s written okay, the owner’s call, the filed affidavit or a reply', () => {
    expect(courtesyStatus({ letterTwo: letterTwo(), records: [], openBalance: 0, todayYmd: TODAY, affidavit })).toMatchObject({ state: 'closed', reason: 'paid' })
    expect(courtesyStatus({ letterTwo: letterTwo({ state: 'gc_authorized', gcAuthorized: { at: '2026-10-30T12:00:00Z', name: 'Taunya', note: 'email' } }), records: [], openBalance: 4850, todayYmd: TODAY, affidavit, formatDay: (d) => d })).toMatchObject({ state: 'closed', reason: 'the GC authorized direct pay 2026-10-30' })
    expect(courtesyStatus({ letterTwo: letterTwo({ state: 'owner_called', words: 'owner called Oct 30' }), records: [], openBalance: 4850, todayYmd: TODAY, affidavit })).toMatchObject({ state: 'closed', reason: 'owner called Oct 30' })
    expect(courtesyStatus({ letterTwo: letterTwo(), records: [], openBalance: 4850, todayYmd: TODAY, affidavit: { ...affidavit, filedAt: '2026-11-01' } })).toMatchObject({ state: 'closed', reason: 'the affidavit is filed · served next' })
    const replied = courtesyStatus({ letterTwo: letterTwo({ day: 16 }), records: [record], openBalance: 4850, todayYmd: TODAY, affidavit, repliedAt: '2026-11-01T09:00:00Z', formatDay: (d) => d })
    expect(replied).toMatchObject({ state: 'closed', reason: 'they answered 2026-11-01' })
    // A reply before the send does not close it.
    expect(courtesyStatus({ letterTwo: letterTwo({ day: 16 }), records: [record], openBalance: 4850, todayYmd: TODAY, affidavit, repliedAt: '2026-10-20T09:00:00Z' }).state).toBe('sent')
  })

  it('is held when the lien cannot go on, with the demand letter’s reason, and when the affidavit is inside a week', () => {
    const homestead = courtesyStatus({ letterTwo: letterTwo(), records: [], openBalance: 4850, todayYmd: TODAY, affidavit: { ...affidavit, homestead: true } })
    expect(homestead.state).toBe('held')
    expect(homestead.reason).toMatch(/homestead/)
    expect(homestead.words.startsWith('Courtesy held · ')).toBe(true)
    const closedWindow = courtesyStatus({ letterTwo: letterTwo(), records: [], openBalance: 4850, todayYmd: TODAY, affidavit: { ...affidavit, deadline: '2026-10-15' } })
    expect(closedWindow).toMatchObject({ state: 'held', reason: 'the filing window closed October 15, 2026' })
    expect(courtesyStatus({ letterTwo: letterTwo(), records: [], openBalance: 4850, todayYmd: TODAY, affidavit: null })).toMatchObject({ state: 'held', reason: 'no approved work month on the job yet — the filing window cannot be computed' })
    expect(courtesyStatus({ letterTwo: letterTwo(), records: [], openBalance: 4850, todayYmd: TODAY, affidavit: { ...affidavit, deadline: '' } })).toMatchObject({ state: 'held', reason: 'no filing window on record' })
    const near = courtesyStatus({ letterTwo: letterTwo({ day: 20 }), records: [], openBalance: 4850, todayYmd: '2026-11-12', affidavit, formatDay: (d) => d })
    expect(near).toMatchObject({ state: 'held', reason: 'the affidavit is due 2026-11-16 · file it instead' })
  })

  it('reads sent inside a week of the last press, then due again with the send named', () => {
    const sent = courtesyStatus({ letterTwo: letterTwo({ day: 9 }), records: [record], openBalance: 4850, todayYmd: TODAY, affidavit, formatDay: (d) => d })
    expect(sent).toMatchObject({ state: 'sent', words: 'courtesy sent 2026-10-31 by email and text', lastSentAt: '2026-10-31T14:00:00Z' })
    const again = courtesyStatus({ letterTwo: letterTwo({ day: 16 }), records: [record], openBalance: 4850, todayYmd: '2026-11-09', affidavit, formatDay: (d) => d })
    expect(again).toMatchObject({ state: 'due', words: 'day 16 · courtesy sent 2026-10-31 by email and text · nothing since' })
    const emailOnly: CourtesyRecord = { ...record, to: record.to.filter((t) => t.channel === 'email') }
    expect(courtesyStatus({ letterTwo: letterTwo(), records: [emailOnly], openBalance: 4850, todayYmd: TODAY, affidavit }).words).toMatch(/by email$/)
  })

  it('writes the footer’s sentence for each state', () => {
    const due = courtesyStatus({ letterTwo: letterTwo(), records: [], openBalance: 4850, todayYmd: TODAY, affidavit })
    expect(courtesyFooterSentence(due, '$4,850.00')).toBe('Nothing has come since the packet. A courtesy notice goes by email and text in a minute: the notice stands, the lien goes on by Nov 16 unless $4,850.00 is paid, the pay link, your number. Letter two is counsel\'s certified second letter, from day 10.')
    const held = courtesyStatus({ letterTwo: letterTwo(), records: [], openBalance: 4850, todayYmd: TODAY, affidavit: { ...affidavit, homestead: true } })
    expect(courtesyFooterSentence(held, '$4,850.00')).toMatch(/^Courtesy notice held: the property is a homestead/)
    expect(courtesyFooterSentence(held, '$4,850.00')).toMatch(/may not name a lien that cannot go on\.$/)
    const closed = courtesyStatus({ letterTwo: letterTwo(), records: [], openBalance: 0, todayYmd: TODAY, affidavit })
    expect(courtesyFooterSentence(closed, '$0.00')).toBe('Courtesy notice: paid.')
    const sent = courtesyStatus({ letterTwo: letterTwo(), records: [record], openBalance: 4850, todayYmd: TODAY, affidavit })
    expect(courtesyFooterSentence(sent, '$4,850.00')).toMatch(/^Courtesy sent Oct 31 by email and text\. Another may go in 7 days/)
    const waiting = courtesyStatus({ letterTwo: letterTwo({ day: 3 }), records: [], openBalance: 4850, todayYmd: TODAY, affidavit })
    expect(courtesyFooterSentence(waiting, '$4,850.00')).toMatch(/^A courtesy notice may go from day 7/)
    expect(courtesyFooterSentence({ ...due, state: 'none' }, '')).toBe('')
  })
})

describe('the courtesy notice — who gets it', () => {
  it('plans each recipient’s two channels and says why one does not go', () => {
    const plans = courtesyPlan([
      { who: 'original_contractor', name: 'Dana Ortiz', email: 'dortiz@ridgeway.example', phone: '(512) 555-0193', textHold: '' },
      { who: 'owner', name: 'Cibolo Crossing Ltd', email: '', phone: '', textHold: '' },
    ])
    expect(plans[0]).toMatchObject({ email: { address: 'dortiz@ridgeway.example', goes: true }, text: { address: '(512) 555-0193', goes: true } })
    expect(plans[1]).toMatchObject({ email: { goes: false, reason: 'no email on the property record' }, text: { goes: false, reason: 'no number on the property record' } })
    expect(courtesyCounts(plans)).toEqual({ emails: 1, texts: 1 })
    const held = courtesyPlan([{ who: 'original_contractor', name: 'Dana', email: 'not-an-address', phone: '(512) 555-0193', textHold: 'Texts wait until Send texts is switched on.' }])[0]!
    expect(held.email).toMatchObject({ goes: false, reason: 'not an email address' })
    expect(held.text).toMatchObject({ goes: false, reason: 'Texts wait until Send texts is switched on.' })
  })

  it('names the button with its count and is dead with nothing to send', () => {
    const plans = courtesyPlan([
      { who: 'original_contractor', name: 'Dana Ortiz', email: 'dortiz@ridgeway.example', phone: '(512) 555-0193', textHold: '' },
      { who: 'owner', name: 'Cibolo Crossing Ltd', email: 'office@cibolo.example', phone: '', textHold: '' },
    ])
    expect(courtesySendButton(plans)).toEqual({ label: 'Send 3 messages', dead: false, detail: '2 emails · 1 text' })
    expect(courtesySendButton(courtesyPlan([{ who: 'owner', name: 'X', email: '', phone: '', textHold: '' }]))).toMatchObject({ label: 'Send messages', dead: true })
  })
})

describe('the courtesy notice — the words', () => {
  it('greets a person by first name and a company by its name', () => {
    expect(courtesyGreeting('Dana Ortiz')).toBe('Dana,')
    expect(courtesyGreeting('Ridgeway Builders')).toBe('Ridgeway Builders,')
    expect(courtesyGreeting('Harlan Homes LLC')).toBe('Harlan Homes LLC,')
    expect(courtesyGreeting('')).toBe('Hello,')
  })

  it('the GC’s email names the notice as standing, the lien’s day, the pay link and the signer, and never a joint check', () => {
    const text = courtesyEmailText(facts, 'original_contractor', 'Dana,')
    expect(text.startsWith('Dana,\n\nOn October 14, 2026 we mailed you and the owner of 2200 Riverbend Dr, Austin, TX 78704 the Notice of Claim for Unpaid Labor or Materials (Tex. Prop. Code § 53.056) on job 741, Riverbend Dental: $4,850.00 for work in August 2026. That notice stands. This is a reminder, not a new notice.')).toBe(true)
    expect(text).toContain('we will file the lien affidavit in Travis County by November 16, 2026')
    expect(text).toContain('Pay it here: clicktooling.com/pay/8f3a')
    expect(text).toContain('We cannot deposit a joint check.')
    expect(text).toContain('reply to this email or call and tell us.')
    expect(text.endsWith('R. Douglas, Master Plumber · (512) 555-0147\nClick Plumbing and Electrical · Job 741')).toBe(true)
    for (const never of ['interest', 'fee', 'default', 'theft', 'the law makes', 'other jobs']) expect(text.toLowerCase()).not.toContain(never)
    expect(courtesySubject(facts)).toBe('Before we file: Riverbend Dental, $4,850.00 — paid by Nov 16, no lien')
  })

  it('the owner’s copy keeps the pay page’s owner rule and says nothing is billed to them', () => {
    const text = courtesyEmailText(facts, 'owner', '')
    expect(text.startsWith('To the owner of 2200 Riverbend Dr, Austin, TX 78704,')).toBe(true)
    expect(text).toContain('Ridgeway Builders has not paid us $4,850.00 for work in August 2026. That notice stands. This is a reminder, not a new notice. You did not hire us, and nothing here is billed to you.')
    expect(text).toContain('Please pay us only if Ridgeway Builders has told you in writing that you may pay us directly. Otherwise hold $4,850.00 back from your next payment to Ridgeway Builders, as the cover letter asked, and call us so we know it is held. We cannot deposit a joint check.')
    expect(text).not.toContain('clicktooling.com/pay')
    expect(courtesyOwnerSubject(facts)).toBe('A reminder on the notice we mailed Oct 14 · 2200 Riverbend Dr, Austin, TX 78704')
  })

  it('the pay line: one link, several, or none', () => {
    expect(courtesyPayLine({ payLinks: [], claimantName: 'Click' })).toBe('Pay by check or wire payable only to Click. We cannot deposit a joint check.')
    expect(courtesyPayLine(facts)).toMatch(/^Pay it here: clicktooling\.com\/pay\/8f3a \(card or bank transfer/)
    const two = courtesyPayLine({ payLinks: [{ address: 'a/1', amount: 1000 }, { address: 'a/2', amount: 250.5 }], claimantName: 'Click' })
    expect(two).toBe('Pay here, one page per bill: a/1 ($1,000.00), a/2 ($250.50). Each page takes card or bank transfer and says so once it is paid. Or a check or wire payable only to Click. We cannot deposit a joint check.')
  })

  it('a live pay offer is repeated in its own sentence', () => {
    const withOffer = courtesyEmailText({ ...facts, offer: { pct: 10, by: '2026-11-10' } }, 'original_contractor', 'Dana,')
    expect(withOffer).toContain('Pay any of these bills in full by November 10, 2026 and it is 10% less.')
    expect(courtesyEmailText(facts, 'original_contractor', 'Dana,')).not.toContain('% less')
  })

  it('the text is short and carries the first pay link, and the owner’s text carries the rule instead', () => {
    const gc = courtesyTextBody(facts, 'original_contractor')
    expect(gc).toBe('Click Plumbing and Electrical: on Oct 14 we mailed you and the owner the notice of claim on Riverbend Dental (job 741), $4,850.00 for August 2026. Nothing has come. Unless it is paid, the lien affidavit is filed by Nov 16. Pay here: clicktooling.com/pay/8f3a Questions: R. Douglas, Master Plumber (512) 555-0147. This is a reminder, not a new notice.')
    expect(gc.length).toBeLessThan(400)
    const owner = courtesyTextBody(facts, 'owner')
    expect(owner).toContain("Pay us only with Ridgeway Builders's written okay; otherwise hold it back and call.")
    expect(owner).not.toContain('clicktooling.com/pay')
    expect(courtesyTextBody({ ...facts, payLinks: [] }, 'original_contractor')).toContain('Pay by check or wire payable only to Click Plumbing and Electrical.')
  })
})

describe('the courtesy notice — the record', () => {
  it('parses what the item keeps, drops the malformed, and sorts oldest first', () => {
    const raw = [
      { at: '2026-11-05T10:00:00Z', by: 'Grace', lienDay: '2026-11-16', claim: 4850, to: [{ who: 'owner', channel: 'email', address: 'o@x.example', ok: false, reason: 'bounced' }, { who: 'nobody', channel: 'email' }] },
      { at: '2026-10-31T14:00:00Z', by: 'Grace', lienDay: 'soon', claim: 'lots', to: 'none' },
      { by: 'no at' },
      null,
    ]
    const records = parseCourtesyRecords(raw)
    expect(records.map((r) => r.at)).toEqual(['2026-10-31T14:00:00Z', '2026-11-05T10:00:00Z'])
    expect(records[0]).toMatchObject({ lienDay: '', claim: 0, to: [] })
    expect(records[1]!.to).toEqual([{ who: 'owner', name: '', channel: 'email', address: 'o@x.example', ok: false, id: null, reason: 'bounced' }])
    expect(parseCourtesyRecords(undefined)).toEqual([])
  })

  it('adds a record to the fields and keeps the rest', () => {
    const fields = withCourtesyRecord({ notice: { claimAmount: '4850' }, courtesy: [record] }, { ...record, at: '2026-11-08T10:00:00Z' })
    expect(fields.notice).toEqual({ claimAmount: '4850' })
    expect(parseCourtesyRecords(fields.courtesy).map((r) => r.at)).toEqual(['2026-10-31T14:00:00Z', '2026-11-08T10:00:00Z'])
    expect(parseCourtesyRecords(withCourtesyRecord(null, record).courtesy)).toHaveLength(1)
  })

  it('says the record and the outcome in words', () => {
    expect(courtesyRecordWords(record, (d) => d)).toBe('sent 2026-10-31 by Grace · email to the GC and the owner, text to the GC · named 2026-11-16')
    const partly: CourtesyRecord = { ...record, to: [record.to[0]!, { ...record.to[1]!, ok: false, id: null, reason: 'they sent STOP' }] }
    expect(courtesyRecordWords(partly, (d) => d)).toBe('sent 2026-10-31 by Grace · email to the GC · named 2026-11-16 · not sent: text to the GC (they sent STOP)')
    expect(courtesyOutcomeWords(record.to)).toBe('3 messages went: email to the GC, text to the GC, email to the owner.')
    expect(courtesyOutcomeWords(partly.to)).toBe('1 message went: email to the GC. Not sent: text to the GC — they sent STOP.')
    expect(courtesyOutcomeWords([])).toBe('Nothing went.')
  })
})
