// @vitest-environment jsdom
/**
 * Leave a note (punch list #256 PR 8, v2.6587): the window where the office writes the one screen a teammate who left
 * sees. The reads are mocked; the smoke proves the wiring: the saved note and its switches are drawn, the preview beside
 * them is the person's screen and changes as the office types, the On the day switch draws the day-of words, a day back
 * before today holds Save with the kernel's reason, and Save sends the draft through the function.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { PersonDeskAwayNoteModal } from './PersonDeskAwayNoteModal'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'

const saved: unknown[] = []
vi.mock('../../lib/people/awayNoteIo', () => ({
  loadAwayNote: async () => ({
    draft: { words: 'Corinne, your spot on the crew is waiting.', countdownYmd: '2099-11-05', showWhere: true, showCall: true, alertOnDay: false },
    row: { user_id: 'u-corinne', words: 'Corinne, your spot on the crew is waiting.', countdown_ymd: '2099-11-05', show_where: true, show_call: true, alert_on_day: false, updated_at: '2026-11-03T15:00:00Z' },
  }),
  loadAwayOffice: async () => ({ address: '12925 FM 20, Kingsbury, TX 78638', latLng: { lat: 29.65, lng: -97.81 }, phone: '(512) 555-0142' }),
  saveAwayNote: async (userId: string, draft: unknown) => {
    saved.push({ userId, draft })
    return { sealed: true }
  },
  clearAwayNote: async () => {},
}))

describe('PersonDeskAwayNoteModal', () => {
  beforeEach(() => {
    saved.length = 0
  })

  it('draws the saved note, its switches and the live preview of their screen', async () => {
    renderWithProviders(<PersonDeskAwayNoteModal userId="u-corinne" displayName="Corinne Vela" archived hasLogin readOnly={false} onClose={() => {}} />)
    const words = (await screen.findByLabelText('The note')) as HTMLTextAreaElement
    await waitFor(() => expect(words.value).toContain('your spot on the crew'))
    const preview = document.querySelector('[data-away-screen]') as HTMLElement
    expect(preview.textContent).toContain('See you soon, Corinne.')
    expect(preview.textContent).toContain('your spot on the crew is waiting.')
    expect(preview.textContent).toContain("We're in Kingsbury, TX")
    expect(preview.textContent).toContain('Call the office')
    expect(screen.getByText('Away note on · sign-in opens to it')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Take the note down' })).toBeTruthy()
  })

  it('the preview follows the typing, and On the day draws the day-of words', async () => {
    renderWithProviders(<PersonDeskAwayNoteModal userId="u-corinne" displayName="Corinne Vela" archived hasLogin readOnly={false} onClose={() => {}} />)
    const words = (await screen.findByLabelText('The note')) as HTMLTextAreaElement
    await waitFor(() => expect(words.value).toContain('your spot'))
    fireEvent.change(words, { target: { value: 'Go get that license done.' } })
    await settle()
    expect((document.querySelector('[data-away-screen]') as HTMLElement).textContent).toContain('Go get that license done.')
    fireEvent.click(screen.getByRole('button', { name: 'On the day' }))
    await settle()
    expect((document.querySelector('[data-away-screen]') as HTMLElement).textContent).toContain("Today's the day.")
  })

  it('a day back that is not after today holds Save with the reason; a good draft saves through the function', async () => {
    const onClose = vi.fn()
    renderWithProviders(<PersonDeskAwayNoteModal userId="u-corinne" displayName="Corinne Vela" archived hasLogin readOnly={false} onClose={onClose} />)
    const words = (await screen.findByLabelText('The note')) as HTMLTextAreaElement
    await waitFor(() => expect(words.value).toContain('your spot'))
    const day = screen.getByLabelText('The day back') as HTMLInputElement
    fireEvent.change(day, { target: { value: '2020-01-01' } })
    await settle()
    expect(screen.getByRole('alert').textContent).toBe('The day back has to be after today.')
    expect((screen.getByRole('button', { name: 'Save note' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(day, { target: { value: '2099-11-05' } })
    await settle()
    fireEvent.click(screen.getByLabelText('Tell me when the countdown ends'))
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }))
    await waitFor(() => expect(saved.length).toBe(1))
    expect(saved[0]).toEqual({ userId: 'u-corinne', draft: { words: 'Corinne, your spot on the crew is waiting.', countdownYmd: '2099-11-05', showWhere: true, showCall: true, alertOnDay: true } })
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
