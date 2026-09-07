// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { summarizeTakeoffCoverage } from './takeoffCoverage'
import { focusRailItems, focusShortcutApplies, initialFocusId, isTypingTarget, moveFocus } from './takeoffFocus'

const rows = [{ id: 'a', count: 1 }, { id: 'b', count: 2 }, { id: 'c', count: 3 }]
const line = (id: string, countRowId: string, unitPrice: number) => ({ id, countRowId, partId: 'p', quantity: 1, unitPrice, sourceMaterialPartPriceId: 'x', sourceTemplateId: null })

describe('focusRailItems', () => {
  it('maps coverage to done / todo / zero dots with totals and book hints', () => {
    const cov = summarizeTakeoffCoverage(rows, [line('l1', 'a', 10), line('l2', 'c', 0)])
    const items = focusRailItems(rows, cov, new Set(['b']))
    expect(items).toEqual([
      { countRowId: 'a', status: 'done', lineCount: 1, total: 10, bookMatch: false },
      { countRowId: 'b', status: 'todo', lineCount: 0, total: 0, bookMatch: true },
      { countRowId: 'c', status: 'zero', lineCount: 1, total: 0, bookMatch: false },
    ])
  })
})

describe('moveFocus', () => {
  const order = ['a', 'b', 'c']
  it('steps and clamps', () => {
    expect(moveFocus(order, 'a', 1)).toBe('b')
    expect(moveFocus(order, 'c', 1)).toBe('c')
    expect(moveFocus(order, 'a', -1)).toBe('a')
    expect(moveFocus(order, null, 1)).toBe('a')
    expect(moveFocus(order, 'zz', -1)).toBe('a')
    expect(moveFocus([], 'a', 1)).toBeNull()
  })
})

describe('initialFocusId', () => {
  it('opens on the first uncosted row, else the first row, else null', () => {
    expect(initialFocusId(rows, ['c', 'b'])).toBe('b')
    expect(initialFocusId(rows, [])).toBe('a')
    expect(initialFocusId([], [])).toBeNull()
  })
})

describe('isTypingTarget', () => {
  it('recognizes fields and contenteditable, not buttons or nothing', () => {
    expect(isTypingTarget(document.createElement('input'))).toBe(true)
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true)
    expect(isTypingTarget(document.createElement('select'))).toBe(true)
    const ce = document.createElement('div')
    Object.defineProperty(ce, 'isContentEditable', { value: true })
    expect(isTypingTarget(ce)).toBe(true)
    expect(isTypingTarget(document.createElement('button'))).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})

describe('focusShortcutApplies', () => {
  function el(html: string): Element {
    document.body.innerHTML = html
    return document.querySelector('[data-t]')!
  }
  it('acts on the page body and plain elements', () => {
    expect(focusShortcutApplies(null, 'Enter')).toBe(true)
    expect(focusShortcutApplies(el('<div data-t>x</div>'), 'Enter')).toBe(true)
    expect(focusShortcutApplies(el('<div data-t>x</div>'), 'ArrowDown')).toBe(true)
  })
  it('never acts while a field is being typed into', () => {
    expect(focusShortcutApplies(el('<input data-t />'), 'Enter')).toBe(false)
    expect(focusShortcutApplies(el('<textarea data-t></textarea>'), 'ArrowUp')).toBe(false)
  })
  it('leaves Enter to a focused button or link, but still moves the rail with arrows', () => {
    expect(focusShortcutApplies(el('<button data-t role="option">rail</button>'), 'Enter')).toBe(false)
    expect(focusShortcutApplies(el('<button data-t role="option">rail</button>'), 'ArrowDown')).toBe(true)
    expect(focusShortcutApplies(el('<span data-t role="button" tabindex="0">Add part line</span>'), 'Enter')).toBe(false)
    expect(focusShortcutApplies(el('<a data-t href="#">link</a>'), 'Enter')).toBe(false)
    expect(focusShortcutApplies(el('<button><span data-t>inner</span></button>'), 'Enter')).toBe(false)
  })
  it('never acts inside an open dialog (the remove-line confirm focuses Delete)', () => {
    const del = el('<div role="dialog"><p>Remove this line?</p><button data-t>Delete</button></div>')
    expect(focusShortcutApplies(del, 'Enter')).toBe(false)
    expect(focusShortcutApplies(del, 'ArrowDown')).toBe(false)
    expect(focusShortcutApplies(el('<div role="alertdialog"><div data-t>text</div></div>'), 'Enter')).toBe(false)
  })
})
