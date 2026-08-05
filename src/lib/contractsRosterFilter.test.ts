import { describe, expect, it } from 'vitest'
import {
  contractsRosterBucket,
  defaultContractsRosterFilter,
  parseContractsRosterFilter,
  personVisibleUnderContractsFilter,
} from './contractsRosterFilter'

describe('contractsRosterBucket', () => {
  it('anything unsent wins', () => {
    expect(contractsRosterBucket({ unsent: 1, sent: 2, signed: 3 })).toBe('attention')
  })
  it('sent without unsent is waiting', () => {
    expect(contractsRosterBucket({ unsent: 0, sent: 1, signed: 3 })).toBe('waiting')
  })
  it('all signed is done', () => {
    expect(contractsRosterBucket({ unsent: 0, sent: 0, signed: 2 })).toBe('done')
  })
  it('no documents is none', () => {
    expect(contractsRosterBucket({ unsent: 0, sent: 0, signed: 0 })).toBe('none')
  })
})

describe('personVisibleUnderContractsFilter', () => {
  it('everyone shows every bucket including none', () => {
    for (const b of ['attention', 'waiting', 'done', 'none'] as const) {
      expect(personVisibleUnderContractsFilter(b, 'everyone')).toBe(true)
    }
  })
  it('specific filters match only their bucket', () => {
    expect(personVisibleUnderContractsFilter('attention', 'attention')).toBe(true)
    expect(personVisibleUnderContractsFilter('waiting', 'attention')).toBe(false)
    expect(personVisibleUnderContractsFilter('none', 'done')).toBe(false)
  })
})

describe('parseContractsRosterFilter', () => {
  it('accepts the four valid values and rejects junk', () => {
    expect(parseContractsRosterFilter('attention')).toBe('attention')
    expect(parseContractsRosterFilter('everyone')).toBe('everyone')
    expect(parseContractsRosterFilter('nope')).toBeNull()
    expect(parseContractsRosterFilter(null)).toBeNull()
    expect(parseContractsRosterFilter(undefined)).toBeNull()
  })
})

describe('defaultContractsRosterFilter', () => {
  it('opens on the actionable list only when it has anyone', () => {
    expect(defaultContractsRosterFilter(3)).toBe('attention')
    expect(defaultContractsRosterFilter(0)).toBe('everyone')
  })
})
