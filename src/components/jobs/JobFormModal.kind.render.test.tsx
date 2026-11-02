// @vitest-environment jsdom
/**
 * The job's kind on the form (punch list #238). New Job holds a press until the row is in and saves it after, never in
 * the insert, so a kind the database refuses (the client ahead of its migration, say) never refuses the job. Edit Job
 * saves a press at once and draws the saved column. The reads are stand-ins; the writes to `jobs_ledger` are recorded.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'

const db = vi.hoisted(() => ({
  inserts: [] as Array<Record<string, unknown>>,
  updates: [] as Array<Record<string, unknown>>,
  job: null as unknown,
  kindAnswer: 'saved' as 'saved' | 'no rows' | 'no column',
}))

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'dev' })
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as unknown as Record<string, unknown> & { from: (table: string) => Record<string, unknown> }
  const stubFrom = stub.from.bind(stub)
  const kindUpdateAnswer = () => {
    if (db.kindAnswer === 'no rows') return { data: [], error: null }
    if (db.kindAnswer === 'no column') return { data: null, error: { code: 'PGRST204', message: "Could not find the 'kind' column of 'jobs_ledger' in the schema cache" } }
    return { data: [{ id: 'the-job' }], error: null }
  }
  return {
    supabase: {
      ...stub,
      from: (table: string) => {
        const b = stubFrom(table)
        if (table === 'service_types') {
          b.select = () => ({ order: async () => ({ data: [{ id: 'st-plumbing', name: 'Plumbing', billing_only: false }], error: null }) })
        }
        if (table === 'jobs_ledger') {
          b.insert = (payload: Record<string, unknown>) => {
            db.inserts.push(payload)
            return { select: () => ({ single: async () => ({ data: { id: 'the-job' }, error: null }) }) }
          }
          b.update = (payload: Record<string, unknown>) => {
            db.updates.push(payload)
            return { eq: () => ({ select: async () => ('kind' in payload ? kindUpdateAnswer() : { data: [{ id: 'the-job' }], error: null }) }) }
          }
        }
        return b
      },
    },
  }
})
vi.mock('../../lib/fetchJobWithDetailsById', () => ({ fetchJobWithDetailsById: async () => db.job }))

import { makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import JobFormModal from './JobFormModal'

const pressed = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-pressed')
const kindWrites = () => db.updates.filter((u) => 'kind' in u)

async function openNewJob(onClose: () => void = () => {}) {
  renderWithProviders(
    <JobFormModal mode="new" editJobId={null} initialJob={null} billingCustomerHighlightInitial={false} fixturesSectionHighlightInitial={false} jobPicturesLinkHighlightInitial={false} alsoOpenCreateCustomerModal={false} onClose={onClose} onSaved={null} />,
  )
  await settle()
  await screen.findByTestId('job-form-kind')
  fireEvent.change(screen.getByPlaceholderText('Job name'), { target: { value: 'ZZ Test Job' } })
  fireEvent.change(screen.getByPlaceholderText('Address'), { target: { value: '1 Test Lane' } })
  await settle()
}

async function pressCreateJob() {
  const create = await screen.findByRole('button', { name: 'Create Job' })
  await waitFor(() => expect((create as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(create)
}

async function openEditJob(row: Record<string, unknown>, onSaved: () => void = () => {}) {
  db.job = makeJob({ id: 'the-job', hcp_number: '', click_number: '1031', job_name: 'ZZ Test Job', status: 'working', first_work_date: '2026-09-01', ...row })
  renderWithProviders(
    <JobFormModal mode="edit" editJobId="the-job" initialJob={null} billingCustomerHighlightInitial={false} fixturesSectionHighlightInitial={false} jobPicturesLinkHighlightInitial={false} alsoOpenCreateCustomerModal={false} onClose={() => {}} onSaved={onSaved} />,
  )
  await settle()
  await screen.findByTestId('job-form-kind')
  await screen.findByDisplayValue('ZZ Test Job')
}

beforeEach(() => {
  db.inserts = []
  db.updates = []
  db.job = null
  db.kindAnswer = 'saved'
})
afterEach(cleanup)

describe('New Job · the Kind control', () => {
  it('no press and no signal: neither side is pressed, the insert names no kind and nothing is written after it', async () => {
    const onClose = vi.fn()
    await openNewJob(onClose)
    expect(pressed('Service call')).toBe('false')
    expect(pressed('Project')).toBe('false')
    await pressCreateJob()
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(db.inserts).toHaveLength(1)
    expect(db.inserts[0]).not.toHaveProperty('kind')
    expect(kindWrites()).toEqual([])
  })

  it('a press is saved after the row goes in, never in the insert', async () => {
    const onClose = vi.fn()
    await openNewJob(onClose)
    fireEvent.click(screen.getByRole('button', { name: 'Project' }))
    await settle()
    expect(pressed('Project')).toBe('true')
    await pressCreateJob()
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(db.inserts).toHaveLength(1)
    expect(db.inserts[0]).not.toHaveProperty('kind')
    expect(kindWrites()).toEqual([{ kind: 'project' }])
  })

  it('a kind the database refuses says so, and the job stands', async () => {
    db.kindAnswer = 'no column'
    const onClose = vi.fn()
    await openNewJob(onClose)
    fireEvent.click(screen.getByRole('button', { name: 'Service call' }))
    await settle()
    await pressCreateJob()
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(db.inserts).toHaveLength(1)
    expect(await screen.findByText(/Job saved, but its kind could not be saved/)).toBeTruthy()
  })
})

describe('Edit Job · the Kind control', () => {
  it('draws the saved column as the press, with the office named as its reason', async () => {
    await openEditJob({ kind: 'service' })
    expect(pressed('Service call')).toBe('true')
    expect(pressed('Project')).toBe('false')
    expect(screen.getByTestId('job-form-kind-reason').textContent).toBe('Service call · the office said so. Change it if that is wrong.')
  })

  it('a press saves at once and tells the window', async () => {
    const onSaved = vi.fn()
    await openEditJob({ kind: 'service' }, onSaved)
    fireEvent.click(screen.getByRole('button', { name: 'Project' }))
    await waitFor(() => expect(pressed('Project')).toBe('true'))
    expect(kindWrites()).toEqual([{ kind: 'project' }])
    expect(onSaved).toHaveBeenCalled()
  })

  it('pressing the side the office already pressed writes nothing', async () => {
    await openEditJob({ kind: 'service' })
    fireEvent.click(screen.getByRole('button', { name: 'Service call' }))
    await settle()
    expect(kindWrites()).toEqual([])
  })

  it('an update RLS filtered away is not a save: the press stays where it was and the reason is said', async () => {
    db.kindAnswer = 'no rows'
    const onSaved = vi.fn()
    await openEditJob({ kind: 'service' }, onSaved)
    fireEvent.click(screen.getByRole('button', { name: 'Project' }))
    expect(await screen.findByText(/Could not save the job's kind/)).toBeTruthy()
    expect(pressed('Service call')).toBe('true')
    expect(pressed('Project')).toBe('false')
    expect(onSaved).not.toHaveBeenCalled()
  })
})
