// @vitest-environment jsdom
/**
 * Calls, texts and emails in the Pipeline's Job activity (Messages cut 10, J2): for the office team the job's
 * messages are in the same numbered feed, the customer's in orange with a deeper bar when the line came from her, the
 * channel a small word before the words, a Customer pill that counts and shows only hers, and every message opening to
 * a link to her thread. A tech (primary or helpers, since the owner's word of 2026-10-13) reads the lines R5's door
 * gives them, the tied ones, with no link to a thread they cannot open. Anyone else reads none. Dana Whitfield's
 * made-up job from the customer prototype v0.3.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/messages/messagesIo', () => ({ loadJobMessages: vi.fn() }))

import { loadJobMessages } from '../../lib/messages/messagesIo'
import { DANA_JOB_MESSAGES } from '../../test/fixtures/jobActivityMessagesDemo'
import { makeJob, renderWithProviders } from '../../test/renderSmokeMocks'
import type { UserRole } from '../../hooks/useAuth'
import type { JobThreadActivityItem } from '../JobThreadNotesPanel'
import { JobActivityView } from './JobActivityView'

const note = (id: string, at: string, body: string) => ({ kind: 'note' as const, note: { id, created_at: at, body, author: { name: 'Rosa' } } }) as unknown as JobThreadActivityItem

afterEach(() => {
  cleanup()
  vi.mocked(loadJobMessages).mockReset()
})

function show(role: UserRole, messages = DANA_JOB_MESSAGES) {
  vi.mocked(loadJobMessages).mockResolvedValue(messages)
  const job = makeJob({ id: 'jl-1312', status: 'working', created_at: '2026-10-01T12:00:00Z' } as never)
  renderWithProviders(<JobActivityView job={job} activity={[note('n-1', '2026-10-06T21:12:00Z', 'Called Dana back. Thursday works for her.')]} upcoming={null} viewerRole={role} narrow={false} />)
}
const row = (text: string | RegExp) => screen.getByText(text).closest('[role="button"]') as HTMLElement

describe('Job activity with a job’s messages (cut 10)', () => {
  it('numbers the messages with the note, the customer’s in orange, deeper from her', async () => {
    show('assistant')
    expect(await screen.findByText('Great. Gate code is 4471.')).toBeTruthy()
    expect(loadJobMessages).toHaveBeenCalledWith({ id: 'jl-1312', status: 'working', createdAt: '2026-10-01T12:00:00Z' })
    expect(screen.getAllByLabelText(/^Entry \d+$/)).toHaveLength(13)
    expect(row('Great. Gate code is 4471.').style.borderLeft).toContain('var(--text-orange-700)')
    expect(row(/^Dana, this is Luis/).style.borderLeft).toContain('var(--border-orange)')
    expect(row('The trencher is free Thursday if you still need it at Oakridge.').style.borderLeft).toBe('')
    expect(within(row('Great. Gate code is 4471.')).getByText('text')).toBeTruthy()
    expect(within(row(/^Asked if Thursday works/)).getByText('call · 3:12')).toBeTruthy()
    expect(within(row('She wants texts after 5, never calls.')).getByText('only the team sees this')).toBeTruthy()
    expect(within(row('Perfect, thank you. See you Thursday.')).getByText('not tied yet')).toBeTruthy()
  })

  it('opens a message to its words and a link to her thread', async () => {
    show('dev')
    const words = await screen.findByText(/^Asked if Thursday works/)
    fireEvent.click(words.closest('[role="button"]') as HTMLElement)
    const link = screen.getByRole('link', { name: 'Open the thread with Dana ›' })
    expect(link.getAttribute('href')).toBe('/gc?view=messages&thread=c-dana&at=m-dana-4')
    expect(screen.getByText(/^Dana: Hi, can you do Thursday\?/)).toBeTruthy()
  })

  it('counts her lines on the Customer pill and shows only them under it', async () => {
    show('controller')
    await screen.findByText('Great. Gate code is 4471.')
    const pill = screen.getByRole('tab', { name: /^Customer/ })
    expect(pill.textContent).toBe('Customer9')
    fireEvent.click(pill)
    // The count and the lines come from the same rows: every line the pill shows is hers, and there are as many as it says.
    const shown = screen.getAllByLabelText(/^Entry \d+$/).map((n) => n.closest('[role="button"]') as HTMLElement)
    expect(shown).toHaveLength(Number(pill.textContent?.replace('Customer', '')))
    expect(shown.every((r) => r.style.borderLeft.includes('orange'))).toBe(true)
    expect(screen.queryByText('Called Dana back. Thursday works for her.')).toBeNull()
    expect(screen.queryByText('The trencher is free Thursday if you still need it at Oakridge.')).toBeNull()
    expect(screen.getByText('Great. Gate code is 4471.')).toBeTruthy()
  })

  for (const tech of ['primary', 'helpers'] as UserRole[]) {
    it(`reads the job’s lines for a tech (${tech}), with the Customer pill and no link to a thread`, async () => {
      // R5's door gives a tech the tied lines alone: contact_jobs is the office's, so the untied read comes back empty.
      show(tech, DANA_JOB_MESSAGES.filter((m) => m.tied))
      expect(await screen.findByText('Great. Gate code is 4471.')).toBeTruthy()
      expect(loadJobMessages).toHaveBeenCalledWith({ id: 'jl-1312', status: 'working', createdAt: '2026-10-01T12:00:00Z' })
      expect(row('Great. Gate code is 4471.').style.borderLeft).toContain('var(--text-orange-700)')
      expect(within(row('She wants texts after 5, never calls.')).getByText('only the team sees this')).toBeTruthy()
      expect(screen.queryByText('Perfect, thank you. See you Thursday.')).toBeNull()
      expect(screen.getByRole('tab', { name: /^Customer/ })).toBeTruthy()
      fireEvent.click((await screen.findByText(/^Asked if Thursday works/)).closest('[role="button"]') as HTMLElement)
      expect(screen.getByText(/^Dana: Hi, can you do Thursday\?/)).toBeTruthy()
      expect(screen.queryByRole('link', { name: /^Open the thread with/ })).toBeNull()
    })
  }

  it('says an office-only note is the office’s', async () => {
    show('assistant', DANA_JOB_MESSAGES.map((m) => (m.id === 'm-dana-5' ? { ...m, officeOnly: true } : m)))
    await screen.findByText('She wants texts after 5, never calls.')
    expect(within(row('She wants texts after 5, never calls.')).getByText('only the office sees this')).toBeTruthy()
  })

  it('reads no messages for anyone outside the office and the techs, and shows no Customer pill', async () => {
    show('subcontractor')
    expect(await screen.findByText('Called Dana back. Thursday works for her.')).toBeTruthy()
    expect(loadJobMessages).not.toHaveBeenCalled()
    expect(screen.queryByRole('tab', { name: /^Customer/ })).toBeNull()
    expect(screen.queryByText('Great. Gate code is 4471.')).toBeNull()
  })
})
