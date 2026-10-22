import { describe, expect, it } from 'vitest'
import type { WalkKit } from './kit'
import {
  acceptLinkIn,
  base64Url,
  estimateMailQuery,
  isEstimateMail,
  lastFour,
  leakedSecret,
  parseWalkAsk,
  replyMessage,
  replyMessageId,
  replyRaw,
  seedOldColumns,
} from './walkFunction'

const KIT: WalkKit = {
  customerId: 'cu-walk',
  contactId: 'c-walk',
  emailChannelId: 'ch-walk-email',
  phoneChannelId: 'ch-walk-phone',
  estimateId: 'e-walk',
  email: 'bids@clickplumbing.example',
  phone: '(737) 300-9478',
  testerId: 'u-tester',
  sharedPhone: false,
  madeAt: '2026-10-22T14:00:00.000Z',
}

describe('parseWalkAsk', () => {
  it('reads each action, the fallback and the words; refuses the rest', () => {
    expect(parseWalkAsk({ action: 'setup' })).toEqual({ action: 'setup', fallback: false, ownerEmail: null, words: null })
    expect(parseWalkAsk({ action: 'setup', fallback: true, ownerEmail: ' Robert@Example.com ' })).toEqual({ action: 'setup', fallback: true, ownerEmail: 'robert@example.com', words: null })
    expect(parseWalkAsk({ action: 'text', words: ' Thursday works ' })).toEqual({ action: 'text', fallback: false, ownerEmail: null, words: 'Thursday works' })
    expect(parseWalkAsk({ action: 'cleanup' })?.action).toBe('cleanup')
    expect(parseWalkAsk({ action: 'delete-everything' })).toBeNull()
    expect(parseWalkAsk({ action: 'text', words: 'x'.repeat(1001) })).toBeNull()
    expect(parseWalkAsk(null)).toBeNull()
    expect(parseWalkAsk([])).toBeNull()
  })
})

describe('the estimate email in bids@', () => {
  it('is searched by the app’s sender and the estimate’s number, this week', () => {
    expect(estimateMailQuery('team@noreply.clicktooling.example', 212)).toBe('from:team@noreply.clicktooling.example subject:"Estimate #212" newer_than:7d')
  })

  it('is the one from the app’s sender whose subject starts with the number, not #2120', () => {
    const from = { address: 'Team@noreply.clicktooling.example' }
    expect(isEstimateMail({ subject: 'Estimate #212 — Walk — $1.00 · Click', from }, 'team@noreply.clicktooling.example', 212)).toBe(true)
    expect(isEstimateMail({ subject: 'Estimate #2120 — other', from }, 'team@noreply.clicktooling.example', 212)).toBe(false)
    expect(isEstimateMail({ subject: 'Estimate #212', from: { address: 'someone@else.example' } }, 'team@noreply.clicktooling.example', 212)).toBe(false)
    expect(isEstimateMail({ subject: 'Estimate #212', from: null }, 'team@noreply.clicktooling.example', 212)).toBe(false)
  })

  it('finds the accept link and its token among the email’s links', () => {
    const links = ['https://clicktooling.example/', 'https://clicktooling.example/estimate/accept?t=abc123DEF', 'https://clicktooling.example/estimate/accept?t=second']
    expect(acceptLinkIn(links)).toEqual({ link: 'https://clicktooling.example/estimate/accept?t=abc123DEF', token: 'abc123DEF' })
    expect(acceptLinkIn(['https://clicktooling.example/estimate/accept?x=1&t=t%2Bok'])).toEqual({ link: 'https://clicktooling.example/estimate/accept?x=1&t=t%2Bok', token: 't+ok' })
    expect(acceptLinkIn(['https://clicktooling.example/help'])).toBeNull()
    expect(acceptLinkIn([])).toBeNull()
  })

  it('names a link or a token by its last four characters alone', () => {
    expect(lastFour('https://clicktooling.example/estimate/accept?t=abc123DEF')).toBe('…3DEF')
    expect(lastFour('')).toBeNull()
    expect(lastFour(null)).toBeNull()
  })
})

describe('the reply from bids@', () => {
  const mail = {
    from: 'bids@clickplumbing.example',
    to: 'team@clickplumbing.example',
    subject: 'Re: Estimate #212 — Walk — $1.00 · Click',
    inReplyTo: '<orig@mail.example>',
    text: 'Can you do it Thursday?\nThanks',
    messageId: '<walk-1@clickplumbing.example>',
    at: '2026-10-22T14:05:00.000Z',
  }

  it('is RFC 2822 with CRLF lines, in the estimate email’s thread', () => {
    const raw = replyMessage(mail)
    expect(raw.split('\r\n')).toEqual([
      'From: bids@clickplumbing.example',
      'To: team@clickplumbing.example',
      'Subject: Re: Estimate #212 — Walk — $1.00 · Click',
      'Date: Thu, 22 Oct 2026 14:05:00 GMT',
      'Message-ID: <walk-1@clickplumbing.example>',
      'In-Reply-To: <orig@mail.example>',
      'References: <orig@mail.example>',
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 8bit',
      '',
      'Can you do it Thursday?',
      'Thanks',
    ])
    expect(replyMessage({ ...mail, inReplyTo: null })).not.toContain('In-Reply-To')
    expect(replyMessage({ ...mail, subject: 'a\r\nBcc: x' })).toContain('Subject: a Bcc: x')
  })

  it('is base64url with no padding, and reads back', () => {
    const raw = replyRaw(mail)
    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/)
    const back = Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    expect(back).toBe(replyMessage(mail))
    expect(base64Url(new Uint8Array([0xff, 0xfe, 0xfd]))).toBe('__79')
  })

  it('makes a Message-ID in the sender’s domain', () => {
    expect(replyMessageId('bids@clickplumbing.example', 1_700_000_000_000, 'ab-cd-ef-0123456789')).toBe(`<walk-${(1_700_000_000_000).toString(36)}-abcdef012345@clickplumbing.example>`)
    expect(replyMessageId('nobody', 1, 'x')).toBe('<walk-1-x@walk.pipetooling.local>')
  })
})

describe('the seed line', () => {
  it('is one delivered out text on the kit’s phone channel, three days old, from the team box', () => {
    const now = Date.parse('2026-10-22T14:00:00.000Z')
    expect(seedOldColumns(KIT, now, 'm-seed')).toEqual({
      id: 'm-seed',
      quo_id: 'walk-seed-m-seed',
      contact_id: 'c-walk',
      channel_id: 'ch-walk-phone',
      channel: 'text',
      direction: 'out',
      who_user_id: null,
      who_text: 'ZZ walk seed',
      at: '2026-10-19T14:00:00.000Z',
      body: 'ZZ walk seed: an older text of ours, so Waiting on them has a row to show.',
      delivery: 'delivered',
      mailbox: 'team',
    })
    expect(seedOldColumns({ ...KIT, phoneChannelId: null }, now, 'm')).toBeNull()
  })
})

describe('leakedSecret', () => {
  const env = { SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-value', DEV_LOGIN_SECRET: 'dev-login-secret', QUO_API_KEY: 'quo_live_abcdef', PORT: '9', FLAG: 'on' }

  it('names the first secret an answer carries, whole or inside a string, and nothing short', () => {
    expect(leakedSecret({ ok: true, kit: { email: 'bids@x' } }, env)).toBeNull()
    expect(leakedSecret({ ok: true, key: 'quo_live_abcdef' }, env)).toBe('QUO_API_KEY')
    expect(leakedSecret({ words: 'sent with dev-login-secret in the header' }, env)).toBe('DEV_LOGIN_SECRET')
    expect(leakedSecret({ n: 9, flag: 'on' }, env)).toBeNull()
    expect(leakedSecret(null, env)).toBeNull()
  })
})
