import { describe, expect, it } from 'vitest'
import type { WalkKit } from './kit'
import { KIT_DOOR_WORDS, isFixtureAccount, isWalkTester, kitDoorVerdict } from './kitDoor'

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

const tester = { id: 'u-tester', is_walk_tester: true, is_sample: false, is_digital_twin: false, read_only: true }
const office = { id: 'u-pat', is_walk_tester: false, is_sample: false, is_digital_twin: false, read_only: false }
const REFUSED = { ok: false, refused: 'walkTesterOnly', words: KIT_DOOR_WORDS }

describe('kitDoorVerdict (punch list #142 PR 5)', () => {
  it('lets anyone who is not the tester through: the door’s own rules apply', () => {
    expect(kitDoorVerdict(office, null, null)).toEqual({ ok: true })
    expect(kitDoorVerdict(office, KIT, { kind: 'channel', contactId: 'c-other', channelId: 'ch-other' })).toEqual({ ok: true })
    expect(kitDoorVerdict(null, KIT, null)).toEqual({ ok: true })
    expect(kitDoorVerdict({ ...tester, is_sample: true }, KIT, { kind: 'estimate', estimateId: 'e-walk', customerEmail: KIT.email })).toEqual({ ok: true })
  })

  it('lets the tester send at the kit’s two channels on the kit’s contact, and nowhere else', () => {
    expect(kitDoorVerdict(tester, KIT, { kind: 'channel', contactId: 'c-walk', channelId: 'ch-walk-phone' })).toEqual({ ok: true })
    expect(kitDoorVerdict(tester, KIT, { kind: 'channel', contactId: 'c-walk', channelId: 'ch-walk-email' })).toEqual({ ok: true })
    expect(kitDoorVerdict(tester, KIT, { kind: 'channel', contactId: 'c-other', channelId: 'ch-walk-phone' })).toEqual(REFUSED)
    expect(kitDoorVerdict(tester, KIT, { kind: 'channel', contactId: 'c-walk', channelId: 'ch-other' })).toEqual(REFUSED)
    expect(kitDoorVerdict(tester, KIT, { kind: 'channel', contactId: '', channelId: '' })).toEqual(REFUSED)
    expect(kitDoorVerdict(tester, { ...KIT, phoneChannelId: null }, { kind: 'channel', contactId: 'c-walk', channelId: 'ch-walk-phone' })).toEqual(REFUSED)
  })

  it('lets the tester send the kit’s estimate at the kit’s address, compared as the channel key is', () => {
    expect(kitDoorVerdict(tester, KIT, { kind: 'estimate', estimateId: 'e-walk', customerEmail: ' Bids@ClickPlumbing.example ' })).toEqual({ ok: true })
    expect(kitDoorVerdict(tester, KIT, { kind: 'estimate', estimateId: 'e-other', customerEmail: KIT.email })).toEqual(REFUSED)
    expect(kitDoorVerdict(tester, KIT, { kind: 'estimate', estimateId: 'e-walk', customerEmail: 'dana@example.com' })).toEqual(REFUSED)
    expect(kitDoorVerdict(tester, KIT, { kind: 'estimate', estimateId: 'e-walk', customerEmail: '' })).toEqual(REFUSED)
    expect(kitDoorVerdict(tester, { ...KIT, estimateId: null }, { kind: 'estimate', estimateId: 'e-walk', customerEmail: KIT.email })).toEqual(REFUSED)
  })

  it('refuses the tester with no kit, or a target the door could not read', () => {
    expect(kitDoorVerdict(tester, null, { kind: 'channel', contactId: 'c-walk', channelId: 'ch-walk-phone' })).toEqual(REFUSED)
    expect(kitDoorVerdict(tester, KIT, null)).toEqual(REFUSED)
  })

  it('knows the tester and the fixtures apart', () => {
    expect(isWalkTester(tester)).toBe(true)
    expect(isWalkTester(office)).toBe(false)
    expect(isWalkTester({ ...tester, is_digital_twin: true })).toBe(false)
    expect(isWalkTester({ id: 'u-x' })).toBe(false)
    expect(isWalkTester(null)).toBe(false)
    expect(isFixtureAccount({ id: 'u-s', is_sample: true })).toBe(true)
    expect(isFixtureAccount({ id: 'u-t', is_digital_twin: true })).toBe(true)
    expect(isFixtureAccount(office)).toBe(false)
    expect(isFixtureAccount(undefined)).toBe(false)
  })
})
