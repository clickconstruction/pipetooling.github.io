// @vitest-environment jsdom
/**
 * Render smoke for Print labels from anywhere (punch list #304): two jobs with boxes ask *Which job?*, a pick opens
 * that job's labels, one job skips the question, a row's job opens straight, and no box at all names the next press.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { Container } from '../../lib/materials/onSite'
import type { OnSiteFindJob } from '../../lib/materials/onSiteFind'
import PrintLabelsWindow from './PrintLabelsWindow'

// The window's retry panel reads the signed-in user.
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

const box = (id: string, jobId: string, label: string, over: Partial<Container> = {}): Container => ({ id, jobId, label, kind: 'cage', where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-11-01T00:00:00Z', ...over })
const oak: OnSiteFindJob = { jobId: 'j1', label: 'JP1042 · Oak Hollow', containers: [box('7d759246-8476-4a37-884f-ed1562d5663f', 'j1', 'A1'), box('4f2a9c18-0000-4000-8000-000000000003', 'j1', 'A2'), box('un', 'j1', 'Unsorted', { kind: 'unsorted' })], lines: [], places: [] }
const mill: OnSiteFindJob = { jobId: 'j2', label: 'JP1063 · Mill Street Lofts', containers: [box('9c184f2a-0000-4000-8000-000000000001', 'j2', 'B1', { kind: 'box' })], lines: [], places: [] }
const bare: OnSiteFindJob = { jobId: 'j3', label: 'JP1071 · Larkspur Dental', containers: [box('un3', 'j3', 'Unsorted', { kind: 'unsorted' })], lines: [], places: [] }
const quiet = { error: null, raw: null, retry: () => {} }

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('PrintLabelsWindow', () => {
  it('asks which job when two hold boxes, leaves out a job with none, and opens the pick', () => {
    renderWithProviders(<PrintLabelsWindow jobs={[oak, mill, bare]} loading={false} failure={quiet} onClose={() => {}} />)
    const rows = screen.getAllByTestId('print-labels-job')
    expect(rows.map((r) => r.textContent)).toEqual(['JP1042 · Oak Hollow2 labels', 'JP1063 · Mill Street Lofts1 label'])
    fireEvent.click(rows[0]!)
    expect(screen.getAllByTestId('labels-sheet')).toHaveLength(2)
    expect(screen.getByTestId('labels-print').textContent).toBe('Print 2 labels')
  })

  it('skips the question for one job, and opens straight on a row’s job', () => {
    renderWithProviders(<PrintLabelsWindow jobs={[mill, bare]} loading={false} failure={quiet} onClose={() => {}} />)
    expect(screen.getAllByTestId('labels-sheet')).toHaveLength(1)
    cleanup()
    renderWithProviders(<PrintLabelsWindow jobs={[oak, mill]} loading={false} failure={quiet} jobId="j2" onClose={() => {}} />)
    expect(screen.getAllByTestId('labels-sheet')).toHaveLength(1)
    expect(screen.queryByTestId('print-labels-job')).toBeNull()
  })

  it('with no box anywhere names On site as the next press', () => {
    const onAddFirst = vi.fn()
    renderWithProviders(<PrintLabelsWindow jobs={[bare]} loading={false} failure={quiet} onAddFirst={onAddFirst} onClose={() => {}} />)
    expect(document.querySelector('[data-empty-state]')?.textContent).toContain('No job has a cage or a box yet.')
    fireEvent.click(screen.getByRole('button', { name: 'On site' }))
    expect(onAddFirst).toHaveBeenCalledTimes(1)
  })
})
