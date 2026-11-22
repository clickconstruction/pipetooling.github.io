// @vitest-environment jsdom
/**
 * The job window's top on a phone (punch list #355, v2.7271): at 375 px the name comes first with ⋯ over ✕ at its
 * right, the seven tabs are one strip on one line, the ? is gone from the strip, and ⋯ opens the sheet whose rows
 * are the doors the role has, What this window holds last. The Money and Job accounts lines end in their acts.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

import { JobWindowModal } from './JobWindowModal'
import { UpdateFocusOpenerBridgeProvider } from '../../contexts/UpdateFocusOpenerBridgeContext'
import { makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
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

/** A width query as a window 375 px wide answers it; anything else is false. */
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
})

function renderWindowAs(role: string, job: JobWithDetails, onClose = vi.fn()) {
  auth.role = role
  loaded.job = job
  return renderWithProviders(
    <UpdateFocusOpenerBridgeProvider>
      <JobWindowModal
        jobId="job-1"
        initialTab="job"
        onClose={onClose}
        authRole={role}
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

const job = () => makeJob({ id: 'job-1', hcp_number: '9001', job_name: 'Kitchen rough-in', status: 'working', revenue: 56000 })

describe('JobWindowModal · the top on a phone', () => {
  it('draws the name first with ⋯ over ✕, the tabs as one strip, and no ? on the strip', async () => {
    renderWindowAs('assistant', job())
    await settle()
    const head = screen.getByTestId('job-window-head')
    expect(within(head).getByRole('heading', { level: 2 }).textContent).toContain('Kitchen rough-in')
    expect(within(head).getByTestId('job-window-status').textContent).toBe('Working')
    const pins = within(head).getAllByRole('button')
    expect(pins.map((b) => b.getAttribute('aria-label'))).toEqual(['More on this job', 'Close job window'])
    for (const b of pins) expect(parseFloat(String(b.style.width))).toBe(44)
    const strip = screen.getByRole('tablist', { name: 'Job window tabs' })
    expect(within(strip).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Job', 'Edit', 'Bill', 'Costs', 'History', 'Documents', 'Materials', 'Map'])
    expect(strip.getAttribute('data-navtrack')).toBe('job-window')
    expect(strip.style.overflowX).toBe('auto')
    expect(within(strip).queryByRole('button', { name: /what this window holds/i })).toBeNull()
    // The strip and the head sit inside the body's scroll, so they scroll away with the page.
    expect(head.closest('.job-window-body')).not.toBeNull()
    expect(strip.closest('.job-window-body')).not.toBeNull()
  })

  it('⋯ opens the sheet with the doors the role has, in the press count’s order, What this window holds last', async () => {
    renderWindowAs('assistant', job())
    await settle()
    // The pane reports its doors once the job loads: the sheet then has more than the window's own row.
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'More on this job' }))
      const sheet = screen.getByRole('dialog', { name: 'More on this job' })
      expect(within(sheet).getAllByRole('menuitem').length).toBeGreaterThan(1)
    })
    const sheet = screen.getByRole('dialog', { name: 'More on this job' })
    const rows = within(sheet).getAllByRole('menuitem')
    expect(rows.map((r) => r.textContent)).toEqual(['Share the job', 'Open the calendar', 'Add job accountnone yet', 'Email the paid-in-full report', 'Send as a task', 'What this window holds'])
    for (const r of rows) expect(parseFloat(String(r.style.minHeight))).toBeGreaterThanOrEqual(48)
    expect(sheet.closest('[data-navtrack="job-window"]') ?? within(sheet).getByRole('menu').getAttribute('data-navtrack')).toBeTruthy()
    fireEvent.click(within(sheet).getByRole('menuitem', { name: 'What this window holds' }))
    expect(screen.queryByRole('dialog', { name: 'More on this job' })).toBeNull()
    expect(screen.getByText('What this window holds')).toBeTruthy()
  })

  it('the Money line ends in the bar’s money verb and opens the Bill tab; Job accounts ends in Add job account', async () => {
    renderWindowAs('assistant', job())
    await settle()
    // PR B (v2.7278): the two lines sit in the Money fold under More on this job, closed until the phone opens it.
    const moneyFold = await screen.findByRole('button', { name: /^Money/ })
    expect(moneyFold.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(moneyFold)
    const money = await screen.findByTestId('job-window-money-line')
    expect(money.textContent).toContain('Job total $56,000 · nothing billed yet')
    // Working with no bill out: the bar says Ready to bill, a status move, so the line ends plain.
    expect(within(money).queryByRole('button', { name: /bill it|send bill|mark paid/i })).toBeNull()
    const accounts = screen.getByTestId('job-window-accounts-line')
    expect(accounts.textContent).toContain('None yet')
    fireEvent.click(within(accounts).getByRole('button', { name: 'Add job account' }))
    expect(await screen.findByRole('heading', { name: 'Add job account' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    // A tap on the Money line opens the Bill tab, where the bills are.
    fireEvent.click(within(money).getByRole('button', { name: 'Money: open the Bill tab' }))
    expect(screen.getByRole('tab', { name: 'Bill' }).getAttribute('aria-selected')).toBe('true')
  })

  it('the ✕ in the stack closes the window', async () => {
    const onClose = vi.fn()
    renderWindowAs('assistant', job(), onClose)
    await settle()
    fireEvent.click(within(screen.getByTestId('job-window-head')).getByRole('button', { name: 'Close job window' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('scrolled down, no ✕ floats over the job; scrolled back up, the strip pins with a ✕ at its right that closes the window (v2.7300)', async () => {
    const onClose = vi.fn()
    renderWindowAs('assistant', job(), onClose)
    await settle()
    const body = document.querySelector('.job-window-body') as HTMLElement
    const row = screen.getByTestId('job-window-strip-row')
    expect(row.style.position).toBe('')
    // jsdom lays nothing out, so the head ends at 0 and any scroll is past it.
    body.scrollTop = 300
    fireEvent.scroll(body)
    expect(screen.queryByTestId('job-window-float-close')).toBeNull()
    expect(screen.queryByTestId('job-window-strip-close')).toBeNull()
    expect(within(row).queryByRole('button', { name: 'Close job window' })).toBeNull()
    body.scrollTop = 200
    fireEvent.scroll(body)
    expect(row.style.position).toBe('sticky')
    const strip = screen.getByRole('tablist', { name: 'Job window tabs' })
    expect(strip.hasAttribute('data-pinned')).toBe(true)
    const close = within(row).getByRole('button', { name: 'Close job window' })
    expect(close.getAttribute('data-testid')).toBe('job-window-strip-close')
    expect(parseFloat(String(close.style.width))).toBe(44)
    expect(parseFloat(String(close.style.height))).toBe(44)
    // The ✕ stands beside the strip, not inside it, so the strip's edge fade never dims it.
    expect(strip.contains(close)).toBe(false)
    fireEvent.click(close)
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
