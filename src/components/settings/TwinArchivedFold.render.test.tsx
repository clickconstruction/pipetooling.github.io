// @vitest-environment jsdom
/**
 * Render smoke for the archived twins' fold (v2.5741): nothing while none is archived; one muted line that opens to
 * the rows, each with a Restore that hands the twin back to the panel.
 */
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import TwinArchivedFold from './TwinArchivedFold'

const two = { id: 'u-2', name: 'Twin Estimator 2', email: 'twin-estimator-2@twins.pipetooling.local', archived_at: '2026-10-22T18:00:00.000Z' }
const old = { id: 'u-4', name: null, email: 'twin-estimator-3@twins.pipetooling.local', archived_at: '2026-09-01T12:00:00.000Z' }

describe('TwinArchivedFold', () => {
  it('draws nothing while no twin is archived', () => {
    const { container } = renderWithProviders(<TwinArchivedFold archived={[]} busy={false} onRestore={vi.fn()} />)
    expect(container.querySelector('[data-twins-archived]')).toBeNull()
  })

  it('folds the archived twins under one line, and Restore hands the twin back', () => {
    const onRestore = vi.fn()
    renderWithProviders(<TwinArchivedFold archived={[two, old]} busy={false} onRestore={onRestore} />)
    const fold = screen.getByRole('button', { name: '▸ 2 archived' })
    expect(screen.queryByText('Twin Estimator 2')).toBeNull()
    fireEvent.click(fold)
    expect(screen.getByText('Twin Estimator 2')).toBeTruthy()
    expect(screen.getByText('twin-estimator-3@twins.pipetooling.local', { selector: 'span' })).toBeTruthy()
    expect(screen.getByText('archived Oct 22, 2026')).toBeTruthy()
    const restores = screen.getAllByRole('button', { name: 'Restore' })
    expect(restores).toHaveLength(2)
    fireEvent.click(restores[0]!)
    expect(onRestore).toHaveBeenCalledWith(two)
    fireEvent.click(screen.getByRole('button', { name: '▾ 2 archived' }))
    expect(screen.queryByText('Twin Estimator 2')).toBeNull()
  })

  it('holds Restore while the panel is busy', () => {
    renderWithProviders(<TwinArchivedFold archived={[two]} busy onRestore={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '▸ 1 archived' }))
    expect((screen.getByRole('button', { name: 'Restore' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
