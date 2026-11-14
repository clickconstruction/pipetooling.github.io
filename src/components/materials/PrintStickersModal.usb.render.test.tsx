// @vitest-environment jsdom
/**
 * Render smoke for Print blank stickers straight to the P-touch over USB (punch list #329, PR 2, v2.7272): the press
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
}))
vi.mock('../../lib/materials/ptouchUsb', () => {
  class PtouchPickCancelled extends Error {}
  return {
    PtouchPickCancelled,
    ptouchUsbAvailable: () => true,
    connectPtouch: async ({ ask }: { ask: boolean }) => {
      if (!ask && !usb.granted) return null
      return { model: 'PT-D610BT', status: usb.status as PtouchStatus, print: usb.print, close: usb.close }
    },
  }
})
vi.mock('../../lib/materials/tapeStripCanvas', () => ({
  drawTapeStrip: () => ({ width: 300, height: 128, lines: [new Uint8Array(16), new Uint8Array(16)] }),
}))
vi.mock('../../lib/materials/stickerRunsIo', () => ({
  mintStickerRun: vi.fn(),
  fetchLastStickerNumber: vi.fn(async () => 100),
  fetchStickerRuns: vi.fn(async () => []),
}))

import PrintStickersModal from './PrintStickersModal'

function mintedRun(request: StickerRunRequest): MintedRun {
  const stickers = Array.from({ length: request.count }, (_, i) => ({ id: `s-${101 + i}`, number: 101 + i, code: `4F2A9C${String(i).padStart(2, '0')}` }))
  return { run: { id: 'run-1', jobId: request.jobId, count: request.count, firstNumber: 101, lastNumber: 100 + request.count, copies: request.copies, printedByName: 'Dana', printedAt: '2026-11-14T16:00:00Z' }, stickers }
}

function setup() {
  const print = vi.fn()
  const mint = vi.fn(async (r: StickerRunRequest) => mintedRun(r))
  renderWithProviders(<PrintStickersModal jobId="job-juniper" jobLabel="JP1204 · Juniper Ridge" role="dev" onClose={() => {}} mint={mint} lastNumber={async () => 100} print={print} />)
  return { print, mint }
}

beforeEach(() => {
  usb.granted = false
  usb.status = { tapeMm: 24, statusType: 0, phase: 0, errors: [] }
  usb.print.mockReset()
  usb.print.mockImplementation(async (labels: unknown[], onLabel?: (n: number) => void) => { labels.forEach((_, i) => onLabel?.(i + 1)) })
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

  it('connected, the press mints the run and the strips go as soon as they are drawn, a set together', async () => {
    usb.granted = true
    const { print, mint } = setup()
    await waitFor(() => expect(screen.getByTestId('stickers-printer-line').textContent).toContain('PT-D610BT · 24 mm tape · ready'))
    fireEvent.click(screen.getByRole('button', { name: '30' }))
    fireEvent.click(screen.getByTestId('stickers-copies-more'))
    expect(screen.getByTestId('stickers-print').textContent).toBe('Print 30 sets')
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
    await waitFor(() => expect(screen.getByTestId('stickers-print').textContent).toBe('Print the rest, 0102 to 0130'))
    expect(screen.getByTestId('stickers-count-words').textContent).toBe('29 of 0101 to 0130, 2 strips each. 58 strips.')
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
})
