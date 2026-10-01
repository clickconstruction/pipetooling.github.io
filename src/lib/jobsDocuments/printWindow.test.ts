// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { openHtmlWindowWhenReady } from './printWindow'

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
