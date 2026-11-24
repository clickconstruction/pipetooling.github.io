/**
 * The send's own call, read off the wire (punch list #416): what the page says when the function answers that the
 * email went and its record did not land. The function deployed today answers that the old way, the one this change
 * ships answers it under a key of its own, and the page must say the same thing for both. Every reason is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'a-made-up-session' } } }) } } }))

import { DOCUMENT_BUILDER_SEND_REFUSALS as REFUSALS } from './sendWords'
import { sendBuilder, sendSheet } from './sendIo'

afterEach(() => {
  vi.unstubAllGlobals()
})

const SHEET = { builderKey: 'insurance', sheetId: 's1', companyId: 'c1', contactEmail: 'someone@example.com', note: '', why: 'first' as const, anyway: false }
const BUILDER = { builderKey: 'sub-nda', customerId: 'k1', aboutJobId: null, contactEmail: 'someone@example.com', note: '', why: 'first' as const, anyway: false }

/** The function answers one body with one status, and the smoke keeps what was asked of it. */
function answering(status: number, body: unknown) {
  const asked: Array<{ url: string; body: unknown }> = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: { body: string }) => {
      asked.push({ url: String(url), body: JSON.parse(init.body) })
      return new Response(JSON.stringify(body), { status })
    }),
  )
  return asked
}

const WENT = 'The email went, but the send was not recorded here. Do not send it again. The reason: a made-up reason from the database'

describe('a send that went and was not recorded, off the wire', () => {
  it('reads the same from the function with the key of its own and from the one deployed before it', async () => {
    const asked = answering(REFUSALS.sentNotRecorded.status, { error: 'sentNotRecorded', words: REFUSALS.sentNotRecorded.words, detail: 'a made-up reason from the database' })
    expect(await sendSheet(SHEET)).toEqual({ ok: false, error: WENT })
    expect(await sendBuilder(BUILDER)).toEqual({ ok: false, error: WENT })
    expect(asked.map((a) => a.url.endsWith('/functions/v1/document-builder-send'))).toEqual([true, true])
    expect(asked[0]?.body).toMatchObject({ action: 'send', sheetId: 's1' })
    expect(asked[1]?.body).toMatchObject({ action: 'send', customerId: 'k1' })

    answering(REFUSALS.failed.status, { error: 'failed', words: REFUSALS.failed.words, detail: 'Sent, but not recorded: a made-up reason from the database' })
    expect(await sendSheet(SHEET)).toEqual({ ok: false, error: WENT })
    expect(await sendBuilder(BUILDER)).toEqual({ ok: false, error: WENT })
  })

  it('never says to try again, and a send that did not go still does', async () => {
    answering(REFUSALS.sentNotRecorded.status, { error: 'sentNotRecorded', words: REFUSALS.sentNotRecorded.words })
    const went = await sendSheet(SHEET)
    expect(went).toEqual({ ok: false, error: REFUSALS.sentNotRecorded.words })
    expect(went.ok ? '' : went.error).not.toMatch(/try again/i)

    answering(REFUSALS.sendFailed.status, { error: 'sendFailed', words: REFUSALS.sendFailed.words, detail: 'a made-up answer from the mail service' })
    expect(await sendSheet(SHEET)).toEqual({ ok: false, error: 'The email did not go. Nothing was recorded. Try again. The reason: a made-up answer from the mail service' })
  })
})
