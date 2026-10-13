import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  DEMO_FOLLOW_UP_CONTACTS,
  DEMO_FOLLOW_UP_MESSAGES,
  DEMO_HEARD,
  DEMO_ME,
  DEMO_OWED,
  DEMO_PORTAL_PAPERS,
  DEMO_TODAY,
} from './followUpDemo'
import {
  anotherDay,
  BACK_CLEARED_TOAST,
  backPill,
  backToday,
  followUpQueue,
  hasHow,
  hasLine,
  hasPillWords,
  hasSinceWords,
  hasToast,
  holdCount,
  needsYouCount,
  noteBackToast,
  OFF_FOLLOW_UP,
  onFollowUp,
  openOwed,
  portalNeeds,
  snoozedWords,
  standingBackNote,
  STATE_WORDS,
  stateAfter,
  stateMenu,
  stateMoveOf,
  stateToast,
  stateToday,
  takeItWords,
  weOwe,
  whoGetsIt,
  whoPickerHead,
  type CustomerPaper,
  type FollowUpInput,
  type OwedRecord,
  type QueueContact,
  type QueueMessage,
} from './queue'

const demo: FollowUpInput = {
  contacts: DEMO_FOLLOW_UP_CONTACTS,
  messages: DEMO_FOLLOW_UP_MESSAGES,
  heard: DEMO_HEARD,
  owed: DEMO_OWED,
  portalPapers: DEMO_PORTAL_PAPERS,
  todayYmd: DEMO_TODAY,
}

const withContact = (id: string, patch: Partial<QueueContact>) => DEMO_FOLLOW_UP_CONTACTS.map((c) => (c.id === id ? { ...c, ...patch } : c))

describe('followUpQueue on the prototype’s Friday', () => {
  const queue = followUpQueue(demo)

  it('puts the longest waiting first, counted from their newest message', () => {
    expect(queue.needsReply.map((r) => [r.contactId, r.landOnId])).toEqual([
      ['priya', '8'],
      ['unk1', '14'],
      ['elena', '6'],
      ['greg', '16'],
    ])
  })

  it('gives each row its presses: Who is this? for a number, Call back after a missed call', () => {
    const acts = Object.fromEntries(queue.needsReply.map((r) => [r.contactId, r.acts]))
    expect(acts).toEqual({
      priya: ['Reply', 'No reply needed', 'Remind me Monday'],
      unk1: ['Who is this?', 'No reply needed', 'Remind me Monday'],
      elena: ['Reply', 'Call back in Quo', 'No reply needed', 'Remind me Monday'],
      greg: ['Reply', 'No reply needed', 'Remind me Monday'],
    })
    expect(queue.needsReply.find((r) => r.contactId === 'greg')!.offers.map((o) => o.label)).toEqual([
      'A day was heard: Wed Oct 7 · say what it is',
      'Ask the architect',
    ])
  })

  it('brings Rosa’s note back today, and Priya’s unopened change order', () => {
    expect(queue.needsYou).toEqual([
      {
        kind: 'back',
        contactId: 'priya',
        noteId: '9',
        pill: 'back today',
        noteBy: 'the note by Rosa, Fri Oct 2',
        note: DEMO_FOLLOW_UP_MESSAGES.find((m) => m.id === '9')!.body,
        dayYmd: '2026-10-02',
      },
      {
        kind: 'portal',
        contactId: 'priya',
        pill: 'not opened',
        sub: 'Change order 2 · a sink in exam 3 · sent Wed Sep 30, 2 days',
        snippet: 'Dr. Raman has not opened it. A text with the link, or a call.',
        why: 'A paper opened and left is a different nudge than one never opened. The row says which.',
        papers: [
          {
            id: 'co2',
            name: 'Change order 2 · a sink in exam 3',
            sentYmd: '2026-09-30',
            days: 2,
            openedYmd: null,
            label: 'Change order 2 · a sink in exam 3 · sent Wed Sep 30, 2 days · not opened',
          },
        ],
        more: null,
      },
    ])
  })

  it('lists what we owe Priya', () => {
    expect(queue.weOwe).toEqual([{ contactId: 'priya', owed: openOwed(DEMO_OWED, 'priya'), pill: 'we owe the start date · by Mon Oct 5', late: false }])
  })

  it('counts each person once on the badge, and a clause waiting on approval in Needs you only (the lead, 2026-10-12)', () => {
    expect(queue.count).toBe(4)
    const withClause = followUpQueue(demo, { clauses: [{ id: 'p1' }] })
    expect([withClause.count, needsYouCount(withClause), needsYouCount(queue)]).toEqual([4, 3, 2])
    expect(withClause.clauses).toEqual([{ id: 'p1' }])
  })

  it('draws the nudges as flows/nudges.ts made them, one per person and in their order, and never counts them', () => {
    const nudges = [
      { contactId: 'tom', stepId: 'invited', why: 'quiet 2 days' },
      { contactId: 'greg', stepId: 'quote', why: 'Boerne Retail Shell: late 2 days · waiting on their quote' },
    ]
    const withNudges = followUpQueue(demo, { nudges: () => nudges })
    expect(withNudges.nudges).toEqual(nudges)
    expect(withNudges.count).toBe(4)
    expect(queue.nudges).toEqual([])
  })

  it('tells the nudges which papers a portal row shows, by the round’s key, so a paper is never shown twice (the lead, 2026-10-12)', () => {
    const asked: Array<[string, string | null, boolean]> = []
    const shown = followUpQueue(demo, {
      nudges: (skip) => {
        for (const [contactId, key] of [['priya', 'co2'], ['priya', 'co9'], ['priya', null], ['elena', 'co2']] as const) asked.push([contactId, key, skip(contactId, 'co', key)])
        return []
      },
    })
    expect(asked).toEqual([
      ['priya', 'co2', true],
      ['priya', 'co9', false],
      ['priya', null, false],
      ['elena', 'co2', false],
    ])
    expect([shown.onPortal('priya', 'co', 'co2'), queue.onPortal('greg', 'co', 'co2')]).toEqual([true, false])
  })

  it('leaves out the closed, the snoozed and anyone whose day has not come', () => {
    const quiet = followUpQueue({ ...demo, contacts: withContact('elena', { state: 'snoozed', snoozedUntil: '2026-10-05' }) })
    expect(quiet.needsReply.map((r) => r.contactId)).toEqual(['priya', 'unk1', 'greg'])
    const monday = followUpQueue({ ...demo, contacts: withContact('elena', { state: 'snoozed', snoozedUntil: '2026-10-05' }), todayYmd: '2026-10-05' })
    expect(monday.needsReply.map((r) => r.contactId)).toContain('elena')
  })
})

describe('supply houses and candidates are off Follow up (the owner, 2026-10-13)', () => {
  const kinds = (patch: Record<string, QueueContact['kind']>) => DEMO_FOLLOW_UP_CONTACTS.map((c) => (patch[c.id] ? { ...c, kind: patch[c.id]! } : c))
  const nudges = [
    { contactId: 'tom', stepId: 'invited', why: 'quiet 2 days' },
    { contactId: 'greg', stepId: 'quote', why: 'waiting on their quote' },
  ]

  it('names the two kinds, and only those', () => {
    expect([...OFF_FOLLOW_UP]).toEqual(['supply_house', 'candidate'])
    const all: QueueContact['kind'][] = ['customer', 'trade', 'arch', 'lead', 'supply_house', 'candidate', 'sub', 'unknown']
    expect(all.filter((k) => !onFollowUp(k))).toEqual(['supply_house', 'candidate'])
  })

  it('leaves them out of every section, the nudges and the badge', () => {
    const queue = followUpQueue({ ...demo, contacts: kinds({ priya: 'supply_house', greg: 'candidate' }) }, { nudges: () => nudges })
    expect(queue.needsReply.map((r) => r.contactId)).toEqual(['unk1', 'elena'])
    expect(queue.needsYou).toEqual([])
    expect(queue.weOwe).toEqual([])
    expect(queue.nudges.map((n) => n.contactId)).toEqual(['tom'])
    expect(queue.count).toBe(2)
  })

  it('keeps a lead and a sub on it like anyone else', () => {
    const queue = followUpQueue({ ...demo, contacts: kinds({ priya: 'sub', greg: 'lead' }) }, { nudges: () => nudges })
    expect(queue.needsReply.map((r) => r.contactId)).toEqual(['priya', 'unk1', 'elena', 'greg'])
    expect(queue.needsYou.map((r) => [r.kind, r.contactId])).toEqual([['back', 'priya']])
    expect(queue.weOwe.map((r) => r.contactId)).toEqual(['priya'])
    expect(queue.nudges).toEqual(nudges)
    expect(queue.count).toBe(4)
  })
})

describe('the portal’s rows (v1.162)', () => {
  const wrote: QueueMessage = { id: '40', contactId: 'elena', channel: 'portal', direction: 'in', at: '2026-10-02T16:40:00.000Z', body: 'Is the glass still on for Monday?' }

  it('moves a customer who wrote on their page to Needs you, once (the lead, 2026-10-12)', () => {
    const queue = followUpQueue({ ...demo, messages: [...DEMO_FOLLOW_UP_MESSAGES, wrote] })
    expect(queue.needsReply.map((r) => r.contactId)).toEqual(['priya', 'unk1', 'greg'])
    expect(queue.needsYou.find((r) => r.contactId === 'elena')).toEqual({
      kind: 'portal',
      contactId: 'elena',
      pill: 'wrote in the portal',
      sub: 'Fri Oct 2 11:40 AM · lands here like a text',
      snippet: 'Is the glass still on for Monday?',
      why: 'A customer who writes on the page is a customer who wrote. The row reads the same as a text. The reply goes by text or email.',
      landOnId: '40',
      papers: [],
      more: null,
    })
    expect(queue.count).toBe(4)
  })

  it('gives a customer one row, led by their write, with every paper waiting after it, never one per job', () => {
    const second: CustomerPaper = {
      contactId: 'priya',
      paper: { id: 'co7', kind: 'changeOrder', title: 'Change order 1', detail: 'the lobby sink', sentAt: '2026-09-28T15:00:00.000Z', answered: false, viewedAt: '2026-09-29T15:00:00.000Z' },
    }
    const papers = [...DEMO_PORTAL_PAPERS, second]
    const quiet = portalNeeds(DEMO_FOLLOW_UP_CONTACTS, DEMO_FOLLOW_UP_MESSAGES, papers, DEMO_TODAY)
    expect(quiet.map((r) => [r.contactId, r.pill, r.sub, r.more])).toEqual([
      ['priya', 'opened, not signed', 'Change order 1 · the lobby sink · sent Mon Sep 28, 4 days', 'and 1 more paper not signed'],
    ])
    expect(quiet[0]!.papers.map((p) => p.label)).toEqual([
      'Change order 1 · the lobby sink · sent Mon Sep 28, 4 days · opened, not signed',
      'Change order 2 · a sink in exam 3 · sent Wed Sep 30, 2 days · not opened',
    ])
    const priyaWrote: QueueMessage = { ...wrote, id: '41', contactId: 'priya' }
    const led = portalNeeds(DEMO_FOLLOW_UP_CONTACTS, [...DEMO_FOLLOW_UP_MESSAGES, priyaWrote], papers, DEMO_TODAY)
    expect(led.map((r) => [r.pill, r.landOnId, r.more])).toEqual([['wrote in the portal', '41', 'and 2 papers not signed']])
  })

  const co2 = DEMO_PORTAL_PAPERS[0]!
  const paper = (patch: Partial<CustomerPaper['paper']>, contactId = 'priya'): CustomerPaper[] => [{ contactId, paper: { ...co2.paper, ...patch } }]

  it('says nothing for a write already answered, or for a paper sent yesterday', () => {
    expect(portalNeeds(withContact('elena', { state: 'done' }), [...DEMO_FOLLOW_UP_MESSAGES, wrote], [], DEMO_TODAY)).toEqual([])
    expect(portalNeeds(DEMO_FOLLOW_UP_CONTACTS, DEMO_FOLLOW_UP_MESSAGES, paper({ sentAt: '2026-10-01T15:00:00.000Z' }), DEMO_TODAY)).toEqual([])
  })

  it('tells a paper opened and left from one never opened', () => {
    expect(portalNeeds(DEMO_FOLLOW_UP_CONTACTS, DEMO_FOLLOW_UP_MESSAGES, paper({ viewedAt: '2026-10-01T14:14:00.000Z' }), DEMO_TODAY)).toMatchObject([
      { pill: 'opened, not signed', snippet: 'Dr. Raman opened it Thu Oct 1 and did not sign. A call beats a reminder.' },
    ])
  })

  it('has no row for a paper answered, a pay application, or a paper on no customer’s page', () => {
    expect(portalNeeds(DEMO_FOLLOW_UP_CONTACTS, DEMO_FOLLOW_UP_MESSAGES, paper({ answered: true }), DEMO_TODAY)).toEqual([])
    expect(portalNeeds(DEMO_FOLLOW_UP_CONTACTS, DEMO_FOLLOW_UP_MESSAGES, paper({ kind: 'payApp', title: 'Pay application 4', detail: null }), DEMO_TODAY)).toEqual([])
    expect(portalNeeds(DEMO_FOLLOW_UP_CONTACTS, DEMO_FOLLOW_UP_MESSAGES, paper({}, 'greg'), DEMO_TODAY)).toEqual([])
  })

  it('names a paper with no detail by its title alone', () => {
    expect(portalNeeds(DEMO_FOLLOW_UP_CONTACTS, DEMO_FOLLOW_UP_MESSAGES, paper({ kind: 'contract', title: 'Our contract', detail: null }), DEMO_TODAY)[0]!.sub).toBe(
      'Our contract · sent Wed Sep 30, 2 days',
    )
  })
})

describe('a note’s day to come back (v1.128)', () => {
  const note = DEMO_FOLLOW_UP_MESSAGES.find((m) => m.id === '9')!

  it('comes back on its morning and stays until it is dealt with', () => {
    expect(backToday([note], '2026-10-01')).toEqual([])
    expect(backToday([note], '2026-10-05')[0]!.pill).toBe('back since Fri Oct 2')
    expect(backToday([{ ...note, backDoneAt: '2026-10-02T17:00:00.000Z' }], DEMO_TODAY)).toEqual([])
  })

  it('keeps one note per person: a newer note with a day replaces the older, and nothing older comes back once done', () => {
    const newer: QueueMessage = { ...note, id: '50', at: '2026-09-28T15:00:00.000Z', body: 'Call her after the award.', backOn: '2026-10-01', backBy: 'Robert' }
    expect(backToday([note, newer], DEMO_TODAY).map((r) => [r.noteId, r.pill, r.noteBy])).toEqual([['50', 'back since Thu Oct 1', 'the note by Robert, Thu Oct 1']])
    expect(standingBackNote([note, newer], 'priya')?.id).toBe('50')
    const done = { ...newer, backDoneAt: '2026-10-02T15:00:00.000Z' }
    expect(backToday([note, done], DEMO_TODAY)).toEqual([])
    expect(standingBackNote([note, done], 'priya')).toBeNull()
    const noDay: QueueMessage = { ...note, id: '51', at: '2026-09-29T15:00:00.000Z', backOn: null }
    expect(backToday([note, noDay], DEMO_TODAY).map((r) => r.noteId)).toEqual(['9'])
  })

  it('never comes back on words that are not a day, and says so', () => {
    const words = { ...note, backOn: null, backWords: 'after the award' }
    expect(backToday([words], '2027-01-01')).toEqual([])
    expect([backPill(note), backPill(words), backPill({ backOn: null })]).toEqual(['↩ back Fri Oct 2', '↩ back after the award · no day', null])
  })

  it('moves to the next working day on Another day', () => {
    expect(anotherDay(DEMO_TODAY)).toEqual({ backOn: '2026-10-05', toast: 'Comes back Mon Oct 5.' })
  })

  it('adds to the box’s toast when the note comes back, or that it will not', () => {
    expect(noteBackToast(null)).toBeNull()
    expect(noteBackToast({ ymd: null, words: null })).toBeNull()
    expect(noteBackToast({ ymd: '2026-10-05', words: null })).toBe('It comes back to Follow up Mon Oct 5.')
    expect(noteBackToast({ ymd: null, words: 'after the award' })).toBe('It has no day, so it will not come back.')
  })
})

describe('We owe them', () => {
  const marked = '2026-10-01T15:00:00.000Z'
  const rows: OwedRecord[] = [
    { contactId: 'greg', what: 'the plans or an addendum', byYmd: null, byWords: 'after the Board meets', markedBy: 'Robert', markedAt: marked },
    ...DEMO_OWED,
    { contactId: 'elena', what: 'a pay application', byYmd: '2026-10-01', byWords: null, markedBy: 'Rosa', markedAt: marked },
    { contactId: 'tom', what: 'a call back', byYmd: '2026-10-01', byWords: null, markedBy: 'Rosa', markedAt: marked, doneAt: '2026-10-02T15:00:00.000Z' },
  ]

  it('puts the soonest day first, the late ones flagged, and a day in words last', () => {
    expect(weOwe(rows, DEMO_TODAY).map((r) => [r.contactId, r.late, r.pill])).toEqual([
      ['elena', true, 'we owe a pay application · by Thu Oct 1'],
      ['priya', false, 'we owe the start date · by Mon Oct 5'],
      ['greg', false, 'we owe the plans or an addendum · after the Board meets · no day'],
    ])
  })

  it('lists one row per person, the newest marked if two are ever open', () => {
    const twice: OwedRecord[] = [...DEMO_OWED, { ...DEMO_OWED[0]!, what: 'a call back', byYmd: null, markedAt: '2026-10-01T15:00:00.000Z' }]
    expect(weOwe(twice, DEMO_TODAY).map((r) => r.pill)).toEqual(['we owe a call back'])
    expect(openOwed(twice, 'priya')?.what).toBe('a call back')
  })

  it('reads the open row for the move line and the strip', () => {
    expect(openOwed(rows, 'tom')).toBeNull()
    expect(openOwed(rows, 'priya')).toEqual({ what: 'the start date', byYmd: '2026-10-05', byWords: null, markedBy: 'Rosa', markedAt: '2026-09-26T19:30:00.000Z' })
  })
})

describe('Open · Snoozed · Done, the app’s to set (v1.146)', () => {
  it('opens on their message, closes on our reply or a team note', () => {
    expect(stateAfter('inbound', DEMO_TODAY)).toEqual({ state: 'waiting', snoozedUntil: null, clearHas: false })
    expect(stateAfter('reply', DEMO_TODAY)).toEqual({ state: 'done', snoozedUntil: null, clearHas: true })
    expect(stateAfter('note', DEMO_TODAY)).toEqual({ state: 'done', snoozedUntil: null, clearHas: true })
    expect(stateAfter('noReplyNeeded', DEMO_TODAY)).toEqual({ state: 'done', snoozedUntil: null, clearHas: true })
    expect(stateAfter('reopen', DEMO_TODAY)).toEqual({ state: 'waiting', snoozedUntil: null, clearHas: false })
  })

  it('snoozes to the coming Monday, keeps who has it, and wakes that morning', () => {
    expect(stateAfter('remindMonday', DEMO_TODAY)).toEqual({ state: 'snoozed', snoozedUntil: '2026-10-05', clearHas: false })
    const snoozed = { state: 'snoozed' as const, snoozedUntil: '2026-10-05' }
    expect([stateToday(snoozed, '2026-10-04'), stateToday(snoozed, '2026-10-05')]).toEqual(['snoozed', 'waiting'])
    expect(stateToday({ state: 'snoozed', snoozedUntil: null }, '2027-01-01')).toBe('snoozed')
    expect([snoozedWords(snoozed), snoozedWords({ state: 'waiting' })]).toEqual(['snoozed until Mon Oct 5', null])
  })

  it('reads the move from the message', () => {
    expect(
      [
        { channel: 'text', direction: 'in' },
        { channel: 'missed', direction: 'in' },
        { channel: 'email', direction: 'out' },
        { channel: 'note', direction: 'team' },
        { channel: 'event', direction: 'team' },
      ].map((m) => stateMoveOf(m as Pick<QueueMessage, 'channel' | 'direction'>)),
    ).toEqual(['inbound', 'inbound', 'reply', 'note', null])
  })

  it('offers close and snooze on an open row, and Reopen on any other', () => {
    expect(stateMenu('waiting').map((r) => r.label)).toEqual(['No reply needed', 'Remind me Monday'])
    expect(stateMenu('snoozed').map((r) => r.label)).toEqual(['Reopen'])
    expect(stateMenu('done').map((r) => r.move)).toEqual(['reopen'])
    expect(STATE_WORDS).toEqual({ waiting: 'Open', snoozed: 'Snoozed', done: 'Done' })
  })

  it('says what a press did', () => {
    expect(stateToast('noReplyNeeded', 'Greg Paulk')).toBe('Greg Paulk cleared from Follow up.')
    expect(stateToast('reopen', 'Greg Paulk')).toBe('Greg Paulk is back in Follow up.')
    expect(stateToast('remindMonday', 'Greg Paulk')).toBe('Greg Paulk comes back to Follow up on Monday.')
    expect(stateToast('reply', 'Greg Paulk')).toBeNull()
  })
})

describe('who has it', () => {
  it('writes a gray line for a take, a hand-off or a put back, and nothing when nothing changed', () => {
    expect(hasLine('Robert', 'Greg Paulk', null, 'Robert')).toBe('Robert took Greg Paulk.')
    expect(hasLine('Robert', 'Dr. Priya Raman', 'Rosa', 'Robert')).toBe('Robert took Dr. Priya Raman from Rosa.')
    expect(hasLine('Robert', 'Greg Paulk', null, 'Wendi')).toBe('Robert gave Greg Paulk to Wendi.')
    expect(hasLine('Robert', 'Greg Paulk', 'Rosa', 'Wendi')).toBe('Robert handed Greg Paulk to Wendi.')
    expect(hasLine('Robert', 'Greg Paulk', 'Rosa', null)).toBe('Robert put Greg Paulk back for whoever answers first.')
    expect(hasLine('Robert', 'Greg Paulk', 'Rosa', 'Rosa')).toBeNull()
    expect([hasHow('Robert', 'Robert'), hasHow('Robert', 'Rosa'), hasHow('Robert', null)]).toEqual(['took', 'handed', null])
  })

  it('reads the pill, the toast and the picker', () => {
    expect([hasPillWords(DEMO_ME, null), hasPillWords(DEMO_ME, 'Robert'), hasPillWords(DEMO_ME, 'Rosa')]).toEqual(['Nobody has it · Take it', 'You have this', 'Rosa has this'])
    expect([hasToast(DEMO_ME, 'Greg Paulk', 'Robert'), hasToast(DEMO_ME, 'Greg Paulk', 'Rosa'), hasToast(DEMO_ME, 'Greg Paulk', null)]).toEqual([
      'You have Greg Paulk.',
      'Rosa has Greg Paulk.',
      'Nobody has it.',
    ])
    expect(whoPickerHead(DEMO_ME, 'Dr. Priya Raman', 'Rosa', 'Sat Sep 26, 2:30 PM')).toBe('Rosa has Dr. Priya Raman since Sat Sep 26, 2:30 PM. Hand it to:')
    expect(whoPickerHead(DEMO_ME, 'Greg Paulk', null)).toBe('Nobody has Greg Paulk yet. Hand it to:')
    expect([takeItWords('Rosa'), takeItWords(null)]).toEqual(['Rosa sees it move to you. The thread says so.', 'So nobody else answers it too.'])
  })

  it('says since when on the pill’s hover (v1.90)', () => {
    expect(hasSinceWords('last Saturday', 'Sat Sep 26, 2:30 PM')).toBe('Since last Saturday, Sat Sep 26, 2:30 PM.')
    expect(hasSinceWords('on Wednesday', 'Wed Sep 30, 9:40 AM')).toBe('Since Wednesday, Wed Sep 30, 9:40 AM.')
    expect(hasSinceWords('today at 9:14 AM', 'Fri Oct 2, 9:14 AM')).toBe('Since today at 9:14 AM.')
  })

  it('counts what each teammate holds open', () => {
    expect(holdCount(DEMO_FOLLOW_UP_CONTACTS, 'Rosa', DEMO_TODAY)).toBe(1)
    expect(holdCount(withContact('priya', { state: 'snoozed', snoozedUntil: '2026-10-05' }), 'Rosa', DEMO_TODAY)).toBe(0)
  })

  it('gives a new message to whoever answered last when they are here, else the seat for who they are', () => {
    const seats = { customer: 'Rosa', trade: 'Robert' }
    const here = new Set(['Robert', 'Rosa'])
    expect(whoGetsIt({ kind: 'trade', answeredLastBy: 'Rosa', hereToday: here, seats })).toBe('Rosa')
    expect(whoGetsIt({ kind: 'trade', answeredLastBy: 'Wendi', hereToday: here, seats })).toBe('Robert')
    expect(whoGetsIt({ kind: 'customer', answeredLastBy: null, hereToday: here, seats })).toBe('Rosa')
    expect(whoGetsIt({ kind: 'arch', answeredLastBy: null, hereToday: here, seats })).toBe('Robert')
    expect(whoGetsIt({ kind: 'arch', answeredLastBy: null, hereToday: here, seats: { ...seats, arch: 'Maria' } })).toBe('Maria')
    expect(whoGetsIt({ kind: 'unknown', answeredLastBy: null, hereToday: here, seats })).toBeNull()
  })
})

describe('plain words', () => {
  it('holds every sentence a person reads to the rules', () => {
    const rows = followUpQueue({ ...demo, messages: [...DEMO_FOLLOW_UP_MESSAGES, { id: '40', contactId: 'elena', channel: 'portal', direction: 'in', at: '2026-10-02T16:40:00.000Z', body: 'x' }] })
    expect(rows.needsYou.map((r) => r.pill)).toEqual(['back today', 'wrote in the portal', 'not opened'])
    const sentences = [
      ...rows.needsYou.flatMap((r) => (r.kind === 'portal' ? [r.why, r.snippet] : [])),
      ...stateMenu('waiting').map((r) => r.words),
      ...stateMenu('done').map((r) => r.words),
      ...(['noReplyNeeded', 'reopen', 'remindMonday'] as const).map((m) => stateToast(m, 'Greg Paulk')!),
      hasLine('Robert', 'Greg Paulk', 'Rosa', null)!,
      takeItWords('Rosa'),
      noteBackToast({ ymd: null, words: 'after the award' })!,
      noteBackToast({ ymd: '2026-10-05', words: null })!,
      BACK_CLEARED_TOAST,
      anotherDay(DEMO_TODAY).toast,
    ]
    expect(sentences.flatMap(plainWordsFailures)).toEqual([])
  })
})
