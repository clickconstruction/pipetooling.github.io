import { describe, expect, it } from 'vitest'
import { replyHeadWords, replyKindFor } from './replyHeadWords'

describe('replyHeadWords (v2.6691)', () => {
  it('names the line by its kind and clock', () => {
    expect(replyHeadWords({ timeLabel: '9:05a', message: { withName: 'Dana', channel: 'text', channelWord: 'text' } })).toBe('Replying to Dana’s text · 9:05a')
    expect(replyHeadWords({ timeLabel: '2:47p', message: { withName: 'Dana', channel: 'email', channelWord: 'email' } })).toBe('Replying to Dana’s email · 2:47p')
    expect(replyHeadWords({ timeLabel: '8:00a', message: { withName: 'Dana', channel: 'call', channelWord: 'call · 3:12' } })).toBe('Replying to Dana’s call · 3:12 · 8:00a')
    expect(replyHeadWords({ timeLabel: '8:01a', message: { withName: 'Dana', channel: 'missed', channelWord: 'missed call' } })).toBe('Replying to Dana’s missed call · 8:01a')
  })

  it('answers an email by email and everything else by text', () => {
    expect(replyKindFor('email')).toBe('email')
    for (const c of ['text', 'call', 'missed', 'voicemail', 'portal'] as const) expect(replyKindFor(c)).toBe('text')
  })
})
