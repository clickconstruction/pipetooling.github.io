// @vitest-environment jsdom
/**
 * Ask a master (punch list #396, PR 2): the pace card's window. It reads who can be tagged on the job, offers
 * the job's master, and posts one job note that tags him with the card's numbers under the question. Held here:
 * who it goes to, what is posted, the press that names the person, and the three ways it can have nobody to ask.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'

type Row = { user_id: string; name: string; role: string; on_job: boolean }
const scenario: { rows: Row[] | null; error: { message: string; code?: string } | null } = { rows: [], error: null }
const posted: Array<{ jobId: string; body: string; tagged: readonly string[] }> = []
const notified: unknown[] = []
let postFails: { message: string } | null = null

vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: (name: string) => Promise.resolve(name === 'job_note_taggable' ? { data: scenario.rows, error: scenario.error } : { data: null, error: null }),
  },
}))
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'superintendent', profileName: 'Sam' })
})
vi.mock('../../lib/jobs/noteTagsIo', () => ({
  postTaggedNote: (jobId: string, body: string, tagged: readonly string[]) => {
    if (postFails) return Promise.reject(postFails)
    posted.push({ jobId, body, tagged })
    return Promise.resolve('note-1')
  },
  notifyNoteTag: (what: unknown) => notified.push(what),
  noteTagsChanged: () => {},
}))

const facts = { pct: 25, hoursWords: '9 of 70 h', finishWords: 'Fri, Nov 20' }
const dana: Row = { user_id: 'm1', name: 'Dana Whitfield', role: 'master_technician', on_job: true }

async function mount(onSent = vi.fn(), onClose = vi.fn()) {
  const { renderWithProviders } = await import('../../test/renderSmokeMocks')
  const { AskMasterSheet } = await import('./AskMasterSheet')
  renderWithProviders(<AskMasterSheet jobId="job-1" facts={facts} onClose={onClose} onSent={onSent} />)
  return { onSent, onClose }
}

afterEach(() => {
  cleanup()
  scenario.rows = []
  scenario.error = null
  posted.length = 0
  notified.length = 0
  postFails = null
})

describe('AskMasterSheet', () => {
  it('goes to the master on the job, and posts the question with the card’s numbers under it', async () => {
    scenario.rows = [dana, { user_id: 'a1', name: 'Ana Office', role: 'assistant', on_job: false }, { user_id: 'm9', name: 'Office Master', role: 'master_technician', on_job: false }]
    const { onSent, onClose } = await mount()
    expect((await screen.findByTestId('ask-master-to-one')).textContent).toBe('To Dana Whitfield')
    expect(screen.getByTestId('ask-master-facts').textContent).toBe('Sent with: 25% done, 9 of 70 h, finish Fri, Nov 20')
    // Nothing typed: the press is dead, and it already names the person.
    const send = screen.getByTestId('ask-master-send') as HTMLButtonElement
    expect(send.textContent).toBe('Send to Dana')
    expect(send.disabled).toBe(true)
    // A quick question fills the box, where it can still be changed.
    fireEvent.click(screen.getAllByTestId('ask-master-quick')[0]!)
    const box = screen.getByLabelText('Your question') as HTMLTextAreaElement
    expect(box.value).toBe('Is 25% right?')
    fireEvent.change(box, { target: { value: 'Does rough-in include the roof drains?' } })
    expect(send.disabled).toBe(false)
    fireEvent.click(send)
    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toEqual({ jobId: 'job-1', body: 'Does rough-in include the roof drains?\nPace card: 25% done, 9 of 70 h, finish Fri, Nov 20.', tagged: ['m1'] })
    expect(notified).toEqual([{ noteId: 'note-1' }])
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(onSent).toHaveBeenCalled()
  })

  it('with two masters on the job, he picks who, and the press follows the pick', async () => {
    scenario.rows = [dana, { user_id: 'm2', name: 'Rae Ortiz', role: 'master_technician', on_job: true }]
    await mount()
    const picks = await screen.findAllByTestId('ask-master-to')
    expect(picks.map((p) => [p.textContent, p.getAttribute('aria-pressed')])).toEqual([['Dana Whitfield', 'true'], ['Rae Ortiz', 'false']])
    fireEvent.click(picks[1]!)
    expect(screen.getByTestId('ask-master-send').textContent).toBe('Send to Rae')
    fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'Is this right?' } })
    fireEvent.click(screen.getByTestId('ask-master-send'))
    await waitFor(() => expect(posted[0]?.tagged).toEqual(['m2']))
  })

  it('says so when the job has no master he can ask, and offers no box', async () => {
    scenario.rows = [{ user_id: 'a1', name: 'Ana Office', role: 'assistant', on_job: false }]
    await mount()
    expect((await screen.findByTestId('ask-master-nobody')).textContent).toBe('This job has no master you can ask yet. The office names one on the job.')
    expect(screen.queryByTestId('ask-master-send')).toBeNull()
  })

  it('names the reason when the people cannot be read', async () => {
    scenario.rows = null
    scenario.error = { message: 'permission denied for function job_note_taggable', code: '42501' }
    await mount()
    expect(await screen.findByText(/could not be read|permission|access/i)).toBeTruthy()
    expect(screen.queryByTestId('ask-master-send')).toBeNull()
  })

  it('keeps the window and the words when the send is refused, and says why', async () => {
    scenario.rows = [dana]
    postFails = { message: 'You are not on this job' }
    const { onClose } = await mount()
    await screen.findByTestId('ask-master-to-one')
    fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'Is this right?' } })
    fireEvent.click(screen.getByTestId('ask-master-send'))
    expect((await screen.findByRole('alert')).textContent).toContain('You are not on this job')
    expect(onClose).not.toHaveBeenCalled()
    expect((screen.getByLabelText('Your question') as HTMLTextAreaElement).value).toBe('Is this right?')
    expect((screen.getByTestId('ask-master-send') as HTMLButtonElement).disabled).toBe(false)
  })
})
