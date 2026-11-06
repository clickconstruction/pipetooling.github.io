// @vitest-environment jsdom
/**
 * Needs a signature on the Documents read-out, over a fake io (punch list #237, PR 2): the *needs a signature* tag on
 * an open row, *signed* with the mark on a signed one, *Yes, not signed yet* on a pick without its signature, the
 * *Taken back* line under a question whose answer was voided, and the toggle on the office's add box. Made-up
 * questions and a made-up job.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { checklistAnswerHash, type JobStageRef, type StageChecklistQuestion } from '../../lib/jobs/stageChecklist'
import type { JobAnswer, StageChecklistSheetIo } from '../../lib/jobs/stageChecklistSheetIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { JobDocumentsChecklists } from './JobDocumentsChecklists'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('signature_pad', () => ({ default: class { off() {} clear() {} isEmpty() { return true } toDataURL() { return '' } } }))
vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue, useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  const value = () => makeUseAuthValue({ role: 'assistant', profileName: 'Jo Sample', user: { id: 'u-jo', email: 'smoke@example.com' } })
  return { ...useAuthModuleMock(), useAuth: value, useOptionalAuth: value }
})

const JOB = { id: 'job-zz-1' }
const STAGES: JobStageRef[] = [{ fixtureId: 'f3', name: 'Trim Set', sequenceOrder: 3 }]
const Q: StageChecklistQuestion[] = [
  { id: 't1', kind: 'trim_set', order: 1, words: 'Did the final water test hold?', asksPhoto: false, needsSignature: true },
  { id: 't2', kind: 'trim_set', order: 2, words: 'Are the cleanouts capped?', asksPhoto: false, needsSignature: true },
  { id: 't3', kind: 'trim_set', order: 3, words: 'Do all the fixtures run?', asksPhoto: false, needsSignature: true },
]
const answer = (id: string, questionId: string, over: Partial<JobAnswer> = {}): JobAnswer => ({ id, fixtureId: 'f3', questionId, pick: null, note: '', photo: null, answeredBy: '', answeredAt: null, storagePath: null, reportPhotoId: null, signature: null, voided: null, ...over })
const sig = (questionId: string, pick: 'yes' | 'no' | 'not_here', storagePath: string | null = null) => ({ mode: storagePath ? ('draw' as const) : ('type' as const), printedName: 'Luis Ortega', storagePath, signedAt: '2026-11-01T15:14:00.000Z', signedById: 'u-luis', hash: checklistAnswerHash({ questionWords: Q.find((q) => q.id === questionId)!.words, pick, note: '' }) })
const ANSWERS: JobAnswer[] = [
  answer('a1', 't1', { pick: 'yes', answeredBy: 'Luis Ortega', answeredAt: '2026-11-01T15:14:00.000Z', signature: sig('t1', 'yes', 'job-zz-1/sig/a1-1.png') }),
  // A pick without its signature: a row written before the signature ask, or one whose signature fell.
  answer('a2', 't2', { pick: 'no', note: 'Roofer not here until Mon', answeredBy: 'Luis Ortega', answeredAt: '2026-11-01T15:20:00.000Z' }),
  // An answer taken back, and no live row yet.
  answer('a3', 't3', { pick: 'not_here', answeredBy: 'Luis Ortega', answeredAt: '2026-11-01T15:30:00.000Z', signature: sig('t3', 'not_here'), voided: { at: '2026-11-05T16:20:00.000Z', by: 'Pat Sample', byId: 'u-pat', why: 'the fixtures are there' } }),
]

function fakeIo(over: Partial<StageChecklistSheetIo> = {}): StageChecklistSheetIo {
  return {
    stages: vi.fn(async () => STAGES),
    questions: vi.fn(async () => [...Q]),
    answers: vi.fn(async () => [...ANSWERS]),
    pick: vi.fn(async () => { throw new Error('not here') }),
    note: vi.fn(async () => { throw new Error('not here') }),
    photo: vi.fn(async () => { throw new Error('not here') }),
    photoUrl: vi.fn(async () => null),
    sign: vi.fn(async () => { throw new Error('not here') }),
    takeBack: vi.fn(async () => { throw new Error('not here') }),
    inkUrl: vi.fn(async (path) => (path ? `blob:${path}` : null)),
    records: vi.fn(async () => []),
    amend: vi.fn(async () => { throw new Error('not here') }),
    addItem: vi.fn(async (input, who) => ({ id: 'j-new', kind: input.kind, order: input.order ?? 0, words: input.words, asksPhoto: input.asksPhoto, needsSignature: input.needsSignature === true, fixtureId: input.fixtureId, addedById: who.userId, addedBy: who.name, addedAt: '2026-11-05T16:00:00.000Z' })),
    retireItem: vi.fn(async () => undefined),
    mayAuthor: vi.fn(async () => false),
    skip: vi.fn(async () => { throw new Error('not here') }),
    putBack: vi.fn(async () => undefined),
    reorder: vi.fn(async () => undefined),
    promote: vi.fn(async () => { throw new Error('not here') }),
    ...over,
  }
}

afterEach(() => {
  cleanup()
})

describe('JobDocumentsChecklists with signatures', () => {
  it('tags the rows, draws the mark, and reads the taken-back line with the voided mark kept', async () => {
    const io = fakeIo()
    renderWithProviders(<JobDocumentsChecklists job={JOB} io={io} />)
    expect(await screen.findByTestId('job-documents-checklists-summary')).toHaveProperty('textContent', '0 of 1 stage ready · nothing added on this job')
    const [trim] = screen.getAllByTestId('job-documents-checklist-stage')
    expect(within(trim!).getByText('Not ready · 1 of 3')).toBeTruthy()
    const rows = within(trim!).getAllByTestId('job-documents-checklist-row')
    expect(rows.map((r) => r.getAttribute('data-pick'))).toEqual(['yes', 'no', 'open'])

    // Signed: the green tag and the drawn mark, read through the io.
    expect(rows[0]!.querySelector('[data-checklist-signature-tag]')!.getAttribute('data-checklist-signature-tag')).toBe('signed')
    expect(rows[0]!.textContent).toContain('Yes · Luis Ortega · Nov 1 · 9:14 am')
    await waitFor(() => expect(io.inkUrl).toHaveBeenCalledWith('job-zz-1/sig/a1-1.png'))
    expect(await within(rows[0]!).findByRole('img', { name: 'Signed by Luis Ortega' })).toBeTruthy()

    // A pick without its signature still waits, and says so.
    expect(rows[1]!.querySelector('[data-checklist-signature-tag]')!.getAttribute('data-checklist-signature-tag')).toBe('needs')
    expect(rows[1]!.textContent).toContain('No, not signed yet · Luis Ortega · Nov 1 · 9:20 am · “Roofer not here until Mon”')

    // Taken back: the question is open again, and the voided answer reads under it with its typed mark.
    expect(rows[2]!.textContent).toContain('open · 3. Do all the fixtures run?')
    expect(rows[2]!.textContent).toContain('needs a signature')
    const voided = rows[2]!.querySelector('[data-checklist-voided="a3"]') as HTMLElement
    expect(voided.textContent).toContain('Taken back · Was Not here, signed by Luis Ortega · Nov 1 · 9:14 am. Taken back by Pat Sample · Nov 5 · 10:20 am · “the fixtures are there”.')
    expect(within(voided).getByLabelText('Signed by Luis Ortega')).toBeTruthy()
  })

  it('the office’s add box carries the Needs a signature toggle and sends it with the check', async () => {
    const io = fakeIo()
    renderWithProviders(<JobDocumentsChecklists job={JOB} io={io} />)
    await screen.findByTestId('job-documents-checklists-summary')
    fireEvent.click(screen.getByRole('button', { name: '+ Add a check for Trim Set' }))
    fireEvent.change(await screen.findByLabelText('Add a check for Trim Set on this job'), { target: { value: 'Is the pan drain run to the hub?' } })
    fireEvent.click(screen.getByLabelText('Needs a signature'))
    fireEvent.click(screen.getByRole('button', { name: 'Add the check' }))
    await waitFor(() => expect(io.addItem).toHaveBeenCalledWith(expect.objectContaining({ words: 'Is the pan drain run to the hub?', needsSignature: true }), { userId: 'u-jo', name: 'Jo Sample' }))
    expect(await screen.findByText('Added. Trim Set is now 1 of 4.')).toBeTruthy()
  })
})
