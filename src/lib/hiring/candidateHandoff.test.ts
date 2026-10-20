/**
 * A candidate's text handed to the hiring board, over card 11 of `customer-messages-integrations-mockups.html` (branch
 * spike/gc-mode, v0.2): (210) 555-0164 texts the office line at Tue Oct 6, 7:30 AM Chicago about the plumber opening
 * on Indeed. Made-up people and words, never a live row.
 */
import { describe, expect, it } from 'vitest'
import type { Contact } from '../contacts/kernel'
import { followUpQueue, type QueueContact, type QueueMessage } from '../followUp/queue'
import { plainWordsFailures } from '../plainWords'
import {
  CANDIDATE_SOURCE,
  afterCandidatePress,
  candidateFromWhoIsThis,
  candidateOption,
  candidateWords,
  handoffToBoard,
  nameInText,
  whenOnCard,
  type CandidateContext,
  type CandidateMessage,
} from './candidateHandoff'

const TEXTED_AT = '2026-10-06T12:30:00Z'
const NEXT_DAY = new Date('2026-10-07T15:00:00Z')
const INDEED = 'Hi, I saw the plumber opening on Indeed, is it still open?'

const stranger: Contact = {
  id: 'u-0164',
  kind: 'unknown',
  name: '(210) 555-0164',
  goesBy: null,
  company: '',
  record: null,
  channels: [{ id: 'ch-0164', kind: 'phone', value: '(210) 555-0164', optedOutAt: null }],
  jobIds: [],
  defaultJobId: null,
}

const greg: Contact = {
  id: 'greg',
  kind: 'trade',
  name: 'Greg Hollis',
  goesBy: null,
  company: 'Hillside Sitework',
  record: { table: 'gc_companies', id: 'gc-hillside' },
  channels: [{ id: 'ch-greg', kind: 'phone', value: '(210) 555-0113', optedOutAt: null }],
  jobIds: [],
  defaultJobId: null,
}

const text = (over: Partial<CandidateMessage> = {}): CandidateMessage & { jobId: string | null } => ({
  id: 'm-indeed',
  contactId: 'u-0164',
  channel: 'text',
  direction: 'in',
  at: TEXTED_AT,
  body: INDEED,
  channelId: 'ch-0164',
  jobId: null,
  ...over,
})

const ctx: CandidateContext = {
  contacts: [stranger, greg],
  prospectId: 'tp-new',
  masterUserId: 'u-owner',
  userId: 'u-rosa',
  boardRows: [
    { id: 'tp1', status: 'active', rank_order: 3, role_id: null, created_at: '2026-09-01T12:00:00Z' },
    { id: 'tp2', status: 'active', rank_order: 7, role_id: 'role-plumber', created_at: '2026-09-02T12:00:00Z' },
    { id: 'tp3', status: 'hired', rank_order: 9, role_id: null, created_at: '2026-08-01T12:00:00Z' },
  ],
}

describe('candidateFromWhoIsThis', () => {
  it('makes the card the board’s Add candidate would, named by the number when the text names no one', () => {
    const made = candidateFromWhoIsThis(text(), ctx)!
    expect(made.namedFrom).toBe('number')
    expect(made.insert).toEqual({
      id: 'tp-new',
      master_user_id: 'u-owner',
      created_by: 'u-rosa',
      name: '(210) 555-0164',
      phone_number: '(210) 555-0164',
      email: null,
      trade: null,
      source: CANDIDATE_SOURCE,
      notes: INDEED,
      links: [],
      status: 'active',
      role_id: null,
      rank_order: 4,
    })
    expect(CANDIDATE_SOURCE).toBe('text to the office')
  })

  it('takes the name the text gives, and only the first line as the note', () => {
    const made = candidateFromWhoIsThis(text({ body: `Hi, this is Marco Ruiz. ${INDEED.slice(4)}\nI have four years in service work.` }), ctx)!
    expect(made.namedFrom).toBe('text')
    expect(made.insert.name).toBe('Marco Ruiz')
    expect(made.insert.notes).toBe('Hi, this is Marco Ruiz. I saw the plumber opening on Indeed, is it still open?')
  })

  it('plans the re-point: the same contact, now a candidate on the new card', () => {
    const { plan } = candidateFromWhoIsThis(text(), ctx)!
    expect(plan.way).toBe('repoint')
    if (plan.way !== 'repoint') return
    expect(plan.contact).toMatchObject({ id: 'u-0164', kind: 'candidate', name: '(210) 555-0164', record: { table: 'team_prospects', id: 'tp-new' } })
    expect(plan.contact.channels).toEqual(stranger.channels)
  })

  it('keeps the line on the thread through the re-point', () => {
    const made = candidateFromWhoIsThis(text(), ctx)!
    const after = afterCandidatePress(ctx.contacts, [text()], made)
    expect(after.messages).toEqual([text()])
    expect(after.contacts.find((c) => c.id === 'u-0164')).toMatchObject({ kind: 'candidate', record: { table: 'team_prospects', id: 'tp-new' } })
    expect(after.contacts.find((c) => c.id === 'greg')).toBe(greg)
  })

  it('answers only a text in from a number nobody has named', () => {
    expect(candidateFromWhoIsThis(text({ contactId: 'greg' }), ctx)).toBeNull()
    expect(candidateFromWhoIsThis(text({ direction: 'out' }), ctx)).toBeNull()
    expect(candidateFromWhoIsThis(text({ contactId: 'nobody' }), ctx)).toBeNull()
  })
})

describe('off Follow up', () => {
  it('takes the text off Needs a reply once the number is a candidate', () => {
    const line: QueueMessage = { id: 'm-indeed', contactId: 'u-0164', channel: 'text', direction: 'in', at: TEXTED_AT, body: INDEED }
    const before: QueueContact = { id: 'u-0164', kind: 'unknown', name: '(210) 555-0164', state: 'waiting' }
    const was = followUpQueue({ contacts: [before], messages: [line], todayYmd: '2026-10-06' })
    expect(was.needsReply.map((r) => [r.contactId, r.acts[0]])).toEqual([['u-0164', 'Who is this?']])
    expect(was.count).toBe(1)
    const now = followUpQueue({ contacts: [{ ...before, kind: 'candidate' }], messages: [line], todayYmd: '2026-10-06' })
    expect(now.needsReply).toEqual([])
    expect(now.count).toBe(0)
  })
})

describe('handoffToBoard', () => {
  const candidate: Pick<Contact, 'id' | 'kind' | 'record'> = { id: 'u-0164', kind: 'candidate', record: { table: 'team_prospects', id: 'tp-new' } }
  const reply = text({ id: 'm-reply', direction: 'out', at: '2026-10-06T14:05:00Z', body: 'Yes, it is open. Can you come in Thursday?' })
  const note = text({ id: 'm-event', channel: 'event', direction: 'team', at: '2026-10-06T14:06:00Z', body: 'Named as a candidate.' })

  it('gives the board every line, opens the thread window at the newest, and keeps the contact off Follow up', () => {
    const board = handoffToBoard(candidate, [reply, note, text(), text({ id: 'm-other', contactId: 'greg' })], NEXT_DAY)!
    expect(board.prospectId).toBe('tp-new')
    expect(board.lines.map((m) => m.id)).toEqual(['m-indeed', 'm-reply', 'm-event'])
    expect(board.open).toEqual({ thread: 'u-0164', at: 'm-reply' })
    expect(board.keeps).toEqual({ contactId: 'u-0164', kind: 'candidate', onFollowUp: false })
    expect(board.cardLine).toBe('texted the office Tue 7:30 AM')
  })

  it('names an older text by its day, and says nothing when they never wrote', () => {
    expect(handoffToBoard(candidate, [text()], new Date('2026-10-20T15:00:00Z'))!.cardLine).toBe('texted the office Tue Oct 6')
    expect(handoffToBoard(candidate, [reply], NEXT_DAY)!.cardLine).toBeNull()
  })

  it('reads only a candidate on the board', () => {
    expect(handoffToBoard({ id: 'greg', kind: 'trade', record: greg.record }, [text()], NEXT_DAY)).toBeNull()
    expect(handoffToBoard({ id: 'u-0164', kind: 'unknown', record: null }, [text()], NEXT_DAY)).toBeNull()
  })
})

describe('the words', () => {
  it('finds a name after this is, my name is, I’m and it’s, and nothing else', () => {
    expect(nameInText('Hi, this is Marco Ruiz. I saw the opening.')).toBe('Marco Ruiz')
    expect(nameInText('My name is Ana and I am a licensed plumber.')).toBe('Ana')
    expect(nameInText('Hello! I’m Jo Ellen Park from Indeed.')).toBe('Jo Ellen Park')
    expect(nameInText('It’s Dana Indeed sent me.')).toBe('Dana')
    expect(nameInText(INDEED)).toBeNull()
    expect(nameInText('I’m interested in the job. It’s Still open?')).toBeNull()
    expect(nameInText('this is marco, is it open')).toBeNull()
  })

  it('says when on a card: the weekday and time this week, the day before it', () => {
    expect(whenOnCard(TEXTED_AT, NEXT_DAY)).toBe('Tue 7:30 AM')
    expect(whenOnCard(TEXTED_AT, new Date('2026-10-13T12:00:00Z'))).toBe('Tue Oct 6')
  })

  it('labels the Who is this? answer with the name when the text gives one', () => {
    expect(candidateOption('Marco Ruiz').label).toBe('Marco Ruiz, a candidate on the hiring board')
    expect(candidateOption(null)).toEqual({
      label: 'A candidate on the hiring board',
      small: 'Makes a card in Prospects, Hiring. The text goes with the card and stays off Follow up.',
    })
  })

  it('keeps every sentence in plain words', () => {
    for (const name of ['Marco Ruiz', null]) {
      const w = candidateWords(name, TEXTED_AT, NEXT_DAY)
      for (const s of [w.option.label, w.option.small, w.cardLine, w.toast]) expect(plainWordsFailures(s)).toEqual([])
    }
  })
})
