// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { __forgetTypedTextForTests, isSearchField, noteTypedInto, pageHoldsTypedText, watchTypedText } from './typedText'

/** Puts markup on the page and hands back the element with `id`. */
function put<T extends Element>(html: string, id = 'f'): T {
  document.body.innerHTML = html
  return document.getElementById(id) as unknown as T
}
/** What a person's typing does: the value changes and the field says so. */
function type(el: HTMLInputElement | HTMLTextAreaElement, words: string) {
  el.value = words
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('pageHoldsTypedText', () => {
  let stop = () => {}
  beforeEach(() => {
    __forgetTypedTextForTests()
    document.body.innerHTML = ''
    stop = watchTypedText()
  })
  afterEach(() => stop())

  it('an empty page holds nothing', () => {
    expect(pageHoldsTypedText()).toBe(false)
  })

  it('a message typed into a textarea holds, with the cursor somewhere else', () => {
    const box = put<HTMLTextAreaElement>('<textarea id="f"></textarea><button id="b">x</button>')
    type(box, 'We will be there Tuesday at 8.')
    document.getElementById('b')?.focus()
    expect(document.activeElement).not.toBe(box)
    expect(pageHoldsTypedText()).toBe(true)
  })

  it('it holds until the words are cleared', () => {
    const box = put<HTMLTextAreaElement>('<textarea id="f"></textarea>')
    type(box, 'Report: rough-in passed.')
    expect(pageHoldsTypedText()).toBe(true)
    type(box, '')
    expect(pageHoldsTypedText()).toBe(false)
  })

  it('it holds until the words are sent and their box leaves the page', () => {
    const box = put<HTMLTextAreaElement>('<div id="w"><textarea id="f"></textarea></div>')
    type(box, 'On my way.')
    expect(pageHoldsTypedText()).toBe(true)
    document.getElementById('w')?.remove()
    expect(pageHoldsTypedText()).toBe(false)
  })

  it('a textarea with words holds whoever put them there: a draft the app brought back is still a draft', () => {
    put('<textarea id="f">Kept from yesterday</textarea>')
    expect(pageHoldsTypedText()).toBe(true)
  })

  it('spaces alone are not words', () => {
    const box = put<HTMLTextAreaElement>('<textarea id="f"></textarea>')
    type(box, '   \n ')
    expect(pageHoldsTypedText()).toBe(false)
  })

  it('words in a box edited in place hold', () => {
    put('<div id="f" contenteditable="true">Dear Ms. Ortiz,</div>')
    expect(pageHoldsTypedText()).toBe(true)
    put('<div id="f" contenteditable="true"></div>')
    expect(pageHoldsTypedText()).toBe(false)
  })

  it('a one-line field holds once the person typed into it', () => {
    const field = put<HTMLInputElement>('<input id="f" type="text" />')
    type(field, 'Change order for the east wall')
    expect(pageHoldsTypedText()).toBe(true)
  })

  it('a one-line field the app filled does not hold: a reload brings it back', () => {
    put('<input id="f" type="text" value="4200.00" />')
    expect(pageHoldsTypedText()).toBe(false)
  })

  it('a field with no type counts as text', () => {
    const field = put<HTMLInputElement>('<input id="f" />')
    type(field, 'Suite 210')
    expect(pageHoldsTypedText()).toBe(true)
  })

  it('a search box is not a draft, by its type, its role or its name', () => {
    for (const html of [
      '<input id="f" type="search" />',
      '<input id="f" role="searchbox" />',
      '<input id="f" type="text" placeholder="Search HCP, name, address" />',
      '<input id="f" type="text" aria-label="Find a job" />',
      '<input id="f" type="text" placeholder="Filter by name" />',
    ]) {
      const field = put<HTMLInputElement>(html)
      expect(isSearchField(field)).toBe(true)
      type(field, 'gun dog')
      expect(pageHoldsTypedText()).toBe(false)
    }
  })

  it('a date picked, a box ticked and a file chosen are not typed words', () => {
    for (const kind of ['date', 'checkbox', 'radio', 'file', 'range', 'color']) {
      const field = put<HTMLInputElement>(`<input id="f" type="${kind}" />`)
      noteTypedInto(field)
      expect(pageHoldsTypedText()).toBe(false)
    }
  })

  it('a box that cannot be typed into does not hold', () => {
    put('<textarea id="f" readonly>https://example.com/pay/123</textarea>')
    expect(pageHoldsTypedText()).toBe(false)
    put('<textarea id="f" disabled>Sent 11/24</textarea>')
    expect(pageHoldsTypedText()).toBe(false)
  })

  it('typing is seen in a field that stops its own events', () => {
    const field = put<HTMLInputElement>('<input id="f" type="text" />')
    field.addEventListener('input', (e) => e.stopPropagation())
    type(field, 'Gate code 4411')
    expect(pageHoldsTypedText()).toBe(true)
  })

  it('with no page there is nothing to hold', () => {
    expect(pageHoldsTypedText(undefined)).toBe(false)
    expect(watchTypedText(undefined)).toBeTypeOf('function')
  })

  it('a page it cannot read counts as holding words', () => {
    const broken = { querySelectorAll: () => { throw new Error('no') } } as unknown as Document
    expect(pageHoldsTypedText(broken)).toBe(true)
  })
})
