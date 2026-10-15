import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { CALL_SCRIPT_BLANK, CALL_SCRIPT_HREF, CALL_SCRIPT_SUB, CALL_SCRIPT_THEN, callScript, callScriptText, callerFirstName } from './callScript'

const joined = (parts: ReturnType<typeof callScript>) => parts.map((p) => p.lines.map((l) => l.map((s) => s.text).join('')))

describe('the call script', () => {
  it('reads the four parts in the owner’s words, the caller’s name set in twice and marked', () => {
    const parts = callScript('Robert', 'Click Plumbing & Electrical')
    expect(parts.map((p) => [p.id, p.title])).toEqual([
      ['intro', 'Intro'],
      ['contact', 'Point of contact'],
      ['info', 'Collecting info'],
      ['closing', 'Closing'],
    ])
    const [intro, contact, info, closing] = joined(parts)
    expect(intro?.[0]).toBe(
      'Hi, my name is Robert, and I’m calling from Click Plumbing & Electrical. We’re looking to connect with local subcontractors in the area to discuss bidding jobs with us. I was hoping you could point me in the right direction. Who would be the best person to speak with regarding estimating, bidding or new project opportunities?',
    )
    expect(contact?.[0]).toBe(
      'Hi, my name is Robert, and I’m with Click Plumbing & Electrical. We bid a lot of jobs and are looking for local trade partners for upcoming projects. If you’re willing to bid some of our work we can send over opportunities that are outside ours but inside your scope of services. With your help we could complete more projects. Would you be the right person to contact regarding bids and estimating for your company?',
    )
    expect(info?.[0]).toBe('I’d like to get your contact information so our team can reach out to you directly when we have projects available for bidding.')
    expect(parts[2]?.asks).toEqual([
      'Could I get your name and the title your company knows you by?',
      'What’s the best phone number to reach you?',
      'What’s the best email address to send bid invitations, plans and project information?',
      'What is your office address and how far are you willing to travel?',
    ])
    expect(closing?.[0]).toBe(
      'Thank you! It’s good to connect with other companies in the area. I’ll add your information to our subcontractor contact list so we can reach out when we have work that matches your scope. We look forward to the possibility of working together.',
    )
    // The name is one marked segment in each of the two greetings, and nowhere else.
    expect(parts.map((p) => p.lines.flat().filter((s) => s.name).map((s) => s.text))).toEqual([['Robert'], ['Robert'], [], []])
  })

  it('leaves the owner’s blank where the app has no name for the caller, and names the letterhead’s company by default', () => {
    const parts = callScript(null)
    expect(joined(parts)[0]?.[0]?.startsWith(`Hi, my name is ${CALL_SCRIPT_BLANK}, and I’m calling from Click Plumbing and Electrical.`)).toBe(true)
  })

  it('takes the first name from the display name', () => {
    expect(callerFirstName('Robert Douglas')).toBe('Robert')
    expect(callerFirstName('  Taunya ')).toBe('Taunya')
    expect(callerFirstName('')).toBeNull()
    expect(callerFirstName(null)).toBeNull()
    expect(callerFirstName(undefined)).toBeNull()
  })

  it('copies as plain text: a heading a part, the asks as a list', () => {
    const text = callScriptText(callScript('Robert', 'Click Plumbing & Electrical'))
    expect(text.startsWith('Intro\nHi, my name is Robert, and I’m calling from Click Plumbing & Electrical.')).toBe(true)
    expect(text).toContain('\n\nCollecting info\nI’d like to get your contact information')
    expect(text).toContain('\n- Could I get your name and the title your company knows you by?\n- What’s the best phone number to reach you?')
    expect(text.endsWith('We look forward to the possibility of working together.')).toBe(true)
  })

  it('keeps the app’s own sentences plain, and opens the new tab on Trade partners with the script', () => {
    for (const s of [CALL_SCRIPT_SUB, CALL_SCRIPT_THEN]) expect(plainWordsFailures(s)).toEqual([])
    expect(CALL_SCRIPT_HREF).toBe('/gc?view=partners&script=1')
  })
})
