// @vitest-environment jsdom
/**
 * The tech's door to the customer (v2.5527): Job Mode's Job updates lists the job's lines with its customer in orange
 * under a Customer pill, for a primary or a helper. A subcontractor reads no lines and gets no pill. Made-up people:
 * Luis on the job, Dana Whitfield the customer, Rosa in the office.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { JobActivityMessage } from '../../lib/jobs/jobActivityMessages'

const JOB = 'job-whitfield'
const scenario: { role: string } = { role: 'primary' }
const dana = { name: 'Dana Whitfield', kind: 'customer' as const }
const LINES: JobActivityMessage[] = [
  { id: 'm1', contactId: 'contact-dana', contact: dana, channel: 'text', direction: 'in', at: '2026-10-13T14:05:00Z', who: '', body: 'Is someone still coming today?', tied: true },
  { id: 'm2', contactId: 'contact-dana', contact: dana, channel: 'email', direction: 'out', at: '2026-10-13T14:20:00Z', who: 'Rosa', subject: 'Your water heater', body: 'Luis is on his way.', tied: true },
  { id: 'm3', contactId: 'contact-dana', contact: dana, channel: 'note', direction: 'team', at: '2026-10-13T14:25:00Z', who: 'Rosa', body: 'Gate code 4412.', tied: true },
]
const asked: Array<unknown> = []

vi.mock('../../lib/supabase', () => {
  function makeBuilder(table: string) {
    let single = false
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'is', 'order', 'limit']) builder[m] = () => builder
    builder.maybeSingle = () => { single = true; return builder }
    const result = () =>
      table === 'jobs_ledger' && single
        ? Promise.resolve({ data: { customer_name: 'Dana Whitfield', customer_phone: '(512) 555-0182', customer_email: null, status: 'working', created_at: '2026-10-01T12:00:00Z' }, error: null })
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
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, role: scenario.role, profileName: 'Luis Ortega' }) }))
vi.mock('../../hooks/useJobMessages', () => ({
  useJobMessages: (job: unknown) => {
    asked.push(job)
    return job ? LINES : []
  },
}))
vi.mock('../../hooks/useJobThreadNotesForModal', () => ({
  useJobThreadNotesForModal: () => ({
    activity: [{ kind: 'note', note: { id: 'n1', body: 'Valve is in.', created_at: '2026-10-13T14:10:00Z', author: { name: 'Luis Ortega' } } }],
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
  asked.length = 0
})

async function mount() {
  const { renderWithProviders } = await import('../../test/renderSmokeMocks')
  const { default: JobModeDetailsSection } = await import('./JobModeDetailsSection')
  renderWithProviders(<JobModeDetailsSection jobId={JOB} jobAddress="" />)
}

// The section mounts whole in each case: 3.7 s alone on the office Mac, so each case has 15 s rather than the default 5.
describe('Job Mode Job updates: the customer’s lines', { timeout: 15_000 }, () => {
  it('a primary on the job sees her lines in orange beside the notes, with a Customer pill that shows only them', async () => {
    scenario.role = 'primary'
    await mount()
    const rows = await screen.findAllByTestId('job-updates-customer-line')
    expect(rows.map((r) => r.getAttribute('data-tone'))).toEqual(['customerIn', 'customerOut'])
    expect(rows[0]!.textContent).toContain('Is someone still coming today?')
    expect(rows[1]!.textContent).toContain('Your water heater')
    // The team note in her thread is the office's to read in Messages, not a customer line here.
    expect(screen.queryByText('Gate code 4412.')).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
    const pill = screen.getByRole('tab', { name: /^Customer/ })
    expect(within(pill).getByText('2')).toBeTruthy()
    fireEvent.click(pill)
    await waitFor(() => expect(screen.queryByText('Valve is in.')).toBeNull())
    expect(screen.getAllByTestId('job-updates-customer-line')).toHaveLength(2)
    expect(asked.some((j) => j && (j as { id: string }).id === JOB)).toBe(true)
  })

  it('a subcontractor reads no lines and gets no pill', async () => {
    scenario.role = 'subcontractor'
    await mount()
    await screen.findByText('Valve is in.')
    expect(screen.queryByRole('tab', { name: /^Customer/ })).toBeNull()
    expect(screen.queryAllByTestId('job-updates-customer-line')).toHaveLength(0)
    expect(asked.every((j) => j === null)).toBe(true)
  })
})
