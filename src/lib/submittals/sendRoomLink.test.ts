import { beforeEach, describe, expect, it, vi } from 'vitest'

const invoke = vi.fn()
vi.mock('../supabase', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }))

import { canEmailLink, readRoomLinkAnswer, roomHasSentLink, roomLinkRefusalWords, sendRoomLink, sharedLinksLine } from './sendRoomLink'
import { ROOM_LINK_ERRORS, type RoomLinkErrorKey } from '../../../supabase/functions/_shared/submittalRoomLinkEmail'

describe('readRoomLinkAnswer', () => {
  it('a send that went, recorded or not', () => {
    expect(readRoomLinkAnswer({ ok: true, to: 'dana@arch.test', sentAt: '2026-10-09T15:00:00Z' }, null)).toEqual({ ok: true, to: 'dana@arch.test', sentAt: '2026-10-09T15:00:00Z', recorded: true })
    expect(readRoomLinkAnswer({ ok: true, to: 'dana@arch.test', sentAt: '2026-10-09T15:00:00Z', recorded: false }, null)).toMatchObject({ ok: true, recorded: false })
  })
  it('a refusal by its key, with its detail; anything unknown is failed', () => {
    expect(readRoomLinkAnswer(null, { error: 'noEmail' })).toEqual({ ok: false, key: 'noEmail' })
    expect(readRoomLinkAnswer(null, { error: 'sendFailed', detail: 'Resend 403' })).toEqual({ ok: false, key: 'sendFailed', detail: 'Resend 403' })
    expect(readRoomLinkAnswer(null, { error: 'toString' })).toEqual({ ok: false, key: 'failed' })
    expect(readRoomLinkAnswer(null, { code: 'NOT_FOUND', message: 'Requested function was not found' })).toEqual({ ok: false, key: 'failed' })
    expect(readRoomLinkAnswer({ ok: true }, null)).toEqual({ ok: false, key: 'failed' })
  })
  it('every refusal has the office’s words', () => {
    for (const key of Object.keys(ROOM_LINK_ERRORS) as RoomLinkErrorKey[]) expect(roomLinkRefusalWords(key).length).toBeGreaterThan(10)
    expect(roomLinkRefusalWords('readOnly')).toBe('A training account cannot email a reviewer.')
  })
})

describe('sendRoomLink', () => {
  beforeEach(() => {
    invoke.mockReset()
  })
  it('posts the person and the trimmed line, and reads the answer', async () => {
    invoke.mockResolvedValue({ data: { ok: true, to: 'dana@arch.test', sentAt: '2026-10-09T15:00:00Z' }, error: null })
    expect(await sendRoomLink('p1', '  See the valves.  ')).toMatchObject({ ok: true, to: 'dana@arch.test' })
    expect(invoke).toHaveBeenCalledWith('send-submittal-room-link', { body: { person_id: 'p1', note: 'See the valves.' } })
    await sendRoomLink('p1')
    expect(invoke).toHaveBeenLastCalledWith('send-submittal-room-link', { body: { person_id: 'p1' } })
  })
  it('a refusal comes back from the error body; a throw is failed, never thrown', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'Edge Function returned a non-2xx status code', context: { json: () => Promise.resolve({ error: 'roomClosed' }) } } })
    expect(await sendRoomLink('p1')).toEqual({ ok: false, key: 'roomClosed' })
    invoke.mockImplementation(() => { throw new Error('offline') })
    expect(await sendRoomLink('p1')).toEqual({ ok: false, key: 'failed', detail: 'offline' })
  })
})

describe('what the Share step reads', () => {
  it('the room has sent a link once any link_sent event is on it', () => {
    expect(roomHasSentLink([{ event_type: 'view' }, { event_type: 'shared' }])).toBe(false)
    expect(roomHasSentLink([{ event_type: 'view' }, { event_type: 'link_sent' }])).toBe(true)
  })
  it('a person the app can email has an open link and an address', () => {
    expect(canEmailLink({ email: 'dana@arch.test', closed_at: null })).toBe(true)
    expect(canEmailLink({ email: 'dana@arch.test', closed_at: '2026-10-01T00:00:00Z' })).toBe(false)
    expect(canEmailLink({ email: '', closed_at: null })).toBe(false)
    expect(canEmailLink({ email: null as unknown as string, closed_at: null })).toBe(false)
  })
  it('the line after the Share window’s sends', () => {
    expect(sharedLinksLine(1, [])).toBe('Emailed one person their link.')
    expect(sharedLinksLine(2, [])).toBe('Emailed 2 people their links.')
    expect(sharedLinksLine(1, [{ name: 'Logan Parsons', key: 'noEmail' }])).toBe('Emailed one person their link. Not sent to Logan Parsons: There is no email address on file for them.')
    expect(sharedLinksLine(0, [{ name: 'Dana', key: 'sendFailed' }])).toBe('No link was emailed. Not sent to Dana: The email did not go. Try again in a minute.')
  })
})
