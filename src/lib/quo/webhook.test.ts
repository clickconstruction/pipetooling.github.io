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

describe('the older signature, from a webhook made in Quo’s own settings', () => {
  // That webhook's key is plain base64, no `whsec_`; the app keeps whatever was pasted, with or without the prefix.
  const PLAIN_SECRET = KEY.toString('base64')
  const MS = String(NOW)
  const PRETTY = JSON.stringify({ id: 'EVlegacy0001', object: 'event', type: 'message.received', data: { object: { body: 'Hi' } } }, null, 2)
  const signLegacy = (key: Buffer, stamp: string, body: string) => createHmac('sha256', key).update(`${stamp}.${body}`).digest('base64')
  const legacyHeaders = (stamp = MS, body = PRETTY, key = KEY) => ({ 'openphone-signature': `hmac;1;${stamp};${signLegacy(key, stamp, body)}` })

  it('takes a delivery signed over the raw body, keyed with or without whsec_, its event id as the delivery id', async () => {
    expect(await verifySignature(legacyHeaders(), PRETTY, PLAIN_SECRET, NOW)).toEqual({ ok: true, webhookId: 'EVlegacy0001', timestamp: Math.floor(NOW / 1000) })
    expect((await verifySignature(legacyHeaders(), PRETTY, `whsec_${PLAIN_SECRET}`, NOW)).ok).toBe(true)
    expect((await verifySignature(new Headers(legacyHeaders()), new TextEncoder().encode(PRETTY), PLAIN_SECRET, NOW)).ok).toBe(true)
  })

  it('takes one signed over the JSON written out with no spaces, as Quo’s Node sample signs it', async () => {
    const compact = JSON.stringify(JSON.parse(PRETTY))
    expect((await verifySignature({ 'openphone-signature': `hmac;1;${MS};${signLegacy(KEY, MS, compact)}` }, PRETTY, PLAIN_SECRET, NOW)).ok).toBe(true)
  })

  it('takes any matching entry of several, and seconds as well as milliseconds', async () => {
    const good = signLegacy(KEY, MS, PRETTY)
    const old = signLegacy(keyOf('the key before'), MS, PRETTY)
    expect((await verifySignature({ 'openphone-signature': `hmac;1;${MS};${old},hmac;1;${MS};${good}` }, PRETTY, PLAIN_SECRET, NOW)).ok).toBe(true)
    expect((await verifySignature(legacyHeaders(STAMP), PRETTY, PLAIN_SECRET, NOW)).ok).toBe(true)
  })

  it('refuses another key, a changed body, another scheme or version, and a delivery more than five minutes away', async () => {
    expect(await verifySignature(legacyHeaders(MS, PRETTY, keyOf('another made-up key')), PRETTY, PLAIN_SECRET, NOW)).toEqual({ ok: false, why: 'bad signature' })
    expect(await verifySignature(legacyHeaders(), PRETTY.replace('Hi', 'Ho'), PLAIN_SECRET, NOW)).toEqual({ ok: false, why: 'bad signature' })
    const sig = signLegacy(KEY, MS, PRETTY)
    expect(await verifySignature({ 'openphone-signature': `hmac;2;${MS};${sig}` }, PRETTY, PLAIN_SECRET, NOW)).toEqual({ ok: false, why: 'missing headers' })
    expect(await verifySignature({ 'openphone-signature': `sha;1;${MS};${sig}` }, PRETTY, PLAIN_SECRET, NOW)).toEqual({ ok: false, why: 'missing headers' })
    expect(await verifySignature({ 'openphone-signature': `hmac;1;soon;${sig}` }, PRETTY, PLAIN_SECRET, NOW)).toEqual({ ok: false, why: 'bad timestamp' })
    expect(await verifySignature(legacyHeaders(String(NOW - 301_000)), PRETTY, PLAIN_SECRET, NOW)).toEqual({ ok: false, why: 'too old' })
    expect(await verifySignature(legacyHeaders(String(NOW + 301_000)), PRETTY, PLAIN_SECRET, NOW)).toEqual({ ok: false, why: 'too new' })
  })

  it('reads the newer headers first when a delivery carries both', async () => {
    expect(await verifySignature({ ...headersFor(), ...legacyHeaders(MS, BODY) }, BODY, SECRET, NOW)).toEqual({ ok: true, webhookId: 'msg_made_up_0001', timestamp: Number(STAMP) })
  })

  it('falls back to the timestamp for the delivery id when the body has no event id', async () => {
    const body = JSON.stringify({ type: 'message.received' })
    expect(await verifySignature(legacyHeaders(MS, body), body, PLAIN_SECRET, NOW)).toEqual({ ok: true, webhookId: `legacy:${MS}`, timestamp: Math.floor(NOW / 1000) })
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
