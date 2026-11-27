// @vitest-environment jsdom
/**
 * Recently deleted's line for a deleted ZZ test job's Drive folder (punch list #443, row 18): a dev sees the press
 * on a ZZ-named job that kept a link, the confirm names the act, the function is asked with the job's id alone, and
 * its answer or its refusal stays on the card in its own words. Nobody else and no other bundle gets the line.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import DeletedJobFolderLine from './DeletedJobFolderLine'

const io = vi.hoisted(() => ({
  asked: [] as string[],
  answer: { act: 'trashed', words: 'Its Drive folder went to Drive’s trash, with the 5 folders inside. A manager of the Shared Drive can restore it for 30 days.' } as { act: string; words: string },
  refuse: null as null | Error,
}))
vi.mock('../../lib/jobs/jobDriveFoldersIo', () => ({
  trashDeletedJobFolder: async (jobId: string) => {
    io.asked.push(jobId)
    if (io.refuse) throw io.refuse
    return io.answer
  },
}))

const JOB = '11111111-1111-4111-8111-111111111111'
const LINK = 'https://drive.google.com/drive/folders/job-folder-id'
const bundle = { group_key: JOB, kind: 'job', label: '1142 · ZZ Test Payoff 1' }
const zz = { job_name: 'ZZ Test Payoff 1', customer_name: 'ZZ Test Payoff Customer', google_drive_link: LINK }
const PRESS = 'Send its Drive folder to the trash…'
const draw = (over: { role?: string; kind?: string; job?: typeof zz | null } = {}) =>
  renderWithProviders(<DeletedJobFolderLine role={over.role ?? 'dev'} bundle={{ ...bundle, kind: over.kind ?? 'job' }} job={over.job === undefined ? zz : over.job} />)

beforeEach(() => {
  io.asked = []
  io.answer = { act: 'trashed', words: 'Its Drive folder went to Drive’s trash, with the 5 folders inside. A manager of the Shared Drive can restore it for 30 days.' }
  io.refuse = null
})
afterEach(cleanup)

describe('DeletedJobFolderLine', () => {
  it('draws nothing for every role but a dev, for a bundle that is not a job, a real job, a job with no link or no kept copy', () => {
    for (const role of ['master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent']) {
      draw({ role })
      expect(screen.queryByTestId('deleted-job-folder')).toBeNull()
      cleanup()
    }
    for (const over of [{ kind: 'bid' }, { job: { ...zz, job_name: 'Cedar Bend', customer_name: 'Ridge Builders' } }, { job: { ...zz, google_drive_link: '' } }, { job: null }]) {
      draw(over)
      expect(screen.queryByTestId('deleted-job-folder')).toBeNull()
      cleanup()
    }
    expect(io.asked).toEqual([])
  })

  it('says the folder was left, and offers the press and a link to look first', () => {
    draw()
    expect(screen.getByText('This test job kept a Drive folder. Deleting the job did not remove it.')).toBeTruthy()
    expect(screen.getByRole('button', { name: PRESS })).toBeTruthy()
    const open = screen.getByRole('link', { name: 'Open it in Drive ↗' }) as HTMLAnchorElement
    expect(open.getAttribute('href')).toBe(LINK)
    expect(open.getAttribute('target')).toBe('_blank')
  })

  it('asks after a confirm that names the act, with the job’s id alone, and keeps the answer on the card', async () => {
    draw()
    fireEvent.click(screen.getByRole('button', { name: PRESS }))
    const yes = await screen.findByRole('button', { name: 'Send to Drive’s trash' })
    expect(screen.getByText('Send this job’s Drive folder to the trash?')).toBeTruthy()
    expect(screen.getByText(/^1142 · ZZ Test Payoff 1\. Its own Drive folder goes to Drive’s trash, and can be restored there for 30 days\./)).toBeTruthy()
    expect(io.asked).toEqual([])
    fireEvent.click(yes)
    await waitFor(() => expect(io.asked).toEqual([JOB]))
    const said = await screen.findByTestId('deleted-job-folder-said')
    expect(said.textContent).toBe(io.answer.words)
    expect(said.getAttribute('data-tone')).toBe('done')
    expect(screen.queryByRole('button', { name: PRESS })).toBeNull()
    expect(screen.getByRole('link', { name: 'Open it in Drive ↗' })).toBeTruthy()
  })

  it('asks nothing when the confirm is cancelled', async () => {
    draw()
    fireEvent.click(screen.getByRole('button', { name: PRESS }))
    await screen.findByRole('button', { name: 'Send to Drive’s trash' })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Send to Drive’s trash' })).toBeNull())
    expect(io.asked).toEqual([])
    expect(screen.queryByTestId('deleted-job-folder-said')).toBeNull()
  })

  it('says a folder already in the trash, or already gone, as done', async () => {
    io.answer = { act: 'already', words: 'Its Drive folder is already in Drive’s trash.' }
    draw()
    fireEvent.click(screen.getByRole('button', { name: PRESS }))
    fireEvent.click(await screen.findByRole('button', { name: 'Send to Drive’s trash' }))
    const said = await screen.findByTestId('deleted-job-folder-said')
    expect(said.textContent).toBe('Its Drive folder is already in Drive’s trash.')
    expect(said.getAttribute('data-tone')).toBe('done')
  })

  it('keeps each refusal on the card in the function’s own words, with the press still there', async () => {
    for (const words of [
      '1 bid still keeps this folder. It stays.',
      'A person added or changed 2 files in this folder by hand. It stays. Move them out, or trash it in Drive.',
      'This job is still here. Delete the job first. Its Drive folder then goes to the trash.',
      'Deleted records keeps no copy of that job, so its folder cannot be found. Nothing went to the trash.',
      'The folder is not under a customer’s folder in the jobs root. It stays.',
      'The app’s Drive function does not know this take-back yet. Its Drive folder stays.',
    ]) {
      io.refuse = new Error(words)
      draw()
      fireEvent.click(screen.getByRole('button', { name: PRESS }))
      fireEvent.click(await screen.findByRole('button', { name: 'Send to Drive’s trash' }))
      const said = await screen.findByTestId('deleted-job-folder-said')
      expect(said.textContent).toBe(words)
      expect(said.getAttribute('data-tone')).toBe('stays')
      await waitFor(() => expect((screen.getByRole('button', { name: PRESS }) as HTMLButtonElement).disabled).toBe(false))
      cleanup()
    }
  })
})
