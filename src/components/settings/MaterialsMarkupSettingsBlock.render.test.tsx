// @vitest-environment jsdom
/**
 * Render smokes for Settings → Jobs & billing → Markup on materials (punch list #254, PR 1): the percent reads from
 * its app_settings row, the margin box beside it follows, the line under the pair reads it both ways, Save is dead, saying the markup is saved as shown, until
 * the percent changes, and Save writes one row, null when cleared.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

const state: { row: { key: string; value_num: number | null } | null; upserts: Array<{ key: string; value_num: number | null }> } = { row: null, upserts: [] }

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: state.row, error: null }) }),
        in: () => Promise.resolve({ data: state.row ? [state.row] : [], error: null }),
      }),
      upsert: (row: { key: string; value_num: number | null }) => {
        state.upserts.push(row)
        return Promise.resolve({ error: null })
      },
    }),
  },
}))
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'dev' })
})

import MaterialsMarkupSettingsBlock from './MaterialsMarkupSettingsBlock'
import { renderWithProviders } from '../../test/renderSmokeMocks'

describe('MaterialsMarkupSettingsBlock', () => {
  it('reads the percent and says what it means both ways', async () => {
    state.row = { key: 'materials_markup_pct_v1', value_num: 25 }
    renderWithProviders(<MaterialsMarkupSettingsBlock />)
    await waitFor(() => expect((screen.getByTestId('materials-markup-input') as HTMLInputElement).value).toBe('25'))
    expect((screen.getByTestId('materials-markup-input-margin') as HTMLInputElement).value).toBe('20')
    expect(screen.getByTestId('materials-markup-reads').textContent).toBe('25% over cost, a 20% margin on the sale. $1,000.00 of materials is charged at $1,250.00.')
    // Unchanged, the press is dead and says so; the same percent typed again changes nothing.
    expect((screen.getByTestId('materials-markup-save') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('materials-markup-nothing').textContent).toBe('The markup is saved as shown.')
    fireEvent.change(screen.getByTestId('materials-markup-input'), { target: { value: '25.00' } })
    expect((screen.getByTestId('materials-markup-save') as HTMLButtonElement).disabled).toBe(true)
  })

  it('with no row, says materials are at cost; Save writes the typed percent, and a cleared field writes null', async () => {
    state.row = null
    state.upserts = []
    renderWithProviders(<MaterialsMarkupSettingsBlock />)
    await waitFor(() => expect(screen.getByTestId('materials-markup-reads').textContent).toBe('No markup is set. Materials on a charges paper are at cost until one is.'))
    fireEvent.change(screen.getByTestId('materials-markup-input'), { target: { value: '30' } })
    expect(screen.getByTestId('materials-markup-reads').textContent).toBe('30% over cost, a 23.1% margin on the sale. $1,000.00 of materials is charged at $1,300.00.')
    fireEvent.click(screen.getByTestId('materials-markup-save'))
    await waitFor(() => expect(state.upserts).toEqual([{ key: 'materials_markup_pct_v1', value_num: 30 }]))
    fireEvent.change(screen.getByTestId('materials-markup-input'), { target: { value: '' } })
    fireEvent.click(screen.getByTestId('materials-markup-save'))
    await waitFor(() => expect(state.upserts).toHaveLength(2))
    expect(state.upserts[1]).toEqual({ key: 'materials_markup_pct_v1', value_num: null })
  })

  it('a margin typed fills the markup box and saves the markup it makes; a margin of 100 is refused and Save stays dead', async () => {
    state.row = null
    state.upserts = []
    renderWithProviders(<MaterialsMarkupSettingsBlock />)
    await waitFor(() => expect(screen.getByTestId('materials-markup-input-margin')).toBeTruthy())
    fireEvent.change(screen.getByTestId('materials-markup-input-margin'), { target: { value: '20' } })
    expect((screen.getByTestId('materials-markup-input') as HTMLInputElement).value).toBe('25')
    expect(screen.getByTestId('materials-markup-reads').textContent).toBe('25% over cost, a 20% margin on the sale. $1,000.00 of materials is charged at $1,250.00.')
    fireEvent.click(screen.getByTestId('materials-markup-save'))
    await waitFor(() => expect(state.upserts).toEqual([{ key: 'materials_markup_pct_v1', value_num: 25 }]))
    fireEvent.change(screen.getByTestId('materials-markup-input-margin'), { target: { value: '100' } })
    expect(screen.getByTestId('materials-markup-input-refusal').textContent).toBe('A margin on the sale is under 100%.')
    expect((screen.getByTestId('materials-markup-input') as HTMLInputElement).value).toBe('')
    expect((screen.getByTestId('materials-markup-save') as HTMLButtonElement).disabled).toBe(true)
  })
})
