// @vitest-environment jsdom
/**
 * The Job tab's sections on a phone (punch list #355, PR B, v2.7278): at 375 px the pane reads Where · Photos · Who ·
 * What's happening · the thread · More on this job, Who's number and address are presses with Copy beside them, the
 * rows end in their acts, and the folds under More remember which were opened.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

import { JobWindowModal } from './JobWindowModal'
import { UpdateFocusOpenerBridgeProvider } from '../../contexts/UpdateFocusOpenerBridgeContext'
import { makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { PHONE_FOLDS_KEY } from '../../lib/jobs/jobWindowPhoneSections'
import type { JobWithDetails } from '../../types/jobWithDetails'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const auth = vi.hoisted(() => ({ role: 'assistant', values: new Map<string, unknown>() }))
vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../../test/renderSmokeMocks')
  const current = () => {
    if (!auth.values.has(auth.role)) auth.values.set(auth.role, makeUseAuthValue({ role: auth.role, profileName: 'Taunya Ortega' }))
    return auth.values.get(auth.role)
  }
  return { useAuth: current, useOptionalAuth: current, AuthProvider: ({ children }: { children: unknown }) => children }
})

const loaded = vi.hoisted(() => ({ job: null as unknown }))
vi.mock('../../lib/fetchJobWithDetailsById', () => ({
  fetchJobWithDetailsById: async () => loaded.job,
}))
vi.mock('../projects/ProjectsJobHistoryTab', () => ({
  ProjectsJobHistoryTab: ({ jobId }: { jobId?: string | null }) => <div data-testid="history-grid-stub">history for {jobId}</div>,
}))
vi.mock('./JobHistoryLienTimeline', () => ({ default: () => <div data-testid="history-lien-timeline-stub" /> }))
vi.mock('./JobWindowDocumentsTab', () => ({
  JobWindowDocumentsTab: ({ job }: { job: { id: string } }) => <div data-testid="documents-tab-stub">documents for {job.id}</div>,
}))

function phoneQueryMatches(query: string): boolean {
  const max = /\(max-width:\s*(\d+)px\)/.exec(query)
  const min = /\(min-width:\s*(\d+)px\)/.exec(query)
  if (!max && !min) return false
  return (!max || 375 <= Number(max[1])) && (!min || 375 >= Number(min[1]))
}

beforeAll(() => {
  vi.stubGlobal('scrollTo', vi.fn())
  window.matchMedia = ((query: string) => ({
    matches: phoneQueryMatches(query),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
})
afterEach(() => {
  auth.role = 'assistant'
  localStorage.removeItem(PHONE_FOLDS_KEY)
})

function renderWindow(job: JobWithDetails) {
  loaded.job = job
  return renderWithProviders(
    <UpdateFocusOpenerBridgeProvider>
      <JobWindowModal
        jobId="job-1"
        initialTab="job"
        onClose={vi.fn()}
        authRole="assistant"
        scheduleContext={null}
        assignedJobsRows={[]}
        initialJob={job}
        billingCustomerHighlightInitial={false}
        fixturesSectionHighlightInitial={false}
        jobPicturesLinkHighlightInitial={false}
        alsoOpenCreateCustomerModal={false}
        onSaved={null}
      />
    </UpdateFocusOpenerBridgeProvider>,
  )
}

const job = () => makeJob({ id: 'job-1', hcp_number: '9001', job_name: 'Kitchen rough-in', status: 'working', revenue: 56000, customer_id: 'cust-1', customer_name: 'Ridgeway Builders', customer_phone: '(512) 555-0142', customer_email: 'office@ridgewaybuilders.example' })

const titles = () => Array.from(document.querySelectorAll('[data-phone-section] h3')).map((h) => h.textContent)

describe('JobWindowModal · the Job tab’s sections on a phone', () => {
  it('reads Where · Photos · Who · What’s happening · the thread · More on this job', async () => {
    renderWindow(job())
    await settle()
    await waitFor(() => expect(screen.getByTestId('job-window-who')).toBeTruthy())
    expect(titles()).toEqual(['Where', 'Photos', 'Who', "What's happening", 'The thread', 'More on this job'])
  })

  it('Who: the number and the address are presses with Copy beside them, and the three links are presses with words', async () => {
    renderWindow(job())
    await settle()
    const who = await screen.findByTestId('job-window-who')
    expect(within(who).getByRole('button', { name: 'Call (512) 555-0142' })).toBeTruthy()
    expect(within(who).getByRole('button', { name: 'Text the customer' })).toBeTruthy()
    expect(within(who).getByRole('button', { name: 'Copy the phone number' })).toBeTruthy()
    expect(within(who).getByRole('button', { name: 'Email office@ridgewaybuilders.example' })).toBeTruthy()
    expect(within(who).getByRole('button', { name: 'Copy the email address' })).toBeTruthy()
    expect(within(who).getByRole('button', { name: 'Files: no link yet, set it' }).textContent).toContain('Files')
    expect(within(who).getByRole('button', { name: 'Photos: no link yet, set it' }).textContent).toContain('Photos')
    for (const name of ['Call (512) 555-0142', 'Text the customer', 'Copy the phone number', 'Email office@ridgewaybuilders.example', 'Copy the email address', 'Files: no link yet, set it', 'Photos: no link yet, set it']) expect(parseFloat(String(within(who).getByRole('button', { name }).style.minHeight))).toBeGreaterThanOrEqual(44)
    // The old pills and marks are off the phone: the desk's chip is not reachable.
    expect(screen.queryByRole('button', { name: 'Customer email — email them from the office' })).toBeNull()
  })

  it('What’s happening: Waiting on names the crew and ends in the bar’s verb; Hours is a row ending in Set the hours', async () => {
    renderWindow(job())
    await settle()
    const waiting = await screen.findByTestId('job-window-waiting-on')
    expect(waiting.textContent).toContain('The crew, to finish the work')
    expect(within(waiting).getByRole('button', { name: 'Ready to bill' })).toBeTruthy()
    expect(screen.getByTestId('job-window-next-on-site').textContent).toContain('Nothing scheduled')
    const hours = screen.getByTestId('job-target-line')
    expect(hours.textContent).toContain('No target set')
    expect(within(hours).getByRole('button', { name: 'Set the hours' })).toBeTruthy()
  })

  it('the thread: three rows ending in their acts, then Open the thread', async () => {
    renderWindow(job())
    await settle()
    const thread = await screen.findByTestId('job-window-thread')
    await waitFor(() => expect(within(thread).getByTestId('job-window-thread-theirs')).toBeTruthy())
    expect(within(thread).getByTestId('job-window-thread-stands').textContent).toContain('Last word')
    expect(within(thread).getByTestId('job-window-thread-theirs').textContent).toContain('They promised')
    expect(within(thread).getByRole('button', { name: 'Write it down' })).toBeTruthy()
    expect(within(thread).getByTestId('job-window-thread-ours').textContent).toContain('We owe them')
    expect(within(thread).getByRole('button', { name: 'Mark it' })).toBeTruthy()
    expect(within(thread).getByRole('button', { name: 'Open the thread ›' })).toBeTruthy()
  })

  it('More on this job: six folds, closed, and an opened one is remembered on this phone', async () => {
    renderWindow(job())
    await settle()
    await screen.findByTestId('job-window-who')
    const folds = Array.from(document.querySelectorAll('[data-phone-fold]')).map((f) => f.getAttribute('data-phone-fold'))
    expect(folds).toEqual(['Questions on this job', 'Activity', 'Money', 'Plans and papers', 'Work and time', 'Their journey'])
    const work = screen.getByRole('button', { name: /^Work and time/ })
    expect(work.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(work)
    expect(work.getAttribute('aria-expanded')).toBe('true')
    expect(JSON.parse(localStorage.getItem(PHONE_FOLDS_KEY) ?? '[]')).toEqual(['work'])
    expect(screen.getByText('Assigned Team')).toBeTruthy()
  })
})
