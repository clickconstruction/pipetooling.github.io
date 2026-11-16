// @vitest-environment jsdom
/**
 * Render smoke for Print labels from anywhere (punch list #304): two jobs with boxes ask *Which job?*, a pick opens
 * that job's labels, one job skips the question, a row's job opens straight, and no box at all names the next press.
 * Since v2.7482 each job is a card that says what it holds, a band says what the labels print on, and a card's doors
 * open the labels window on the rest of a stopped run, on the new boxes or on every box. Since v2.7519 the new boxes
 * are the boxes whose label the app has not seen print (`labelMark.ts`).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { Container, ContainerLine } from '../../lib/materials/onSite'
import type { OnSiteFindJob } from '../../lib/materials/onSiteFind'
import { writeLabelFormat, writeStoppedRun, writeTapePrintedDay } from '../../lib/materials/labelPrefs'
import { PTOUCH_NO_USB } from '../../lib/materials/ptouchRaster'
import type { PtouchLink } from '../../lib/materials/ptouchUsb'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import PrintLabelsWindow, { PRINT_LABELS_WINDOW_WIDTH } from './PrintLabelsWindow'

// The window's retry panel reads the signed-in user.
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

const box = (id: string, jobId: string, label: string, over: Partial<Container> = {}): Container => ({ id, jobId, label, kind: 'cage', where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-11-01T00:00:00Z', ...over })
const A1 = '7d759246-8476-4a37-884f-ed1562d5663f'
const A2 = '4f2a9c18-0000-4000-8000-000000000003'
const A3 = '5a5a5a5a-0000-4000-8000-000000000004'
const oak: OnSiteFindJob = {
  jobId: 'j1',
  label: 'JP1042 · Oak Hollow',
  number: 'JP1042',
  name: 'Oak Hollow',
  address: '410 Mill Road',
  containers: [box(A1, 'j1', 'A1', { locationId: 'p1' }), box(A2, 'j1', 'A2', { kind: 'box', locationId: 'p1' }), box(A3, 'j1', 'A3', { kind: 'box', createdAt: '2026-11-18T00:00:00Z' }), box('un', 'j1', 'Unsorted', { kind: 'unsorted' })],
  lines: [{ containerId: A1, partName: '2 in 90', manufacturer: null, onHand: 4 } as ContainerLine],
  places: [{ id: 'p1', jobId: 'j1', name: 'Level 2', createdAt: '2026-11-01T00:00:00Z' }],
}
const mill: OnSiteFindJob = { jobId: 'j2', label: 'JP1063 · Mill Street Lofts', number: 'JP1063', name: 'Mill Street Lofts', containers: [box('9c184f2a-0000-4000-8000-000000000001', 'j2', 'B1', { kind: 'box' })], lines: [], places: [] }
const bare: OnSiteFindJob = { jobId: 'j3', label: 'JP1071 · Larkspur Dental', containers: [box('un3', 'j3', 'Unsorted', { kind: 'unsorted' })], lines: [], places: [] }
const quiet = { error: null, raw: null, retry: () => {} }
/** The cards' reads as spies that never answer, so a card is read as it stands without them; no printer. */
const never = <T,>() => new Promise<T>(() => {})
const reads = (over: Partial<NonNullable<Parameters<typeof PrintLabelsWindow>[0]['reads']>> = {}) => ({ sites: vi.fn(() => never<Map<string, string>>()), stickered: vi.fn(() => never<Set<string>>()), connect: vi.fn(() => never<PtouchLink | null>()), usbHere: false, ...over })

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('PrintLabelsWindow', () => {
  it('asks which job when two hold boxes, leaves out a job with none, and the head opens the pick', () => {
    renderWithProviders(<PrintLabelsWindow jobs={[mill, oak, bare]} loading={false} failure={quiet} reads={reads()} onClose={() => {}} />)
    const rows = screen.getAllByTestId('print-labels-job')
    // Nothing is read yet, so the jobs stand in the order of their numbers.
    expect(rows.map((r) => r.textContent)).toEqual(['JP1042Oak Hollow410 Mill Road3labels', 'JP1063Mill Street Lofts1label'])
    expect(screen.getByTestId('print-labels-jobs-count').textContent).toBe('2 jobs hold a cage or a box.')
    fireEvent.click(rows[0]!)
    expect(screen.getAllByTestId('labels-sheet')).toHaveLength(3)
    expect(screen.getByTestId('labels-print').textContent).toBe('Print 3 labels')
  })

  it('a card says what the labels are, where they stand, what changed and what the job takes', async () => {
    writeLabelFormat('tape')
    const sites = vi.fn(async (_jobIds: ReadonlyArray<string>) => new Map([['j1', 'Oak Hollow Apartments']]))
    const stickered = vi.fn(async (_boxIds: ReadonlyArray<string>) => new Set([A2]))
    renderWithProviders(<PrintLabelsWindow jobs={[oak, mill]} loading={false} failure={quiet} reads={reads({ sites, stickered })} onClose={() => {}} />)
    const card = within(screen.getAllByTestId('print-labels-card')[0]!)
    expect(card.getByTestId('print-labels-job-facts').textContent).toBe('2 boxes · 1 cage · A1 · A2 · A3')
    expect(card.getByTestId('print-labels-job-places').textContent).toBe('Level 2 2No place said yet 1')
    expect(card.getByTestId('print-labels-job-need').textContent).toBe('3 strips · about 12 cm of 24 mm tape')
    // The site and the stickers land after their reads; the card stands without them until then.
    await waitFor(() => expect(card.getByTestId('print-labels-job-where').textContent).toBe('Oak Hollow Apartments · 410 Mill Road'))
    await waitFor(() => expect(card.getByTestId('print-labels-job-chips').textContent).toBe('1 not printed yet1 already wears a sticker2 empty'))
    expect(sites).toHaveBeenCalledWith(['j1', 'j2'])
    expect(stickered.mock.calls[0]![0]).toHaveLength(4)
    // A job with nothing new and nothing read has no chips, and one door.
    const other = within(screen.getAllByTestId('print-labels-card')[1]!)
    expect(other.queryByTestId('print-labels-job-chips')?.textContent ?? '').toBe('1 empty')
    expect(other.getByTestId('print-labels-door-all').textContent).toBe('The one label›')
  })

  it('the band says what this computer prints on, and Change switches tape and paper', () => {
    renderWithProviders(<PrintLabelsWindow jobs={[oak, mill]} loading={false} failure={quiet} reads={reads({ usbHere: true })} onClose={() => {}} />)
    expect(screen.getByTestId('print-labels-band').getAttribute('data-band')).toBe('sheet')
    expect(screen.getByTestId('print-labels-prints-on').textContent).toBe('Paper sheet')
    expect(screen.getByTestId('print-labels-sample-sheet')).toBeTruthy()
    expect(screen.getAllByTestId('print-labels-job-need')[0]!.textContent).toBe('3 pages')
    fireEvent.click(screen.getByTestId('print-labels-change'))
    expect(screen.getByTestId('print-labels-prints-on').textContent).toBe('Brother tape · 24 mm')
    expect(screen.getByTestId('print-labels-sample-tape').textContent).toContain('A1')
    expect(screen.getByTestId('print-labels-printer-line').textContent).toBe('The app prints straight to the P-touch over USB.')
    expect(localStorage.getItem('pt.labels.format')).toBe('tape')
  })

  it('says the printer’s own line once it answers, and lets it go before the labels window opens', async () => {
    writeLabelFormat('tape')
    writeTapePrintedDay('2026-11-15')
    const close = vi.fn(async () => {})
    const link = { model: 'PT-D610BT', status: { tapeMm: 18, statusType: 0, phase: 0, errors: [] }, print: vi.fn(), refresh: vi.fn(), close } as unknown as PtouchLink
    const r = reads({ usbHere: true, connect: vi.fn(async () => link) })
    renderWithProviders(<PrintLabelsWindow jobs={[oak, mill]} loading={false} failure={quiet} reads={r} onClose={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('print-labels-printer-line').textContent).toContain('PT-D610BT'))
    expect(r.connect).toHaveBeenCalledWith({ ask: false })
    // The printer says 18 mm tape is in it, so the cards count 18 mm strips.
    expect(screen.getByTestId('print-labels-prints-on').textContent).toBe('Brother tape · 18 mm')
    expect(screen.getAllByTestId('print-labels-job-need')[0]!.textContent).toContain('of 18 mm tape')
    fireEvent.click(screen.getAllByTestId('print-labels-job')[0]!)
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Print labels' }).querySelector('[data-testid="labels-count-words"]')).toBeTruthy())
    expect(close).toHaveBeenCalled()
  })

  it('a browser that cannot reach the printer says so before a job is picked, with paper one press away', () => {
    writeLabelFormat('tape')
    renderWithProviders(<PrintLabelsWindow jobs={[oak, mill]} loading={false} failure={quiet} reads={reads()} onClose={() => {}} />)
    const band = screen.getByTestId('print-labels-band')
    expect(band.getAttribute('data-band')).toBe('no-usb')
    expect(band.textContent).toContain(PTOUCH_NO_USB)
    fireEvent.click(within(band).getByTestId('print-labels-change'))
    expect(screen.getByTestId('print-labels-band').getAttribute('data-band')).toBe('sheet')
  })

  it('the doors open the labels window on the boxes not printed yet alone, or on every box', async () => {
    // A3 was made since the app began keeping the mark and its label was never seen to print. The stickers could not
    // be read, so what waits stands on the mark alone.
    const stickered = vi.fn(async (_boxIds: ReadonlyArray<string>): Promise<Set<string>> => { throw new Error('no signal') })
    renderWithProviders(<PrintLabelsWindow jobs={[oak, mill]} loading={false} failure={quiet} reads={reads({ stickered })} onClose={() => {}} />)
    expect((await screen.findByTestId('print-labels-door-unprinted')).textContent).toBe('The 1 not printed yet›')
    fireEvent.click(screen.getByTestId('print-labels-door-unprinted'))
    expect(screen.getAllByTestId('labels-sheet')).toHaveLength(1)
    expect(screen.getAllByTestId('labels-pick').map((c) => c.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true'])
    cleanup()
    renderWithProviders(<PrintLabelsWindow jobs={[oak, mill]} loading={false} failure={quiet} reads={reads()} onClose={() => {}} />)
    fireEvent.click(screen.getAllByTestId('print-labels-door-all')[0]!)
    expect(screen.getAllByTestId('labels-sheet')).toHaveLength(3)
  })

  it('a run this computer stopped today is said on its job, which comes first, with the rest as its first door', () => {
    writeStoppedRun({ jobId: 'j2', day: todayYmdInAppTz(), copies: 1, left: [], partial: null })
    writeStoppedRun({ jobId: 'j1', day: todayYmdInAppTz(), copies: 1, left: [A1], partial: null })
    renderWithProviders(<PrintLabelsWindow jobs={[mill, oak]} loading={false} failure={quiet} reads={reads()} onClose={() => {}} />)
    const first = within(screen.getAllByTestId('print-labels-card')[0]!)
    expect(first.getByTestId('print-labels-job-resume').textContent).toBe('A run stopped here today. 2 boxes are left, from A2.')
    expect(first.getByTestId('print-labels-door-rest').textContent).toBe('The rest, 2 boxes›')
    fireEvent.click(first.getByTestId('print-labels-door-rest'))
    expect(screen.getAllByTestId('labels-sheet')).toHaveLength(2)
    cleanup()
    // Every box, from the start: the kept run is set aside.
    renderWithProviders(<PrintLabelsWindow jobs={[mill, oak]} loading={false} failure={quiet} reads={reads()} onClose={() => {}} />)
    fireEvent.click(within(screen.getAllByTestId('print-labels-card')[0]!).getByTestId('print-labels-door-all'))
    expect(screen.getAllByTestId('labels-sheet')).toHaveLength(3)
  })

  it('a job whose boxes did not load says so, with its reason and Read again, and keeps the question', () => {
    const onReadAgain = vi.fn()
    const lost: OnSiteFindJob = { jobId: 'j7', label: 'JP1077 · Ridgeway Medical', containers: [], lines: [], places: [], failed: 'The connection dropped.' }
    renderWithProviders(<PrintLabelsWindow jobs={[mill, lost]} loading={false} failure={quiet} reads={reads()} onReadAgain={onReadAgain} onClose={() => {}} />)
    // One job with boxes would skip the question; a job that did not load keeps it.
    expect(screen.getAllByTestId('print-labels-job')).toHaveLength(1)
    const row = screen.getByTestId('print-labels-not-loaded')
    expect(row.textContent).toContain('JP1077 · Ridgeway Medical')
    expect(row.textContent).toContain('Did not load. The connection dropped.')
    fireEvent.click(screen.getByRole('button', { name: 'Read JP1077 · Ridgeway Medical again' }))
    expect(onReadAgain).toHaveBeenCalledWith('j7')
  })

  it('the foot points at blank stickers and the scan, each only when it is handed in', () => {
    const onStickers = vi.fn()
    const onScan = vi.fn()
    renderWithProviders(<PrintLabelsWindow jobs={[oak, mill]} loading={false} failure={quiet} reads={reads()} onStickers={onStickers} onScan={onScan} onClose={() => {}} />)
    expect(screen.getByTestId('print-labels-foot').textContent).toContain('Boxes that are not in the app yet?')
    fireEvent.click(screen.getByTestId('print-labels-stickers'))
    fireEvent.click(screen.getByTestId('print-labels-scan'))
    expect(onStickers).toHaveBeenCalledTimes(1)
    expect(onScan).toHaveBeenCalledTimes(1)
    cleanup()
    renderWithProviders(<PrintLabelsWindow jobs={[oak, mill]} loading={false} failure={quiet} reads={reads()} onClose={() => {}} />)
    expect(screen.queryByTestId('print-labels-stickers')).toBeNull()
    expect(screen.queryByTestId('print-labels-scan')).toBeNull()
  })

  it('past six jobs a search narrows the cards, and a search with no job says how to clear it', () => {
    const many = Array.from({ length: 7 }, (_, i): OnSiteFindJob => ({ jobId: `m${i}`, label: `JP20${i} · Site ${i}`, number: `JP20${i}`, name: `Site ${i}`, containers: [box(`0000000${i}-0000-4000-8000-000000000001`, `m${i}`, 'A1')], lines: [], places: [] }))
    renderWithProviders(<PrintLabelsWindow jobs={many} loading={false} failure={quiet} reads={reads()} onClose={() => {}} />)
    fireEvent.change(screen.getByTestId('print-labels-find'), { target: { value: 'site 3' } })
    expect(screen.getAllByTestId('print-labels-job')).toHaveLength(1)
    fireEvent.change(screen.getByTestId('print-labels-find'), { target: { value: 'nowhere' } })
    expect(document.querySelector('[data-empty-state]')?.textContent).toContain('No jobs match ‘nowhere’.')
    fireEvent.click(screen.getByRole('button', { name: 'Clear the search' }))
    expect(screen.getAllByTestId('print-labels-job')).toHaveLength(7)
  })

  it('is wide enough for a long job name, and no name can widen it into a sideways scroll', () => {
    const long: OnSiteFindJob = { ...mill, jobId: 'j9', label: 'JP1091 · ZZ Test lift stations and site visit with a name long enough to pass the window', number: 'JP1091', name: 'ZZ Test lift stations and site visit with a name long enough to pass the window' }
    renderWithProviders(<PrintLabelsWindow jobs={[oak, long]} loading={false} failure={quiet} reads={reads()} onClose={() => {}} />)
    const dialog = screen.getByRole('dialog', { name: 'Print labels' })
    expect(PRINT_LABELS_WINDOW_WIDTH).toBeGreaterThanOrEqual(600)
    expect(dialog.style.width).toBe(`min(${PRINT_LABELS_WINDOW_WIDTH}px, 100%)`)
    // The window's column, the list's column and each card's column are held to the window's own width, and it never scrolls sideways.
    expect(dialog.style.gridTemplateColumns).toBe('minmax(0, 1fr)')
    expect(dialog.style.overflowX).toBe('hidden')
    const cards = screen.getAllByTestId('print-labels-card')
    expect((cards[0]!.parentElement as HTMLElement).style.gridTemplateColumns).toBe('minmax(0, 1fr)')
    expect(cards[1]!.style.gridTemplateColumns).toBe('minmax(0, 1fr)')
    // The whole name reads, on as many lines as it needs; the count beside it stays on one.
    const name = within(cards[1]!).getByTestId('print-labels-job-name')
    expect(name.textContent).toBe(`JP1091${long.name}`)
    expect(name.style.whiteSpace).toBe('')
    expect(name.style.overflowWrap).toBe('anywhere')
    expect(within(cards[1]!).getByTestId('print-labels-job-count').style.whiteSpace).toBe('nowrap')
  })

  it('skips the question for one job, and opens straight on a row’s job', () => {
    renderWithProviders(<PrintLabelsWindow jobs={[mill, bare]} loading={false} failure={quiet} reads={reads()} onClose={() => {}} />)
    expect(screen.getAllByTestId('labels-sheet')).toHaveLength(1)
    cleanup()
    renderWithProviders(<PrintLabelsWindow jobs={[oak, mill]} loading={false} failure={quiet} reads={reads()} jobId="j2" onClose={() => {}} />)
    expect(screen.getAllByTestId('labels-sheet')).toHaveLength(1)
    expect(screen.queryByTestId('print-labels-job')).toBeNull()
  })

  it('with no box anywhere names On site as the next press', () => {
    const onAddFirst = vi.fn()
    renderWithProviders(<PrintLabelsWindow jobs={[bare]} loading={false} failure={quiet} reads={reads()} onAddFirst={onAddFirst} onClose={() => {}} />)
    expect(document.querySelector('[data-empty-state]')?.textContent).toContain('No job has a cage or a box yet.')
    fireEvent.click(screen.getByRole('button', { name: 'On site' }))
    expect(onAddFirst).toHaveBeenCalledTimes(1)
  })
})
