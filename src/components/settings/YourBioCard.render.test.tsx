// @vitest-environment jsdom
/**
 * Settings → Your account → Your bio (v2.5587, punch list #114) over a fake io: a helper reads the bio as a customer
 * gets it and one switch a line; a press turns a line off or on through the io and says so; the empty words; the card
 * draws nothing for a role that never presses On my way, or while the push is not in.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bioLinesFromRows, type BioLineRow } from '../../lib/bio/bio'
import type { BioIo } from '../../lib/bio/bioIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { yourBioShown } from '../../lib/bio/bioGates'
import { YourBioCard } from './YourBioCard'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

const row = (id: string, text: string, extra: Partial<BioLineRow> = {}): BioLineRow => ({ id, text, text_es: null, position: 1, added_at: '2026-10-16T10:00:00Z', removed_at: null, off_by_user_at: null, ...extra })
const rows: BioLineRow[] = [
  row('l1', 'Luis has been a plumber for twelve years.', { position: 1 }),
  row('l2', 'Water heaters and repipes are his specialty.', { position: 2 }),
  row('l3', 'He is an Astros fan, win or lose.', { position: 3, off_by_user_at: '2026-10-16T11:00:00Z' }),
  row('l0', 'He drives a white van.', { position: 4, removed_at: '2026-10-15T00:00:00Z' }),
]

function fakeIo(lines: BioLineRow[] | null = rows, over: Partial<BioIo> = {}): BioIo {
  return {
    loadLines: vi.fn(async () => (lines ? bioLinesFromRows(lines) : null)),
    editLine: vi.fn(async () => 'x'),
    removeLine: vi.fn(async () => undefined),
    say: vi.fn(async () => undefined),
    ...over,
  }
}

afterEach(cleanup)

describe('yourBioShown', () => {
  it('is the people who press On my way', () => {
    expect(yourBioShown('helpers')).toBe(true)
    expect(yourBioShown('primary')).toBe(true)
    expect(yourBioShown('master_technician')).toBe(true)
    expect(yourBioShown('superintendent')).toBe(false)
    expect(yourBioShown('subcontractor')).toBe(false)
    expect(yourBioShown(null)).toBe(false)
  })
})

describe('YourBioCard', () => {
  it('reads the bio as a customer gets it and one switch a line', async () => {
    renderWithProviders(<YourBioCard role="helpers" name="Luis Ortega" userId="u1" io={fakeIo()} />)
    expect(await screen.findByText('Your bio')).toBeTruthy()
    expect(screen.getByTestId('your-bio-preview').textContent).toBe('A little about Luis: Luis has been a plumber for twelve years. Water heaters and repipes are his specialty.')
    const switches = screen.getAllByRole('switch')
    expect(switches).toHaveLength(3)
    expect(switches[0]!.getAttribute('aria-checked')).toBe('true')
    expect(switches[2]!.getAttribute('aria-checked')).toBe('false')
  })

  it('turns a line off and on through the io and says so', async () => {
    const io = fakeIo()
    renderWithProviders(<YourBioCard role="primary" name="Luis Ortega" userId="u1" io={io} />)
    fireEvent.click(await screen.findByRole('switch', { name: 'Luis has been a plumber for twelve years.' }))
    await waitFor(() => expect(io.say).toHaveBeenCalledWith('l1', false))
    expect(await screen.findByText('Saved. You do not say it.')).toBeTruthy()
    fireEvent.click(screen.getByRole('switch', { name: 'He is an Astros fan, win or lose.' }))
    await waitFor(() => expect(io.say).toHaveBeenCalledWith('l3', true))
    expect(await screen.findByText('Saved. You say it.')).toBeTruthy()
    await waitFor(() => expect(io.loadLines).toHaveBeenCalledTimes(3))
  })

  it('says when the office has not written one', async () => {
    renderWithProviders(<YourBioCard role="helpers" name="Luis Ortega" userId="u1" io={fakeIo([])} />)
    expect(await screen.findByText('The office has not written your bio yet. Ask them for one.')).toBeTruthy()
    expect(screen.queryByRole('switch')).toBeNull()
  })

  it('draws nothing for a superintendent, or while the push is not in', async () => {
    const io = fakeIo()
    renderWithProviders(<YourBioCard role="superintendent" name="Sam" userId="u1" io={io} />)
    expect(screen.queryByText('Your bio')).toBeNull()
    expect(io.loadLines).not.toHaveBeenCalled()
    cleanup()
    const notThere = fakeIo(null)
    renderWithProviders(<YourBioCard role="helpers" name="Luis Ortega" userId="u1" io={notThere} />)
    await waitFor(() => expect(notThere.loadLines).toHaveBeenCalled())
    expect(screen.queryByText('Your bio')).toBeNull()
  })
})
