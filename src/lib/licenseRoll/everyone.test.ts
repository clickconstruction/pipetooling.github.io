import { describe, expect, it } from 'vitest'
import {
  changeWords,
  classesAskedFor,
  companyWords,
  EVERYONE_CLASSES,
  EVERYONE_FIRST_FILTER,
  filterIsFirst,
  historyLines,
  leaveOffAsk,
  noteCounts,
  noteDraft,
  notedNumbers,
  oursTags,
  personName,
  pickClass,
  pickStatus,
  rollViewFor,
  searchWordFilter,
  searchWords,
  sheetFacts,
  sheetNotes,
  sinceWords,
  statusAskedFor,
  type EveryoneRow,
  type NoteRow,
} from './everyone'
import { sentenceParts } from '../valuesInPlace'

// Every person, number and ZIP here is made up.
function row(over: Partial<EveryoneRow> = {}): EveryoneRow {
  return {
    id: 'r1',
    source: 'tsbpe',
    license_class: 'journeyman',
    license_number: 'J-90001',
    status: 'current',
    licensed_on: '2014-04-09',
    expires_on: '2027-03-31',
    last_name: 'SAMPLE',
    first_name: 'PAT',
    middle_name: '',
    suffix: '',
    name_key: 'sample|pat||78000',
    zip: '78000',
    county: 'BEXAR',
    endorsements: [],
    company: '',
    insurance_ends_on: null,
    ours: false,
    first_seen_on: '2026-11-21',
    gone_on: null,
    ...over,
  }
}
function note(over: Partial<NoteRow> = {}): NoteRow {
  return { id: 'n1', source: 'tsbpe', license_class: 'journeyman', license_number: 'J-90001', name_key: 'sample|pat||78000', body: 'Met at the supply house.', noted_by: 'u1', noted_by_name: 'Bed Holder', noted_at: '2026-11-22T15:00:00Z', ...over }
}
const plain = (text: string) => sentenceParts(text).map((p) => (typeof p === 'string' ? p : p.text)).join('')
const values = (text: string) => sentenceParts(text).filter((p) => typeof p !== 'string').map((p) => (p as { text: string }).text)

describe('the views', () => {
  it('opens Our own for a person who may see it, and Everyone for anyone else', () => {
    expect(rollViewFor(null, true)).toBe('own')
    expect(rollViewFor(null, false)).toBe('everyone')
    expect(rollViewFor('own', false)).toBe('everyone')
    expect(rollViewFor('pulls', false)).toBe('pulls')
    expect(rollViewFor('everyone', true)).toBe('everyone')
    expect(rollViewFor('nonsense', true)).toBe('own')
  })
})

describe('the chips', () => {
  it('open on the current licenses, every rank', () => {
    expect(statusAskedFor(EVERYONE_FIRST_FILTER)).toBe('current')
    expect(classesAskedFor(EVERYONE_FIRST_FILTER)).toEqual([...EVERYONE_CLASSES])
    expect(filterIsFirst(EVERYONE_FIRST_FILTER)).toBe(true)
  })
  it('light one status at a time, and a second press puts it out', () => {
    const lapsed = pickStatus(EVERYONE_FIRST_FILTER, 'lapsed')
    expect(statusAskedFor(lapsed)).toBe('expired')
    expect(statusAskedFor(pickStatus(lapsed, 'lapsed'))).toBeNull()
    expect(filterIsFirst(lapsed)).toBe(false)
  })
  it('count a responsible master as a master, and keep the ranks in the chips’ order', () => {
    const f = pickClass(pickClass(EVERYONE_FIRST_FILTER, 'tradesman'), 'master')
    expect(f.classes).toEqual(['master', 'tradesman'])
    expect(classesAskedFor(f)).toEqual(['master', 'responsible_master', 'tradesman'])
    expect(pickClass(f, 'master').classes).toEqual(['tradesman'])
  })
  it('never show an apprentice', () => {
    expect(EVERYONE_CLASSES).not.toContain('apprentice')
  })
})

describe('the search', () => {
  it('splits on anything that is not a letter, a digit, an apostrophe or a hyphen', () => {
    expect(searchWords("  O'Brien, 4412 ")).toEqual(["O'Brien", '4412'])
    expect(searchWords('pat (sample)*')).toEqual(['pat', 'sample'])
    expect(searchWords('J-90001')).toEqual(['J-90001'])
  })
  it('drops a lone hyphen and keeps at most four words', () => {
    expect(searchWords(' - a b c d e')).toEqual(['a', 'b', 'c', 'd'])
    expect(searchWords('')).toEqual([])
  })
  it('matches a word in a last name, a first name or a number', () => {
    expect(searchWordFilter('pat')).toBe('last_name.ilike.*pat*,first_name.ilike.*pat*,license_number.ilike.*pat*')
  })
})

describe('a row', () => {
  it('reads the state’s capitals as a name', () => {
    expect(personName(row({ first_name: 'MARY-ANN', middle_name: 'Q', last_name: "O'BRIEN", suffix: 'JR' }))).toBe("Mary-Ann Q. O'Brien Jr")
    expect(personName(row({ suffix: 'III' }))).toBe('Pat Sample III')
    expect(companyWords('EXAMPLE PLUMBING AND MECHANICAL OF TEXAS, LLC')).toBe('Example Plumbing and Mechanical of Texas, LLC')
    expect(companyWords('THE HVAC SHOP')).toBe('The HVAC Shop')
    expect(personName(row({ first_name: '', last_name: '' }))).toBe('No name on the state’s row')
  })
  it('gives the year it was licensed, or the day when it was this year', () => {
    expect(sinceWords('2014-04-09', '2026-11-23')).toBe('2014')
    expect(sinceWords('2026-11-12', '2026-11-23')).toBe('Nov 12')
    expect(sinceWords(null, '2026-11-23')).toBe('Not given')
  })
  it('tags our notes, and one of ours only for a person who may see our own', () => {
    expect(oursTags(row({ ours: true }), 2, true)).toEqual([{ label: '2 notes', tone: 'grey' }, { label: 'One of ours', tone: 'green' }])
    expect(oursTags(row({ ours: true }), 1, false)).toEqual([{ label: '1 note', tone: 'grey' }])
    expect(oursTags(row(), 0, true)).toEqual([])
  })
  it('counts notes by source and number, in any case', () => {
    const counts = noteCounts([note(), note({ id: 'n2', license_number: 'j-90001' }), note({ id: 'n3', license_number: 'M-90002' })])
    expect(counts.get('tsbpe|J-90001')).toBe(2)
    expect(counts.get('tsbpe|M-90002')).toBe(1)
    expect(notedNumbers([note(), note({ id: 'n2' }), note({ id: 'n3', license_number: 'M-90002' })])).toEqual(['J-90001', 'M-90002'])
  })
})

describe('the sheet', () => {
  it('lists the state’s facts, each value apart from its words', () => {
    const facts = sheetFacts(row({ endorsements: ['medical_gas', 'water_supply'] }), '2026-11-23')
    const by = Object.fromEntries(facts.map((f) => [f.label, f]))
    expect(plain(by.License!.text)).toBe('Journeyman plumber')
    expect(values(by.Expires!.text)).toEqual(['Mar 31, 2027'])
    expect(plain(by['Lives in']!.text)).toBe('Bexar County, 78000')
    expect(values(by.Endorsements!.text)).toEqual(['Medical gas', 'Water supply protection'])
    expect(by.Company).toBeUndefined()
  })
  it('says a lapse, a row gone from the file and a responsible master’s insurance', () => {
    const facts = sheetFacts(row({ status: 'expired', gone_on: '2026-11-16', company: 'SAMPLE PLUMBING LLC', insurance_ends_on: '2026-12-02' }), '2026-11-23')
    const by = Object.fromEntries(facts.map((f) => [f.label, f]))
    expect(by.Expired).toBeTruthy()
    expect(plain(by.Status!.text)).toBe('Missing from the state’s file since Nov 16, 2026')
    expect(plain(by.Insurance!.text)).toBe('On file with the board until Dec 2, 2026')
    expect(plain(by.Company!.text)).toBe('Sample Plumbing LLC')
  })

  it('says each change the pulls saw in words', () => {
    const c = (kind: string, was = {}, now_is = {}, seen_on = '2026-11-23') => plain(changeWords({ kind, seen_on, was, now_is }, '2026-11-21'))
    expect(c('first_seen', {}, {}, '2026-11-21')).toBe('First seen on the roll, on our first pull.')
    expect(c('first_seen')).toBe('New on the roll.')
    expect(c('renewed', { expires_on: '2026-03-31' }, { expires_on: '2027-03-31' })).toBe('Renewed. Expires Mar 31, 2027.')
    expect(c('lapsed', { status: 'current' }, { status: 'expired', expires_on: '2026-06-30' })).toBe('Lapsed. It expired Jun 30, 2026.')
    expect(c('current_again', {}, { expires_on: '2027-06-30' })).toBe('Current again. Expires Jun 30, 2027.')
    expect(c('moved', { county: 'WILLIAMSON', zip: '78600' }, { county: 'TRAVIS', zip: '78700' })).toBe('Moved from Williamson to Travis.')
    expect(c('moved', { county: 'TRAVIS', zip: '78700' }, { county: '', zip: '78701' })).toBe('Moved from Travis to ZIP 78701.')
    expect(c('endorsement', { endorsements: ['fire_sprinkler'] }, { endorsements: ['medical_gas'] })).toBe('Gained Medical gas. Lost Fire sprinkler.')
    expect(c('named', { first_name: 'PAT', last_name: 'SAMPEL' }, { first_name: 'PAT', last_name: 'SAMPLE' })).toBe('The state’s name changed from Pat Sampel to Pat Sample.')
    expect(c('gone')).toBe('Missing from the state’s file.')
    expect(c('back')).toBe('Back on the state’s file.')
    expect(c('something_new')).toBe('Changed on the state’s file.')
  })

  it('lists the history newest first, starting at our first pull', () => {
    const lines = historyLines(
      [
        { id: 'a', seen_on: '2026-11-21', kind: 'first_seen', was: {}, now_is: {} },
        { id: 'b', seen_on: '2027-03-29', kind: 'renewed', was: {}, now_is: { expires_on: '2028-03-31' } },
      ],
      '2026-11-21',
    )
    expect(lines.map((l) => l.day)).toEqual(['Mar 29, 2027', 'Nov 21, 2026'])
    expect(plain(lines[1]!.text)).toBe('First seen on the roll, on our first pull.')
  })

  it('shows notes on this number, and marks one under the same name and ZIP on another license', () => {
    const notes = sheetNotes(row(), [
      note({ id: 'old', noted_at: '2026-10-30T12:00:00Z' }),
      note({ id: 'other', license_class: 'master', license_number: 'M-90002', noted_at: '2026-11-22T12:00:00Z' }),
      note({ id: 'stranger', license_number: 'J-11111', name_key: 'someone|else||78000' }),
      note({ id: 'old', noted_at: '2026-10-30T12:00:00Z' }),
    ])
    expect(notes.map((n) => [n.id, n.onAnotherLicense])).toEqual([
      ['other', true],
      ['old', false],
    ])
  })

  it('keeps a note’s words trimmed, and refuses a blank one or one too long', () => {
    expect(noteDraft('  Good on gas.  ')).toEqual({ ok: true, body: 'Good on gas.' })
    expect(noteDraft('   ').ok).toBe(false)
    expect(noteDraft('x'.repeat(2001)).ok).toBe(false)
  })

  it('asks before Leave off, naming the act and the way back', () => {
    const ask = leaveOffAsk(row())
    expect(ask.title).toBe('Leave Pat Sample off the roll?')
    expect(ask.confirmLabel).toBe('Leave Pat off')
    expect(ask.message).toContain('Put back on the list')
    for (const sentence of ask.message.split(/(?<=\.)\s+/)) expect(sentence.split(/\s+/).length).toBeLessThanOrEqual(20)
  })
})
