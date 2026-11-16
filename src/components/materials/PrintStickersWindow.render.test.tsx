// @vitest-environment jsdom
/**
 * Render smoke for Print future stickers from the Materials strip (punch list #329, PR 2, v2.7272): two jobs ask *Which
 * job?*, a job with no box is listed too, a pick opens that job's stickers window, one job skips the question, and no
 * job at all names the next press. Since v2.7492 each job is a card that says its runs so far, the stickers reserved
 * and not on a box yet and the name a new run opens on, under a band with one sticker at its printed size.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { Container } from '../../lib/materials/onSite'
import type { OnSiteFindJob } from '../../lib/materials/onSiteFind'
import { PTOUCH_NO_USB } from '../../lib/materials/ptouchRaster'
import type { PtouchLink } from '../../lib/materials/ptouchUsb'
import type { StickerJobsInput } from '../../lib/materials/reserveStickersJobs'
import type { StickerRunWithStickers } from '../../lib/materials/stickerRunsIo'

vi.mock('../../lib/materials/stickerRunsIo', () => ({
  mintStickerRun: vi.fn(),
  fetchStickerRuns: vi.fn(async () => []),
  fetchSiteStickerNames: vi.fn(async () => ({ boxes: [], blankNames: [] })),
}))
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})
import PrintStickersWindow from './PrintStickersWindow'

const box = (id: string, jobId: string, label: string, over: Partial<Container> = {}): Container => ({ id, jobId, label, kind: 'cage', where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-11-01T00:00:00Z', ...over })
const juniper: OnSiteFindJob = { jobId: 'j1', label: 'JP1204 · Juniper Ridge', number: 'JP1204', name: 'Juniper Ridge', address: '12 Kiln Road', containers: [box('7d759246-8476-4a37-884f-ed1562d5663f', 'j1', 'R12'), box('un', 'j1', 'Unsorted', { kind: 'unsorted' })], lines: [], places: [] }
const bare: OnSiteFindJob = { jobId: 'j3', label: 'JP1071 · Larkspur Dental', number: 'JP1071', name: 'Larkspur Dental', containers: [box('un3', 'j3', 'Unsorted', { kind: 'unsorted' })], lines: [], places: [] }
const quiet = { error: null, raw: null, retry: () => {} }
/** The cards' reads as spies that never answer, so a card is read as it stands without them; a browser with USB and no printer. */
const never = <T,>() => new Promise<T>(() => {})
const reads = (over: Partial<NonNullable<Parameters<typeof PrintStickersWindow>[0]['reads']>> = {}) => ({ runs: vi.fn(() => never<StickerJobsInput['runsOf']>()), sites: vi.fn(() => never<StickerJobsInput['sitesOf']>()), connect: vi.fn(() => never<PtouchLink | null>()), usbHere: true, ...over })
const sticker = (number: number, boxName: string | null, containerId: string | null = null) => ({ id: `s${number}`, number, code: `AAAA${String(number).padStart(4, '0')}`, boxName, containerId, lostAt: null })
const run = (jobId: string, names: string[] | null, stickers: ReturnType<typeof sticker>[]): StickerRunWithStickers => ({ run: { id: `r-${jobId}`, jobId, count: stickers.length, firstNumber: 1, lastNumber: stickers.length, copies: 1, printedByName: 'Dana', printedAt: '2026-11-16T15:00:00Z', names }, stickers } as StickerRunWithStickers)

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('PrintStickersWindow', () => {
  it('asks which job, lists a job with no box yet, and the head opens the pick', () => {
    renderWithProviders(<PrintStickersWindow jobs={[juniper, bare]} role="assistant" loading={false} failure={quiet} reads={reads()} onClose={() => {}} />)
    expect(screen.getByRole('dialog', { name: 'Print future stickers' }).textContent).toContain('Which job? New boxes made from the stickers go on it.')
    const rows = screen.getAllByTestId('print-stickers-job')
    expect(rows.map((r) => r.textContent)).toEqual(['JP1071Larkspur Dentalno box yet', 'JP1204Juniper Ridge12 Kiln Road1box'])
    fireEvent.click(rows[1]!)
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Print future stickers · JP1204 · Juniper Ridge')
    expect(screen.getByTestId('stickers-print').textContent).toBe('Print 200 future stickers')
  })

  it('a card says the runs so far, the stickers reserved and not on a box yet, and the name a new run opens on', async () => {
    const runs = vi.fn(async (_ids: ReadonlyArray<string>) => new Map([['j1', [run('j1', ['R13', 'R14', 'R15'], [sticker(1, 'R13', '7d759246-8476-4a37-884f-ed1562d5663f'), sticker(2, 'R14'), sticker(3, 'R15')])]]]))
    const sites = vi.fn(async (_ids: ReadonlyArray<string>) => new Map([['j1', { site: 'Juniper Ridge Estates', names: { boxes: [{ label: 'R12', kind: 'cage', retiredAt: null }], blankNames: ['R14', 'R15'] } }], ['j3', { site: '', names: { boxes: [], blankNames: [] } }]]))
    const onOpenJob = vi.fn()
    renderWithProviders(<PrintStickersWindow jobs={[bare, juniper]} role="assistant" loading={false} failure={quiet} reads={reads({ runs, sites })} onOpenJob={onOpenJob} onClose={() => {}} />)
    // The job with stickers waiting for their boxes comes first once they are read.
    await waitFor(() => expect(within(screen.getAllByTestId('print-stickers-card')[0]!).getByTestId('print-stickers-job-reserved').textContent).toBe('2 stickers reserved and not on a box yet, R14 to R15. Printed Nov 16 by Dana.'))
    const first = within(screen.getAllByTestId('print-stickers-card')[0]!)
    expect(first.getByTestId('print-stickers-job-facts').textContent).toBe('1 cage · R12')
    expect(first.getByTestId('print-stickers-job-runs').textContent).toBe('1 run so far · 3 stickers · 1 on boxes')
    await waitFor(() => expect(first.getByTestId('print-stickers-job-next').textContent).toBe('A new run opens on R16.'))
    expect(first.getByTestId('print-stickers-job-where').textContent).toBe('Juniper Ridge Estates · 12 Kiln Road')
    expect(runs).toHaveBeenCalledWith(['j1', 'j3'])
    // The band's sticker carries that name over the stand-in link.
    expect(screen.getByTestId('print-stickers-sample').textContent).toContain('R16')
    expect(screen.getByTestId('print-stickers-sample').textContent).toContain('XXXX-XXXX')
    // Reserved stickers go on their boxes from the job's own page.
    fireEvent.click(first.getByTestId('print-stickers-door-job'))
    expect(onOpenJob).toHaveBeenCalledWith('j1')
    // A job with no run and no name to go by says only that a run would be its first.
    const second = within(screen.getAllByTestId('print-stickers-card')[1]!)
    expect(second.getByTestId('print-stickers-job-runs').textContent).toBe('A run here would be this job’s first.')
    expect(second.queryByTestId('print-stickers-job-reserved')).toBeNull()
    expect(second.queryByTestId('print-stickers-job-next')).toBeNull()
    expect(second.queryByTestId('print-stickers-door-job')).toBeNull()
    fireEvent.click(second.getByTestId('print-stickers-door-reserve'))
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Print future stickers · JP1071 · Larkspur Dental')
  })

  it('the band says the tape and the printer’s own line once it answers, and lets the printer go before the next window', async () => {
    const close = vi.fn(async () => {})
    const link = { model: 'PT-D610BT', status: { tapeMm: 18, statusType: 0, phase: 0, errors: [] }, print: vi.fn(), refresh: vi.fn(async () => ({ tapeMm: 18, statusType: 0, phase: 0, errors: [] })), close } as unknown as PtouchLink
    const r = reads({ connect: vi.fn(async () => link) })
    renderWithProviders(<PrintStickersWindow jobs={[juniper, bare]} role="assistant" loading={false} failure={quiet} reads={r} onClose={() => {}} />)
    expect(screen.getByTestId('print-stickers-band').getAttribute('data-band')).toBe('tape')
    await waitFor(() => expect(screen.getByTestId('print-stickers-printer-line').textContent).toContain('PT-D610BT'))
    expect(screen.getByTestId('print-stickers-prints-on').textContent).toBe('Brother tape · 18 mm')
    fireEvent.click(screen.getAllByTestId('print-stickers-job')[0]!)
    await waitFor(() => expect(screen.getByRole('heading', { level: 2 }).textContent).toContain('Print future stickers · '))
    expect(close).toHaveBeenCalled()
  })

  it('a browser that cannot reach the printer says so before a job is picked', () => {
    renderWithProviders(<PrintStickersWindow jobs={[juniper, bare]} role="assistant" loading={false} failure={quiet} reads={reads({ usbHere: false })} onClose={() => {}} />)
    const band = screen.getByTestId('print-stickers-band')
    expect(band.getAttribute('data-band')).toBe('no-usb')
    expect(band.textContent).toContain(PTOUCH_NO_USB)
    expect(screen.queryByTestId('print-stickers-sample')).toBeNull()
  })

  it('a job whose boxes did not load says so with Read again, and is not read as a job with no box', () => {
    const onReadAgain = vi.fn()
    const lost: OnSiteFindJob = { jobId: 'j7', label: 'JP1077 · Ridgeway Medical', number: 'JP1077', name: 'Ridgeway Medical', containers: [], lines: [], places: [], failed: 'The connection dropped.' }
    renderWithProviders(<PrintStickersWindow jobs={[juniper, lost]} role="assistant" loading={false} failure={quiet} reads={reads()} onReadAgain={onReadAgain} onClose={() => {}} />)
    expect(screen.getByTestId('print-stickers-not-loaded').textContent).toContain('Did not load. The connection dropped.')
    // Its head says nothing of boxes: a read that failed is not *no box yet*.
    expect(screen.getAllByTestId('print-stickers-job').map((r) => r.textContent)).toEqual(['JP1077Ridgeway Medical', 'JP1204Juniper Ridge12 Kiln Road1box'])
    fireEvent.click(screen.getByRole('button', { name: 'Read JP1077 · Ridgeway Medical again' }))
    expect(onReadAgain).toHaveBeenCalledWith('j7')
  })

  it('the foot points at Print labels and the scan, each only when it is handed in', () => {
    const onLabels = vi.fn()
    const onScan = vi.fn()
    renderWithProviders(<PrintStickersWindow jobs={[juniper, bare]} role="assistant" loading={false} failure={quiet} reads={reads()} onLabels={onLabels} onScan={onScan} onClose={() => {}} />)
    expect(screen.getByTestId('print-stickers-foot').textContent).toContain('Boxes that are already in the app?')
    fireEvent.click(screen.getByTestId('print-stickers-labels'))
    fireEvent.click(screen.getByTestId('print-stickers-scan'))
    expect(onLabels).toHaveBeenCalledTimes(1)
    expect(onScan).toHaveBeenCalledTimes(1)
    cleanup()
    renderWithProviders(<PrintStickersWindow jobs={[juniper, bare]} role="assistant" loading={false} failure={quiet} reads={reads()} onClose={() => {}} />)
    expect(screen.queryByTestId('print-stickers-labels')).toBeNull()
    expect(screen.queryByTestId('print-stickers-scan')).toBeNull()
  })

  it('one job skips the question', () => {
    renderWithProviders(<PrintStickersWindow jobs={[bare]} role="dev" loading={false} failure={quiet} reads={reads()} onClose={() => {}} />)
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Print future stickers · JP1071 · Larkspur Dental')
  })

  it('no job at all names the next press', () => {
    const onAddFirst = vi.fn()
    renderWithProviders(<PrintStickersWindow jobs={[]} role="dev" loading={false} failure={quiet} reads={reads()} onAddFirst={onAddFirst} onClose={() => {}} />)
    expect(screen.getByRole('dialog', { name: 'Print future stickers' }).querySelector('[data-empty-state]')?.textContent).toContain('No job has anything on site yet.')
    fireEvent.click(screen.getByRole('button', { name: 'On site' }))
    expect(onAddFirst).toHaveBeenCalled()
  })
})
