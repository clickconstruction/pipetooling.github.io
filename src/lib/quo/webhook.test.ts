/**
 * The Quo webhook's own rules over made-up deliveries: made-up ids and a made-up key, built when the test runs. Each
 * signature here is made by Node's own HMAC, apart from the WebCrypto one under test.
 */
import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  QUO_SEEN_KEEP_HOURS,
  QUO_SIGNATURE_MAX_AGE_SECONDS,
  seenBefore,
  verifySignature,
  webhookAnswer,
  type SeenDelivery,
} from './webhook'

const keyOf = (words: string) => Buffer.from(words, 'utf8')
const KEY = keyOf('made-up key for the quo webhook test, never a real one')
const SECRET = `whsec_${KEY.toString('base64')}`
const OTHER_SECRET = `whsec_${keyOf('another made-up key').toString('base64')}`

const NOW = Date.UTC(2026, 9, 2, 16, 45, 0)
const STAMP = String(Math.floor(NOW / 1000))
const BODY = JSON.stringify({ id: 'EV-1', apiVersion: '2026-03-30', createdAt: '2026-10-02T16:45:00.000Z', type: 'message.received', data: {} })

const sign = (key: Buffer, id: string, stamp: string, body: string) => createHmac('sha256', key).update(`${id}.${stamp}.${body}`).digest('base64')

const headersFor = (over: Record<string, string | undefined> = {}, body = BODY) => {
  const id = over['webhook-id'] ?? 'msg_made_up_0001'
  const stamp = over['webhook-timestamp'] ?? STAMP
  return {
    'webhook-id': id,
    'webhook-timestamp': stamp,
    'webhook-signature': `v1,${sign(KEY, id, stamp, body)}`,
    ...over,
  }
}

describe('the signature', () => {
  it('takes a delivery Quo signed, in plain headers or fetch Headers, any case', async () => {
    expect(await verifySignature(headersFor(), BODY, SECRET, NOW)).toEqual({ ok: true, webhookId: 'msg_made_up_0001', timestamp: Number(STAMP) })
    const shouty = Object.fromEntries(Object.entries(headersFor()).map(([k, v]) => [k.toUpperCase(), v]))
    expect((await verifySignature(shouty, BODY, SECRET, NOW)).ok).toBe(true)
    expect((await verifySignature(new Headers(headersFor()), BODY, SECRET, NOW)).ok).toBe(true)
  })

  it('checks the raw bytes as they came', async () => {
    expect((await verifySignature(headersFor(), new TextEncoder().encode(BODY), SECRET, NOW)).ok).toBe(true)
    // The same JSON with one space more is another body.
    expect(await verifySignature(headersFor(), BODY.replace('{', '{ '), SECRET, NOW)).toEqual({ ok: false, why: 'bad signature' })
  })

  it('refuses another key, a changed id or a changed timestamp', async () => {
    expect(await verifySignature(headersFor(), BODY, OTHER_SECRET, NOW)).toEqual({ ok: false, why: 'bad signature' })
    const signed = headersFor()
    expect(await verifySignature({ ...signed, 'webhook-id': 'msg_made_up_0002' }, BODY, SECRET, NOW)).toEqual({ ok: false, why: 'bad signature' })
    expect(await verifySignature({ ...signed, 'webhook-timestamp': String(Number(STAMP) - 1) }, BODY, SECRET, NOW)).toEqual({ ok: false, why: 'bad signature' })
  })

  it('takes any matching v1 entry, so a key can be turned over, and no other version', async () => {
    const good = sign(KEY, 'msg_made_up_0001', STAMP, BODY)
    const old = sign(keyOf('the key before'), 'msg_made_up_0001', STAMP, BODY)
    expect((await verifySignature({ ...headersFor(), 'webhook-signature': `v1,${old} v1,${good}` }, BODY, SECRET, NOW)).ok).toBe(true)
    expect(await verifySignature({ ...headersFor(), 'webhook-signature': `v1a,${good}` }, BODY, SECRET, NOW)).toEqual({ ok: false, why: 'bad signature' })
    expect(await verifySignature({ ...headersFor(), 'webhook-signature': good }, BODY, SECRET, NOW)).toEqual({ ok: false, why: 'bad signature' })
  })

  it('refuses a signature one byte off, or of another length', async () => {
    const bytes = Buffer.from(sign(KEY, 'msg_made_up_0001', STAMP, BODY), 'base64')
    bytes[31] = (bytes[31] ?? 0) ^ 1
    expect(await verifySignature({ ...headersFor(), 'webhook-signature': `v1,${bytes.toString('base64')}` }, BODY, SECRET, NOW)).toEqual({ ok: false, why: 'bad signature' })
    expect(await verifySignature({ ...headersFor(), 'webhook-signature': `v1,${bytes.subarray(0, 31).toString('base64')}` }, BODY, SECRET, NOW)).toEqual({
      ok: false,
      why: 'bad signature',
    })
    expect(await verifySignature({ ...headersFor(), 'webhook-signature': 'v1,not base64 at all!' }, BODY, SECRET, NOW)).toEqual({ ok: false, why: 'bad signature' })
  })

  it('refuses a delivery signed more than five minutes away, either way', async () => {
    expect(QUO_SIGNATURE_MAX_AGE_SECONDS).toBe(300)
    const at = (seconds: number) => headersFor({ 'webhook-timestamp': String(Number(STAMP) + seconds) })
    expect((await verifySignature(at(-300), BODY, SECRET, NOW)).ok).toBe(true)
    expect(await verifySignature(at(-301), BODY, SECRET, NOW)).toEqual({ ok: false, why: 'too old' })
    expect((await verifySignature(at(300), BODY, SECRET, NOW)).ok).toBe(true)
    expect(await verifySignature(at(301), BODY, SECRET, NOW)).toEqual({ ok: false, why: 'too new' })
  })

  it('refuses missing headers, a timestamp that is not one, and a missing key', async () => {
    const unsigned = Object.fromEntries(Object.entries(headersFor()).filter(([name]) => name !== 'webhook-signature'))
    expect(await verifySignature(unsigned, BODY, SECRET, NOW)).toEqual({ ok: false, why: 'missing headers' })
    expect(await verifySignature({}, BODY, SECRET, NOW)).toEqual({ ok: false, why: 'missing headers' })
    expect(await verifySignature(headersFor({ 'webhook-timestamp': '2026-10-02T16:45:00Z' }), BODY, SECRET, NOW)).toEqual({ ok: false, why: 'bad timestamp' })
    for (const secret of ['', '   ', 'whsec_', 'whsec_%%%']) {
      expect(await verifySignature(headersFor(), BODY, secret, NOW)).toEqual({ ok: false, why: 'no secret' })
    }
  })
})

describe('a delivery seen before', () => {
  const HOUR = 3_600_000

  it('records a new delivery', () => {
    expect(seenBefore('msg_made_up_0001', [], NOW)).toEqual({ repeat: false, drop: [], record: { id: 'msg_made_up_0001', at: NOW } })
  })

  it('takes Quo’s retry inside 28 hours as a repeat', () => {
    expect(QUO_SEEN_KEEP_HOURS).toBe(28)
    const seen: SeenDelivery[] = [{ id: 'msg_made_up_0001', at: NOW - 27.5 * HOUR }]
    expect(seenBefore('msg_made_up_0001', seen, NOW)).toEqual({ repeat: true, drop: [], record: null })
  })

  it('drops the ids past 28 hours, and takes an id that old as new', () => {
    const seen: SeenDelivery[] = [
      { id: 'msg_made_up_0001', at: NOW - 29 * HOUR },
      { id: 'msg_made_up_0002', at: NOW - 40 * HOUR },
      { id: 'msg_made_up_0003', at: NOW - 2 * HOUR },
    ]
    expect(seenBefore('msg_made_up_0001', seen, NOW)).toEqual({
      repeat: false,
      drop: ['msg_made_up_0001', 'msg_made_up_0002'],
      record: { id: 'msg_made_up_0001', at: NOW },
    })
    expect(seenBefore('msg_made_up_0003', seen, NOW).repeat).toBe(true)
  })
})

describe('the answer', () => {
  it('answers 200 when handled, quietly', () => {
    expect(webhookAnswer({ kind: 'handled', type: 'message.received', eventId: 'EV-1' })).toEqual({ status: 200, body: { ok: true }, log: null, release: false })
  })

  it('answers 200 when there is nothing to do, with the reason logged', () => {
    expect(webhookAnswer({ kind: 'ignored', why: 'call.ringing is not an event the webhook takes' })).toEqual({
      status: 200,
      body: { ok: true, ignored: 'call.ringing is not an event the webhook takes' },
      log: 'ignored: call.ringing is not an event the webhook takes',
      release: false,
    })
    expect(webhookAnswer({ kind: 'repeat', webhookId: 'msg_made_up_0001' })).toEqual({
      status: 200,
      body: { ok: true, repeat: true },
      log: 'repeat delivery msg_made_up_0001',
      release: false,
    })
  })

  it('answers 401 on a bad signature, saying no more than unauthorized', () => {
    expect(webhookAnswer({ kind: 'refused', why: 'bad signature' })).toEqual({
      status: 401,
      body: { ok: false, error: 'unauthorized' },
      log: 'refused: bad signature',
      release: false,
    })
  })

  it('answers 500 on a failure, giving back the claim so Quo’s retry is taken', () => {
    expect(webhookAnswer({ kind: 'failed', why: 'the messages insert timed out' })).toEqual({
      status: 500,
      body: { ok: false, error: 'try again' },
      log: 'failed: the messages insert timed out',
      release: true,
    })
  })
})
