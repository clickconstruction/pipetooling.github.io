// @vitest-environment jsdom
/**
 * Render smoke for tape printed straight to the P-touch over USB (punch list #304, v2.6865): the press is the
 * connection until a printer is connected; the printer's line says what tape is in it; the strips go one at a time
 * with the count said; a printer that stops says how many went and why; and the print window stays one press away.
 * The USB side and the canvas are mocked: a test's DOM has neither.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { Container, ContainerLine } from '../../lib/materials/onSite'
import type { PtouchStatus } from '../../lib/materials/ptouchRaster'

const usb = vi.hoisted(() => ({
  granted: false,
  status: { tapeMm: 24, statusType: 0, phase: 0, errors: [] as string[] },
  print: vi.fn(),
  close: vi.fn(async () => {}),
  asked: [] as boolean[],
}))
vi.mock('../../lib/materials/ptouchUsb', () => {
  class PtouchPickCancelled extends Error {}
  return {
    PtouchPickCancelled,
    ptouchUsbAvailable: () => true,
    connectPtouch: async ({ ask }: { ask: boolean }) => {
      usb.asked.push(ask)
      if (!ask && !usb.granted) return null
      return { model: 'PT-D610BT', status: usb.status as PtouchStatus, print: usb.print, close: usb.close }
    },
  }
})
vi.mock('../../lib/materials/tapeStripCanvas', () => ({
  drawTapeStrip: () => ({ width: 300, height: 128, lines: [new Uint8Array(16), new Uint8Array(16)] }),
}))

import LabelsPrintModal from './LabelsPrintModal'

const A1 = '7d759246-8476-4a37-884f-ed1562d5663f'
const B3 = '4f2a9c18-0000-4000-8000-000000000003'
const container = (id: string, label: string): Container => ({ id, jobId: 'j1', label, kind: 'cage', where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-11-01T00:00:00Z' })
const containers = [container(A1, 'A1'), container(B3, 'B3')]
const lines: ContainerLine[] = []

function setup() {
  const print = vi.fn()
  renderWithProviders(<LabelsPrintModal jobLabel="Oak Hollow Apartments Building C" containers={containers} lines={lines} places={[]} only={null} onClose={() => {}} print={print} />)
  return { print }
}

beforeEach(() => {
  localStorage.setItem('pt.labels.format', 'tape')
  usb.granted = false
  usb.status = { tapeMm: 24, statusType: 0, phase: 0, errors: [] }
  usb.asked = []
  usb.print.mockReset()
  usb.print.mockImplementation(async (labels: unknown[], onLabel?: (n: number) => void) => { labels.forEach((_, i) => onLabel?.(i + 1)) })
})
afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('LabelsPrintModal · straight to the P-touch over USB', () => {
  it('opens on Connect the P-touch with the strips drawn at the printer’s dots, and the steps name no driver', async () => {
    setup()
    expect(screen.getByTestId('labels-connect').textContent).toBe('Connect the P-touch')
    expect(screen.queryByTestId('labels-print')).toBeNull()
    expect(screen.queryByTestId('labels-test-strip')).toBeNull()
    expect(screen.getAllByTestId('labels-tape-bitmap')).toHaveLength(2)
    expect(screen.queryAllByTestId('labels-tape')).toHaveLength(0)
    const steps = screen.getByTestId('labels-tape-setup').textContent ?? ''
    expect(steps).toContain('Quit Brother’s P-touch Editor')
    expect(steps).toContain('Connect the P-touch')
    expect(steps).not.toContain('driver')
    // a browser that reaches the printer is told nothing about browsers
    expect(screen.queryByTestId('labels-no-usb')).toBeNull()
    expect(screen.queryByTestId('labels-needs-browser')).toBeNull()
    await waitFor(() => expect(usb.asked).toEqual([false]))
  })

  it('the press connects, the line says the tape, and the run prints every ticked box and says so', async () => {
    setup()
    fireEvent.click(screen.getByTestId('labels-connect'))
    await waitFor(() => expect(screen.getByTestId('labels-printer-line').textContent).toContain('PT-D610BT · 24 mm tape · ready'))
    expect(usb.asked).toContain(true)
    expect(screen.getByTestId('labels-print').textContent).toBe('Print 2 tape labels')
    // the printer decides the tape, so the width is not asked
    expect(screen.queryByRole('group', { name: 'Tape width' })).toBeNull()
    fireEvent.click(screen.getByTestId('labels-print'))
    await waitFor(() => expect(screen.getByTestId('labels-usb-sent').textContent).toBe('2 tape labels printed.'))
    expect(usb.print).toHaveBeenCalledTimes(1)
    expect((usb.print.mock.calls[0]![0] as unknown[]).length).toBe(2)
    expect(localStorage.getItem('pt.labels.tapePrintedYmd')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('a printer the browser already knows connects by itself, and the test strip sends the first box alone', async () => {
    usb.granted = true
    setup()
    await waitFor(() => expect(screen.getByTestId('labels-print')).toBeTruthy())
    expect(screen.queryByTestId('labels-connect')).toBeNull()
    fireEvent.click(screen.getByTestId('labels-test-strip'))
    await waitFor(() => expect(screen.getByTestId('labels-usb-sent').textContent).toBe('1 tape label printed.'))
    expect((usb.print.mock.calls[0]![0] as unknown[]).length).toBe(1)
  })

  it('a printer that stops says how many went and why, and the press is Connect again', async () => {
    usb.granted = true
    usb.print.mockImplementation(async (_labels: unknown[], onLabel?: (n: number) => void) => { onLabel?.(1); throw new Error('The printer’s cover is open.') })
    setup()
    fireEvent.click(await screen.findByTestId('labels-print'))
    await waitFor(() => expect(screen.getByTestId('labels-usb-slip').textContent).toBe('1 of 2 printed, then the printer stopped: The printer’s cover is open. A printed strip may still be inside the printer. Feed and cut the tape on the printer to get it out.'))
    expect(usb.close).toHaveBeenCalled()
  })

  it('tape the label is not laid out for holds the press and says what to load', async () => {
    usb.granted = true
    usb.status = { tapeMm: 12, statusType: 0, phase: 0, errors: [] }
    setup()
    await waitFor(() => expect(screen.getByTestId('labels-printer-line').textContent).toContain('load 18 or 24 mm tape'))
    expect(screen.getByTestId('labels-print').hasAttribute('disabled')).toBe(true)
  })

  it('the print window stays one press away, with the strips the window prints', async () => {
    const { print } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Use the print window instead' }))
    expect(screen.getAllByTestId('labels-tape')).toHaveLength(2)
    expect(screen.queryAllByTestId('labels-tape-bitmap')).toHaveLength(0)
    expect(screen.getByTestId('labels-tape-setup').textContent).toContain('Brother makes no driver for a Mac')
    fireEvent.click(screen.getByTestId('labels-print'))
    expect(print).toHaveBeenCalledTimes(1)
    expect(usb.print).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Print straight to the P-touch' })).toBeTruthy()
  })

  it('copies of each sends a box’s strips together, 1 1 2 2, and the press names the total (v2.6878)', async () => {
    usb.granted = true
    setup()
    await waitFor(() => expect(screen.getByTestId('labels-print').textContent).toBe('Print 2 tape labels'))
    expect(screen.getByTestId('labels-copies').textContent).toBe('1')
    fireEvent.click(screen.getByTestId('labels-copies-more'))
    expect(screen.getByTestId('labels-copies').textContent).toBe('2')
    expect(screen.getByTestId('labels-print').textContent).toBe('Print 4 tape labels')
    expect(screen.getByTestId('labels-count-words').textContent).toBe('2 boxes, 2 strips each. 4 strips.')
    // the screen still draws each box once
    expect(screen.getAllByTestId('labels-tape-bitmap')).toHaveLength(2)
    fireEvent.click(screen.getByTestId('labels-print'))
    await waitFor(() => expect(screen.getByTestId('labels-usb-sent').textContent).toBe('4 tape labels printed.'))
    const sent = usb.print.mock.calls[0]![0] as unknown[]
    expect(sent).toHaveLength(4)
    expect(sent[0]).toBe(sent[1])
    expect(sent[2]).toBe(sent[3])
    expect(sent[1]).not.toBe(sent[2])
    // remembered on the device, and the test strip is one strip whatever the count
    expect(localStorage.getItem('pt.labels.tapeCopies')).toBe('2')
    usb.print.mockClear()
    fireEvent.click(screen.getByTestId('labels-test-strip'))
    await waitFor(() => expect(usb.print).toHaveBeenCalledTimes(1))
    expect((usb.print.mock.calls[0]![0] as unknown[]).length).toBe(1)
  })

  it('after a print the window is one line for the printer, with the press at the foot (v2.6878)', async () => {
    usb.granted = true
    setup()
    await waitFor(() => expect(screen.getByTestId('labels-print')).toBeTruthy())
    fireEvent.click(screen.getByTestId('labels-print'))
    await waitFor(() => expect(screen.getByTestId('labels-usb-sent')).toBeTruthy())
    // one line where two said the same thing: the settled bar carries the printer's own words
    expect(screen.getByTestId('labels-tape-ready').textContent).toContain('PT-D610BT · 24 mm tape · ready')
    expect(screen.getAllByTestId('labels-printer-line')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Use the print window instead' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Printer setup' }))
    expect(screen.getByRole('button', { name: 'Use the print window instead' })).toBeTruthy()
    // the press and what it said sit in the foot, after the strips
    const foot = screen.getByTestId('labels-foot')
    expect(foot.contains(screen.getByTestId('labels-print'))).toBe(true)
    expect(foot.contains(screen.getByTestId('labels-usb-sent'))).toBe(true)
    const strips = screen.getAllByTestId('labels-tape-bitmap')
    expect(strips[0]!.compareDocumentPosition(foot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
