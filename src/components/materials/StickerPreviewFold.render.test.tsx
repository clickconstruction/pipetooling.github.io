// @vitest-environment jsdom
/**
 * Render smoke for the Print future stickers window's *What the stickers will look like* fold (punch list #329,
 * v2.7304): closed until opened, and the device remembers; opened, a named run's first six strips by name with the
 * sample code, the copies together, *and N more* with Show all; a run past the cap says so; a run with no names draws
 * one sticker, since every other differs only by its code (v2.7438: no strip carries a running number); the test
 * strip. The canvas is mocked, as the window's USB test mocks it: a test's DOM has none.
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
const names = (first: number, n: number) => Array.from({ length: n }, (_, i) => `G${first + i}`)

describe('StickerPreviewFold', () => {
  it('is closed until opened, and the device remembers', () => {
    render(<StickerPreviewFold count={200} copies={1} width={24} />)
    const fold = screen.getByTestId('stickers-preview') as HTMLDetailsElement
    expect(fold.open).toBe(false)
    expect(screen.queryAllByTestId('labels-tape-bitmap')).toHaveLength(0)
    fireEvent(fold, new Event('toggle'))
    fold.open = true
    fireEvent(fold, new Event('toggle'))
    expect(localStorage.getItem('pt.stickers.previewOpen')).toBe('1')
    cleanup()
    render(<StickerPreviewFold count={200} copies={1} width={24} />)
    expect((screen.getByTestId('stickers-preview') as HTMLDetailsElement).open).toBe(true)
  })

  it('a named run draws its first six strips by name, says the rest, and the test strip', () => {
    localStorage.setItem('pt.stickers.previewOpen', '1')
    render(<StickerPreviewFold count={223} copies={1} width={24} names={names(78, 223)} />)
    expect(screen.getByTestId('stickers-preview-head').textContent).toBe('6 strips of 223 stickers, G78 to G83.')
    expect(stripNames()).toEqual(['The strip for G78', 'The strip for G79', 'The strip for G80', 'The strip for G81', 'The strip for G82', 'The strip for G83', 'The strip for TEST'])
    expect(screen.getByTestId('stickers-preview-more').textContent).toBe('and 217 more, to G300')
    expect(screen.getByTestId('stickers-preview-show-all').textContent).toBe('Show all 223')
    expect(screen.getByTestId('stickers-preview-code-words').textContent).toBe('The names are the run’s own. Each sticker gets its own link when it prints. XXXX-XXXX stands in for it here.')
    expect(screen.getByTestId('stickers-preview-test-words').textContent).toBe('Print 1 test strip prints this strip. It is not a sticker.')
    expect(screen.queryByTestId('stickers-preview-rest')).toBeNull()
    // the stand-in's line sits over the strips it speaks of, never under them (v2.7486): the eye lands on the strips
    const line = screen.getByTestId('stickers-preview-code-words')
    expect(line.getAttribute('role')).toBe('note')
    expect(line.compareDocumentPosition(screen.getByTestId('stickers-preview-strips')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // the strips are drawn at the tape's dots: 128 across 24 mm
    expect((screen.getAllByTestId('labels-tape-bitmap')[0] as HTMLCanvasElement).style.height).toBe('128px')
  })

  it('two copies draw 1 1 2 2 3 3, and 18 mm tape draws at its own dots', () => {
    localStorage.setItem('pt.stickers.previewOpen', '1')
    render(<StickerPreviewFold count={60} copies={2} width={18} names={names(1, 60)} />)
    expect(stripNames().slice(0, 6)).toEqual(['The strip for G1', 'The strip for G1', 'The strip for G2', 'The strip for G2', 'The strip for G3', 'The strip for G3'])
    expect(screen.getByTestId('stickers-preview-more').textContent).toBe('and 57 more, to G60')
    expect((screen.getAllByTestId('labels-tape-bitmap')[0] as HTMLCanvasElement).style.height).toBe('112px')
  })

  it('Show all draws the rest once each at half size, and nothing is left to say', () => {
    localStorage.setItem('pt.stickers.previewOpen', '1')
    render(<StickerPreviewFold count={30} copies={2} width={24} names={names(1, 30)} />)
    fireEvent.click(screen.getByTestId('stickers-preview-show-all'))
    const rest = screen.getByTestId('stickers-preview-rest').querySelectorAll('canvas')
    expect(rest).toHaveLength(27)
    expect(rest[0]!.getAttribute('aria-label')).toBe('The strip for G4')
    expect(rest[26]!.getAttribute('aria-label')).toBe('The strip for G30')
    expect((rest[0] as HTMLCanvasElement).style.height).toBe('64px')
    expect(screen.queryByTestId('stickers-preview-more')).toBeNull()
    expect(screen.queryByTestId('stickers-preview-show-all')).toBeNull()
    expect(screen.queryByTestId('stickers-preview-capped')).toBeNull()
  })

  it('a run past the cap draws 200 and says so', () => {
    localStorage.setItem('pt.stickers.previewOpen', '1')
    render(<StickerPreviewFold count={500} copies={1} width={24} names={names(1, 500)} />)
    fireEvent.click(screen.getByTestId('stickers-preview-show-all'))
    expect(screen.getByTestId('stickers-preview-rest').querySelectorAll('canvas')).toHaveLength(194)
    expect(screen.getByTestId('stickers-preview-capped').textContent).toBe('The first 200 of 500 are drawn. The rest print the same way.')
  })

  it('a run with no names draws one sticker with its code larger in the name’s place, and no Show all', () => {
    localStorage.setItem('pt.stickers.previewOpen', '1')
    render(<StickerPreviewFold count={200} copies={1} width={24} />)
    expect(screen.getByTestId('stickers-preview-head').textContent).toBe('1 sticker of 200.')
    // the strip is named by its code, as the tape will read it
    expect(stripNames()).toEqual(['The strip for XXXX-XXXX', 'The strip for TEST'])
    expect(screen.getByTestId('stickers-preview-more').textContent).toBe('and 199 more, each with its own link')
    expect(screen.queryByTestId('stickers-preview-show-all')).toBeNull()
    expect(screen.getByTestId('stickers-preview-code-words').textContent).toBe('Each sticker gets its own link when it prints. XXXX-XXXX stands in for it here.')
    expect(screen.getByTestId('stickers-preview').textContent).not.toMatch(/\b0\d{3}\b/)
  })

  it('with no count it says what fills it', () => {
    localStorage.setItem('pt.stickers.previewOpen', '1')
    render(<StickerPreviewFold count={0} copies={1} width={24} />)
    expect(screen.getByTestId('stickers-preview-empty').textContent).toBe('Pick how many, and the strips are drawn here.')
    expect(stripNames()).toEqual(['The strip for TEST'])
  })
})
