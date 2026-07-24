import { describe, it, expect, beforeEach } from 'vitest'
import {
  acquireBodyScrollLock,
  resetBodyScrollLockForTests,
  type ScrollLockBody,
  type ScrollLockWindow,
} from './bodyScrollLock'

function makeBody(overrides: Partial<ScrollLockBody['style']> = {}): ScrollLockBody {
  return { style: { overflow: '', position: '', top: '', left: '', right: '', paddingRight: '', ...overrides } }
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
  it('pins the body at its current offset', () => {
    const body = makeBody()
    acquireBodyScrollLock(body, makeWindow(320))
    expect(body.style.overflow).toBe('hidden')
    // position: fixed, not overflow alone — iOS Safari rubber-bands otherwise.
    expect(body.style.position).toBe('fixed')
    expect(body.style.top).toBe('-320px')
    expect(body.style.left).toBe('0')
    expect(body.style.right).toBe('0')
  })

  it('restores the previous styles and scroll offset on release', () => {
    const body = makeBody({ overflow: 'visible' })
    const win = makeWindow(320)
    const release = acquireBodyScrollLock(body, win)
    release()
    expect(body.style.overflow).toBe('visible')
    expect(body.style.position).toBe('')
    expect(body.style.top).toBe('')
    // Closing the modal must not dump the user back at the top of the page.
    expect(win.scrolledTo).toEqual([320])
  })

  it('stays locked until the LAST of a stack of modals releases', () => {
    const body = makeBody()
    const win = makeWindow(120)
    const releaseOuter = acquireBodyScrollLock(body, win)
    const releaseInner = acquireBodyScrollLock(body, win)

    releaseInner()
    expect(body.style.position).toBe('fixed')
    expect(win.scrolledTo).toEqual([])

    releaseOuter()
    expect(body.style.position).toBe('')
    expect(win.scrolledTo).toEqual([120])
  })

  it('does not let an inner modal capture the outer lock as the "previous" style', () => {
    const body = makeBody({ overflow: 'auto' })
    const win = makeWindow(80)
    const releaseOuter = acquireBodyScrollLock(body, win)
    const releaseInner = acquireBodyScrollLock(body, win)
    releaseInner()
    releaseOuter()
    expect(body.style.overflow).toBe('auto')
  })

  it('pads out the scrollbar it removes so the page does not jump sideways', () => {
    const body = makeBody()
    const release = acquireBodyScrollLock(body, makeWindow(0), 15)
    expect(body.style.paddingRight).toBe('calc(0px + 15px)')
    release()
    expect(body.style.paddingRight).toBe('')
  })

  it('leaves padding alone on touch devices, where there is no scrollbar', () => {
    const body = makeBody()
    acquireBodyScrollLock(body, makeWindow(0), 0)
    expect(body.style.paddingRight).toBe('')
  })

  it('ignores a double release', () => {
    const body = makeBody()
    const win = makeWindow(50)
    const release = acquireBodyScrollLock(body, win)
    release()
    release()
    expect(win.scrolledTo).toEqual([50])

    // The counter must not have gone negative — a later lock still applies.
    acquireBodyScrollLock(body, makeWindow(10))
    expect(body.style.position).toBe('fixed')
  })
})
