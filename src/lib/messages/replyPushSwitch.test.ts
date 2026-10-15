import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  canSwitchReplyPush,
  OFFICE_WAIT_BAD,
  OFFICE_WAIT_FIELD,
  OFFICE_WAIT_LABEL,
  OFFICE_WAIT_NOT_SAVED,
  OFFICE_WAIT_SAVE,
  OFFICE_WAIT_SAVED_TOAST,
  OFFICE_WAIT_WHAT,
  officeWaitLine,
  parseOfficeWait,
  readOfficeWait,
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

  it('reads the office’s wait as the row keeps it, with the default for a row it cannot read (v2.5540)', () => {
    expect(readOfficeWait(15)).toBe(15)
    expect(readOfficeWait(0)).toBe(0)
    expect(readOfficeWait(7.6)).toBe(8)
    expect(readOfficeWait(null)).toBe(15)
    expect(readOfficeWait(undefined)).toBe(15)
    expect(readOfficeWait(-5)).toBe(15)
    expect(readOfficeWait(Number.NaN)).toBe(15)
  })

  it('takes a whole number of minutes from 0 to 240 and nothing else', () => {
    expect(parseOfficeWait('15')).toBe(15)
    expect(parseOfficeWait(' 0 ')).toBe(0)
    expect(parseOfficeWait('240')).toBe(240)
    expect(parseOfficeWait('241')).toBeNull()
    expect(parseOfficeWait('-3')).toBeNull()
    expect(parseOfficeWait('1.5')).toBeNull()
    expect(parseOfficeWait('')).toBeNull()
    expect(parseOfficeWait('ten')).toBeNull()
  })

  it('says what the wait means, at once at 0 and one minute without an s', () => {
    expect(officeWaitLine(0)).toBe('The office hears at once, with whoever has it.')
    expect(officeWaitLine(1)).toBe('The office hears after 1 minute when nobody writes back.')
    expect(officeWaitLine(15)).toBe('The office hears after 15 minutes when nobody writes back.')
  })

  it('keeps every word plain', () => {
    const all = [
      OFFICE_WAIT_LABEL,
      OFFICE_WAIT_FIELD,
      OFFICE_WAIT_SAVE,
      OFFICE_WAIT_WHAT,
      OFFICE_WAIT_SAVED_TOAST,
      OFFICE_WAIT_NOT_SAVED,
      OFFICE_WAIT_BAD,
      officeWaitLine(0),
      officeWaitLine(1),
      officeWaitLine(15),
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
