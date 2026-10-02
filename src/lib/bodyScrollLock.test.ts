import { describe, it, expect, beforeEach } from 'vitest'
import {
  acquireBodyScrollLock,
  bodyStyleFreezesPage,
  healStrayScrollLock,
  isBodyScrollLockHeld,
  resetBodyScrollLockForTests,
  SCROLL_LOCK_CLASS,
  SCROLL_LOCK_PAD_VAR,
  SCROLL_LOCK_TOP_VAR,
  type ScrollLockBodyStyle,
  type ScrollLockRoot,
  type ScrollLockWindow,
} from './bodyScrollLock'

function makeRoot(): ScrollLockRoot & { classes: Set<string>; vars: Map<string, string> } {
  const classes = new Set<string>()
  const vars = new Map<string, string>()
  return {
    classes,
    vars,
    classList: {
      add: (name) => void classes.add(name),
      remove: (name) => void classes.delete(name),
      contains: (name) => classes.has(name),
    },
    style: {
      setProperty: (name, value) => void vars.set(name, value),
      removeProperty: (name) => vars.delete(name),
    },
  }
}

function makeBodyStyle(overrides: Partial<ScrollLockBodyStyle> = {}): ScrollLockBodyStyle {
  return { overflow: '', position: '', top: '', left: '', right: '', ...overrides }
}

function makeWindow(scrollY = 0): ScrollLockWindow & { scrolledTo: number[] } {
  const scrolledTo: number[] = []
  return {
    scrollY,
    scrollTo: (_x: number, y: number) => {
      scrolledTo.push(y)
    },
    scrolledTo,
  }
}

beforeEach(() => {
  resetBodyScrollLockForTests()
})

describe('acquireBodyScrollLock', () => {
  it('pins the page at its current offset with a class, not a body style', () => {
    const root = makeRoot()
    acquireBodyScrollLock(root, makeWindow(320))
    expect(root.classes.has(SCROLL_LOCK_CLASS)).toBe(true)
    // The offset rides on a variable: index.css turns it into the fixed body's `top`.
    expect(root.vars.get(SCROLL_LOCK_TOP_VAR)).toBe('-320px')
    expect(isBodyScrollLockHeld()).toBe(true)
  })

  it('lifts the class and puts the scroll offset back on release', () => {
    const root = makeRoot()
    const win = makeWindow(320)
    const release = acquireBodyScrollLock(root, win)
    release()
    expect(root.classes.has(SCROLL_LOCK_CLASS)).toBe(false)
    expect(root.vars.size).toBe(0)
    // Closing the modal must not dump the user back at the top of the page.
    expect(win.scrolledTo).toEqual([320])
    expect(isBodyScrollLockHeld()).toBe(false)
  })

  it('stays locked until the LAST of a stack of modals releases', () => {
    const root = makeRoot()
    const win = makeWindow(120)
    const releaseOuter = acquireBodyScrollLock(root, win)
    const releaseInner = acquireBodyScrollLock(root, win)

    releaseInner()
    expect(root.classes.has(SCROLL_LOCK_CLASS)).toBe(true)
    expect(win.scrolledTo).toEqual([])

    releaseOuter()
    expect(root.classes.has(SCROLL_LOCK_CLASS)).toBe(false)
    expect(win.scrolledTo).toEqual([120])
  })

  it('keeps the first offset when a second lock stacks on a pinned page', () => {
    const root = makeRoot()
    const win = makeWindow(80)
    const releaseOuter = acquireBodyScrollLock(root, win)
    // A pinned page reads scrollY 0; the inner lock must not take that as the offset.
    win.scrollY = 0
    const releaseInner = acquireBodyScrollLock(root, win)
    expect(root.vars.get(SCROLL_LOCK_TOP_VAR)).toBe('-80px')
    releaseInner()
    releaseOuter()
    expect(win.scrolledTo).toEqual([80])
  })

  it('pads out the scrollbar it removes so the page does not jump sideways', () => {
    const root = makeRoot()
    const release = acquireBodyScrollLock(root, makeWindow(0), 15)
    expect(root.vars.get(SCROLL_LOCK_PAD_VAR)).toBe('15px')
    release()
    expect(root.vars.has(SCROLL_LOCK_PAD_VAR)).toBe(false)
  })

  it('pads nothing on touch devices, where there is no scrollbar', () => {
    const root = makeRoot()
    acquireBodyScrollLock(root, makeWindow(0), 0)
    expect(root.vars.get(SCROLL_LOCK_PAD_VAR)).toBe('0px')
  })

  it('ignores a double release', () => {
    const root = makeRoot()
    const win = makeWindow(50)
    const release = acquireBodyScrollLock(root, win)
    release()
    release()
    expect(win.scrolledTo).toEqual([50])

    // The counter must not have gone negative — a later lock still applies.
    acquireBodyScrollLock(root, makeWindow(10))
    expect(root.classes.has(SCROLL_LOCK_CLASS)).toBe(true)
  })

  it('cannot be stranded by a window that saves and restores the body overflow around it', () => {
    // The freeze v2.2394 could not find: a window's own effect wrote `overflow: hidden` on the
    // body, the lock then saved that as "the style before" and, after the window had put its
    // own `''` back, restored `hidden` for good. The lock no longer reads or writes that style.
    const root = makeRoot()
    const body = makeBodyStyle()
    const win = makeWindow(300)

    const prev = body.overflow
    body.overflow = 'hidden' // the window's own effect, first
    const release = acquireBodyScrollLock(root, win) // then the lock
    body.overflow = prev // the window closes: its cleanup
    release() // then the lock lets go

    expect(body.overflow).toBe('')
    expect(root.classes.has(SCROLL_LOCK_CLASS)).toBe(false)
    expect(bodyStyleFreezesPage(body)).toBe(false)
  })
})

describe('healStrayScrollLock', () => {
  it('clears an overflow freeze left on the body when no lock is held', () => {
    const body = makeBodyStyle({ overflow: 'hidden' })
    expect(healStrayScrollLock(makeRoot(), body)).toBe(true)
    expect(body.overflow).toBe('')
  })

  it('clears a fixed body and its offsets', () => {
    const body = makeBodyStyle({ overflow: 'hidden', position: 'fixed', top: '-300px', left: '0', right: '0' })
    expect(healStrayScrollLock(makeRoot(), body)).toBe(true)
    expect(body).toEqual(makeBodyStyle())
  })

  it('lifts a class left behind', () => {
    const root = makeRoot()
    root.classes.add(SCROLL_LOCK_CLASS)
    root.vars.set(SCROLL_LOCK_TOP_VAR, '-40px')
    expect(healStrayScrollLock(root, makeBodyStyle())).toBe(true)
    expect(root.classes.has(SCROLL_LOCK_CLASS)).toBe(false)
    expect(root.vars.size).toBe(0)
  })

  it('touches nothing while a lock is held', () => {
    const root = makeRoot()
    const body = makeBodyStyle({ overflow: 'hidden' })
    acquireBodyScrollLock(root, makeWindow(0))
    expect(healStrayScrollLock(root, body)).toBe(false)
    expect(body.overflow).toBe('hidden')
    expect(root.classes.has(SCROLL_LOCK_CLASS)).toBe(true)
  })

  it('reports nothing to clear on a free page, and leaves other overflow values alone', () => {
    const body = makeBodyStyle({ overflow: 'auto' })
    expect(healStrayScrollLock(makeRoot(), body)).toBe(false)
    expect(body.overflow).toBe('auto')
  })
})
