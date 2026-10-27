// @vitest-environment jsdom
/**
 * The card and the ? (punch list #187, PR 3): the rows in order with the door that opens the guide
 * beside the desk, Close; the button records one `legend_opened` row, loses its dot on the first press
 * and keeps it gone for the person.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { DeskLegendCard, LegendCard } from './LegendCard'
import { LegendButton } from './LegendButton'
import { LIEN_DESK_LEGEND } from '../../lib/jobs/lienDeskLegend'
import { JOB_WINDOW_LEGEND } from '../../lib/jobs/jobWindowLegend'
import { SMOKE_AUTH_USER_ID, installDomShims } from '../../test/renderSmokeMocks'

installDomShims()

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})

const inserts: Array<{ table: string; row: Record<string, unknown> }> = []
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => {
        inserts.push({ table, row })
        return Promise.resolve({ data: null, error: null })
      },
    }),
  },
}))

afterEach(() => {
  cleanup()
  inserts.length = 0
  localStorage.clear()
})

describe('LegendCard', () => {
  it('draws the rows in order, the door to the guide in a new tab, and Close', () => {
    const onClose = vi.fn()
    render(<DeskLegendCard legend={LIEN_DESK_LEGEND} phone={false} onClose={onClose} />)
    const card = screen.getByTestId('legend-card-lien-desk')
    expect(card.getAttribute('aria-label')).toBe('What this desk holds')
    expect(card.textContent).toContain('Do now')
    expect(card.textContent).toContain('Every lien paper that needs someone to act')
    const door = screen.getByTestId('legend-card-lien-desk-guide') as HTMLAnchorElement
    expect(door.getAttribute('href')).toBe('/help?g=send-lien-notices-from-the-lien-desk&via=legend')
    expect(door.getAttribute('target')).toBe('_blank')
    expect(door.textContent).toBe('Read the guide: send lien notices from the Lien desk →')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows the phone rows at phone width, and draws without a door when none is given', () => {
    render(<DeskLegendCard legend={JOB_WINDOW_LEGEND} phone onClose={() => {}} />)
    expect(screen.getByTestId('legend-card-job-window').textContent).toContain('The bar')
    expect(screen.getByTestId('legend-card-job-window').textContent).not.toContain('The icons')
    cleanup()
    render(<LegendCard rows={[{ key: 'a', label: 'A', note: 'One.' }]} label="x" onClose={() => {}} />)
    expect(screen.queryByTestId('legend-card-guide')).toBeNull()
  })
})

describe('LegendButton', () => {
  it('wears the dot until pressed, records one legend_opened row on opening, and keeps the press for the person', () => {
    const onToggle = vi.fn()
    const { rerender } = render(<LegendButton legend={LIEN_DESK_LEGEND} open={false} onToggle={onToggle} />)
    expect(screen.getByTestId('legend-dot-lien-desk')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'What this desk holds' }))
    expect(onToggle).toHaveBeenCalledWith(true)
    expect(inserts.filter((i) => i.table === 'ui_nav_clicks').map((i) => i.row)).toEqual([expect.objectContaining({ control: 'legend_opened', target: '#lien-desk', role: 'assistant' })])
    expect(localStorage.getItem(`helpLegendPressed:lien-desk:${SMOKE_AUTH_USER_ID}`)).toContain('"pressed":true')
    rerender(<LegendButton legend={LIEN_DESK_LEGEND} open onToggle={onToggle} />)
    expect(screen.queryByTestId('legend-dot-lien-desk')).toBeNull()
    expect(screen.getByRole('button', { name: 'What this desk holds' }).getAttribute('aria-expanded')).toBe('true')
    // Closing writes nothing.
    fireEvent.click(screen.getByRole('button', { name: 'What this desk holds' }))
    expect(onToggle).toHaveBeenLastCalledWith(false)
    expect(inserts.filter((i) => i.table === 'ui_nav_clicks')).toHaveLength(1)
    cleanup()
    render(<LegendButton legend={LIEN_DESK_LEGEND} open={false} onToggle={onToggle} />)
    expect(screen.queryByTestId('legend-dot-lien-desk')).toBeNull()
  })
})

describe('LegendButton with a shared dot (punch list #187 PR 5)', () => {
  it('one press clears the dot for every ? that shares the key, and the row still names the station', () => {
    const a = { ...LIEN_DESK_LEGEND, key: 'quickfill-warnings' }
    const b = { ...LIEN_DESK_LEGEND, key: 'quickfill-texts' }
    render(<LegendButton legend={a} pressedKey="quickfill-station" open={false} onToggle={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'What this desk holds' }))
    expect(inserts.filter((i) => i.table === 'ui_nav_clicks').map((i) => i.row.target)).toEqual(['#quickfill-warnings'])
    cleanup()
    render(<LegendButton legend={b} pressedKey="quickfill-station" open={false} onToggle={() => {}} />)
    expect(screen.queryByTestId('legend-dot-quickfill-texts')).toBeNull()
  })
})

describe('on a phone (punch list #187, checked live 2026-10-26)', () => {
  it('a desk’s card rises as a sheet over the desk, the name above each sentence', () => {
    const mm = window.matchMedia
    window.matchMedia = ((q: string) => ({ matches: true, media: q, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
    try {
      const onClose = vi.fn()
      render(<DeskLegendCard legend={LIEN_DESK_LEGEND} phone onClose={onClose} />)
      const sheet = screen.getByRole('dialog', { name: 'What this desk holds' })
      expect(sheet.getAttribute('data-legend-sheet')).toBe('lien-desk')
      expect(sheet.parentElement?.getAttribute('data-phone-sheet')).toBe('sheet')
      const card = screen.getByTestId('legend-card-lien-desk')
      expect(card.hasAttribute('data-stacked')).toBe(true)
      expect(card.style.gridTemplateColumns).toBe('1fr')
      expect(card.textContent).toContain('Do now')
      fireEvent.click(within(card).getByRole('button', { name: 'Close' }))
      expect(onClose).toHaveBeenCalledTimes(1)
    } finally {
      window.matchMedia = mm
    }
  })

  it('at a desk the card sits in place in two columns', () => {
    render(<DeskLegendCard legend={LIEN_DESK_LEGEND} phone={false} onClose={() => {}} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByTestId('legend-card-lien-desk').hasAttribute('data-stacked')).toBe(false)
  })
})

