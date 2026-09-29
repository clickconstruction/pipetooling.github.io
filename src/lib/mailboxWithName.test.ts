import { describe, expect, it } from 'vitest'
import {
  mailboxAddress,
  mailboxDisplayName,
  mailboxWithName,
} from '../../supabase/functions/_shared/mailboxWithName'

describe('mailboxAddress', () => {
  it('takes the address out of Name <addr>', () => {
    expect(mailboxAddress('ClickTooling <team@noreply.clicktooling.com>')).toBe('team@noreply.clicktooling.com')
  })
  it('returns a bare address as is', () => {
    expect(mailboxAddress('team@noreply.clicktooling.com')).toBe('team@noreply.clicktooling.com')
    expect(mailboxAddress('  team@noreply.clicktooling.com ')).toBe('team@noreply.clicktooling.com')
  })
  it('trims inside the angle brackets', () => {
    expect(mailboxAddress('X < team@x.com >')).toBe('team@x.com')
  })
})

describe('mailboxDisplayName', () => {
  it('leaves a plain name bare', () => {
    expect(mailboxDisplayName('Click Plumbing and Electrical')).toBe('Click Plumbing and Electrical')
    expect(mailboxDisplayName("Click Plumbing & Electrical")).toBe("Click Plumbing & Electrical")
  })
  it('quotes a name with a comma, a period or a colon', () => {
    expect(mailboxDisplayName('Click Plumbing, LLC')).toBe('"Click Plumbing, LLC"')
    expect(mailboxDisplayName('Click Plumbing Inc.')).toBe('"Click Plumbing Inc."')
    expect(mailboxDisplayName('Billing: Click')).toBe('"Billing: Click"')
  })
  it('escapes quotes and backslashes inside a quoted name', () => {
    expect(mailboxDisplayName('Click "Plumbing"')).toBe('"Click \\"Plumbing\\""')
    expect(mailboxDisplayName('Click \\ Co')).toBe('"Click \\\\ Co"')
  })
  it('trims', () => {
    expect(mailboxDisplayName('  Click  ')).toBe('Click')
  })
})

describe('mailboxWithName', () => {
  it('puts the company name on EMAIL_FROM’s address', () => {
    expect(mailboxWithName('Click Plumbing and Electrical', 'ClickTooling <team@noreply.clicktooling.com>')).toBe(
      'Click Plumbing and Electrical <team@noreply.clicktooling.com>',
    )
  })
  it('works on a bare address', () => {
    expect(mailboxWithName('Click Plumbing', 'team@noreply.clicktooling.com')).toBe('Click Plumbing <team@noreply.clicktooling.com>')
  })
  it('quotes a name that needs it', () => {
    expect(mailboxWithName('Click Plumbing, LLC', 'ClickTooling <team@x.com>')).toBe('"Click Plumbing, LLC" <team@x.com>')
  })
  it('keeps the mailbox as given when the name is empty', () => {
    expect(mailboxWithName('', 'ClickTooling <team@x.com>')).toBe('ClickTooling <team@x.com>')
    expect(mailboxWithName('   ', 'ClickTooling <team@x.com>')).toBe('ClickTooling <team@x.com>')
  })
  it('matches what the estimate and contract senders built inline before it', () => {
    const EMAIL_FROM = 'ClickTooling <team@noreply.clicktooling.com>'
    const fromAddress = /<([^>]+)>/.exec(EMAIL_FROM)?.[1]?.trim() ?? EMAIL_FROM
    expect(mailboxWithName('Click Electrical', EMAIL_FROM)).toBe(`Click Electrical <${fromAddress}>`)
  })
})
