// @vitest-environment jsdom
/**
 * Themes on the HR file's Timeline (v2.6546, punch list #269 T2) over a fake themes io and canned HR rows: the entry
 * composer's picker writes its marks after the row; the Themes row counts the lines a theme is on and filters to
 * them; + theme under a line marks it in place with the themes it carries held still; ticked lines are marked at
 * once from the bulk bar; ✕ on a mark asks why and stamps it off; a proposed mark is kept. Made-up people only.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { LegalTheme, LegalThemeMark } from '../../../lib/legal/legalThemes'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import { PersonFilePanel } from './PersonFilePanel'

const TABLE_ROWS: Record<string, unknown[]> = {
  people: [{ id: 'p-marcus', name: 'Marcus Reed', kind: 'helper', archived_at: null, start_date: '2025-03-11', end_date: null, account_user_id: 'u-marcus' }],
  person_files: [],
  person_file_entries: [
    { id: 'e1', person_id: 'p-marcus', entry_date: '2026-07-18', content: 'Sit-down about Master hours.', source: 'review', created_by: 'u-dev', created_at: '2026-07-18T12:00:00.000Z', author_label: null },
    { id: 'e2', person_id: 'p-marcus', entry_date: '2026-08-19', content: 'Re-ran the vent stack on 6th St.', source: 'job_event', created_by: null, created_at: '2026-08-19T12:00:00.000Z', author_label: null },
  ],
  users: [{ id: 'u-dev', name: 'Robert' }],
  person_file_attachments: [],
  person_file_evidence: [],
  person_reports: [],
  person_contract_documents: [],
  person_licenses: [],
  writeups: [],
  writeup_templates: [],
  attendance_incidents: [],
  attendance_annotations: [],
}

vi.mock('../../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

vi.mock('../../../lib/supabase', () => {
  function makeBuilder(rows: unknown[]): Record<string, unknown> {
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'in', 'order', 'range', 'limit']) builder[m] = () => builder
    builder.single = () => Promise.resolve({ data: rows[0] ?? null, error: null })
    builder.maybeSingle = () => Promise.resolve({ data: rows[0] ?? null, error: null })
    builder.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => Promise.resolve({ data: rows, error: null, count: rows.length }).then(onFulfilled, onRejected)
    return builder
  }
  return {
    supabase: {
      from: (table: string) => makeBuilder(TABLE_ROWS[table] ?? []),
      rpc: () => Promise.resolve({ data: null, error: null }),
      storage: { from: () => ({ upload: () => Promise.resolve({ error: null }) }) },
      functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
    },
  }
})

const io = vi.hoisted(() => ({
  themes: [] as unknown[],
  marks: [] as unknown[],
  addMarks: vi.fn(async () => ({ ok: true as const, made: 1, already: 0, failWhy: null })),
  removeMark: vi.fn(async () => ({ ok: true as const })),
  keepMark: vi.fn(async () => ({ ok: true as const })),
}))
vi.mock('../../../lib/legal/legalThemesIo', () => ({
  loadThemes: vi.fn(async () => ({ themes: io.themes, marks: io.marks, heldWhy: null })),
  addMarks: io.addMarks,
  removeMark: io.removeMark,
  keepMark: io.keepMark,
}))

const theme = (id: string, name: string): LegalTheme => ({ id, name, what_counts: '', counsel_words: '', created_by: null, created_at: '2026-11-05T00:00:00Z', updated_at: '2026-11-05T00:00:00Z', retired_at: null, retired_by: null, proposed_by_agent: false, kept_at: null })
const mark = (over: Partial<LegalThemeMark>): LegalThemeMark => ({
  id: 'm1',
  theme_id: 't1',
  target_kind: 'hr_entry',
  target_id: 'e1',
  person_id: 'p-marcus',
  matter_id: null,
  why: 'said one thing, did another',
  proves_by: 'firsthand',
  marked_by: 'u-dev',
  marked_at: '2026-11-05T00:00:00Z',
  author_label: null,
  proposed: false,
  kept_at: '2026-11-05T00:00:00Z',
  kept_by: 'u-dev',
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

const VIEWER = { isDev: true, canAccessContracts: true, canAccessLicenses: true }

async function open() {
  renderWithProviders(<PersonFilePanel personId="p-marcus" userId="u-marcus" personName="Marcus Reed" viewer={VIEWER} />)
  expect(await screen.findByText('Sit-down about Master hours.')).toBeTruthy()
}

describe('PersonFilePanel · themes on the Timeline', () => {
  it('the entry composer carries the picker and writes the marks after the row', async () => {
    io.themes = [theme('t1', 'Dishonesty'), theme('t2', 'Interference with the business')]
    await open()
    fireEvent.click(screen.getByRole('button', { name: '+ Add entry' }))
    const picker = await screen.findByTestId('entry-theme-picker')
    fireEvent.click(within(picker).getByTestId('theme-pick-t1'))
    fireEvent.change(within(picker).getByTestId('theme-mark-why'), { target: { value: 'a false statement to the owner' } })
    fireEvent.click(within(picker).getByTestId('theme-proves-document'))
    fireEvent.change(screen.getByPlaceholderText('What happened. Facts and dates, no guesses.'), { target: { value: 'Told the owner the van was serviced. The shop says it was not.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add entry' }))
    await waitFor(() => expect(io.addMarks).toHaveBeenCalledTimes(1))
    expect(io.addMarks).toHaveBeenCalledWith(expect.objectContaining({ themeIds: ['t1'], targets: [{ kind: 'hr_entry', id: 'e1' }], personId: 'p-marcus', matterId: null, why: 'a false statement to the owner', provesBy: 'document' }))
  })

  it('the Themes row counts and filters, + theme marks a line in place with what it carries held still, and ✕ takes a mark off with a reason', async () => {
    io.themes = [theme('t1', 'Dishonesty'), theme('t2', 'Interference with the business')]
    io.marks = [mark({ id: 'm1' })]
    await open()
    const row = await screen.findByTestId('timeline-theme-row')
    expect(within(row).getByRole('button', { name: 'Dishonesty · 1' })).toBeTruthy()
    expect(within(row).queryByRole('button', { name: /Interference/ })).toBeNull()
    const e1 = screen.getByText('Sit-down about Master hours.').closest('li')!
    expect(within(e1).getByTestId('line-theme-m1').textContent).toContain('Dishonesty')
    expect(within(e1).getByTestId('line-theme-m1').getAttribute('title')).toBe('why: said one thing, did another · proves it by a firsthand account')
    fireEvent.click(within(row).getByRole('button', { name: 'Dishonesty · 1' }))
    expect(screen.queryByText('Re-ran the vent stack on 6th St.')).toBeNull()
    fireEvent.click(within(row).getByRole('button', { name: 'Dishonesty · 1' }))
    const e2 = (await screen.findByText('Re-ran the vent stack on 6th St.')).closest('li')!
    fireEvent.click(within(e2).getByRole('button', { name: '+ theme' }))
    const picker = within(e2).getByTestId(/line-theme-picker-/)
    fireEvent.click(within(picker).getByTestId('theme-pick-t2'))
    fireEvent.click(within(picker).getByRole('button', { name: 'Mark 1 theme' }))
    await waitFor(() => expect(io.addMarks).toHaveBeenCalledWith(expect.objectContaining({ themeIds: ['t2'], targets: [{ kind: 'hr_entry', id: 'e2' }] })))
    // On e1 the theme it carries is pressed and still.
    fireEvent.click(within(e1).getByRole('button', { name: '+ theme' }))
    const still = within(e1).getByTestId('theme-pick-t1') as HTMLButtonElement
    expect(still.disabled).toBe(true)
    expect(still.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(within(e1).getByRole('button', { name: 'Take Dishonesty off this line' }))
    fireEvent.change(within(e1).getByPlaceholderText('Why is the theme coming off?'), { target: { value: 'wrong theme' } })
    fireEvent.click(within(e1).getByRole('button', { name: 'Take it off' }))
    await waitFor(() => expect(io.removeMark).toHaveBeenCalledWith('m1', 'wrong theme', expect.anything()))
  })

  it('ticked lines are marked at once from the bulk bar, and a proposed mark is kept', async () => {
    io.themes = [theme('t1', 'Dishonesty')]
    io.marks = [mark({ id: 'm9', target_id: 'e2', proposed: true, kept_at: null, kept_by: null })]
    await open()
    expect(screen.queryByTestId('timeline-bulk-bar')).toBeNull()
    fireEvent.click(screen.getByTestId('line-tick-entry:e1'))
    fireEvent.click(screen.getByTestId('line-tick-entry:e2'))
    const bar = screen.getByTestId('timeline-bulk-bar')
    expect(within(bar).getByText('2 lines ticked')).toBeTruthy()
    const press = within(bar).getByTestId('bulk-mark') as HTMLButtonElement
    expect(press.textContent).toBe('Mark 2 lines')
    expect(press.disabled).toBe(true)
    fireEvent.click(within(bar).getByTestId('theme-pick-t1'))
    expect(press.disabled).toBe(false)
    fireEvent.click(press)
    await waitFor(() => expect(io.addMarks).toHaveBeenCalledWith(expect.objectContaining({ themeIds: ['t1'], targets: [{ kind: 'hr_entry', id: 'e2' }, { kind: 'hr_entry', id: 'e1' }] })))
    await waitFor(() => expect(screen.queryByTestId('timeline-bulk-bar')).toBeNull())
    const chip = screen.getByTestId('line-theme-m9')
    expect(chip.textContent).toContain('proposed')
    fireEvent.click(within(chip).getByRole('button', { name: 'Keep' }))
    await waitFor(() => expect(io.keepMark).toHaveBeenCalledWith('m9', expect.anything()))
  })
})
