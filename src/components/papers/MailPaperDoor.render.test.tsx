// @vitest-environment jsdom
/**
 * The mailbox door for papers over a fake io (punch list #239, the papers train): the press reads the job, the form
 * opens with the kind, the name, the sender and the day guessed from the mail, and the keep writes through the io
 * on the job's part. Made-up names only.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { JobPlansIo } from '../../lib/plans/planSetsIo'
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
    renderWithProviders(<MailPaperDoor io={io} jobId="j1" jobLabel="JP991" subject="Fwd: Task list items from Nate" senderAddress="owner@example.com" at="2026-06-24T15:00:00Z" />)
    fireEvent.click(screen.getByRole('button', { name: 'Keep this mail as a paper on JP991' }))
    const form = await screen.findByTestId('mail-paper-form')
    const inputs = form.querySelectorAll('input')
    expect((inputs[0] as HTMLInputElement).value).toBe('Task list items from Nate')
    expect((form.querySelectorAll('select')[1] as HTMLSelectElement).value).toBe('task_list')
    expect(form.textContent).toContain('Will write on the site’s History: Kept task list Task list items from Nate, the owner')
    fireEvent.click(screen.getByRole('button', { name: 'Keep the paper' }))
    await waitFor(() => expect(io.keepPaper).toHaveBeenCalled())
    const a = (io.keepPaper as ReturnType<typeof vi.fn>).mock.calls[0]![0]
    expect([a.partId, a.jobId, a.jobLabel, a.developmentId, a.siteName, a.draft.kind, a.draft.cameOn]).toEqual(['p1', 'j1', 'JP991', 'd1', 'Quail Ridge', 'task_list', '2026-06-24'])
    expect(io.pickPart).not.toHaveBeenCalled()
    expect(await screen.findByText(/Kept on Bunker: Task list items from Nate\./)).toBeTruthy()
  })

  it('names the part on a job that has none, from the site’s parts', async () => {
    const io = fakeIo({ read: vi.fn(async () => ({ job: { id: 'j1', plan_part_id: null, development_id: 'd1', development_name: 'Quail Ridge', job_plans_link: null }, part: null, sets: [], developmentParts: [], names: {} })) })
    renderWithProviders(<MailPaperDoor io={io} jobId="j1" jobLabel="JP991" subject="Spec book" senderAddress="eddie@reece.com" at="2025-07-07T15:00:00Z" />)
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
        { id: 'a1', name: 'spec-book.pdf', mime: 'application/pdf' },
        { id: 'a2', name: 'loads.xlsx', mime: null },
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
