import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyRichHtmlToClipboard } from './copyRichHtmlToClipboard'

class FakeClipboardItem {
  data: Record<string, Blob>
  constructor(data: Record<string, Blob>) {
    this.data = data
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('copyRichHtmlToClipboard', () => {
  it('writes only text/html wrapped in CF_HTML fragment markers', async () => {
    vi.stubGlobal('ClipboardItem', FakeClipboardItem as unknown as typeof ClipboardItem)
    let captured: FakeClipboardItem | undefined
    const write = vi.fn(async (items: FakeClipboardItem[]) => {
      captured = items[0]
    })
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { clipboard: { write, writeText } })

    await copyRichHtmlToClipboard('<p><strong>Hi</strong></p>', 'Hi')

    expect(write).toHaveBeenCalledTimes(1)
    expect(writeText).not.toHaveBeenCalled()
    expect(captured).toBeDefined()
    expect(Object.keys(captured!.data)).toEqual(['text/html'])
    const htmlBlob = captured!.data['text/html']
    expect(htmlBlob).toBeDefined()
    const html = await htmlBlob!.text()
    expect(html).toContain('<!--StartFragment-->')
    expect(html).toContain('<!--EndFragment-->')
    expect(html).toContain('<p><strong>Hi</strong></p>')
  })

  it('falls back to plain text when the rich write rejects', async () => {
    vi.stubGlobal('ClipboardItem', FakeClipboardItem as unknown as typeof ClipboardItem)
    const write = vi.fn(async () => {
      throw new Error('denied')
    })
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { clipboard: { write, writeText } })

    await copyRichHtmlToClipboard('<p>x</p>', 'plain text')

    expect(write).toHaveBeenCalledTimes(1)
    expect(writeText).toHaveBeenCalledWith('plain text')
  })

  it('uses plain text when clipboard.write is unavailable', async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    await copyRichHtmlToClipboard('<p>x</p>', 'plain text')

    expect(writeText).toHaveBeenCalledWith('plain text')
  })
})
