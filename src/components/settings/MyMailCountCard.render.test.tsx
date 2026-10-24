// @vitest-environment jsdom
/**
 * Quickfill's Email station (punch list #159): Settings → Your account → Mail Quickfill counts over a fake io. A person
 * the owner put on the list reads which labels are counted, what is kept, who sees it and how the last count went; a ×
 * or a typed label saves at once; their own switch turns it off with the words for off; a person not on the list, or
 * outside the office, sees no card.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MY_MAIL_KEEPS, MY_MAIL_OFF_WORDS, MY_MAIL_SAVED, type WatchView } from '../../lib/emailIn/countCard'
import type { MyMailIo } from '../../lib/emailIn/countCardIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { MyMailCountCard } from './MyMailCountCard'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

const NOW = '2026-10-23T14:55:00.000Z'
const ROW: WatchView = {
  id: 'w-marisol',
  user_id: 'u-marisol',
  address: 'marisol@clickplumbing.example',
  labels: ['Inbox', 'Follow Up', 'Next Actions'],
  is_on: true,
  labels_state: { Inbox: { at: NOW, total: 0 }, 'Follow Up': { at: NOW, total: 2 }, 'Next Actions': { at: NOW, total: 1 } },
  last_ok_at: '2026-10-23T14:07:00Z',
  last_error: null,
  created_at: '2026-10-23T13:30:00Z',
  added_by: 'u-owner',
}

function fakeIo(row: WatchView | null, leadName: string | null = 'Dale'): MyMailIo {
  return {
    load: vi.fn(async () => ({ row, limitDays: 3, leadName, addedBy: row ? 'Robert' : null })),
    setOn: vi.fn(async () => undefined),
    setLabels: vi.fn(async () => undefined),
  }
}

afterEach(cleanup)

describe('MyMailCountCard', () => {
  it('tells the person what is counted, what is kept, who sees it and how the last count went', async () => {
    renderWithProviders(<MyMailCountCard role="assistant" userId="u-marisol" io={fakeIo(ROW)} nowIso={NOW} />)
    expect(await screen.findByText('Robert added you on Oct 23. Quickfill’s Email station counts these labels of yours and lists the threads that sit past 3 days:')).toBeTruthy()
    const labels = document.querySelector<HTMLElement>('[data-my-mail-labels]')!
    expect(labels.textContent).toContain('Inbox')
    expect(labels.textContent).toContain('Follow Up')
    expect(labels.textContent).toContain('Next Actions')
    expect(screen.getByText(MY_MAIL_KEEPS)).toBeTruthy()
    expect(screen.getByText('Who sees your rows: you and Dale. Nobody else on the station.')).toBeTruthy()
    expect(screen.getByText('Last counted today at 9:07 AM. Nothing wrong.')).toBeTruthy()
  })

  it('saves a label taken off or added at once', async () => {
    const io = fakeIo(ROW)
    renderWithProviders(<MyMailCountCard role="assistant" userId="u-marisol" io={io} nowIso={NOW} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Stop counting Next Actions' }))
    await waitFor(() => expect(io.setLabels).toHaveBeenCalledWith('w-marisol', ['Inbox', 'Follow Up']))
    expect(await screen.findByText(MY_MAIL_SAVED)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Add a label'), { target: { value: 'Waiting' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(io.setLabels).toHaveBeenLastCalledWith('w-marisol', ['Inbox', 'Follow Up', 'Waiting']))
  })

  it('switches their own count off with the words for off', async () => {
    const io = fakeIo(ROW)
    renderWithProviders(<MyMailCountCard role="assistant" userId="u-marisol" io={io} nowIso={NOW} />)
    fireEvent.click(await screen.findByRole('switch', { name: 'Mail Quickfill counts' }))
    await waitFor(() => expect(io.setOn).toHaveBeenCalledWith('w-marisol', false))
    expect(await screen.findByText(MY_MAIL_OFF_WORDS)).toBeTruthy()
  })

  it('says only they see their rows while the owner has named no lead', async () => {
    renderWithProviders(<MyMailCountCard role="assistant" userId="u-marisol" io={fakeIo(ROW, null)} nowIso={NOW} />)
    expect(await screen.findByText('Who sees your rows: you alone, until the owner names a lead.')).toBeTruthy()
  })

  it('shows nothing to a person not on the list, nor to someone outside the office', async () => {
    const io = fakeIo(null)
    renderWithProviders(<MyMailCountCard role="assistant" userId="u-dale" io={io} nowIso={NOW} />)
    await waitFor(() => expect(io.load).toHaveBeenCalled())
    expect(screen.queryByTestId('my-mail-count-card')).toBeNull()
    cleanup()
    const io2 = fakeIo(ROW)
    renderWithProviders(<MyMailCountCard role="primary" userId="u-tech" io={io2} nowIso={NOW} />)
    expect(screen.queryByTestId('my-mail-count-card')).toBeNull()
    expect(io2.load).not.toHaveBeenCalled()
  })
})
