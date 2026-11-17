import { describe, expect, it } from 'vitest'
import { formatDateTime, formatInteractionType, formatTimerButtonName, formatTimerSeconds, formatWebsiteDisplay, getWebsiteHref } from './prospectFormat'

describe('formatDateTime', () => {
  it('a missing time is a dash', () => {
    expect(formatDateTime(null)).toBe('—')
    expect(formatDateTime('')).toBe('—')
  })

  it('writes a moment short, the day then the time, in US order', () => {
    const iso = '2026-10-01T15:04:00.000Z'
    // The reader's own zone decides the hour, so the test reads the parts in that zone too.
    const d = new Date(iso)
    const hour12 = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12
    const out = formatDateTime(iso)
    expect(out).toContain(`${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`)
    expect(out).toContain(`${hour12}:04`)
    expect(out).toMatch(/(AM|PM)$/)
  })
})

describe('formatInteractionType', () => {
  it('names the five kinds a comment can be', () => {
    expect(formatInteractionType('answered')).toBe('Answered')
    expect(formatInteractionType('didnt_answer')).toBe("Didn't answer")
    expect(formatInteractionType('no_longer_fit')).toBe('No longer a fit')
    expect(formatInteractionType('user_comment')).toBe('Comment')
    expect(formatInteractionType('converted')).toBe('Converted')
  })
  it('an unknown kind reads as itself', () => {
    expect(formatInteractionType('something_new')).toBe('something_new')
  })
})

describe('formatTimerButtonName', () => {
  it('names the four presses that write a timer event', () => {
    expect(formatTimerButtonName('no_longer_fit')).toBe('No Longer a Fit')
    expect(formatTimerButtonName('next_prospect')).toBe('Next Prospect')
    expect(formatTimerButtonName('cant_reach')).toBe("Can't reach")
    expect(formatTimerButtonName('converted')).toBe('Converted')
  })
  it('an unknown press reads as itself', () => {
    expect(formatTimerButtonName('something_new')).toBe('something_new')
  })
})

describe('formatTimerSeconds', () => {
  it('pads minutes and seconds to two digits', () => {
    expect(formatTimerSeconds(0)).toBe('00:00')
    expect(formatTimerSeconds(5)).toBe('00:05')
    expect(formatTimerSeconds(65)).toBe('01:05')
    expect(formatTimerSeconds(600)).toBe('10:00')
  })
  it('keeps counting minutes past an hour', () => {
    expect(formatTimerSeconds(3600)).toBe('60:00')
    expect(formatTimerSeconds(7325)).toBe('122:05')
  })
})

describe('formatWebsiteDisplay', () => {
  it('drops the scheme, the www and the trailing slashes', () => {
    expect(formatWebsiteDisplay('https://www.example.test/')).toBe('example.test')
    expect(formatWebsiteDisplay('HTTP://WWW.example.test//')).toBe('example.test')
    expect(formatWebsiteDisplay('  example.test/about  ')).toBe('example.test/about')
  })
  it('an empty website is a dash', () => {
    expect(formatWebsiteDisplay(null)).toBe('—')
    expect(formatWebsiteDisplay('   ')).toBe('—')
    expect(formatWebsiteDisplay('https://')).toBe('—')
  })
})

describe('getWebsiteHref', () => {
  it('keeps a website that names its scheme', () => {
    expect(getWebsiteHref('http://example.test')).toBe('http://example.test')
    expect(getWebsiteHref(' HTTPS://example.test ')).toBe('HTTPS://example.test')
  })
  it('puts https in front of a bare one', () => {
    expect(getWebsiteHref('www.example.test')).toBe('https://www.example.test')
  })
  it('an empty website links nowhere', () => {
    expect(getWebsiteHref(null)).toBe('#')
    expect(getWebsiteHref('  ')).toBe('#')
  })
})
