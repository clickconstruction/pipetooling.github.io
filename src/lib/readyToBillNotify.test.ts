import { describe, expect, it } from 'vitest'
import {
  DEFAULT_READY_TO_BILL_NOTIFY_CHANNELS,
  composeRecipientPrefsFromV1,
  parseReadyToBillNotifyChannels,
  parseReadyToBillRecipientPrefs,
  serializeReadyToBillNotifyChannels,
  serializeReadyToBillRecipientPrefs,
} from './readyToBillNotify'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'

describe('parseReadyToBillRecipientPrefs (v2)', () => {
  it('missing/blank/garbage/non-array falls back to []', () => {
    for (const v of [null, undefined, '', '  ', 'not json', '{"id":"x"}', '42']) {
      expect(parseReadyToBillRecipientPrefs(v)).toEqual([])
    }
  })

  it('parses entries, defaults missing channels to on, drops bad ids and both-off entries', () => {
    const parsed = parseReadyToBillRecipientPrefs(
      JSON.stringify([
        { id: A, email: true, push: false },
        { id: B }, // missing channels ⇒ both on
        { id: 'not-a-uuid', email: true, push: true },
        { id: A, email: false, push: true }, // duplicate id ⇒ dropped
        { id: '33333333-3333-4333-8333-333333333333', email: false, push: false }, // both off ⇒ dropped
        'garbage',
      ]),
    )
    expect(parsed).toEqual([
      { id: A, email: true, push: false },
      { id: B, email: true, push: true },
    ])
  })

  it('round-trips through serialize, dropping both-off entries', () => {
    const prefs = [
      { id: A, email: false, push: true },
      { id: B, email: true, push: true },
    ]
    expect(parseReadyToBillRecipientPrefs(serializeReadyToBillRecipientPrefs(prefs))).toEqual(prefs)
    expect(
      serializeReadyToBillRecipientPrefs([{ id: A, email: false, push: false }]),
    ).toBe('[]')
  })
})

describe('composeRecipientPrefsFromV1', () => {
  it('applies the org-wide channels to every v1 id', () => {
    expect(composeRecipientPrefsFromV1([A, B], { email: true, push: false })).toEqual([
      { id: A, email: true, push: false },
      { id: B, email: true, push: false },
    ])
  })

  it('both channels off yields no recipients', () => {
    expect(composeRecipientPrefsFromV1([A], { email: false, push: false })).toEqual([])
  })
})

describe('parseReadyToBillNotifyChannels', () => {
  it('missing/blank/garbage falls back to both channels on', () => {
    for (const v of [null, undefined, '', '   ', 'not json', '42', '[]', '["email"]']) {
      expect(parseReadyToBillNotifyChannels(v)).toEqual({ email: true, push: true })
    }
  })

  it('only an explicit false disables a channel', () => {
    expect(parseReadyToBillNotifyChannels('{"email":false,"push":true}')).toEqual({
      email: false,
      push: true,
    })
    expect(parseReadyToBillNotifyChannels('{"email":true,"push":false}')).toEqual({
      email: true,
      push: false,
    })
    expect(parseReadyToBillNotifyChannels('{"email":false,"push":false}')).toEqual({
      email: false,
      push: false,
    })
    // Partial objects keep the missing channel on.
    expect(parseReadyToBillNotifyChannels('{"push":false}')).toEqual({ email: true, push: false })
    // Truthy-but-not-boolean junk does not disable.
    expect(parseReadyToBillNotifyChannels('{"email":0,"push":"no"}')).toEqual({
      email: true,
      push: true,
    })
  })

  it('round-trips through serialize', () => {
    for (const channels of [
      { email: true, push: true },
      { email: false, push: true },
      { email: true, push: false },
      { email: false, push: false },
    ]) {
      expect(parseReadyToBillNotifyChannels(serializeReadyToBillNotifyChannels(channels))).toEqual(
        channels,
      )
    }
  })

  it('default constant is both on', () => {
    expect(DEFAULT_READY_TO_BILL_NOTIFY_CHANNELS).toEqual({ email: true, push: true })
  })
})
