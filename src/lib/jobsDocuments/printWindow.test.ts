// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { openHtmlPrintWindow, openHtmlWindowWhenReady, PRINT_PICTURE_WAIT_MS } from './printWindow'

function fakeWindow() {
  const writes: string[] = []
  const win = {
    document: { write: (h: string) => writes.push(h), open: vi.fn(), close: vi.fn(), images: [] as HTMLImageElement[] },
    focus: vi.fn(),
    print: vi.fn(),
    close: vi.fn(),
    onafterprint: null as null | (() => void),
  }
  return { win, writes }
}

afterEach(() => vi.restoreAllMocks())

describe('openHtmlWindowWhenReady (v2.4335)', () => {
  it('opens the window at once with a loading line, then writes the finished page', async () => {
    const { win, writes } = fakeWindow()
    const open = vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window)
    let release: (v: string) => void = () => undefined
    const done = openHtmlWindowWhenReady(() => new Promise<string>((r) => (release = r)))
    // Opened inside the click, before the page is ready.
    expect(open).toHaveBeenCalledTimes(1)
    expect(writes[0]).toContain('Loading the page')
    release('<html>the signed page</html>')
    expect(await done).toBe(true)
    expect(writes[1]).toBe('<html>the signed page</html>')
    expect(win.print).not.toHaveBeenCalled()
  })
  it('prints when asked; a page that cannot be built closes the window', async () => {
    const a = fakeWindow()
    vi.spyOn(window, 'open').mockReturnValue(a.win as unknown as Window)
    expect(await openHtmlWindowWhenReady(async () => '<html>x</html>', { print: true })).toBe(true)
    expect(a.win.print).toHaveBeenCalled()
    const b = fakeWindow()
    vi.spyOn(window, 'open').mockReturnValue(b.win as unknown as Window)
    expect(await openHtmlWindowWhenReady(async () => Promise.reject(new Error('no')))).toBe(false)
    expect(b.win.close).toHaveBeenCalled()
  })
  it('a blocked popup is reported', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    expect(await openHtmlWindowWhenReady(async () => 'x')).toBe(false)
  })
})

/** A picture as the new window holds it: not loaded until `land` is called. */
function fakePicture() {
  const heard: Record<string, Array<() => void>> = {}
  const img = { complete: false, addEventListener: (type: string, fn: () => void) => void (heard[type] ??= []).push(fn) }
  const land = (type: 'load' | 'error') => {
    img.complete = type === 'load'
    for (const fn of heard[type] ?? []) fn()
  }
  return { img: img as unknown as HTMLImageElement, land }
}

describe('openHtmlPrintWindow waits for the page’s pictures (v2.7011)', () => {
  it('a page with no picture prints at once', () => {
    const { win, writes } = fakeWindow()
    vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window)
    expect(openHtmlPrintWindow('<html>words only</html>')).toBe(true)
    expect(writes).toEqual(['<html>words only</html>'])
    expect(win.print).toHaveBeenCalledTimes(1)
  })
  it('a page whose pictures are still loading prints once each has loaded or failed, never before', async () => {
    const { win } = fakeWindow()
    const a = fakePicture()
    const b = fakePicture()
    win.document.images = [a.img, b.img]
    vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window)
    expect(openHtmlPrintWindow('<html>a code and a code</html>')).toBe(true)
    expect(win.print).not.toHaveBeenCalled()
    a.land('load')
    await Promise.resolve()
    expect(win.print).not.toHaveBeenCalled()
    // A picture that fails still lets the page print: the words are the paper.
    b.land('error')
    await vi.waitFor(() => expect(win.print).toHaveBeenCalledTimes(1))
    win.onafterprint?.()
    expect(win.close).toHaveBeenCalled()
  })
  it('a picture that never arrives does not lose the print', async () => {
    vi.useFakeTimers()
    try {
      const { win } = fakeWindow()
      win.document.images = [fakePicture().img]
      vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window)
      openHtmlPrintWindow('<html>x</html>')
      await vi.advanceTimersByTimeAsync(PRINT_PICTURE_WAIT_MS - 1)
      expect(win.print).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)
      expect(win.print).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
  it('a blocked popup is reported', () => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    expect(openHtmlPrintWindow('x')).toBe(false)
  })
})
