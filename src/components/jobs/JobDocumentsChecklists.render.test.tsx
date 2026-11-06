// @vitest-environment jsdom
/**
 * The Documents tab's Stage checklists read-out over a fake io (punch list #237, PR 1): each stage with its standing
 * chip, every row with its pick, stamp, note and photo, *open* for what is unanswered, an item added for the job
 * with its adder, the office's inline add and two-press take off, a job with no stage that takes a checklist, a read
 * that fails with its reason and Retry, and the strip above the tabs moving with the section. What the walks added is
 * in `JobDocumentsChecklists.walks.render.test.tsx`. Made-up names and questions on a made-up job.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { JobStageRef, StageChecklistQuestion } from '../../lib/jobs/stageChecklist'
import type { AnswerKey, JobAnswer, StageChecklistSheetIo } from '../../lib/jobs/stageChecklistSheetIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { JobStageChecklistStrip } from '../stageChecklists/JobStageChecklistStrip'
import { JobDocumentsChecklists } from './JobDocumentsChecklists'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
let authRole = 'assistant'
vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue, useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  const value = () => makeUseAuthValue({ role: authRole, profileName: 'Jo Sample', user: { id: 'u-jo', email: 'smoke@example.com' } })
  return { ...useAuthModuleMock(), useAuth: value, useOptionalAuth: value }
})

const JOB = { id: 'job-zz-1' }
const STAGES: JobStageRef[] = [
  { fixtureId: 'f1', name: 'Rough In', sequenceOrder: 1 },
  { fixtureId: 'f3', name: 'Trim Set', sequenceOrder: 3 },
  { fixtureId: 'f9', name: 'Permit', sequenceOrder: 0 },
]
const Q: StageChecklistQuestion[] = [
  { id: 'q1', kind: 'rough_in', order: 1, words: 'Is the water test on?', asksPhoto: false },
  { id: 't1', kind: 'trim_set', order: 1, words: 'Did the final water test hold?', asksPhoto: true },
  { id: 't2', kind: 'trim_set', order: 2, words: 'Are the cleanouts capped and marked?', asksPhoto: false },
  { id: 'j1', kind: 'trim_set', order: 0, words: 'Are the carriers in units 7 and 8 set?', asksPhoto: false, fixtureId: 'f3', addedById: 'u-pat', addedBy: 'Pat Sample', addedAt: '2026-11-01T15:00:00.000Z' },
]
const answer = (key: AnswerKey, over: Partial<JobAnswer> = {}): JobAnswer => ({ id: `a-${key.questionId}`, fixtureId: key.fixtureId, questionId: key.questionId, pick: null, note: '', photo: null, answeredBy: '', answeredAt: null, storagePath: null, reportPhotoId: null, ...over })
const ANSWERS: JobAnswer[] = [
  answer({ jobId: JOB.id, fixtureId: 'f1', questionId: 'q1' }, { pick: 'yes', answeredBy: 'Luis Ortega', answeredAt: '2026-10-14T20:30:00.000Z' }),
  answer({ jobId: JOB.id, fixtureId: 'f3', questionId: 't1' }, { pick: 'yes', answeredBy: 'Luis Ortega', answeredAt: '2026-11-01T15:14:00.000Z', photo: { fileName: 'x.jpg', takenAt: '2026-11-01T15:15:00.000Z', state: 'filed', driveFileId: 'd1', failWhy: null } }),
  answer({ jobId: JOB.id, fixtureId: 'f3', questionId: 't2' }, { pick: 'no', note: 'Roofer not here until Mon', answeredBy: 'Luis Ortega', answeredAt: '2026-11-01T15:20:00.000Z' }),
]

function fakeIo(over: Partial<StageChecklistSheetIo> = {}, questions: StageChecklistQuestion[] = Q, answers: JobAnswer[] = ANSWERS): StageChecklistSheetIo {
  const live = [...questions]
  let seq = 0
  return {
    stages: vi.fn(async () => STAGES),
    questions: vi.fn(async () => [...live]),
    answers: vi.fn(async () => [...answers]),
    pick: vi.fn(async () => { throw new Error('not here') }),
    note: vi.fn(async () => { throw new Error('not here') }),
    photo: vi.fn(async () => { throw new Error('not here') }),
    photoUrl: vi.fn(async () => null),
    sign: vi.fn(async () => { throw new Error('not here') }),
    takeBack: vi.fn(async () => { throw new Error('not here') }),
    inkUrl: vi.fn(async () => null),
    records: vi.fn(async () => []),
    amend: vi.fn(async () => { throw new Error('not here') }),
    addItem: vi.fn(async (input, who) => {
      const q: StageChecklistQuestion = { id: `j-new-${++seq}`, kind: input.kind, order: 0, words: input.words, asksPhoto: input.asksPhoto, fixtureId: input.fixtureId, addedById: who.userId, addedBy: who.name, addedAt: '2026-11-01T16:00:00.000Z' }
      live.push(q)
      return q
    }),
    retireItem: vi.fn(async (id) => {
      const i = live.findIndex((q) => q.id === id)
      if (i >= 0) live.splice(i, 1)
    }),
    mayAuthor: vi.fn(async () => false),
    skip: vi.fn(async () => {
      throw new Error('not here')
    }),
    putBack: vi.fn(async () => undefined),
    reorder: vi.fn(async () => undefined),
    promote: vi.fn(async () => {
      throw new Error('not here')
    }),
    ...over,
  }
}

afterEach(() => {
  cleanup()
  authRole = 'assistant'
})

const stageRows = () => screen.getAllByTestId('job-documents-checklist-stage')

describe('JobDocumentsChecklists', () => {
  it('reads each stage with its standing and every row with its pick, stamp, note, photo and adder', async () => {
    renderWithProviders(<JobDocumentsChecklists job={JOB} io={fakeIo()} />)
    expect(await screen.findByTestId('job-documents-checklists-summary')).toHaveProperty('textContent', '1 of 2 stages ready · 1 item added on this job')
    const [rough, trim] = stageRows()
    expect(rough!.getAttribute('data-standing')).toBe('ready')
    expect(within(rough!).getByText('Ready · 1 of 1')).toBeTruthy()
    expect(trim!.getAttribute('data-standing')).toBe('not_ready')
    expect(within(trim!).getByText('Not ready · 2 of 3')).toBeTruthy()
    // Permit takes no checklist, so it is not listed.
    expect(screen.queryByText('Permit')).toBeNull()

    const rows = within(trim!).getAllByTestId('job-documents-checklist-row')
    expect(rows.map((r) => r.getAttribute('data-pick'))).toEqual(['yes', 'no', 'open'])
    expect(rows[0]!.textContent).toContain('1. Did the final water test hold?')
    expect(rows[0]!.textContent).toContain('Yes · Luis Ortega · Nov 1 · 9:14 am · photo in Drive')
    expect(rows[1]!.textContent).toContain('No · Luis Ortega · Nov 1 · 9:20 am · “Roofer not here until Mon”')
    expect(rows[2]!.textContent).toContain('open · 3. Are the carriers in units 7 and 8 set?')
    expect(rows[2]!.textContent).toContain('Added by Pat Sample · Nov 1')
    expect(screen.getByText(/A No or a Not here is an answer\./)).toBeTruthy()
  })

  it('folds a stage on its name', async () => {
    renderWithProviders(<JobDocumentsChecklists job={JOB} io={fakeIo()} />)
    await screen.findByTestId('job-documents-checklists-summary')
    const name = screen.getByRole('button', { name: 'Rough In' })
    expect(name.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(name)
    expect(name.getAttribute('aria-expanded')).toBe('false')
    expect(within(stageRows()[0]!).queryAllByTestId('job-documents-checklist-row')).toHaveLength(0)
  })

  it('lets the office add a check inline and take one off with two presses; the chip and the summary move', async () => {
    const io = fakeIo()
    renderWithProviders(<JobDocumentsChecklists job={JOB} io={io} />)
    await screen.findByTestId('job-documents-checklists-summary')
    const trim = () => stageRows()[1]!
    fireEvent.click(within(trim()).getByRole('button', { name: '+ Add a check for Trim Set' }))
    fireEvent.change(await screen.findByLabelText('Add a check for Trim Set on this job'), { target: { value: 'Photo of the ADA lav rough heights before the wall closes' } })
    fireEvent.click(screen.getByLabelText('Asks for a photo'))
    fireEvent.click(screen.getByRole('button', { name: 'Add the check' }))
    await waitFor(() => expect(io.addItem).toHaveBeenCalledWith({ jobId: JOB.id, fixtureId: 'f3', kind: 'trim_set', order: 1, words: 'Photo of the ADA lav rough heights before the wall closes', asksPhoto: true, needsSignature: false, sheet: '', why: '' }, { userId: 'u-jo', name: 'Jo Sample' }))
    expect(await screen.findByText('Added. Trim Set is now 2 of 4.')).toBeTruthy()
    expect(within(trim()).getByText('Not ready · 2 of 4')).toBeTruthy()
    expect(screen.getByTestId('job-documents-checklists-summary').textContent).toBe('1 of 2 stages ready · 2 items added on this job')
    const added = within(trim()).getAllByTestId('job-documents-checklist-row')[3]!
    expect(added.textContent).toContain('You added this · Nov 1')
    expect(within(added).getByText('asks for a photo')).toBeTruthy()

    // The office takes off the superintendent's item: Take off, then Take it off.
    fireEvent.click(within(trim()).getByRole('button', { name: 'Take off: Are the carriers in units 7 and 8 set?' }))
    expect(await screen.findByTestId('job-documents-checklist-take-off')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Take it off' }))
    await waitFor(() => expect(io.retireItem).toHaveBeenCalledWith('j1', { userId: 'u-jo', name: 'Jo Sample' }))
    expect(await screen.findByText('Taken off. Trim Set is now 2 of 3.')).toBeTruthy()
    expect(within(trim()).queryByText('Are the carriers in units 7 and 8 set?')).toBeNull()
    // A company question has no take off.
    expect(screen.queryByRole('button', { name: 'Take off: Did the final water test hold?' })).toBeNull()
  })

  it('offers the first check on a stage with no question yet, and nothing to a primary', async () => {
    const io = fakeIo({}, [], [])
    renderWithProviders(<JobDocumentsChecklists job={JOB} io={io} />)
    await waitFor(() => expect(stageRows()).toHaveLength(2))
    expect(screen.queryByTestId('job-documents-checklists-summary')).toBeNull()
    expect(within(stageRows()[0]!).getByText('No questions yet')).toBeTruthy()
    expect(screen.getByRole('button', { name: '+ Add a check for Rough In' })).toBeTruthy()
    cleanup()
    authRole = 'primary'
    renderWithProviders(<JobDocumentsChecklists job={JOB} io={fakeIo({}, [], [])} />)
    await waitFor(() => expect(stageRows()).toHaveLength(2))
    expect(screen.queryByRole('button', { name: '+ Add a check for Rough In' })).toBeNull()
    expect(screen.getAllByText(/The office writes them on Settings/)).toHaveLength(2)
  })

  it('names the adder on an answered item, and takes the photo tag off a Not here', async () => {
    const answered = [
      answer({ jobId: JOB.id, fixtureId: 'f3', questionId: 'j1' }, { pick: 'yes', answeredBy: 'Luis Ortega', answeredAt: '2026-11-01T15:14:00.000Z' }),
      answer({ jobId: JOB.id, fixtureId: 'f3', questionId: 't1' }, { pick: 'not_here', answeredBy: 'Luis Ortega', answeredAt: '2026-11-01T15:20:00.000Z' }),
    ]
    renderWithProviders(<JobDocumentsChecklists job={JOB} io={fakeIo({}, Q, answered)} />)
    await screen.findByTestId('job-documents-checklists-summary')
    const rows = within(stageRows()[1]!).getAllByTestId('job-documents-checklist-row')
    expect(rows[0]!.textContent).toContain('Not here · Luis Ortega · Nov 1 · 9:20 am')
    expect(within(rows[0]!).queryByText('asks for a photo')).toBeNull()
    expect(rows[2]!.textContent).toContain('Yes · Luis Ortega · Nov 1 · 9:14 am · Added by Pat Sample · Nov 1')
  })

  it('moves with the strip above the tabs: a check added here counts there, an answer on the strip’s sheet lands here', async () => {
    const io = fakeIo()
    renderWithProviders(
      <>
        <JobStageChecklistStrip jobId={JOB.id} io={io} />
        <JobDocumentsChecklists job={JOB} io={io} />
      </>,
    )
    expect(await screen.findByRole('button', { name: 'Trim Set checklist: 2 of 3 answered, not ready' })).toBeTruthy()
    await screen.findByTestId('job-documents-checklists-summary')
    const trim = () => stageRows()[1]!
    fireEvent.click(within(trim()).getByRole('button', { name: '+ Add a check for Trim Set' }))
    fireEvent.change(await screen.findByLabelText('Add a check for Trim Set on this job'), { target: { value: 'Is the pan drain run to the hub?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add the check' }))
    expect(await screen.findByRole('button', { name: 'Trim Set checklist: 2 of 4 answered, not ready' })).toBeTruthy()
    expect(within(trim()).getByText('Not ready · 2 of 4')).toBeTruthy()

    const picked: JobAnswer = answer({ jobId: JOB.id, fixtureId: 'f3', questionId: 'j1' }, { pick: 'yes', answeredBy: 'Jo Sample', answeredAt: '2026-11-01T16:30:00.000Z' })
    vi.mocked(io.pick).mockResolvedValueOnce(picked)
    fireEvent.click(screen.getByRole('button', { name: 'Trim Set checklist: 2 of 4 answered, not ready' }))
    fireEvent.click(within(await screen.findByRole('group', { name: 'Are the carriers in units 7 and 8 set?' })).getByRole('button', { name: 'Yes' }))
    await waitFor(() => expect(within(trim()).getByText('Not ready · 3 of 4')).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Trim Set checklist: 3 of 4 answered, not ready' })).toBeTruthy()
  })

  it('says so on a job with no stage that takes a checklist, offering the Bill tab, and reads a failure with Retry', async () => {
    const none = fakeIo({ stages: vi.fn(async () => [{ fixtureId: 'f9', name: 'Permit', sequenceOrder: 0 }]) })
    const onRequestTab = vi.fn()
    renderWithProviders(<JobDocumentsChecklists job={JOB} io={none} onRequestTab={onRequestTab} />)
    expect(await screen.findByText('No stages take a checklist on this job.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Bill' }))
    expect(onRequestTab).toHaveBeenCalledWith('bill')
    cleanup()
    // A refusal reads its reason with no Retry; a lost signal offers Retry.
    const refused = fakeIo({ answers: vi.fn(async () => { throw new Error('permission denied for table stage_checklist_answers') }) })
    renderWithProviders(<JobDocumentsChecklists job={JOB} io={refused} />)
    expect(await screen.findByText(/permission denied for table stage_checklist_answers/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Retry/ })).toBeNull()
    cleanup()
    const lost = fakeIo({ answers: vi.fn(async () => { throw new TypeError('Failed to fetch') }) })
    renderWithProviders(<JobDocumentsChecklists job={JOB} io={lost} />)
    expect(await screen.findByRole('button', { name: /Retry/ })).toBeTruthy()
  })

  it('a check with Dispatch wears the sheet’s chip on its row with Dispatch’s reply, and the chip leaves with Take off (#245, PR 3)', async () => {
    const open = vi.fn(async () => [
      { id: 'r1', fixtureId: 'f3', questionId: 'j1', title: 'Trim Set · “Are the carriers in units 7 and 8 set?” · need a part: the caps · J1085', createdAt: '2026-11-01T15:48:00.000Z', priority: 'normal', fromUserId: 'u-pat', reply: { body: 'Caps come Thursday.', by: 'Jo Sample', at: '2026-11-01T15:58:00.000Z' } },
    ])
    const io = fakeIo({ dispatch: { job: vi.fn(async () => ({ id: JOB.id })), open, send: vi.fn(async () => ({ id: 'x', pushed: true, pushError: null })) } })
    renderWithProviders(<JobDocumentsChecklists job={JOB} io={io} />)
    await screen.findByTestId('job-documents-checklists-summary')
    const chip = await screen.findByText(/^With Dispatch · .* · need a part$/)
    expect(open).toHaveBeenCalledWith(JOB.id)
    expect(chip.getAttribute('data-checklist-with-dispatch')).toBe('j1')
    const row = chip.closest('[data-testid="job-documents-checklist-row"]') as HTMLElement
    expect(row.textContent).toContain('Are the carriers in units 7 and 8 set?')
    expect(within(row).getByText(/^Dispatch: “Caps come Thursday\.” · Jo/)).toBeTruthy()
    // The other rows carry no chip.
    expect(document.querySelectorAll('[data-checklist-with-dispatch]')).toHaveLength(1)
    fireEvent.click(within(row).getByRole('button', { name: 'Take off: Are the carriers in units 7 and 8 set?' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Take it off' }))
    await waitFor(() => expect(document.querySelector('[data-checklist-with-dispatch]')).toBeNull())
  })

  it('draws no chip when the read of the checks with Dispatch is refused', async () => {
    const io = fakeIo({ dispatch: { job: vi.fn(async () => ({ id: JOB.id })), open: vi.fn(async () => { throw new Error('refused') }), send: vi.fn(async () => ({ id: 'x', pushed: true, pushError: null })) } })
    renderWithProviders(<JobDocumentsChecklists job={JOB} io={io} />)
    await screen.findByTestId('job-documents-checklists-summary')
    expect(screen.getAllByTestId('job-documents-checklist-row').length).toBeGreaterThan(0)
    expect(document.querySelector('[data-checklist-with-dispatch]')).toBeNull()
  })
})
