/**
 * Who opened a Document builder link, and when a sheet's link closes (punch list #404). Taunya's calls of
 * 2026-11-21: a sheet's link closes with the last trade, the person sees where the link stands at all times, and
 * every open is kept with who it was. A person with an account is kept by the account. Someone with none is kept by
 * where the open came from and what their browser says about itself. Every name and address here is made up.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  DOCUMENT_BUILDER_LINK_DEVICE_KEYS,
  documentBuilderLinkAgentWords,
  documentBuilderLinkDevice,
  documentBuilderLinkEndedWhy,
  documentBuilderLinkOffWords,
  documentBuilderLinkOpenRow,
  documentBuilderLinkOpenWords,
  documentBuilderLinkSendRemakes,
  documentBuilderLinkWithSendsWords,
  type DocumentBuilderLinkOpen,
} from './link'
import { linkDeviceOf, stateFrom } from './linkIo'

const fn = (name: string) => readFileSync(resolve(__dirname, `../../../supabase/functions/${name}`), 'utf8')
const LINK = '00000000-0000-0000-0000-000000404311'
const USER = '00000000-0000-0000-0000-0000004043a1'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

describe('the device a page reports with an open', () => {
  it('keeps the few named details, as short plain text', () => {
    expect(documentBuilderLinkDevice({ language: 'en-US', timeZone: 'America/Phoenix', screen: '390x844', platform: 'iPhone', touch: 'yes' })).toEqual({ language: 'en-US', timeZone: 'America/Phoenix', screen: '390x844', platform: 'iPhone', touch: 'yes' })
    expect(Object.keys(documentBuilderLinkDevice({ language: 'x'.repeat(500) }))).toEqual(['language'])
    expect(documentBuilderLinkDevice({ language: 'x'.repeat(500) }).language).toHaveLength(80)
  })

  it('drops everything else a page might send', () => {
    expect(documentBuilderLinkDevice({ language: 'en-US', canvas: 'a drawn fingerprint', fonts: ['a', 'b'], screen: 390, timeZone: { nested: true }, platform: '  ', touch: 'a\u0000b' })).toEqual({ language: 'en-US', touch: 'a b' })
    for (const raw of [null, undefined, 'a string', 7, ['language'], true]) expect(documentBuilderLinkDevice(raw)).toEqual({})
    expect(DOCUMENT_BUILDER_LINK_DEVICE_KEYS).toEqual(['language', 'timeZone', 'screen', 'platform', 'touch'])
  })

  it('is read from what the browser tells every site, and leaves out what it hides', () => {
    expect(linkDeviceOf({ language: 'es-MX', timeZone: 'America/Phoenix', screenWidth: 390, screenHeight: 844.4, platform: 'iPhone', touchPoints: 5 })).toEqual({ language: 'es-MX', timeZone: 'America/Phoenix', screen: '390x844', platform: 'iPhone', touch: 'yes' })
    expect(linkDeviceOf({ language: 'en-US', touchPoints: 0 })).toEqual({ language: 'en-US', touch: 'no' })
    expect(linkDeviceOf({ screenWidth: 0, screenHeight: 844 })).toEqual({})
    expect(linkDeviceOf({})).toEqual({})
  })
})

describe('the row an open writes', () => {
  it('keeps a person with an account by the account alone', () => {
    expect(documentBuilderLinkOpenRow({ linkId: LINK, viewer: 'staff', userId: USER, revision: 2, ip: '203.0.113.7', agent: WINDOWS, device: { language: 'en-US' } })).toEqual({ link_id: LINK, viewer: 'staff', user_id: USER, revision: 2, client_ip: null, user_agent: null, device: {} })
  })

  it('keeps someone with no account by where the open came from, the browser and the device', () => {
    expect(documentBuilderLinkOpenRow({ linkId: LINK, viewer: 'outside', userId: null, revision: 2, ip: ' 203.0.113.7 ', agent: IPHONE, device: { language: 'en-US', canvas: 'no' } })).toEqual({
      link_id: LINK,
      viewer: 'outside',
      user_id: null,
      revision: 2,
      client_ip: '203.0.113.7',
      user_agent: IPHONE,
      device: { language: 'en-US' },
    })
  })

  it('cuts what is too long for the row, and writes nothing where there is nothing', () => {
    const row = documentBuilderLinkOpenRow({ linkId: LINK, viewer: 'outside', userId: null, revision: 0, ip: null, agent: 'a'.repeat(900), device: null })
    expect(row.user_agent).toHaveLength(400)
    expect(row.client_ip).toBeNull()
    expect(row.revision).toBeNull()
    expect(row.device).toEqual({})
    expect(documentBuilderLinkOpenRow({ linkId: LINK, viewer: 'outside', userId: null, revision: 1, ip: '2001:db8::1'.padEnd(90, '0'), agent: '  ', device: {} })).toMatchObject({ user_agent: null })
  })
})

describe('one open on the card', () => {
  const open = (over: Partial<DocumentBuilderLinkOpen> = {}): DocumentBuilderLinkOpen => ({ at: '2026-11-21T15:00:00Z', viewer: 'outside', name: null, ip: null, agent: null, device: {}, ...over })

  it('names a person with an account, and says they have one', () => {
    expect(documentBuilderLinkOpenWords(open({ viewer: 'staff', name: 'Dana Whitlock' }))).toEqual({ who: 'Dana Whitlock', detail: 'Has an account' })
    expect(documentBuilderLinkOpenWords(open({ viewer: 'staff' }))).toEqual({ who: 'Someone signed in', detail: 'Has an account' })
  })

  it('says someone has no account, with where the open came from and their browser', () => {
    expect(documentBuilderLinkOpenWords(open({ ip: '203.0.113.7', agent: IPHONE, device: { timeZone: 'America/Phoenix' } }))).toEqual({ who: 'Someone with no account', detail: '203.0.113.7 · Safari on iPhone · America/Phoenix' })
    expect(documentBuilderLinkOpenWords(open())).toEqual({ who: 'Someone with no account', detail: '' })
  })

  it('tells the office’s own preview apart', () => {
    expect(documentBuilderLinkOpenWords(open({ viewer: 'preview', name: 'Dana Whitlock' }))).toEqual({ who: 'Dana Whitlock, in a preview', detail: '' })
    expect(documentBuilderLinkOpenWords(open({ viewer: 'preview' })).who).toBe("The office's preview")
  })

  it('reads a browser in a few words', () => {
    expect(documentBuilderLinkAgentWords(IPHONE)).toBe('Safari on iPhone')
    expect(documentBuilderLinkAgentWords(WINDOWS)).toBe('Chrome on Windows')
    expect(documentBuilderLinkAgentWords('Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0')).toBe('Firefox on Mac')
    expect(documentBuilderLinkAgentWords('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0')).toBe('Edge on Windows')
    expect(documentBuilderLinkAgentWords('curl/8.4.0')).toBe('')
    expect(documentBuilderLinkAgentWords(null)).toBe('')
  })
})

describe('a sheet’s link and its trades', () => {
  const BASE = 'The link is off. Nobody can open this sheet by link.'

  it('says at all times what taking the sheet off a page does to the link', () => {
    expect(documentBuilderLinkWithSendsWords(0)).toBe('')
    expect(documentBuilderLinkWithSendsWords(1)).toBe("1 trade has this sheet. Taking it off their page also switches the sheet's link off.")
    expect(documentBuilderLinkWithSendsWords(3)).toBe("3 trades have this sheet. The sheet's link stays on until the sheet is off the last trade's page.")
  })

  it('says when and why a link is off', () => {
    expect(documentBuilderLinkOffWords({ endedAt: '2026-11-21T15:00:00Z', endedWhy: 'last_send_off' }, 'Nov 21', BASE)).toBe("The link is off. It closed on Nov 21, when the sheet came off the last trade's page. The next send switches it on again.")
    expect(documentBuilderLinkOffWords({ endedAt: '2026-11-21T15:00:00Z', endedWhy: 'off' }, 'Nov 21', BASE)).toBe('The link is off. It was switched off on Nov 21.')
    // A link that never was, and one that ended before the why was kept, read as the card's own words.
    expect(documentBuilderLinkOffWords({}, '', BASE)).toBe(BASE)
    expect(documentBuilderLinkOffWords({ endedAt: '2026-11-20T15:00:00Z', endedWhy: null }, 'Nov 20', BASE)).toBe(BASE)
    expect(documentBuilderLinkEndedWhy('last_send_off')).toBe('last_send_off')
    expect(documentBuilderLinkEndedWhy('lost')).toBeNull()
  })

  it('has the next send make the link again only after it closed with the last trade', () => {
    const row = (made_at: string, ended_at: string | null, ended_why: string | null) => ({ made_at, ended_at, ended_why })
    expect(documentBuilderLinkSendRemakes([row('2026-11-20T10:00:00Z', '2026-11-20T11:00:00Z', 'replaced'), row('2026-11-20T11:00:00Z', '2026-11-21T09:00:00Z', 'last_send_off')])).toBe(true)
    // A dev switched it off: it stays off until a dev switches it on.
    expect(documentBuilderLinkSendRemakes([row('2026-11-20T10:00:00Z', '2026-11-21T09:00:00Z', 'off')])).toBe(false)
    expect(documentBuilderLinkSendRemakes([row('2026-11-20T10:00:00Z', '2026-11-20T11:00:00Z', 'last_send_off'), row('2026-11-21T10:00:00Z', '2026-11-21T11:00:00Z', 'off')])).toBe(false)
    // One that ended before the why was kept is a dev's switch.
    expect(documentBuilderLinkSendRemakes([row('2026-11-20T10:00:00Z', '2026-11-20T11:00:00Z', null)])).toBe(false)
    // A link that is on is not made again, and a sheet with none is made its first elsewhere.
    expect(documentBuilderLinkSendRemakes([row('2026-11-20T10:00:00Z', '2026-11-20T11:00:00Z', 'last_send_off'), row('2026-11-21T10:00:00Z', null, null)])).toBe(false)
    expect(documentBuilderLinkSendRemakes([])).toBe(false)
  })

  it('says all of it in plain words', () => {
    const said = [
      documentBuilderLinkWithSendsWords(1),
      documentBuilderLinkWithSendsWords(3),
      documentBuilderLinkOffWords({ endedAt: 'x', endedWhy: 'last_send_off' }, 'Nov 21', BASE),
      documentBuilderLinkOffWords({ endedAt: 'x', endedWhy: 'off' }, 'Nov 21', BASE),
    ]
    expect(said.flatMap((t) => plainWordsFailures(t))).toEqual([])
  })
})

describe('the link as the function hands it to the tab', () => {
  it('reads a link that is off with when and why, and who opened it', () => {
    const state = stateFrom({ on: false, endedAt: '2026-11-21T15:00:00Z', endedWhy: 'last_send_off', opens: [{ at: '2026-11-21T14:00:00Z', viewer: 'outside', ip: '203.0.113.7', agent: IPHONE, device: { timeZone: 'America/Phoenix', canvas: 'no' } }, { viewer: 'staff' }, 'not an open'], opensTotal: 9 })
    expect(state).toEqual({ on: false, endedAt: '2026-11-21T15:00:00Z', endedWhy: 'last_send_off', opens: [{ at: '2026-11-21T14:00:00Z', viewer: 'outside', name: null, ip: '203.0.113.7', agent: IPHONE, device: { timeZone: 'America/Phoenix' } }], opensTotal: 9 })
  })

  it('reads an older function’s answer, which says nothing of opens or of why', () => {
    expect(stateFrom({ on: false })).toEqual({ on: false, endedAt: null, endedWhy: null })
    expect(stateFrom({ on: true, code: 'abcdefgh23456789', madeAt: '2026-11-20T15:00:00Z', opened: 2 })).toEqual({ on: true, code: 'abcdefgh23456789', madeAt: '2026-11-20T15:00:00Z', opened: 2, lastOpenedAt: null })
    expect(stateFrom({ on: true })).toBeNull()
  })
})

describe('the functions', () => {
  const link = fn('document-builder-link/index.ts')
  const code = fn('_shared/documentBuilderLinkCode.ts')

  it('keep every open, through the one rule for its row', () => {
    expect(link).toContain(".from('document_builder_link_opens')")
    expect(link).toContain('.insert(documentBuilderLinkOpenRow({ linkId: link.id, viewer: view.viewer, userId: view.staffUserId, revision: answer.revision, ip: clientIpFromEdgeRequest(req), agent: req.headers.get(\'user-agent\'), device: body.device }))')
  })

  it('write why a link ended, each way it ends', () => {
    expect(link).toContain("ended_why: 'off'")
    expect(code).toContain("ended_why: 'replaced'")
    // The third why is the database's own: the trigger on a send's take-off writes it.
    expect(readFileSync(resolve(__dirname, '../../../supabase/migrations/20261121190000_document_builder_link_opens.sql'), 'utf8')).toContain("ended_why = 'last_send_off'")
  })

  it('have a send make the link again by the one rule', () => {
    expect(code).toContain('if (rows.length > 0 && !documentBuilderLinkSendRemakes(rows)) return null')
  })
})
