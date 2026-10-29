// @vitest-environment jsdom
/**
 * Render smoke for Documents → Where files go (punch list #211, PR 2): the three cards read from the `settings` verb's
 * documented answer, the live example from a real job, the tree, the two presses under the cards with their counts, a
 * pasted link's Check and the root's move, a pattern saved through `set`, and a `set` the function refuses shown in
 * Drive's words. The io is a stub answering as `docs/EDGE_FUNCTIONS.md` → job-drive-folders says the verbs answer.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { WhereFilesGoJob } from '../../lib/documents/whereFilesGoTab'
import { DocumentsWhereFilesGo } from './DocumentsWhereFilesGo'

const ROOT_ID = '1AAAAAAAAAAAAAAAAAAAAAAAAAAA'
const NEW_ID = '1BBBBBBBBBBBBBBBBBBBBBBBBBBB'
const APP = 'drive-intake@example.iam.gserviceaccount.com'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const io = vi.hoisted(() => ({
  settings: {} as Record<string, unknown>,
  checks: {} as Record<string, { ok: boolean; words: string; folder: unknown }>,
  sets: [] as unknown[],
  refuse: null as null | { words: string; why: string },
  made: [] as string[],
  jobs: [] as unknown[],
  everyJob: [] as Array<{ id: string; hcp_number: string | null; job_name: string | null }>,
  lookups: [] as string[],
}))

vi.mock('../../lib/documents/whereFilesGoIo', async () => {
  const kernel = { ...(await import('../../lib/documents/whereFilesGoTab')), ...(await import('../../lib/documents/folderName')) }
  class WhereFilesGoRefused extends Error {
    why: string | null
    constructor(message: string, why: string | null) {
      super(message)
      this.why = why
    }
  }
  return {
    WhereFilesGoRefused,
    readWhereFilesGo: async () => {
      // The function before PR 1's deploy reads `{ settings: true }` as a press with no job: this is its answer.
      if (!io.settings) throw new Error('job_id is required')
      return kernel.whereFilesGoFromAnswer(io.settings)
    },
    checkDriveFolder: async (folder: string) => {
      const id = kernel.driveFolderIdFromLinkOrId(folder) ?? folder
      const c = io.checks[id] ?? { ok: false, words: `The app cannot open this folder. Drive answered 404. Share it with ${APP} as an editor.`, folder: null }
      return kernel.folderCheckFromAnswer({ success: true, ok: c.ok, words: c.words, app_email: APP, url: `https://drive.google.com/drive/folders/${id}`, folder: c.folder })
    },
    setWhereFilesGo: async (set: Record<string, unknown>) => {
      io.sets.push(set)
      if (io.refuse) throw new WhereFilesGoRefused(io.refuse.words, io.refuse.why)
      const next = { ...io.settings }
      if (set.job_pattern) next.job_pattern = set.job_pattern
      if (set.bid_pattern) next.bid_pattern = set.bid_pattern
      if (set.folders_made) next.folders_made = set.folders_made
      if (typeof set.root === 'string') {
        const id = kernel.driveFolderIdFromLinkOrId(set.root)!
        next.root = { id, url: `https://drive.google.com/drive/folders/${id}`, from: 'setting', ok: true, words: 'The app can write here.', folder: io.checks[id]?.folder ?? null }
      }
      io.settings = next
      return kernel.whereFilesGoFromAnswer(next)
    },
    loadWhereFilesGoJobs: async () => io.jobs,
    findWhereFilesGoJobs: async (typed: string) => {
      io.lookups.push(typed)
      const q = typed.toLowerCase()
      return io.everyJob.filter((j) => (j.hcp_number ?? '').includes(q) || (j.job_name ?? '').toLowerCase().includes(q))
    },
    loadWhereFilesGoBid: async () => ({ id: 'b1', project_name: 'Oak Hollow Bldg C', bid_number: '482', customer_name: 'Oak Hollow HOA', address: '14 Oak Hollow Dr', created_at: '2026-02-01T12:00:00Z' }),
  }
})

vi.mock('../../lib/jobs/jobDriveFoldersIo', () => ({
  makeJobDriveFolders: async (jobId: string) => {
    io.made.push(jobId)
    if (jobId === 'j-fails') throw new Error('The app cannot write in this job’s Drive folder. Share the folder with the app as an editor.')
    return {
      appEmail: APP,
      folder: { url: `https://drive.google.com/drive/folders/1F${jobId.replace(/[^a-z0-9]/gi, 'x').padEnd(27, 'A')}`, source: 'made', writable: true },
      pictures: { url: 'https://drive.google.com/drive/folders/1P', source: 'made', writable: true },
      plans: { url: 'https://drive.google.com/drive/folders/1L', source: 'made', writable: true },
      teamUrl: '',
      photosUrl: '',
      sentUrl: '',
      stamped: ['google_drive_link', 'job_pictures_link', 'job_plans_link'],
    }
  },
}))

const externalSpy = vi.fn((_url: string) => undefined)
vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: (url: string) => externalSpy(url) }))
const auth = { user: { id: 'u1', email: 'office@example.com' }, role: 'assistant', profileName: 'Dana Office' }
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => auth, useOptionalAuth: () => auth }))

const rootFolder = { id: ROOT_ID, name: 'Jobs', path: ['PipeTooling Jobs'], owner: null, drive: 'PipeTooling Jobs', folders: 118 }
const job = (over: Partial<WhereFilesGoJob>): WhereFilesGoJob => ({
  id: 'j1',
  hcp_number: '972',
  job_name: 'Oak Hollow Bldg C',
  customer_name: 'Oak Hollow HOA',
  job_address: '14 Oak Hollow Dr',
  created_at: '2026-03-04T15:00:00Z',
  google_drive_link: null,
  job_pictures_link: null,
  job_plans_link: null,
  ...over,
})

beforeEach(() => {
  io.settings = {
    success: true,
    app_email: APP,
    root: { id: ROOT_ID, url: `https://drive.google.com/drive/folders/${ROOT_ID}`, from: 'env', ok: true, words: 'The app can write here.', folder: rootFolder },
    job_pattern: ['number', 'name'],
    bid_pattern: ['project'],
    folders_made: 'upfront',
    pieces: { job: ['number', 'name', 'customer', 'address', 'year'], bid: ['project', 'number', 'customer', 'address', 'year'] },
    keys: ['drive_jobs_root_folder_id', 'drive_job_folder_pattern', 'drive_bid_folder_pattern', 'drive_folders_made'],
  }
  io.checks = {
    [ROOT_ID]: { ok: true, words: 'The app can write here.', folder: rootFolder },
    [NEW_ID]: { ok: true, words: 'The app can write here.', folder: { id: NEW_ID, name: 'Jobs 2027', path: ['PipeTooling Jobs'], owner: null, drive: 'PipeTooling Jobs', folders: 0 } },
  }
  io.sets = []
  io.refuse = null
  io.made = []
  io.lookups = []
  io.everyJob = [job({ id: 'j-paid', hcp_number: '900', job_name: 'Paid Sample Job', google_drive_link: `https://drive.google.com/drive/folders/${ROOT_ID}` })]
  io.jobs = [
    job({}),
    job({ id: 'j2', hcp_number: '973', job_name: 'Cedar Ridge Ph 2' }),
    job({ id: 'j-fails', hcp_number: '974', job_name: 'Mill Creek Lofts' }),
    job({ id: 'j4', hcp_number: '975', job_name: 'Pasted', google_drive_link: `https://drive.google.com/drive/folders/${ROOT_ID}` }),
    job({ id: 'j5', hcp_number: '976', job_name: 'Not a folder', google_drive_link: 'https://example.com/somewhere' }),
  ]
  externalSpy.mockClear()
})
afterEach(() => cleanup())

async function renderTab() {
  renderWithProviders(<DocumentsWhereFilesGo />)
  // Settle on what the reads produce: the root card and the batch button's count.
  await screen.findByTestId('wfg-root-card')
  await screen.findByTestId('wfg-make-folders')
}

describe('Documents → Where files go', () => {
  it('draws the three cards from the settings verb’s answer, the live example and the counted presses', async () => {
    await renderTab()
    const root = screen.getByTestId('wfg-root-card')
    expect(root.textContent).toContain('PipeTooling Jobs › Jobs')
    expect(root.textContent).toContain('In the Shared Drive PipeTooling Jobs.')
    expect(root.textContent).toContain('118 job folders inside.')
    expect(root.textContent).toContain('Set on the functions until the office picks a folder here.')
    expect(screen.getByTestId('wfg-root-check').textContent).toBe('✓ The app can write here.')

    const name = screen.getByTestId('wfg-name-card')
    const jobRow = within(screen.getByTestId('wfg-job-pattern'))
    expect(jobRow.getByRole('button', { name: 'Remove Job number' })).toBeTruthy()
    expect(jobRow.getByRole('button', { name: 'Remove Job name' })).toBeTruthy()
    expect(jobRow.getByRole('button', { name: 'Add Customer' })).toBeTruthy()
    expect(screen.getByTestId('wfg-job-pattern').textContent).toContain('Reads 972 · Oak Hollow Bldg C')
    expect(screen.getByTestId('wfg-bid-pattern').textContent).toContain('Reads Oak Hollow Bldg C')
    expect(name.textContent).toContain('A change applies to folders made from now on.')

    const tree = screen.getByTestId('wfg-tree')
    expect(tree.textContent).toContain('972 · Oak Hollow Bldg C')
    for (const leaf of ['Customer Pictures', 'Plans', 'Team only', 'Photos', 'Sent by us']) expect(tree.textContent).toContain(leaf)
    expect((screen.getByLabelText('Make all of it when the job is made') as HTMLInputElement).checked).toBe(true)

    expect(screen.getByTestId('wfg-make-folders').textContent).toBe('Make the folders for 3 jobs without one · 1 has a link that is not a folder ▸')
    expect(screen.getByTestId('wfg-presses').textContent).toContain('976 · Not a folder · its Drive link is not a folder')
    expect(screen.getByRole('button', { name: 'Check 1 pasted folder' })).toBeTruthy()
  })

  it('checks a pasted link in the kernel’s words, then moves the root through set, and shows a refusal in Drive’s words', async () => {
    await renderTab()
    const link = screen.getByLabelText('A Drive folder link for the jobs root')
    fireEvent.change(link, { target: { value: `https://drive.google.com/drive/folders/${NEW_ID}` } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect((await screen.findByTestId('wfg-pasted-check')).textContent).toBe('✓ The app can write here.')
    expect(screen.getByTestId('wfg-root-card').textContent).toContain('Jobs 2027')

    io.refuse = { words: `The app can open this folder but cannot add a file to it. Share it with ${APP} as an editor.`, why: 'root_unwritable' }
    fireEvent.click(screen.getByRole('button', { name: 'Move the jobs root here' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Move the root' }))
    await waitFor(() => expect(io.sets).toEqual([{ root: `https://drive.google.com/drive/folders/${NEW_ID}` }]))
    expect((await screen.findAllByText(io.refuse.words)).length).toBeGreaterThan(0)
    expect(screen.getByTestId('wfg-root-name').textContent).toBe('Jobs')

    io.refuse = null
    fireEvent.click(screen.getByRole('button', { name: 'Move the jobs root here' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Move the root' }))
    await waitFor(() => expect(screen.getByTestId('wfg-root-name').textContent).toBe('Jobs 2027'))
    expect(screen.getByTestId('wfg-root-card').textContent).not.toContain('Set on the functions')

    fireEvent.change(link, { target: { value: 'https://drive.google.com/drive/folders/1CCCCCCCCCCCCCCCCCCCCCCCCCCC' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect((await screen.findByTestId('wfg-pasted-check')).textContent).toBe(`The app cannot open this folder. Drive answered 404. Share it with ${APP} as an editor.`)
    expect(screen.queryByRole('button', { name: 'Move the jobs root here' })).toBeNull()
  })

  it('edits the pattern as chips, reads the example live, saves it through set, and keeps the last piece', async () => {
    await renderTab()
    const jobRow = screen.getByTestId('wfg-job-pattern')
    fireEvent.click(within(jobRow).getByRole('button', { name: 'Add Year' }))
    expect(jobRow.textContent).toContain('Reads 972 · Oak Hollow Bldg C · 2026')
    fireEvent.click(within(jobRow).getByRole('button', { name: 'Remove Job number' }))
    expect(jobRow.textContent).toContain('Reads Oak Hollow Bldg C · 2026')
    fireEvent.click(within(jobRow).getByRole('button', { name: 'Save the name' }))
    await waitFor(() => expect(io.sets).toEqual([{ job_pattern: ['name', 'year'] }]))
    await waitFor(() => expect(within(jobRow).queryByRole('button', { name: 'Save the name' })).toBeNull())
    expect(screen.getByTestId('wfg-tree').textContent).toContain('Oak Hollow Bldg C · 2026')

    // The bid's pattern has one piece: it cannot be taken out.
    const bidRow = screen.getByTestId('wfg-bid-pattern')
    expect((within(bidRow).getByRole('button', { name: 'Remove Project name' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(within(bidRow).getByRole('button', { name: 'Add Bid number' }))
    expect(bidRow.textContent).toContain('Reads Oak Hollow Bldg C · 482')
    fireEvent.click(within(bidRow).getByRole('button', { name: 'Undo' }))
    expect(bidRow.textContent).not.toContain('· 482')
  })

  it('saves the folders-made choice from the radio', async () => {
    await renderTab()
    fireEvent.click(screen.getByLabelText('Make each folder when something first lands in it'))
    await waitFor(() => expect(io.sets).toEqual([{ folders_made: 'as-needed' }]))
    await waitFor(() => expect((screen.getByLabelText('Make each folder when something first lands in it') as HTMLInputElement).checked).toBe(true))
  })

  it('makes the folders for the jobs without one, keeps going past the one that fails and names it', async () => {
    await renderTab()
    fireEvent.click(screen.getByTestId('wfg-make-folders'))
    await waitFor(() => expect(io.made).toEqual(['j1', 'j2', 'j-fails']))
    const presses = screen.getByTestId('wfg-presses')
    await waitFor(() => expect(presses.textContent).toContain('1 job did not get folders. It stays here with the reason.'))
    expect(presses.textContent).toContain('974 · Mill Creek Lofts · The app cannot write in this job’s Drive folder.')
    expect(screen.getByTestId('wfg-make-folders').textContent).toBe('Make the folders for 1 job without one · 1 has a link that is not a folder ▸')
    expect(screen.getByRole('button', { name: 'Check 3 pasted folders' })).toBeTruthy()
  })

  it('checks one job’s folder from the picker and every pasted folder for the held line', async () => {
    await renderTab()
    fireEvent.click(screen.getByRole('button', { name: /Check a job’s folder/ }))
    fireEvent.change(screen.getByLabelText('Type a job number or name'), { target: { value: '975' } })
    fireEvent.click(screen.getByRole('button', { name: '975 · Pasted' }))
    expect((await screen.findByTestId('wfg-one-check')).textContent).toBe('✓ The app can write here.')
    fireEvent.click(screen.getByRole('button', { name: 'Open the folder' }))
    expect(externalSpy).toHaveBeenCalledWith(`https://drive.google.com/drive/folders/${ROOT_ID}`)
    fireEvent.change(screen.getByLabelText('Type a job number or name'), { target: { value: '973' } })
    fireEvent.click(screen.getByRole('button', { name: '973 · Cedar Ridge Ph 2' }))
    expect((await screen.findByTestId('wfg-one-check')).textContent).toBe('This job has no Drive folder yet. The press above makes one.')

    io.checks[ROOT_ID] = { ok: false, words: `The app can open this folder but cannot add a file to it. Share it with ${APP} as an editor.`, folder: rootFolder }
    fireEvent.click(screen.getByRole('button', { name: 'Check 1 pasted folder' }))
    const held = await screen.findByTestId('wfg-held-line')
    expect(held.textContent).toBe('Held: 1 job whose pasted folder the app cannot write to ›')
    fireEvent.click(held)
    expect(screen.getByTestId('wfg-presses').textContent).toContain(`975 · Pasted · The app can open this folder but cannot add a file to it. Share it with ${APP} as an editor.`)
  })

  it('looks a job the live list does not hold up among every job, a paid one, once the typing rests (v2.6073)', async () => {
    await renderTab()
    fireEvent.click(screen.getByRole('button', { name: /Check a job’s folder/ }))
    fireEvent.change(screen.getByLabelText('Type a job number or name'), { target: { value: '900' } })
    expect(screen.getByTestId('wfg-check-one').textContent).toContain('Looking among every job…')
    fireEvent.click(await screen.findByRole('button', { name: '900 · Paid Sample Job' }))
    expect((await screen.findByTestId('wfg-one-check')).textContent).toBe('✓ The app can write here.')
    expect(io.lookups).toEqual(['900'])
    // A live match never looks further; nothing anywhere says so with the filter words.
    fireEvent.change(screen.getByLabelText('Type a job number or name'), { target: { value: '973' } })
    expect(screen.getByRole('button', { name: '973 · Cedar Ridge Ph 2' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Type a job number or name'), { target: { value: 'zzz' } })
    await waitFor(() => expect(screen.getByTestId('wfg-check-one').textContent).toContain('No jobs match ‘zzz’.'))
    expect(io.lookups).toEqual(['900', 'zzz'])
  })

  it('draws the settings read’s failure with its reason and still offers the presses', async () => {
    io.settings = null as unknown as Record<string, unknown>
    renderWithProviders(<DocumentsWhereFilesGo />)
    await screen.findByTestId('wfg-make-folders')
    await waitFor(() => expect(screen.getByTestId('documents-where-files-go').textContent).toContain('job_id is required'))
    expect(screen.queryByTestId('wfg-root-card')).toBeNull()
  })

  it('says the root is not set yet when neither the setting nor the env names one', async () => {
    io.settings = { ...io.settings, root: null }
    await renderTab().catch(() => undefined)
    await screen.findByTestId('wfg-make-folders')
    expect(screen.getByTestId('wfg-root-card').textContent).toContain('The jobs root is not set yet. Paste a folder link and press Check.')
  })
})
