// @vitest-environment jsdom
/**
 * Job Mode's Job updates after Message the customer sent (v2.5528): the card bumps `updatesRev`, and the section reads
 * the job's lines again, so the tech's own text shows beside her answer without a reopen. The lines it had stay on
 * screen while the new read is out. Made-up people: Luis on the job, Dana Whitfield the customer.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import type { JobActivityMessage } from '../../lib/jobs/jobActivityMessages'

const JOB = 'job-whitfield'
const dana = { name: 'Dana Whitfield', kind: 'customer' as const }
const HER: JobActivityMessage = { id: 'm1', contactId: 'contact-dana', contact: dana, channel: 'text', direction: 'in', at: '2026-10-13T14:05:00Z', who: '', body: 'Is someone still coming today?', tied: true }
const OURS: JobActivityMessage = { id: 'm2', contactId: 'contact-dana', contact: dana, channel: 'text', direction: 'out', at: '2026-10-13T14:12:00Z', who: 'Luis Ortega', body: 'Dana, I am on my way, about 15 minutes out.', tied: true }
const reads: { lines: JobActivityMessage[] } = { lines: [HER] }
const loadJobMessages = vi.fn(() => Promise.resolve([...reads.lines]))

vi.mock('../../lib/messages/messagesIo', () => ({ loadJobMessages: () => loadJobMessages() }))
vi.mock('../../lib/supabase', () => {
  function makeBuilder(table: string) {
    let single = false
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'is', 'order', 'limit']) builder[m] = () => builder
    builder.maybeSingle = () => { single = true; return builder }
    const result = () =>
      table === 'jobs_ledger' && single
        ? Promise.resolve({ data: { customer_name: 'Dana Whitfield', customer_phone: null, customer_email: null, status: 'working', created_at: '2026-10-01T12:00:00Z' }, error: null })
        : Promise.resolve({ data: single ? null : [], error: null })
    builder.then = (f?: (v: unknown) => unknown, r?: (e: unknown) => unknown) => result().then(f, r)
    return builder
  }
  return { supabase: { from: (t: string) => makeBuilder(t) } }
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
  loadJobMessages.mockClear()
  reads.lines = [HER]
})

// The section mounts whole: 3.7 s alone on the office Mac for its sibling smoke, so 15 s rather than the default 5.
describe('Job Mode Job updates after Message the customer sent', { timeout: 15_000 }, () => {
  it('reads the job’s lines again when the card bumps updatesRev, and counts the tech’s new text', async () => {
    const { renderWithProviders } = await import('../../test/renderSmokeMocks')
    const { default: JobModeDetailsSection } = await import('./JobModeDetailsSection')
    const view = renderWithProviders(<JobModeDetailsSection jobId={JOB} jobAddress="" updatesRev={0} />)
    await waitFor(() => expect(screen.getAllByTestId('job-updates-customer-line')).toHaveLength(1))
    expect(within(screen.getByRole('tab', { name: /^Customer/ })).getByText('1')).toBeTruthy()
    const before = loadJobMessages.mock.calls.length

    // Luis sent On my way from the sheet: the line is in the thread, and the card bumps the count.
    reads.lines = [HER, OURS]
    view.rerender(<JobModeDetailsSection jobId={JOB} jobAddress="" updatesRev={1} />)
    // Her line stays on screen while the new read is out.
    expect(screen.getAllByTestId('job-updates-customer-line').length).toBeGreaterThanOrEqual(1)
    await waitFor(() => expect(screen.getAllByTestId('job-updates-customer-line')).toHaveLength(2))
    expect(loadJobMessages.mock.calls.length).toBe(before + 1)
    expect(within(screen.getByRole('tab', { name: /^Customer/ })).getByText('2')).toBeTruthy()
    expect(screen.getByText('Dana, I am on my way, about 15 minutes out.')).toBeTruthy()
  })
})
