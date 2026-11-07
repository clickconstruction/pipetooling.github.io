// @vitest-environment jsdom
/**
 * The mailbox door for papers over a fake io (punch list #239, the papers train): the press reads the job, the form
 * opens with the kind, the name, the sender and the day guessed from the mail, and the keep writes through the io
 * on the job's part. Made-up names only.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { JobPlansIo } from '../../lib/plans/planSetsIo'
import type { MailFile } from '../../lib/plans/planSetFiles'
import type { PlanSetFilesIo } from '../../lib/plans/planSetFilesIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { MailPaperDoor } from './MailPaperDoor'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ role: 'assistant', user: { id: 'u1' } }) }))

const part = { id: 'p1', development_id: 'd1', job_id: null, name: 'Bunker', position: 1, current_set_id: 's2', current_set_by: null, current_set_at: null, created_by: null, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' }

function fakeIo(over: Partial<JobPlansIo> = {}): JobPlansIo {
  return {
    read: vi.fn(async () => ({ job: { id: 'j1', plan_part_id: 'p1', development_id: 'd1', development_name: 'Quail Ridge', job_plans_link: null }, part, sets: [], developmentParts: [], names: {} })),
    readSite: vi.fn(async () => ({ parts: [part, { ...part, id: 'p2', name: 'Lodge' }], sets: [], names: {} })),
    makeSitePart: vi.fn(),
    makePart: vi.fn(),
    pickPart: vi.fn(async () => undefined),
    addSet: vi.fn(),
    makeCurrent: vi.fn(),
    removeSet: vi.fn(),
    movePaper: vi.fn(),
    updateMemo: vi.fn(),
    readPapers: vi.fn(async () => ({ rows: [], requests: [] })),
    keepPaper: vi.fn(async () => ({}) as never),
    markPaperCame: vi.fn(),
    ...over,
  } as unknown as JobPlansIo
}

afterEach(cleanup)

describe('MailPaperDoor', () => {
  it('opens the form from the mail and keeps the paper on the job’s part', async () => {
    const io = fakeIo()
    renderWithProviders(<MailPaperDoor io={io} jobId="j1" jobLabel="JP991" subject="Fwd: Task list items from the owner" senderAddress="owner@example.com" at="2026-06-24T15:00:00Z" />)
    fireEvent.click(screen.getByRole('button', { name: 'Keep this mail as a paper on JP991' }))
    const form = await screen.findByTestId('mail-paper-form')
    const inputs = form.querySelectorAll('input')
    expect((inputs[0] as HTMLInputElement).value).toBe('Task list items from the owner')
    expect((form.querySelectorAll('select')[1] as HTMLSelectElement).value).toBe('task_list')
    expect(form.textContent).toContain('Will write on the site’s History: Kept task list Task list items from the owner, the owner')
    fireEvent.click(screen.getByRole('button', { name: 'Keep the paper' }))
    await waitFor(() => expect(io.keepPaper).toHaveBeenCalled())
    const a = (io.keepPaper as ReturnType<typeof vi.fn>).mock.calls[0]![0]
    expect([a.partId, a.jobId, a.jobLabel, a.developmentId, a.siteName, a.draft.kind, a.draft.cameOn]).toEqual(['p1', 'j1', 'JP991', 'd1', 'Quail Ridge', 'task_list', '2026-06-24'])
    expect(io.pickPart).not.toHaveBeenCalled()
    expect(await screen.findByText(/Kept on Bunker: Task list items from the owner\./)).toBeTruthy()
  })

  it('names the part on a job that has none, from the site’s parts', async () => {
    const io = fakeIo({ read: vi.fn(async () => ({ job: { id: 'j1', plan_part_id: null, development_id: 'd1', development_name: 'Quail Ridge', job_plans_link: null }, part: null, sets: [], developmentParts: [], names: {} })) })
    renderWithProviders(<MailPaperDoor io={io} jobId="j1" jobLabel="JP991" subject="Spec book" senderAddress="sam@reece.example" at="2025-07-07T15:00:00Z" />)
    fireEvent.click(screen.getByRole('button', { name: 'Keep this mail as a paper on JP991' }))
    const form = await screen.findByTestId('mail-paper-form')
    fireEvent.change(form.querySelector('select')!, { target: { value: 'p2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Keep the paper' }))
    await waitFor(() => expect(io.pickPart).toHaveBeenCalledWith('j1', 'p2'))
    expect((io.keepPaper as ReturnType<typeof vi.fn>).mock.calls[0]![0].draft.from).toBe('supplier')
  })

  it('the mail’s files follow the paper into its folder, one that fails named, the rest still landing', async () => {
    const io = fakeIo({ keepPaper: vi.fn(async () => ({ id: 'paper-1' }) as never) })
    const filesIo: PlanSetFilesIo = {
      folder: vi.fn(),
      put: vi.fn(),
      attachmentsOf: vi.fn(async () => [
        { id: 'a1', name: 'spec-book.pdf', mime: 'application/pdf', copied: true, leftWhy: null },
        { id: 'a2', name: 'loads.xlsx', mime: null, copied: true, leftWhy: null },
      ]),
      saveAttachment: vi.fn(async (_setId: string, attachmentId: string) => {
        if (attachmentId === 'a2') throw new Error('Over 10 MB. Put it in the set’s folder in Drive instead.')
        return { driveFileId: 'f1', url: 'https://drive.google.com/file/d/f1/view', folderUrl: 'https://drive.google.com/drive/folders/paper' }
      }),
    }
    renderWithProviders(<MailPaperDoor io={io} filesIo={filesIo} messageId="m1" jobId="j1" jobLabel="JP991" subject="Spec book" senderAddress="eddie@example.com" at="2025-07-07T15:00:00Z" />)
    fireEvent.click(screen.getByRole('button', { name: 'Keep this mail as a paper on JP991' }))
    await screen.findByTestId('mail-paper-form')
    fireEvent.click(screen.getByRole('button', { name: 'Keep the paper' }))
    await waitFor(() => expect(filesIo.saveAttachment).toHaveBeenCalledTimes(2))
    expect(filesIo.attachmentsOf).toHaveBeenCalledWith('m1')
    expect((filesIo.saveAttachment as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0])).toEqual(['paper-1', 'paper-1'])
    const kept = await screen.findByText(/Kept on Bunker: Spec book\./)
    expect(kept.textContent).toContain('The mail’s file is in the paper’s folder.')
    expect(kept.textContent).toContain('One file did not land: loads.xlsx: Over 10 MB. Put it in the set’s folder in Drive instead.')
  })

  describe('what becomes of the mail’s files', () => {
    const keptPaper = () => fakeIo({ keepPaper: vi.fn(async () => ({ id: 'paper-1' }) as never) })
    const landed = { driveFileId: 'f1', url: 'https://drive.google.com/file/d/f1/view', folderUrl: 'https://drive.google.com/drive/folders/paper' }
    const file = (id: string, name: string, over: Partial<MailFile> = {}): MailFile => ({ id, name, mime: null, copied: true, leftWhy: null, ...over })
    const filesIoOf = (over: Partial<PlanSetFilesIo>): PlanSetFilesIo => ({ folder: vi.fn(), put: vi.fn(), attachmentsOf: vi.fn(async () => []), saveAttachment: vi.fn(async () => landed), ...over })
    const openForm = async (io: JobPlansIo, filesIo: PlanSetFilesIo, more: { messageId?: string | null; mailFileCount?: number } = { messageId: 'm1' }) => {
      renderWithProviders(<MailPaperDoor io={io} filesIo={filesIo} jobId="j1" jobLabel="JP991" subject="Spec book" senderAddress="sender@example.com" at="2025-07-07T15:00:00Z" {...more} />)
      fireEvent.click(screen.getByRole('button', { name: 'Keep this mail as a paper on JP991' }))
      return screen.findByTestId('mail-paper-form')
    }
    const keepIt = () => fireEvent.click(screen.getByRole('button', { name: 'Keep the paper' }))
    /** The color on the screen, since *did not land* once drew in green. */
    const colorOf = (kept: HTMLElement) => kept.querySelector('p')!.getAttribute('style') ?? ''

    it('all landed reads green', async () => {
      await openForm(keptPaper(), filesIoOf({ attachmentsOf: vi.fn(async () => [file('a1', 'spec-book.pdf')]) }))
      keepIt()
      const kept = await screen.findByTestId('mail-paper-kept')
      expect(kept.textContent).toContain('The mail’s file is in the paper’s folder.')
      expect(kept.getAttribute('data-tone')).toBe('success')
      expect(colorOf(kept)).toContain('--text-green-700')
      expect(screen.queryByRole('button', { name: /again$/ })).toBeNull()
    })

    it('a mail with no file and no link typed does not claim the paper holds a link; with one typed it says so', async () => {
      await openForm(keptPaper(), filesIoOf({}))
      keepIt()
      const kept = await screen.findByTestId('mail-paper-kept')
      expect(kept.textContent).toContain('The mail had no file to keep.')
      expect(kept.textContent).not.toContain('holds its link')
      cleanup()
      const form = await openForm(keptPaper(), filesIoOf({}))
      fireEvent.change(form.querySelector('input[placeholder^="A Drive link"]')!, { target: { value: 'https://drive.google.com/file/d/typed/view' } })
      keepIt()
      expect((await screen.findByTestId('mail-paper-kept')).textContent).toContain('The mail had no file to keep. The paper holds its link.')
    })

    it('a read that fails says so in amber, keeps the paper, and reads again on the same paper', async () => {
      const attachmentsOf = vi.fn<PlanSetFilesIo['attachmentsOf']>().mockRejectedValueOnce(new Error('No connection')).mockResolvedValueOnce([file('a1', 'spec-book.pdf')])
      const filesIo = filesIoOf({ attachmentsOf })
      const io = keptPaper()
      await openForm(io, filesIo)
      keepIt()
      const kept = await screen.findByTestId('mail-paper-kept')
      expect(kept.textContent).toContain('The mail’s files did not read: No connection. The paper is kept.')
      expect(kept.textContent).not.toContain('no file')
      expect(kept.getAttribute('data-tone')).toBe('warning')
      fireEvent.click(screen.getByRole('button', { name: 'Read the mail’s files again' }))
      await waitFor(() => expect(filesIo.saveAttachment).toHaveBeenCalledWith('paper-1', 'a1'))
      await waitFor(() => expect(screen.getByTestId('mail-paper-kept').textContent).toContain('The mail’s file is in the paper’s folder.'))
      expect(screen.getByTestId('mail-paper-kept').getAttribute('data-tone')).toBe('success')
      expect(io.keepPaper).toHaveBeenCalledTimes(1)
    })

    it('a file that stayed in Gmail is named and never sent', async () => {
      const filesIo = filesIoOf({ attachmentsOf: vi.fn(async () => [file('a1', 'spec-book.pdf'), file('a2', 'full-set.zip', { copied: false, leftWhy: 'too_big' })]) })
      await openForm(keptPaper(), filesIo)
      keepIt()
      const kept = await screen.findByTestId('mail-paper-kept')
      expect(kept.textContent).toContain('The mail’s file is in the paper’s folder.')
      expect(kept.textContent).toContain('full-set.zip stays in Gmail, too big for us to keep.')
      expect(kept.getAttribute('data-tone')).toBe('warning')
      expect((filesIo.saveAttachment as ReturnType<typeof vi.fn>).mock.calls).toEqual([['paper-1', 'a1']])
      expect(screen.queryByRole('button', { name: /again$/ })).toBeNull()
    })

    it('a file that did not land files again, only that one, on the same paper, and the count adds up', async () => {
      let refusing = true
      const saveAttachment = vi.fn(async (_setId: string, id: string) => {
        if (id === 'a2' && refusing) throw new Error('That job has no Drive folder yet.')
        return landed
      })
      const io = keptPaper()
      await openForm(io, filesIoOf({ attachmentsOf: vi.fn(async () => [file('a1', 'spec-book.pdf'), file('a2', 'loads.xlsx')]), saveAttachment }))
      keepIt()
      const kept = await screen.findByTestId('mail-paper-kept')
      expect(kept.textContent).toContain('One file did not land: loads.xlsx: That job has no Drive folder yet.')
      expect(kept.getAttribute('data-tone')).toBe('warning')
      expect(colorOf(kept)).toContain('--text-amber-800')
      expect(colorOf(kept)).not.toContain('--text-green-700')
      refusing = false
      fireEvent.click(screen.getByRole('button', { name: 'File 1 file again' }))
      await waitFor(() => expect(saveAttachment).toHaveBeenCalledTimes(3))
      expect(saveAttachment.mock.calls[2]).toEqual(['paper-1', 'a2'])
      await waitFor(() => expect(screen.getByTestId('mail-paper-kept').textContent).toContain('The mail’s 2 files are in the paper’s folder.'))
      expect(screen.getByTestId('mail-paper-kept').getAttribute('data-tone')).toBe('success')
      expect(screen.queryByRole('button', { name: /again$/ })).toBeNull()
      expect(io.keepPaper).toHaveBeenCalledTimes(1)
    })

    it('a mail no line holds says ahead of the press that its files stay, and says so again after', async () => {
      const form = await openForm(keptPaper(), filesIoOf({}), { messageId: null, mailFileCount: 2 })
      expect(form.textContent).toContain('This mail’s 2 files stay in Gmail for now. Press Put it on the job first and they follow the paper.')
      keepIt()
      const kept = await screen.findByTestId('mail-paper-kept')
      expect(kept.textContent).toContain('The mail’s 2 files stayed in Gmail, since no line on the job holds this mail.')
      expect(kept.getAttribute('data-tone')).toBe('warning')
    })
  })

  it('a mail with no line in Messages keeps the paper as before and files nothing', async () => {
    const io = fakeIo({ keepPaper: vi.fn(async () => ({ id: 'paper-1' }) as never) })
    const filesIo: PlanSetFilesIo = { folder: vi.fn(), put: vi.fn(), attachmentsOf: vi.fn(async () => []), saveAttachment: vi.fn() }
    renderWithProviders(<MailPaperDoor io={io} filesIo={filesIo} jobId="j1" jobLabel="JP991" subject="Spec book" senderAddress="eddie@example.com" at="2025-07-07T15:00:00Z" />)
    fireEvent.click(screen.getByRole('button', { name: 'Keep this mail as a paper on JP991' }))
    await screen.findByTestId('mail-paper-form')
    fireEvent.click(screen.getByRole('button', { name: 'Keep the paper' }))
    expect(await screen.findByText(/Kept on Bunker: Spec book\./)).toBeTruthy()
    expect(filesIo.attachmentsOf).not.toHaveBeenCalled()
  })
})
