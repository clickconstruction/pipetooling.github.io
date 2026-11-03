/**
 * The signing's words and rules (punch list #212, PR 3): each channel's press and hint, what holds a channel, the text's
 * words and the sms address, the in-person flag, the state after a send, the toasts, and the paper path's rules.
 */
import { describe, expect, it } from 'vitest'
import {
  HOURS_STATEMENT_CHANNELS,
  hoursStatementChannelHint,
  hoursStatementChannelLabel,
  hoursStatementChannelProblem,
  hoursStatementScanProblem,
  hoursStatementSentWords,
  hoursStatementStateAfterSend,
  hoursStatementTextBody,
  inPersonUrl,
  scanRowsToPost,
  smsHref,
} from './hoursStatementSigning'

// Every name and number here is made up.
describe('the signing’s channels (punch list #212, PR 3)', () => {
  it('names the four presses by their verb, the phone in the worker’s name', () => {
    expect(HOURS_STATEMENT_CHANNELS).toEqual(['email', 'text', 'link', 'in_person'])
    expect(hoursStatementChannelLabel('email', 'Marcus Reyes')).toBe('Email the link')
    expect(hoursStatementChannelLabel('text', 'Marcus Reyes')).toBe('Text the link')
    expect(hoursStatementChannelLabel('link', 'Marcus Reyes')).toBe('Copy the link')
    expect(hoursStatementChannelLabel('in_person', 'Marcus Reyes')).toBe('Hand the phone to Marcus Reyes')
    expect(hoursStatementChannelLabel('in_person', '')).toBe('Hand the phone to the worker')
    for (const c of HOURS_STATEMENT_CHANNELS) expect(hoursStatementChannelHint(c).length).toBeGreaterThan(20)
  })

  it('holds email and text until the worker has an address or a number that reads as one', () => {
    expect(hoursStatementChannelProblem('email', { email: '', phone: '' })).toBe('Add the worker’s email address first.')
    expect(hoursStatementChannelProblem('email', { email: 'not-mail', phone: '' })).toBe('That does not read as an email address.')
    expect(hoursStatementChannelProblem('email', { email: 'marcus@example.com', phone: '' })).toBeNull()
    expect(hoursStatementChannelProblem('text', { email: '', phone: '' })).toBe('Add the worker’s cell number first.')
    expect(hoursStatementChannelProblem('text', { email: '', phone: '555-01' })).toBe('That does not read as a phone number.')
    expect(hoursStatementChannelProblem('text', { email: '', phone: '(555) 555-0100' })).toBeNull()
    expect(hoursStatementChannelProblem('link', { email: '', phone: '' })).toBeNull()
    expect(hoursStatementChannelProblem('in_person', { email: '', phone: '' })).toBeNull()
  })

  it('writes the text and its sms address, and flags the link for signing in person', () => {
    const body = hoursStatementTextBody({ recordId: 'HS-1042-0007', jobLabel: '1042 · Ridgeway Lofts', url: 'https://clicktooling.com/contract/accept?t=abc' })
    expect(body).toBe('Here is your hours statement HS-1042-0007 for job 1042 · Ridgeway Lofts. Read it and sign here: https://clicktooling.com/contract/accept?t=abc')
    expect(smsHref('(555) 555-0100', 'hi there')).toBe('sms:5555550100?&body=hi%20there')
    expect(inPersonUrl('https://clicktooling.com/contract/accept?t=abc')).toBe('https://clicktooling.com/contract/accept?t=abc&inperson=1')
    expect(inPersonUrl('/contract/accept?t=abc')).toBe('/contract/accept?t=abc&inperson=1')
  })

  it('moves any open state to sent and keeps signed; the toasts name the record and the channel', () => {
    expect(hoursStatementStateAfterSend('draft')).toBe('sent')
    expect(hoursStatementStateAfterSend('printed')).toBe('sent')
    expect(hoursStatementStateAfterSend('sent')).toBe('sent')
    expect(hoursStatementStateAfterSend('signed')).toBe('signed')
    expect(hoursStatementSentWords('email', { recordId: 'HS-1042-0007', workerName: 'Marcus Reyes', emailed: true })).toBe('HS-1042-0007 emailed to Marcus Reyes to sign.')
    expect(hoursStatementSentWords('email', { recordId: 'HS-1042-0007', workerName: 'Marcus Reyes', emailed: false, emailError: 'Resend 500' })).toBe('HS-1042-0007 is ready to sign, but the email did not go: Resend 500. Copy the link instead.')
    expect(hoursStatementSentWords('text', { recordId: 'HS-1042-0007', workerName: 'Marcus Reyes' })).toContain('texting app')
    expect(hoursStatementSentWords('link', { recordId: 'HS-1042-0007', workerName: 'Marcus Reyes' })).toContain('clipboard')
    expect(hoursStatementSentWords('in_person', { recordId: 'HS-1042-0007', workerName: 'Marcus Reyes' })).toBe('HS-1042-0007 is open on this device for Marcus Reyes to sign.')
  })

  it('the paper path: the scan, its kind and size, the name, the day not ahead of today, the rows, then the attestation', () => {
    const ok = { file: { type: 'image/jpeg', size: 1000 }, signedOn: '2026-11-01', printedName: 'Marcus Reyes', attested: true, rows: [{ day: '2025-09-15', hours: '8', note: 'Rough-in' }, { day: '', hours: '', note: '' }], todayYmd: '2026-11-02' }
    expect(hoursStatementScanProblem(ok)).toBeNull()
    expect(hoursStatementScanProblem({ ...ok, file: null })).toBe('Attach the signed paper as a photo or a PDF.')
    expect(hoursStatementScanProblem({ ...ok, file: { type: 'text/plain', size: 10 } })).toBe('The scan must be a JPG, PNG, WEBP, HEIC or PDF.')
    expect(hoursStatementScanProblem({ ...ok, file: { type: 'image/png', size: 9 * 1024 * 1024 } })).toBe('The scan is over 8 MB. Take a smaller photo.')
    expect(hoursStatementScanProblem({ ...ok, printedName: ' ' })).toBe('Type the name the worker signed with.')
    expect(hoursStatementScanProblem({ ...ok, signedOn: '' })).toBe('Pick the day the worker signed.')
    expect(hoursStatementScanProblem({ ...ok, signedOn: '2026-11-03' })).toBe('The signing day cannot be ahead of today.')
    expect(hoursStatementScanProblem({ ...ok, rows: [{ day: '', hours: '8', note: '' }] })).toBe('Stated row 1 needs its day.')
    expect(hoursStatementScanProblem({ ...ok, rows: [{ day: '2025-09-15', hours: 'eight', note: '' }] })).toBe('Stated row 1: hours must be a number.')
    expect(hoursStatementScanProblem({ ...ok, attested: false })).toBe('Confirm the days were typed exactly as the worker wrote them.')
    expect(scanRowsToPost(ok.rows)).toEqual([{ day: '2025-09-15', hours: '8', note: 'Rough-in' }])
    expect(scanRowsToPost([{ day: '2025-09-16', hours: '', note: '' }])).toEqual([{ day: '2025-09-16', hours: null, note: '' }])
  })
})
