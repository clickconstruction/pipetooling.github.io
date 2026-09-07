import { afterEach, describe, expect, it, vi } from 'vitest'
import { addressLines, escapeHtml, printHtmlInNewWindow } from './htmlDoc'

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters and tolerates a missing string', () => {
    expect(escapeHtml(`<a href="x">Tom & Jerry's</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;')
    expect(escapeHtml('')).toBe('')
    expect(escapeHtml(undefined as unknown as string)).toBe('')
  })
})

describe('addressLines', () => {
  it('splits on the first comma only, trims, and never returns an empty array', () => {
    expect(addressLines('12925 FM 20, Kingsbury, TX 78638')).toEqual(['12925 FM 20', 'Kingsbury, TX 78638'])
    expect(addressLines('  12925 FM 20  ')).toEqual(['12925 FM 20'])
    expect(addressLines('')).toEqual([''])
    expect(addressLines(null as unknown as string)).toEqual([''])
  })
})

describe('printHtmlInNewWindow', () => {
  const g = globalThis as unknown as { window?: unknown }
  afterEach(() => {
    delete g.window
  })
  it('writes, closes the document, focuses, prints, and closes the window after printing', () => {
    const win = { document: { write: vi.fn(), close: vi.fn() }, focus: vi.fn(), print: vi.fn(), close: vi.fn(), onafterprint: null as null | (() => void) }
    g.window = { open: vi.fn(() => win) }
    printHtmlInNewWindow('<p>hi</p>')
    expect((g.window as { open: ReturnType<typeof vi.fn> }).open).toHaveBeenCalledWith('', '_blank')
    expect(win.document.write).toHaveBeenCalledWith('<p>hi</p>')
    expect(win.document.close).toHaveBeenCalled()
    expect(win.focus).toHaveBeenCalled()
    expect(win.print).toHaveBeenCalled()
    expect(win.close).not.toHaveBeenCalled()
    win.onafterprint!()
    expect(win.close).toHaveBeenCalled()
  })
  it('a blocked popup is a quiet no-op', () => {
    g.window = { open: vi.fn(() => null) }
    expect(() => printHtmlInNewWindow('<p/>')).not.toThrow()
  })
})
