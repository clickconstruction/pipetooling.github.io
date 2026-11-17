// @vitest-environment jsdom
/**
 * Take this job off the lien path, or put it back (the *not lienable* train, PR 3). The reads and the one write are
 * mocked; a made-up ZZ Test job shaped as the job that started this stood on 2026-11-16: one bill for trips to pick
 * up checks, and a monthly notice approved and not sent.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const { readLienJobPath, setJobLienPathAnswer } = vi.hoisted(() => ({ readLienJobPath: vi.fn(), setJobLienPathAnswer: vi.fn() }))
vi.mock('../../lib/jobs/lienJobPathIo', () => ({ readLienJobPath, setJobLienPathAnswer }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import LienJobPathWindow from './LienJobPathWindow'

const READ = {
  jobId: 'j977',
  number: '977',
  name: 'ZZ Test Trip Charges',
  status: 'billed',
  unpaid: 1050,
  attorneySince: null,
  papers: [{ kind: 'notice_53_056', status: 'approved', months: ['2026-09'], sent_at: null, approved_at: '2026-10-05T15:00:00Z', voided_at: null }],
  billLines: [{ name: '3 separate trip charges to pick up checks. No checks were in the box.', amount: 1050 }],
  off: false,
  reason: '',
  since: null,
  byName: '',
}
const REASON = 'The bill is for trips to pick up checks, not for work on the property.'
const OK = { answer: 'off_path', changed: true, onAttorneyList: false, alreadyOnList: false, held: null }
const press = () => screen.getByTestId('lien-job-path-press') as HTMLButtonElement
const reasonBox = (name: string) => screen.getByRole('textbox', { name }) as HTMLTextAreaElement

afterEach(() => {
  cleanup()
  readLienJobPath.mockReset()
  setJobLienPathAnswer.mockReset()
})

describe('LienJobPathWindow · the way off', () => {
  const open = async (read: Record<string, unknown> = READ, onClose = vi.fn()) => {
    readLienJobPath.mockResolvedValue(read)
    renderWithProviders(<LienJobPathWindow jobId="j977" onClose={onClose} />)
    await screen.findByText('977 · ZZ Test Trip Charges · $1,050 unpaid')
    return onClose
  }

  it('shows the job, what it billed in the bill’s own words, its lien papers and what the press does', async () => {
    await open()
    expect(readLienJobPath).toHaveBeenCalledWith('j977')
    expect(screen.getByRole('dialog', { name: 'Take this job off the lien path?' })).toBeTruthy()
    const lines = [...document.querySelectorAll('[data-lien-job-path-bill-line]')] as HTMLElement[]
    expect(lines).toHaveLength(1)
    expect(lines[0]!.textContent).toContain('3 separate trip charges to pick up checks.')
    expect(lines[0]!.textContent).toContain('$1,050')
    expect(screen.getByText(/A lien is for labor done or materials furnished to the property/)).toBeTruthy()
    expect(document.querySelector('[data-lien-job-path-went-out]')!.textContent).toBe('No lien paper has gone out. A lien notice was approved Oct 5 and not sent.')
    const does = [...document.querySelectorAll('[data-lien-job-path-does] li')].map((li) => li.textContent)
    expect(does).toContain('Nothing is filed, voided or deleted. Its lien papers stay as they are, and they are back if the job is put back.')
    expect(does).toContain('It does not go on the attorney’s list.')
  })

  it('the press names the act and the job, and is dead until a reason is written', async () => {
    await open()
    expect(press().textContent).toBe('Take 977 off the lien path')
    expect(press().disabled).toBe(true)
    fireEvent.change(reasonBox('Why this job is off the lien path'), { target: { value: '   ' } })
    expect(press().disabled).toBe(true)
    fireEvent.change(reasonBox('Why this job is off the lien path'), { target: { value: REASON } })
    expect(press().disabled).toBe(false)
  })

  it('takes the job off with the reason, not on the attorney’s list unless ticked, and closes as changed', async () => {
    const onClose = await open()
    setJobLienPathAnswer.mockResolvedValue(OK)
    fireEvent.change(reasonBox('Why this job is off the lien path'), { target: { value: REASON } })
    fireEvent.click(press())
    await waitFor(() => expect(onClose).toHaveBeenCalledWith(true))
    expect(setJobLienPathAnswer).toHaveBeenCalledWith({ jobId: 'j977', answer: 'off_path', reason: REASON, attorneyList: false })
    expect(await screen.findByText('977 is off the lien path.')).toBeTruthy()
  })

  it('ticked, it asks for the attorney’s list, says so before the press, and says afterwards what the list answered', async () => {
    const onClose = await open({ ...READ, status: 'working' })
    setJobLienPathAnswer.mockResolvedValue({ ...OK, held: 'Job must be in Billed Awaiting Payment to change Collections' })
    expect(document.querySelector('[data-lien-job-path-list-note]')).toBeNull()
    fireEvent.click(document.querySelector('[data-lien-job-path-list-tick]')!)
    expect(document.querySelector('[data-lien-job-path-list-note]')!.textContent).toBe('977 is still being worked, so it cannot go on the Collections list yet. It still leaves the lien path.')
    expect([...document.querySelectorAll('[data-lien-job-path-does] li')].map((li) => li.textContent)).toContain('It goes on the attorney’s list, with your reason as the note.')
    fireEvent.change(reasonBox('Why this job is off the lien path'), { target: { value: REASON } })
    fireEvent.click(press())
    await waitFor(() => expect(onClose).toHaveBeenCalledWith(true))
    expect(setJobLienPathAnswer).toHaveBeenCalledWith({ jobId: 'j977', answer: 'off_path', reason: REASON, attorneyList: true })
    expect(await screen.findByText('977 is off the lien path. It did not go on the attorney’s list: Job must be in Billed Awaiting Payment to change Collections.')).toBeTruthy()
  })

  it('a job already on the attorney’s list has no tick, and the window says since when', async () => {
    await open({ ...READ, attorneySince: '2026-10-08T15:00:00Z' })
    expect(document.querySelector('[data-lien-job-path-list-tick]')).toBeNull()
    expect(screen.getByText('It is on the attorney’s list already, since Oct 8.')).toBeTruthy()
  })

  it('a job with no bill lines says so and where to read its bills', async () => {
    await open({ ...READ, billLines: [] })
    expect(document.querySelector('[data-lien-job-path-no-lines]')!.textContent).toBe('This job has no bill lines on record. Open the job to read its bills before you decide.')
  })

  it('a refusal says the job is still on the lien path, with the reason, and the window stays', async () => {
    const onClose = await open()
    setJobLienPathAnswer.mockRejectedValue(new Error('Not authorized to take a job off the lien path'))
    fireEvent.change(reasonBox('Why this job is off the lien path'), { target: { value: REASON } })
    fireEvent.click(press())
    expect(await screen.findByText('977 is still on the lien path: Not authorized to take a job off the lien path')).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
    expect(press().disabled).toBe(false)
  })

  it('Cancel and Escape close with nothing changed', async () => {
    const onClose = await open()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenLastCalledWith(false)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
    expect(setJobLienPathAnswer).not.toHaveBeenCalled()
  })

  it('a read that fails says why and offers to try again', async () => {
    readLienJobPath.mockRejectedValueOnce(new Error('the line dropped')).mockResolvedValue(READ)
    renderWithProviders(<LienJobPathWindow jobId="j977" onClose={vi.fn()} />)
    expect(await screen.findByText('The job could not be read: the line dropped')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('977 · ZZ Test Trip Charges · $1,050 unpaid')).toBeTruthy()
  })
})

describe('LienJobPathWindow · the way back', () => {
  const OFF = { ...READ, off: true, reason: REASON, since: '2026-11-16T21:00:00Z', byName: 'Dana' }
  const open = async (onClose = vi.fn()) => {
    readLienJobPath.mockResolvedValue(OFF)
    renderWithProviders(<LienJobPathWindow jobId="j977" onClose={onClose} />)
    await screen.findByRole('dialog', { name: 'Put this job back on the lien path?' })
    return onClose
  }

  it('on a job that is off the path, shows why it came off, who and the day, and what putting it back does', async () => {
    await open()
    expect(document.querySelector('[data-lien-job-path-came-off]')!.textContent).toBe(`Taken off since Nov 16, by Dana. The reason given: ${REASON}`)
    expect(document.querySelector('[data-lien-job-path-list-tick]')).toBeNull()
    expect(document.querySelector('[data-lien-job-path-bill-line]')).toBeNull()
    expect([...document.querySelectorAll('[data-lien-job-path-does] li')].map((li) => li.textContent)).toContain('Its lien dates did not stop while it was off. Check each one first.')
    expect(press().textContent).toBe('Put 977 back on the lien path')
    expect(press().disabled).toBe(true)
  })

  it('puts it back with a reason, and closes as changed', async () => {
    const onClose = await open()
    setJobLienPathAnswer.mockResolvedValue({ answer: null, changed: true, onAttorneyList: false, alreadyOnList: false, held: null })
    fireEvent.change(reasonBox('Why this job goes back on the lien path'), { target: { value: 'The attorney says the claim stands.' } })
    fireEvent.click(press())
    await waitFor(() => expect(onClose).toHaveBeenCalledWith(true))
    expect(setJobLienPathAnswer).toHaveBeenCalledWith({ jobId: 'j977', answer: 'on_path', reason: 'The attorney says the claim stands.' })
    expect(await screen.findByText('977 is back on the lien path. Its papers are on the Lien desk again.')).toBeTruthy()
  })

  it('a refusal says the job is still off the lien path', async () => {
    const onClose = await open()
    setJobLienPathAnswer.mockRejectedValue(new Error('Say why this job goes back on the lien path'))
    fireEvent.change(reasonBox('Why this job goes back on the lien path'), { target: { value: 'x' } })
    fireEvent.click(press())
    expect(await screen.findByText('977 is still off the lien path: Say why this job goes back on the lien path')).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
  })
})
