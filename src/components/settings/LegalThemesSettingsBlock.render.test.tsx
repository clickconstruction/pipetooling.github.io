// @vitest-environment jsdom
/**
 * Settings → People & teams → Themes on the record (v2.6545) over a fake io: the standing themes by name with their
 * mark counts and the proof behind them, the agent's proposal dashed with Keep, the retired ones folded, Edit in
 * place, Retire after a confirm that names the marks, and a save the database refuses keeping its words. Made-up
 * themes only.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LegalTheme, LegalThemeMark } from '../../lib/legal/legalThemes'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import LegalThemesSettingsBlock from './LegalThemesSettingsBlock'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue, useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  const value = () => makeUseAuthValue({ role: 'dev' })
  return { ...useAuthModuleMock(), useAuth: value, useOptionalAuth: value }
})

const io = vi.hoisted(() => ({
  themes: [] as unknown[],
  marks: [] as unknown[],
  addTheme: vi.fn(async () => ({ ok: true as const, id: 't-new' })),
  updateTheme: vi.fn(async () => ({ ok: true as const, id: 't1' })),
  retireTheme: vi.fn(async () => ({ ok: true as const, id: 't1' })),
  keepTheme: vi.fn(async () => ({ ok: true as const, id: 't3' })),
}))
vi.mock('../../lib/legal/legalThemesIo', () => ({
  loadThemes: vi.fn(async () => ({ themes: io.themes, marks: io.marks, heldWhy: null })),
  addTheme: io.addTheme,
  updateTheme: io.updateTheme,
  retireTheme: io.retireTheme,
  keepTheme: io.keepTheme,
}))

const theme = (over: Partial<LegalTheme>): LegalTheme => ({
  id: 't1',
  name: 'Dishonesty',
  what_counts: '',
  counsel_words: '',
  created_by: null,
  created_at: '2026-11-05T00:00:00Z',
  updated_at: '2026-11-05T00:00:00Z',
  retired_at: null,
  retired_by: null,
  proposed_by_agent: false,
  kept_at: null,
  ...over,
})
const mark = (over: Partial<LegalThemeMark>): LegalThemeMark => ({
  id: 'm1',
  theme_id: 't1',
  target_kind: 'hr_entry',
  target_id: 'e1',
  person_id: 'p1',
  matter_id: null,
  why: '',
  proves_by: 'document',
  marked_by: null,
  marked_at: '2026-11-05T00:00:00Z',
  author_label: null,
  proposed: false,
  kept_at: null,
  kept_by: null,
  removed_at: null,
  removed_by: null,
  removed_why: '',
  ...over,
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  io.themes = []
  io.marks = []
})

describe('LegalThemesSettingsBlock', () => {
  it('lists the standing themes with their marks and proof, the proposal dashed, the retired folded', async () => {
    io.themes = [
      theme({ id: 't2', name: 'Interference with the business', what_counts: 'Work taken to a side company.', counsel_words: 'Tortious interference' }),
      theme({ id: 't1', name: 'Dishonesty' }),
      theme({ id: 't3', name: 'Late to jobs', proposed_by_agent: true }),
      theme({ id: 't4', name: 'Old theme', retired_at: '2026-10-01T00:00:00Z' }),
    ]
    io.marks = [mark({ id: 'm1' }), mark({ id: 'm2', target_id: 'e2', proves_by: 'firsthand', proposed: true }), mark({ id: 'm3', target_id: 'e3', removed_at: '2026-11-05T01:00:00Z' })]
    renderWithProviders(<LegalThemesSettingsBlock />)
    const list = await screen.findByTestId('theme-list')
    const names = Array.from(list.querySelectorAll('li')).map((li) => li.querySelector('span')?.textContent)
    expect(names).toEqual(['Dishonesty', 'Interference with the business', 'Late to jobs'])
    const dishonesty = screen.getByTestId('theme-row-t1')
    expect(dishonesty.querySelector('[data-testid="theme-mark-count"]')?.textContent).toBe('2 marks')
    expect(dishonesty.querySelector('[data-testid="theme-proof"]')?.textContent).toBe('1 by a document · 0 by their own words · 1 firsthand · 0 relayed · 1 proposed by the agent, not yet kept')
    expect(screen.getByTestId('theme-row-t2').textContent).toContain('Counsel’s words: Tortious interference')
    const proposal = screen.getByTestId('theme-row-t3')
    expect(proposal.style.border).toContain('dashed')
    expect(proposal.querySelector('[data-testid="theme-keep"]')).not.toBeNull()
    expect(screen.queryByTestId('theme-row-t4')).toBeNull()
    fireEvent.click(screen.getByTestId('theme-show-retired'))
    expect(screen.getByTestId('theme-row-t4').textContent).toContain('retired · no marks yet')
    expect(screen.getByTestId('theme-row-t4').querySelector('[data-testid="theme-retire"]')?.textContent).toBe('Bring back')
  })

  it('adds a theme from the form, refuses a standing name in words, and keeps a refused save’s words', async () => {
    io.themes = [theme({ id: 't1', name: 'Dishonesty' })]
    renderWithProviders(<LegalThemesSettingsBlock />)
    await screen.findByTestId('theme-list')
    fireEvent.click(screen.getByTestId('theme-add'))
    const name = screen.getByTestId('theme-name') as HTMLInputElement
    fireEvent.change(name, { target: { value: 'dishonesty' } })
    expect(screen.getByTestId('theme-problem').textContent).toBe('A theme named Dishonesty already stands.')
    expect((screen.getByTestId('theme-save') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(name, { target: { value: 'Disrespectful conduct' } })
    fireEvent.change(screen.getByTestId('theme-what-counts'), { target: { value: 'Words to a customer no one should hear.' } })
    expect(screen.queryByTestId('theme-problem')).toBeNull()
    fireEvent.click(screen.getByTestId('theme-save'))
    await waitFor(() => expect(io.addTheme).toHaveBeenCalledWith({ name: 'Disrespectful conduct', whatCounts: 'Words to a customer no one should hear.', counselWords: '' }, expect.any(String)))
    await waitFor(() => expect(screen.queryByTestId('theme-form')).toBeNull())

    io.addTheme.mockResolvedValueOnce({ ok: false, why: 'Themes are not on this database yet: the migration has not been pushed.' } as never)
    fireEvent.click(screen.getByTestId('theme-add'))
    fireEvent.change(screen.getByTestId('theme-name'), { target: { value: 'Another' } })
    fireEvent.click(screen.getByTestId('theme-save'))
    await waitFor(() => expect(io.addTheme).toHaveBeenCalledTimes(2))
    expect(screen.getByTestId('theme-form')).not.toBeNull()
    expect((screen.getByTestId('theme-name') as HTMLInputElement).value).toBe('Another')
  })

  it('edits a theme in place and retires one after a confirm that names its marks', async () => {
    io.themes = [theme({ id: 't1', name: 'Dishonesty', what_counts: 'A false statement.' })]
    io.marks = [mark({ id: 'm1' })]
    renderWithProviders(<LegalThemesSettingsBlock />)
    await screen.findByTestId('theme-list')
    fireEvent.click(screen.getByTestId('theme-edit'))
    expect((screen.getByTestId('theme-what-counts') as HTMLTextAreaElement).value).toBe('A false statement.')
    fireEvent.change(screen.getByTestId('theme-counsel-words'), { target: { value: 'Breach of the duty of loyalty' } })
    fireEvent.click(screen.getByTestId('theme-save'))
    await waitFor(() => expect(io.updateTheme).toHaveBeenCalledWith('t1', { name: 'Dishonesty', whatCounts: 'A false statement.', counselWords: 'Breach of the duty of loyalty' }))
    await waitFor(() => expect(screen.queryByTestId('theme-form')).toBeNull())

    fireEvent.click(screen.getByTestId('theme-retire'))
    const dialog = screen.getByRole('alertdialog')
    expect(dialog.textContent).toContain('Retire Dishonesty?')
    expect(dialog.textContent).toContain('1 mark on it keep their meaning.')
    fireEvent.click(screen.getByRole('button', { name: 'Retire the theme' }))
    await waitFor(() => expect(io.retireTheme).toHaveBeenCalledWith('t1', true, expect.any(String)))
  })

  it('offers the first theme when the catalog is empty', async () => {
    renderWithProviders(<LegalThemesSettingsBlock />)
    await waitFor(() => expect(screen.getByText('No themes yet.')).not.toBeNull())
    fireEvent.click(screen.getAllByRole('button', { name: '+ Add a theme' })[1]!)
    expect(screen.getByTestId('theme-form')).not.toBeNull()
  })
})
