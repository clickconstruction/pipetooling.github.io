import { afterEach, describe, expect, it, vi } from 'vitest'
import { DRIVE_PAGE_TITLE_MAX, driveAnswerOf, driveAnswerWords, drivePageTitle, findExistingFile, findOrCreateFolder, googleAccessToken, uploadBytes } from '../../../supabase/functions/_shared/driveUpload'

/** The page Google's front door sends when a gateway fails: a title, a body, no JSON. */
const PAGE_502 = '<!DOCTYPE html>\n<html lang=en>\n  <meta charset=utf-8>\n  <title>Error 502 (Server Error)!!1</title>\n  <p><b>502.</b> <ins>That’s an error.</ins>\n</html>'

const answer = (status: number, text: string) => new Response(text, { status, headers: { 'Content-Type': text.startsWith('<') ? 'text/html' : 'application/json' } })

afterEach(() => vi.unstubAllGlobals())

describe('driveAnswerOf (v2.7642): one of Google’s answers read without throwing', () => {
  it('reads JSON as its body', () => {
    expect(driveAnswerOf('{"id":"f1"}')).toEqual({ body: { id: 'f1' }, page: null, unread: false })
    expect(driveAnswerOf('')).toEqual({ body: {}, page: null, unread: false })
    expect(driveAnswerOf('  ')).toEqual({ body: {}, page: null, unread: false })
    expect(driveAnswerOf('"a string"').body).toEqual({})
  })

  it('reads a web page as an empty body with the page’s own title, and marks it unread', () => {
    expect(driveAnswerOf(PAGE_502)).toEqual({ body: {}, page: 'Error 502 (Server Error)', unread: true })
    expect(driveAnswerOf('<html><body>no title here</body></html>')).toEqual({ body: {}, page: null, unread: true })
    expect(driveAnswerOf('Bad Gateway')).toEqual({ body: {}, page: null, unread: true })
  })

  it('cleans a title: entities, line breaks, Google’s trailing marks, and a length', () => {
    expect(drivePageTitle('<TITLE>\n  Error 413 (Request Entity Too Large)!!1\n</TITLE>')).toBe('Error 413 (Request Entity Too Large)')
    expect(drivePageTitle('<title>Sign in &amp; continue &#39;now&#39;</title>')).toBe("Sign in & continue 'now'")
    expect(drivePageTitle('<title>  </title>')).toBeNull()
    expect(drivePageTitle('{"id":1}')).toBeNull()
    const long = drivePageTitle(`<title>${'x'.repeat(400)}</title>`)
    expect(long?.length).toBe(DRIVE_PAGE_TITLE_MAX)
    expect(long?.endsWith('…')).toBe(true)
  })

  it('says what went wrong in the answer’s own words, first match wins', () => {
    expect(driveAnswerWords(driveAnswerOf('{"error":{"message":"The user’s Drive storage quota has been exceeded."}}'))).toBe('The user’s Drive storage quota has been exceeded.')
    expect(driveAnswerWords(driveAnswerOf('{"error":"invalid_grant","error_description":"Invalid JWT Signature."}'))).toBe('Invalid JWT Signature.')
    expect(driveAnswerWords(driveAnswerOf('{"error":"invalid_grant"}'))).toBe('invalid_grant')
    expect(driveAnswerWords(driveAnswerOf(PAGE_502))).toBe('Error 502 (Server Error)')
    expect(driveAnswerWords(driveAnswerOf('{}'))).toBe('unknown')
    expect(driveAnswerWords(driveAnswerOf('Bad Gateway'))).toBe('unknown')
  })
})

describe('the upload helpers keep the status of a page-shaped answer (v2.7642)', () => {
  it('uploadBytes throws the status and the page’s title where it used to throw a JSON SyntaxError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => answer(502, PAGE_502)))
    await expect(uploadBytes('token', 'folder', new Uint8Array([1, 2, 3]), 'receipt.jpg', 'image/jpeg')).rejects.toThrow('Upload failed (502): Error 502 (Server Error)')
  })

  it('uploadBytes still hands back the id, and still passes Drive’s JSON refusal on', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => answer(200, '{"id":"f9"}')))
    expect(await uploadBytes('token', 'folder', new Uint8Array([1]), 'a.pdf', 'application/pdf')).toEqual({ id: 'f9' })
    vi.stubGlobal('fetch', vi.fn(async () => answer(403, '{"error":{"message":"Insufficient permissions for the specified parent."}}')))
    await expect(uploadBytes('token', 'folder', new Uint8Array([1]), 'a.pdf', 'application/pdf')).rejects.toThrow('Upload failed (403): Insufficient permissions for the specified parent.')
  })

  it('a list read refuses a page with its status and never reads it as an empty list', async () => {
    const fetchMock = vi.fn(async () => answer(503, PAGE_502.replace(/502/g, '503').replace('Server Error', 'Service Unavailable')))
    vi.stubGlobal('fetch', fetchMock)
    await expect(findExistingFile('token', 'folder', 'a.pdf')).rejects.toThrow('Drive answered 503: Error 503 (Service Unavailable)')
    // No folder is made on the strength of a page: the create call is never reached.
    await expect(findOrCreateFolder('token', 'parent', 'Sent by us')).rejects.toThrow('Drive answered 503')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('a list read still answers from JSON, found or not', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => answer(200, '{"files":[{"id":"f3","name":"a.pdf"}]}')))
    expect(await findExistingFile('token', 'folder', 'a.pdf')).toBe('f3')
    vi.stubGlobal('fetch', vi.fn(async () => answer(200, '{"files":[]}')))
    expect(await findExistingFile('token', 'folder', 'a.pdf')).toBeNull()
  })

  it('names a failed sign-in in Google’s words, and a page-shaped one by its title', async () => {
    const { privateKey } = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])
    const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', privateKey))
    const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...der))}\n-----END PRIVATE KEY-----\n`
    const sa = JSON.stringify({ client_email: 'made-up@example.iam.gserviceaccount.com', private_key: pem })
    vi.stubGlobal('fetch', vi.fn(async () => answer(400, '{"error":"invalid_grant","error_description":"Invalid JWT Signature."}')))
    await expect(googleAccessToken(sa)).rejects.toThrow('Google token exchange failed (400): Invalid JWT Signature.')
    vi.stubGlobal('fetch', vi.fn(async () => answer(502, PAGE_502)))
    await expect(googleAccessToken(sa)).rejects.toThrow('Google token exchange failed (502): Error 502 (Server Error)')
    vi.stubGlobal('fetch', vi.fn(async () => answer(200, '{"access_token":"made-up-token"}')))
    expect(await googleAccessToken(sa)).toBe('made-up-token')
  })
})
