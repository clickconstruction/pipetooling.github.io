/**
 * The Quo connection's kernel (v2.5718): the key's status as quo-config answers it, never the key; Quo's two lists as
 * the pickers read them, by name, a row without Quo's id left out; the masked and the saved words; what state the
 * three cards are in; what stops a key from being saved.
 */
import { describe, expect, it } from 'vitest'
import {
  BY_HAND,
  connectionState,
  directoryWords,
  idListed,
  maskedKeyWords,
  memberLabel,
  NO_QUO_KEY,
  numberLabel,
  parseQuoDirectory,
  parseQuoKeyStatus,
  parseQuoMembers,
  parseQuoNumbers,
  pickerShows,
  quoKeyProblem,
  savedWords,
} from './connection'

const NOW = '2026-10-21T20:00:00.000Z'

const QUO_USERS = [
  { id: 'USrosa2', email: 'rosa@plumbing.example', firstName: 'Rosa', lastName: 'Diaz', role: 'member', pictureUrl: null },
  { id: 'USrobert1', email: 'robert@plumbing.example', firstName: 'Robert', lastName: null, role: 'owner' },
  { id: 'USnoname', email: 'office@plumbing.example', firstName: null, lastName: null, role: 'admin' },
  { id: 'GRgroup', email: 'x@y.z' },
  'not an object',
]

const QUO_NUMBERS = [
  { id: 'PNteam01', name: 'Team line', symbol: '🏡', phoneNumber: '+15125550144', formattedNumber: '(512) 555-0144' },
  { id: 'PNbids02', name: 'Bids', symbol: null, phoneNumber: '+15125550199', formattedNumber: null },
  { id: 'PNold', name: 'Old shape', number: '+15125550100' },
  { id: 'USnot', name: 'A user' },
]

describe('the key’s status', () => {
  it('reads what quo-config answers, never the key', () => {
    expect(parseQuoKeyStatus({ ok: true, set: true, source: 'vault', last4: 'ab12', saved_at: '2026-10-21T19:30:00Z', saved_by: 'Robert Douglas' })).toEqual({
      set: true,
      source: 'vault',
      last4: 'ab12',
      savedAt: '2026-10-21T19:30:00Z',
      savedBy: 'Robert Douglas',
    })
    expect(parseQuoKeyStatus({ ok: true, set: true, source: 'env', last4: null, saved_at: null, saved_by: null })).toEqual({ set: true, source: 'env', last4: null, savedAt: null, savedBy: null })
    expect(parseQuoKeyStatus({ ok: true, set: false, source: 'none' })).toEqual(NO_QUO_KEY)
    expect(parseQuoKeyStatus(null)).toEqual(NO_QUO_KEY)
    expect(parseQuoKeyStatus({ set: true, source: 'none' })).toEqual(NO_QUO_KEY)
  })

  it('masks the key and says when it was saved and by whom', () => {
    expect(maskedKeyWords(NO_QUO_KEY)).toBe('No key saved yet.')
    expect(maskedKeyWords({ set: true, source: 'env', last4: null, savedAt: null, savedBy: null })).toBe('A key is set on the server by a dev, not here. Paste it here so Settings holds it.')
    const saved = { set: true, source: 'vault' as const, last4: 'ab12', savedAt: '2026-10-21T19:30:00Z', savedBy: 'Robert Douglas' }
    expect(maskedKeyWords(saved)).toBe('A key is saved. It ends in ab12.')
    expect(savedWords(saved, NOW)).toBe('Saved today at 2:30 PM by Robert Douglas.')
    expect(savedWords({ ...saved, savedBy: null }, NOW)).toBe('Saved today at 2:30 PM.')
    expect(savedWords({ ...saved, savedAt: '2026-10-16T19:30:00Z' }, NOW)).toBe('Saved last Friday by Robert Douglas.')
    expect(savedWords(NO_QUO_KEY, NOW)).toBe('')
    expect(savedWords({ set: true, source: 'env', last4: null, savedAt: null, savedBy: null }, NOW)).toBe('')
  })

  it('says what stops a key from being saved', () => {
    expect(quoKeyProblem('')).toBe('Paste the key from Quo first.')
    expect(quoKeyProblem('  ')).toBe('Paste the key from Quo first.')
    expect(quoKeyProblem('abc def ghi jkl mno pqr')).toBe('The key has a space in it. Paste it again.')
    expect(quoKeyProblem('short')).toBe('That is too short to be a Quo key.')
    expect(quoKeyProblem(' AbCdEfGhIjKlMnOpQrSt1234 ')).toBeNull()
  })
})

describe('Quo’s lists', () => {
  it('reads the members by name, a row without a US id left out, a name from the email when Quo has none', () => {
    expect(parseQuoMembers(QUO_USERS)).toEqual([
      { id: 'USnoname', name: 'office', email: 'office@plumbing.example', role: 'admin' },
      { id: 'USrobert1', name: 'Robert', email: 'robert@plumbing.example', role: 'owner' },
      { id: 'USrosa2', name: 'Rosa Diaz', email: 'rosa@plumbing.example', role: 'member' },
    ])
    expect(parseQuoMembers('nope')).toEqual([])
  })

  it('reads the numbers by name, the phone as the inbox keeps it, the older number field too', () => {
    expect(parseQuoNumbers(QUO_NUMBERS)).toEqual([
      { id: 'PNbids02', name: 'Bids', symbol: '', number: '+15125550199', phone: '(512) 555-0199' },
      { id: 'PNold', name: 'Old shape', symbol: '', number: '+15125550100', phone: '(512) 555-0100' },
      { id: 'PNteam01', name: 'Team line', symbol: '🏡', number: '+15125550144', phone: '(512) 555-0144' },
    ])
    // A number outside the ten-digit shape keeps Quo's own formatting, else its E.164.
    expect(parseQuoNumbers([{ id: 'PNuk', name: 'London', phoneNumber: '+442079460000', formattedNumber: '+44 20 7946 0000' }])[0]!.phone).toBe('+44 20 7946 0000')
    expect(parseQuoNumbers([{ id: 'PNuk', name: 'London', phoneNumber: '+442079460000' }])[0]!.phone).toBe('+442079460000')
  })

  it('reads the whole directory from quo-config’s answer, or null', () => {
    const d = parseQuoDirectory({ ok: true, set: true, source: 'vault', numbers: QUO_NUMBERS, members: QUO_USERS })
    expect(d?.members.map((m) => m.id)).toEqual(['USnoname', 'USrobert1', 'USrosa2'])
    expect(d?.numbers.map((n) => n.id)).toEqual(['PNbids02', 'PNold', 'PNteam01'])
    expect(parseQuoDirectory({ ok: false, error: 'No Quo key yet.' })).toBeNull()
    expect(parseQuoDirectory({ ok: true, numbers: [] })).toBeNull()
    expect(directoryWords(d!)).toBe('Quo answered: 3 numbers and 3 people.')
    expect(directoryWords({ members: [d!.members[0]!], numbers: [d!.numbers[0]!] })).toBe('Quo answered: 1 number and 1 person.')
  })

  it('labels a member and a number for the picker, the id never in the option', () => {
    const [office, , rosa] = parseQuoMembers(QUO_USERS)
    expect(memberLabel(rosa!)).toBe('Rosa Diaz, rosa@plumbing.example')
    expect(memberLabel(office!)).toBe('office, office@plumbing.example')
    expect(memberLabel({ id: 'USx', name: 'USx', email: '', role: '' })).toBe('USx')
    const [bids, , team] = parseQuoNumbers(QUO_NUMBERS)
    expect(numberLabel(team!)).toBe('🏡 Team line, (512) 555-0144')
    expect(numberLabel(bids!)).toBe('Bids, (512) 555-0199')
    expect(numberLabel({ id: 'PNx', name: '(512) 555-0100', symbol: '', number: '+15125550100', phone: '(512) 555-0100' })).toBe('(512) 555-0100')
  })
})

describe('the cards’ state', () => {
  const saved = { set: true, source: 'vault' as const, last4: 'ab12', savedAt: NOW, savedBy: 'Robert' }
  const directory = { members: parseQuoMembers(QUO_USERS), numbers: parseQuoNumbers(QUO_NUMBERS) }

  it('is loading, then no key, then ready once Quo answered, or read failed', () => {
    expect(connectionState(null, null, false)).toBe('loading')
    expect(connectionState(NO_QUO_KEY, null, false)).toBe('no-key')
    expect(connectionState(saved, null, false)).toBe('loading')
    expect(connectionState(saved, directory, false)).toBe('ready')
    expect(connectionState(saved, null, true)).toBe('read-failed')
    expect(connectionState(null, null, true)).toBe('read-failed')
  })

  it('shows a picker only when ready with something to list, and knows an id the picker holds', () => {
    expect(pickerShows('ready', 3)).toBe(true)
    expect(pickerShows('ready', 0)).toBe(false)
    expect(pickerShows('no-key', 3)).toBe(false)
    expect(pickerShows('read-failed', 3)).toBe(false)
    expect(pickerShows('off', 3)).toBe(false)
    expect(idListed(' USrosa2 ', directory.members)).toBe(true)
    expect(idListed('USgone', directory.members)).toBe(false)
    expect(idListed('', directory.members)).toBe(false)
    expect(BY_HAND).not.toMatch(/^(US|PN)/)
  })
})
