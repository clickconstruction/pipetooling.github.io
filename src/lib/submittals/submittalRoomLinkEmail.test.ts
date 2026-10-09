/**
 * send-submittal-room-link's test (v2.5026, Submittals decision 11): the pure rules it runs
 * (`_shared/submittalRoomLinkEmail.ts`), and the function's own order of steps, read from its source.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildSubmittalRoomLinkEmail,
  parseRoomLinkRequest,
  roomLinkBidLabel,
  roomLinkKeptHtml,
  roomLinkRefusal,
  roomLinkUrl,
  ROOM_LINK_ERRORS,
  ROOM_LINK_EVENT,
  ROOM_LINK_KIND,
} from '../../../supabase/functions/_shared/submittalRoomLinkEmail'
import { roomLink } from './submittalRoom'
import { sentKindGroup } from '../sent/sentCopies'

const ID = '0b6f6b2e-6f0e-4a8e-9a43-3b4f4f0f9c11'
const TOKEN = 'b'.repeat(48)

describe('parseRoomLinkRequest', () => {
  it('takes a person and an optional line, trimmed', () => {
    expect(parseRoomLinkRequest({ person_id: ` ${ID} ` })).toEqual({ personId: ID, note: '' })
    expect(parseRoomLinkRequest({ person_id: ID, note: '  Rev 2 has the new valves.  ' })).toEqual({ personId: ID, note: 'Rev 2 has the new valves.' })
    expect(parseRoomLinkRequest({ person_id: ID, note: null })).toEqual({ personId: ID, note: '' })
  })
  it('refuses anything else', () => {
    for (const body of [null, 'x', [ID], {}, { person_id: 'p1' }, { person_id: ID, note: 4 }, { person_id: ID, note: 'x'.repeat(1001) }]) {
      expect(parseRoomLinkRequest(body), JSON.stringify(body)).toBeNull()
    }
  })
})

describe('roomLinkRefusal', () => {
  const caller = { read_only: false, is_digital_twin: false }
  const person = { email: 'dana@arch.test', closed_at: null }
  const room = { status: 'open', shared_at: '2026-10-09T15:00:00Z' }
  it('lets a send go to an open link on a shared, open room', () => {
    expect(roomLinkRefusal({ caller, person, room })).toBeNull()
  })
  it('refuses each case with its own key', () => {
    expect(roomLinkRefusal({ caller: null, person, room })).toBe('signIn')
    expect(roomLinkRefusal({ caller: { read_only: true }, person, room })).toBe('readOnly')
    expect(roomLinkRefusal({ caller: { is_digital_twin: true }, person, room })).toBe('readOnly')
    expect(roomLinkRefusal({ caller, person: null, room })).toBe('notFound')
    expect(roomLinkRefusal({ caller, person, room: null })).toBe('notFound')
    expect(roomLinkRefusal({ caller, person: { ...person, closed_at: '2026-10-01T00:00:00Z' }, room })).toBe('personClosed')
    expect(roomLinkRefusal({ caller, person, room: { ...room, status: 'closed' } })).toBe('roomClosed')
    expect(roomLinkRefusal({ caller, person, room: { ...room, shared_at: null } })).toBe('notShared')
    expect(roomLinkRefusal({ caller, person: { ...person, email: null }, room })).toBe('noEmail')
    expect(roomLinkRefusal({ caller, person: { ...person, email: 'not an address' }, room })).toBe('noEmail')
  })
  it('a training account or a twin is refused before anything about the person', () => {
    expect(roomLinkRefusal({ caller: { read_only: true }, person: null, room: null })).toBe('readOnly')
  })
  it('each refusal carries its status', () => {
    expect(ROOM_LINK_ERRORS).toMatchObject({ badRequest: 400, signIn: 401, readOnly: 403, notFound: 404, personClosed: 409, roomClosed: 409, notShared: 409, noEmail: 422, sendFailed: 502, failed: 500 })
  })
})

describe('the address and the bid', () => {
  it('the link is the one Personal link copies', () => {
    expect(roomLinkUrl('https://clicktooling.com/', TOKEN)).toBe(roomLink('https://clicktooling.com', TOKEN))
  })
  it('names the bid as the reply email does', () => {
    expect(roomLinkBidLabel({ bid_number: '375', project_name: 'SpaceX BA-02N' })).toBe('B375 SpaceX BA-02N')
    expect(roomLinkBidLabel({ bid_number: null, project_name: 'SpaceX BA-02N' })).toBe('SpaceX BA-02N')
    expect(roomLinkBidLabel({ bid_number: ' ', project_name: null })).toBe('the project')
    expect(roomLinkBidLabel(null)).toBe('the project')
  })
})

describe('buildSubmittalRoomLinkEmail', () => {
  const base = { companyName: 'Click Plumbing and Electrical', phone: '(512) 360-0599', bidLabel: 'B375 SpaceX BA-02N', revNumber: 2, personName: 'Dana Whitfield', mayDecide: true, link: `https://clicktooling.com/submittal?t=${TOKEN}`, note: '' }
  it('names the revision and the bid, greets by first name, and carries their link', () => {
    const m = buildSubmittalRoomLinkEmail(base)
    expect(m.subject).toBe('Click Plumbing and Electrical shared Rev 2 of the submittal for B375 SpaceX BA-02N')
    expect(m.text.split('\n')[0]).toBe('Hi Dana,')
    expect(m.text).toContain('Rev 2 of the submittal for B375 SpaceX BA-02N is ready for your review.')
    expect(m.text).toContain('On the page you can approve each product, send one back, or ask a question.')
    expect(m.text).toContain(`Open the review: ${base.link}`)
    expect(m.text).toContain('This link is yours. There is no password.')
    expect(m.text.endsWith('Click Plumbing and Electrical · (512) 360-0599')).toBe(true)
    expect(m.html).toContain(`href="${base.link}"`)
  })
  it('a watcher reads that they can read and ask; no shared revision names none', () => {
    const m = buildSubmittalRoomLinkEmail({ ...base, mayDecide: false, revNumber: null })
    expect(m.subject).toBe('Click Plumbing and Electrical shared the submittal for B375 SpaceX BA-02N')
    expect(m.text).toContain('The submittal for B375 SpaceX BA-02N is ready for your review.')
    expect(m.text).toContain('On the page you can read every product and ask a question.')
    expect(m.text).not.toContain('approve')
  })
  it('the office’s line comes right after the greeting, escaped in the HTML', () => {
    const m = buildSubmittalRoomLinkEmail({ ...base, note: '  The flush valves changed <again>.  ' })
    expect(m.text.split('\n').slice(0, 3)).toEqual(['Hi Dana,', '', 'The flush valves changed <again>.'])
    expect(m.html).toContain('The flush valves changed &lt;again&gt;.')
    expect(m.html).not.toContain('<again>')
    expect(buildSubmittalRoomLinkEmail(base).text.split('\n')[2]).toMatch(/^Rev 2 of the submittal/)
  })
  it('a person with no name is greeted plainly', () => {
    expect(buildSubmittalRoomLinkEmail({ ...base, personName: '  ' }).text.split('\n')[0]).toBe('Hi there,')
  })
})

describe('the sent copy keeps no token', () => {
  it('the link reads ?t=… in the kept copy, the button and the address alike', () => {
    const m = buildSubmittalRoomLinkEmail({ companyName: 'C', phone: '', bidLabel: 'B1', revNumber: 1, personName: 'Dana', mayDecide: true, link: `https://clicktooling.com/submittal?t=${TOKEN}`, note: '' })
    const kept = roomLinkKeptHtml(m.html)
    expect(kept).not.toContain(TOKEN)
    expect(kept.match(/\/submittal\?t=…/g)?.length).toBe(2)
  })
  it('files under the Bids group of the sent copies', () => {
    expect(sentKindGroup(ROOM_LINK_KIND)).toBe('bids')
  })
})

describe('send-submittal-room-link, as written', () => {
  const src = readFileSync(resolve(__dirname, '../../../supabase/functions/send-submittal-room-link/index.ts'), 'utf8')
  const at = (s: string): number => {
    const i = src.indexOf(s)
    expect(i, s).toBeGreaterThan(-1)
    return i
  }
  it('reads the person as the caller, refuses before it sends, and records only after the send', () => {
    expect(at("userClient.from('bid_submittal_people')")).toBeLessThan(at('roomLinkRefusal('))
    expect(at('roomLinkRefusal(')).toBeLessThan(at('sendEmailViaResend('))
    expect(at("if (!sent.success) return refuse('sendFailed'")).toBeLessThan(at('fileSentEmailBestEffort('))
    expect(at('fileSentEmailBestEffort(')).toBeLessThan(at("from('bid_submittal_events').insert("))
  })
  it('sends as the company through the one sender, keeps the copy without the token, and stamps the event', () => {
    expect(src).toContain('from: COMPANY_EMAIL_FROM')
    expect(src).toContain('html: roomLinkKeptHtml(mail.html)')
    expect(src).toContain('event_type: ROOM_LINK_EVENT')
    expect(src).toContain("Deno.env.get('APP_ORIGIN')")
    expect(src).not.toContain('public_origin')
  })
  it('the event is one the table takes once the migration is pushed', () => {
    const sql = readFileSync(resolve(__dirname, '../../../supabase/migrations/20261009235500_submittal_link_sent_event.sql'), 'utf8')
    expect(sql).toContain(`'${ROOM_LINK_EVENT}'`)
    for (const kept of ['view', 'identified', 'decided', 'reply', 'file_dropped', 'shared', 'closed', 'asked']) expect(sql).toContain(`'${kept}'`)
  })
})
