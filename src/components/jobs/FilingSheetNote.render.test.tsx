// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { FilingSheetNote } from './FilingSheetNote'
import { FILING_SHEET_WIDTH_PX } from '../../lib/jobsDocuments/lienFilingDocuments'

// jsdom lays nothing out, so the frame's document is stood in for: a paper this tall, its closing run from here to there.
function layOut(frame: HTMLIFrameElement, paperPx: number, run: { top: number; bottom: number }) {
  const rect = (top: number, bottom: number) => ({ top, bottom, height: bottom - top })
  Object.defineProperty(frame, 'contentDocument', {
    configurable: true,
    value: { querySelector: () => ({ getBoundingClientRect: () => rect(0, paperPx), querySelectorAll: () => [{ getBoundingClientRect: () => rect(run.top, run.bottom) }] }) },
  })
  fireEvent.load(frame)
}

describe('FilingSheetNote (punch list #305, v2.6896)', () => {
  it('lays the paper out in a frame nobody sees, as wide as a Letter sheet, and says nothing until it is read', () => {
    const { container } = render(<FilingSheetNote sheetHtml="<p>paper</p>" />)
    const frame = container.querySelector('iframe[data-filing-sheet-measure]') as HTMLIFrameElement
    expect(frame.getAttribute('srcdoc')).toBe('<p>paper</p>')
    expect(frame.style.width).toBe(`${FILING_SHEET_WIDTH_PX}px`)
    expect(frame.style.visibility).toBe('hidden')
    expect(frame.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('[data-filing-sheet-note]')).toBeNull()
  })

  it('a paper whose closing crosses the foot of page 1 says it moved to page 2 whole', () => {
    const { container } = render(<FilingSheetNote sheetHtml="<p>paper</p>" />)
    layOut(container.querySelector('iframe') as HTMLIFrameElement, 995, { top: 561, bottom: 995 })
    expect(container.querySelector('[data-filing-sheet-note]')?.textContent).toBe('This paper prints on 2 pages. The last statement, the signature and the notary’s block moved to page 2 together, so none of it is cut.')
  })

  it('a paper on one sheet says nothing, and a new paper clears the old one’s line', () => {
    const { container, rerender } = render(<FilingSheetNote sheetHtml="<p>long</p>" />)
    layOut(container.querySelector('iframe') as HTMLIFrameElement, 995, { top: 561, bottom: 995 })
    expect(container.querySelector('[data-filing-sheet-note]')).not.toBeNull()
    rerender(<FilingSheetNote sheetHtml="<p>short</p>" />)
    expect(container.querySelector('[data-filing-sheet-note]')).toBeNull()
    layOut(container.querySelector('iframe') as HTMLIFrameElement, 870, { top: 560, bottom: 870 })
    expect(container.querySelector('[data-filing-sheet-note]')).toBeNull()
  })

  it('no paper, no frame', () => {
    const { container } = render(<FilingSheetNote sheetHtml="" />)
    expect(container.querySelector('iframe')).toBeNull()
  })
})
