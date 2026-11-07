// @vitest-environment jsdom
/**
 * Render smokes for Settings → Jobs, bills and liens → Markup on materials (punch list #254, PR 1; the pair and its bar,
 * v2.6538): the percent reads from its app_settings row, the margin box beside it follows, the bar under the pair shows
 * $1,000 of materials as cost and markup, Save is dead, saying the markup is saved as shown, until the percent changes,
 * and Save writes one row, null when cleared.
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
  it('reads the percent into both boxes and the bar shows what $1,000 of materials becomes', async () => {
    state.row = { key: 'materials_markup_pct_v1', value_num: 25 }
    renderWithProviders(<MaterialsMarkupSettingsBlock />)
    await waitFor(() => expect((screen.getByTestId('materials-markup-input') as HTMLInputElement).value).toBe('25'))
    expect((screen.getByTestId('materials-markup-input-margin') as HTMLInputElement).value).toBe('20')
    expect(screen.getByTestId('materials-markup-input-bar-pays').textContent).toBe('the customer pays $1,250.00')
    expect(screen.getByTestId('materials-markup-input-bar-words').textContent).toBe('cost, 80% of the salemargin, 20% of the sale')
    // Unchanged, the press is dead and says so; the same percent typed again changes nothing.
    expect((screen.getByTestId('materials-markup-save') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('materials-markup-nothing').textContent).toBe('The markup is saved as shown.')
    fireEvent.change(screen.getByTestId('materials-markup-input'), { target: { value: '25.00' } })
    expect((screen.getByTestId('materials-markup-save') as HTMLButtonElement).disabled).toBe(true)
  })

  it('with no row, says materials are at cost and the bar is all cost; Save writes the typed percent, and a cleared field writes null', async () => {
    state.row = null
    state.upserts = []
    renderWithProviders(<MaterialsMarkupSettingsBlock />)
    await waitFor(() => expect(screen.getByTestId('materials-markup-nothing').textContent).toBe('No markup is set. Materials on a charges paper are at cost until one is.'))
    expect(screen.getByTestId('materials-markup-input-bar-words').textContent).toBe('cost, all of the saleno markup')
    fireEvent.change(screen.getByTestId('materials-markup-input'), { target: { value: '30' } })
    expect(screen.getByTestId('materials-markup-input-bar-pays').textContent).toBe('the customer pays $1,300.00')
    expect(screen.getByTestId('materials-markup-input-bar-words').textContent).toBe('cost, 76.9% of the salemargin, 23.1% of the sale')
    fireEvent.click(screen.getByTestId('materials-markup-save'))
    await waitFor(() => expect(state.upserts).toEqual([{ key: 'materials_markup_pct_v1', value_num: 30 }]))
    fireEvent.change(screen.getByTestId('materials-markup-input'), { target: { value: '' } })
    fireEvent.click(screen.getByTestId('materials-markup-save'))
    await waitFor(() => expect(state.upserts).toHaveLength(2))
    expect(state.upserts[1]).toEqual({ key: 'materials_markup_pct_v1', value_num: null })
  })

  it('a margin typed fills the markup box and saves the markup it makes; a margin of 100 is refused, the bar hides and Save stays dead', async () => {
    state.row = null
    state.upserts = []
    renderWithProviders(<MaterialsMarkupSettingsBlock />)
    await waitFor(() => expect(screen.getByTestId('materials-markup-input-margin')).toBeTruthy())
    fireEvent.change(screen.getByTestId('materials-markup-input-margin'), { target: { value: '20' } })
    expect((screen.getByTestId('materials-markup-input') as HTMLInputElement).value).toBe('25')
    expect(screen.getByTestId('materials-markup-input-bar-pays').textContent).toBe('the customer pays $1,250.00')
    fireEvent.click(screen.getByTestId('materials-markup-save'))
    await waitFor(() => expect(state.upserts).toEqual([{ key: 'materials_markup_pct_v1', value_num: 25 }]))
    fireEvent.change(screen.getByTestId('materials-markup-input-margin'), { target: { value: '100' } })
    expect(screen.getByTestId('materials-markup-input-refusal').textContent).toBe('A margin on the sale is under 100%.')
    expect(screen.queryByTestId('materials-markup-input-bar')).toBeNull()
    expect((screen.getByTestId('materials-markup-input') as HTMLInputElement).value).toBe('')
    expect((screen.getByTestId('materials-markup-save') as HTMLButtonElement).disabled).toBe(true)
  })
})
