import { describe, expect, it } from 'vitest'
import {
  bodyContactPieces,
  bodyContactPoints,
  canTextPoint,
  contactPieces,
  contactPressBody,
  contactPressOf,
  mapHref,
  pressSourceWords,
  PRESS_WORDS_UI,
} from './bodyContacts'
import { plainWordsFailures } from '../plainWords'

/** Glenn Gelwin's signature as the bids@ reader kept it (2026-10-22), the tracking links and all. */
const SIGNATURE = `Thank you, and we look forward to reviewing your proposal.
[image: signoff-logo]
[image: headshot]
Glenn Gelwin
Estimator I
Marrex Builders
[image: phone] (832) 871-4166 ext. 121
[image: email] glenn@marrexbuilders.example <https://server.utags.co/gLCOFBOU>
[image: website] www.maxxbuilders.com/ <https://server.utags.co/ejwGNauh>
[image: company-address] 4150 Bluebonnet Dr. Suite 102 Stafford, TX, 77477
[image: company-logo]
[image: instagram] <https://server.utags.co/yhmOAqla> [image: linkedin]
<https://server.utags.co/yXRIBtGM> [image: twitter]
<https://server.utags.co/UNFMfyhT> [image: facebook]
<https://server.utags.co/RzYdTDrS> [image: youtube]
<https://server.utags.co/KWMzBoCh>`

const BODY = `Wendi,

We at *Marrex Builders* are currently working on a project called *Northeast
Bible Church Elementary Building* located at *19185 FM 2252 Northeast Bible
Church, Garden Ridge, TX 78266*

Link to Plans*:
**https://maxxbuilders.box.com/s/vzgc9sp8fwsrcni1c7d8j0qh3995pqi3
<https://maxxbuilders.box.com/s/vzgc9sp8fwsrcni1c7d8j0qh3995pqi3>*
Deadline: *Monday, November 02, 2026, 3:00 PM*
`

describe('bodyContacts: the contact points in an email’s words (v2.6513)', () => {
  it('reads the signature: the number with its extension, the address, the street address, and nothing else', () => {
    expect(bodyContactPoints(SIGNATURE)).toEqual([
      { kind: 'phone', number: '(832) 871-4166', ext: '121', words: '(832) 871-4166 ext. 121' },
      { kind: 'email', address: 'glenn@marrexbuilders.example', words: 'glenn@marrexbuilders.example' },
      { kind: 'address', words: '4150 Bluebonnet Dr. Suite 102 Stafford, TX, 77477' },
    ])
  })

  it('leaves the tracking links as links, never as contact points, and hides the markers on the lines that hold a press', () => {
    const pieces = bodyContactPieces(SIGNATURE)
    const links = pieces.filter((p) => p.kind === 'link').map((p) => (p.kind === 'link' ? p.href : ''))
    expect(links).toEqual([
      'https://server.utags.co/gLCOFBOU',
      'https://server.utags.co/ejwGNauh',
      'https://server.utags.co/yhmOAqla',
      'https://server.utags.co/yXRIBtGM',
      'https://server.utags.co/UNFMfyhT',
      'https://server.utags.co/RzYdTDrS',
      'https://server.utags.co/KWMzBoCh',
    ])
    const text = pieces.map((p) => (p.kind === 'text' ? p.text : p.kind === 'link' ? `<${p.href}>` : `[${p.point.kind}]`)).join('')
    // The phone, email, website, address and social markers are gone; the signoff, headshot and logo markers stay.
    expect(text).not.toContain('[image: phone]')
    expect(text).not.toContain('[image: email]')
    expect(text).not.toContain('[image: website]')
    expect(text).not.toContain('[image: company-address]')
    expect(text).not.toContain('[image: instagram]')
    expect(text).not.toContain('[image: linkedin]')
    expect(text).toContain('[image: signoff-logo]')
    expect(text).toContain('[image: company-logo]')
    expect(text).toContain('\n[phone]\n[email] <https://server.utags.co/gLCOFBOU>\nwww.maxxbuilders.com/ <https://server.utags.co/ejwGNauh>\n[address]\n[image: company-logo]\n<https://server.utags.co/yhmOAqla> \n<https://server.utags.co/yXRIBtGM> \n')
    expect(text).not.toContain('[image: twitter]')
    // The web address with no scheme stays words: www. alone is not a link.
    expect(pieces.some((p) => p.kind === 'contact' && p.point.kind === 'address' && p.point.words.includes('www'))).toBe(false)
  })

  it('finds the project’s street address in the body, inside the sender’s bold marks', () => {
    expect(bodyContactPoints(BODY)).toEqual([{ kind: 'address', words: '19185 FM 2252 Northeast Bible Church, Garden Ridge, TX 78266' }])
  })

  it('keeps the body’s own words in order around the points, newlines and all', () => {
    const pieces = bodyContactPieces('Call me at 512-555-0142 or write to ana@ridgeway.example.\nThanks')
    expect(pieces).toEqual([
      { kind: 'text', text: 'Call me at ', bold: false },
      { kind: 'contact', point: { kind: 'phone', number: '512-555-0142', ext: null, words: '512-555-0142' }, bold: false },
      { kind: 'text', text: ' or write to ', bold: false },
      { kind: 'contact', point: { kind: 'email', address: 'ana@ridgeway.example', words: 'ana@ridgeway.example' }, bold: false },
      { kind: 'text', text: '.\nThanks', bold: false },
    ])
  })

  it('reads a number with the country’s 1, a dotted one, and x for the extension; never a ZIP or a date', () => {
    expect(bodyContactPoints('+1 (210) 555-0113 and 830.555.0172 x44').map((p) => (p.kind === 'phone' ? [p.number, p.ext] : null))).toEqual([
      ['+1 (210) 555-0113', null],
      ['830.555.0172', '44'],
    ])
    expect(bodyContactPoints('Deadline: Monday, November 02, 2026, 3:00 PM. ZIP 78266-1234. Invoice 1312.')).toEqual([])
  })

  it('reads the same point once, and a marker on a line with nothing pressable stays as it came', () => {
    expect(bodyContactPoints('glenn@marrexbuilders.example, again glenn@marrexbuilders.example')).toHaveLength(1)
    const pieces = bodyContactPieces('[image: headshot]\nGlenn')
    expect(pieces).toEqual([{ kind: 'text', text: '[image: headshot]\nGlenn', bold: false }])
  })

  it('a bold text piece keeps its bold on the points cut from it', () => {
    const pieces = contactPieces([
      { kind: 'text', text: 'Reach ', bold: false },
      { kind: 'text', text: 'ana@ridgeway.example', bold: true },
      { kind: 'link', href: 'https://ridgeway.example', bold: false },
    ])
    expect(pieces).toEqual([
      { kind: 'text', text: 'Reach ', bold: false },
      { kind: 'contact', point: { kind: 'email', address: 'ana@ridgeway.example', words: 'ana@ridgeway.example' }, bold: true },
      { kind: 'link', href: 'https://ridgeway.example', bold: false },
    ])
  })

  it('a ten-digit number can take a text; one with an extension or from abroad cannot', () => {
    expect(canTextPoint({ kind: 'phone', number: '(832) 871-4166', ext: null, words: '(832) 871-4166' })).toBe(true)
    expect(canTextPoint({ kind: 'phone', number: '(832) 871-4166', ext: '121', words: '(832) 871-4166 ext. 121' })).toBe(false)
    expect(canTextPoint({ kind: 'phone', number: '+44 20 7946 0958', ext: null, words: '+44 20 7946 0958' })).toBe(false)
    expect(canTextPoint({ kind: 'email', address: 'a@b.co', words: 'a@b.co' })).toBe(false)
  })

  it('the map opens the same search the customer window does', () => {
    expect(mapHref('4150 Bluebonnet Dr. Suite 102 Stafford, TX, 77477')).toBe('https://www.google.com/maps/search/?api=1&query=4150%20Bluebonnet%20Dr.%20Suite%20102%20Stafford%2C%20TX%2C%2077477')
  })
})

describe('bodyContacts: the line a press leaves on the thread', () => {
  const glenn = { first: 'Glenn', channel: 'email', dayWords: 'Oct 22', ours: false }

  it('writes the press in plain words and reads it back', () => {
    const call = contactPressBody('Grace', 'call', '(832) 871-4166 ext. 121', glenn)
    expect(call).toBe("Grace pressed Call on (832) 871-4166 ext. 121 from Glenn's email of Oct 22.")
    expect(contactPressOf(call)).toEqual({ who: 'Grace', press: 'call', value: '(832) 871-4166 ext. 121' })
    const thread = contactPressBody('Grace', 'thread', 'glenn@marrexbuilders.example', glenn)
    expect(thread).toBe("Grace opened a thread for glenn@marrexbuilders.example from Glenn's email of Oct 22.")
    expect(contactPressOf(thread)).toEqual({ who: 'Grace', press: 'thread', value: 'glenn@marrexbuilders.example' })
    expect(contactPressOf(contactPressBody('Grace', 'map', '4150 Bluebonnet Dr. Suite 102 Stafford, TX, 77477', glenn))).toEqual({
      who: 'Grace',
      press: 'map',
      value: '4150 Bluebonnet Dr. Suite 102 Stafford, TX, 77477',
    })
    expect(contactPressOf(contactPressBody('Grace', 'email', 'glenn@marrexbuilders.example', glenn))?.press).toBe('email')
    expect(contactPressOf(contactPressBody('Grace', 'text', '512-555-0142', glenn))?.press).toBe('text')
    expect(contactPressOf('Robert took Greg Paulk.')).toBeNull()
    expect(contactPressOf('Robert heard back by phone on Nov 4.')).toBeNull()
  })

  it('names where the press was made: their email, our email, a note', () => {
    expect(pressSourceWords(glenn)).toBe("Glenn's email of Oct 22")
    expect(pressSourceWords({ first: 'Glenn', channel: 'text', dayWords: 'Oct 22', ours: false })).toBe("Glenn's text of Oct 22")
    expect(pressSourceWords({ first: null, channel: 'email', dayWords: 'Oct 22', ours: true })).toBe('our email of Oct 22')
    expect(pressSourceWords({ first: null, channel: 'note', dayWords: 'Nov 4', ours: true })).toBe('a note of Nov 4')
    expect(contactPressBody('', 'call', '512-555-0142', glenn)).toMatch(/^Someone pressed Call/)
  })

  it('every word a person reads passes the plain-words rules', () => {
    for (const words of [
      contactPressBody('Grace', 'call', '(832) 871-4166 ext. 121', glenn),
      contactPressBody('Grace', 'thread', 'glenn@marrexbuilders.example', glenn),
      PRESS_WORDS_UI.toast('call', '(832) 871-4166 ext. 121'),
      PRESS_WORDS_UI.toast('thread', 'glenn@marrexbuilders.example'),
      PRESS_WORDS_UI.toast('map', '4150 Bluebonnet Dr. Suite 102 Stafford, TX, 77477'),
      PRESS_WORDS_UI.undone,
      ...Object.values(PRESS_WORDS_UI.tips),
    ]) {
      expect(plainWordsFailures(words.replace(/\(\d{3}\) /g, ''))).toEqual([])
    }
  })
})
