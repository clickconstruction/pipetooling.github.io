import { describe, expect, it } from 'vitest'
import { buildRowNeeds, docFactKey, type RowNeedsInput } from './rowNeeds'
import { applyRowNeeds, rowMatchesFilter } from './usersTabRows'
import { buildRailRow, type RailFacts, type RailPersonInput } from './deskRailAttention'

const facts: RailFacts = {
  pendingByUserId: { 'u-taunya': { count: 26, hours: 136.6 }, 'u-grace': { count: 6, hours: 22 } },
  unsentDocsByName: { Taunya: 1, 'p:p-bill': 2, Trace: 3 },
  expiringByName: { 'p:p-michael': 1 },
  expiredByName: { 'p:p-bill': 2, Malachi: 1 },
  portalOnPersonIds: new Set(['p-behar']),
}
function person(x: Partial<RailPersonInput> & { name: string }): RailPersonInput {
  return { userId: null, personId: null, kind: 'assistant', archived: false, ...x }
}
const build = (x: Partial<RowNeedsInput> & { person: RailPersonInput }) => buildRowNeeds({ facts, ...x })

describe('buildRowNeeds (v2.2809)', () => {
  it('hours ride beside the needs and never move the dot', () => {
    const grace = build({ person: person({ name: 'Grace', userId: 'u-grace', personId: 'p-grace' }) })
    expect(grace.hoursWaiting).toBe(6)
    expect(grace.hoursLine).toBe('6 sessions (22.0 h) waiting for approval')
    expect(grace.needs).toEqual([])
    expect(grace.attention).toBe('green')
    expect(grace.needCount).toBe(0)
  })
  it('folds unsent, expiring, expired and the signing light into one paperwork need, worst tone wins', () => {
    const taunya = build({ person: person({ name: 'Taunya', userId: 'u-taunya', personId: 'p-taunya' }), signingLight: 'yellow' })
    expect(taunya.needs).toHaveLength(1)
    expect(taunya.needs[0]).toMatchObject({ subject: 'paperwork', tone: 'amber', count: 1, short: '1 unsent', verb: 'Send', door: 'paperwork' })
    expect(taunya.needs[0]!.long).toBe('1 contract never sent. Some contracts signed.')
    expect(taunya.attention).toBe('amber')
    expect(taunya.hoursWaiting).toBe(26)

    const bill = build({ person: person({ name: 'Bill', personId: 'p-bill', kind: 'sub' }), signingLight: 'red' })
    expect(bill.needs[0]).toMatchObject({ tone: 'red', count: 4, short: '2 expired · 2 unsent', verb: 'Send' })
    expect(bill.attention).toBe('red')
    // Roster-only rows carry the no-login fact, which never counts.
    expect(bill.needs.map((n) => n.key)).toEqual(['paperwork', 'no_login'])
    expect(bill.needCount).toBe(1)
  })
  it('a red signing light with nothing unsent is an "unsigned" amber need', () => {
    const t = build({ person: person({ name: 'Nobody', userId: 'u-n', personId: 'p-n' }), signingLight: 'red' })
    expect(t.needs[0]).toMatchObject({ short: 'unsigned', tone: 'amber', count: 1, verb: 'Chase signature' })
    expect(t.needs[0]!.long).toBe('Contracts sent, none signed yet.')
  })
  it('contract documents keyed by person id are found alongside name-keyed licenses', () => {
    expect(docFactKey('p-x', 'Any Name')).toBe('p:p-x')
    expect(docFactKey(null, '  Bill ')).toBe('Bill')
    const m = build({ person: person({ name: 'Michael A', userId: 'u-m', personId: 'p-michael' }) })
    expect(m.needs[0]).toMatchObject({ short: '1 expiring', verb: 'Open paperwork' })
  })
  it('account: the roster gap is an amber need; push and portal are facts', () => {
    const roxi = build({ person: person({ name: 'Roxi', userId: 'u-roxi', personId: null }) })
    expect(roxi.needs[0]).toMatchObject({ key: 'no_roster', tone: 'amber', verb: 'Create roster row', door: 'access' })
    expect(roxi.attention).toBe('amber')
    const behar = build({ person: person({ name: 'Behar', userId: 'u-b', personId: 'p-behar', kind: 'sub' }), canSeePush: true, pushOn: false })
    expect(behar.needs.map((n) => `${n.key}:${n.tone}`)).toEqual(['no_push:fact', 'portal:fact'])
    expect(behar.attention).toBe('green')
    expect(behar.needCount).toBe(0)
    // Devs and primaries never owe a roster row; push is only a field-kind fact.
    expect(build({ person: person({ name: 'Bryan', userId: 'u-br', kind: 'primary' }), canSeePush: true, pushOn: false }).needs).toEqual([])
  })
})

describe('applyRowNeeds + the Hours to approve filter', () => {
  it('the dot follows the needs, not the hours; the hours filter reads hoursWaiting', () => {
    const p = person({ name: 'Grace', userId: 'u-grace', personId: 'p-grace' })
    const legacy = buildRailRow(p, facts)
    expect(legacy.attention).toBe('amber') // the old rail still counts hours
    const row = applyRowNeeds(legacy, build({ person: p }))
    expect(row.attention).toBe('green')
    expect(rowMatchesFilter(row, 'attention')).toBe(false)
    expect(rowMatchesFilter(row, 'hours')).toBe(true)
    expect(rowMatchesFilter(legacy, 'hours')).toBe(false)
  })
})
