import { describe, expect, it } from 'vitest'
import { DRIVE_FAILURE_REASON_MAX, DRIVE_SENT_A_PAGE_WORDS, driveFailureOf, driveStatusRetries } from '../../../supabase/functions/_shared/driveFailure'

describe('driveFailureOf (v2.7635): a Drive door names who refused and whether the same ask can go again', () => {
  it('reads a refused upload in Drive’s own words, and does not offer a second try for a refusal', () => {
    const f = driveFailureOf(new Error('Upload failed (403): The user’s Drive storage quota has been exceeded.'))
    expect(f.error).toBe('Drive did not take the file. Drive said: The user’s Drive storage quota has been exceeded.')
    expect(f.why).toBe('drive')
    expect(f.retry).toBe(false)
    expect(f.status).toBe(502)
  })

  it('offers the second try when Drive was busy or broken', () => {
    expect(driveFailureOf(new Error('Upload failed (503): Backend Error')).retry).toBe(true)
    expect(driveFailureOf(new Error('Upload failed (429): Too many requests')).retry).toBe(true)
    expect(driveFailureOf(new Error('Upload failed (403): User rate limit exceeded.')).retry).toBe(true)
    expect(driveStatusRetries(408)).toBe(true)
    expect(driveStatusRetries(404)).toBe(false)
  })

  it('says Drive gave no reason when the helper had none to pass on', () => {
    const f = driveFailureOf(new Error('Upload failed (500): unknown'))
    expect(f.error).toBe('Drive did not take the file. It gave no reason (500).')
    expect(f.retry).toBe(true)
  })

  it('tells a folder, a sign-in and a bare status apart', () => {
    expect(driveFailureOf(new Error('Folder create failed (403): Insufficient permissions for the specified parent.')).error).toBe('Drive did not make the folder. Drive said: Insufficient permissions for the specified parent.')
    const google = driveFailureOf(new Error('Google token exchange failed (400): Invalid JWT Signature.'))
    expect(google.error).toBe('Google did not let the app in to Drive. Google said: Invalid JWT Signature.')
    expect(google.why).toBe('google')
    expect(google.retry).toBe(false)
    const bare = driveFailureOf(new Error('Drive answered 503'))
    expect(bare.error).toBe('Drive did not answer as it should. It gave no reason (503).')
    expect(bare.retry).toBe(true)
    expect(driveFailureOf(new Error('Drive answered 404 when the app read a file.')).error).toBe('Drive did not answer as it should. It gave no reason (404).')
    expect(driveFailureOf(new Error('Drive source fetch failed (403) — is the file (or its folder) shared with the service account?')).error).toBe('Drive did not hand the file over. It gave no reason (403).')
  })

  it('reads a fetch nothing answered as Drive out of reach, with the second try', () => {
    const lost = new TypeError('error sending request for url (https://www.googleapis.com/upload/drive/v3/files): connection reset')
    expect(driveFailureOf(lost)).toEqual({ error: 'The app could not reach Drive.', why: 'unreachable', retry: true, status: 502 })
    expect(driveFailureOf(new Error('ECONNRESET')).why).toBe('unreachable')
  })

  it('reads a web page where Drive’s answer should be as a busy Drive, with the second try (the failure of 2026-11-17)', () => {
    // What `uploadBytes` threw on prod: Drive answered the upload with an HTML page and `res.json()` could not read it.
    const page = new SyntaxError('Unexpected token \'<\', "<!DOCTYPE "... is not valid JSON')
    expect(driveFailureOf(page)).toEqual({ error: DRIVE_SENT_A_PAGE_WORDS, why: 'drive', retry: true, status: 502 })
    expect(driveFailureOf(new SyntaxError('Unexpected end of JSON input')).retry).toBe(true)
    expect(driveFailureOf(new SyntaxError('Unexpected token < in JSON at position 0')).error).toBe(DRIVE_SENT_A_PAGE_WORDS)
    expect(driveFailureOf(new Error('<html><head><title>502 Bad Gateway</title>')).error).toBe(DRIVE_SENT_A_PAGE_WORDS)
  })

  it('passes the app’s own error on with its words, cut to a line, and never answers the bare word', () => {
    const own = driveFailureOf(new Error('Cannot read properties of undefined (reading ’id’)'))
    expect(own.error).toBe('The app hit a problem of its own: Cannot read properties of undefined (reading ’id’)')
    expect(own.why).toBe('unknown')
    expect(own.retry).toBe(false)
    expect(own.status).toBe(500)
    const long = driveFailureOf(new Error('x'.repeat(900)))
    expect(long.error.length).toBeLessThanOrEqual('The app hit a problem of its own: '.length + DRIVE_FAILURE_REASON_MAX)
    expect(long.error.endsWith('…')).toBe(true)
    for (const nothing of [undefined, null, '', 'failed', new Error('failed'), {}]) {
      const f = driveFailureOf(nothing)
      expect(f.error).toBe('The app hit a problem of its own and has no reason to give.')
      expect(f.error).not.toBe('failed')
      expect(f.retry).toBe(true)
    }
  })
})
