import { describe, expect, it } from 'vitest'
import { LEGAL_NOTIFY_MAX_TRIES, constantTimeEqual, legalNotReachingLine, legalNotifyDone, legalNotifyDue, legalNotifyRecord, legalRecipientSendPatch, legalUnsubscribeSecret, legalUnsubscribeToken, parseSentTo } from './legalNotifyLedger'

const NOW = '2026-10-05T15:00:00Z'

describe('legalNotifyDue / Record / Done · v2.4662', () => {
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

describe('legalRecipientSendPatch · v2.4662', () => {
  it('keeps the first failure’s time, takes the newest error, clears on success', () => {
    expect(legalRecipientSendPatch(null, { success: false, error: 'bounced' }, NOW)).toEqual({ send_failed_since: NOW, send_error: 'bounced' })
    expect(legalRecipientSendPatch('2026-10-04T10:00:00Z', { success: false, error: 'again' }, NOW)).toEqual({ send_failed_since: '2026-10-04T10:00:00Z', send_error: 'again' })
    expect(legalRecipientSendPatch('2026-10-04T10:00:00Z', { success: true }, NOW)).toEqual({ send_failed_since: null, send_error: null })
  })
})

describe('legalNotReachingLine · v2.4662', () => {
  it('the office reads the mail service’s words; the firm reads what to do', () => {
    expect(legalNotReachingLine({ email: 'bo@firm.test', sinceYmd: '2026-10-05', error: 'The to address is invalid.' }, 'office')).toBe('Could not reach bo@firm.test since 2026-10-05: The to address is invalid. The queue tries each email again every five minutes, for an hour.')
    expect(legalNotReachingLine({ email: 'bo@firm.test', sinceYmd: '2026-10-05', error: null }, 'office')).toBe('Could not reach bo@firm.test since 2026-10-05. The queue tries each email again every five minutes, for an hour.')
    expect(legalNotReachingLine({ email: 'bo@firm.test', sinceYmd: '2026-10-05' }, 'firm')).toBe('Our emails to bo@firm.test have not gone through since 2026-10-05. We try each one again every five minutes for an hour. If the address is wrong, press Stop emails to this person and add the right one.')
  })
  it('says what is really tried again: never a confirmation, a digest for the rest of its day', () => {
    const unconfirmed = { email: 'bo@firm.test', sinceYmd: '2026-10-05', confirmed: false }
    expect(legalNotReachingLine(unconfirmed, 'firm')).toContain('Press Resend the confirmation')
    expect(legalNotReachingLine(unconfirmed, 'firm')).not.toMatch(/for an hour/)
    expect(legalNotReachingLine(unconfirmed, 'office')).toContain('the firm presses Resend the confirmation')
    expect(legalNotReachingLine(unconfirmed, 'office')).not.toMatch(/for an hour/)
    const digest = { email: 'bo@firm.test', sinceYmd: '2026-10-05', confirmed: true, mode: 'digest' }
    expect(legalNotReachingLine(digest, 'firm')).toContain('rest of its day')
    expect(legalNotReachingLine(digest, 'office')).not.toMatch(/for an hour/)
  })
})

describe('legalUnsubscribeSecret · v2.4662', () => {
  it('prefers its own secret, falls back to the service key, and is empty when both are', () => {
    expect(legalUnsubscribeSecret('own', 'svc')).toBe('own')
    expect(legalUnsubscribeSecret('  ', 'svc')).toBe('svc')
    expect(legalUnsubscribeSecret(undefined, '')).toBe('')
  })
})

describe('constantTimeEqual · v2.4662', () => {
  it('equal only when every byte and the length match', () => {
    expect(constantTimeEqual('cron-secret', 'cron-secret')).toBe(true)
    expect(constantTimeEqual('cron-secret', 'cron-secreT')).toBe(false)
    expect(constantTimeEqual('cron-secret', 'cron-secret-longer')).toBe(false)
    expect(constantTimeEqual('', 'x')).toBe(false)
    expect(constantTimeEqual('', '')).toBe(true)
  })
})

describe('legalUnsubscribeToken · v2.4662 · minted once', () => {
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

describe('legalDigestSince · v2.6283 · each digest reads back to its own person', () => {
  it('reads from the last digest, else the confirmation, never more than eight days back', async () => {
    const { legalDigestSince, LEGAL_DIGEST_MAX_DAYS } = await import('./legalNotifyLedger')
    const now = '2026-11-02T13:00:00.000Z'
    expect(legalDigestSince({ last_digest_at: '2026-10-28T13:00:00Z', confirmed_at: '2026-09-01T00:00:00Z' }, now)).toBe('2026-10-28T13:00:00.000Z')
    expect(legalDigestSince({ last_digest_at: null, confirmed_at: '2026-10-30T09:00:00Z' }, now)).toBe('2026-10-30T09:00:00.000Z')
    expect(LEGAL_DIGEST_MAX_DAYS).toBe(8)
    expect(legalDigestSince({ last_digest_at: '2026-09-01T00:00:00Z', confirmed_at: '2026-08-01T00:00:00Z' }, now)).toBe('2026-10-25T13:00:00.000Z')
    expect(legalDigestSince({ last_digest_at: 'junk', confirmed_at: null }, now)).toBe('2026-10-25T13:00:00.000Z')
  })
})

describe('legalDigestShows · v2.6283 · a line the office held back or undid since it was queued is left out', () => {
  it('collects each line’s entry, paper and matter once', async () => {
    const { legalDigestSourceIds } = await import('./legalNotifyLedger')
    expect(legalDigestSourceIds([
      { matter_id: 'm1', payload: { entryId: 'x1' } },
      { matter_id: 'm1', payload: { entryId: 'x2' } },
      { matter_id: 'm2', payload: { documentId: 'd1' } },
      { matter_id: 'm3', payload: { payer: 'A release has no source id' } },
      { matter_id: 'm1', payload: { entryId: 'x1' } },
    ])).toEqual({ entryIds: ['x1', 'x2'], documentIds: ['d1'], matterIds: ['m1'] })
  })

  it('reads each source as the portal does: undone, missing or held entries and voided or held papers stay out', async () => {
    const { legalDigestShows } = await import('./legalNotifyLedger')
    const s = {
      entries: new Map([
        ['step', { kind: 'step', voided: false }],
        ['undone', { kind: 'note', voided: true }],
        ['plan-held', { kind: 'plan', voided: false }],
        ['plan-open', { kind: 'plan', voided: false }],
        ['statement-held', { kind: 'statement', voided: false }],
        // A step is never held from counsel, so a held_overrides key in its shape changes nothing.
        ['step-keyed', { kind: 'step', voided: false }],
      ]),
      documents: new Map([
        ['paper', { held: false, voided: false }],
        ['paper-held', { held: true, voided: false }],
        ['paper-voided', { held: false, voided: true }],
      ]),
      held: new Map([['m1', { 'plan:plan-held': true, 'statement:statement-held': true, 'step:step-keyed': true, 'plan:plan-open': false, _reasons: { 'plan:plan-held': 'not yet' } }]]),
    }
    const shows = (payload: Record<string, unknown>) => legalDigestShows({ matter_id: 'm1', payload }, s)
    expect(shows({ entryId: 'step' })).toBe(true)
    expect(shows({ entryId: 'plan-open' })).toBe(true)
    expect(shows({ entryId: 'step-keyed' })).toBe(true)
    expect(shows({ entryId: 'undone' })).toBe(false)
    expect(shows({ entryId: 'plan-held' })).toBe(false)
    expect(shows({ entryId: 'statement-held' })).toBe(false)
    expect(shows({ entryId: 'gone' })).toBe(false)
    expect(shows({ documentId: 'paper' })).toBe(true)
    expect(shows({ documentId: 'paper-held' })).toBe(false)
    expect(shows({ documentId: 'paper-voided' })).toBe(false)
    expect(shows({ documentId: 'gone' })).toBe(false)
    expect(shows({ payer: 'A release, a pull-back, a fee seen' })).toBe(true)
  })
})
