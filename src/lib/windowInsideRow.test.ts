// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ignoreWindowsInside, startedInWindowInside } from './windowInsideRow'

/**
 * A row holding its own content, a window (fixed backdrop → panel → input) and a sticky cell;
 * `portaled` stands for a window React drew elsewhere in the DOM (createPortal to body).
 */
function draw() {
  document.body.innerHTML = `
    <div id="row">
      <span id="title">Galloway Park</span>
      <span id="sticky" style="position: sticky; left: 0"><b id="sticky-text">B385</b></span>
      <div id="backdrop" style="position: fixed; inset: 0">
        <div id="panel" role="dialog"><input id="input" /></div>
      </div>
    </div>
    <div id="portaled" style="position: fixed; inset: 0"><button id="portal-button">Save</button></div>`
  const $ = (id: string) => document.getElementById(id) as HTMLElement
  const row = $('row')
  const from = (id: string) => ({ target: $(id) as EventTarget, currentTarget: row as EventTarget })
  return { $, row, from }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('startedInWindowInside', () => {
  it('a press on the row itself, its content or a sticky cell is the row’s', () => {
    const { row, from } = draw()
    expect(startedInWindowInside({ target: row, currentTarget: row })).toBe(false)
    expect(startedInWindowInside(from('title'))).toBe(false)
    expect(startedInWindowInside(from('sticky-text'))).toBe(false)
  })

  it('a press on a window’s backdrop, its panel or a box in it is not', () => {
    const { from } = draw()
    expect(startedInWindowInside(from('backdrop'))).toBe(true)
    expect(startedInWindowInside(from('panel'))).toBe(true)
    expect(startedInWindowInside(from('input'))).toBe(true)
  })

  it('a press React bubbled in from a portal is not', () => {
    const { from } = draw()
    expect(startedInWindowInside(from('portal-button'))).toBe(true)
  })

  it('a text node target reads as its element', () => {
    const { $, row } = draw()
    expect(startedInWindowInside({ target: $('title').firstChild, currentTarget: row })).toBe(false)
    expect(startedInWindowInside({ target: $('panel').appendChild(document.createTextNode('note')), currentTarget: row })).toBe(true)
  })

  it('an event with no target or row is left to the row', () => {
    const { row } = draw()
    expect(startedInWindowInside({ target: null, currentTarget: row })).toBe(false)
    expect(startedInWindowInside({ target: row, currentTarget: null })).toBe(false)
  })
})

describe('ignoreWindowsInside', () => {
  it('passes the row’s own presses through and drops a window’s', () => {
    const { from } = draw()
    const onMouseDown = vi.fn()
    const onTouchStart = vi.fn()
    const wrapped = ignoreWindowsInside({ onMouseDown, onTouchStart })!
    ;(wrapped.onMouseDown as (e: unknown) => void)(from('title'))
    ;(wrapped.onTouchStart as (e: unknown) => void)(from('title'))
    ;(wrapped.onMouseDown as (e: unknown) => void)(from('input'))
    ;(wrapped.onTouchStart as (e: unknown) => void)(from('backdrop'))
    expect(onMouseDown).toHaveBeenCalledTimes(1)
    expect(onMouseDown).toHaveBeenCalledWith(from('title'))
    expect(onTouchStart).toHaveBeenCalledTimes(1)
  })

  it('keeps no handlers as none and other values as they are', () => {
    expect(ignoreWindowsInside(undefined)).toBeUndefined()
    const marker = { a: 1 }
    expect(ignoreWindowsInside({ marker })!.marker).toBe(marker)
  })
})
