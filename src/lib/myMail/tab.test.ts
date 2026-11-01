import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gmailThreadHref, MESSAGES_TABS, MY_MAIL_GUIDE, MY_MAIL_GUIDE_READS, MY_MAIL_SETTINGS_HREF, MY_MAIL_TAB, MY_MAIL_VIEWS, tabOf, viewOf, withTab, withView } from './tab'

const at = (search: string) => new URLSearchParams(search)

describe('the tab in the URL', () => {
  it('reads My email for ?tab=my-email alone, and Follow up for anything else', () => {
    expect(MY_MAIL_TAB).toBe('my-email')
    expect(tabOf(at('?tab=my-email'))).toBe('myMail')
    expect(tabOf(at('?tab= my-email '))).toBe('myMail')
    expect(tabOf(at(''))).toBe('followUp')
    expect(tabOf(at('?tab=inbox'))).toBe('followUp')
    expect(tabOf(at('?kind=customer'))).toBe('followUp')
    expect(MESSAGES_TABS.map((t) => t.label)).toEqual(['Follow up', 'My email'])
  })

  it('opens My email clean: Follow up’s words go, the pill and an open thread stay', () => {
    expect(withTab(at('?kind=customer&q=pond&thread=c-1&at=m-1'), 'myMail').toString()).toBe('kind=customer&thread=c-1&at=m-1&tab=my-email')
  })

  it('goes back to Follow up by taking the param away, with the tab’s view and words', () => {
    expect(withTab(at('?tab=my-email&view=tagged&q=Ridgeway&kind=trade'), 'followUp').toString()).toBe('kind=trade')
  })

  it('changes nothing on a press of the open tab', () => {
    expect(withTab(at('?tab=my-email&view=all&q=Dale'), 'myMail').toString()).toBe('tab=my-email&view=all&q=Dale')
    expect(withTab(at('?q=pond'), 'followUp').toString()).toBe('q=pond')
  })
})

describe('the view in the URL', () => {
  it('reads each view, To tag when none is asked or the ask is not a view', () => {
    expect(viewOf(at('?view=tagged'))).toBe('tagged')
    expect(viewOf(at('?view=all'))).toBe('all')
    expect(viewOf(at('?view=to-tag'))).toBe('toTag')
    expect(viewOf(at(''))).toBe('toTag')
    expect(viewOf(at('?view=constructor'))).toBe('toTag')
    expect(MY_MAIL_VIEWS).toEqual(['toTag', 'tagged', 'all'])
  })

  it('writes the view, To tag taking the param away, every other param kept', () => {
    expect(withView(at('?tab=my-email&q=Dale'), 'tagged').toString()).toBe('tab=my-email&q=Dale&view=tagged')
    expect(withView(at('?tab=my-email&view=all'), 'toTag').toString()).toBe('tab=my-email')
  })
})

describe('the doors the tab names', () => {
  it('opens a conversation in Gmail as the person’s own address', () => {
    expect(gmailThreadHref('marisol@clickplumbing.example', '18c2f3a9')).toBe('https://mail.google.com/mail/?authuser=marisol%40clickplumbing.example#all/18c2f3a9')
    expect(gmailThreadHref(' dale+bids@ridgeway.example ', 't1')).toBe('https://mail.google.com/mail/?authuser=dale%2Bbids%40ridgeway.example#all/t1')
    expect(gmailThreadHref(' ', 't1')).toBe('https://mail.google.com/mail/#all/t1')
  })

  it('lands on the card on Your account, and names a guide that is there', () => {
    expect(MY_MAIL_SETTINGS_HREF).toBe('/settings?tab=settings-account#settings-my-mail')
    const guide = join(__dirname, '../../content/help', `${MY_MAIL_GUIDE}.md`)
    expect(existsSync(guide)).toBe(true)
    expect(readFileSync(guide, 'utf8')).toContain(`\n## ${MY_MAIL_GUIDE_READS}\n`)
  })
})
