// @vitest-environment jsdom
/**
 * The stage checklist strip and its sheet over a fake io (punch list #164, PR 3; the sheet's second pass and the
 * items on the job, punch list #237, PR 1). A job whose kinds have no questions draws nothing for the crew; a job
 * with questions lists each stage with its standing; the sheet keeps one row open at a time, labelled Next, answers
 * it with one press and moves on, stamps the answered row with the name and the time, waits on a photo, and lights
 * Done once every question is answered. A superintendent adds a check under *Added for this job* and takes it off;
 * a helper sees the group and no add press. A stage with no question is listed for a superintendent who authors on the
 * job. A read that fails draws nothing. What the walks added is in `StageChecklistSheet.walks.render.test.tsx`. Made-up
 * questions and a made-up job.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { JobStageRef, StageChecklistQuestion } from '../../lib/jobs/stageChecklist'
import type { AnswerKey, JobAnswer, StageChecklistSheetIo } from '../../lib/jobs/stageChecklistSheetIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { JobStageChecklistStrip } from './JobStageChecklistStrip'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
let authRole = 'helpers'
let authName = 'Jordan Vale'
let authUserId = 'u-jordan'
vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue, useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  const value = () => makeUseAuthValue({ role: authRole, profileName: authName, user: { id: authUserId, email: 'smoke@example.com' } })
  return { ...useAuthModuleMock(), useAuth: value, useOptionalAuth: value }
})

const JOB = 'job-zz-1'
const STAGES: JobStageRef[] = [
  { fixtureId: 'f1', name: 'Rough In', sequenceOrder: 1 },
  { fixtureId: 'f2', name: 'Top Out', sequenceOrder: 2 },
  { fixtureId: 'f3', name: 'Trim Set', sequenceOrder: 3 },
]
const Q: StageChecklistQuestion[] = [
  { id: 'q1', kind: 'rough_in', order: 1, words: 'Did the water test hold?', asksPhoto: true },
  { id: 'q2', kind: 'rough_in', order: 2, words: 'Are the stub-outs marked?', asksPhoto: false },
]
const ITEM: StageChecklistQuestion = { id: 'j1', kind: 'rough_in', order: 0, words: 'Are the carriers in units 7 and 8 set?', asksPhoto: false, fixtureId: 'f1', addedById: 'u-pat', addedBy: 'Pat Sample', addedAt: '2026-11-01T15:00:00.000Z' }

let seq = 0
const answer = (key: AnswerKey, over: Partial<JobAnswer> = {}): JobAnswer => ({ id: over.id ?? `a${++seq}`, fixtureId: key.fixtureId, questionId: key.questionId, pick: null, note: '', photo: null, answeredBy: '', answeredAt: null, storagePath: null, reportPhotoId: null, ...over })

function fakeIo(over: Partial<StageChecklistSheetIo> = {}, answers: JobAnswer[] = [], questions: StageChecklistQuestion[] = Q): StageChecklistSheetIo {
  const kept = new Map<string, JobAnswer>(answers.map((a) => [`${a.fixtureId}|${a.questionId}`, a]))
  const live = [...questions]
  const row = (key: AnswerKey) => kept.get(`${key.fixtureId}|${key.questionId}`) ?? answer(key)
  return {
    stages: vi.fn(async () => STAGES),
    questions: vi.fn(async () => [...live]),
    answers: vi.fn(async () => [...kept.values()]),
    pick: vi.fn(async (key, pick, who) => {
      const next = { ...row(key), pick, answeredBy: who.name, answeredAt: '2026-11-01T15:14:00.000Z' }
      kept.set(`${key.fixtureId}|${key.questionId}`, next)
      return next
    }),
    note: vi.fn(async (key, note) => {
      const next = { ...row(key), note }
      kept.set(`${key.fixtureId}|${key.questionId}`, next)
      return next
    }),
    photo: vi.fn(async (input) => {
      const next = { ...row(input), photo: { fileName: input.fileName, takenAt: input.takenAt, state: 'waiting' as const, driveFileId: null, failWhy: null }, storagePath: `${input.jobId}/x.jpg` }
      kept.set(`${input.fixtureId}|${input.questionId}`, next)
      return next
    }),
    photoUrl: vi.fn(async () => null),
    sign: vi.fn(async () => { throw new Error('not here') }),
    takeBack: vi.fn(async () => { throw new Error('not here') }),
    inkUrl: vi.fn(async () => null),
    records: vi.fn(async () => []),
    amend: vi.fn(async () => { throw new Error('not here') }),
    addItem: vi.fn(async (input, who) => {
      const q: StageChecklistQuestion = { id: `j${++seq}`, kind: input.kind, order: 0, words: input.words, asksPhoto: input.asksPhoto, fixtureId: input.fixtureId, addedById: who.userId, addedBy: who.name, addedAt: '2026-11-01T16:00:00.000Z' }
      live.push(q)
      return q
    }),
    retireItem: vi.fn(async (id) => {
      const i = live.findIndex((q) => q.id === id)
      if (i >= 0) live.splice(i, 1)
    }),
    mayAuthor: vi.fn(async () => true),
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
  authRole = 'helpers'
  authName = 'Jordan Vale'
  authUserId = 'u-jordan'
})

const openRow = () => document.querySelector('[data-checklist-row="open"]') as HTMLElement
const foot = () => document.querySelector('[data-checklist-foot]')!.textContent

describe('JobStageChecklistStrip', () => {
  it('draws nothing for the crew on a job whose kinds have no questions, and nothing on a failed read', async () => {
    const io = fakeIo({}, [], [])
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={io} />)
    await waitFor(() => expect(io.answers).toHaveBeenCalled())
    expect(document.querySelector('[data-job-stage-checklists]')).toBeNull()
    cleanup()
    const broken = fakeIo({ answers: vi.fn(async () => { throw new Error('permission denied for table stage_checklist_answers') }) })
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={broken} />)
    await waitFor(() => expect(broken.answers).toHaveBeenCalled())
    expect(document.querySelector('[data-job-stage-checklists]')).toBeNull()
  })

  it('lists the stages with questions and their standing, and leaves out the kind with none', async () => {
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={fakeIo()} />)
    const row = await screen.findByRole('button', { name: 'Rough In checklist: 0 of 2 answered, not ready' })
    expect(row.getAttribute('data-stage-checklist-row')).toBe('not_ready')
    expect(screen.queryByText('Top Out')).toBeNull()
    expect(screen.queryByText('Trim Set')).toBeNull()
  })

  it('keeps one row open at a time: Next answers with one press and the list moves on, the stamp lands, a photo holds the row, Done lights once filled', async () => {
    const io = fakeIo()
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={io} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Rough In checklist: 0 of 2 answered, not ready' }))
    expect((await screen.findByText('0 of 2 answered · 2 left'))).toBeTruthy()
    expect(within(openRow()).getByText('Next')).toBeTruthy()
    expect(within(openRow()).getByText('1. Did the water test hold?')).toBeTruthy()
    // The second question is a statement row until its turn.
    expect(screen.getByRole('button', { name: 'Are the stub-outs marked?: not answered yet. Open to answer.' })).toBeTruthy()
    const done = () => screen.getByRole('button', { name: 'Done' }) as HTMLButtonElement
    expect(done().disabled).toBe(true)
    expect(foot()).toBe('2 left. Rough In reads not ready on the Pipeline until every question is answered.')

    // Yes on the photo question: the pick lands with its stamp, and the row stays Next, waiting on its photo.
    fireEvent.click(within(screen.getByRole('group', { name: 'Did the water test hold?' })).getByRole('button', { name: 'Yes' }))
    await waitFor(() => expect(io.pick).toHaveBeenCalledWith({ jobId: JOB, fixtureId: 'f1', questionId: 'q1' }, 'yes', { userId: 'u-jordan', name: 'Jordan Vale' }))
    expect(await screen.findByText('Take the photo this one asks for.')).toBeTruthy()
    expect(within(openRow()).getByText('Jordan Vale · Nov 1 · 9:14 am')).toBeTruthy()
    expect(within(openRow()).getByRole('button', { name: 'Take the photo: Did the water test hold?' })).toBeTruthy()

    // The photo through the io: the row is answered and the list moves to the second question by itself.
    await io.photo({ jobId: JOB, fixtureId: 'f1', questionId: 'q1', blob: new Blob(['x']), fileName: '2026-11-01 Rough In · Did the water test hold.jpg', takenAt: '2026-11-01T15:20:00.000Z' }, { userId: 'u', name: 'Jordan Vale' })
    cleanup()
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={io} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Rough In checklist: 1 of 2 answered, not ready' }))
    await waitFor(() => expect(within(openRow()).getByText('2. Are the stub-outs marked?')).toBeTruthy())
    // The answered row reads as a statement with its stamp and its photo mark.
    const first = screen.getByRole('button', { name: 'Did the water test hold?: Yes. Open to change.' })
    expect(first.textContent).toContain('Jordan Vale · Nov 1 · 9:14 am')
    expect(within(first).getByLabelText('photo')).toBeTruthy()

    // Not here on the second: every row answered, Done lights.
    fireEvent.click(within(screen.getByRole('group', { name: 'Are the stub-outs marked?' })).getByRole('button', { name: 'Not here' }))
    await waitFor(() => expect(foot()).toBe('All answered. Rough In reads ready on the Pipeline.'))
    expect(screen.getByText('2 of 2 answered')).toBeTruthy()
    expect(done().disabled).toBe(false)
    expect(document.querySelector('[data-checklist-row="open"]')).toBeNull()
  })

  it('reopens an answered row to change it, and saves a note from the link', async () => {
    const io = fakeIo({}, [answer({ jobId: JOB, fixtureId: 'f1', questionId: 'q2' }, { id: 'a-q2', pick: 'yes', answeredBy: 'Luis Ortega', answeredAt: '2026-11-01T15:14:00.000Z' })])
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={io} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Rough In checklist: 1 of 2 answered, not ready' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Are the stub-outs marked?: Yes. Open to change.' }))
    expect(within(openRow()).getByText('Open')).toBeTruthy()
    expect(within(openRow()).getByText('Luis Ortega · Nov 1 · 9:14 am')).toBeTruthy()
    fireEvent.click(within(openRow()).getByRole('button', { name: 'Add a note' }))
    const box = await screen.findByLabelText('Note on: Are the stub-outs marked?')
    fireEvent.change(box, { target: { value: 'Marked in orange ' } })
    fireEvent.blur(box)
    await waitFor(() => expect(io.note).toHaveBeenCalledWith({ jobId: JOB, fixtureId: 'f1', questionId: 'q2' }, 'Marked in orange', expect.anything()))
    fireEvent.click(within(openRow()).getByRole('button', { name: 'Close this one' }))
    await waitFor(() => expect(within(openRow()).getByText('1. Did the water test hold?')).toBeTruthy())
  })

  it('shows a photo taken on a field report (punch list #189, PR 6): the thumbnail from the report bucket, the words saying where it came from', async () => {
    const fromReport = answer(
      { jobId: JOB, fixtureId: 'f1', questionId: 'q1' },
      { id: 'a-r', pick: 'yes', reportPhotoId: 'rp1', photo: { fileName: '2026-10-31 Rough In · Did the water test hold.jpg', takenAt: '2026-10-31T15:00:00.000Z', state: 'waiting', driveFileId: null, failWhy: null } },
    )
    const io = fakeIo({ photoUrl: vi.fn(async () => 'blob:report-photo') }, [fromReport])
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={io} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Rough In checklist: 1 of 2 answered, not ready' }))
    // The answered row is a statement; opening it shows the photo row with its words.
    fireEvent.click(await screen.findByRole('button', { name: 'Did the water test hold?: Yes. Open to change.' }))
    expect(await screen.findByText('Taken on a field report. On its way to the customer’s Drive folder.')).toBeTruthy()
    await waitFor(() => expect(io.photoUrl).toHaveBeenCalledWith({ storagePath: null, reportPhotoId: 'rp1', jobId: JOB }))
    expect((await screen.findByRole('img', { name: '2026-10-31 Rough In · Did the water test hold.jpg' })).getAttribute('src')).toBe('blob:report-photo')
  })

  it('shows a report photo before anyone picks Yes or No (punch list #189, PR 6 live run): the open row draws it, a closed row names it', async () => {
    // A report photo answers q1 at Save; the crew has not pressed a pick yet, so q1 is open with the shot under it.
    const fromReport = answer(
      { jobId: JOB, fixtureId: 'f1', questionId: 'q1' },
      { id: 'a-r0', pick: null, reportPhotoId: 'rp1', photo: { fileName: '2026-11-08 Rough In · Did the water test hold.jpg', takenAt: '2026-11-08T21:23:00.000Z', state: 'waiting', driveFileId: null, failWhy: null } },
    )
    const io = fakeIo({ photoUrl: vi.fn(async () => 'blob:report-photo') }, [fromReport])
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={io} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Rough In checklist: 0 of 2 answered, not ready' }))
    expect(await screen.findByText('Taken on a field report. On its way to the customer’s Drive folder.')).toBeTruthy()
    expect((await screen.findByRole('img', { name: '2026-11-08 Rough In · Did the water test hold.jpg' })).getAttribute('src')).toBe('blob:report-photo')
    expect(screen.getByRole('button', { name: 'Take the photo again: Did the water test hold?' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Yes' })).toBeTruthy()
    // Open the second question: the first closes to a statement that says where its photo came from.
    fireEvent.click(screen.getByRole('button', { name: 'Are the stub-outs marked?: not answered yet. Open to answer.' }))
    const closed = await screen.findByRole('button', { name: 'Did the water test hold?: not answered yet. Open to answer.' })
    expect(closed.textContent).toContain('photo taken on a field report')
    expect(closed.textContent).not.toContain('asks for a photo')
  })

  it('groups the items added for this job with who added them, and counts them toward ready; the crew sees no add press', async () => {
    const io = fakeIo({}, [], [...Q, ITEM])
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={io} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Rough In checklist: 0 of 3 answered, not ready' }))
    expect(await screen.findByText('Added for this job')).toBeTruthy()
    expect(screen.getByText("The company's questions")).toBeTruthy()
    const item = screen.getByRole('button', { name: 'Are the carriers in units 7 and 8 set?: not answered yet. Open to answer.' })
    expect(item.textContent).toContain('3. Are the carriers in units 7 and 8 set?')
    expect(item.textContent).toContain('Added by Pat Sample · Nov 1')
    expect(screen.queryByRole('button', { name: '+ Add a check for Rough In' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Take off: Are the carriers in units 7 and 8 set?' })).toBeNull()
  })

  it('lets the superintendent add a check for this job, which lands on the sheet and the strip at once, and take their own off', async () => {
    authRole = 'superintendent'
    authName = 'Pat Sample'
    authUserId = 'u-pat'
    const io = fakeIo()
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={io} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Rough In checklist: 0 of 2 answered, not ready' }))
    expect(await screen.findByText("Nothing added for this job's Rough In.")).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '+ Add a check for Rough In' }))
    const box = await screen.findByLabelText('Add a check for Rough In on this job')
    fireEvent.click(screen.getByRole('button', { name: 'Add the check' }))
    expect(await screen.findByText('Type the check as a question the crew answers with Yes, No or Not here.')).toBeTruthy()
    fireEvent.change(box, { target: { value: 'Is the water heater pan drain run to the hub?' } })
    fireEvent.click(screen.getByLabelText('Asks for a photo'))
    fireEvent.click(screen.getByRole('button', { name: 'Add the check' }))
    await waitFor(() => expect(io.addItem).toHaveBeenCalledWith({ jobId: JOB, fixtureId: 'f1', kind: 'rough_in', order: 1, words: 'Is the water heater pan drain run to the hub?', asksPhoto: true, needsSignature: false, sheet: '', why: '' }, { userId: 'u-pat', name: 'Pat Sample' }))
    expect(await screen.findByText('Added. Rough In is now 0 of 3.')).toBeTruthy()
    expect(screen.getByText('0 of 3 answered · 3 left')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Rough In checklist: 0 of 3 answered, not ready' })).toBeTruthy()
    const item = screen.getByRole('button', { name: 'Is the water heater pan drain run to the hub?: not answered yet. Open to answer.' })
    expect(item.textContent).toContain('asks for a photo · You added this · Nov 1')

    // Open it, take it off with two presses: the count moves back.
    fireEvent.click(item)
    fireEvent.click(await screen.findByRole('button', { name: 'Take off: Is the water heater pan drain run to the hub?' }))
    fireEvent.click(screen.getByRole('button', { name: 'Take it off' }))
    await waitFor(() => expect(io.retireItem).toHaveBeenCalled())
    expect(await screen.findByText('Taken off. Rough In is now 0 of 2.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Rough In checklist: 0 of 2 answered, not ready' })).toBeTruthy()
  })

  it('lists a stage with no question yet for the superintendent, so the first check has a door; the sheet offers no Done on an empty list', async () => {
    authRole = 'superintendent'
    const io = fakeIo({}, [], [])
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={io} />)
    const row = await screen.findByRole('button', { name: 'Rough In checklist: No questions yet. Add a check for this job.' })
    expect(row.getAttribute('data-stage-checklist-row')).toBe('none')
    fireEvent.click(row)
    expect(await screen.findByRole('button', { name: '+ Add a check for Rough In' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull()
  })

  it('leaves a stage with no question off the office’s strip, whose door is the Documents tab', async () => {
    authRole = 'assistant'
    const io = fakeIo({}, [], [])
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={io} />)
    await waitFor(() => expect(io.answers).toHaveBeenCalled())
    await waitFor(() => expect(document.querySelector('[data-job-stage-checklists]')).toBeNull())
    expect(screen.queryByRole('button', { name: 'Rough In checklist: No questions yet. Add a check for this job.' })).toBeNull()
  })

  it('still offers the office the add press on a stage that has a question', async () => {
    authRole = 'assistant'
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={fakeIo()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Rough In checklist: 0 of 2 answered, not ready' }))
    expect(await screen.findByRole('button', { name: '+ Add a check for Rough In' })).toBeTruthy()
  })

  it('saves a note still in its box when a press closes the row, since a closed box never fires its blur', async () => {
    const io = fakeIo()
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={io} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Rough In checklist: 0 of 2 answered, not ready' }))
    const second = await screen.findByRole('button', { name: 'Are the stub-outs marked?: not answered yet. Open to answer.' })
    fireEvent.click(second)
    fireEvent.click(within(openRow()).getByRole('button', { name: 'Add a note' }))
    fireEvent.change(await screen.findByLabelText('Note on: Are the stub-outs marked?'), { target: { value: 'Marked in orange' } })
    // Not here closes the row with the box never left.
    fireEvent.click(within(screen.getByRole('group', { name: 'Are the stub-outs marked?' })).getByRole('button', { name: 'Not here' }))
    await waitFor(() => expect(io.pick).toHaveBeenCalledWith({ jobId: JOB, fixtureId: 'f1', questionId: 'q2' }, 'not_here', expect.anything()))
    await waitFor(() => expect(io.note).toHaveBeenCalledWith({ jobId: JOB, fixtureId: 'f1', questionId: 'q2' }, 'Marked in orange', expect.anything()))
    expect((await screen.findByRole('button', { name: 'Are the stub-outs marked?: Not here. Open to change.' })).textContent).toContain('“Marked in orange”')
  })
})
