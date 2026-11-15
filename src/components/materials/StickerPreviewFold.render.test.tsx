// @vitest-environment jsdom
/**
 * Render smoke for the Print blank stickers window's *What the stickers will look like* fold (punch list #329,
 * v2.7304): closed until opened, and the device remembers; opened, the first six strips with the run's real numbers
 * and the sample code, the copies together, *and N more* with Show all, the test strip; a run past the cap says so.
 * The canvas is mocked, as the window's USB test mocks it: a test's DOM has none.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../lib/materials/tapeStripCanvas', () => ({
  drawTapeStrip: () => ({ width: 300, height: 128, lines: [new Uint8Array(16)] }),
}))

import StickerPreviewFold from './StickerPreviewFold'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

const stripNames = () => screen.getAllByTestId('labels-tape-bitmap').map((c) => c.getAttribute('aria-label'))

describe('StickerPreviewFold', () => {
  it('is closed until opened, and the device remembers', () => {
    render(<StickerPreviewFold lastNumber={2} count={200} copies={1} width={24} />)
    const fold = screen.getByTestId('stickers-preview') as HTMLDetailsElement
    expect(fold.open).toBe(false)
    expect(screen.queryAllByTestId('labels-tape-bitmap')).toHaveLength(0)
    fireEvent(fold, new Event('toggle'))
    fold.open = true
    fireEvent(fold, new Event('toggle'))
    expect(localStorage.getItem('pt.stickers.previewOpen')).toBe('1')
    cleanup()
    render(<StickerPreviewFold lastNumber={2} count={200} copies={1} width={24} />)
    expect((screen.getByTestId('stickers-preview') as HTMLDetailsElement).open).toBe(true)
  })

  it('opened, draws the first six strips with the run’s numbers, says the rest, and the test strip', () => {
    localStorage.setItem('pt.stickers.previewOpen', '1')
    render(<StickerPreviewFold lastNumber={2} count={200} copies={1} width={24} />)
    expect(screen.getByTestId('stickers-preview-head').textContent).toBe('6 strips of 200 stickers, 0003 to 0008.')
    expect(stripNames()).toEqual(['The strip for 0003', 'The strip for 0004', 'The strip for 0005', 'The strip for 0006', 'The strip for 0007', 'The strip for 0008', 'The strip for 0000'])
    expect(screen.getByTestId('stickers-preview-more').textContent).toBe('and 194 more, to 0202')
    expect(screen.getByTestId('stickers-preview-show-all').textContent).toBe('Show all 200')
    expect(screen.getByTestId('stickers-preview-code-words').textContent).toBe('The numbers are the run’s. Each sticker’s code is given when the run prints.')
    expect(screen.getByTestId('stickers-preview-test-words').textContent).toBe('Print 1 test strip prints this strip. It is not a sticker.')
    expect(screen.queryByTestId('stickers-preview-rest')).toBeNull()
    // the strips are drawn at the tape's dots: 128 across 24 mm
    expect((screen.getAllByTestId('labels-tape-bitmap')[0] as HTMLCanvasElement).style.height).toBe('128px')
  })

  it('two copies draw 1 1 2 2 3 3, and 18 mm tape draws at its own dots', () => {
    localStorage.setItem('pt.stickers.previewOpen', '1')
    render(<StickerPreviewFold lastNumber={null} count={60} copies={2} width={18} />)
    expect(stripNames().slice(0, 6)).toEqual(['The strip for 0001', 'The strip for 0001', 'The strip for 0002', 'The strip for 0002', 'The strip for 0003', 'The strip for 0003'])
    expect(screen.getByTestId('stickers-preview-more').textContent).toBe('and 57 more, to 0060')
    expect((screen.getAllByTestId('labels-tape-bitmap')[0] as HTMLCanvasElement).style.height).toBe('112px')
  })

  it('Show all draws the rest once each at half size, and nothing is left to say', () => {
    localStorage.setItem('pt.stickers.previewOpen', '1')
    render(<StickerPreviewFold lastNumber={2} count={30} copies={2} width={24} />)
    fireEvent.click(screen.getByTestId('stickers-preview-show-all'))
    const rest = screen.getByTestId('stickers-preview-rest').querySelectorAll('canvas')
    expect(rest).toHaveLength(27)
    expect(rest[0]!.getAttribute('aria-label')).toBe('The strip for 0006')
    expect(rest[26]!.getAttribute('aria-label')).toBe('The strip for 0032')
    expect((rest[0] as HTMLCanvasElement).style.height).toBe('64px')
    expect(screen.queryByTestId('stickers-preview-more')).toBeNull()
    expect(screen.queryByTestId('stickers-preview-show-all')).toBeNull()
    expect(screen.queryByTestId('stickers-preview-capped')).toBeNull()
  })

  it('a run past the cap draws 200 and says so', () => {
    localStorage.setItem('pt.stickers.previewOpen', '1')
    render(<StickerPreviewFold lastNumber={null} count={500} copies={1} width={24} />)
    fireEvent.click(screen.getByTestId('stickers-preview-show-all'))
    expect(screen.getByTestId('stickers-preview-rest').querySelectorAll('canvas')).toHaveLength(194)
    expect(screen.getByTestId('stickers-preview-capped').textContent).toBe('The first 200 of 500 are drawn. The rest print the same way.')
  })

  it('with no count it says what fills it, and while the last run is read it says so', () => {
    localStorage.setItem('pt.stickers.previewOpen', '1')
    render(<StickerPreviewFold lastNumber={2} count={0} copies={1} width={24} />)
    expect(screen.getByTestId('stickers-preview-empty').textContent).toBe('Pick how many, and the strips are drawn here.')
    expect(stripNames()).toEqual(['The strip for 0000'])
    cleanup()
    render(<StickerPreviewFold lastNumber={undefined} count={200} copies={1} width={24} />)
    expect(screen.getByTestId('stickers-preview-reading').textContent).toBe('Reading where the last run ended…')
  })
})
