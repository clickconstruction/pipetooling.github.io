/**
 * The standing rule for a person (v2.6501): a People record linked to a login reads the login's standing, an unlinked
 * one reads its own; on a crew the unlinked one is keyed `person:<id>`. Every name here is made up.
 */
import { describe, expect, it } from 'vitest'
import { crewKeyForPerson, loginRows, personIdOfCrewKey, standingForPerson, standingLookupForPeople, standingsById, standingsByPersonId, type ChargeStandingRow } from './chargeStandings'

const ROWS: ChargeStandingRow[] = [
  { id: 'u-ash', person_id: null, name: 'Ash Reed', charge_standing: 'master', archived_at: null },
  { id: 'u-bo', person_id: null, name: 'Bo Lane', charge_standing: null, archived_at: null },
  { id: null, person_id: 'p-cal', name: 'Cal Vance', charge_standing: 'helper', archived_at: null },
  { id: null, person_id: 'p-dee', name: 'Dee Moss', charge_standing: null, archived_at: null },
]

describe('standing rule for a person (v2.6501)', () => {
  it('a linked People record reads the login’s standing, not its own row', () => {
    expect(standingForPerson(ROWS, { id: 'p-ash', account_user_id: 'u-ash' })).toBe('master')
    // The login holds no standing yet: none, whatever the record would say.
    expect(standingForPerson(ROWS, { id: 'p-cal', account_user_id: 'u-bo' })).toBe('none')
    // A login not among the rows: none.
    expect(standingForPerson(ROWS, { id: 'p-x', account_user_id: 'u-gone' })).toBe('none')
  })

  it('an unlinked People record reads its own standing, none when unset or absent', () => {
    expect(standingForPerson(ROWS, { id: 'p-cal', account_user_id: null })).toBe('helper')
    expect(standingForPerson(ROWS, { id: 'p-dee', account_user_id: null })).toBe('none')
    expect(standingForPerson(ROWS, { id: 'p-nobody', account_user_id: null })).toBe('none')
    const lookup = standingLookupForPeople(ROWS)
    expect(lookup({ id: 'p-cal', account_user_id: null })).toBe('helper')
    expect(lookup({ id: 'p-cal', account_user_id: 'u-ash' })).toBe('master')
  })

  it('keeps logins and records apart: by id answers logins alone, by person id records alone', () => {
    expect(Array.from(standingsById(ROWS).keys())).toEqual(['u-ash', 'u-bo'])
    expect(Array.from(standingsByPersonId(ROWS).entries())).toEqual([['p-cal', 'helper'], ['p-dee', 'none']])
    expect(loginRows(ROWS).map((r) => r.id)).toEqual(['u-ash', 'u-bo'])
  })

  it('keys an unlinked person as person:<id> on a crew and reads the id back; a login keeps its own id', () => {
    expect(crewKeyForPerson({ id: 'p-cal', account_user_id: null })).toBe('person:p-cal')
    expect(crewKeyForPerson({ id: 'p-ash', account_user_id: 'u-ash' })).toBe('u-ash')
    expect(personIdOfCrewKey('person:p-cal')).toBe('p-cal')
    expect(personIdOfCrewKey('u-ash')).toBeNull()
  })
})
