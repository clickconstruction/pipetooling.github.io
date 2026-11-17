// @vitest-environment jsdom
/**
 * One scan of a whole stack in Add the stamped scans (punch list #366): a PDF of several pages is one file for one
 * lien until the office says it holds several; then each page goes to a lien, in order to start with, and each
 * lien's pages are cut into a PDF of their own when the press saves.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { LienScanTarget } from '../../lib/jobs/lienScanBatch'
import type { LienScanSave } from '../../lib/jobs/lienScanBatchIo'
import LienScanBatchWindow from './LienScanBatchWindow'

// The page pictures need a real PDF reader and a canvas: the test draws a mark in their place.
vi.mock('../contracts/formStudio/PdfPageCanvas', () => ({ PdfPageCanvas: ({ page }: { page: number }) => <span data-thumb={page} /> }))

afterEach(() => cleanup())

// Every name and number here is made up.
const target = (jobNumber: string, over: Partial<LienScanTarget> = {}): LienScanTarget => ({ filingId: `f-${jobNumber}`, jobId: `job-${jobNumber}`, jobNumber, jobLabel: `${jobNumber} · Sample Job`, recordingNumber: `2026-00${jobNumber}`, filedYmd: '2026-11-13', county: 'Hays', hasScan: false, ...over })
const TARGETS = [target('2104'), target('2291'), target('2317')]
const pdf = (name: string, bytes = 4096) => new File([new Uint8Array(bytes)], name, { type: 'application/pdf' })

type Cut = { pages: number[]; name: string }

function open(pages: number, over: Partial<Parameters<typeof LienScanBatchWindow>[0]> = {}) {
  const cuts: Cut[] = []
  const props = {
    targets: TARGETS,
    onChanged: vi.fn(),
    onClose: vi.fn(),
    countPages: vi.fn(async (f: Blob) => ((f as File).name.startsWith('stack') ? pages : 1)),
    cut: vi.fn(async (_stack: Blob, p: ReadonlyArray<number>, name: string) => {
      cuts.push({ pages: [...p], name })
      return pdf(`${name}.pdf`, 1024)
    }),
    // The real writer resolves a cut piece before it uploads it; so does this one.
    save: vi.fn(async (saves: ReadonlyArray<LienScanSave>) => {
      for (const s of saves) if (typeof s.file === 'function') await s.file()
      return { done: [...saves], failed: [] as Array<{ save: LienScanSave; reason: string }> }
    }),
    ...over,
  }
  renderWithProviders(<LienScanBatchWindow {...props} />)
  return { props, cuts }
}
const pick = (...files: File[]) => fireEvent.change(screen.getByLabelText('Choose the scans'), { target: { files } })
const pageTile = (n: number) => within(document.querySelector(`[data-lien-scan-page="${n}"]`) as HTMLElement)
const lienOn = (n: number) => document.querySelector(`[data-lien-scan-page="${n}"] [data-lien-scan-page-lien]`)?.textContent ?? null
const choose = (n: number, value: string) => fireEvent.change(pageTile(n).getByRole('combobox'), { target: { value } })
const saveBtn = () => document.querySelector('[data-lien-scan-save]') as HTMLButtonElement
const splitIt = async () => fireEvent.click(await screen.findByRole('button', { name: 'It holds several liens: split it ›' }))

describe('LienScanBatchWindow · one scan of a stack', () => {
  it('a PDF of several pages stays one file for one lien until the office says it holds several', async () => {
    open(3)
    pick(pdf('stack.pdf'))
    expect(await screen.findByText('This file has 3 pages.')).toBeTruthy()
    // Until then it is matched and saved whole, as any file is.
    expect(saveBtn().textContent).toBe('Save 1 scan')
    expect(document.querySelector('[data-lien-scan-stack]')).toBeNull()
  })

  it('split, each page goes to the next lien in order, with the number to read against the stamp', async () => {
    open(3)
    pick(pdf('stack.pdf'))
    await splitIt()
    expect(document.querySelector('[data-lien-scan-stack-head]')!.textContent).toBe('stack.pdf · 3 pages · 3 liens')
    expect([lienOn(1), lienOn(2), lienOn(3)]).toEqual(['2104 · Sample Jobno. 2026-002104', '2291 · Sample Jobno. 2026-002291', '2317 · Sample Jobno. 2026-002317'])
    await waitFor(() => expect(document.querySelector('[data-thumb="2"]')).toBeTruthy())
    expect(saveBtn().textContent).toBe('Save 3 scans')
  })

  it('a page that is not an affidavit moves the pages after it up, and a second sheet joins the lien before it', async () => {
    open(5)
    pick(pdf('stack.pdf'))
    await splitIt()
    // Five pages, three liens: the last two have no lien left.
    expect(pageTile(4).getByText('No lien is left for this page. Pick one, or mark it as not an affidavit.')).toBeTruthy()
    expect(saveBtn().textContent).toBe('Save 3 scans · 2 held ▸')
    // Page 2 is the clerk's receipt, and page 4 is the second sheet of the lien on page 3.
    choose(2, '__skip')
    expect(pageTile(2).getByText('Left out. It is saved nowhere.')).toBeTruthy()
    choose(4, '__join')
    expect([lienOn(1), lienOn(3), lienOn(4), lienOn(5)]).toEqual(['2104 · Sample Jobno. 2026-002104', '2291 · Sample Jobno. 2026-002291', '2291 · Sample Jobno. 2026-002291', '2317 · Sample Jobno. 2026-002317'])
    expect(document.querySelector('[data-lien-scan-stack-head]')!.textContent).toBe('stack.pdf · 5 pages · 3 liens · 1 page left out')
    expect(document.querySelector('[data-lien-scan-stack-pieces]')!.textContent).toBe('2104: page 1 · 2291: pages 3 and 4 · 2317: page 5')
    expect(saveBtn().textContent).toBe('Save 3 scans')
  })

  it('saves each lien’s pages as a PDF of its own, on its own job, and never the stack', async () => {
    const { props, cuts } = open(4)
    pick(pdf('stack.pdf'))
    await splitIt()
    choose(2, '__join')
    choose(4, '__skip')
    fireEvent.click(saveBtn())
    await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1))
    const saves = (props.save as ReturnType<typeof vi.fn>).mock.calls[0]![0] as LienScanSave[]
    expect(saves.map((s) => [s.target.jobId, typeof s.file])).toEqual([
      ['job-2104', 'function'],
      ['job-2291', 'function'],
    ])
    expect(cuts).toEqual([
      { pages: [1, 2], name: 'stack.pdf, pages 1 and 2' },
      { pages: [3], name: 'stack.pdf, page 3' },
    ])
    expect(props.onChanged).toHaveBeenCalledTimes(1)
  })

  it('a page sent by hand keeps its lien, and a lien a separate file already has is stepped over', async () => {
    open(2)
    pick(pdf('Job 2104 stamped.pdf'), pdf('stack.pdf'))
    await splitIt()
    // The single file holds 2104, so the stack's pages start at the next lien.
    expect([lienOn(1), lienOn(2)]).toEqual(['2291 · Sample Jobno. 2026-002291', '2317 · Sample Jobno. 2026-002317'])
    choose(1, 'f-2317')
    expect([lienOn(1), lienOn(2)]).toEqual(['2317 · Sample Jobno. 2026-002317', '2291 · Sample Jobno. 2026-002291'])
    // Sent to the lien the single file has: it is held, with the reason on its page.
    choose(1, 'f-2104')
    expect(pageTile(1).getByText('2104 · Sample Job already has a scan above. A lien keeps one.')).toBeTruthy()
  })

  it('after a save where one lien fails, the saved pages say so and the rest keep their liens', async () => {
    const save = vi.fn(async (saves: ReadonlyArray<LienScanSave>) => ({ done: saves.filter((s) => s.target.jobNumber !== '2291'), failed: saves.filter((s) => s.target.jobNumber === '2291').map((s) => ({ save: s, reason: 'the file was not added to the job’s folder' })) }))
    const { props } = open(3, { save })
    pick(pdf('stack.pdf'))
    await splitIt()
    fireEvent.click(saveBtn())
    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1))
    expect(props.onClose).not.toHaveBeenCalled()
    expect(pageTile(1).getByText('Saved')).toBeTruthy()
    expect(pageTile(3).getByText('Saved')).toBeTruthy()
    // Page 2 still goes to the lien it had, by hand now, so nothing slides onto another lien.
    expect(lienOn(2)).toBe('2291 · Sample Jobno. 2026-002291')
    expect((pageTile(2).getByRole('combobox') as HTMLSelectElement).value).toBe('f-2291')
    expect(screen.getByText('2291 · Sample Job was not saved: the file was not added to the job’s folder')).toBeTruthy()
    expect(saveBtn().textContent).toBe('Save 1 scan')
  })

  it('Keep it as one file puts the stack back as a single file with a lien of its own', async () => {
    open(3)
    pick(pdf('stack.pdf'))
    await splitIt()
    fireEvent.click(screen.getByRole('button', { name: 'Keep it as one file' }))
    expect(document.querySelector('[data-lien-scan-stack]')).toBeNull()
    expect((within(document.querySelector('[data-lien-scan-piece="stack.pdf"]') as HTMLElement).getByRole('combobox') as HTMLSelectElement).value).toBe('f-2104')
    expect(saveBtn().textContent).toBe('Save 1 scan')
  })
})
