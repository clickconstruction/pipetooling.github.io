// @vitest-environment jsdom
/**
 * Render smoke for tape printed straight to the P-touch over USB (punch list #304, v2.6865): the press is the
 * connection until a printer is connected; the printer's line says what tape is in it; the strips go one at a time
 * with the count said; a printer that stops says how many went and why; and the print window stays one press away.
 * The USB side and the canvas are mocked: a test's DOM has neither.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { Container, ContainerLine } from '../../lib/materials/onSite'
import type { PtouchStatus } from '../../lib/materials/ptouchRaster'

const usb = vi.hoisted(() => ({
  granted: false,
  status: { tapeMm: 24, statusType: 0, phase: 0, errors: [] as string[] },
  print: vi.fn(),
  close: vi.fn(async () => {}),
  refreshed: 0,
  refreshFails: false,
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
      // one link object, as the real one is: a refresh lands the printer's new answer on it
      const link = { model: 'PT-D610BT', status: usb.status as PtouchStatus, print: usb.print, close: usb.close, refresh: async () => { usb.refreshed++; if (usb.refreshFails) throw new Error('gone'); link.status = usb.status as PtouchStatus; return link.status } }
      return link
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
  usb.refreshed = 0
  usb.refreshFails = false
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

  it('a run marks the boxes whose label went, the line takes the mark back, and a test strip marks nothing (v2.7519)', async () => {
    usb.granted = true
    const mark = vi.fn()
    renderWithProviders(<LabelsPrintModal jobLabel="Oak Hollow Apartments Building C" containers={containers} lines={lines} places={[]} only={null} onClose={() => {}} print={vi.fn()} mark={mark} />)
    fireEvent.click(await screen.findByTestId('labels-test-strip'))
    await waitFor(() => expect(screen.getByTestId('labels-usb-sent').textContent).toBe('1 tape label printed.'))
    expect(mark).not.toHaveBeenCalled()
    expect(screen.queryByTestId('labels-marked')).toBeNull()
    fireEvent.click(screen.getByTestId('labels-print'))
    await waitFor(() => expect(screen.getByTestId('labels-usb-sent').textContent).toBe('2 tape labels printed.'))
    expect(mark).toHaveBeenCalledTimes(1)
    expect(mark.mock.calls[0]![0]).toEqual([A1, B3])
    expect(mark.mock.calls[0]![1]).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(screen.getByTestId('labels-marked').textContent).toBe('2 boxes are now marked as labelled. Did they not print?Take the mark off 2 boxes')
    fireEvent.click(screen.getByTestId('labels-mark-off'))
    expect(mark).toHaveBeenLastCalledWith([A1, B3], null)
    expect(screen.getByTestId('labels-marked').textContent).toBe('The mark is off 2 boxes.')
  })

  it('a printer that stops part way marks the boxes that came out and no other (v2.7519)', async () => {
    usb.granted = true
    usb.print.mockImplementation(async (_labels: unknown[], onLabel?: (n: number) => void) => { onLabel?.(1); throw new Error('The printer’s cover is open.') })
    const mark = vi.fn()
    renderWithProviders(<LabelsPrintModal jobLabel="Oak Hollow Apartments Building C" containers={containers} lines={lines} places={[]} only={null} onClose={() => {}} print={vi.fn()} mark={mark} />)
    fireEvent.click(await screen.findByTestId('labels-print'))
    await waitFor(() => expect(screen.getByTestId('labels-usb-slip')).toBeTruthy())
    expect(mark).toHaveBeenCalledTimes(1)
    expect(mark.mock.calls[0]![0]).toEqual([A1])
    expect(screen.getByTestId('labels-marked').textContent).toContain('1 box is now marked as labelled.')
  })

  it('a printer that stops says how many went and why, and the press is Connect again', async () => {
    usb.granted = true
    usb.print.mockImplementation(async (_labels: unknown[], onLabel?: (n: number) => void) => { onLabel?.(1); throw new Error('The printer’s cover is open.') })
    setup()
    fireEvent.click(await screen.findByTestId('labels-print'))
    await waitFor(() => expect(screen.getByTestId('labels-usb-slip').textContent).toBe('1 of 2 printed, then the printer stopped: The printer’s cover is open. A printed strip may still be inside the printer. Feed and cut the tape on the printer to get it out.'))
    // what is kept reads on its own line, under the printer's reason
    expect(screen.getByTestId('labels-rest').textContent).toBe('A1 is done and unticked. The press prints the rest.')
    expect(usb.close).toHaveBeenCalled()
    // the box that printed is off the pick, so connecting again and pressing prints the rest, not the run from its start
    const chips = screen.getAllByTestId('labels-pick')
    expect(chips.map((c) => c.getAttribute('aria-pressed'))).toEqual(['false', 'true'])
    await waitFor(() => expect(screen.getByTestId('labels-print').textContent).toBe('Print 1 tape label'))
  })

  it('Stop printing ends the run with one more strip, and the press prints the rest: a box part way gets only its missing strips (Taunya, 2026-11-15)', async () => {
    usb.granted = true
    let go: () => void = () => {}
    const held = new Promise<void>((r) => { go = r })
    const asked: boolean[] = []
    usb.print.mockImplementation(async (labels: unknown[], onLabel?: (n: number) => void, stopAsked?: () => boolean) => {
      asked.push(stopAsked?.() ?? false)
      onLabel?.(1)
      await held
      // the strip after the stop is the run's last: the printer feeds it out and cuts it, and nothing more is sent
      if (stopAsked?.()) { asked.push(true); onLabel?.(2); return }
      labels.forEach((_, i) => onLabel?.(i + 1))
    })
    setup()
    fireEvent.click(await screen.findByTestId('labels-copies-more'))
    fireEvent.click(screen.getByTestId('labels-copies-more'))
    expect(screen.getByTestId('labels-print').textContent).toBe('Print 6 tape labels')
    fireEvent.click(screen.getByTestId('labels-print'))
    // the line names the box in the hand and which of its strips
    await waitFor(() => expect(screen.getByTestId('labels-usb-progress').textContent).toBe('Printing 2 of 6 · A1, strip 2 of 3'))
    // an earlier test's window closed its printer on the way out
    usb.close.mockClear()
    const stop = screen.getByTestId('labels-stop')
    expect(stop.textContent).toBe('Stop printing')
    fireEvent.click(stop)
    expect(screen.getByTestId('labels-stop').textContent).toBe('Stopping…')
    expect((screen.getByTestId('labels-stop') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('labels-usb-progress').textContent).toBe('Stopping. One more strip prints, so the printer can cut the tape.')
    go()
    await waitFor(() => expect(screen.getByTestId('labels-usb-sent').textContent).toBe('2 of 6 printed, then you stopped the run.'))
    expect(screen.getByTestId('labels-rest').textContent).toBe('A1 has 1 of its 3 strips to go. The press prints the rest.')
    expect(asked).toEqual([false, true])
    // nothing went wrong: the printer stays connected, no red line, and the press is the rest
    expect(usb.close).not.toHaveBeenCalled()
    expect(screen.queryByTestId('labels-usb-slip')).toBeNull()
    expect(screen.queryByTestId('labels-stop')).toBeNull()
    // A1 is part way, so it stays ticked with its mark, and the press counts its one missing strip and B3's three
    const chips = screen.getAllByTestId('labels-pick')
    expect(chips.map((c) => c.getAttribute('aria-pressed'))).toEqual(['true', 'true'])
    expect(chips.map((c) => c.getAttribute('data-part'))).toEqual(['true', null])
    expect(chips[0]!.getAttribute('title')).toContain('1 of its 3 strips to go')
    expect(screen.getByTestId('labels-print').textContent).toBe('Print 4 tape labels')
    expect(screen.getByTestId('labels-count-words').textContent).toBe('2 boxes, 4 strips to go.')
    // the next run starts unstopped, sends the four and nothing twice, and the mark is gone
    let sent = 0
    usb.print.mockImplementation(async (labels: unknown[], onLabel?: (n: number) => void, stopAsked?: () => boolean) => { asked.push(stopAsked?.() ?? false); sent = labels.length; labels.forEach((_, i) => onLabel?.(i + 1)) })
    fireEvent.click(screen.getByTestId('labels-print'))
    await waitFor(() => expect(screen.getByTestId('labels-usb-sent').textContent).toBe('4 tape labels printed.'))
    expect(screen.queryByTestId('labels-rest')).toBeNull()
    expect(sent).toBe(4)
    expect(asked).toEqual([false, true, false])
    expect(screen.getAllByTestId('labels-pick').map((c) => c.getAttribute('data-part'))).toEqual([null, null])
    expect(screen.getByTestId('labels-print').textContent).toBe('Print 6 tape labels')
  })

  it('a part-way box is forgotten when the copies change: the box prints whole', async () => {
    usb.granted = true
    usb.print.mockImplementation(async (_labels: unknown[], onLabel?: (n: number) => void) => { onLabel?.(1); throw new Error('The printer’s cover is open.') })
    setup()
    fireEvent.click(await screen.findByTestId('labels-copies-more'))
    fireEvent.click(screen.getByTestId('labels-print'))
    await waitFor(() => expect(screen.getByTestId('labels-rest').textContent).toBe('A1 has 1 of its 2 strips to go. The press prints the rest.'))
    await waitFor(() => expect(screen.getByTestId('labels-print').textContent).toBe('Print 3 tape labels'))
    fireEvent.click(screen.getByTestId('labels-copies-more'))
    expect(screen.getByTestId('labels-print').textContent).toBe('Print 6 tape labels')
  })

  it('one strip has no Stop printing: the test strip is a run of one', async () => {
    usb.granted = true
    let go: () => void = () => {}
    const held = new Promise<void>((r) => { go = r })
    usb.print.mockImplementation(async (_labels: unknown[], onLabel?: (n: number) => void) => { await held; onLabel?.(1) })
    setup()
    fireEvent.click(await screen.findByTestId('labels-test-strip'))
    await waitFor(() => expect(screen.getByTestId('labels-usb-progress').textContent).toBe('Printing 1 of 1…'))
    expect(screen.queryByTestId('labels-stop')).toBeNull()
    go()
    await waitFor(() => expect(screen.getByTestId('labels-usb-sent').textContent).toBe('1 tape label printed.'))
  })

  it('tape the label is not laid out for holds the press and says what to load', async () => {
    usb.granted = true
    usb.status = { tapeMm: 12, statusType: 0, phase: 0, errors: [] }
    setup()
    await waitFor(() => expect(screen.getByTestId('labels-printer-line').textContent).toContain('load 18 or 24 mm tape'))
    expect(screen.getByTestId('labels-print').hasAttribute('disabled')).toBe(true)
  })

  it('a new cassette is seen: the foot says why the press is grey, and Check the printer again brings it back (Taunya, 2026-11-15)', async () => {
    usb.granted = true
    usb.status = { tapeMm: 0, statusType: 0, phase: 0, errors: [] }
    setup()
    await waitFor(() => expect(screen.getByTestId('labels-recheck').textContent).toContain('There is no tape in the printer. Put in the tape and close the cover. The window checks the printer by itself.'))
    expect(screen.getByTestId('labels-print').hasAttribute('disabled')).toBe(true)
    // the cassette goes in
    usb.status = { tapeMm: 24, statusType: 0, phase: 0, errors: [] }
    fireEvent.click(screen.getByTestId('labels-check-printer'))
    await waitFor(() => expect(screen.getByTestId('labels-print').hasAttribute('disabled')).toBe(false))
    expect(usb.refreshed).toBe(1)
    expect(screen.queryByTestId('labels-recheck')).toBeNull()
    expect(screen.getByTestId('labels-printer-line').textContent).toContain('24 mm tape · ready')
  })

  it('the window looks at the printer by itself every few seconds while it cannot print, and stops once it can', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    try {
      usb.granted = true
      usb.status = { tapeMm: 0, statusType: 0, phase: 0, errors: [] }
      setup()
      await waitFor(() => expect(screen.getByTestId('labels-recheck')).toBeTruthy())
      await act(async () => { vi.advanceTimersByTime(3100) })
      expect(usb.refreshed).toBe(1)
      expect(screen.getByTestId('labels-print').hasAttribute('disabled')).toBe(true)
      usb.status = { tapeMm: 24, statusType: 0, phase: 0, errors: [] }
      await act(async () => { vi.advanceTimersByTime(3100) })
      await waitFor(() => expect(screen.getByTestId('labels-print').hasAttribute('disabled')).toBe(false))
      expect(usb.refreshed).toBe(2)
      // ready: nothing more is asked of the printer
      await act(async () => { vi.advanceTimersByTime(10000) })
      expect(usb.refreshed).toBe(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('the tape runs out mid run: a new cassette and one press prints the rest, with no window closed', async () => {
    usb.granted = true
    usb.print.mockImplementation(async (_labels: unknown[], onLabel?: (n: number) => void) => {
      onLabel?.(1)
      // the cassette is empty from here: the printer says so, and says so again when the window reconnects
      usb.status = { tapeMm: 0, statusType: 0, phase: 0, errors: [] }
      throw new Error('There is no tape in the printer.')
    })
    setup()
    fireEvent.click(await screen.findByTestId('labels-copies-more'))
    fireEvent.click(screen.getByTestId('labels-print'))
    await waitFor(() => expect(screen.getByTestId('labels-rest').textContent).toBe('A1 has 1 of its 2 strips to go. The press prints the rest.'))
    // the window reconnected by itself to a printer with no tape: the press is there, grey, and the foot says why
    await waitFor(() => expect(screen.getByTestId('labels-recheck')).toBeTruthy())
    expect(screen.getByTestId('labels-print').hasAttribute('disabled')).toBe(true)
    // and being back on the printer has not wiped how many strips went and why
    expect(screen.getByTestId('labels-usb-slip').textContent).toBe('1 of 4 printed, then the printer stopped: There is no tape in the printer. A printed strip may still be inside the printer. Feed and cut the tape on the printer to get it out.')
    usb.status = { tapeMm: 24, statusType: 0, phase: 0, errors: [] }
    fireEvent.click(screen.getByTestId('labels-check-printer'))
    await waitFor(() => expect(screen.getByTestId('labels-print').hasAttribute('disabled')).toBe(false))
    // the place is kept: A1's one missing strip and B3's two
    expect(screen.getByTestId('labels-print').textContent).toBe('Print 3 tape labels')
    let sent = 0
    usb.print.mockImplementation(async (labels: unknown[], onLabel?: (n: number) => void) => { sent = labels.length; labels.forEach((_, i) => onLabel?.(i + 1)) })
    fireEvent.click(screen.getByTestId('labels-print'))
    await waitFor(() => expect(screen.getByTestId('labels-usb-sent').textContent).toBe('3 tape labels printed.'))
    expect(sent).toBe(3)
    // a run that printed whole keeps nothing for later
    expect(localStorage.getItem('pt.labels.stoppedRun')).toBeNull()
  })

  it('a window closed to change the tape opens on the rest, and Every box starts over', async () => {
    usb.granted = true
    usb.print.mockImplementation(async (_labels: unknown[], onLabel?: (n: number) => void) => { onLabel?.(1); onLabel?.(2); onLabel?.(3); throw new Error('There is no tape in the printer.') })
    setup()
    fireEvent.click(await screen.findByTestId('labels-copies-more'))
    fireEvent.click(screen.getByTestId('labels-print'))
    await waitFor(() => expect(screen.getByTestId('labels-rest').textContent).toBe('A1 is done and unticked. B3 has 1 of its 2 strips to go. The press prints the rest.'))
    expect(JSON.parse(localStorage.getItem('pt.labels.stoppedRun')!)).toMatchObject({ jobId: 'j1', copies: 2, left: [A1], partial: { id: B3, done: 1, copies: 2 } })
    // the window is closed and opened again
    cleanup()
    setup()
    await waitFor(() => expect(screen.getByTestId('labels-print').textContent).toBe('Print 1 tape label'))
    expect(screen.getByTestId('labels-rest').textContent).toBe('Picked up where today’s run stopped. 1 box is done and unticked. B3 has 1 of its 2 strips to go. Press Every box to start over.')
    expect(screen.getAllByTestId('labels-pick').map((c) => c.getAttribute('aria-pressed'))).toEqual(['false', 'true'])
    expect(screen.getAllByTestId('labels-pick').map((c) => c.getAttribute('data-part'))).toEqual([null, 'true'])
    expect(screen.getByTestId('labels-copies').textContent).toBe('2')
    // starting over forgets it
    fireEvent.click(screen.getByRole('button', { name: 'Every box' }))
    expect(screen.getByTestId('labels-print').textContent).toBe('Print 4 tape labels')
    expect(screen.queryByTestId('labels-rest')).toBeNull()
    expect(localStorage.getItem('pt.labels.stoppedRun')).toBeNull()
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
