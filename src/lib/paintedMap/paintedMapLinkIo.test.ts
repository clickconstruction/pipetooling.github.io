/**
 * A link whose code the phone picks (punch list #394, step 3). The ask for it must leave inside the
 * press, before the phone opens Messages, so with the session at hand nothing is awaited first. A
 * lost signal gets one more try, a refusal comes back in the function's own words, and a function
 * from before this step hands back a code of its own.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const session = vi.hoisted(() => ({ token: 'tok-1', reads: 0 }))
vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => {
        session.reads += 1
        return { data: { session: session.token ? { access_token: session.token } : null } }
      },
    },
  },
}))

import { PAINTED_MAP_LINK_ALPHABET } from './paintedMapLink'
import { canMakePaintedMapLink, mintPaintedMapLink, pickPaintedMapLinkCode, registerPaintedMapLink } from './paintedMapLinkIo'

type Sent = { body: Record<string, unknown>; keepalive: boolean | undefined; auth: string }
const sent: Sent[] = []
let answers: Array<{ status: number; body: unknown } | 'lost'> = []
const answer = (status: number, body: unknown) => ({ status, json: async () => body }) as unknown as Response

beforeEach(() => {
  vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
    sent.push({ body: JSON.parse(String(init.body)), keepalive: init.keepalive, auth: (init.headers as Record<string, string>).Authorization ?? '' })
    const next = answers.shift() ?? { status: 200, body: { ok: true } }
    if (next === 'lost') throw new TypeError('Load failed')
    return answer(next.status, next.body)
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
  sent.length = 0
  answers = []
  session.token = 'tok-1'
  session.reads = 0
})

describe('pickPaintedMapLinkCode', () => {
  it('picks ten letters of the link’s alphabet, and not the same ten twice', () => {
    const a = pickPaintedMapLinkCode()
    const b = pickPaintedMapLinkCode()
    expect(a).toHaveLength(10)
    expect([...a].every((c) => PAINTED_MAP_LINK_ALPHABET.includes(c))).toBe(true)
    expect(a).not.toBe(b)
  })
})

describe('canMakePaintedMapLink', () => {
  it('asks with nothing written, and says yes only on the function’s yes', async () => {
    answers = [{ status: 200, body: { ok: true } }]
    expect(await canMakePaintedMapLink('m1')).toBe(true)
    expect(sent[0]!.body).toEqual({ action: 'desk.can', mapId: 'm1' })
    answers = [{ status: 409, body: { error: 'This map has nothing on it yet. Draw a line or add a place first.' } }]
    expect(await canMakePaintedMapLink('m1')).toBe(false)
    // A function from before the question existed answers that the ask did not go through.
    answers = [{ status: 400, body: { error: 'That did not go through. Try again.' } }]
    expect(await canMakePaintedMapLink('m1')).toBe(false)
    answers = ['lost']
    expect(await canMakePaintedMapLink('m1')).toBe(false)
  })
})

describe('registerPaintedMapLink', () => {
  it('sends the ask before it returns once the session is at hand, to outlive the phone leaving for Messages', async () => {
    await canMakePaintedMapLink('m1')
    sent.length = 0
    session.reads = 0
    answers = [{ status: 200, body: { ok: true, kept: true, endsOn: '2027-02-16' } }]
    const made = registerPaintedMapLink('m1', 'k7m2x9qd4t')
    // Nothing has been awaited: the ask is already on its way, with no second read of the session.
    expect(sent).toEqual([{ body: { action: 'desk.mint', mapId: 'm1', code: 'k7m2x9qd4t' }, keepalive: true, auth: 'Bearer tok-1' }])
    expect(session.reads).toBe(0)
    expect(await made).toEqual({ code: 'k7m2x9qd4t', endsOn: '2027-02-16' })
  })

  it('takes the code a function from before this step made for itself', async () => {
    answers = [{ status: 200, body: { ok: true, code: 'zzzzzzzzzz', endsOn: '2027-02-16' } }]
    expect(await registerPaintedMapLink('m1', 'k7m2x9qd4t')).toEqual({ code: 'zzzzzzzzzz', endsOn: '2027-02-16' })
  })

  it('asks once more for the same code after a lost signal, and says No signal after two', async () => {
    answers = ['lost', { status: 200, body: { ok: true, kept: true, endsOn: null } }]
    expect(await registerPaintedMapLink('m1', 'k7m2x9qd4t')).toEqual({ code: 'k7m2x9qd4t', endsOn: null })
    expect(sent.map((s) => s.body.code)).toEqual(['k7m2x9qd4t', 'k7m2x9qd4t'])
    answers = ['lost', 'lost']
    await expect(registerPaintedMapLink('m1', 'k7m2x9qd4t')).rejects.toThrow('No signal. Check the connection and try again.')
  })

  it('throws the function’s own words on a refusal, and never calls an answer with no code a link', async () => {
    answers = [{ status: 403, body: { error: 'This is a training account, so no link was made.' } }]
    await expect(registerPaintedMapLink('m1', 'k7m2x9qd4t')).rejects.toThrow('This is a training account, so no link was made.')
    answers = [{ status: 200, body: { ok: true } }]
    await expect(registerPaintedMapLink('m1', 'k7m2x9qd4t')).rejects.toThrow('The link was not made. The function answered 200.')
  })
})

describe('mintPaintedMapLink', () => {
  it('asks for a link under a code this phone picked, and hands back the link the function kept', async () => {
    answers = [{ status: 200, body: { ok: true, kept: true, endsOn: '2027-02-16' } }]
    const made = await mintPaintedMapLink('m1')
    const asked = sent[sent.length - 1]!.body
    expect(asked).toMatchObject({ action: 'desk.mint', mapId: 'm1' })
    expect(String(asked.code)).toHaveLength(10)
    expect(made).toEqual({ code: asked.code, endsOn: '2027-02-16' })
  })

  it('throws the function’s own words on a refusal', async () => {
    answers = [{ status: 403, body: { error: 'This is a training account, so no link was made.' } }]
    await expect(mintPaintedMapLink('m1')).rejects.toThrow('This is a training account, so no link was made.')
  })
})
