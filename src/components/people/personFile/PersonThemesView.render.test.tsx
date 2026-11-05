// @vitest-environment jsdom
/**
 * By theme (v2.6547, punch list #269 T3) over made-up lines and marks: one theme at a time with the counts a person
 * tells counsel, its items oldest first or strongest first and narrowed by a grade; a press opens the item window
 * with the kicker, the body, every theme on it and the nearby lines, Next and Escape move and close it; Copy puts the
 * list on the clipboard; a pick writes through to the address.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { LegalTheme, LegalThemeMark } from '../../../lib/legal/legalThemes'
import type { PersonTimelineLine } from '../../../lib/people/personTimeline'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import { PersonThemesView } from './PersonThemesView'

const theme = (id: string, name: string, over: Partial<LegalTheme> = {}): LegalTheme => ({ id, name, what_counts: '', counsel_words: '', created_by: null, created_at: '2026-11-05T00:00:00Z', updated_at: '2026-11-05T00:00:00Z', retired_at: null, retired_by: null, proposed_by_agent: false, kept_at: null, ...over })
const line = (key: string, ymd: string, table: string, id: string, what: string, files: string[] = []): PersonTimelineLine => ({ key, lane: 'did', source: 'file', ymd, loggedAt: `${ymd}T12:00:00Z`, kindWords: 'incident', what, notes: '', byName: 'Dana O.', state: 'live', ref: { table, id }, door: null, attachmentIds: files })
const mark = (over: Partial<LegalThemeMark>): LegalThemeMark => ({ id: 'm', theme_id: 't1', target_kind: 'hr_entry', target_id: 'e', person_id: 'p1', matter_id: null, why: '', proves_by: null, marked_by: 'u1', marked_at: '2026-08-08T00:00:00Z', author_label: null, proposed: false, kept_at: '2026-08-08T00:00:00Z', kept_by: 'u1', removed_at: null, removed_by: null, removed_why: '', ...over })

const THEMES = [theme('t1', 'Company money without say-so', { what_counts: 'Spend after an instruction not to.', counsel_words: 'unauthorized expenditure' }), theme('t2', 'Dishonesty')]
const LINES = [
  line('entry:e4', '2026-07-22', 'person_file_entries', 'e4', 'Card charges on a day with no job.', ['f1']),
  line('entry:e1', '2026-04-03', 'person_file_entries', 'e1', 'Satellite service bought on the company card with no say-so.'),
  line('evidence:v1', '2026-06-26', 'person_file_evidence', 'v1', 'Text: cancel the satellite service, third time.', ['f2']),
  line('entry:e2', '2026-05-30', 'person_file_entries', 'e2', 'First instruction to cancel, by phone.'),
  line('entry:e9', '2026-06-12', 'person_file_entries', 'e9', 'Second instruction, by phone.'),
]
const MARKS = [
  mark({ id: 'm1', target_id: 'e1', proves_by: 'document', why: 'the statement shows it' }),
  mark({ id: 'm2', target_id: 'e2', proves_by: 'firsthand' }),
  mark({ id: 'm3', target_kind: 'hr_evidence', target_id: 'v1', proves_by: 'document', why: 'written instruction ignored' }),
  mark({ id: 'm4', target_id: 'e4', proves_by: 'document', proposed: true, kept_at: null, kept_by: null }),
  mark({ id: 'm5', theme_id: 't2', target_id: 'e4', proves_by: 'own_words' }),
]

const io = { onPickTheme: vi.fn(), onOpenOnTimeline: vi.fn(), onKeepMark: vi.fn(async () => undefined), onRemoveMark: vi.fn(async () => true) }

function draw(themeId: string | null = 't1') {
  return renderWithProviders(<PersonThemesView personName="Jordan Vale" themes={THEMES} marks={MARKS} lines={LINES} themeId={themeId} canWrite namesById={{ u1: 'Dana O.' }} renderFiles={(l) => l.attachmentIds.map((f) => <span key={f}>{f}</span>)} {...io} />)
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('PersonThemesView', () => {
  it('holds one theme with its counts, lists its items oldest first, and reorders and narrows', () => {
    draw()
    expect(screen.getByTestId('by-theme-pick-t1').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('by-theme-pick-t1').textContent).toBe('Company money without say-so · 4')
    expect(screen.getByTestId('by-theme-pick-t2').textContent).toBe('Dishonesty · 1')
    expect(screen.getByText('Spend after an instruction not to.')).toBeTruthy()
    expect(screen.getByTestId('by-theme-head').textContent).toBe('4 items · first Apr 3, 2026 · last Jul 22, 2026 · 2 with a file')
    expect(screen.getByTestId('by-theme-proof').textContent).toBe('3 by a document · 0 by their own words · 1 firsthand · 0 relayed')
    expect(screen.getByText('1 proposed by the agent, not yet kept')).toBeTruthy()
    const keys = () => Array.from(screen.getByTestId('by-theme-items').querySelectorAll('button[data-testid^="by-theme-item-"]')).map((b) => b.getAttribute('data-testid'))
    expect(keys()).toEqual(['by-theme-item-entry:e1', 'by-theme-item-entry:e2', 'by-theme-item-evidence:v1', 'by-theme-item-entry:e4'])
    fireEvent.click(screen.getByTestId('by-theme-order-strongest'))
    expect(keys()).toEqual(['by-theme-item-entry:e1', 'by-theme-item-evidence:v1', 'by-theme-item-entry:e4', 'by-theme-item-entry:e2'])
    fireEvent.click(screen.getByTestId('by-theme-show-firsthand'))
    expect(keys()).toEqual(['by-theme-item-entry:e2'])
    fireEvent.click(screen.getByTestId('by-theme-show-proposed'))
    expect(keys()).toEqual(['by-theme-item-entry:e4'])
    fireEvent.click(screen.getByTestId('by-theme-pick-t2'))
    expect(io.onPickTheme).toHaveBeenCalledWith('t2')
  })

  it('opens an item in a window over the list with the kicker, the body, the themes on it and the nearby lines; Next and Escape move and close', async () => {
    draw()
    fireEvent.click(screen.getByTestId('by-theme-item-evidence:v1'))
    const win = screen.getByTestId('by-theme-item-window')
    expect(within(win).getByTestId('by-theme-item-kicker').textContent).toBe('Company money without say-so · item 3 of 4')
    expect(within(win).getByTestId('by-theme-item-body').textContent).toContain('Text: cancel the satellite service, third time.')
    expect(within(win).getByText('f2')).toBeTruthy()
    expect(within(win).getByTestId('by-theme-item-themes').textContent).toContain('why: written instruction ignored · Dana O.,')
    // Nearby on the record: the two lines either side by day; the one on the theme is a press.
    expect(within(win).getByRole('button', { name: /May 30, 2026 · First instruction/ })).toBeTruthy()
    expect(within(win).getByText(/Jun 12, 2026 · Second instruction/).tagName).toBe('SPAN')
    fireEvent.click(within(win).getByTestId('by-theme-next'))
    expect(within(win).getByTestId('by-theme-item-kicker').textContent).toBe('Company money without say-so · item 4 of 4')
    expect((within(win).getByTestId('by-theme-next') as HTMLButtonElement).disabled).toBe(true)
    expect(within(win).getByTestId('by-theme-item-themes').textContent).toContain('Dishonesty')
    fireEvent.click(within(win).getByRole('button', { name: 'Keep' }))
    await waitFor(() => expect(io.onKeepMark).toHaveBeenCalledWith('m4'))
    fireEvent.click(within(win).getByTestId('by-theme-open-timeline'))
    expect(io.onOpenOnTimeline).toHaveBeenCalledWith('entry:e4')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('by-theme-item-window')).toBeNull()
  })

  it('copies the theme as a list for counsel', async () => {
    const writeText = vi.fn(async () => undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    draw()
    fireEvent.click(screen.getByTestId('by-theme-copy'))
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    const text = (writeText.mock.calls[0] as unknown as [string])[0]
    expect(text.split('\n')[0]).toBe('Company money without say-so — Jordan Vale')
    expect(text).toContain('Counsel’s words: unauthorized expenditure')
    expect(text).toContain('1. Apr 3, 2026 · incident · Satellite service bought on the company card with no say-so.')
    expect(text).toContain('proves it by a document · why: the statement shows it · marked by Dana O.')
    expect(text).toContain('(proposed, not yet kept)')
  })

  it('says where the first theme is named when the catalog is empty', () => {
    renderWithProviders(<PersonThemesView personName="Jordan Vale" themes={[]} marks={[]} lines={LINES} themeId={null} canWrite namesById={{}} renderFiles={() => null} {...io} />)
    expect(screen.getByText('No theme to read by yet.')).toBeTruthy()
  })
})
