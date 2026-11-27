// @vitest-environment jsdom
/**
 * Edit Job's Delete on a ZZ test job (punch list #443, row 18), on the form itself. The rule is
 * `lib/jobs/deletedJobFolderOffer.ts` and the function's is `_shared/deletedJobFolderTrash.ts`, each with its own tests; this
 * pins the wiring: a dev sees the line in the Delete window on a ZZ-named job with a Drive link, the delete goes
 * first, the function is asked after it with the job's id alone, and its words come back as a toast. Nobody else,
 * and no other job, gets the line or the ask. Made-up names and ids.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

const seat = vi.hoisted(() => ({ role: 'dev', values: new Map<string, unknown>() }))
const db = vi.hoisted(() => ({
  job: null as unknown,
  /** Every write and every function call, in the order it was made. */
  log: [] as string[],
  invoked: [] as Array<{ name: string; body: unknown }>,
  answer: { data: null as unknown, error: null as unknown },
}))

vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../../test/renderSmokeMocks')
  const value = () => {
    if (!seat.values.has(seat.role)) seat.values.set(seat.role, makeUseAuthValue({ role: seat.role }))
    return seat.values.get(seat.role)
  }
  return { useAuth: value, useOptionalAuth: value, AuthProvider: ({ children }: { children: unknown }) => children }
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub()
  const from = stub.from
  return {
    supabase: {
      ...stub,
      from: (table: string) => {
        const builder = (from as () => Record<string, unknown>)()
        if (table === 'jobs_ledger') {
          const del = builder.delete as () => unknown
          builder.delete = () => {
            db.log.push('delete jobs_ledger')
            return del()
          }
        }
        return builder
      },
      functions: {
        invoke: (name: string, opts: { body?: unknown } = {}) => {
          if (name === 'job-drive-folders' && opts.body && typeof opts.body === 'object' && 'trash' in opts.body) {
            db.log.push('invoke trash')
            db.invoked.push({ name, body: opts.body })
            return Promise.resolve(db.answer)
          }
          return Promise.resolve({ data: null, error: null })
        },
      },
    },
  }
})
vi.mock('../../lib/fetchJobWithDetailsById', () => ({ fetchJobWithDetailsById: async () => db.job }))
vi.mock('../../hooks/useJobFormLabor', () => ({
  useJobFormLabor: () => ({ editJobTeamLaborLoading: false, editJobTeamLaborRow: null, editJobTeamLaborError: false, editJobSubLaborLoading: false, editJobSubLaborData: null, editJobSubLaborError: false }),
}))
vi.mock('./useJobCostSnapshot', () => ({
  useJobCostSnapshot: () => ({
    materialsAccordionOpen: 'billed',
    jobMaterialsSnapshotLoading: false,
    supplyInvoiceTotal: 0,
    supplyInvoiceRpcFailed: false,
    supplyInvoiceLines: [],
    mercuryAllocLines: [],
    mercuryFetchFailed: false,
    mercuryCardExclusions: undefined,
    mercuryCardCostLines: [],
    mercuryCardTagByTxId: undefined,
    tallyPartLines: [],
    tallyFetchFailed: false,
    mercuryCardTotal: 0,
    tallyPartsTotal: 0,
    toggleMaterialsAccordion: () => {},
  }),
}))

import { makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import JobFormModal from './JobFormModal'
import { JOB_FOLDER_TRASH_CONFIRM_LINE } from '../../lib/jobs/deletedJobFolderOffer'

const LINK = 'https://drive.google.com/drive/folders/job-folder-id'

beforeEach(() => {
  seat.role = 'dev'
  db.log = []
  db.invoked = []
  db.answer = { data: { success: true, act: 'trashed', words: 'Its Drive folder went to Drive’s trash, with the 5 folders inside. A manager of the Shared Drive can restore it for 30 days.' }, error: null }
})

async function openJob(job: Record<string, unknown>) {
  db.job = makeJob({ id: '11111111-1111-4111-8111-111111111111', hcp_number: '1113', status: 'working', ...job })
  renderWithProviders(
    <JobFormModal mode="edit" editJobId="11111111-1111-4111-8111-111111111111" initialJob={null} billingCustomerHighlightInitial={false} fixturesSectionHighlightInitial={false} jobPicturesLinkHighlightInitial={false} alsoOpenCreateCustomerModal={false} onClose={vi.fn()} onSaved={null} />,
  )
  await settle()
  await screen.findByDisplayValue(String(job.job_name))
}

async function openDeleteWindow() {
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
  const title = await screen.findByText('Delete job from Billing?')
  return within(title.closest('[role="dialog"]') as HTMLElement)
}

describe('Edit Job: Delete on a ZZ test job sends its Drive folder to the trash', () => {
  it('a dev sees the line, the delete goes first, then the function is asked with the job’s id alone', async () => {
    await openJob({ job_name: 'ZZ Test walk job', google_drive_link: LINK })
    const win = await openDeleteWindow()
    expect(win.getByText(JOB_FOLDER_TRASH_CONFIRM_LINE)).toBeTruthy()
    expect(db.log).toEqual([])
    fireEvent.click(win.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(db.invoked).toHaveLength(1))
    expect(db.log).toEqual(['delete jobs_ledger', 'invoke trash'])
    expect(db.invoked[0]).toEqual({ name: 'job-drive-folders', body: { trash: { job_id: '11111111-1111-4111-8111-111111111111' } } })
    expect(await screen.findByText('The job is deleted. Its Drive folder went to Drive’s trash, with the 5 folders inside. A manager of the Shared Drive can restore it for 30 days.')).toBeTruthy()
  })

  it('says why the folder stays when the function refuses, and the job is still deleted', async () => {
    db.answer = { data: { error: '1 bid still keeps this folder. It stays.', why: 'in_use' }, error: null }
    await openJob({ job_name: 'ZZ Test walk job', google_drive_link: LINK })
    const win = await openDeleteWindow()
    fireEvent.click(win.getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('The job is deleted. 1 bid still keeps this folder. It stays.')).toBeTruthy()
    expect(db.log).toEqual(['delete jobs_ledger', 'invoke trash'])
  })

  it('a real job gets no line and no ask, for a dev too', async () => {
    await openJob({ job_name: 'Cedar Bend', google_drive_link: LINK })
    const win = await openDeleteWindow()
    expect(win.queryByText(JOB_FOLDER_TRASH_CONFIRM_LINE)).toBeNull()
    fireEvent.click(win.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(db.log).toEqual(['delete jobs_ledger']))
    await settle()
    expect(db.invoked).toEqual([])
  })

  it('a ZZ job with no Drive link gets no line and no ask', async () => {
    await openJob({ job_name: 'ZZ Test walk job', google_drive_link: null })
    const win = await openDeleteWindow()
    expect(win.queryByText(JOB_FOLDER_TRASH_CONFIRM_LINE)).toBeNull()
    fireEvent.click(win.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(db.log).toEqual(['delete jobs_ledger']))
    await settle()
    expect(db.invoked).toEqual([])
  })

  it('the office’s delete of a ZZ job is as it was: no line and no ask', async () => {
    seat.role = 'master_technician'
    await openJob({ job_name: 'ZZ Test walk job', google_drive_link: LINK })
    const win = await openDeleteWindow()
    expect(win.queryByText(JOB_FOLDER_TRASH_CONFIRM_LINE)).toBeNull()
    fireEvent.click(win.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(db.log).toEqual(['delete jobs_ledger']))
    await settle()
    expect(db.invoked).toEqual([])
  })
})
