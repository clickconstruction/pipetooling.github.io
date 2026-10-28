import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  developmentSuggestionWords,
  normalizeAddressKey,
  suggestDevelopmentByAddress,
  type DevelopmentMember,
  type DevelopmentNameRow,
} from './notInIt'

const developments: DevelopmentNameRow[] = [
  { id: 'harlow', name: 'Harlow Ranch', archived_at: null },
  { id: 'gundog', name: 'Gun Dog', archived_at: null },
  { id: 'old', name: 'Old Town', archived_at: '2026-07-01' },
  { id: 'blank', name: '  ', archived_at: null },
]

function member(kind: 'bid' | 'job', id: string, address: string | null, developmentId: string | null): DevelopmentMember {
  return { kind, id, address, developmentId }
}

describe('normalizeAddressKey', () => {
  it('drops case, punctuation, spacing and a trailing zip', () => {
    expect(normalizeAddressKey('  Gun Dog Trail, Neeses, SC 29107 ')).toBe('gun dog trail neeses sc')
    expect(normalizeAddressKey('gun dog trail neeses sc')).toBe('gun dog trail neeses sc')
    expect(normalizeAddressKey('12925 FM 20, Kingsbury, Texas 78638-1234')).toBe('12925 fm 20 kingsbury texas')
  })

  it('spells the common street suffixes one way', () => {
    expect(normalizeAddressKey('Gun Dog Trl, Neeses SC')).toBe(normalizeAddressKey('Gun Dog Trail, Neeses, SC'))
    expect(normalizeAddressKey('400 Harlow Ranch Rd., Lott, TX')).toBe('400 harlow ranch road lott tx')
    expect(normalizeAddressKey('12 N Main St')).toBe('12 north main street')
  })

  it('keeps a different street number a different address', () => {
    expect(normalizeAddressKey('400 Harlow Ranch Rd')).not.toBe(normalizeAddressKey('402 Harlow Ranch Rd'))
  })

  it('is empty for a blank address, so blanks never match each other', () => {
    expect(normalizeAddressKey('')).toBe('')
    expect(normalizeAddressKey(null)).toBe('')
    expect(normalizeAddressKey('  , .  ')).toBe('')
  })
})

describe('suggestDevelopmentByAddress', () => {
  const members: DevelopmentMember[] = [
    member('bid', 'b1', 'Gun Dog Trail, Neeses, SC', 'gundog'),
    member('bid', 'b2', 'gun dog trl, neeses sc 29107', 'gundog'),
    member('job', 'j1', 'Gun Dog Trail, Neeses, SC', 'gundog'),
    member('job', 'j2', 'Gun Dog Trail, Neeses, SC', 'gundog'),
    member('job', 'j3', 'Gun Dog Trail, Neeses, SC', 'gundog'),
    member('job', 'j4', '400 Harlow Ranch Rd, Lott, TX', 'harlow'),
    member('job', 'j5', 'Gun Dog Trail, Neeses, SC', null),
  ]

  it('names the development whose members share the address, with the counts of each kind', () => {
    expect(suggestDevelopmentByAddress({ address: 'Gun Dog Trail, Neeses, SC', developmentId: null, members, developments })).toEqual({
      developmentId: 'gundog',
      name: 'Gun Dog',
      bids: 2,
      jobs: 3,
    })
  })

  it('matches through the normalized address, not the exact string', () => {
    expect(suggestDevelopmentByAddress({ address: 'GUN DOG TRL, NEESES, SC 29107', developmentId: null, members, developments })?.name).toBe('Gun Dog')
  })

  it('is quiet when the record already has a development, the address is blank, or nobody at the address is in one', () => {
    expect(suggestDevelopmentByAddress({ address: 'Gun Dog Trail, Neeses, SC', developmentId: 'harlow', members, developments })).toBeNull()
    expect(suggestDevelopmentByAddress({ address: '', developmentId: null, members, developments })).toBeNull()
    expect(suggestDevelopmentByAddress({ address: '9 Nowhere Ln', developmentId: null, members, developments })).toBeNull()
  })

  it('never counts the record itself, and never names an archived or unnamed development', () => {
    expect(suggestDevelopmentByAddress({ address: 'Gun Dog Trail, Neeses, SC', developmentId: null, selfId: 'b1', members, developments })?.bids).toBe(1)
    const archivedOnly = [member('job', 'j9', '1 Old Town Sq', 'old'), member('job', 'j10', '1 Old Town Sq', 'blank')]
    expect(suggestDevelopmentByAddress({ address: '1 Old Town Sq', developmentId: null, members: archivedOnly, developments })).toBeNull()
  })

  it('with members in two developments at one address, names the one with more of them', () => {
    const split = [
      member('job', 'j1', '1 Shared Way', 'harlow'),
      member('bid', 'b1', '1 Shared Way', 'gundog'),
      member('job', 'j2', '1 Shared Way', 'gundog'),
    ]
    expect(suggestDevelopmentByAddress({ address: '1 Shared Way', developmentId: null, members: split, developments })?.name).toBe('Gun Dog')
  })
})

describe('developmentSuggestionWords', () => {
  it('counts each kind, leaves out a side with nothing, and names the press', () => {
    expect(developmentSuggestionWords({ developmentId: 'h', name: 'Harlow Ranch', bids: 4, jobs: 6 })).toEqual({
      line: '4 bids and 6 jobs at this address are in Harlow Ranch.',
      button: 'Put it in Harlow Ranch',
    })
    expect(developmentSuggestionWords({ developmentId: 'h', name: 'Harlow Ranch', bids: 3, jobs: 0 }).line).toBe('3 bids at this address are in Harlow Ranch.')
    expect(developmentSuggestionWords({ developmentId: 'h', name: 'Harlow Ranch', bids: 0, jobs: 1 }).line).toBe('1 job at this address is in Harlow Ranch.')
  })

  it('reads in plain words', () => {
    const { line } = developmentSuggestionWords({ developmentId: 'g', name: 'Gun Dog', bids: 13, jobs: 29 })
    expect(plainWordsFailures(line)).toEqual([])
  })
})
