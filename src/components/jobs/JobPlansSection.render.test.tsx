// @vitest-environment jsdom
/**
 * The job window's Documents tab Plans section over a fake io (punch list #239, PR 2): a job with no set says what
 * fills it; a job building from a set reads the set, the older ones and our as-builts; a job in a development whose
 * other part carries a set reads the notice; + New set saves through the io and builds from it. Made-up names only.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PlanPartRow, PlanSetRow } from '../../lib/plans/planSets'
import type { JobPlansIo, JobPlansRead } from '../../lib/plans/planSetsIo'
import type { PlanSetFilesIo } from '../../lib/plans/planSetFilesIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { JobPlansSection } from './JobPlansSection'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ role: 'dev', user: { id: 'u1' } }) }))
const opened: string[] = []
vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: (url: string) => opened.push(url) }))

const job = { id: 'j1', job_name: 'Harlow Ranch gas test', click_number: '972', hcp_number: null }

function set(over: Partial<PlanSetRow> & { id: string }): PlanSetRow {
  return {
    part_id: 'p1',
    name: 'Issued set',
    kind: 'issued',
    source: 'gc',
    dated: null,
    came_at: '2026-10-01T12:00:00Z',
    memo: '',
    link: 'https://drive.google.com/drive/folders/abc',
    replaces_set_id: null,
    marks_up_set_id: null,
    job_id: null,
    file_name: null,
    file_size: null,
    file_count: null,
    checked_at: null,
    check_note: null,
    owed: false,
    ask_lane: null,
    ask_request_id: null,
    created_by: 'u1',
    created_at: '2026-10-01T12:00:00Z',
    updated_at: '2026-10-01T12:00:00Z',
    ...over,
  }
}
const part: PlanPartRow = { id: 'p1', development_id: null, job_id: 'j1', name: 'Harlow Ranch gas test', position: 0, current_set_id: 's2', current_set_by: 'u1', current_set_at: '2026-10-20T15:00:00Z', created_by: 'u1', created_at: '2026-10-01T12:00:00Z', updated_at: '2026-10-20T15:00:00Z' }

function fakeIo(read: Partial<JobPlansRead> = {}, over: Partial<JobPlansIo> = {}): JobPlansIo {
  const full: JobPlansRead = {
    job: { id: 'j1', plan_part_id: null, development_id: null, development_name: null, job_plans_link: null },
    part: null,
    sets: [],
    developmentParts: [],
    names: { u1: 'Taunya' },
    ...read,
  }
  return {
    read: vi.fn(async () => full),
    readSite: vi.fn(async () => ({ parts: [], sets: [], names: {} })),
    readPapers: vi.fn(async () => ({ rows: [], requests: [] })),
    keepPaper: vi.fn(async (a) => set({ id: 'paper-new', name: a.draft.name, kind: a.draft.kind })),
    markPaperCame: vi.fn(async () => undefined),
    makeSitePart: vi.fn(async () => ({ ...part, id: 'p-site', job_id: null, development_id: 'd1', current_set_id: null })),
    makePart: vi.fn(async () => ({ ...part, id: 'p-new', current_set_id: null })),
    pickPart: vi.fn(async () => undefined),
    addSet: vi.fn(async (a) => set({ id: 's-new', name: a.draft.name, link: a.draft.link })),
    makeCurrent: vi.fn(async () => undefined),
    removeSet: vi.fn(async () => undefined),
    updateMemo: vi.fn(async () => undefined),
    ...over,
  }
}

afterEach(() => {
  cleanup()
  opened.length = 0
})

function fakeFilesIo(over: Partial<PlanSetFilesIo> = {}): PlanSetFilesIo {
  return {
    folder: vi.fn(async (setId: string) => ({ folderId: `folder-${setId}`, url: `https://drive.google.com/drive/folders/folder-${setId}`, made: true })),
    put: vi.fn(async (_setId: string, file: File) => ({ driveFileId: `drive-${file.name}`, url: `https://drive.google.com/file/d/${file.name}/view`, folderUrl: 'https://drive.google.com/drive/folders/asbuilt' })),
    saveAttachment: vi.fn(),
    attachmentsOf: vi.fn(async () => []),
    ...over,
  }
}

describe('JobPlansSection', () => {
  it('says what fills an empty job and offers the press', async () => {
    renderWithProviders(<JobPlansSection job={job} io={fakeIo()} />)
    expect(await screen.findByText('No set of plans is on this job yet.')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: '+ New set' }).length).toBeGreaterThan(0)
  })

  it('reads the set the job builds from, the older set it replaced and our as-built', async () => {
    const io = fakeIo({
      job: { id: 'j1', plan_part_id: 'p1', development_id: null, development_name: null, job_plans_link: 'https://drive.google.com/drive/folders/permit' },
      part,
      sets: [
        set({ id: 's1', dated: '2026-08-11' }),
        set({ id: 's2', name: 'Permit set', kind: 'permit', dated: '2026-10-14', replaces_set_id: 's1', link: 'https://drive.google.com/drive/folders/permit', came_at: '2026-10-20T15:00:00Z' }),
        set({ id: 's3', name: 'As-built · JP972 · 2026-11-01', kind: 'as_built', source: 'ours', marks_up_set_id: 's2', job_id: 'j1', came_at: '2026-11-01T18:00:00Z' }),
      ],
    })
    renderWithProviders(<JobPlansSection job={job} io={io} />)
    expect(await screen.findByText('Permit set')).toBeTruthy()
    expect(screen.getByText('· Permit set · the GC · dated Oct 14, 2026')).toBeTruthy()
    expect(screen.getByText('replaced Issued set on Oct 20 · set by Taunya')).toBeTruthy()
    expect(screen.getByText('Older sets')).toBeTruthy()
    expect(screen.getByText('Our as-builts')).toBeTruthy()
    expect(screen.getByText('Nov 1 · Taunya · marks up Permit set')).toBeTruthy()
    expect(screen.queryByTestId('job-plans-other-plans')).toBeNull()
    fireEvent.click(screen.getAllByRole('button', { name: 'Open ↗' })[0]!)
    expect(opened).toEqual(['https://drive.google.com/drive/folders/permit'])
    fireEvent.click(screen.getByRole('button', { name: 'Build from this set' }))
    await waitFor(() => expect(io.makeCurrent).toHaveBeenCalledWith('p1', 's1', 'u1'))
  })

  it('tells a job in a development when another part of the site carries a set', async () => {
    const io = fakeIo({
      job: { id: 'j1', plan_part_id: 'p1', development_id: 'd1', development_name: 'Quail Ridge', job_plans_link: null },
      part: { ...part, development_id: 'd1', job_id: null, name: 'Bunker' },
      sets: [set({ id: 's2', name: 'Bunker issued set' })],
      developmentParts: [
        { id: 'p1', name: 'Bunker', hasSet: true },
        { id: 'p2', name: 'Lodge', hasSet: true },
      ],
    })
    renderWithProviders(<JobPlansSection job={job} io={io} />)
    expect((await screen.findByTestId('job-plans-other-plans')).textContent).toContain('Quail Ridge has plans on another part of the site: Lodge. A set on another part may touch this job.')
  })

  it('adds a set through the io and builds from it, telling the window the new link', async () => {
    const io = fakeIo()
    const onLink = vi.fn()
    renderWithProviders(<JobPlansSection job={job} io={io} onPlansLinkChanged={onLink} />)
    fireEvent.click((await screen.findAllByRole('button', { name: '+ New set' }))[0]!)
    const form = await screen.findByTestId('job-plans-set-form')
    expect((form.querySelector('input') as HTMLInputElement).value).toBe('Issued set')
    const inputs = form.querySelectorAll('input')
    fireEvent.change(inputs[inputs.length - 1]!, { target: { value: 'https://drive.google.com/drive/folders/new' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add the set' }))
    await waitFor(() => expect(io.addSet).toHaveBeenCalled())
    expect(io.makePart).toHaveBeenCalledWith({ jobId: 'j1', developmentId: null, name: 'Harlow Ranch gas test', userId: 'u1' })
    const args = (io.addSet as ReturnType<typeof vi.fn>).mock.calls[0]![0]
    expect(args.partId).toBe('p-new')
    expect(args.makeCurrent).toBe(true)
    expect(args.draft.link).toBe('https://drive.google.com/drive/folders/new')
    await waitFor(() => expect(onLink).toHaveBeenCalledWith('https://drive.google.com/drive/folders/new'))
  })

  it('refuses a set with no name and says so', async () => {
    const io = fakeIo()
    renderWithProviders(<JobPlansSection job={job} io={io} />)
    fireEvent.click((await screen.findAllByRole('button', { name: '+ New set' }))[0]!)
    const form = await screen.findByTestId('job-plans-set-form')
    fireEvent.change(form.querySelector('input')!, { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add the set' }))
    expect(await screen.findByText('Give the set a name.')).toBeTruthy()
    expect(io.addSet).not.toHaveBeenCalled()
  })

  it('the as-built takes photos: the press counts them, a file over 10 MB is held with its reason, the rest file one by one past a failure, and the folder is the set’s link', async () => {
    const io = fakeIo({ job: { id: 'j1', plan_part_id: 'p1', development_id: null, development_name: null, job_plans_link: null }, part, sets: [set({ id: 's2', name: 'Permit set', kind: 'permit' })] })
    const filesIo = fakeFilesIo({
      put: vi.fn(async (_setId: string, file: File, name?: string) => {
        if (file.name === 'IMG_2.jpg') throw new Error('Drive answered 500')
        return { driveFileId: `drive-${name}`, url: `https://drive.google.com/file/d/${name}/view`, folderUrl: 'https://drive.google.com/drive/folders/asbuilt' }
      }),
    })
    const onPlansLinkChanged = vi.fn()
    renderWithProviders(<JobPlansSection job={job} io={io} filesIo={filesIo} onPlansLinkChanged={onPlansLinkChanged} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add our as-built' }))
    const input = screen.getByLabelText('Photos or a PDF') as HTMLInputElement
    const f1 = new File(['a'], 'IMG_1.jpg', { type: 'image/jpeg' })
    const f2 = new File(['b'], 'IMG_2.jpg', { type: 'image/jpeg' })
    const big = new File(['c'], 'huge.jpg', { type: 'image/jpeg' })
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 })
    const doc = new File(['d'], 'notes.docx', { type: 'application/msword' })
    fireEvent.change(input, { target: { files: [f1, f2, big, doc] } })
    expect(screen.getByTestId('job-plans-as-built-held').textContent).toContain('huge.jpg · 11 MB · over 10 MB (11 MB)')
    expect(screen.getByTestId('job-plans-as-built-held').textContent).toContain('notes.docx · 1 B · not a photo or a PDF')
    const press = screen.getByRole('button', { name: 'Add the as-built with 2 files · 2 held ▸' })
    fireEvent.click(press)
    await waitFor(() => expect(filesIo.put).toHaveBeenCalledTimes(2))
    const names = (filesIo.put as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[2])
    expect(names[0]).toMatch(/^As-built · JP972 · \d{4}-\d{2}-\d{2} · 1 of 2\.jpg$/)
    expect(names[1]).toMatch(/^As-built · JP972 · \d{4}-\d{2}-\d{2} · 2 of 2\.jpg$/)
    const filed = await screen.findByTestId('job-plans-filed')
    expect(filed.textContent).toContain('Filed 1 file. 1 did not file.')
    expect(filed.textContent).toContain('IMG_2.jpg · Drive answered 500')
    expect(filesIo.folder).not.toHaveBeenCalled()
  })

  it('a new set with no link gets its own folder under Plans, and the job builds from it', async () => {
    const io = fakeIo({ job: { id: 'j1', plan_part_id: 'p1', development_id: null, development_name: null, job_plans_link: null }, part: { ...part, current_set_id: null }, sets: [] })
    const filesIo = fakeFilesIo()
    const onPlansLinkChanged = vi.fn()
    renderWithProviders(<JobPlansSection job={job} io={io} filesIo={filesIo} onPlansLinkChanged={onPlansLinkChanged} />)
    fireEvent.click((await screen.findAllByRole('button', { name: '+ New set' }))[0]!)
    fireEvent.click(screen.getByRole('button', { name: 'Add the set' }))
    await waitFor(() => expect(filesIo.folder).toHaveBeenCalledWith('s-new'))
    await waitFor(() => expect(onPlansLinkChanged).toHaveBeenCalledWith('https://drive.google.com/drive/folders/folder-s-new'))
  })
})
