// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render } from '@testing-library/react'
import { LienAffidavitSheetFlags } from './LienAffidavitSheetFlags'

const MOVED = 'This paper prints on 2 pages. The last statement, the signature and the notary’s block moved to page 2 together, so none of it is cut.'
const papers = [{ jobId: 'j650', sheetHtml: '<p>650</p>' }, { jobId: 'j651', sheetHtml: '<p>651</p>' }, { jobId: 'j652', sheetHtml: '<p>652</p>' }]
const labelFor = (jobId: string) => `J${jobId.slice(1)} · Sample job`

const frameOf = (c: HTMLElement) => c.querySelector('iframe[data-filing-sheet-measure]') as HTMLIFrameElement | null
const flagsOf = (c: HTMLElement) => c.querySelector('[data-lien-affidavit-print-all-sheets]') as HTMLElement | null

// jsdom lays nothing out, so the frame's document is stood in for: a paper this tall, its closing run from here to there.
function layOut(frame: HTMLIFrameElement, paperPx: number, run: { top: number; bottom: number }) {
  const rect = (top: number, bottom: number) => ({ top, bottom, height: bottom - top })
  Object.defineProperty(frame, 'contentDocument', {
    configurable: true,
    value: { querySelector: () => ({ getBoundingClientRect: () => rect(0, paperPx), querySelectorAll: () => [{ getBoundingClientRect: () => rect(run.top, run.bottom) }] }) },
  })
  fireEvent.load(frame)
}
const oneSheet = (frame: HTMLIFrameElement) => layOut(frame, 870, { top: 560, bottom: 870 })
const twoSheets = (frame: HTMLIFrameElement) => layOut(frame, 995, { top: 561, bottom: 995 })

describe('LienAffidavitSheetFlags (punch list #305, v2.6930)', () => {
  it('lays the papers out one at a time and names the one that takes a second sheet, by its job', () => {
    const onOpen = vi.fn()
    const { container } = render(<LienAffidavitSheetFlags papers={papers} labelFor={labelFor} onOpen={onOpen} />)
    // One hidden frame, on the first paper; nothing is said before a paper is read.
    expect(container.querySelectorAll('iframe')).toHaveLength(1)
    expect(frameOf(container)!.getAttribute('srcdoc')).toBe('<p>650</p>')
    expect(flagsOf(container)).toBeNull()
    oneSheet(frameOf(container)!)
    expect(frameOf(container)!.getAttribute('srcdoc')).toBe('<p>651</p>')
    expect(flagsOf(container)).toBeNull()
    twoSheets(frameOf(container)!)
    // The second paper is named at once, while the third is still to read.
    expect(frameOf(container)!.getAttribute('srcdoc')).toBe('<p>652</p>')
    expect(flagsOf(container)!.querySelector('strong')!.textContent).toBe('1 paper in this print takes a second sheet. Keep its sheets together for the notary, or print it alone from its own Lien window.')
    oneSheet(frameOf(container)!)
    // Every paper read: the frame is gone and the line stays.
    expect(frameOf(container)).toBeNull()
    const rows = flagsOf(container)!.querySelectorAll('[data-lien-affidavit-print-all-sheet]')
    expect(Array.from(rows, (r) => [r.getAttribute('data-lien-affidavit-print-all-sheet'), r.textContent])).toEqual([['j651', `J651 · Sample job · ${MOVED}`]])
    expect(flagsOf(container)!.getAttribute('role')).toBe('status')
    // The job's name opens its paper.
    fireEvent.click(rows[0]!.querySelector('button')!)
    expect(onOpen).toHaveBeenCalledWith('j651')
  })

  it('says nothing when every paper fits one sheet', () => {
    const { container } = render(<LienAffidavitSheetFlags papers={papers.slice(0, 2)} labelFor={labelFor} onOpen={() => {}} />)
    oneSheet(frameOf(container)!)
    oneSheet(frameOf(container)!)
    expect(frameOf(container)).toBeNull()
    expect(flagsOf(container)).toBeNull()
  })

  it('waits for a paper’s fonts before it moves on: the signature’s face can change where the closing lands', async () => {
    const { container } = render(<LienAffidavitSheetFlags papers={papers.slice(0, 2)} labelFor={labelFor} onOpen={() => {}} />)
    const frame = frameOf(container)!
    let tall = false
    let fontsIn: () => void = () => {}
    const rect = (top: number, bottom: number) => ({ top, bottom, height: bottom - top })
    Object.defineProperty(frame, 'contentDocument', {
      configurable: true,
      value: {
        fonts: { ready: new Promise<void>((resolve) => { fontsIn = resolve }) },
        querySelector: () => ({ getBoundingClientRect: () => rect(0, tall ? 995 : 870), querySelectorAll: () => [{ getBoundingClientRect: () => (tall ? rect(561, 995) : rect(560, 870)) }] }),
      },
    })
    fireEvent.load(frame)
    // Read once on load, but not settled: the frame stays on this paper.
    expect(frameOf(container)!.getAttribute('srcdoc')).toBe('<p>650</p>')
    expect(flagsOf(container)).toBeNull()
    tall = true
    await act(async () => fontsIn())
    // Read again with the fonts in, and that read is the one kept. (jsdom then loads the next frame by itself, with no layout.)
    expect(flagsOf(container)!.textContent).toContain(`J650 · Sample job · ${MOVED}`)
    expect(frameOf(container)?.getAttribute('srcdoc')).not.toBe('<p>650</p>')
  })

  it('a paper that left the print is no longer named, and one whose words changed is read again', () => {
    const { container, rerender } = render(<LienAffidavitSheetFlags papers={papers.slice(0, 1)} labelFor={labelFor} onOpen={() => {}} />)
    twoSheets(frameOf(container)!)
    expect(flagsOf(container)).not.toBeNull()
    rerender(<LienAffidavitSheetFlags papers={[{ jobId: 'j650', sheetHtml: '<p>650, shorter</p>' }]} labelFor={labelFor} onOpen={() => {}} />)
    expect(flagsOf(container)).toBeNull()
    expect(frameOf(container)!.getAttribute('srcdoc')).toBe('<p>650, shorter</p>')
    oneSheet(frameOf(container)!)
    expect(flagsOf(container)).toBeNull()
    rerender(<LienAffidavitSheetFlags papers={[]} labelFor={labelFor} onOpen={() => {}} />)
    expect(frameOf(container)).toBeNull()
    expect(flagsOf(container)).toBeNull()
  })
})
