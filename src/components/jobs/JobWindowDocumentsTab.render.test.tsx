// @vitest-environment jsdom
/**
 * Render smoke for the job window's Documents tab (v2.4491): the job's saved pay applications
 * with the link to each sent file, the row's Open handing the AIA window that application, New
 * application handing it none, the list reloading when the window closes, and the job's folders.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { makeJob, renderWithProviders } from '../../test/renderSmokeMocks'
import { JobWindowDocumentsTab } from './JobWindowDocumentsTab'
import { payApplicationWriteFromForm, savedPayApplicationFromRow, type PayApplicationRow, type SavedPayApplication } from '../../lib/aiaPayApplications'

let onJob: SavedPayApplication[] = []
const loadSpy = vi.fn((_jobId: string) => Promise.resolve(onJob))
vi.mock('../../lib/aiaPayApplicationsIo', () => ({ loadPayApplications: (jobId: string) => loadSpy(jobId) }))

// The AIA window has its own render test; here it is a stub that says what it was handed.
vi.mock('./AiaG702G703Modal', () => ({
  default: ({ open, onClose, initialApplicationNumber, zIndex }: { open: boolean; onClose: () => void; initialApplicationNumber?: number | null; zIndex?: number }) =>
    open ? (
      <div data-testid="aia-stub">
        application {initialApplicationNumber ?? 'new'} at {zIndex}
        <button type="button" onClick={onClose}>
          close aia
        </button>
      </div>
    ) : null,
}))

function app(no: number, thisPeriod: number, previous: number, certified: number, link = ''): SavedPayApplication {
  const w = payApplicationWriteFromForm(
    'job-1',
    {
      g702_n5_project: String(no),
      g702_n6_period_to: no === 1 ? '09/30/2026' : '10/31/2026',
      g702_h18_original_contract_sum: 48500,
      g702_c28_retainage_percent: 10,
      g702_h40_less_previous_certificates: certified,
      g703_d13_scheduled_value: 48500,
      g703_e13_from_previous: previous,
      g703_f13_this_period: thisPeriod,
    },
    link,
  )
  if (!w.ok) throw new Error(w.reason)
  return savedPayApplicationFromRow({ id: `app-${no}`, updated_at: null, ...w.row } as PayApplicationRow)
}

const job = makeJob({ id: 'job-1', google_drive_link: 'https://drive.google.com/drive/folders/abc', job_plans_link: '', job_pictures_link: null })

beforeEach(() => {
  onJob = []
  loadSpy.mockClear()
})

describe('JobWindowDocumentsTab', () => {
  it('lists the job\'s pay applications with their files, and opens one in the AIA window', async () => {
    onJob = [app(1, 19400, 0, 0, 'https://docs.google.com/spreadsheets/d/abc123/edit'), app(2, 9700, 19400, 17460)]
    const escSpy = vi.fn()
    renderWithProviders(<JobWindowDocumentsTab job={job} onAiaOpenChange={escSpy} />)

    const rows = await screen.findAllByTestId('job-documents-pay-app')
    expect(rows.map((r) => r.textContent)).toEqual(['109/30/2026$17,460.00Open the fileOpen', '210/31/2026$8,730.00No linkOpen'])
    expect((screen.getByRole('link', { name: 'Open the file' }) as HTMLAnchorElement).href).toBe('https://docs.google.com/spreadsheets/d/abc123/edit')
    // 29,100 to date at 10%.
    expect(screen.getByText('Retainage held as of application 2: $2,910.00')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Open application 2' }))
    expect(screen.getByTestId('aia-stub').textContent).toContain('application 2 at 1030')
    expect(escSpy).toHaveBeenLastCalledWith(true)

    // Closing the window reads the list again: what was saved in it shows here.
    onJob = [...onJob, app(3, 4850, 29100, 26190)]
    fireEvent.click(screen.getByRole('button', { name: 'close aia' }))
    expect(escSpy).toHaveBeenLastCalledWith(false)
    await waitFor(() => expect(screen.getAllByTestId('job-documents-pay-app')).toHaveLength(3))
    expect(loadSpy).toHaveBeenCalledTimes(2)
  })

  it('says so when nothing is saved, and New application opens the window on a new one', async () => {
    renderWithProviders(<JobWindowDocumentsTab job={job} />)
    expect(await screen.findByText(/No pay applications are saved on this job\./)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'New application' }))
    expect(screen.getByTestId('aia-stub').textContent).toContain('application new')
  })

  it('lists the job\'s folders that are set', async () => {
    renderWithProviders(<JobWindowDocumentsTab job={job} />)
    await screen.findByText(/No pay applications are saved/)
    expect((screen.getByRole('link', { name: 'Job folder' }) as HTMLAnchorElement).href).toBe('https://drive.google.com/drive/folders/abc')
    expect(screen.queryByRole('link', { name: 'Plans' })).toBeNull()
  })
})
