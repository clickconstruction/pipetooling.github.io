// @vitest-environment jsdom
/**
 * Settings → Data & recovery → "Labor burden factor (dev)" (Taunya, 2026-11-27). Read only: it says what the factor
 * is, what it stands for, where it reaches and where it does not, and it has no press that changes anything. The
 * words are the kernel's (`src/lib/laborBurdenWords.test.ts`). The read is handed in, so nothing reaches a server.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import LaborBurdenSettingsBlock from './LaborBurdenSettingsBlock'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

afterEach(cleanup)

describe('LaborBurdenSettingsBlock', () => {
  it('draws nothing for anyone but a developer, and reads nothing', () => {
    const read = vi.fn(async () => 1.2)
    for (const role of ['assistant', 'master_technician', 'estimator', null]) {
      const { container, unmount } = renderWithProviders(<LaborBurdenSettingsBlock role={role} read={read} />)
      expect(container.textContent).toBe('')
      unmount()
    }
    expect(read).not.toHaveBeenCalled()
  })

  it('is folded for a developer, and reads only once it is opened', async () => {
    const read = vi.fn(async () => 1.2)
    renderWithProviders(<LaborBurdenSettingsBlock role="dev" read={read} />)
    const fold = screen.getByRole('button', { name: /Labor burden factor \(dev\)/ })
    expect(fold.getAttribute('aria-expanded')).toBe('false')
    expect(read).not.toHaveBeenCalled()
    fireEvent.click(fold)
    expect(read).toHaveBeenCalledTimes(1)
    expect((await screen.findByTestId('labor-burden-figure')).textContent).toContain('×1.20')
  })

  it('says what it stands for, where it reaches and where it does not, with one wage worked out', async () => {
    renderWithProviders(<LaborBurdenSettingsBlock role="dev" read={async () => 1.25} />)
    fireEvent.click(screen.getByRole('button', { name: /Labor burden factor \(dev\)/ }))
    expect((await screen.findByTestId('labor-burden-figure')).textContent).toContain('×1.25')
    expect(screen.getByTestId('labor-burden-stands-for').textContent).toBe('It stands for depreciation on the tools and the truck a person uses.')
    expect(screen.getByText('A wage of $30.00 an hour counts as $37.50 an hour.')).toBeTruthy()
    expect(screen.getByTestId('labor-burden-reaches').querySelectorAll('li')).toHaveLength(7)
    expect(screen.getByTestId('labor-burden-not').querySelectorAll('li')).toHaveLength(5)
    expect(screen.getByText('No press here changes it. A developer changes the number in the database.')).toBeTruthy()
  })

  it('has no press but its own fold, and no field: nothing here can change the number', async () => {
    renderWithProviders(<LaborBurdenSettingsBlock role="dev" read={async () => 1.2} />)
    fireEvent.click(screen.getByRole('button', { name: /Labor burden factor \(dev\)/ }))
    await screen.findByTestId('labor-burden-figure')
    const block = screen.getByTestId('labor-burden-block')
    expect(block.querySelectorAll('button')).toHaveLength(1)
    expect(block.querySelectorAll('input, select, textarea')).toHaveLength(0)
  })

  it('a read that fails says why, and still says what the factor stands for', async () => {
    renderWithProviders(<LaborBurdenSettingsBlock role="dev" read={async () => Promise.reject(new Error('permission denied for table app_settings'))} />)
    fireEvent.click(screen.getByRole('button', { name: /Labor burden factor \(dev\)/ }))
    expect((await screen.findByTestId('labor-burden-read-why')).textContent).toContain('permission denied')
    expect(screen.queryByTestId('labor-burden-figure')).toBeNull()
    expect(screen.getByTestId('labor-burden-stands-for')).toBeTruthy()
  })
})
