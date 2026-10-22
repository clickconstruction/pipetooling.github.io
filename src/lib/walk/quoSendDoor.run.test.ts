/**
 * quo-send's own handler, run here on the walk tester's door (punch list #142 PR 5): the tester, a training account,
 * goes only at one of the kit's channels on the kit's contact, never Job Mode; a sample, a twin and a training account
 * that is not the tester are refused as before; the office is unchanged and no kit is read for it. The URL imports are
 * stood in for and the database is a fake that applies the function's filters. The kit's channel row is left out of
 * the fake, so a send that passes the door ends on *That number is not one of theirs* before anything reaches Quo.
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

const ENV: Record<string, string> = { SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_SERVICE_ROLE_KEY: 'service-key', SUPABASE_ANON_KEY: 'anon-key' }

// A Deno file: loaded by path at run time, so the app's typecheck does not follow it into Deno's globals.
const FUNCTION_FILE = '../../../supabase/functions/quo-send/index.ts'

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
  const res = await box.handler!(new Request('http://localhost/functions/v1/quo-send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` },
    body: JSON.stringify(body),
  }))
  return { status: res.status, body: (await res.json()) as { ok?: boolean; error?: string; words?: string } }
}

const atKit = { contactId: KIT.contactId, channelId: KIT.phoneChannelId, body: 'Your estimate is ready.' }
const atOther = { contactId: OTHER.contactId, channelId: OTHER.channelId, body: 'Hello' }

describe('quo-send and the walk tester (punch list #142 PR 5)', () => {
  it('lets the tester through at the kit’s phone channel, past the door and the office check', async () => {
    expect(await send('tester-jwt', atKit)).toEqual({ status: 404, body: { ok: false, error: 'notFound', words: 'That number is not one of theirs.' } })
    expect(box.db.calls).toEqual(['auth.getUser', 'select users', 'select app_settings', 'rpc gc_office_team', 'select contact_channels'])
  })

  it('refuses the tester at anyone else’s channel, with the words, before the office check', async () => {
    expect(await send('tester-jwt', atOther)).toEqual({ status: 403, body: { ok: false, error: 'walkTesterOnly', words: KIT_DOOR_WORDS } })
    expect(box.db.calls).toEqual(['auth.getUser', 'select users', 'select app_settings'])
    expect(await send('tester-jwt', { ...atKit, contactId: OTHER.contactId })).toMatchObject({ status: 403, body: { error: 'walkTesterOnly' } })
    expect(await send('tester-jwt', { contactId: KIT.contactId })).toMatchObject({ status: 403, body: { error: 'walkTesterOnly' } })
  })

  it('refuses the tester while no kit exists', async () => {
    box.db.tables.app_settings = []
    expect(await send('tester-jwt', atKit)).toEqual({ status: 403, body: { ok: false, error: 'walkTesterOnly', words: KIT_DOOR_WORDS } })
  })

  it('refuses the tester in Job Mode, before any kit is read', async () => {
    expect(await send('tester-jwt', { from: 'job_mode', jobId: 'j-1', kind: 'on_my_way', typed: {} })).toEqual({
      status: 403,
      body: { ok: false, error: 'walkTesterOnly', words: KIT_DOOR_WORDS },
    })
    expect(box.db.calls).toEqual(['auth.getUser', 'select users'])
  })

  it('refuses a sample, a twin and a training account that is not the tester, as before', async () => {
    for (const jwt of ['sample-jwt', 'twin-jwt', 'training-jwt']) {
      expect(await send(jwt, atKit), jwt).toEqual({ status: 403, body: { ok: false, error: 'readOnly', words: 'This account cannot send texts.' } })
    }
  })

  it('leaves the office as it was: no kit read, on to the number', async () => {
    expect(await send('office-jwt', atOther)).toEqual({ status: 404, body: { ok: false, error: 'notFound', words: 'That number is not one of theirs.' } })
    expect(box.db.calls).toEqual(['auth.getUser', 'select users', 'rpc gc_office_team', 'select contact_channels'])
  })
})
