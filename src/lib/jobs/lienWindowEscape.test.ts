import { describe, expect, it } from 'vitest'
import { fieldsHoldUnsavedWords, isWordField, lienWindowEscapeAction, type LienWindowEscapeState } from './lienWindowEscape'

const clean: LienWindowEscapeState = { handled: false, topmost: true, busy: false, unsavedWords: false }

describe('Escape on a job’s Lien window', () => {
  it('closes a window nothing was typed in', () => {
    expect(lienWindowEscapeAction(clean)).toBe('close')
  })

  it('leaves the window where it is over typed words', () => {
    expect(lienWindowEscapeAction({ ...clean, unsavedWords: true })).toBe('stay')
  })

  it('is not this window’s key when a window or a field over it took it', () => {
    expect(lienWindowEscapeAction({ ...clean, handled: true })).toBe('ignore')
    // A confirm, a preview or a value changed in place took the key: typed words or not, this window does nothing.
    expect(lienWindowEscapeAction({ ...clean, handled: true, unsavedWords: true })).toBe('ignore')
  })

  it('is not this window’s key when another window is on top of the stack', () => {
    expect(lienWindowEscapeAction({ ...clean, topmost: false })).toBe('ignore')
  })

  it('waits while a write is in flight', () => {
    expect(lienWindowEscapeAction({ ...clean, busy: true })).toBe('ignore')
    expect(lienWindowEscapeAction({ ...clean, busy: true, unsavedWords: true })).toBe('ignore')
  })
})

describe('which fields hold typed words', () => {
  it('counts a text box of every typed kind, a text area and an editable block', () => {
    for (const type of ['', 'text', 'search', 'email', 'tel', 'url', 'number', 'date', 'TEXT']) expect(isWordField({ tagName: 'INPUT', type })).toBe(true)
    expect(isWordField({ tagName: 'input', type: null })).toBe(true)
    expect(isWordField({ tagName: 'TEXTAREA' })).toBe(true)
    expect(isWordField({ tagName: 'DIV', editable: true })).toBe(true)
  })

  it('does not count a tick, a radio, a file, a press, a select or plain words on the page', () => {
    for (const type of ['checkbox', 'radio', 'file', 'button', 'submit', 'reset', 'range', 'color', 'hidden', 'image']) expect(isWordField({ tagName: 'INPUT', type })).toBe(false)
    expect(isWordField({ tagName: 'SELECT' })).toBe(false)
    expect(isWordField({ tagName: 'BUTTON' })).toBe(false)
    expect(isWordField({ tagName: 'DIV' })).toBe(false)
  })
})

describe('whether touched fields hold unsaved words', () => {
  it('holds none when nothing was touched, or each field reads as it did', () => {
    expect(fieldsHoldUnsavedWords([])).toBe(false)
    expect(fieldsHoldUnsavedWords([{ first: '', now: '' }, { first: 'ZZ Test', now: 'ZZ Test' }])).toBe(false)
  })

  it('holds words when one field reads otherwise, typed in or cleared', () => {
    expect(fieldsHoldUnsavedWords([{ first: '', now: 'a' }])).toBe(true)
    expect(fieldsHoldUnsavedWords([{ first: 'ZZ Test', now: 'ZZ Test' }, { first: 'ZZ Test', now: '' }])).toBe(true)
  })

  it('holds none once a typed field reads as it first did again', () => {
    expect(fieldsHoldUnsavedWords([{ first: '9400 1000', now: '9400 1000' }])).toBe(false)
  })
})
