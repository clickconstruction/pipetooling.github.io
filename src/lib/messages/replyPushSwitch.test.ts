import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  canSwitchReplyPush,
  REPLY_PUSH_CONFIRM,
  REPLY_PUSH_NOT_SAVED,
  REPLY_PUSH_OFF_TOAST,
  REPLY_PUSH_ON_TOAST,
  REPLY_PUSH_TITLE,
  REPLY_PUSH_WHAT,
  replyPushIsOn,
  replyPushStateWords,
} from './replyPushSwitch'

describe('Reply push', () => {
  it('lets the owner and a dev turn it on or off, as the switch’s policy does', () => {
    expect(canSwitchReplyPush('master_technician')).toBe(true)
    expect(canSwitchReplyPush('dev')).toBe(true)
    expect(canSwitchReplyPush('assistant')).toBe(false)
    expect(canSwitchReplyPush('controller')).toBe(false)
    expect(canSwitchReplyPush('primary')).toBe(false)
    expect(canSwitchReplyPush(null)).toBe(false)
  })

  it('reads on only for the word the cron and the function read', () => {
    expect(replyPushIsOn('true')).toBe(true)
    expect(replyPushIsOn('false')).toBe(false)
    expect(replyPushIsOn('TRUE')).toBe(false)
    expect(replyPushIsOn(' true')).toBe(false)
    expect(replyPushIsOn(null)).toBe(false)
    expect(replyPushIsOn(undefined)).toBe(false)
  })

  it('says what happens while it is on, and that nobody is pushed while it is off', () => {
    expect(replyPushStateWords(true)).toBe('Pushes go out within a minute.')
    expect(replyPushStateWords(false)).toBe('Off: nobody is pushed when a customer answers.')
  })

  it('names the three kinds the sweep pushes for', () => {
    expect(REPLY_PUSH_WHAT).toContain('a customer, a lead or a sub')
  })

  it('keeps every word plain', () => {
    const all = [
      REPLY_PUSH_TITLE,
      REPLY_PUSH_WHAT,
      REPLY_PUSH_CONFIRM.title,
      REPLY_PUSH_CONFIRM.message,
      REPLY_PUSH_CONFIRM.confirmLabel,
      REPLY_PUSH_ON_TOAST,
      REPLY_PUSH_OFF_TOAST,
      REPLY_PUSH_NOT_SAVED,
      replyPushStateWords(true),
      replyPushStateWords(false),
    ]
    expect(all.flatMap(plainWordsFailures)).toEqual([])
  })
})
