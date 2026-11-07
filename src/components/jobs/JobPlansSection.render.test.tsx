// @vitest-environment jsdom
/**
 * The job window's Documents tab Plans section over a fake io (punch list #239, PR 2): a job with no set says what
 * fills it; a job building from a set reads the set, the older ones and our as-builts; a job in a development whose
 * other part carries a set reads the notice; + New set saves through the io and builds from it. The as-built's files:
 * each pick adds, a failure files again into the same set, a held file stays named, an as-built takes more later, a set
 * with no link makes its folder. Made-up names only.
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
const auth = vi.hoisted(() => ({ role: 'dev' }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ role: auth.role, user: { id: 'u1' } }) }))
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
    movePaper: vi.fn(async () => undefined),
    updateMemo: vi.fn(async () => undefined),
    updateChanges: vi.fn(async () => undefined),
    ...over,
  }
}

afterEach(() => {
  cleanup()
  opened.length = 0
  auth.role = 'dev'
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
    expect(args.draft.changes ?? '').toBe('')
    await waitFor(() => expect(onLink).toHaveBeenCalledWith('https://drive.google.com/drive/folders/new'))
  })

  it('reads the change line under the set it builds from, and writes one on an older set that has none', async () => {
    const io = fakeIo({
      job: { id: 'j1', plan_part_id: 'p1', development_id: null, development_name: null, job_plans_link: null },
      part,
      sets: [
        set({ id: 's1', dated: '2026-06-01' }),
        set({ id: 's2', name: 'Addendum 1', kind: 'addendum', dated: '2026-07-01', replaces_set_id: 's1' }),
        set({ id: 's3', name: 'Permit set', kind: 'permit', dated: '2026-10-14', replaces_set_id: 's2', changes: 'The water heater moved to the garage.' }),
      ],
    })
    renderWithProviders(<JobPlansSection job={job} io={io} />)
    expect(await screen.findByText('What changed from Addendum 1: The water heater moved to the garage.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Edit what changed' })).toBeTruthy()
    expect(screen.queryByTestId('plan-set-changes-s1')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Write what changed' }))
    fireEvent.change(screen.getByLabelText('What changed in Addendum 1'), { target: { value: 'Sheet P-2 redrawn.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save what changed' }))
    await waitFor(() => expect(io.updateChanges).toHaveBeenCalledWith('s2', 'Sheet P-2 redrawn.'))
    await waitFor(() => expect(io.read).toHaveBeenCalledTimes(2))
  })

  it('asks what changed on the New set form and sends it with the set', async () => {
    const io = fakeIo({ job: { id: 'j1', plan_part_id: 'p1', development_id: null, development_name: null, job_plans_link: null }, part: { ...part, current_set_id: 's1' }, sets: [set({ id: 's1', dated: '2026-06-01' })] })
    renderWithProviders(<JobPlansSection job={job} io={io} />)
    fireEvent.click((await screen.findAllByRole('button', { name: '+ New set' }))[0]!)
    const area = (await screen.findByTestId('plan-set-changes')) as HTMLTextAreaElement
    expect(area.placeholder).toBe('What moved from Issued set: which sheets or areas, and what it means for our work. Nothing, for a reissue.')
    fireEvent.change(area, { target: { value: ' The riser moved. ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add the set and build from it' }))
    await waitFor(() => expect(io.addSet).toHaveBeenCalled())
    const args = (io.addSet as ReturnType<typeof vi.fn>).mock.calls[0]![0]
    expect(args.draft.changes).toBe(' The riser moved. ')
    expect(args.replacesSetId).toBe('s1')
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

  describe('the as-built’s files', () => {
    const emptyPart = () => fakeIo({ job: { id: 'j1', plan_part_id: 'p1', development_id: null, development_name: null, job_plans_link: null }, part: { ...part, current_set_id: null }, sets: [] })
    const photo = (name: string, lastModified = 1) => new File(['x'], name, { type: 'image/jpeg', lastModified })
    const tooBig = () => {
      const big = new File(['c'], 'huge.jpg', { type: 'image/jpeg' })
      Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 })
      return big
    }
    const openForm = async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Add our as-built' }))
      return screen.getByLabelText('Photos or a PDF') as HTMLInputElement
    }
    const landed = { driveFileId: 'd1', url: 'https://drive.google.com/file/d/d1/view', folderUrl: 'https://drive.google.com/drive/folders/asbuilt' }

    it('a file that fails stays with its reason and files again into the same set, never a second row', async () => {
      const io = emptyPart()
      let refusing = true
      const put = vi.fn(async (_setId: string, file: File) => {
        if (file.name === 'IMG_2.jpg' && refusing) throw new Error('That job has no Drive folder yet.')
        return landed
      })
      renderWithProviders(<JobPlansSection job={job} io={io} filesIo={fakeFilesIo({ put })} />)
      fireEvent.change(await openForm(), { target: { files: [photo('IMG_1.jpg'), photo('IMG_2.jpg')] } })
      fireEvent.click(screen.getByRole('button', { name: 'Add the as-built with 2 files' }))
      const first = await screen.findByTestId('job-plans-filed')
      expect(first.textContent).toContain('1 file did not file. It stays here with the reason.')
      expect(first.textContent).toContain('IMG_2.jpg · That job has no Drive folder yet.')
      expect(first.getAttribute('data-tone')).toBe('warning')
      refusing = false
      fireEvent.click(screen.getByRole('button', { name: 'File 1 file again' }))
      await waitFor(() => expect(put).toHaveBeenCalledTimes(3))
      expect(put.mock.calls[2]![0]).toBe('s-new')
      expect(put.mock.calls[2]![1].name).toBe('IMG_2.jpg')
      await waitFor(() => expect(screen.queryByRole('button', { name: /again$/ })).toBeNull())
      expect(screen.getByTestId('job-plans-filed').textContent).toContain('Filed 1 file.')
      expect(screen.getByTestId('job-plans-filed').getAttribute('data-tone')).toBe('success')
      expect(io.addSet).toHaveBeenCalledTimes(1)
    })

    it('a file held back is still named after the press, and the line is not green', async () => {
      const put = vi.fn(async () => landed)
      renderWithProviders(<JobPlansSection job={job} io={emptyPart()} filesIo={fakeFilesIo({ put })} />)
      fireEvent.change(await openForm(), { target: { files: [photo('IMG_1.jpg'), tooBig()] } })
      fireEvent.click(screen.getByRole('button', { name: /^Add the as-built with 1 file/ }))
      const filed = await screen.findByTestId('job-plans-filed')
      expect(filed.textContent).toContain('Filed 1 file.')
      expect(filed.textContent).toContain('huge.jpg stayed behind · over 10 MB (11 MB)')
      expect(filed.getAttribute('data-tone')).toBe('warning')
      expect(filed.getAttribute('style')).toContain('--text-amber-800')
      expect(put).toHaveBeenCalledTimes(1)
    })

    it('with only a held file the as-built still adds and gets its folder, and the file stays named', async () => {
      const filesIo = fakeFilesIo()
      renderWithProviders(<JobPlansSection job={job} io={emptyPart()} filesIo={filesIo} />)
      fireEvent.change(await openForm(), { target: { files: [tooBig()] } })
      fireEvent.click(screen.getByRole('button', { name: 'Add the as-built without the file ▸' }))
      const filed = await screen.findByTestId('job-plans-filed')
      expect(filed.textContent).toContain('huge.jpg stayed behind')
      expect(filesIo.put).not.toHaveBeenCalled()
      expect(filesIo.folder).toHaveBeenCalledWith('s-new')
      expect(screen.getByRole('button', { name: 'Open the folder ↗' })).toBeTruthy()
    })

    it('each pick adds to the list, so three shots from the camera file three', async () => {
      const put = vi.fn(async () => landed)
      renderWithProviders(<JobPlansSection job={job} io={emptyPart()} filesIo={fakeFilesIo({ put })} />)
      const input = await openForm()
      const first = photo('image.jpg', 1)
      fireEvent.change(input, { target: { files: [first] } })
      expect(screen.getByRole('button', { name: 'Add more' })).toBeTruthy()
      fireEvent.change(input, { target: { files: [photo('image.jpg', 2)] } })
      fireEvent.change(input, { target: { files: [photo('image.jpg', 3)] } })
      fireEvent.change(input, { target: { files: [first] } })
      fireEvent.click(screen.getByRole('button', { name: 'Add the as-built with 3 files' }))
      await waitFor(() => expect(put).toHaveBeenCalledTimes(3))
    })

    it('Not these clears the picks', async () => {
      renderWithProviders(<JobPlansSection job={job} io={emptyPart()} filesIo={fakeFilesIo()} />)
      fireEvent.change(await openForm(), { target: { files: [photo('IMG_1.jpg')] } })
      fireEvent.click(screen.getByRole('button', { name: 'Not these' }))
      expect(screen.getByRole('button', { name: 'Add the as-built' })).toBeTruthy()
    })

    const mine = set({ id: 'ab-mine', name: 'As-built mine', kind: 'as_built', source: 'ours', link: '', job_id: 'j1', created_by: 'u1' })
    const theirs = set({ id: 'ab-theirs', name: 'As-built theirs', kind: 'as_built', source: 'ours', link: '', job_id: 'j1', created_by: 'u2' })
    const noLink = set({ id: 's-nolink', name: 'Addendum 1', kind: 'addendum', link: '' })

    it('an as-built on the list takes more files later, into its own set', async () => {
      const io = fakeIo({ job: { id: 'j1', plan_part_id: 'p1', development_id: null, development_name: null, job_plans_link: null }, part: { ...part, current_set_id: null }, sets: [mine] })
      const put = vi.fn(async () => landed)
      renderWithProviders(<JobPlansSection job={job} io={io} filesIo={fakeFilesIo({ put })} />)
      fireEvent.change(await screen.findByLabelText('Add photos or a PDF to As-built mine'), { target: { files: [photo('IMG_9.jpg'), tooBig()] } })
      await waitFor(() => expect(put).toHaveBeenCalledTimes(1))
      expect((put.mock.calls[0] as unknown[])[0]).toBe('ab-mine')
      const filed = await screen.findByTestId('job-plans-filed')
      expect(filed.textContent).toContain('Filed 1 file.')
      expect(filed.textContent).toContain('huge.jpg stayed behind')
      expect(io.addSet).not.toHaveBeenCalled()
    })

    it('a crew member adds files to their own as-built, not to someone else’s, and makes no folder for the office’s set', async () => {
      auth.role = 'helpers'
      const io = fakeIo({ job: { id: 'j1', plan_part_id: 'p1', development_id: null, development_name: null, job_plans_link: null }, part: { ...part, current_set_id: null }, sets: [mine, theirs, noLink] })
      renderWithProviders(<JobPlansSection job={job} io={io} filesIo={fakeFilesIo()} />)
      expect(await screen.findByLabelText('Add photos or a PDF to As-built mine')).toBeTruthy()
      expect(screen.queryByLabelText('Add photos or a PDF to As-built theirs')).toBeNull()
      expect(screen.queryByRole('button', { name: 'Make its folder' })).toBeNull()
    })

    it('a set with no link makes its folder; the set the job builds from tells the window, an older one does not', async () => {
      const current = set({ id: 's-current', name: 'Issued set', link: '' })
      const io = fakeIo({ job: { id: 'j1', plan_part_id: 'p1', development_id: null, development_name: null, job_plans_link: null }, part: { ...part, current_set_id: 's-current' }, sets: [current, noLink] })
      const filesIo = fakeFilesIo()
      const onPlansLinkChanged = vi.fn()
      renderWithProviders(<JobPlansSection job={job} io={io} filesIo={filesIo} onPlansLinkChanged={onPlansLinkChanged} />)
      const presses = await screen.findAllByRole('button', { name: 'Make its folder' })
      expect(presses).toHaveLength(2)
      fireEvent.click(presses[1]!)
      await waitFor(() => expect(filesIo.folder).toHaveBeenCalledWith('s-nolink'))
      await waitFor(() => expect((io.read as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(1))
      expect(onPlansLinkChanged).not.toHaveBeenCalled()
      fireEvent.click((await screen.findAllByRole('button', { name: 'Make its folder' }))[0]!)
      await waitFor(() => expect(onPlansLinkChanged).toHaveBeenCalledWith('https://drive.google.com/drive/folders/folder-s-current'))
    })

    it('a folder that cannot be made says why, and the press stays', async () => {
      const io = fakeIo({ job: { id: 'j1', plan_part_id: 'p1', development_id: null, development_name: null, job_plans_link: null }, part: { ...part, current_set_id: null }, sets: [noLink] })
      const filesIo = fakeFilesIo({ folder: vi.fn(async () => Promise.reject(new Error('That job has no Drive folder yet.'))) })
      renderWithProviders(<JobPlansSection job={job} io={io} filesIo={filesIo} />)
      fireEvent.click(await screen.findByRole('button', { name: 'Make its folder' }))
      expect(await screen.findByText('That job has no Drive folder yet.')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Make its folder' })).toBeTruthy()
    })

    it('an old filing’s line leaves when the next form opens, and when its set comes off', async () => {
      const io = fakeIo({ job: { id: 'j1', plan_part_id: 'p1', development_id: null, development_name: null, job_plans_link: null }, part: { ...part, current_set_id: null }, sets: [mine] })
      renderWithProviders(<JobPlansSection job={job} io={io} filesIo={fakeFilesIo()} />)
      const fileOne = async () => {
        fireEvent.change(await screen.findByLabelText('Add photos or a PDF to As-built mine'), { target: { files: [photo('IMG_9.jpg')] } })
        return screen.findByTestId('job-plans-filed')
      }
      await fileOne()
      fireEvent.click(screen.getAllByRole('button', { name: '+ New set' })[0]!)
      expect(screen.queryByTestId('job-plans-filed')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      await fileOne()
      fireEvent.click(screen.getByRole('button', { name: 'Remove As-built mine' }))
      fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
      await waitFor(() => expect(io.removeSet).toHaveBeenCalledWith('ab-mine'))
      await waitFor(() => expect(screen.queryByTestId('job-plans-filed')).toBeNull())
    })
  })
})
