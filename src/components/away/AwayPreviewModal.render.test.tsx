// @vitest-environment jsdom
/**
 * See what they see (v2.6846): the window an Away row opens on the page a teammate who is away meets at sign-in. The
 * reads are mocked; the smoke proves the wiring: the bar says it is a preview and whose screen it is, the page under
 * it is the sign-in's own page with the note, the countdown, the city and the office line, every press on the page is
 * dead, On the day draws the day-of words, Close the preview and Escape close it, and nothing is saved or taken down.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'

const io = vi.hoisted(() => ({ row: null as unknown, fail: false, saves: 0, clears: 0, reads: 0 }))
vi.mock('../../lib/people/awayNoteIo', () => ({
  loadAwayNote: async () => {
    io.reads += 1
    if (io.fail) throw new Error('permission denied for table away_notes')
    return { draft: {}, row: io.row }
  },
  loadAwayOffice: async () => ({ address: '12925 FM 20, Kingsbury, TX 78638', latLng: { lat: 29.65, lng: -97.81 }, phone: '(512) 555-0142' }),
  saveAwayNote: async () => {
    io.saves += 1
    return { sealed: true }
  },
  clearAwayNote: async () => {
    io.clears += 1
  },
}))
vi.mock('../../lib/supabase', () => ({ supabase: { from: () => ({ insert: async () => ({ error: null }) }), rpc: async () => ({ data: null, error: null }) } }))
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'dev' })
})

import { AwayPreviewModal } from './AwayPreviewModal'

const ROW = { user_id: 'u-corinne', words: 'Your spot on the crew is waiting.', countdown_ymd: '2099-11-05', show_where: true, show_call: true, alert_on_day: true, updated_at: '2026-11-03T15:00:00Z' }

function renderPreview(extra: { hasLogin?: boolean; onClose?: () => void } = {}) {
  return renderWithProviders(<AwayPreviewModal userId="u-corinne" displayName="Corinne Vela" loginName="Corinne Vela" leftYmd="2026-11-03" hasLogin={extra.hasLogin ?? true} onClose={extra.onClose ?? (() => {})} />)
}

describe('AwayPreviewModal', () => {
  beforeEach(() => {
    io.row = ROW
    io.fail = false
    io.saves = 0
    io.clears = 0
    io.reads = 0
  })

  it("says it is a preview and whose, and draws the sign-in's own page under the bar", async () => {
    renderPreview()
    expect(screen.getByRole('dialog', { name: "Preview of Corinne Vela's sign-in screen" })).toBeTruthy()
    expect(screen.getByText('Preview')).toBeTruthy()
    expect(screen.getByText('Corinne Vela meets this screen at sign-in. You are still signed in as yourself.')).toBeTruthy()
    await screen.findByText('See you soon, Corinne.')
    const page = document.querySelector('[data-away-preview-frame] [data-away-page]') as HTMLElement
    expect(page.textContent).toContain('ClickTooling')
    expect(page.textContent).toContain('Your spot on the crew is waiting.')
    expect(page.textContent).toContain("We're in Kingsbury, TX")
    expect(screen.getByRole('group', { name: /until you're back/ })).toBeTruthy()
    expect(screen.getByText('The buttons do nothing here. Theirs do.')).toBeTruthy()
  })

  it('every press on their page is dead, and nothing is saved or taken down', async () => {
    renderPreview()
    await screen.findByText('See you soon, Corinne.')
    for (const name of ['Sign out', 'Use my location', 'Call the office', 'Text the office']) {
      const press = screen.getByRole('button', { name }) as HTMLButtonElement
      expect(press.disabled).toBe(true)
      fireEvent.click(press)
    }
    expect(screen.queryByRole('link', { name: 'Call the office' })).toBeNull()
    expect(io.saves).toBe(0)
    expect(io.clears).toBe(0)
  })

  it('On the day draws the day-of words, and Today brings the note back', async () => {
    renderPreview()
    await screen.findByText('See you soon, Corinne.')
    fireEvent.click(screen.getByRole('button', { name: 'On the day' }))
    await settle()
    expect(screen.getByText("Today's the day.")).toBeTruthy()
    expect(screen.queryByText('See you soon, Corinne.')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Today' }))
    await settle()
    expect(screen.getByText('See you soon, Corinne.')).toBeTruthy()
  })

  it('a note with no day back holds On the day', async () => {
    io.row = { ...ROW, countdown_ymd: null }
    renderPreview()
    await screen.findByText('See you soon, Corinne.')
    expect((screen.getByRole('button', { name: 'On the day' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('with no login behind the account, the bar says nothing opens yet', async () => {
    renderPreview({ hasLogin: false })
    expect(screen.getByText(/has no login, so nothing opens yet/)).toBeTruthy()
    await screen.findByText('See you soon, Corinne.')
  })

  it('a note taken down since the list was read draws the resting words', async () => {
    io.row = null
    renderPreview()
    await screen.findByText('This account is resting.')
  })

  it('a failed read shows its reason in place of a page', async () => {
    io.fail = true
    renderPreview()
    await screen.findByText(/permission denied for table away_notes/)
    expect(screen.queryByText(/See you soon/)).toBeNull()
  })

  it('Close the preview and Escape both close it', async () => {
    const onClose = vi.fn()
    renderPreview({ onClose })
    await screen.findByText('See you soon, Corinne.')
    fireEvent.click(screen.getByRole('button', { name: 'Close the preview' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(2))
  })
})
