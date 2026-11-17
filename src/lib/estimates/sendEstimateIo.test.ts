import { describe, expect, it, vi } from 'vitest'
import { postSendEstimate, sendEstimateAnswerFrom, sendEstimateRequestBody, type SendEstimateDoor } from './sendEstimateIo'

vi.mock('../supabase', () => ({ supabase: {} }))

/** A door that records the one request and answers with the given reply. */
function fakeDoor(over: Partial<SendEstimateDoor> = {}, reply: { ok?: boolean; status?: number; json?: unknown } = {}) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const door: SendEstimateDoor = {
    accessToken: async () => 'jwt-1',
    fetch: async (url, init) => {
      calls.push({ url, init })
      return { ok: reply.ok ?? true, status: reply.status ?? 200, json: async () => reply.json ?? { ok: true } } as Response
    },
    functionsUrl: 'https://project.example/functions/v1',
    anonKey: 'anon-1',
    publicOrigin: 'https://app.example',
    timeoutSignal: () => undefined,
    ...over,
  }
  return { door, calls }
}

describe('sendEstimateRequestBody', () => {
  it('names the address on a first send and no mode', () => {
    expect(sendEstimateRequestBody({ estimateId: 'e1', mode: 'send', customerEmail: 'a@b.test' }, 'https://app.example')).toEqual({
      estimate_id: 'e1',
      public_origin: 'https://app.example',
      customer_email: 'a@b.test',
    })
  })

  it('names the mode on a resend and on the letter again, and no address', () => {
    expect(sendEstimateRequestBody({ estimateId: 'e1', mode: 'resend', customerEmail: 'a@b.test' }, undefined)).toEqual({ estimate_id: 'e1', public_origin: undefined, mode: 'resend' })
    expect(sendEstimateRequestBody({ estimateId: 'e1', mode: 'remail' }, 'https://app.example')).toEqual({ estimate_id: 'e1', public_origin: 'https://app.example', mode: 'remail' })
  })
})

describe('postSendEstimate', () => {
  it('posts to the function as the signed-in person', async () => {
    const { door, calls } = fakeDoor({}, { json: { ok: true, accept_url: 'https://app.example/estimate/accept?t=x' } })
    const post = await postSendEstimate({ estimateId: 'e1', mode: 'send', customerEmail: 'a@b.test' }, door)
    expect(post).toEqual({ kind: 'reply', httpOk: true, json: { ok: true, accept_url: 'https://app.example/estimate/accept?t=x' } })
    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe('https://project.example/functions/v1/send-estimate-to-customer')
    expect(calls[0]!.init.method).toBe('POST')
    expect(calls[0]!.init.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer jwt-1', apikey: 'anon-1' })
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ estimate_id: 'e1', public_origin: 'https://app.example', customer_email: 'a@b.test' })
  })

  it('makes no request when nobody is signed in', async () => {
    const { door, calls } = fakeDoor({ accessToken: async () => null })
    expect(await postSendEstimate({ estimateId: 'e1', mode: 'resend' }, door)).toEqual({ kind: 'no-session' })
    expect(calls).toHaveLength(0)
  })

  it('asks for a timeout signal only when a timeout is given', async () => {
    const signal = new AbortController().signal
    const timeoutSignal = vi.fn(() => signal)
    const withTimeout = fakeDoor({ timeoutSignal })
    await postSendEstimate({ estimateId: 'e1', mode: 'send', customerEmail: 'a@b.test', timeoutMs: 20_000 }, withTimeout.door)
    expect(timeoutSignal).toHaveBeenCalledWith(20_000)
    expect(withTimeout.calls[0]!.init.signal).toBe(signal)

    timeoutSignal.mockClear()
    const without = fakeDoor({ timeoutSignal })
    await postSendEstimate({ estimateId: 'e1', mode: 'remail' }, without.door)
    expect(timeoutSignal).not.toHaveBeenCalled()
    expect(without.calls[0]!.init.signal).toBeUndefined()
  })

  it('answers slow when the timeout fires', async () => {
    const { door } = fakeDoor({
      fetch: async () => {
        throw new DOMException('timed out', 'TimeoutError')
      },
    })
    expect(await postSendEstimate({ estimateId: 'e1', mode: 'send', timeoutMs: 20_000 }, door)).toEqual({ kind: 'slow' })
  })

  it('lets a lost connection throw, as each caller already catches it', async () => {
    const { door } = fakeDoor({
      fetch: async () => {
        throw new TypeError('Failed to fetch')
      },
    })
    await expect(postSendEstimate({ estimateId: 'e1', mode: 'resend' }, door)).rejects.toThrow('Failed to fetch')
  })

  it('hands back a refusal with its HTTP verdict, unread', async () => {
    const { door } = fakeDoor({}, { ok: false, status: 409, json: { ok: false, code: 'already_sent', error: 'Already sent.' } })
    expect(await postSendEstimate({ estimateId: 'e1', mode: 'send' }, door)).toEqual({ kind: 'reply', httpOk: false, json: { ok: false, code: 'already_sent', error: 'Already sent.' } })
  })
})

describe('sendEstimateAnswerFrom', () => {
  it('is ok with the link when the email went', () => {
    expect(sendEstimateAnswerFrom(true, { ok: true, accept_url: 'https://x.test/estimate/accept?t=1', emailed: true })).toEqual({
      ok: true,
      acceptUrl: 'https://x.test/estimate/accept?t=1',
      emailed: true,
      warning: null,
    })
  })

  it('is ok with a warning when the link was made and the email did not go', () => {
    expect(sendEstimateAnswerFrom(true, { ok: true, accept_url: 'https://x.test/estimate/accept?t=1', emailed: false, email_error: 'Mailbox full' })).toEqual({
      ok: true,
      acceptUrl: 'https://x.test/estimate/accept?t=1',
      emailed: false,
      warning: 'Mailbox full',
    })
    // The function's own warning wins over the mail error.
    expect(sendEstimateAnswerFrom(true, { ok: true, emailed: false, warning: 'No mail key', email_error: 'x' })).toMatchObject({ ok: true, acceptUrl: null, warning: 'No mail key' })
  })

  it('says already went, with the time, when the send was a second one', () => {
    const answer = sendEstimateAnswerFrom(false, { ok: false, code: 'already_sent', error: 'It went at noon.', sent_at: '2026-11-01T18:00:00.000Z' })
    expect(answer).toEqual({ ok: false, kind: 'already-went', why: 'It went at noon.', sentAtMs: Date.parse('2026-11-01T18:00:00.000Z') })
  })

  it('says already went with no time when the reply has none or a bad one', () => {
    expect(sendEstimateAnswerFrom(false, { code: 'already_sent' })).toEqual({ ok: false, kind: 'already-went', why: 'This estimate already went to the customer.', sentAtMs: null })
    expect(sendEstimateAnswerFrom(false, { code: 'already_sent', sent_at: 'not a date' })).toMatchObject({ kind: 'already-went', sentAtMs: null })
  })

  it('answers a no-longer-draft estimate in the resend rule’s own words when a fresh link cannot be made', () => {
    const answer = sendEstimateAnswerFrom(false, { ok: false, code: 'not_draft', estimate_status: 'customer_accepted', error: 'Not a draft.' })
    expect(answer.ok).toBe(false)
    if (answer.ok) return
    expect(answer.kind).toBe('refused')
    // The rule's sentence, not the server's bare "Not a draft."
    expect(answer.why).not.toBe('Not a draft.')
    expect(answer.why.length).toBeGreaterThan(0)
  })

  it('keeps the server’s reason for a no-longer-draft estimate the resend rule would allow', () => {
    // `sent` passes the status half of the rule with no time on hand, so the server's sentence stands.
    const answer = sendEstimateAnswerFrom(false, { ok: false, code: 'not_draft', estimate_status: 'sent', error: 'Not a draft.' })
    expect(answer).toMatchObject({ ok: false, kind: 'refused' })
  })

  it('refuses with the server’s reason, or Send failed', () => {
    expect(sendEstimateAnswerFrom(false, { error: 'No customer email.' })).toEqual({ ok: false, kind: 'refused', why: 'No customer email.' })
    expect(sendEstimateAnswerFrom(false, {})).toEqual({ ok: false, kind: 'refused', why: 'Send failed' })
    // HTTP 200 with ok false is still a no.
    expect(sendEstimateAnswerFrom(true, { ok: false, error: 'Held.' })).toEqual({ ok: false, kind: 'refused', why: 'Held.' })
    // A code with no status falls through to the plain refusal.
    expect(sendEstimateAnswerFrom(false, { code: 'not_draft', error: 'Not a draft.' })).toEqual({ ok: false, kind: 'refused', why: 'Not a draft.' })
  })
})
