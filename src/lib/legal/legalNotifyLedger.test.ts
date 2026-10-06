import { describe, expect, it } from 'vitest'
import { LEGAL_NOTIFY_MAX_TRIES, constantTimeEqual, legalNotReachingLine, legalNotifyDone, legalNotifyDue, legalNotifyRecord, legalRecipientSendPatch, legalUnsubscribeToken, parseSentTo } from './legalNotifyLedger'

const NOW = '2026-10-05T15:00:00Z'

describe('legalNotifyDue / Record / Done · v2.4632', () => {
  it('freezes the targets on the first tick and sends to all of them', () => {
    const p = legalNotifyDue({}, ['ann', 'bo'])
    expect(p.due).toEqual(['ann', 'bo'])
    expect(p.sentTo).toEqual({ ann: { tries: 0 }, bo: { tries: 0 } })
  })

  it('an event with nobody to hear it is done at once', () => {
    const p = legalNotifyDue({}, [])
    expect(p.due).toEqual([])
    expect(legalNotifyDone(p.sentTo)).toBe(true)
  })

  it('a success is stamped, a failure counted; only the failure is due next tick', () => {
    let s = legalNotifyDue({}, ['ann', 'bo']).sentTo
    s = legalNotifyRecord(s, 'ann', { success: true }, NOW)
    s = legalNotifyRecord(s, 'bo', { success: false, error: 'bounced' }, NOW)
    expect(s).toEqual({ ann: { at: NOW, tries: 1 }, bo: { tries: 1, error: 'bounced', last: NOW } })
    expect(legalNotifyDone(s)).toBe(false)
    expect(legalNotifyDue(s, ['ann', 'bo', 'cy']).due).toEqual(['bo'])
  })

  it(`gives up after ${LEGAL_NOTIFY_MAX_TRIES} tries`, () => {
    let s = legalNotifyDue({}, ['bo']).sentTo
    for (let i = 0; i < LEGAL_NOTIFY_MAX_TRIES - 1; i++) s = legalNotifyRecord(s, 'bo', { success: false }, NOW)
    expect(s.bo?.gaveUp).toBeUndefined()
    s = legalNotifyRecord(s, 'bo', { success: false }, NOW)
    expect(s.bo).toMatchObject({ tries: LEGAL_NOTIFY_MAX_TRIES, gaveUp: true })
    expect(legalNotifyDone(s)).toBe(true)
  })

  it('a frozen person no longer on the list is skipped, not retried', () => {
    const s = legalNotifyRecord(legalNotifyDue({}, ['ann', 'bo']).sentTo, 'bo', { success: false }, NOW)
    const p = legalNotifyDue({ ...s, ann: { at: NOW, tries: 1 } }, ['ann'])
    expect(p.due).toEqual([])
    expect(p.sentTo.bo?.skipped).toBeTruthy()
    expect(legalNotifyDone(p.sentTo)).toBe(true)
  })

  it('parseSentTo reads junk as empty', () => {
    expect(parseSentTo(null)).toEqual({})
    expect(parseSentTo([1])).toEqual({})
    expect(parseSentTo({ a: 1, b: { at: NOW } })).toEqual({ b: { at: NOW } })
  })
})

describe('legalRecipientSendPatch · v2.4632', () => {
  it('keeps the first failure’s time, takes the newest error, clears on success', () => {
    expect(legalRecipientSendPatch(null, { success: false, error: 'bounced' }, NOW)).toEqual({ send_failed_since: NOW, send_error: 'bounced' })
    expect(legalRecipientSendPatch('2026-10-04T10:00:00Z', { success: false, error: 'again' }, NOW)).toEqual({ send_failed_since: '2026-10-04T10:00:00Z', send_error: 'again' })
    expect(legalRecipientSendPatch('2026-10-04T10:00:00Z', { success: true }, NOW)).toEqual({ send_failed_since: null, send_error: null })
  })
})

describe('legalNotReachingLine · v2.4632', () => {
  it('the office reads the mail service’s words; the firm reads what to do', () => {
    expect(legalNotReachingLine({ email: 'bo@firm.test', sinceYmd: '2026-10-05', error: 'The to address is invalid.' }, 'office')).toBe('Could not reach bo@firm.test since 2026-10-05: The to address is invalid. The queue tries each email again every five minutes, for an hour.')
    expect(legalNotReachingLine({ email: 'bo@firm.test', sinceYmd: '2026-10-05', error: null }, 'office')).toBe('Could not reach bo@firm.test since 2026-10-05. The queue tries each email again every five minutes, for an hour.')
    expect(legalNotReachingLine({ email: 'bo@firm.test', sinceYmd: '2026-10-05' }, 'firm')).toBe('Our emails to bo@firm.test have not gone through since 2026-10-05. We try each one again for an hour. If the address is wrong, press Stop emails to this person and add the right one.')
  })
})

describe('constantTimeEqual · v2.4632', () => {
  it('equal only when every byte and the length match', () => {
    expect(constantTimeEqual('cron-secret', 'cron-secret')).toBe(true)
    expect(constantTimeEqual('cron-secret', 'cron-secreT')).toBe(false)
    expect(constantTimeEqual('cron-secret', 'cron-secret-longer')).toBe(false)
    expect(constantTimeEqual('', 'x')).toBe(false)
    expect(constantTimeEqual('', '')).toBe(true)
  })
})

describe('legalUnsubscribeToken · v2.4632 · minted once', () => {
  it('the same person and salt give the same token every time; its hash is SHA-256 of it', async () => {
    const a = await legalUnsubscribeToken('key', 'rec-1', null)
    const b = await legalUnsubscribeToken('key', 'rec-1', null)
    expect(a).toEqual(b)
    expect(a.token).toMatch(/^[0-9a-f]{64}$/)
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(a.token))), (x) => x.toString(16).padStart(2, '0')).join('')
    expect(a.hash).toBe(hash)
  })

  it('another person, a new salt or another key each give another token', async () => {
    const a = (await legalUnsubscribeToken('key', 'rec-1', null)).token
    expect((await legalUnsubscribeToken('key', 'rec-2', null)).token).not.toBe(a)
    expect((await legalUnsubscribeToken('key', 'rec-1', 'salt-2')).token).not.toBe(a)
    expect((await legalUnsubscribeToken('other', 'rec-1', null)).token).not.toBe(a)
  })
})
