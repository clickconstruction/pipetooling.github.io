// @vitest-environment jsdom
/** Render smoke for the Retired fold (punch list #209, v2.6406): retired boxes newest first, Bring back on a clear one, the reason on a clash, nothing drawn when none is retired. */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import RetiredBoxesFold from './RetiredBoxesFold'
import type { Container } from '../../lib/materials/onSite'

const container = (id: string, label: string, kind: Container['kind'], extra: Partial<Container> = {}): Container => ({ id, jobId: 'j1', label, kind, where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-10-01T12:00:00Z', ...extra })

const containers = [
  container('a1', 'A1', 'cage'),
  container('a1-old', 'A1', 'cage', { retiredAt: '2026-10-20T15:00:00Z' }),
  container('b2', 'B2', 'box', { retiredAt: '2026-10-28T15:00:00Z' }),
]

describe('RetiredBoxesFold', () => {
  it('lists retired boxes newest first, offers Bring back on a clear one and the reason on a clash', () => {
    const onBringBack = vi.fn()
    renderWithProviders(<RetiredBoxesFold containers={containers} onBringBack={onBringBack} stamp={(iso) => <time>{iso.slice(0, 10)}</time>} />)
    expect(screen.getByText('Retired · 2')).toBeTruthy()
    const rows = screen.getAllByTestId('retired-row')
    expect(rows.map((r) => r.querySelector('b')?.textContent)).toEqual(['B2', 'A1'])
    expect(rows[0]!.textContent).toContain('2026-10-28')
    fireEvent.click(screen.getByRole('button', { name: 'Bring back B2' }))
    expect(onBringBack).toHaveBeenCalledWith(expect.objectContaining({ id: 'b2' }))
    expect(screen.queryByRole('button', { name: 'Bring back A1' })).toBeNull()
    expect(screen.getByTestId('retired-refusal').textContent).toBe('A live cage on this job already carries A1. Retire it first, or give it another stencil.')
  })

  it('draws nothing when no box is retired', () => {
    const { container: root } = renderWithProviders(<RetiredBoxesFold containers={[container('a1', 'A1', 'cage')]} onBringBack={() => {}} stamp={() => null} />)
    expect(root.querySelector('[data-testid="retired-fold"]')).toBeNull()
  })
})
