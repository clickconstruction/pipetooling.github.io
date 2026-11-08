// @vitest-environment jsdom
/**
 * Job Mode's customer lines through the company (punch list #125 PR 7, v2.6717): the customer's email is text with a
 * copy press, never a `mailto:` on the tech's phone (the owner's call 4 of 2026-11-08: a tech texts the customer from
 * Job Mode and does not email), and **Message the customer** under it asks the card's own door to open. The phone line
 * still dials. Luis on the job and Dana Whitfield the customer are made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'

const JOB = 'job-whitfield'
const opened = vi.hoisted(() => [] as string[])

vi.mock('../../lib/messages/messagesIo', () => ({ loadJobMessages: () => Promise.resolve([]) }))
vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: (url: string) => opened.push(url) }))
vi.mock('../../lib/supabase', () => {
  function makeBuilder(table: string) {
    let single = false
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'is', 'order', 'limit']) builder[m] = () => builder
    builder.maybeSingle = () => { single = true; return builder }
    const result = () =>
      table === 'jobs_ledger' && single
        ? Promise.resolve({ data: { customer_name: 'Dana Whitfield', customer_phone: '(512) 555-0100', customer_email: 'dana@example.com', status: 'working', created_at: '2026-10-01T12:00:00Z' }, error: null })
        : Promise.resolve({ data: single ? null : [], error: null })
    builder.then = (f?: (v: unknown) => unknown, r?: (e: unknown) => unknown) => result().then(f, r)
    return builder
  }
  const channel = () => {
    const ch: Record<string, unknown> = {}
    ch.on = () => ch
    ch.subscribe = () => ch
    return ch
  }
  return { supabase: { from: (t: string) => makeBuilder(t), channel, removeChannel: () => {} } }
})
vi.mock('../../lib/fetchStreetViewPreview', () => ({
  fetchStreetViewMeta: () => Promise.resolve(null),
  fetchStreetViewImageBlob: () => Promise.reject(new Error('none')),
  googleStreetViewPanoUrl: () => '',
}))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, role: 'primary', profileName: 'Luis Ortega' }) }))
vi.mock('../../hooks/useJobThreadNotesForModal', () => ({
  useJobThreadNotesForModal: () => ({
    activity: [],
    loading: false,
    canPost: true,
    draft: '',
    setDraft: () => {},
    submitting: false,
    submitNote: () => Promise.resolve(),
    reload: () => {},
    scheduleAssigneeIds: [],
  }),
}))

afterEach(() => {
  cleanup()
  opened.length = 0
})

// The section mounts whole: 3.7 s alone on the office Mac for its sibling smoke, so 15 s rather than the default 5.
describe('Job Mode details — the customer’s email through the company (#125 PR 7)', { timeout: 15_000 }, () => {
  it('the email is text with a copy press and Message the customer under it; the phone still dials; no mailto', async () => {
    const written: string[] = []
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t: string) => { written.push(t); return Promise.resolve() } }, configurable: true })
    const { renderWithProviders } = await import('../../test/renderSmokeMocks')
    const { default: JobModeDetailsSection } = await import('./JobModeDetailsSection')
    const onMessageCustomer = vi.fn()
    renderWithProviders(<JobModeDetailsSection jobId={JOB} jobAddress="" updatesRev={0} onMessageCustomer={onMessageCustomer} />)
    const email = await screen.findByTestId('job-mode-customer-email')
    expect(email.textContent).toBe('dana@example.com')
    expect(email.tagName).not.toBe('BUTTON')
    expect(screen.queryByRole('button', { name: 'Email customer at dana@example.com' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Copy the customer’s email address' }))
    await waitFor(() => expect(written).toEqual(['dana@example.com']))
    await waitFor(() => expect(document.body.textContent).toContain('Email address copied'))

    fireEvent.click(screen.getByRole('button', { name: 'Message the customer by text' }))
    expect(onMessageCustomer).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Call customer at (512) 555-0100' }))
    expect(opened).toEqual(['tel:(512) 555-0100'])
  })

  it('with no door (the next job’s card), the address stands alone and no Message the customer press draws', async () => {
    const { renderWithProviders } = await import('../../test/renderSmokeMocks')
    const { default: JobModeDetailsSection } = await import('./JobModeDetailsSection')
    renderWithProviders(<JobModeDetailsSection jobId={JOB} jobAddress="" updatesRev={0} />)
    await screen.findByTestId('job-mode-customer-email')
    expect(screen.queryByTestId('job-mode-details-message-customer')).toBeNull()
    expect(screen.getByTestId('job-mode-customer-email-copy')).toBeTruthy()
    expect(opened).toEqual([])
  })
})
