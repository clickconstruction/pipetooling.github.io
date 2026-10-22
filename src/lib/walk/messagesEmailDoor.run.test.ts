/**
 * messages-email's own handler, run here on the walk tester's door (punch list #142 PR 5): the tester goes only at the
 * kit's address on the kit's contact and with no files; a sample, a twin and a training account that is not the
 * tester are refused as before; the office is unchanged and no kit is read for it. The kit's channel row is left out
 * of the fake, so a send that passes the door ends on *That address is not one of theirs* before any line is written.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeClient, makeFakeDb, type FakeDb } from '../../test/edgeFakeDb'
import { KIT, KIT_ROW, OTHER, SESSIONS, USERS } from './kitDoorFixtures'
import { KIT_DOOR_WORDS } from './kitDoor'

type Handler = (req: Request) => Promise<Response>
const box: { handler: Handler | null; db: FakeDb; bearer: string | null } = { handler: null, db: makeFakeDb(), bearer: null }

vi.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({ serve: (h: Handler) => void (box.handler = h) }))
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({
  createClient: () => fakeClient(box.db, SESSIONS, () => box.bearer),
}))

const ENV: Record<string, string> = {
  SUPABASE_URL: 'http://127.0.0.1:9',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  SUPABASE_ANON_KEY: 'anon-key',
  RESEND_API_KEY: 'resend-key',
}

// A Deno file: loaded by path at run time, so the app's typecheck does not follow it into Deno's globals.
const FUNCTION_FILE = '../../../supabase/functions/messages-email/index.ts'

beforeAll(async () => {
  ;(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => ENV[k] } }
  await import(/* @vite-ignore */ FUNCTION_FILE)
})
beforeEach(() => {
  box.db = makeFakeDb()
  box.db.tables.users = USERS.map((u) => ({ ...u }))
  box.db.tables.app_settings = [{ ...KIT_ROW }]
  box.db.tables.contact_channels = []
  box.db.rpcs.gc_office_team = true
})

async function send(bearer: string, body: Record<string, unknown>) {
  box.bearer = bearer
  const res = await box.handler!(new Request('http://localhost/functions/v1/messages-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` },
    body: JSON.stringify(body),
  }))
  return { status: res.status, body: (await res.json()) as { ok?: boolean; error?: string; words?: string } }
}

const atKit = { contactId: KIT.contactId, channelId: KIT.emailChannelId, subject: 'Re: Estimate #1', body: 'Thursday works for us.' }
const atOther = { contactId: OTHER.contactId, channelId: OTHER.channelId, subject: 'Hello', body: 'Hello there.' }

describe('messages-email and the walk tester (punch list #142 PR 5)', () => {
  it('lets the tester through at the kit’s address, past the door and the office check', async () => {
    expect(await send('tester-jwt', atKit)).toEqual({ status: 404, body: { ok: false, error: 'notFound', words: 'That address is not one of theirs.' } })
    expect(box.db.calls).toEqual(['auth.getUser', 'select users', 'select app_settings', 'rpc gc_office_team', 'select contact_channels'])
  })

  it('refuses the tester at anyone else’s address, with the words', async () => {
    expect(await send('tester-jwt', atOther)).toEqual({ status: 403, body: { ok: false, error: 'walkTesterOnly', words: KIT_DOOR_WORDS } })
    expect(box.db.calls).toEqual(['auth.getUser', 'select users', 'select app_settings'])
    expect(await send('tester-jwt', { ...atKit, channelId: KIT.phoneChannelId, contactId: OTHER.contactId })).toMatchObject({ status: 403, body: { error: 'walkTesterOnly' } })
  })

  it('refuses the tester a file', async () => {
    const files = [{ key: 'f1', source: 'device', name: 'photo.jpg', mime: 'image/jpeg', way: 'file', bytes: 'AAAA' }]
    expect(await send('tester-jwt', { ...atKit, files })).toEqual({ status: 403, body: { ok: false, error: 'walkTesterOnly', words: 'The walk tester sends no files.' } })
  })

  it('refuses the tester while no kit exists', async () => {
    box.db.tables.app_settings = []
    expect(await send('tester-jwt', atKit)).toMatchObject({ status: 403, body: { error: 'walkTesterOnly', words: KIT_DOOR_WORDS } })
  })

  it('refuses a sample, a twin and a training account that is not the tester, as before', async () => {
    for (const jwt of ['sample-jwt', 'twin-jwt', 'training-jwt']) {
      expect(await send(jwt, atKit), jwt).toEqual({ status: 403, body: { ok: false, error: 'readOnly', words: 'This account cannot send emails.' } })
    }
  })

  it('leaves the office as it was: no kit read, on to the address', async () => {
    expect(await send('office-jwt', atOther)).toEqual({ status: 404, body: { ok: false, error: 'notFound', words: 'That address is not one of theirs.' } })
    expect(box.db.calls).toEqual(['auth.getUser', 'select users', 'rpc gc_office_team', 'select contact_channels'])
  })
})
