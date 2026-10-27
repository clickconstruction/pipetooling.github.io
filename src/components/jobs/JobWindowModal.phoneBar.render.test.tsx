// @vitest-environment jsdom
/**
 * The tabbed job window's bar on a phone (punch list #189, PR 4): at 375 px a viewer on the job's crew — a master
 * or a primary, who are techs and open the tabbed window — gets the stamp they are due between the verb and Note,
 * and the composer's Arrived / Leaving chips leave the composer; the office, off the crew, keeps Status ▾ · verb ·
 * Note. Note opens the pane's note sheet with its box focused, from any tab, landing on the Job tab.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

import { JobWindowModal } from './JobWindowModal'
import { UpdateFocusOpenerBridgeProvider } from '../../contexts/UpdateFocusOpenerBridgeContext'
import { makeJob, makeTeamMember, renderWithProviders, settle, SMOKE_AUTH_USER_ID } from '../../test/renderSmokeMocks'
import type { JobWithDetails } from '../../types/jobWithDetails'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

/** Who is signed in, per test; one value per role, so useAuth hands back the same object every render. */
const auth = vi.hoisted(() => ({ role: 'master_technician', values: new Map<string, unknown>() }))
vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../../test/renderSmokeMocks')
  const current = () => {
    if (!auth.values.has(auth.role)) auth.values.set(auth.role, makeUseAuthValue({ role: auth.role, profileName: 'Luis Ortega' }))
    return auth.values.get(auth.role)
  }
  return { useAuth: current, useOptionalAuth: current, AuthProvider: ({ children }: { children: unknown }) => children }
})

/** The job the window loads, per test. */
const loaded = vi.hoisted(() => ({ job: null as unknown }))
vi.mock('../../lib/fetchJobWithDetailsById', () => ({
  fetchJobWithDetailsById: async () => loaded.job,
}))

vi.mock('../projects/ProjectsJobHistoryTab', () => ({
  ProjectsJobHistoryTab: ({ jobId }: { jobId?: string | null }) => <div data-testid="history-grid-stub">history for {jobId}</div>,
}))
vi.mock('./JobHistoryLienTimeline', () => ({
  default: () => <div data-testid="history-lien-timeline-stub" />,
}))
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
  auth.role = 'master_technician'
})

function renderWindowAs(role: string, job: JobWithDetails) {
  auth.role = role
  loaded.job = job
  return renderWithProviders(
    <UpdateFocusOpenerBridgeProvider>
      <JobWindowModal
        jobId="job-1"
        initialTab="job"
        onClose={vi.fn()}
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

const bar = () => screen.getByRole('toolbar', { name: 'Job actions' })
const barLabels = () => within(bar()).getAllByRole('button').map((b) => b.textContent)
const tab = (name: string) => screen.getByRole('tab', { name })

describe('JobWindowModal · the phone bar', () => {
  it('gives a master on the crew Arrived between the verb and Note, and takes the chips out of the composer', async () => {
    renderWindowAs('master_technician', makeJob({ id: 'job-1', hcp_number: '9001', job_name: 'Kitchen rough-in', team_members: [makeTeamMember(SMOKE_AUTH_USER_ID, 'Luis Ortega')] }))
    await settle()
    // The stamp lands once the pane has loaded the job and read who is on its crew.
    await within(bar()).findByRole('button', { name: 'Arrived' })
    const labels = barLabels()
    expect(labels).toHaveLength(4)
    expect([labels[0], labels[2], labels[3]]).toEqual(['Status ▾', 'Arrived', 'Note'])
    for (const b of within(bar()).getAllByRole('button')) expect(parseFloat(b.style.minHeight)).toBeGreaterThanOrEqual(48)
    // The bar holds the stamp now: no Arrived or Leaving chip under the note box.
    expect(screen.queryByRole('button', { name: 'Post arrived at job note' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Post leaving job note' })).toBeNull()
    expect(screen.getAllByRole('button', { name: /^(Arrived|Leaving)$/ })).toHaveLength(1)
  })

  it('Note opens the note sheet with its box focused, from the Bill tab, and lands on the Job tab', async () => {
    renderWindowAs('master_technician', makeJob({ id: 'job-1', hcp_number: '9001', job_name: 'Kitchen rough-in', team_members: [makeTeamMember(SMOKE_AUTH_USER_ID, 'Luis Ortega')] }))
    await settle()
    await within(bar()).findByRole('button', { name: 'Arrived' })
    fireEvent.click(tab('Bill'))
    expect(tab('Bill').getAttribute('aria-selected')).toBe('true')
    fireEvent.click(within(bar()).getByRole('button', { name: 'Note' }))
    const sheet = await screen.findByRole('dialog', { name: 'Note' })
    expect(sheet.closest('[data-phone-sheet]')?.getAttribute('data-phone-sheet')).toBe('sheet')
    await waitFor(() => expect(document.activeElement).toBe(within(sheet).getByRole('textbox', { name: 'Add a note' })))
    expect(parseFloat(within(sheet).getByRole('button', { name: 'Save' }).style.minHeight)).toBeGreaterThanOrEqual(48)
    expect(tab('Job').getAttribute('aria-selected')).toBe('true')
  })

  it('gives the office, off the crew, no stamp: Status ▾ · the verb · Note, and Note still opens the sheet', async () => {
    renderWindowAs('assistant', makeJob({ id: 'job-1', hcp_number: '9001', job_name: 'Kitchen rough-in' }))
    await settle()
    // The sheet opening proves the pane has loaded the job and reported its half of the bar.
    await waitFor(() => {
      fireEvent.click(within(bar()).getByRole('button', { name: 'Note' }))
      expect(screen.getByRole('dialog', { name: 'Note' })).toBeTruthy()
    })
    expect(barLabels()).toHaveLength(3)
    expect(within(bar()).queryByRole('button', { name: /^(Arrived|Leaving)$/ })).toBeNull()
    expect([barLabels()[0], barLabels()[2]]).toEqual(['Status ▾', 'Note'])
  })
})
