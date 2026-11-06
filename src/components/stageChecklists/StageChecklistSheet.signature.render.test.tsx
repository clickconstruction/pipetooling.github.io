// @vitest-environment jsdom
/**
 * Needs a signature on the phone sheet, over a fake io (punch list #237, PR 2): the toggle on the add box, the
 * signature sheet a pick opens on a check that needs one (its gravity words, the agreed line, the press that writes
 * the pick and the signature in one go), the locked row after with its mark and *Take it back*, and the *Taken back*
 * line the void leaves. Made-up questions and a made-up job.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { checklistAnswerHash, type JobStageRef, type StageChecklistQuestion } from '../../lib/jobs/stageChecklist'
import type { JobAnswer, StageChecklistSheetIo } from '../../lib/jobs/stageChecklistSheetIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { JobStageChecklistStrip } from './JobStageChecklistStrip'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('signature_pad', () => ({ default: class { off() {} clear() {} isEmpty() { return true } toDataURL() { return '' } } }))
vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue, useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  const value = () => makeUseAuthValue({ role: 'superintendent', profileName: 'Pat Sample', user: { id: 'u-pat', email: 'smoke@example.com' } })
  return { ...useAuthModuleMock(), useAuth: value, useOptionalAuth: value }
})

const JOB = 'job-zz-1'
const WHO = { userId: 'u-pat', name: 'Pat Sample' }
const STAGES: JobStageRef[] = [{ fixtureId: 'f3', name: 'Trim Set', sequenceOrder: 3 }]
const Q: StageChecklistQuestion[] = [
  { id: 't1', kind: 'trim_set', order: 1, words: 'Did the final water test hold?', asksPhoto: false, needsSignature: true },
  { id: 't2', kind: 'trim_set', order: 2, words: 'Are the cleanouts capped?', asksPhoto: false },
]
const answer = (over: Partial<JobAnswer> = {}): JobAnswer => ({ id: 'a-t1', fixtureId: 'f3', questionId: 't1', pick: null, note: '', photo: null, answeredBy: '', answeredAt: null, storagePath: null, reportPhotoId: null, signature: null, voided: null, ...over })
const SIGNED = answer({ pick: 'yes', answeredBy: 'Luis Ortega', answeredAt: '2026-11-01T15:14:00.000Z', signature: { mode: 'type', printedName: 'Luis Ortega', storagePath: null, signedAt: '2026-11-01T15:14:00.000Z', signedById: 'u-luis', hash: checklistAnswerHash({ questionWords: Q[0]!.words, pick: 'yes', note: '' }) } })

function fakeIo(over: Partial<StageChecklistSheetIo> = {}, answers: JobAnswer[] = []): StageChecklistSheetIo {
  return {
    stages: vi.fn(async () => STAGES),
    questions: vi.fn(async () => [...Q]),
    answers: vi.fn(async () => [...answers]),
    pick: vi.fn(async () => { throw new Error('not here') }),
    note: vi.fn(async () => { throw new Error('not here') }),
    photo: vi.fn(async () => { throw new Error('not here') }),
    photoUrl: vi.fn(async () => null),
    sign: vi.fn(async (input, who) => answer({ pick: input.pick, note: input.note, answeredBy: who.name, answeredAt: input.signedAt ?? '2026-11-05T16:00:00.000Z', signature: { mode: input.mode, printedName: input.printedName, storagePath: null, signedAt: input.signedAt ?? '2026-11-05T16:00:00.000Z', signedById: who.userId, hash: checklistAnswerHash({ questionWords: input.questionWords, pick: input.pick, note: input.note }) } })),
    takeBack: vi.fn(async (id, why, who) => ({ ...SIGNED, id, voided: { at: '2026-11-05T16:20:00.000Z', by: who.name, byId: who.userId, why } })),
    inkUrl: vi.fn(async () => null),
    addItem: vi.fn(async (input, who) => ({ id: 'j-new', kind: input.kind, order: input.order ?? 0, words: input.words, asksPhoto: input.asksPhoto, needsSignature: input.needsSignature === true, fixtureId: input.fixtureId, addedById: who.userId, addedBy: who.name, addedAt: '2026-11-05T16:00:00.000Z' })),
    retireItem: vi.fn(async () => undefined),
    mayAuthor: vi.fn(async () => true),
    skip: vi.fn(async () => { throw new Error('not here') }),
    putBack: vi.fn(async () => undefined),
    reorder: vi.fn(async () => undefined),
    promote: vi.fn(async () => { throw new Error('not here') }),
    ...over,
  }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const openRow = () => document.querySelector('[data-checklist-row="open"]') as HTMLElement
const signSheet = () => document.querySelector('[data-checklist-signature-sheet]') as HTMLElement | null
const openSheet = async (name: string) => fireEvent.click(await screen.findByRole('button', { name }))

describe('the toggle on the add box', () => {
  it('sends needs a signature with the check, with its rule under the tick', async () => {
    const io = fakeIo()
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={io} />)
    await openSheet('Trim Set checklist: 0 of 2 answered, not ready')
    fireEvent.click(await screen.findByRole('button', { name: '+ Add a check for Trim Set' }))
    fireEvent.change(await screen.findByLabelText('Add a check for Trim Set on this job'), { target: { value: 'Is the pan drain run to the hub?' } })
    expect(screen.queryByText(/Use it where a wrong answer costs a wall or an inspection/)).toBeNull()
    fireEvent.click(screen.getByLabelText('Needs a signature'))
    expect(screen.getByText(/Use it where a wrong answer costs a wall or an inspection/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Add the check' }))
    await waitFor(() => expect(io.addItem).toHaveBeenCalledWith({ jobId: JOB, fixtureId: 'f3', kind: 'trim_set', order: 1, words: 'Is the pan drain run to the hub?', asksPhoto: false, needsSignature: true, sheet: '', why: '' }, WHO))
    await waitFor(() => expect((screen.getByLabelText('Needs a signature') as HTMLInputElement).checked).toBe(false))
    // The new check wears the chip on its statement row.
    expect(screen.getByRole('button', { name: 'Is the pan drain run to the hub?: not answered yet. Open to answer.' }).textContent).toContain('needs a signature')
  })
})

describe('signing an answer', () => {
  it('a pick on a check that needs a signature opens the sheet; Sign and save writes the pick with the mark and the row reads signed', async () => {
    const io = fakeIo()
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={io} />)
    await openSheet('Trim Set checklist: 0 of 2 answered, not ready')
    const row = await waitFor(() => openRow())
    expect(row.textContent).toContain('signature')
    fireEvent.click(within(row).getByRole('button', { name: 'Yes' }))
    expect(io.pick).not.toHaveBeenCalled()
    const sheet = await waitFor(() => signSheet()!)
    expect(within(sheet).getByText(/You are signing/).textContent).toBe("You are signing Yes to “Did the final water test hold?”. It goes on this job's Trim Set record with your name and the time. The office, the GC and an inspector can read it.")
    expect(within(sheet).getByText('I did this check myself and the answer is true.')).toBeTruthy()
    expect((within(sheet).getByRole('textbox', { name: 'Your name, as it prints under the mark' }) as HTMLInputElement).value).toBe('Pat Sample')

    // Without the agreed line the press stops with its reason and writes nothing.
    fireEvent.click(screen.getByRole('button', { name: 'Sign and save' }))
    expect(await within(sheet).findByRole('alert')).toHaveProperty('textContent', 'Tick the line to sign.')
    expect(io.sign).not.toHaveBeenCalled()

    fireEvent.click(within(sheet).getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Sign and save' }))
    await waitFor(() => expect(io.sign).toHaveBeenCalledTimes(1))
    const [input, who] = (io.sign as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect(input).toMatchObject({ jobId: JOB, fixtureId: 'f3', questionId: 't1', questionWords: 'Did the final water test hold?', pick: 'yes', note: '', printedName: 'Pat Sample', mode: 'type', pngDataUrl: null })
    expect(typeof input.signedAt).toBe('string')
    expect(who).toEqual({ userId: 'u-pat', name: 'Pat Sample' })

    expect(await screen.findByText('Signed and saved. Trim Set is now 1 of 2.')).toBeTruthy()
    await waitFor(() => expect(signSheet()).toBeNull())
    // The signed row is a statement with its stamp, *signed*, and the mark; the list moved on to the next question.
    const signed = screen.getByRole('button', { name: 'Did the final water test hold?: Yes. Open to change.' })
    expect(signed.textContent).toContain('· signed')
    expect(within(signed).getByLabelText('Signed by Pat Sample')).toBeTruthy()
    expect(openRow().textContent).toContain('Are the cleanouts capped?')
  })

  it('a signed No asks for the note before it signs', async () => {
    const io = fakeIo()
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={io} />)
    await openSheet('Trim Set checklist: 0 of 2 answered, not ready')
    fireEvent.click(within(await waitFor(() => openRow())).getByRole('button', { name: 'No' }))
    const sheet = await waitFor(() => signSheet()!)
    fireEvent.click(within(sheet).getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Sign and save' }))
    expect(await within(sheet).findByRole('alert')).toHaveProperty('textContent', 'A signed No says why. Type the note.')
    fireEvent.change(within(sheet).getByLabelText('Why it is No'), { target: { value: 'The 2nd floor stack leaks' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign and save' }))
    await waitFor(() => expect(io.sign).toHaveBeenCalledWith(expect.objectContaining({ pick: 'no', note: 'The 2nd floor stack leaks' }), WHO))
  })

  it('a refusal comes back to the sheet with its reason, and the sheet stays open', async () => {
    const io = fakeIo({ sign: vi.fn(async () => { throw { message: 'A checklist answer is signed by the person who answered it, under their own sign-in.', code: '42501' } }) })
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={io} />)
    await openSheet('Trim Set checklist: 0 of 2 answered, not ready')
    fireEvent.click(within(await waitFor(() => openRow())).getByRole('button', { name: 'Not here' }))
    const sheet = await waitFor(() => signSheet()!)
    expect(within(sheet).getByText(/You are signing/).textContent).toContain('You are signing Not here to')
    fireEvent.click(within(sheet).getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Sign and save' }))
    const alert = await within(sheet).findByRole('alert')
    expect(alert.textContent?.length).toBeGreaterThan(10)
    expect(io.sign).toHaveBeenCalledTimes(1)
    expect(signSheet()).toBeTruthy()
  })
})

describe('the locked row and Take it back', () => {
  it('a signed row opens with no presses, its mark and stamp, and Take it back voids it with a reason; the voided line stays', async () => {
    const io = fakeIo({}, [SIGNED])
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={io} />)
    await openSheet('Trim Set checklist: 1 of 2 answered, not ready')
    fireEvent.click(await screen.findByRole('button', { name: 'Did the final water test hold?: Yes. Open to change.' }))
    const locked = await waitFor(() => document.querySelector('[data-checklist-locked="t1"]') as HTMLElement)
    expect(within(locked).queryByRole('button', { name: 'Yes' })).toBeNull()
    expect(locked.querySelector('[data-checklist-locked-pick]')!.getAttribute('data-checklist-locked-pick')).toBe('yes')
    expect(within(locked).getByText('Signed by Luis Ortega · Nov 1 · 9:14 am')).toBeTruthy()
    expect(within(locked).getByLabelText('Signed by Luis Ortega')).toBeTruthy()
    expect(within(locked).getByText(/A signed answer is locked\./)).toBeTruthy()

    fireEvent.click(within(locked).getByRole('button', { name: 'Take it back: Did the final water test hold?' }))
    fireEvent.click(within(locked).getByRole('button', { name: 'Take it back' }))
    expect(await within(locked).findByText('Say why the answer is taken back.')).toBeTruthy()
    expect(io.takeBack).not.toHaveBeenCalled()
    fireEvent.change(within(locked).getByLabelText('Why the answer is taken back'), { target: { value: 'wrong unit' } })
    fireEvent.click(within(locked).getByRole('button', { name: 'Take it back' }))
    await waitFor(() => expect(io.takeBack).toHaveBeenCalledWith('a-t1', 'wrong unit', WHO))
    expect(await screen.findByText('Taken back. Trim Set is now 0 of 2.')).toBeTruthy()

    // The question waits on its pick again, as the next row, and the voided answer reads under it with its mark kept.
    const row = await waitFor(() => openRow())
    expect(row.textContent).toContain('Did the final water test hold?')
    expect(within(row).getByRole('button', { name: 'Yes' })).toBeTruthy()
    const voided = document.querySelector('[data-checklist-voided="a-t1"]') as HTMLElement
    expect(voided.textContent).toContain('Taken back · Was Yes, signed by Luis Ortega · Nov 1 · 9:14 am. Taken back by Pat Sample · Nov 5 · 10:20 am · “wrong unit”.')
    expect(within(voided).getByLabelText('Signed by Luis Ortega')).toBeTruthy()
    expect(screen.getByText('0 of 2 answered · 2 left')).toBeTruthy()
  })
})
