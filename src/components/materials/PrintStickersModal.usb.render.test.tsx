// @vitest-environment jsdom
/**
 * Render smoke for Print future stickers straight to the P-touch over USB (punch list #329, PR 2, v2.7272): the press
 * is the connection until a printer is connected; the press then mints the run and the strips go as soon as they are
 * drawn, a set together; a printer that stops says how many stickers went and the press becomes Print the rest. The
 * USB side and the canvas are mocked, as the labels window's test mocks them: a test's DOM has neither.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { PtouchStatus } from '../../lib/materials/ptouchRaster'
import type { MintedRun, StickerRunRequest } from '../../lib/materials/stickerRun'

const usb = vi.hoisted(() => ({
  granted: false,
  status: { tapeMm: 24, statusType: 0, phase: 0, errors: [] as string[] },
  print: vi.fn(),
  close: vi.fn(async () => {}),
  refreshed: 0,
  refreshFails: false,
}))
vi.mock('../../lib/materials/ptouchUsb', () => {
  class PtouchPickCancelled extends Error {}
  return {
    PtouchPickCancelled,
    ptouchUsbAvailable: () => true,
    connectPtouch: async ({ ask }: { ask: boolean }) => {
      if (!ask && !usb.granted) return null
      // one link object, as the real one is: a refresh lands the printer's new answer on it
      const link = { model: 'PT-D610BT', status: usb.status as PtouchStatus, print: usb.print, close: usb.close, refresh: async () => { usb.refreshed++; if (usb.refreshFails) throw new Error('gone'); link.status = usb.status as PtouchStatus; return link.status } }
      return link
    },
  }
})
vi.mock('../../lib/materials/tapeStripCanvas', () => ({
  drawTapeStrip: () => ({ width: 300, height: 128, lines: [new Uint8Array(16), new Uint8Array(16)] }),
}))
vi.mock('../../lib/materials/stickerRunsIo', () => ({
  mintStickerRun: vi.fn(),
  fetchStickerRuns: vi.fn(async () => []),
  fetchSiteStickerNames: vi.fn(async () => ({ boxes: [], blankNames: [] })),
  markStickersPrinted: vi.fn(async () => undefined),
}))

import PrintStickersModal from './PrintStickersModal'
import { markStickersPrinted } from '../../lib/materials/stickerRunsIo'

/** The printed mark's write (punch list #373), the io module's own, mocked above. */
const mark = vi.mocked(markStickersPrinted)

function mintedRun(request: StickerRunRequest): MintedRun {
  const stickers = Array.from({ length: request.count }, (_, i) => ({ id: `s-${101 + i}`, number: 101 + i, code: `4F2A9C${String(i).padStart(2, '0')}`, boxName: request.names?.[i] ?? null }))
  return { run: { id: 'run-1', jobId: request.jobId, count: request.count, firstNumber: 101, lastNumber: 100 + request.count, copies: request.copies, printedByName: 'Dana', printedAt: '2026-11-14T16:00:00Z', names: request.names ?? null }, stickers }
}

function setup() {
  const print = vi.fn()
  const mint = vi.fn(async (r: StickerRunRequest) => mintedRun(r))
  renderWithProviders(<PrintStickersModal jobId="job-juniper" jobLabel="JP1204 · Juniper Ridge" role="dev" onClose={() => {}} mint={mint} print={print} />)
  return { print, mint }
}

beforeEach(() => {
  usb.granted = false
  usb.status = { tapeMm: 24, statusType: 0, phase: 0, errors: [] }
  usb.print.mockReset()
  usb.refreshed = 0
  usb.refreshFails = false
  usb.print.mockImplementation(async (labels: unknown[], onLabel?: (n: number) => void) => { labels.forEach((_, i) => onLabel?.(i + 1)) })
  mark.mockReset()
  mark.mockResolvedValue(undefined)
})
afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('PrintStickersModal · straight to the P-touch over USB', () => {
  it('opens on Connect the P-touch, with no print press and no browser note, and the steps name no driver', () => {
    const { mint } = setup()
    expect(screen.getByTestId('stickers-connect').textContent).toBe('Connect the P-touch')
    expect(screen.queryByTestId('stickers-print')).toBeNull()
    expect(screen.queryByTestId('stickers-test-strip')).toBeNull()
    expect(screen.queryByTestId('stickers-no-usb')).toBeNull()
    const steps = screen.getByTestId('stickers-tape-setup').textContent ?? ''
    expect(steps).toContain('Connect the P-touch')
    expect(steps).not.toContain('driver')
    expect(mint).not.toHaveBeenCalled()
  })

  it('a run already made prints as many of each as Copies of each says, and mints nothing (v2.7553)', async () => {
    usb.granted = true
    const minted = mintedRun({ jobId: 'job-juniper', count: 4, copies: 1, names: ['G93', 'G94', 'G95', 'G96'] })
    const mint = vi.fn()
    renderWithProviders(<PrintStickersModal jobId="job-juniper" jobLabel="JP1204 · Juniper Ridge" role="dev" run={{ ...minted, title: 'Reserved stickers, G93 to G96' }} onClose={() => {}} mint={mint} print={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('stickers-printer-line').textContent).toContain('PT-D610BT · 24 mm tape · ready'))
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByTestId('stickers-copies-more'))
    expect(screen.getByTestId('stickers-count-words').textContent).toBe('G93 to G96, 5 strips each. 20 strips.')
    expect(screen.getByTestId('stickers-print').textContent).toBe('Print 4 sets, G93 to G96')
    fireEvent.click(screen.getByTestId('stickers-print'))
    await waitFor(() => expect(screen.getByTestId('stickers-sent').textContent).toBe('4 stickers printed.'))
    // five strips a sticker went to the printer, a sticker's copies together
    expect(usb.print).toHaveBeenCalledTimes(1)
    expect((usb.print.mock.calls[0]![0] as unknown[]).length).toBe(20)
    expect(mint).not.toHaveBeenCalled()
  })

  it('connected, the press mints the run and the strips go as soon as they are drawn, a set together', async () => {
    usb.granted = true
    const { print, mint } = setup()
    await waitFor(() => expect(screen.getByTestId('stickers-printer-line').textContent).toContain('PT-D610BT · 24 mm tape · ready'))
    fireEvent.click(screen.getByRole('button', { name: '30' }))
    fireEvent.click(screen.getByTestId('stickers-copies-more'))
    expect(screen.getByTestId('stickers-print').textContent).toBe('Print 30 sets of future stickers')
    fireEvent.click(screen.getByTestId('stickers-print'))
    await waitFor(() => expect(screen.getByTestId('stickers-sent').textContent).toBe('30 stickers printed.'))
    expect(mint).toHaveBeenCalledWith({ jobId: 'job-juniper', count: 30, copies: 2 })
    expect(usb.print).toHaveBeenCalledTimes(1)
    expect((usb.print.mock.calls[0]![0] as unknown[]).length).toBe(60)
    expect(screen.getAllByTestId('labels-tape-bitmap')).toHaveLength(30)
    // the print window was never asked
    expect(print).not.toHaveBeenCalled()
    expect(localStorage.getItem('pt.labels.tapePrintedYmd')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('a printer that stops says how many stickers went, and the press is the rest once it is connected again', async () => {
    usb.granted = true
    usb.print.mockImplementation(async (_labels: unknown[], onLabel?: (n: number) => void) => { onLabel?.(1); onLabel?.(2); onLabel?.(3); throw new Error('The printer’s cover is open.') })
    setup()
    await waitFor(() => expect(screen.getByTestId('stickers-print')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: '30' }))
    fireEvent.click(screen.getByTestId('stickers-copies-more'))
    fireEvent.click(screen.getByTestId('stickers-print'))
    await waitFor(() => expect(screen.getByTestId('stickers-slip').textContent).toBe('1 of 30 stickers printed, then the printer stopped: The printer’s cover is open. A printed strip may still be inside the printer. Feed and cut the tape on the printer to get it out.'))
    expect(usb.close).toHaveBeenCalled()
    // the printer wants connecting again; the known printer connects by itself, and the press is the rest
    // a run with no names is said by its count (v2.7438: no running number)
    await waitFor(() => expect(screen.getByTestId('stickers-print').textContent).toBe('Print the rest, 29 stickers'))
    expect(screen.getByTestId('stickers-count-words').textContent).toBe('29 of 30 stickers, 2 strips each. 58 strips.')
  })

  it('Stop printing ends the run with one more strip, and the press is the rest (Taunya, 2026-11-15)', async () => {
    usb.granted = true
    let go: () => void = () => {}
    const held = new Promise<void>((r) => { go = r })
    usb.print.mockImplementation(async (labels: unknown[], onLabel?: (n: number) => void, stopAsked?: () => boolean) => {
      onLabel?.(1); onLabel?.(2); onLabel?.(3)
      await held
      // the strip after the stop is the run's last: fed out and cut, and nothing more is sent
      if (stopAsked?.()) { onLabel?.(4); return }
      labels.forEach((_, i) => onLabel?.(i + 1))
    })
    setup()
    await waitFor(() => expect(screen.getByTestId('stickers-print')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: '30' }))
    fireEvent.click(screen.getByTestId('stickers-copies-more'))
    fireEvent.click(screen.getByTestId('stickers-print'))
    // the strip in the hand is named by what it reads: a sticker with no name by its code
    await waitFor(() => expect(screen.getByTestId('stickers-progress').textContent).toBe('Printing 4 of 60 · 4F2A-9C01, strip 2 of 2'))
    // an earlier test's window closed its printer on the way out
    usb.close.mockClear()
    fireEvent.click(screen.getByTestId('stickers-stop'))
    expect(screen.getByTestId('stickers-stop').textContent).toBe('Stopping…')
    expect(screen.getByTestId('stickers-progress').textContent).toBe('Stopping. One more strip prints, so the printer can cut the tape.')
    go()
    await waitFor(() => expect(screen.getByTestId('stickers-sent').textContent).toBe('2 of 30 stickers printed, then you stopped the run.'))
    // the rest is not lost with the window (v2.7523): it is still reserved, and the line says where it prints later
    expect(screen.getByTestId('stickers-rest-kept').textContent).toBe('The 28 stickers left are still reserved. Print them now, or later from the job’s reserved line.')
    // nothing went wrong: the printer stays connected, no red line, and the press is the rest
    expect(usb.close).not.toHaveBeenCalled()
    expect(screen.queryByTestId('stickers-slip')).toBeNull()
    expect(screen.queryByTestId('stickers-stop')).toBeNull()
    expect(screen.getByTestId('stickers-print').textContent).toBe('Print the rest, 28 stickers')
    expect(screen.getByTestId('stickers-range-count').textContent).toBe('28 of 30 stickers')
  })

  it('a range of the run on the page is picked by its two ends, and the press names it (Taunya, 2026-11-15)', async () => {
    usb.granted = true
    setup()
    await waitFor(() => expect(screen.getByTestId('stickers-print')).toBeTruthy())
    // before a run is made there are no stickers to pick from
    expect(screen.queryByTestId('stickers-range')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '30' }))
    fireEvent.click(screen.getByTestId('stickers-print'))
    await waitFor(() => expect(screen.getByTestId('stickers-sent').textContent).toBe('30 stickers printed.'))
    const from = screen.getByTestId('stickers-range-from') as HTMLSelectElement
    const to = screen.getByTestId('stickers-range-to') as HTMLSelectElement
    expect(from.value).toBe('s-101')
    expect(to.value).toBe('s-130')
    // stickers with no name are picked by their codes, as the tape prints them
    expect(Array.from(from.options).slice(0, 3).map((o) => o.textContent)).toEqual(['4F2A-9C00', '4F2A-9C01', '4F2A-9C02'])
    expect(screen.getByTestId('stickers-range-count').textContent).toBe('30 of 30 stickers')
    fireEvent.change(from, { target: { value: 's-103' } })
    fireEvent.change(to, { target: { value: 's-110' } })
    expect(screen.getByTestId('stickers-range-count').textContent).toBe('8 of 30 stickers')
    // a picked range is not the rest of a stopped run, and the press says which stickers it is
    expect(screen.getByTestId('stickers-print').textContent).toBe('Print 8 stickers')
    usb.print.mockClear()
    fireEvent.click(screen.getByTestId('stickers-print'))
    await waitFor(() => expect(screen.getByTestId('stickers-sent').textContent).toBe('8 stickers printed.'))
    expect((usb.print.mock.calls[0]![0] as unknown[]).length).toBe(8)
  })

  it('a new cassette is seen: the foot says why the press is grey, and Check the printer again brings it back (Taunya, 2026-11-15)', async () => {
    usb.granted = true
    usb.status = { tapeMm: 0, statusType: 0, phase: 0, errors: [] }
    setup()
    await waitFor(() => expect(screen.getByTestId('stickers-recheck').textContent).toContain('There is no tape in the printer. Put in the tape and close the cover. The window checks the printer by itself.'))
    expect(screen.getByTestId('stickers-print').hasAttribute('disabled')).toBe(true)
    usb.status = { tapeMm: 24, statusType: 0, phase: 0, errors: [] }
    fireEvent.click(screen.getByTestId('stickers-check-printer'))
    await waitFor(() => expect(screen.getByTestId('stickers-print').hasAttribute('disabled')).toBe(false))
    expect(usb.refreshed).toBe(1)
    expect(screen.queryByTestId('stickers-recheck')).toBeNull()
  })

  it('tape the sticker is not laid out for holds the press and says what to load', async () => {
    usb.granted = true
    usb.status = { tapeMm: 12, statusType: 0, phase: 0, errors: [] }
    const { mint } = setup()
    await waitFor(() => expect(screen.getByTestId('stickers-printer-line').textContent).toContain('load 18 or 24 mm tape'))
    expect(screen.getByTestId('stickers-print').getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(screen.getByTestId('stickers-print'))
    expect(mint).not.toHaveBeenCalled()
  })

  it('a run that names its boxes draws each strip by its name, and the range is picked by name (section 10, v2.7391)', async () => {
    usb.granted = true
    const { mint } = setup()
    await waitFor(() => expect(screen.getByTestId('stickers-print')).toBeTruthy())
    await waitFor(() => expect(screen.queryByTestId('stickers-names-reading')).toBeNull())
    fireEvent.change(screen.getByTestId('stickers-names-input'), { target: { value: 'G78-81' } })
    expect(screen.getByTestId('stickers-print').textContent).toBe('Print 4 future stickers, G78 to G81')
    fireEvent.click(screen.getByTestId('stickers-print'))
    await waitFor(() => expect(screen.getByTestId('stickers-sent').textContent).toBe('4 stickers printed.'))
    expect(mint).toHaveBeenCalledWith({ jobId: 'job-juniper', count: 4, copies: 1, names: ['G78', 'G79', 'G80', 'G81'] })
    expect(screen.getAllByTestId('labels-tape-bitmap').map((c) => c.getAttribute('aria-label'))).toEqual(['The strip for G78', 'The strip for G79', 'The strip for G80', 'The strip for G81'])
    const from = screen.getByTestId('stickers-range-from') as HTMLSelectElement
    expect(Array.from(from.options).map((o) => o.textContent)).toEqual(['G78', 'G79', 'G80', 'G81'])
    fireEvent.change(from, { target: { value: 's-102' } })
    fireEvent.change(screen.getByTestId('stickers-range-to'), { target: { value: 's-103' } })
    expect(screen.getByTestId('stickers-print').textContent).toBe('Print 2 stickers, G79 to G80')
  })

  describe('the printed mark (punch list #373)', () => {
    const ids = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => `s-${from + i}`)

    it('a run that prints whole marks every sticker, tells the page, and offers no take-back', async () => {
      usb.granted = true
      const onPrinted = vi.fn()
      renderWithProviders(<PrintStickersModal jobId="job-juniper" jobLabel="JP1204 · Juniper Ridge" role="dev" onClose={() => {}} mint={async (r) => mintedRun(r)} print={() => {}} onPrinted={onPrinted} />)
      await waitFor(() => expect(screen.getByTestId('stickers-printer-line').textContent).toContain('ready'))
      fireEvent.click(screen.getByRole('button', { name: '30' }))
      fireEvent.click(screen.getByTestId('stickers-copies-more'))
      fireEvent.click(screen.getByTestId('stickers-print'))
      await waitFor(() => expect(screen.getByTestId('stickers-sent').textContent).toBe('30 stickers printed.'))
      await waitFor(() => expect(onPrinted).toHaveBeenCalledTimes(1))
      expect(mark).toHaveBeenCalledTimes(1)
      expect(mark.mock.calls[0]![0]).toEqual(ids(101, 130))
      expect(mark.mock.calls[0]![1]).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      // over USB the app knows what went: no line asking whether they printed
      expect(screen.queryByTestId('stickers-marked')).toBeNull()
      expect(screen.queryByTestId('stickers-mark-slip')).toBeNull()
    })

    it('a run of 30 stopped after 2 marks 2: only the stickers whose every copy came out', async () => {
      usb.granted = true
      let go: () => void = () => {}
      const held = new Promise<void>((r) => { go = r })
      usb.print.mockImplementation(async (_labels: unknown[], onLabel?: (n: number) => void, stopAsked?: () => boolean) => {
        onLabel?.(1); onLabel?.(2); onLabel?.(3)
        await held
        if (stopAsked?.()) { onLabel?.(4); return }
      })
      setup()
      await waitFor(() => expect(screen.getByTestId('stickers-print')).toBeTruthy())
      fireEvent.click(screen.getByRole('button', { name: '30' }))
      fireEvent.click(screen.getByTestId('stickers-copies-more'))
      fireEvent.click(screen.getByTestId('stickers-print'))
      await waitFor(() => expect(screen.getByTestId('stickers-stop')).toBeTruthy())
      // nothing is marked while the run is still going
      expect(mark).not.toHaveBeenCalled()
      fireEvent.click(screen.getByTestId('stickers-stop'))
      go()
      await waitFor(() => expect(screen.getByTestId('stickers-sent').textContent).toBe('2 of 30 stickers printed, then you stopped the run.'))
      await waitFor(() => expect(mark).toHaveBeenCalledTimes(1))
      expect(mark.mock.calls[0]![0]).toEqual(['s-101', 's-102'])
    })

    it('a printer that fails marks what went whole: three strips of two each is one sticker', async () => {
      usb.granted = true
      usb.print.mockImplementation(async (_labels: unknown[], onLabel?: (n: number) => void) => { onLabel?.(1); onLabel?.(2); onLabel?.(3); throw new Error('The printer’s cover is open.') })
      setup()
      await waitFor(() => expect(screen.getByTestId('stickers-print')).toBeTruthy())
      fireEvent.click(screen.getByRole('button', { name: '30' }))
      fireEvent.click(screen.getByTestId('stickers-copies-more'))
      fireEvent.click(screen.getByTestId('stickers-print'))
      await waitFor(() => expect(screen.getByTestId('stickers-slip').textContent).toContain('1 of 30 stickers printed, then the printer stopped'))
      await waitFor(() => expect(mark).toHaveBeenCalledTimes(1))
      expect(mark.mock.calls[0]![0]).toEqual(['s-101'])
    })

    it('a printer that fails before a sticker is whole marks nothing', async () => {
      usb.granted = true
      usb.print.mockImplementation(async (_labels: unknown[], onLabel?: (n: number) => void) => { onLabel?.(1); throw new Error('The printer’s cover is open.') })
      setup()
      await waitFor(() => expect(screen.getByTestId('stickers-print')).toBeTruthy())
      fireEvent.click(screen.getByRole('button', { name: '30' }))
      fireEvent.click(screen.getByTestId('stickers-copies-more'))
      fireEvent.click(screen.getByTestId('stickers-print'))
      await waitFor(() => expect(screen.getByTestId('stickers-slip').textContent).toContain('0 of 30 stickers printed'))
      expect(mark).not.toHaveBeenCalled()
    })

    it('a mark the database refuses says why in a quiet line, and what printed still stands', async () => {
      usb.granted = true
      mark.mockRejectedValue({ message: 'Read-only (training) mode: changes are blocked.', code: 'P0001' })
      const onPrinted = vi.fn()
      renderWithProviders(<PrintStickersModal jobId="job-juniper" jobLabel="JP1204 · Juniper Ridge" role="dev" onClose={() => {}} mint={async (r) => mintedRun(r)} print={() => {}} onPrinted={onPrinted} />)
      await waitFor(() => expect(screen.getByTestId('stickers-printer-line').textContent).toContain('ready'))
      fireEvent.click(screen.getByRole('button', { name: '30' }))
      fireEvent.click(screen.getByTestId('stickers-print'))
      await waitFor(() => expect(screen.getByTestId('stickers-mark-slip').textContent).toBe('The app did not record that these printed: Read-only (training) mode: changes are blocked.'))
      expect(screen.getByTestId('stickers-sent').textContent).toBe('30 stickers printed.')
      // a quiet line, never the red one: nothing went wrong with the print
      expect(screen.getByTestId('stickers-mark-slip').getAttribute('role')).toBe('status')
      expect(screen.queryByTestId('stickers-slip')).toBeNull()
      expect(onPrinted).not.toHaveBeenCalled()
    })

    it('the test strip marks nothing', async () => {
      usb.granted = true
      setup()
      await waitFor(() => expect(screen.getByTestId('stickers-test-strip')).toBeTruthy())
      await waitFor(() => expect(screen.getByTestId('stickers-printer-line').textContent).toContain('ready'))
      fireEvent.click(screen.getByTestId('stickers-test-strip'))
      await waitFor(() => expect(usb.print).toHaveBeenCalledTimes(1))
      await waitFor(() => expect(screen.queryByTestId('stickers-progress')).toBeNull())
      expect(mark).not.toHaveBeenCalled()
    })

    it('a run opened on the stickers that have not printed yet marks those, and does not call the print “again”', async () => {
      usb.granted = true
      const minted = mintedRun({ jobId: 'job-juniper', count: 4, copies: 1, names: ['G93', 'G94', 'G95', 'G96'] })
      const stickers = minted.stickers.map((s, i) => (i < 2 ? { ...s, printedAt: '2026-11-17T15:05:00Z' } : s))
      renderWithProviders(<PrintStickersModal jobId="job-juniper" jobLabel="JP1204 · Juniper Ridge" role="dev" run={{ run: minted.run, stickers, printing: stickers.slice(2), title: 'Not printed yet, G95 to G96', first: true }} onClose={() => {}} mint={vi.fn()} print={() => {}} />)
      await waitFor(() => expect(screen.getByTestId('stickers-printer-line').textContent).toContain('ready'))
      expect(screen.getByTestId('stickers-again-words').textContent).toBe('Printing them reserves nothing new. Each sticker keeps the link it has.')
      expect(screen.getByTestId('stickers-print').textContent).toBe('Print 2 stickers, G95 to G96')
      fireEvent.click(screen.getByTestId('stickers-print'))
      await waitFor(() => expect(screen.getByTestId('stickers-sent').textContent).toBe('2 stickers printed.'))
      await waitFor(() => expect(mark).toHaveBeenCalledTimes(1))
      expect(mark.mock.calls[0]![0]).toEqual(['s-103', 's-104'])
    })
  })
})
