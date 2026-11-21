import { describe, expect, it } from 'vitest'
import { PLAIN_WORDS_GLUE, PLAIN_WORDS_MAX_SENTENCE_WORDS } from '../plainWords'
import {
  additionDraft,
  canAddTo,
  canTakeBack,
  canWriteSomeoneUp,
  dayWords,
  keptWriteUpLine,
  keptWriteUps,
  myWriteUpLine,
  myWriteUpNote,
  myWriteUpState,
  myWriteUpsHeadline,
  newWriteUpDraft,
  parseWriteUpList,
  parseWriteUpTime,
  personKindLabel,
  searchWriteUpPeople,
  splitWriteUpPeople,
  talkedQuestion,
  timeWords,
  todayGroupTitle,
  toggleSeen,
  witnessChoices,
  writeUpDayWords,
  writeUpFields,
  writeUpJobLabel,
  writeUpKindLabel,
  writeUpMissing,
  writeUpPayload,
  writeUpPersonLine,
  writeUpReadBack,
  writeUpVoiceWords,
  WRITE_UP_KINDS,
  WRITE_UP_WORDS,
  type WriteUpList,
  type WriteUpPerson,
} from './writeUp'

// Made-up people and a made-up job.
const TODAY = '2026-11-20'
const person = (over: Partial<WriteUpPerson> & { person_id: string; name: string }): WriteUpPerson => ({
  kind: 'helper',
  with_date: null,
  job_id: null,
  hcp_number: null,
  click_number: null,
  job_name: null,
  job_address: null,
  clocked_in_at: null,
  ...over,
})
const dana = person({ person_id: 'p-dana', name: 'Dana Pruitt', with_date: TODAY, job_id: 'j-cedar', job_name: 'Cedar Hollow Lot 14', clocked_in_at: '2026-11-20T13:04:00Z' })
const luis = person({ person_id: 'p-luis', name: 'Luis Ortega', with_date: TODAY, job_id: 'j-cedar', job_name: 'Cedar Hollow Lot 14', clocked_in_at: '2026-11-20T13:01:00Z' })
const tom = person({ person_id: 'p-tom', name: 'Tom Becker', kind: 'sub', with_date: TODAY, job_id: 'j-cedar', job_name: 'Cedar Hollow Lot 14' })
const nate = person({ person_id: 'p-nate', name: 'Nate Coyle', with_date: '2026-11-18', job_id: 'j-mill', job_name: 'Mill Road Duplex' })
const ivy = person({ person_id: 'p-ivy', name: 'Ivy Castellan' })
const sam = person({ person_id: 'p-sam', name: 'Sam Whitlock', kind: 'master_technician' })
const list: WriteUpList = {
  allowed: true,
  today: TODAY,
  people: [sam, tom, nate, dana, ivy, luis],
  jobs: [
    { job_id: 'j-cedar', hcp_number: '2231', click_number: null, job_name: 'Cedar Hollow Lot 14', job_address: '418 Larkspur Bend', last_day: TODAY },
    { job_id: 'j-mill', hcp_number: null, click_number: null, job_name: 'Mill Road Duplex', job_address: null, last_day: '2026-11-18' },
  ],
}
const NOW = { ymd: TODAY, hhmm: '12:41' }
const timeOf = () => '7:04 am'

describe('who may write someone up', () => {
  it('is a leader, a superintendent or a dev', () => {
    expect(['dev', 'master_technician', 'superintendent'].map(canWriteSomeoneUp)).toEqual([true, true, true])
    expect(['assistant', 'controller', 'helpers', 'subcontractor', 'estimator', 'primary', null, undefined].map(canWriteSomeoneUp)).toEqual(Array(8).fill(false))
  })
})

describe('the kinds', () => {
  it('end on good work, and each has words', () => {
    expect(WRITE_UP_KINDS.map((k) => k.key)).toEqual(['late_no_show', 'safety', 'work_quality', 'conduct', 'tools_truck', 'other', 'good_work'])
    expect(writeUpKindLabel('safety')).toBe('Safety')
  })
  it('a report written before the sheet reads as a report', () => {
    expect(writeUpKindLabel(null)).toBe('Report')
    expect(writeUpKindLabel('something_new')).toBe('Report')
  })
})

describe('the list', () => {
  it('reads the answer with care', () => {
    const got = parseWriteUpList({ allowed: true, today: TODAY, people: [{ person_id: 'a', name: ' Ann ' }, { person_id: 'b' }, null, { name: 'no id' }], jobs: [{ job_id: 'j', job_name: 'A job' }, {}] })
    expect(got.allowed).toBe(true)
    expect(got.people.map((p) => p.name)).toEqual(['Ann'])
    expect(got.jobs.map((j) => j.job_id)).toEqual(['j'])
  })
  it('an answer that is not a list is nobody, and not allowed', () => {
    expect(parseWriteUpList(null)).toEqual({ allowed: false, today: '', people: [], jobs: [] })
    expect(parseWriteUpList({ allowed: 'yes', people: 'x' }).allowed).toBe(false)
  })
  it('puts the people on the job today first, then this week newest first, then the rest by name', () => {
    const groups = splitWriteUpPeople(list)
    expect(groups.today.map((p) => p.name)).toEqual(['Dana Pruitt', 'Luis Ortega', 'Tom Becker'])
    expect(groups.week.map((p) => p.name)).toEqual(['Nate Coyle'])
    expect(groups.rest.map((p) => p.name)).toEqual(['Ivy Castellan', 'Sam Whitlock'])
  })
  it('names the job on the head of today when everyone shares one', () => {
    expect(todayGroupTitle([dana, luis])).toBe('With you today · Cedar Hollow Lot 14')
    expect(todayGroupTitle([dana, { ...luis, job_id: 'j-mill' }])).toBe('With you today')
  })
  it('says where each person was', () => {
    expect(writeUpPersonLine(dana, TODAY, timeOf)).toBe('Helper · on the clock since 7:04 am')
    expect(writeUpPersonLine(tom, TODAY, timeOf)).toBe('Subcontractor · not clocked in')
    expect(writeUpPersonLine(nate, TODAY, timeOf)).toBe('Helper · Wed at Mill Road Duplex')
    expect(writeUpPersonLine(sam, TODAY, timeOf)).toBe('Leader')
  })
  it('searches every name by every word typed', () => {
    expect(searchWriteUpPeople(list.people, 'sam').map((p) => p.name)).toEqual(['Sam Whitlock'])
    expect(searchWriteUpPeople(list.people, 'pru dana').map((p) => p.name)).toEqual(['Dana Pruitt'])
    expect(searchWriteUpPeople(list.people, '  ')).toEqual([])
  })
  it('names a job by its number and name, else its address', () => {
    expect(writeUpJobLabel(list.jobs[0]!)).toBe('2231 Cedar Hollow Lot 14')
    expect(writeUpJobLabel({ job_address: '418 Larkspur Bend' })).toBe('418 Larkspur Bend')
    expect(writeUpJobLabel({})).toBe('A job with no name')
  })
  it('names what a person is', () => {
    expect(personKindLabel('sub')).toBe('Subcontractor')
    expect(personKindLabel('field_hand')).toBe('Field hand')
    expect(personKindLabel(null)).toBe('')
  })
})

describe('the time and the day', () => {
  it('reads a time the way a person types it', () => {
    expect(['12:20', '12:20 pm', '1220', '7am', '7', '7:05a', '12 am', '11:59 PM'].map(parseWriteUpTime)).toEqual(['12:20', '12:20', '12:20', '07:00', '07:00', '07:05', '00:00', '23:59'])
  })
  it('refuses what is not a time', () => {
    expect(['', 'noon', '25', '13pm', '7:75', '0am'].map(parseWriteUpTime)).toEqual([null, null, null, null, null, null])
  })
  it('says a time and a day', () => {
    expect(timeWords('12:20')).toBe('12:20 pm')
    expect(timeWords('00:05:00')).toBe('12:05 am')
    expect(timeWords('')).toBe('')
    expect(dayWords('2026-11-20')).toBe('Fri, Nov 20')
    expect(writeUpDayWords('2026-11-20', TODAY)).toBe('Today')
    expect(writeUpDayWords('2026-11-19', TODAY)).toBe('Yesterday')
    expect(writeUpDayWords('2026-11-10', TODAY)).toBe('Tue, Nov 10')
    expect(writeUpDayWords('2026-10-31', '2026-11-01')).toBe('Yesterday')
  })
})

describe('the draft', () => {
  it('starts now, on the job the person shared with the writer today', () => {
    const d = newWriteUpDraft(dana, list, NOW)
    expect(d).toMatchObject({ date: TODAY, time: '12:41', job: { id: 'j-cedar', label: 'Cedar Hollow Lot 14' }, kind: null, sawIt: true, talked: null, addsTo: null })
  })
  it('falls to the writer’s own job today for a person from another day or none', () => {
    expect(newWriteUpDraft(nate, list, NOW).job).toEqual({ id: 'j-cedar', label: '2231 Cedar Hollow Lot 14' })
    expect(newWriteUpDraft(ivy, { today: TODAY, jobs: [] }, NOW).job).toBeNull()
  })
  it('says what is missing on the button, then nothing', () => {
    expect(writeUpMissing({ kind: null, words: ' ' })).toBe('Pick a kind and say what you saw')
    expect(writeUpMissing({ kind: 'safety', words: '' })).toBe('Say what you saw')
    expect(writeUpMissing({ kind: null, words: 'Words.' })).toBe('Pick a kind')
    expect(writeUpMissing({ kind: 'safety', words: 'x'.repeat(4001) })).toBe('That is too long to send')
    expect(writeUpMissing({ kind: 'safety', words: 'Words.' })).toBeNull()
  })
  it('offers the rest of the crew on that job as who saw it', () => {
    const d = newWriteUpDraft(dana, list, NOW)
    expect(witnessChoices(list, d).map((p) => p.name)).toEqual(['Luis Ortega', 'Tom Becker'])
    expect(witnessChoices(list, { ...d, job: null })).toEqual([])
  })
  it('presses a witness on and off, a typed name by its words', () => {
    const one = toggleSeen([], { person_id: 'p-luis', name: 'Luis Ortega' })
    expect(one).toHaveLength(1)
    expect(toggleSeen(one, { person_id: 'p-luis', name: 'Luis Ortega' })).toEqual([])
    const typed = toggleSeen(one, { name: 'The framer' })
    expect(toggleSeen(typed, { name: 'the framer' })).toEqual(one)
  })
  it('reads the record back one fact a line', () => {
    const d = { ...newWriteUpDraft(dana, list, NOW), kind: 'safety' as const, time: '12:20', words: 'The trench was open.', seenBy: [{ person_id: 'p-luis', name: 'Luis Ortega' }], talked: true }
    expect(writeUpReadBack(d)).toEqual([
      { label: 'About', value: 'Dana Pruitt' },
      { label: 'Kind', value: 'Safety' },
      { label: 'When', value: 'Fri, Nov 20 · 12:20 pm' },
      { label: 'Job', value: 'Cedar Hollow Lot 14' },
      { label: 'Seen by', value: 'You, Luis Ortega' },
      { label: 'Talked to Dana', value: 'Yes' },
    ])
  })
  it('says so when the writer was told and nobody is named, and leaves an unanswered question out', () => {
    const d = { ...newWriteUpDraft(ivy, { today: TODAY, jobs: [] }, NOW), kind: 'other' as const, time: '', words: 'Told by the framer.', sawIt: false }
    expect(writeUpReadBack(d)).toEqual([
      { label: 'About', value: 'Ivy Castellan' },
      { label: 'Kind', value: 'Other' },
      { label: 'When', value: 'Fri, Nov 20' },
      { label: 'Job', value: 'Not on a job' },
      { label: 'Seen by', value: 'You were told about it' },
    ])
  })
  it('sends what the function takes', () => {
    const d = { ...newWriteUpDraft(dana, list, NOW), kind: 'safety' as const, words: '  The trench was open.  ', seenBy: [{ person_id: 'p-luis', name: 'Luis Ortega' }, { name: 'The framer' }], talked: false }
    expect(writeUpPayload(d, 'press-1', '2026-11-20T18:42:00.000Z')).toEqual({
      press_id: 'press-1',
      pressed_at: '2026-11-20T18:42:00.000Z',
      subject_person_id: 'p-dana',
      kind: 'safety',
      content: 'The trench was open.',
      occurred_date: TODAY,
      occurred_time: '12:41',
      job_ledger_id: 'j-cedar',
      job_label: 'Cedar Hollow Lot 14',
      author_saw_it: true,
      seen_by: [{ person_id: 'p-luis', name: 'Luis Ortega' }, { name: 'The framer' }],
      talked_to_person: false,
      adds_to: null,
    })
  })
  it('an addition keeps the person and the kind and names what it adds to', () => {
    expect(additionDraft({ id: 'r-1', kind: 'safety' }, dana, list, NOW)).toMatchObject({ kind: 'safety', addsTo: 'r-1', person: dana })
    expect(additionDraft({ id: 'r-2', kind: null }, dana, list, NOW).kind).toBe('other')
  })
})

describe('the writer’s own write-ups', () => {
  const row = (over: Record<string, unknown>) => ({ status: 'pending', resolution_note: null, kind: 'safety', occurred_date: TODAY, job_label: 'Cedar Hollow Lot 14', adds_to: null, ...over }) as never
  it('reads where each stands', () => {
    expect(myWriteUpState(row({}))).toBe('waiting')
    expect(myWriteUpState(row({ status: 'filed' }))).toBe('filed')
    expect(myWriteUpState(row({ status: 'dismissed', resolution_note: 'Fixed the same day.' }))).toBe('set_aside')
    expect(myWriteUpState(row({ status: 'dismissed', resolution_note: 'Taken back by the writer: wrong person' }))).toBe('taken_back')
  })
  it('says who gave the reason', () => {
    expect(myWriteUpNote(row({ status: 'dismissed', resolution_note: 'Fixed the same day.' }))).toBe('HR said: Fixed the same day.')
    expect(myWriteUpNote(row({ status: 'dismissed', resolution_note: 'Taken back by the writer: wrong person' }))).toBe('You said: wrong person')
    expect(myWriteUpNote(row({}))).toBeNull()
  })
  it('draws the line under the name', () => {
    expect(myWriteUpLine(row({}))).toBe('Safety · Fri, Nov 20 · Cedar Hollow Lot 14')
    expect(myWriteUpLine(row({ kind: null, job_label: null, adds_to: 'r-1' }))).toBe('Report · Fri, Nov 20 · added to an earlier one')
  })
  it('counts them for the row that opens the list', () => {
    expect(myWriteUpsHeadline([row({}), row({ status: 'filed' }), row({ status: 'filed' })])).toBe('1 waiting on HR · 2 on file')
    expect(myWriteUpsHeadline([row({ status: 'dismissed', resolution_note: 'x' })])).toBe('1 sent')
    expect(myWriteUpsHeadline([])).toBe('')
  })
  it('lets a waiting one be taken back, and anything not taken back be added to', () => {
    expect([canTakeBack(row({})), canTakeBack(row({ status: 'filed' }))]).toEqual([true, false])
    expect([canAddTo(row({ status: 'filed' })), canAddTo(row({ status: 'dismissed', resolution_note: 'Taken back by the writer: x' }))]).toEqual([true, false])
  })
})

describe('a write-up kept on the phone', () => {
  const pressOf = (over: Record<string, unknown>) => ({ id: 'press-1', kind: 'person-report', userId: 'u-leader', pressedAt: 1000, state: 'waiting', payload: { fields: { subject_person_id: 'p-dana', kind: 'safety', occurred_date: TODAY, job_label: 'Cedar Hollow Lot 14' } }, refusal: null, ...over })
  it('lists the writer’s own waiting and refused write-ups, newest press first', () => {
    const got = keptWriteUps(
      [
        pressOf({}),
        pressOf({ id: 'press-2', pressedAt: 2000, state: 'refused', refusal: { message: 'You cannot write yourself up.' } }),
        pressOf({ id: 'press-3', state: 'sent' }),
        pressOf({ id: 'press-4', userId: 'u-other' }),
        pressOf({ id: 'press-5', kind: 'job-note', payload: { jobId: 'j', body: 'x' } }),
        pressOf({ id: 'press-6', payload: { fields: {} } }),
      ],
      'u-leader',
    )
    expect(got.map((k) => [k.id, k.state, k.reason])).toEqual([
      ['press-2', 'refused', 'You cannot write yourself up.'],
      ['press-1', 'waiting', null],
    ])
    expect(keptWriteUpLine(got[1]!)).toBe('Safety · Fri, Nov 20 · Cedar Hollow Lot 14')
    expect(keptWriteUpLine({ kind: null, occurred_date: '', job_label: null })).toBe('Report')
  })
  it('keeps the fields without a press id, which is the press’s own', () => {
    const d = { ...newWriteUpDraft(dana, list, NOW), kind: 'safety' as const, words: 'The trench was open.' }
    const fields = writeUpFields(d)
    expect(fields).not.toHaveProperty('press_id')
    expect(fields).not.toHaveProperty('pressed_at')
    expect(writeUpPayload(d, 'press-1', '2026-11-20T18:42:00.000Z')).toEqual({ press_id: 'press-1', pressed_at: '2026-11-20T18:42:00.000Z', ...fields })
  })
})

describe('the words', () => {
  const sentences = (s: string) => s.split(/(?<=[.?!])\s+/).filter(Boolean)
  it('are plain: no glue, no sentence over the cap', () => {
    const all: string[] = [...Object.values(WRITE_UP_WORDS), talkedQuestion('Dana Pruitt'), writeUpMissing({ kind: null, words: '' }) ?? '']
    for (const kind of ['idle', 'listening', 'done', 'unavailable', 'offline', 'denied', 'failed'] as const) {
      const w = writeUpVoiceWords({ kind, seconds: 14 })
      all.push(w.hint)
    }
    for (const words of all) {
      expect(PLAIN_WORDS_GLUE.test(words), words).toBe(false)
      for (const s of sentences(words)) expect(s.split(/\s+/).length, s).toBeLessThanOrEqual(PLAIN_WORDS_MAX_SENTENCE_WORDS)
    }
  })
  it('ask about the person by first name', () => {
    expect(talkedQuestion('Dana Pruitt')).toBe('Have you talked to Dana about it?')
  })
  it('say what the speech button does', () => {
    expect(writeUpVoiceWords({ kind: 'idle', seconds: 0 })).toEqual({ title: 'Talk it through', hint: 'The phone types what you say. No sound is kept.' })
    expect(writeUpVoiceWords({ kind: 'listening', seconds: 14 }).title).toBe('Listening · 0:14')
    expect(writeUpVoiceWords({ kind: 'done', seconds: 21 }).hint).toBe('Heard 21 seconds. Read the words, then fix any that are wrong.')
  })
})
