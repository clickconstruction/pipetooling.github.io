import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from './plainWords'
import {
  jobModeFills,
  noteForOffice,
  onPhone,
  ownContactId,
  phoneLinesFromRows,
  previewOf,
  replyWaiting,
  SHEET_WORDS,
  sheetRows,
  waitingAnswer,
  windowWords,
  type PhoneLineRow,
} from './jobModeMessageCustomer'

// The residential prototype's people: Luis on the job, Dana Whitfield the customer. Made-up rows.
const row = (id: string, text: string, extra: Partial<PhoneLineRow> = {}): PhoneLineRow => ({
  id,
  text,
  for_kind: 'customer',
  step_key: null,
  scope: 'team',
  added_by: 'rosa',
  added_at: '2026-10-12T14:00:00Z',
  removed_at: null,
  phone_order: null,
  phone_name: null,
  text_es: null,
  ...extra,
})

const ROWS: PhoneLineRow[] = [
  row('q1', '{first}, this is {me} with Click Plumbing. I am on my way, about {minutes} minutes out.', {
    step_key: 'onway',
    phone_order: 2,
    phone_name: 'On my way',
    text_es: '{first}, soy {me} de Click Plumbing. Voy en camino, a unos {minutes} minutos.',
  }),
  row('q2', '{first}, I am running late. The new window is {window}.', { phone_order: 1 }),
  row('q3', '{first}, we found {found}. I will call you about it.', { phone_order: 3 }),
  row('q4', '{first}, your bill is {amount}.', { phone_order: 4 }),
  row('q5', '{first}, see where we are on your page: {link}', { phone_order: 5 }),
  row('q6', '{first}, we will be back {back day} at {back time}.', { phone_order: 6 }),
]

const LINES = phoneLinesFromRows(ROWS)

const FILL_INPUT = {
  customerName: 'Dana Whitfield',
  me: 'Luis Ortega',
  jobName: 'Whitfield water heater',
  jobAddress: '1208 Mesquite Ln',
  blocks: [
    { workDate: '2026-10-15', timeStart: '08:00:00', timeEnd: '10:00:00' },
    { workDate: '2026-10-13', timeStart: '09:30:00', timeEnd: '11:00:00' },
  ],
  today: '2026-10-13',
}

describe('phoneLinesFromRows', () => {
  it('reads the phone’s columns onto each line', () => {
    expect(LINES.find((q) => q.id === 'q1')).toMatchObject({ phoneOrder: 2, phoneName: 'On my way', stepId: 'onway', for: 'customer' })
    expect(LINES.find((q) => q.id === 'q1')!.textEs).toContain('Voy en camino')
  })
})

describe('onPhone', () => {
  it('keeps a line that needs money or the page link off the phone, in English or Spanish', () => {
    expect(onPhone({ text: '{first}, your bill is {amount}.', textEs: null })).toBe(false)
    expect(onPhone({ text: 'See your page: {link}', textEs: null })).toBe(false)
    expect(onPhone({ text: '{first}, thanks.', textEs: '{first}, el total es {amount}.' })).toBe(false)
    expect(onPhone({ text: '{first}, I am on my way.', textEs: null })).toBe(true)
  })
})

describe('jobModeFills', () => {
  it('fills the names, the job, today’s window and the next visit from the tech’s blocks', () => {
    expect(jobModeFills(FILL_INPUT)).toEqual({
      first: 'Dana',
      me: 'Luis',
      job: 'Whitfield water heater',
      address: '1208 Mesquite Ln',
      window: '9:30 AM to 11:00 AM',
      day: 'today',
      'back day': 'Thursday',
      'back time': '8:00 AM',
    })
  })

  it('leaves out what it cannot read, so the fill row asks', () => {
    expect(jobModeFills({ ...FILL_INPUT, customerName: null, me: '  ', blocks: [] })).toEqual({ job: 'Whitfield water heater', address: '1208 Mesquite Ln' })
  })

  it('says a window with to, never a dash', () => {
    expect(windowWords({ timeStart: '13:00:00', timeEnd: '15:30:00' })).toBe('1:00 PM to 3:30 PM')
  })
})

describe('sheetRows', () => {
  const fills = jobModeFills(FILL_INPUT)

  it('lists the lines that can go from the phone, by place, each by its short name and hint', () => {
    expect(sheetRows(LINES, null, fills).map((r) => [r.line.id, r.name, r.hint])).toEqual([
      ['q2', 'I am running late', 'the new window 9:30 AM to 11:00 AM, from the schedule'],
      ['q1', 'On my way', 'minutes out, from the drive'],
      ['q3', 'We found {found}', 'ready to go'],
      ['q6', 'We will be back Thursday at 8:00 AM', 'back Thursday at 8:00 AM, from the schedule'],
    ])
  })

  it('puts the job’s step first', () => {
    expect(sheetRows(LINES, 'onway', fills)[0]!.line.id).toBe('q1')
  })

  it('shows six at most, counted after the lines that cannot go', () => {
    const many = phoneLinesFromRows(Array.from({ length: 9 }, (_, i) => row(`m${i}`, `{first}, line ${i}.`, { phone_order: i + 1 })))
    expect(sheetRows([...phoneLinesFromRows([ROWS[3]!, ROWS[4]!]), ...many], null, fills)).toHaveLength(6)
  })
})

describe('previewOf', () => {
  const fills = jobModeFills(FILL_INPUT)
  const onMyWay = LINES.find((q) => q.id === 'q1')!

  it('asks for minutes out and holds Send until they are typed', () => {
    const before = previewOf(onMyWay, fills, {})
    expect(before.asks).toEqual([{ key: 'minutes', words: 'minutes out, from the drive' }])
    expect(before.stop).toBe('Fill {minutes} first. The app does not know it.')
    const after = previewOf(onMyWay, fills, { minutes: '15' })
    expect(after.text).toBe('Dana, this is Luis with Click Plumbing. I am on my way, about 15 minutes out.')
    expect(after.stop).toBeNull()
    expect(after.asks).toHaveLength(1)
  })

  it('reads the Spanish to a customer who reads it, and the English when a line has none', () => {
    expect(previewOf(onMyWay, fills, { minutes: '15' }, 'es').text).toBe('Dana, soy Luis de Click Plumbing. Voy en camino, a unos 15 minutos.')
    expect(previewOf(LINES.find((q) => q.id === 'q2')!, fills, {}, 'es').text).toBe('Dana, I am running late. The new window is 9:30 AM to 11:00 AM.')
  })

  it('asks for what the tech found, a blank the app never fills', () => {
    const found = previewOf(LINES.find((q) => q.id === 'q3')!, fills, { found: '  ' })
    expect(found.asks).toEqual([{ key: 'found', words: 'what you found' }])
    expect(found.stop).not.toBeNull()
  })
})

describe('ownContactId', () => {
  // The walk's customer (2026-10-14): a named person at the customer made first, the own thread with no name after.
  const named = { id: 'contact-named', name: 'Dana Whitfield', created_at: '2026-10-14T03:51:22Z' }
  const own = { id: 'contact-own', name: null, created_at: '2026-10-14T03:51:23Z' }

  it('picks the customer’s own thread, never a named person at the customer, whatever the order', () => {
    expect(ownContactId([named, own])).toBe('contact-own')
    expect(ownContactId([own, named])).toBe('contact-own')
  })

  it('takes the newest contact when none is their own, and none when there is none', () => {
    const tenant = { id: 'contact-tenant', name: 'Sam', created_at: '2026-10-15T09:00:00Z' }
    expect(ownContactId([named, tenant])).toBe('contact-tenant')
    expect(ownContactId([])).toBeNull()
  })
})

describe('their answer', () => {
  const ours = { direction: 'out', at: '2026-10-13T14:02:00Z', body: 'Dana, I am on my way.' }
  const theirs = { direction: 'in', at: '2026-10-13T14:05:00Z', body: 'Thanks, the gate code is 4412.' }
  const note = { direction: 'team', at: '2026-10-13T14:09:00Z', body: 'Called her back.' }

  it('waits when their line is newer than ours, and notes do not count', () => {
    expect(replyWaiting([ours, theirs, note])).toBe(true)
    expect(waitingAnswer([ours, theirs, note])).toEqual(theirs)
  })

  it('does not wait once we wrote back, or before anyone wrote', () => {
    const back = { direction: 'out', at: '2026-10-13T14:07:00Z', body: 'Got it.' }
    expect(replyWaiting([ours, theirs, back])).toBe(false)
    expect(waitingAnswer([ours, theirs, back])).toBeNull()
    expect(replyWaiting([])).toBe(false)
  })
})

describe('noteForOffice', () => {
  it('names who the office tells, and leaves nothing for an empty note', () => {
    expect(noteForOffice('  the part comes Thursday. ', 'Dana Whitfield')).toBe('Please tell Dana: the part comes Thursday.')
    expect(noteForOffice('call me', null)).toBe('Please tell the customer: call me')
    expect(noteForOffice('   ', 'Dana')).toBeNull()
  })
})

describe('the words', () => {
  it('pass the plain words rules', () => {
    const w = SHEET_WORDS
    const words = [
      w.door, w.doorWaiting, w.title('Dana'), w.title(null), w.pick, w.none, w.noCustomer, w.answered('Dana'), w.answerComes,
      w.preview('Dana'), w.preview(null), w.send('Dana'), w.back, w.sent('Dana'), w.noteSent,
      w.somethingElse.label, w.somethingElse.note, w.somethingElse.send,
      noteForOffice('the part comes Thursday.', 'Dana')!,
    ]
    expect(words.flatMap(plainWordsFailures)).toEqual([])
  })
})
