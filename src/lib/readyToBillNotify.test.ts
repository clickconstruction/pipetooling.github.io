import { describe, expect, it } from 'vitest'
import {
  DEFAULT_READY_TO_BILL_NOTIFY_CHANNELS,
  parseReadyToBillNotifyChannels,
  serializeReadyToBillNotifyChannels,
} from './readyToBillNotify'

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
