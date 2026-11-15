// @vitest-environment jsdom
/**
 * Render smoke for Print blank stickers from the Materials strip (punch list #329, PR 2, v2.7272): two jobs ask *Which
 * job?*, a job with no box is listed too, a pick opens that job's stickers window, one job skips the question, and no
 * job at all names the next press.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { Container } from '../../lib/materials/onSite'
import type { OnSiteFindJob } from '../../lib/materials/onSiteFind'

vi.mock('../../lib/materials/stickerRunsIo', () => ({
  mintStickerRun: vi.fn(),
  fetchLastStickerNumber: vi.fn(async () => null),
  fetchStickerRuns: vi.fn(async () => []),
}))
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})
import PrintStickersWindow from './PrintStickersWindow'

const box = (id: string, jobId: string, label: string, over: Partial<Container> = {}): Container => ({ id, jobId, label, kind: 'cage', where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-11-01T00:00:00Z', ...over })
const juniper: OnSiteFindJob = { jobId: 'j1', label: 'JP1204 · Juniper Ridge', containers: [box('7d759246-8476-4a37-884f-ed1562d5663f', 'j1', 'R12'), box('un', 'j1', 'Unsorted', { kind: 'unsorted' })], lines: [], places: [] }
const bare: OnSiteFindJob = { jobId: 'j3', label: 'JP1071 · Larkspur Dental', containers: [box('un3', 'j3', 'Unsorted', { kind: 'unsorted' })], lines: [], places: [] }
const quiet = { error: null, raw: null, retry: () => {} }

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('PrintStickersWindow', () => {
  it('asks which job, lists a job with no box yet, and opens the pick', () => {
    renderWithProviders(<PrintStickersWindow jobs={[juniper, bare]} role="assistant" loading={false} failure={quiet} onClose={() => {}} />)
    expect(screen.getByRole('dialog', { name: 'Print blank stickers' }).textContent).toContain('Which job?')
    const rows = screen.getAllByTestId('print-stickers-job')
    expect(rows.map((r) => r.textContent)).toEqual(['JP1071 · Larkspur Dentalno box yet', 'JP1204 · Juniper Ridge1 box'])
    fireEvent.click(rows[1]!)
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Print blank stickers · JP1204 · Juniper Ridge')
    expect(screen.getByTestId('stickers-print').textContent).toBe('Print 200 stickers')
  })

  it('one job skips the question', () => {
    renderWithProviders(<PrintStickersWindow jobs={[bare]} role="dev" loading={false} failure={quiet} onClose={() => {}} />)
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Print blank stickers · JP1071 · Larkspur Dental')
  })

  it('no job at all names the next press', () => {
    const onAddFirst = vi.fn()
    renderWithProviders(<PrintStickersWindow jobs={[]} role="dev" loading={false} failure={quiet} onAddFirst={onAddFirst} onClose={() => {}} />)
    expect(screen.getByRole('dialog', { name: 'Print blank stickers' }).querySelector('[data-empty-state]')?.textContent).toContain('No job has anything on site yet.')
    fireEvent.click(screen.getByRole('button', { name: 'On site' }))
    expect(onAddFirst).toHaveBeenCalled()
  })
})
