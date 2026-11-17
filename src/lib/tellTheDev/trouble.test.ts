import { describe, expect, it } from 'vitest'
import { OFFLINE_ERROR_MESSAGE } from '../networkErrorMessage'
import { TROUBLE_WINDOW_MS, errorLineOffersNote, isLostSignalLine, makeTroubleMemory, refusedCallName, wrapFetchRememberingRefusals } from './trouble'

describe('a lost signal is not a note', () => {
  it('knows the app’s own no-connection line and the browsers’ raw ones', () => {
    expect(isLostSignalLine(OFFLINE_ERROR_MESSAGE)).toBe(true)
    expect(isLostSignalLine(`Could not save the photo: ${OFFLINE_ERROR_MESSAGE}`)).toBe(true)
    expect(isLostSignalLine('TypeError: Load failed')).toBe(true)
    expect(isLostSignalLine('The file is too big to send.')).toBe(false)
    expect(isLostSignalLine('')).toBe(false)
  })

  it('offers no press on a lost-signal line, offline, or with Fix mode off', () => {
    expect(errorLineOffersNote({ words: 'The file is too big to send.', online: true, fixMode: true })).toBe(true)
    expect(errorLineOffersNote({ words: OFFLINE_ERROR_MESSAGE, online: true, fixMode: true })).toBe(false)
    expect(errorLineOffersNote({ words: 'The file is too big to send.', online: false, fixMode: true })).toBe(false)
    expect(errorLineOffersNote({ words: 'The file is too big to send.', online: true, fixMode: false })).toBe(false)
    expect(errorLineOffersNote({ words: '  ', online: true, fixMode: true })).toBe(false)
  })
})

describe('refusedCallName', () => {
  const base = 'https://abc.supabase.co'
  it('names a table with its verb and never its query', () => {
    expect(refusedCallName('PATCH', `${base}/rest/v1/jobs_ledger?id=eq.123&select=*`)).toBe('PATCH jobs_ledger')
    expect(refusedCallName(undefined, `${base}/rest/v1/customers?name=ilike.*smith*`)).toBe('GET customers')
  })

  it('names a function, an edge function and a file bucket', () => {
    expect(refusedCallName('POST', `${base}/rest/v1/rpc/land_field_press`)).toBe('land_field_press (function)')
    expect(refusedCallName('POST', `${base}/functions/v1/notify-help-feedback`)).toBe('notify-help-feedback (edge function)')
    expect(refusedCallName('POST', `${base}/storage/v1/object/task-photos/a/b/c.jpg`)).toBe('POST task-photos (files)')
  })

  it('names nothing for another address', () => {
    expect(refusedCallName('GET', `${base}/auth/v1/user`)).toBeNull()
    expect(refusedCallName('GET', 'https://example.com/x')).toBeNull()
  })
})

describe('the memory', () => {
  it('keeps error lines newest first, one per line, and forgets after the window', () => {
    let now = 1_000_000
    const m = makeTroubleMemory(() => now)
    m.noteErrorLine('First')
    now += 1000
    m.noteErrorLine('Second')
    now += 1000
    m.noteErrorLine('First')
    expect(m.recent().errors.map((e) => e.words)).toEqual(['First', 'Second'])
    now += TROUBLE_WINDOW_MS + 1
    expect(m.recent().errors).toEqual([])
  })

  it('never remembers a lost-signal line', () => {
    const m = makeTroubleMemory(() => 5)
    m.noteErrorLine(OFFLINE_ERROR_MESSAGE)
    m.noteErrorLine('   ')
    expect(m.recent().errors).toEqual([])
  })

  it('remembers a refusal and leaves out a 401 and an answer below 400', () => {
    const m = makeTroubleMemory(() => 5)
    m.noteRefusedCall({ method: 'POST', url: 'https://a.b/rest/v1/rpc/add_worker', status: 403 })
    m.noteRefusedCall({ method: 'GET', url: 'https://a.b/rest/v1/users', status: 401 })
    m.noteRefusedCall({ method: 'GET', url: 'https://a.b/rest/v1/users', status: 304 })
    m.noteRefusedCall({ method: 'GET', url: 'https://example.com/x', status: 500 })
    expect(m.recent().refused).toEqual([{ what: 'add_worker (function)', status: 403, at: 5 }])
  })

  it('clears at sign-out', () => {
    const m = makeTroubleMemory(() => 5)
    m.noteErrorLine('A line')
    m.clear()
    expect(m.recent()).toEqual({ errors: [], refused: [] })
  })
})

describe('wrapFetchRememberingRefusals', () => {
  it('remembers a refusal and hands the answer on untouched', async () => {
    const m = makeTroubleMemory(() => 7)
    const answer = new Response('{}', { status: 413 })
    const f = wrapFetchRememberingRefusals(async () => answer, m)
    const res = await f('https://a.b/storage/v1/object/task-photos/x.jpg', { method: 'POST' })
    expect(res).toBe(answer)
    expect(m.recent().refused).toEqual([{ what: 'POST task-photos (files)', status: 413, at: 7 }])
  })

  it('remembers nothing for a good answer', async () => {
    const m = makeTroubleMemory(() => 7)
    const f = wrapFetchRememberingRefusals(async () => new Response('[]', { status: 200 }), m)
    await f('https://a.b/rest/v1/users')
    expect(m.recent().refused).toEqual([])
  })

  it('rethrows a call that never reached the server and remembers nothing', async () => {
    const m = makeTroubleMemory(() => 7)
    const f = wrapFetchRememberingRefusals(async () => {
      throw new TypeError('Load failed')
    }, m)
    await expect(f('https://a.b/rest/v1/users')).rejects.toThrow('Load failed')
    expect(m.recent().refused).toEqual([])
  })
})
