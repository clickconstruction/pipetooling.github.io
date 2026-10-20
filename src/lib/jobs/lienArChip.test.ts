import { describe, expect, it } from 'vitest'
import { lienArChipFor, lienArChipHref, lienArCustomerChip, lienArDaysWords, lienArLensCounts, lienArLensMatch, lienArMonthsPhrase, type LienArChip, type LienArJobInput } from './lienArChip'
import type { LienDeskEntry } from './lienDesk'
import type { LienNextUpRow } from './lienNextUp'
import type { JobLienFilingRow } from './lienDeadlines'
import type { LetterTwoStatus } from './lienLetterTwo'
import type { LienMailPieceRow } from '../mail/lienMailPieces'

const TODAY = '2026-10-13'

function entry(p: Partial<LienDeskEntry> = {}): LienDeskEntry {
  return {
    jobId: 'j273',
    customerId: 'c1',
    gcCustomerId: 'gc1',
    openBalance: 12520,
    hasOwner: true,
    propertyKind: 'residential',
    months: [
      { key: '2026-07', approvedHours: 40, deadline: '2026-09-15', daysLeft: -28, noticed: false, fromCreation: false },
      { key: '2026-08', approvedHours: 32, deadline: '2026-10-15', daysLeft: 2, noticed: false, fromCreation: false },
    ],
    datedFromCreation: false,
    dueMonths: ['2026-08'],
    missedMonths: ['2026-07'],
    missedUnrecorded: ['2026-07'],
    earliestDeadline: '2026-10-15',
    daysLeft: 2,
    severity: 'red',
    item: null,
    policy: 'ask',
    pile: 'awaiting',
    ...p,
  }
}

function row(p: Partial<LienNextUpRow> = {}): LienNextUpRow {
  return {
    key: 'notice:j273',
    kind: 'notice',
    jobId: 'j273',
    gcId: 'gc1',
    title: '273 · Dudley (Lennox)',
    sub: 'Waiting on Robert · since Oct 7',
    dueOn: '2026-10-15',
    daysLeft: 2,
    severity: 'red',
    group: 'now',
    action: 'approve',
    button: null,
    target: { open: 'notices', jobId: 'j273', pile: 'awaiting' },
    ...p,
  }
}

function filing(p: Partial<JobLienFilingRow> = {}): JobLienFilingRow {
  return {
    id: 'f1',
    job_id: 'j858',
    kind: 'notice_53_056',
    amount: 7902,
    county: 'Bexar',
    created_at: '2026-09-12T15:00:00Z',
    created_by: null,
    document_note: '',
    document_url: '',
    fields: {},
    filed_at: null,
    invoice_ids: [],
    months_covered: ['2026-08'],
    packet_id: 'p1',
    printed_claim: null,
    recording_number: '',
    sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9407 1118 9922 0341' }],
    serve_due: null,
    served_at: null,
    voided_at: null,
    by_hand: false,
    ...p,
  } as JobLienFilingRow
}

function piece(p: Partial<LienMailPieceRow> = {}): LienMailPieceRow {
  return { id: 'm1', kind: 'lien_notice', recipient: 'owner', status: 'delivered', usps_tracking: '9407', mailed_at: '2026-09-13T14:00:00Z', delivered_at: '2026-09-16T17:30:00Z', signed_by: 'R SMITH', delivery_status: null, source_ids: ['f1'], ...p }
}

function two(p: Partial<LetterTwoStatus> = {}): LetterTwoStatus {
  return { state: 'waiting', day: 5, clock: { kind: 'delivered', at: '2026-09-16T17:30:00Z', why: 'from the day it was delivered, Sep 16' }, firstItemId: 'i1', firstSentAt: '2026-09-12T15:00:00Z', letterTwo: null, gcAuthorized: null, words: 'day 5 · from delivery', ...p } as LetterTwoStatus
}

function input(p: Partial<LienArJobInput> = {}): LienArJobInput {
  return { jobId: 'j273', todayYmd: TODAY, nextUp: [], entry: null, affidavit: null, filings: [], piecesByFiling: {}, letterTwo: null, ...p }
}

describe('the AR row’s lien chip (v2.5488)', () => {
  it('shows nothing when nothing is out and nothing is due', () => {
    expect(lienArChipFor(input())).toBeNull()
    expect(lienArDaysWords(null)).toBe('')
    expect(lienArDaysWords(2)).toBe('2d')
    expect(lienArDaysWords(0)).toBe('today')
    expect(lienArDaysWords(-3)).toBe('3d late')
  })

  it('a notice waiting on the leader: the chip names him and the day, the sentence names the month and the miss, the door is the desk’s pile', () => {
    const chip = lienArChipFor(input({ nextUp: [row()], entry: entry() }))!
    expect(chip.tone).toBe('red')
    expect(chip.state).toBe('due')
    expect(chip.words).toBe('Waiting on Robert · by Oct 15 · 2d')
    expect(chip.sentence).toBe('August’s § 53.056 notice · Waiting on Robert · since Oct 7')
    expect(chip.door).toEqual({ to: 'desk', jobId: 'j273', kind: 'notice', pile: 'awaiting' })
    expect(lienArChipHref(chip.door)).toBe('/jobs?tab=stages&liendesk=1&liendeskJob=j273&kind=notice&liendeskPile=awaiting')
    // The leader’s own row says approve.
    expect(lienArChipFor(input({ nextUp: [row({ sub: 'Waiting on your approval' })], entry: entry() }))!.words).toBe('Approve the notice · by Oct 15 · 2d')
  })

  it('the other moves read in the desk’s words, amber beyond a week and red inside it', () => {
    const e = entry({ pile: 'needs_owner', severity: 'amber', daysLeft: 12, earliestDeadline: '2026-10-25' })
    const owner = lienArChipFor(input({ nextUp: [row({ sub: 'Needs the owner of record', action: 'find_owner', severity: 'amber', dueOn: '2026-10-25', daysLeft: 12, group: 'coming', target: { open: 'notices', jobId: 'j273', pile: 'needs_owner' } })], entry: e }))!
    expect(owner.words).toBe('Needs the owner · by Oct 25 · 12d')
    expect(owner.tone).toBe('amber')
    const draft = lienArChipFor(input({ nextUp: [row({ sub: 'Notice to draft', action: 'draft' })], entry: entry({ pile: 'to_draft' }) }))!
    expect(draft.words).toBe('Notice to draft · by Oct 15 · 2d')
    expect(draft.tone).toBe('red')
    const held = lienArChipFor(input({ nextUp: [row({ sub: 'Held', action: 'review_hold', severity: 'quiet', group: 'coming' })], entry: entry({ pile: 'held', item: { hold_reason: 'promised', hold_until: '2026-10-12' } as never }) }))!
    expect(held.words).toBe('Held · they promised · asks again Oct 12')
    expect(held.tone).toBe('amber')
    const printed = lienArChipFor(input({ nextUp: [row({ sub: 'In the mail · tracking owed', action: 'add_tracking', target: { open: 'notices', jobId: 'j273', pile: 'printed' } })], entry: entry({ pile: 'printed', item: { printed_at: '2026-10-09T16:00:00Z' } as never }) }))!
    expect(printed).toMatchObject({ tone: 'blue', state: 'out', words: 'In the mail · tracking owed' })
    expect(printed.sentence).toContain('printed with the run Oct 9')
    const late = lienArChipFor(input({ nextUp: [row({ sub: 'Late notice to draft · the window closed, the affidavit is still open', action: 'draft_late', dueOn: '2026-11-16', daysLeft: 34, severity: 'amber', group: 'coming' })], entry: entry({ pile: 'missed', dueMonths: [] }) }))!
    expect(late.words).toBe('Late notice to draft · by Nov 16 · 34d')
    expect(late.tone).toBe('red')
  })

  it('a printed run names the job among several; a GC’s ready run is matched by the GC', () => {
    const run = row({ key: 'run:printed', jobId: null, gcId: null, action: 'record_mailing', sub: 'Mailed? Type each envelope’s number.', target: { open: 'run', gcId: null }, jobs: [{ jobId: 'j273', title: '273', dueOn: '2026-10-15' }, { jobId: 'j9', title: '9', dueOn: null }] })
    expect(lienArChipFor(input({ nextUp: [run], entry: entry({ pile: 'printed' }) }))!.door).toEqual({ to: 'desk', jobId: 'j273', kind: 'notice', pile: 'printed' })
    expect(lienArChipFor(input({ jobId: 'j8', nextUp: [run] }))).toBeNull()
    const ready = row({ key: 'run:gc1', jobId: null, action: 'send_run', sub: '2 notices approved · ready to send', target: { open: 'run', gcId: 'gc1' } })
    const chip = lienArChipFor(input({ nextUp: [ready], entry: entry({ pile: 'ready' }) }))!
    expect(chip.words).toBe('Approved · ready to send · by Oct 15 · 2d')
    expect(chip.door).toEqual({ to: 'desk', jobId: 'j273', kind: 'notice', pile: 'ready' })
    expect(lienArChipFor(input({ nextUp: [ready], entry: entry({ pile: 'ready', gcCustomerId: 'gc2' }) }))).toBeNull()
  })

  it('a window closed with nothing recorded is red and says which month; noted, it is muted', () => {
    const miss = row({ sub: 'A window closed with nothing recorded', action: 'note_missed', dueOn: null, daysLeft: null, target: { open: 'notices', jobId: 'j273', pile: 'missed' } })
    const chip = lienArChipFor(input({ nextUp: [miss], entry: entry({ pile: 'missed', dueMonths: [] }) }))!
    expect(chip).toMatchObject({ tone: 'red', state: 'gone', words: 'Window closed Sep 15 · lien gone' })
    expect(chip.sentence).toBe('July’s notice never went out · the window closed Sep 15 · the money is still owed, chase it in Collections · write the closed window down with your name')
    const noted = lienArChipFor(input({ entry: entry({ pile: 'missed', dueMonths: [], missedUnrecorded: [] }) }))!
    expect(noted).toMatchObject({ tone: 'muted', state: 'gone', words: 'Window closed Sep 15 · lien gone' })
    expect(noted.sentence.endsWith('· noted')).toBe(true)
  })

  it('a sent notice reads from its mail pieces, with letter two riding along', () => {
    const base = input({ jobId: 'j858', filings: [filing()], piecesByFiling: { f1: [piece()] } })
    const delivered = lienArChipFor({ ...base, letterTwo: two() })!
    expect(delivered).toMatchObject({ tone: 'green', state: 'out', paper: 'notice', words: 'Delivered Sep 16 · day 5' })
    expect(delivered.sentence).toBe('§ 53.056 notice for Aug 2026 sent Sep 12 by certified mail 9407 1118 9922 0341 · mailed through Docsmit · delivered Sep 16, signed R SMITH · day 5 · from delivery')
    expect(lienArMonthsPhrase(['2026-08', '2026-04', '2026-06', '2026-07'])).toBe('Apr, Jun, Jul and Aug 2026')
    expect(lienArMonthsPhrase(['2026-12', '2027-01'])).toBe('Dec 2026 and Jan 2027')
    expect(delivered.door).toEqual({ to: 'window', jobId: 'j858', tab: 'notice' })
    expect(lienArChipHref(delivered.door)).toBe('/jobs?tab=stages&lienwindow=j858&lientab=notice')
    expect(lienArChipFor({ ...base, piecesByFiling: { f1: [piece({ status: 'in_transit', delivered_at: null, signed_by: null })] } })!.words).toBe('Mailed Sep 13 · in transit')
    expect(lienArChipFor({ ...base, piecesByFiling: { f1: [piece({ status: 'returned' })] } })!).toMatchObject({ tone: 'red', words: 'Returned to sender' })
    expect(lienArChipFor({ ...base, piecesByFiling: { f1: [piece({ status: 'sent', delivered_at: null, mailed_at: null })] } })!).toMatchObject({ tone: 'blue', words: 'With Docsmit · number coming' })
    // Letter two due without Do now’s row: the clock still says it.
    const due = lienArChipFor({ ...base, letterTwo: two({ state: 'due', day: 12, words: 'day 12 · letter two · from delivery' }) })!
    expect(due).toMatchObject({ tone: 'amber', paper: 'letter_two', words: 'Delivered Sep 16 · day 12 · letter two' })
    expect(lienArChipFor({ ...base, letterTwo: two({ state: 'sent', letterTwo: { itemId: 'i2', kind: 'paid_out', status: 'sent', sentAt: '2026-10-01T15:00:00Z' } }) })!).toMatchObject({ tone: 'green', paper: 'letter_two', words: 'Letter two sent Oct 1' })
  })

  it('an envelope that came back or went unclaimed is the desk’s red row: the chip leads with the piece’s state, names who, and opens the notice under Sent', () => {
    const base = input({ jobId: 'j858', filings: [filing()], piecesByFiling: { f1: [piece({ status: 'returned' })] } })
    const back = row({ key: 'mail:m1', jobId: 'j858', gcId: null, sub: 'Docsmit · owner of record · returned to sender', dueOn: null, daysLeft: null, action: 'mail_needs_you', target: { open: 'notices', jobId: 'j858', pile: 'sent' } })
    const chip = lienArChipFor({ ...base, nextUp: [back] })!
    expect(chip).toMatchObject({ tone: 'red', state: 'due', paper: 'notice', words: 'Returned to sender · owner of record', dueOn: null })
    expect(chip.sentence).toBe('§ 53.056 notice for Aug 2026 sent Sep 12 by certified mail 9407 1118 9922 0341 · mailed through Docsmit · returned to sender · the envelope to the owner of record needs you · open the notice under Sent to send it again')
    expect(chip.door).toEqual({ to: 'desk', jobId: 'j858', kind: 'notice', pile: 'sent' })
    // Unclaimed: the pieces say amber on their own, but the desk wants a person now, so the chip stays red in the desk's words.
    const unclaimed = lienArChipFor({ ...base, piecesByFiling: { f1: [piece({ status: 'notice_left', delivered_at: null, signed_by: null })] }, nextUp: [row({ ...back, sub: 'Docsmit · original contractor · notice left, unclaimed so far' })] })!
    expect(unclaimed).toMatchObject({ tone: 'red', words: 'Notice left · unclaimed · original contractor' })
    // No pieces in hand (the row came from elsewhere): the desk's own words carry it.
    const bare = lienArChipFor({ ...base, piecesByFiling: {}, nextUp: [back] })!
    expect(bare.words).toBe('Returned to sender · owner of record')
    expect(bare.sentence).toBe('§ 53.056 notice for Aug 2026 sent Sep 12 by certified mail 9407 1118 9922 0341 · returned to sender · the envelope to the owner of record needs you · open the notice under Sent to send it again')
  })

  it('a sent notice with no pieces reads its sends: tracking owed is blue, a number is green, by hand says so', () => {
    const owed = lienArChipFor(input({ jobId: 'j858', filings: [filing({ sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '' }] })] }))!
    expect(owed).toMatchObject({ tone: 'blue', words: 'Sent Sep 12 · tracking owed' })
    const numbered = lienArChipFor(input({ jobId: 'j858', filings: [filing()] }))!
    expect(numbered).toMatchObject({ tone: 'green', words: 'Sent Sep 12' })
    expect(lienArChipFor(input({ jobId: 'j858', filings: [filing({ sends: [{ recipient: 'owner', method: 'hand', tracking: '' }] })] }))!.words).toBe('Sent Sep 12 · by hand')
    // A notice recorded after the fact (by hand) names its mailing day on the send, and the certified method it went by.
    const recorded = lienArChipFor(input({ jobId: 'j858', filings: [filing({ by_hand: true, created_at: '2026-10-06T20:00:00Z', sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9507 1066', sent_on: '2026-10-02' }] })] }))!
    expect(recorded.words).toBe('Sent Oct 2')
    expect(recorded.sentence).toBe('§ 53.056 notice for Aug 2026 sent Oct 2 by certified mail 9507 1066')
    // The desk item’s sent day stands in when the filings were not read.
    expect(lienArChipFor(input({ entry: entry({ pile: 'sent', item: { sent_at: '2026-09-12T15:00:00Z' } as never }) }))!.words).toBe('Sent Sep 12')
  })

  it('a filed lien and a release of record read from the filing; letter two’s row beats a sent notice', () => {
    const filed = lienArChipFor(input({ jobId: 'j867', filings: [filing({ id: 'a1', job_id: 'j867', kind: 'affidavit', filed_at: '2026-10-02', served_at: '2026-10-06', recording_number: '2026-0412' })] }))!
    expect(filed).toMatchObject({ tone: 'green', state: 'out', paper: 'affidavit', words: 'Lien filed Oct 2 · served Oct 6' })
    expect(filed.door).toEqual({ to: 'window', jobId: 'j867', tab: 'affidavit' })
    const unserved = lienArChipFor(input({ jobId: 'j867', filings: [filing({ id: 'a1', job_id: 'j867', kind: 'affidavit', filed_at: '2026-10-02', serve_due: '2026-10-07' })] }))!
    expect(unserved).toMatchObject({ tone: 'amber', words: 'Lien filed Oct 2 · serve by Oct 7' })
    const released = lienArChipFor(input({ jobId: 'j867', filings: [filing({ id: 'a1', job_id: 'j867', kind: 'affidavit', filed_at: '2026-10-02' }), filing({ id: 'r1', job_id: 'j867', kind: 'release_of_record', filed_at: '2026-10-10', created_at: '2026-10-10T12:00:00Z' })] }))!
    expect(released).toMatchObject({ tone: 'muted', paper: 'release', words: 'Released Oct 10' })
    const letter = lienArChipFor(input({ jobId: 'j858', nextUp: [row({ key: 'letter-two:j858', jobId: 'j858', action: 'letter_two', sub: 'day 12 · letter two', dueOn: null, daysLeft: null, severity: 'amber', group: 'coming', target: { open: 'notices', jobId: 'j858', pile: 'sent' } })], entry: entry({ jobId: 'j858', pile: 'sent' }), filings: [filing()], piecesByFiling: { f1: [piece()] }, letterTwo: two({ state: 'due', day: 12 }) }))!
    expect(letter).toMatchObject({ tone: 'amber', state: 'due', paper: 'letter_two', words: 'Delivered Sep 16 · day 12 · letter two' })
    expect(letter.door).toEqual({ to: 'desk', jobId: 'j858', kind: 'notice', pile: 'sent' })
  })

  it('the customer header carries the worst state, counting the jobs that share it; the lens pair counts customers', () => {
    const red: LienArChip = { tone: 'red', state: 'due', paper: 'notice', words: 'Notice to draft · by Oct 15 · 2d', sentence: '', title: '', door: { to: 'desk', jobId: 'a', kind: 'notice', pile: 'to_draft' }, dueOn: '2026-10-15', daysLeft: 2 }
    const green: LienArChip = { tone: 'green', state: 'out', paper: 'notice', words: 'Delivered Sep 16', sentence: '', title: '', door: { to: 'window', jobId: 'b', tab: 'notice' }, dueOn: null, daysLeft: null }
    const header = lienArCustomerChip([{ label: '273', chip: red }, { label: '890', chip: { ...red, dueOn: '2026-10-20', daysLeft: 7 } }, { label: '858', chip: green }, { label: '800', chip: null }])!
    expect(header).toMatchObject({ tone: 'red', state: 'due', words: 'Notice to draft · by Oct 15 · 2d · 2 jobs' })
    expect(header.title).toBe('273: Notice to draft · by Oct 15 · 2d\n890: Notice to draft · by Oct 15 · 2d\n858: Delivered Sep 16')
    expect(lienArCustomerChip([{ label: '858', chip: green }])!.words).toBe('Delivered Sep 16')
    expect(lienArCustomerChip([{ label: 'x', chip: null }])).toBeNull()
    const lens = lienArLensCounts([
      { open: 76451, chips: [red, green, null] },
      { open: 5000, chips: [green] },
      { open: 900, chips: [null] },
    ])
    expect(lens).toEqual({ due: { count: 1, open: 76451, tone: 'red' }, out: { count: 2, open: 81451 } })
    expect(lienArLensMatch([red, null], 'due')).toBe(true)
    expect(lienArLensMatch([green], 'due')).toBe(false)
    expect(lienArLensMatch([green], 'out')).toBe(true)
  })
})
