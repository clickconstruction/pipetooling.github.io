// @vitest-environment jsdom
/**
 * Render smoke for Print labels (punch list #294, v2.6801): the sheet per box as before; Tape draws one strip per box at
 * the tape's size with the press counting them; a chip leaves a box out; the format and the width are remembered; the
 * CSV press hands a file to the download.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import LabelsPrintModal from './LabelsPrintModal'
import type { Container, ContainerLine } from '../../lib/materials/onSite'

vi.mock('../../lib/materials/photoShare', () => ({ downloadFile: vi.fn() }))
import { downloadFile } from '../../lib/materials/photoShare'

const A1 = '7d759246-8476-4a37-884f-ed1562d5663f'
const B3 = '4f2a9c18-0000-4000-8000-000000000003'
const container = (id: string, label: string, kind: Container['kind'], extra: Partial<Container> = {}): Container => ({ id, jobId: 'j1', label, kind, where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-11-01T00:00:00Z', ...extra })
const containers = [container(A1, 'A1', 'cage', { locationId: 'p1' }), container(B3, 'B3', 'cage', { where: 'by the north stair' })]
const lines: ContainerLine[] = [{ containerId: A1, partKey: 'text:3/4" copper 90', partId: null, partName: '3/4" copper 90', manufacturer: 'Mueller', onHand: 42, lastTouchedAt: null, lastTouchedBy: null, lastCountAt: null, lastCountBy: null, lastCountDiff: null, cannotFindSinceCount: 0 }]
const places = [{ id: 'p1', name: 'Level 2' }]

function setup(only: string | null = null) {
  const print = vi.fn()
  renderWithProviders(<LabelsPrintModal jobLabel="Oak Hollow Apartments Building C" containers={containers} lines={lines} places={places} only={only} onClose={() => {}} print={print} />)
  return { print }
}

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('LabelsPrintModal', () => {
  it('opens on the sheets, one per box, with the dashed code and the press counting them', () => {
    const { print } = setup()
    expect(screen.getAllByTestId('labels-sheet')).toHaveLength(2)
    expect(screen.getAllByTestId('labels-sheet')[0]!.textContent).toContain('7D75-9246')
    expect(screen.getByTestId('labels-print').textContent).toBe('Print 2 labels')
    fireEvent.click(screen.getByTestId('labels-print'))
    expect(print).toHaveBeenCalledTimes(1)
  })

  it('Tape draws one strip per box at the tape size, the width chips change it, and the pick is remembered', () => {
    setup()
    fireEvent.click(screen.getByTestId('labels-output-tape'))
    const strips = screen.getAllByTestId('labels-tape')
    expect(strips).toHaveLength(2)
    expect(strips[0]!.style.width).toBe('72mm')
    expect(strips[0]!.style.height).toBe('24mm')
    expect(strips[1]!.textContent).toContain('PRTS.CO/B/4F2A-9C18')
    expect(strips[1]!.textContent).toContain('Scan for what is inside')
    expect(screen.getByTestId('labels-print').textContent).toBe('Print 2 tape labels')
    expect((document.head.textContent ?? '') + (document.body.textContent ?? '')).toContain('size: 72mm 24mm')
    fireEvent.click(screen.getByRole('button', { name: '18 mm' }))
    expect(screen.getAllByTestId('labels-tape')[0]!.style.height).toBe('18mm')
    expect(localStorage.getItem('pt.labels.format')).toBe('tape')
    expect(localStorage.getItem('pt.labels.tapeWidthMm')).toBe('18')
    cleanup()
    setup()
    expect(screen.getAllByTestId('labels-tape')).toHaveLength(2)
  })

  it('a chip leaves a box out and the press counts what is left; none left makes it dead', () => {
    const { print } = setup()
    const picks = screen.getAllByTestId('labels-pick')
    fireEvent.click(picks[0]!)
    expect(screen.getAllByTestId('labels-sheet')).toHaveLength(1)
    expect(screen.getByTestId('labels-print').textContent).toBe('Print 1 label')
    fireEvent.click(picks[1]!)
    expect(screen.getByTestId('labels-print').textContent).toBe('Print labels')
    fireEvent.click(screen.getByTestId('labels-print'))
    expect(print).not.toHaveBeenCalled()
  })

  it('one box has no pick row and no CSV press; the CSV press on the whole job hands a file over', () => {
    setup(A1)
    expect(screen.queryAllByTestId('labels-pick')).toHaveLength(0)
    expect(screen.queryByText('Export the labels as a CSV')).toBeNull()
    cleanup()
    setup()
    fireEvent.click(screen.getByText('Export the labels as a CSV'))
    const file = vi.mocked(downloadFile).mock.calls[0]?.[0] as File
    expect(file.name).toMatch(/^labels-oak-hollow-apartments-building-c-\d{4}-\d{2}-\d{2}\.csv$/)
    expect(file.type).toBe('text/csv')
  })

  it('names the two outputs first, and Brother tape on a new computer lists the first-time steps (punch list #304)', () => {
    setup()
    const outputs = screen.getAllByRole('radio')
    expect(outputs.map((o) => o.textContent)).toEqual(['Paper sheetOne Letter page a box, with lines to write on. Any printer.', 'Brother tapeOne strip a box for the P-touch, for boxes that sit in the sun.Needs Chrome or Edge'])
    expect(outputs[0]!.getAttribute('aria-checked')).toBe('true')
    expect(screen.queryByTestId('labels-tape-setup')).toBeNull()
    expect(screen.queryByTestId('labels-test-strip')).toBeNull()
    fireEvent.click(outputs[1]!)
    const steps = screen.getByTestId('labels-tape-setup')
    expect(steps.textContent).toContain('First time on this computer')
    expect(steps.textContent).toContain('USB cable')
    expect(steps.textContent).toContain('Brother’s driver')
    expect(steps.textContent).toContain('24 mm paper')
    expect(steps.querySelector('a')?.getAttribute('href')).toBe('/help?g=keep-track-of-the-material-in-the-cages-and-boxes-on-site#print-a-tape-label')
    expect(screen.getByTestId('labels-count-words').textContent).toBe('2 boxes, one strip each.')
  })

  it('a browser with no USB reach says so on the tape choice, and hands over the link for Chrome (v2.6865)', async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    setup()
    expect(screen.getByTestId('labels-needs-browser').textContent).toBe('Needs Chrome or Edge')
    expect(screen.queryByTestId('labels-no-usb')).toBeNull()
    fireEvent.click(screen.getByTestId('labels-output-tape'))
    const note = screen.getByTestId('labels-no-usb')
    expect(note.textContent).toContain('Open this page in Chrome or Edge on a computer.')
    expect(note.textContent).toContain('Brother makes no Mac driver')
    expect(screen.queryByTestId('labels-connect')).toBeNull()
    fireEvent.click(screen.getByTestId('labels-copy-link'))
    await waitFor(() => expect(note.textContent).toContain('Link copied. Paste it into Chrome or Edge.'))
    expect(writeText).toHaveBeenCalledWith(window.location.href)
  })

  it('the test strip prints the first ticked box alone, then the list is whole again', () => {
    const { print } = setup()
    fireEvent.click(screen.getByTestId('labels-output-tape'))
    fireEvent.click(screen.getAllByTestId('labels-pick')[0]!)
    fireEvent.click(screen.getAllByTestId('labels-pick')[0]!)
    fireEvent.click(screen.getByTestId('labels-test-strip'))
    expect(print).toHaveBeenCalledTimes(1)
    expect(screen.getAllByTestId('labels-tape')).toHaveLength(1)
    expect(screen.getAllByTestId('labels-tape')[0]!.textContent).toContain('A1')
    fireEvent(window, new Event('afterprint'))
    expect(screen.getAllByTestId('labels-tape')).toHaveLength(2)
  })

  it('a computer that printed tape opens on tape with the choice folded, and Change and Printer setup bring it back', () => {
    const { print } = setup()
    fireEvent.click(screen.getByTestId('labels-output-tape'))
    fireEvent.click(screen.getByTestId('labels-print'))
    expect(print).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('pt.labels.tapePrintedYmd')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    cleanup()
    setup()
    const ready = screen.getByTestId('labels-tape-ready')
    expect(ready.textContent).toContain('Brother tape · 24 mm.')
    expect(ready.textContent).toContain('This computer printed tape last on')
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
    expect(screen.queryByTestId('labels-tape-setup')).toBeNull()
    expect(screen.getAllByTestId('labels-tape')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Printer setup' }))
    expect(screen.getByTestId('labels-tape-setup').textContent).toContain('Printer setup')
    fireEvent.click(screen.getByRole('button', { name: 'Change' }))
    expect(screen.getAllByRole('radio')).toHaveLength(2)
    fireEvent.click(screen.getByTestId('labels-output-sheet'))
    expect(screen.getAllByTestId('labels-sheet')).toHaveLength(2)
    expect(screen.queryByTestId('labels-test-strip')).toBeNull()
  })

  it('None clears every box and Every box picks them all again; one box has neither, nor a test strip', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'None' }))
    expect(screen.queryAllByTestId('labels-sheet')).toHaveLength(0)
    expect(screen.getByTestId('labels-print').textContent).toBe('Print labels')
    fireEvent.click(screen.getByRole('button', { name: 'Every box' }))
    expect(screen.getAllByTestId('labels-sheet')).toHaveLength(2)
    cleanup()
    setup(A1)
    fireEvent.click(screen.getByTestId('labels-output-tape'))
    expect(screen.queryByRole('button', { name: 'None' })).toBeNull()
    expect(screen.queryByTestId('labels-test-strip')).toBeNull()
    expect(screen.getByTestId('labels-count-words').textContent).toBe('One strip: the QR, the stencil and the code.')
  })
})
