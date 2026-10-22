import { describe, expect, it } from 'vitest'
import { ownChannels } from '../messages/ownChannels'
import { channelKey, kitCarries, numberPlan, parseWalkKit, WALK_KIT_KEY, type WalkKit } from './kit'

const KIT: WalkKit = {
  customerId: 'cu-walk',
  contactId: 'c-walk',
  emailChannelId: 'ch-walk-email',
  phoneChannelId: 'ch-walk-phone',
  estimateId: 'e-walk',
  email: 'bids@clickplumbing.example',
  phone: '(737) 300-9478',
  testerId: 'u-tester',
  sharedPhone: false,
  madeAt: '2026-10-22T14:00:00.000Z',
}

const OWN = ownChannels(
  {
    team: { address: 'team@clickplumbing.example', phone: '(512) 994-2774', numberId: 'PN-team' },
    bids: { address: 'bids@clickplumbing.example', phone: '(737) 300-9478', numberId: 'PN-bids' },
  },
  'team@noreply.clicktooling.example',
)

describe('parseWalkKit (punch list #142 PR 1): the kit as walk_setup wrote it', () => {
  it('reads the row back, trimming each id and reading a missing field as null', () => {
    expect(WALK_KIT_KEY).toBe('walk_kit_v1')
    expect(parseWalkKit(JSON.stringify(KIT))).toEqual(KIT)
    expect(parseWalkKit(JSON.stringify({ customerId: ' cu ', contactId: 'c', email: 'Bids@X.example' }))).toEqual({
      customerId: 'cu',
      contactId: 'c',
      emailChannelId: null,
      phoneChannelId: null,
      estimateId: null,
      email: 'Bids@X.example',
      phone: null,
      testerId: null,
      sharedPhone: false,
      madeAt: null,
    })
    expect(parseWalkKit(JSON.stringify({ ...KIT, sharedPhone: 'yes' }))?.sharedPhone).toBe(false)
  })

  it('is null for no row, bad JSON, a list, or a row without the contact, the customer or the address', () => {
    expect(parseWalkKit(null)).toBeNull()
    expect(parseWalkKit(undefined)).toBeNull()
    expect(parseWalkKit('')).toBeNull()
    expect(parseWalkKit('{not json')).toBeNull()
    expect(parseWalkKit('[]')).toBeNull()
    expect(parseWalkKit('"text"')).toBeNull()
    expect(parseWalkKit(JSON.stringify({ customerId: 'cu', contactId: 'c' }))).toBeNull()
    expect(parseWalkKit(JSON.stringify({ customerId: 'cu', email: 'x@y' }))).toBeNull()
    expect(parseWalkKit(JSON.stringify({ contactId: '', customerId: 'cu', email: 'x@y' }))).toBeNull()
  })
})

describe('channelKey: the same key as public.contact_channel_key', () => {
  it('reads a number as its ten digits, a leading 1 dropped, and nothing under seven', () => {
    expect(channelKey('phone', '+1 (210) 555-0113')).toBe('2105550113')
    expect(channelKey('phone', '2105550113')).toBe('2105550113')
    expect(channelKey('phone', '12105550113')).toBe('2105550113')
    expect(channelKey('phone', '+44 20 7946 0958')).toBe('442079460958')
    expect(channelKey('phone', '555-01')).toBe('')
    expect(channelKey('phone', '')).toBe('')
    expect(channelKey('phone', null)).toBe('')
  })

  it('reads an address lower-cased and trimmed, and nothing without an @', () => {
    expect(channelKey('email', ' Greg@Hillside.Example ')).toBe('greg@hillside.example')
    expect(channelKey('email', 'not an address')).toBe('')
    expect(channelKey('email', undefined)).toBe('')
  })
})

describe('kitCarries: whether the kit’s contact carries an address or a number', () => {
  it('matches the kit’s address and number by key, in any case or spacing', () => {
    expect(kitCarries(KIT, 'email', 'BIDS@clickplumbing.example')).toBe(true)
    expect(kitCarries(KIT, 'email', ' bids@clickplumbing.example ')).toBe(true)
    expect(kitCarries(KIT, 'phone', '+17373009478')).toBe(true)
    expect(kitCarries(KIT, 'phone', '737.300.9478')).toBe(true)
  })

  it('is false for another address or number, a value with no key, a kit with no number, and no kit', () => {
    expect(kitCarries(KIT, 'email', 'team@clickplumbing.example')).toBe(false)
    expect(kitCarries(KIT, 'phone', '+15129942774')).toBe(false)
    expect(kitCarries(KIT, 'email', '')).toBe(false)
    expect(kitCarries(KIT, 'phone', 'none')).toBe(false)
    expect(kitCarries({ ...KIT, phone: null }, 'phone', '+17373009478')).toBe(false)
    expect(kitCarries(null, 'email', 'bids@clickplumbing.example')).toBe(false)
    expect(kitCarries(null, 'phone', '+17373009478')).toBe(false)
  })
})

describe('numberPlan: what quo-webhook does with a number', () => {
  it('places a number that is not ours, with or without a kit', () => {
    expect(numberPlan('+12105550100', OWN, KIT)).toBe('place')
    expect(numberPlan('+12105550100', OWN, null)).toBe('place')
  })

  it('places our own number only when the kit carries it, and skips it otherwise', () => {
    expect(numberPlan('+17373009478', OWN, KIT)).toBe('place')
    expect(numberPlan('(737) 300-9478', OWN, KIT)).toBe('place')
    expect(numberPlan('+15129942774', OWN, KIT)).toBe('skip')
    expect(numberPlan('+17373009478', OWN, null)).toBe('skip')
    expect(numberPlan('+15129942774', OWN, null)).toBe('skip')
  })
})
