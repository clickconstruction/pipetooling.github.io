// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { LOOK_CANT_TITLE, LOOK_LINE_LEAD, lookAllowsPress, lookCantLines, lookFirstName, lookIsField, lookKeyPresses, lookLine, lookPressLabel, lookPressTitle, lookReadAtWords, lookWindowTitle } from './taskLook'

describe('the words of a look', () => {
  it('names the person by their first name on the press', () => {
    expect(lookPressLabel('Dana Whitlow')).toBe('See Dana’s Task Mode')
    expect(lookPressLabel('  Marco  ')).toBe('See Marco’s Task Mode')
  })

  it('reads them for a person with no name', () => {
    expect(lookFirstName('')).toBe('them')
    expect(lookFirstName(null)).toBe('them')
    expect(lookWindowTitle('')).toBe('Their Task Mode')
  })

  it('heads the window with the whole name', () => {
    expect(lookWindowTitle('Dana Whitlow')).toBe('Dana Whitlow’s Task Mode')
  })

  it('says when the day was read', () => {
    expect(lookReadAtWords(new Date(2026, 10, 17, 14, 41))).toBe('Read at 2:41 PM')
  })

  it('every line is plain words', () => {
    const lines = [LOOK_LINE_LEAD, lookLine('Dana Whitlow'), lookPressTitle('Dana Whitlow'), LOOK_CANT_TITLE, ...lookCantLines('Dana Whitlow')]
    for (const s of lines) expect(plainWordsFailures(s)).toEqual([])
  })
})

/** A look's box with one of everything Today draws in it. */
function box(html: string): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = html
  document.body.appendChild(root)
  return root
}
const at = (root: Element, sel: string) => root.querySelector(sel)

describe('lookAllowsPress', () => {
  it('lets a press that only opens or folds go through', () => {
    const root = box('<button id="fold" aria-expanded="false">Show 6 more</button><div role="button" id="title" aria-expanded="true"><span id="in">Restock the van</span></div>')
    expect(lookAllowsPress(at(root, '#fold'), root)).toBe(true)
    expect(lookAllowsPress(at(root, '#title'), root)).toBe(true)
    expect(lookAllowsPress(at(root, '#in'), root)).toBe(true)
  })

  it('stops every press that acts', () => {
    const root = box('<button id="done">Mark done</button><button id="more" aria-haspopup="dialog">More</button><button id="menu" aria-haspopup="menu" aria-expanded="false">Menu</button><div id="plain">a row with a press of its own</div>')
    expect(lookAllowsPress(at(root, '#done'), root)).toBe(false)
    expect(lookAllowsPress(at(root, '#more'), root)).toBe(false)
    expect(lookAllowsPress(at(root, '#menu'), root)).toBe(false)
    expect(lookAllowsPress(at(root, '#plain'), root)).toBe(false)
  })

  it('stops an act that sits inside a head that opens', () => {
    const root = box('<div role="button" aria-expanded="false"><span>Dana</span><button id="remind">Remind</button></div>')
    expect(lookAllowsPress(at(root, '#remind'), root)).toBe(false)
  })

  it('stops every box a person can type in, tick or pick from', () => {
    const root = box('<input id="tick" type="checkbox"><textarea id="note"></textarea><select id="pick"></select><label id="lab"><input type="checkbox">Bins filled</label><input id="odd" aria-expanded="true">')
    for (const sel of ['#tick', '#note', '#pick', '#lab', '#odd']) expect(lookAllowsPress(at(root, sel), root)).toBe(false)
  })

  it('lets a link through only when it opens a new tab', () => {
    const root = box('<a id="out" href="https://example.com" target="_blank">the spec sheet</a><a id="stay" href="/roadmap">the roadmap</a><a id="act">an act</a>')
    expect(lookAllowsPress(at(root, '#out'), root)).toBe(true)
    expect(lookAllowsPress(at(root, '#stay'), root)).toBe(false)
    expect(lookAllowsPress(at(root, '#act'), root)).toBe(false)
  })

  it('stops a press outside the look, such as a sheet drawn elsewhere on the page', () => {
    const root = box('<button aria-expanded="false">inside</button>')
    const outside = box('<button id="sheet" aria-expanded="false">outside</button>')
    expect(lookAllowsPress(at(outside, '#sheet'), root)).toBe(false)
    expect(lookAllowsPress(null, root)).toBe(false)
  })
})

describe('keys and fields', () => {
  it('counts Enter and Space as a press and leaves the keys that move', () => {
    expect(lookKeyPresses('Enter')).toBe(true)
    expect(lookKeyPresses(' ')).toBe(true)
    expect(lookKeyPresses('Tab')).toBe(false)
    expect(lookKeyPresses('ArrowDown')).toBe(false)
    expect(lookKeyPresses('Escape')).toBe(false)
  })

  it('knows a field from a press', () => {
    const root = box('<textarea id="note"></textarea><button id="b">Photo</button>')
    expect(lookIsField(at(root, '#note'))).toBe(true)
    expect(lookIsField(at(root, '#b'))).toBe(false)
    expect(lookIsField(null)).toBe(false)
  })
})
