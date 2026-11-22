import { describe, expect, it } from 'vitest'
import { plainSentence } from '../valuesInPlace'
import { daysAwayWords, filterOwnLines, ownLines, stateNameAgrees, type OwnRecord, type OwnStateRow } from './ownLicenses'

/** Every person, number and day here is made up. */
const TODAY = '2026-11-21'

function rec(over: Partial<OwnRecord> = {}): OwnRecord {
  return { key: 'pl:1', licenseId: '1', personName: 'Silas Okafor', text: 'Journeyman Plumber #J-000277', expiryYmd: '2027-05-31', sub: false, ...over }
}
function row(over: Partial<OwnStateRow> = {}): OwnStateRow {
  return { id: 'r1', license_class: 'journeyman', license_number: '000277', status: 'current', expires_on: '2027-05-31', last_name: 'OKAFOR', first_name: 'SILAS', county: 'BEXAR', insurance_ends_on: null, gone_on: null, ...over }
}
const one = (records: OwnRecord[], roll: OwnStateRow[]) => ownLines({ records, roll, today: TODAY }).lines[0]!

describe('ownLines · the match', () => {
  it('matches a license to the state by its number, whatever dashes, letters or zeros either side writes', () => {
    const line = one([rec()], [row()])
    expect(line.verdict).toBe('matches')
    expect(line.pill).toBe('Matches')
    expect(line.tone).toBe('green')
    expect(line.needsLook).toBe(false)
    expect(line.holds).toBe('Journeyman Plumber')
    expect(line.number).toBe('J-000277')
    expect(plainSentence(line.stateSays!)).toBe('Current until May 31, 2027')
    expect(line.stateName).toBe('Okafor, Silas · Bexar')
    expect(line.useStateDate).toBeNull()
  })
  it('never matches across ranks: a journeyman number is not looked for among the masters', () => {
    const line = one([rec()], [row({ license_class: 'master' })])
    expect(line.verdict).toBe('not_found')
    expect(line.pill).toBe('Not on the roll')
    expect(line.needsLook).toBe(true)
  })
  it('looks for a master on both master files, and reads the one that carries the insurance', () => {
    const master = rec({ text: 'Master Plumber #M-000044', personName: 'Harlan Pruett' })
    const plain = row({ id: 'm', license_class: 'master', license_number: '44', last_name: 'PRUETT', first_name: 'HARLAN' })
    const responsible = row({ id: 'rm', license_class: 'responsible_master', license_number: '000044', last_name: 'PRUETT', first_name: 'HARLAN', insurance_ends_on: '2027-08-01' })
    expect(one([master], [plain]).verdict).toBe('matches')
    const line = one([master], [plain, responsible])
    expect(line.verdict).toBe('matches')
    expect(plainSentence(line.insurance!.words)).toBe('On file until Aug 1, 2027')
  })
  it('says so when the license has no number, or names no rank', () => {
    expect(one([rec({ text: 'Journeyman Plumber' })], [row()]).verdict).toBe('no_number')
    const noRank = one([rec({ text: 'Plumber #000277' })], [row()])
    expect(noRank.verdict).toBe('no_rank')
    expect(noRank.why).toContain('apprentice, tradesman, journeyman or master')
  })
  it('does not pass a number the state lists under another name, and offers no date from it', () => {
    const line = one([rec({ expiryYmd: '2026-01-31' })], [row({ last_name: 'CASTELLAN', first_name: 'WREN' })])
    expect(line.verdict).toBe('other_name')
    expect(line.pill).toBe('Another name')
    expect(line.stateName).toBe('Castellan, Wren · Bexar')
    expect(line.useStateDate).toBeNull()
  })
  it('counts a license of another trade, or of none, and checks none of them', () => {
    const read = ownLines({ records: [rec(), rec({ key: 'pl:2', text: 'Journeyman Electrician #88001' }), rec({ key: 'pl:3', text: 'Notary #135545090' })], roll: [row()], today: TODAY })
    expect(read.lines).toHaveLength(1)
    expect(read.otherTrades).toBe(2)
  })
})

describe('ownLines · how a matched license reads', () => {
  it('offers the state’s date when the state has a later one', () => {
    const line = one([rec({ expiryYmd: '2026-01-31' })], [row({ expires_on: '2027-01-31' })])
    expect(line.verdict).toBe('state_later')
    expect(line.pill).toBe('The state has a later date')
    expect(line.tone).toBe('amber')
    expect(line.useStateDate).toBe('2027-01-31')
  })
  it('offers it for an earlier date too, since the state’s is the true one', () => {
    const line = one([rec({ expiryYmd: '2028-05-31' })], [row({ expires_on: '2027-05-31' })])
    expect(line.verdict).toBe('state_earlier')
    expect(line.useStateDate).toBe('2027-05-31')
  })
  it('has nowhere to save a date for a license kept on a person’s own record', () => {
    const line = one([rec({ key: 'p:9', licenseId: null, expiryYmd: null, sub: true })], [row({ expires_on: '2027-01-31' })])
    expect(line.verdict).toBe('matches')
    expect(line.sub).toBe(true)
    expect(line.useStateDate).toBeNull()
  })
  it('says how soon a license lapses, inside sixty days', () => {
    const soon = one([rec({ expiryYmd: '2026-12-14' })], [row({ expires_on: '2026-12-14' })])
    expect(soon.verdict).toBe('lapses_soon')
    expect(soon.pill).toBe('Lapses in 23 days')
    expect(one([rec({ expiryYmd: '2027-01-21' })], [row({ expires_on: '2027-01-21' })]).verdict).toBe('matches')
  })
  it('reads lapsed from the state’s status, or from a state date that has passed', () => {
    const byStatus = one([rec({ expiryYmd: '2027-05-31' })], [row({ status: 'expired', expires_on: '2026-05-31' })])
    expect(byStatus.verdict).toBe('lapsed')
    expect(byStatus.tone).toBe('red')
    expect(plainSentence(byStatus.stateSays!)).toBe('Lapsed on May 31, 2026')
    expect(plainSentence(byStatus.why!)).toBe('We hold May 31, 2027.')
    expect(byStatus.useStateDate).toBe('2026-05-31')
    expect(one([rec({ expiryYmd: '2026-11-01' })], [row({ expires_on: '2026-11-01' })]).verdict).toBe('lapsed')
  })
  it('says when the state’s file stopped listing the license', () => {
    const line = one([rec()], [row({ gone_on: '2026-11-16' })])
    expect(line.verdict).toBe('gone')
    expect(plainSentence(line.why!)).toBe('The state’s file stopped listing this license on Nov 16, 2026.')
  })
  it('reads a matched master by insurance that is about to end, or has ended', () => {
    const master = rec({ text: 'Master Plumber #M-000044', personName: 'Harlan Pruett', sub: true })
    const responsible = (ends: string) => row({ license_class: 'responsible_master', license_number: '000044', last_name: 'PRUETT', first_name: 'HARLAN', insurance_ends_on: ends })
    const soon = one([master], [responsible('2026-12-02')])
    expect(soon.verdict).toBe('matches')
    expect(soon.pill).toBe('Insurance ends in 11 days')
    expect(soon.tone).toBe('amber')
    expect(soon.needsLook).toBe(true)
    expect(plainSentence(soon.insurance!.words)).toBe('Ends in 11 days, on Dec 2, 2026')
    const ended = one([master], [responsible('2026-11-01')])
    expect(ended.pill).toBe('Insurance ended')
    expect(ended.tone).toBe('red')
  })
})

describe('ownLines · the order and the chips', () => {
  it('lists what needs a look first, red before amber, then by name', () => {
    const read = ownLines({
      records: [
        rec({ key: 'pl:a', personName: 'Joss Albrecht', text: 'Journeyman Plumber #301' }),
        rec({ key: 'pl:b', personName: 'Wren Castellan', text: 'Tradesman Plumber #93', expiryYmd: '2026-12-14' }),
        rec({ key: 'pl:c', personName: 'Silas Okafor', text: 'Journeyman Plumber #277' }),
      ],
      roll: [
        row({ id: 'a', license_number: '000301', last_name: 'ALBRECHT', first_name: 'JOSS' }),
        row({ id: 'b', license_class: 'tradesman', license_number: '000093', last_name: 'CASTELLAN', first_name: 'WREN', expires_on: '2026-12-14' }),
        row({ id: 'c', license_number: '000277', status: 'expired', expires_on: '2026-05-31' }),
      ],
      today: TODAY,
    })
    expect(read.lines.map((l) => l.personName)).toEqual(['Silas Okafor', 'Wren Castellan', 'Joss Albrecht'])
    expect(filterOwnLines(read.lines, 'look').map((l) => l.key)).toEqual(['pl:c', 'pl:b'])
    expect(filterOwnLines(read.lines, 'matches').map((l) => l.key)).toEqual(['pl:a'])
    expect(filterOwnLines(read.lines, 'all')).toHaveLength(3)
  })
})

describe('the small words', () => {
  it('finds one of the state’s names in ours, hyphens and suffixes and all', () => {
    expect(stateNameAgrees('Silas Okafor', 'OKAFOR', 'SILAS')).toBe(true)
    expect(stateNameAgrees('Okafor, Silas J.', 'OKAFOR')).toBe(true)
    expect(stateNameAgrees('Ana Ruiz-Delgado', 'RUIZ DELGADO', 'ANA')).toBe(true)
    expect(stateNameAgrees('Silas Okafor', 'CASTELLAN', 'WREN')).toBe(false)
    expect(stateNameAgrees('Silas Okafor', '')).toBe(true)
  })
  it('takes a first name alone, a short form, or a short form with a last initial, the ways People → Licenses writes a person', () => {
    expect(stateNameAgrees('Silas', 'OKAFOR', 'SILAS')).toBe(true)
    expect(stateNameAgrees('Chris', 'LINDQVIST', 'CHRISTOPHER')).toBe(true)
    expect(stateNameAgrees('Mike Z.', 'ZAMORA', 'MICHAEL')).toBe(true)
    // An initial alone is no agreement, and neither is a first name that only starts alike.
    expect(stateNameAgrees('Mike Z', 'ZAMORA', 'WREN')).toBe(false)
    expect(stateNameAgrees('Mike Q', 'ZAMORA', 'MICHAEL')).toBe(false)
    expect(stateNameAgrees('Mike', 'ZAMORA', 'MICHAEL')).toBe(false)
  })
  it('counts days in plain words', () => {
    expect(daysAwayWords(0)).toBe('today')
    expect(daysAwayWords(1)).toBe('in 1 day')
    expect(daysAwayWords(23)).toBe('in 23 days')
  })
})
