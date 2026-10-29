// @vitest-environment jsdom
/**
 * Settings → Jobs & billing → Stage checklists over a fake io (punch list #164, PR 2). The office reads the three kinds,
 * each empty with its press, types a question for Rough In, ticks the photo and saves it as the plan says; an empty
 * question stops the save with its words; a refused save keeps its words; Put them back undoes the typing. Made-up
 * questions only: the owner writes the real ones.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StageChecklistQuestion } from '../../lib/jobs/stageChecklist'
import { SAVED_TOAST } from '../../lib/jobs/stageChecklistEditor'
import type { StageChecklistEditorIo } from '../../lib/jobs/stageChecklistIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { StageChecklistSettingsCard } from './StageChecklistSettingsCard'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue, useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  const value = () => makeUseAuthValue({ role: 'master_technician' })
  return { ...useAuthModuleMock(), useAuth: value, useOptionalAuth: value }
})

const LIVE: StageChecklistQuestion[] = [{ id: 'q1', kind: 'rough_in', order: 1, words: 'Did the water test hold?', asksPhoto: true }]

function fakeIo(questions: StageChecklistQuestion[] = [], over: Partial<StageChecklistEditorIo> = {}): StageChecklistEditorIo {
  return { load: vi.fn(async () => questions), save: vi.fn(async () => undefined), ...over }
}
const kindBox = (k: string) => document.querySelector<HTMLElement>(`[data-settings-stage-kind="${k}"]`)!

afterEach(() => {
  cleanup()
})

describe('StageChecklistSettingsCard', () => {
  it('lists the three kinds empty, each with the press that adds the first question', async () => {
    renderWithProviders(<StageChecklistSettingsCard io={fakeIo()} />)
    await waitFor(() => expect(kindBox('rough_in')).toBeTruthy())
    expect(kindBox('top_out').textContent).toContain('No questions for Top Out yet.')
    expect(kindBox('trim_set').textContent).toContain('adds the first.')
    expect(screen.getAllByRole('button', { name: 'Add a question' })).toHaveLength(3)
    expect((screen.getByRole('button', { name: 'Save the questions' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('types a question with a photo for Rough In and saves it as the plan says', async () => {
    const io = fakeIo()
    renderWithProviders(<StageChecklistSettingsCard io={io} />)
    await waitFor(() => expect(kindBox('rough_in')).toBeTruthy())
    fireEvent.click(screen.getAllByRole('button', { name: 'Add a question' })[0]!)
    fireEvent.change(screen.getByLabelText('Rough In: question 1'), { target: { value: '  Did the water test hold? ' } })
    fireEvent.click(screen.getByLabelText('Rough In: question 1 asks for a photo'))
    expect(kindBox('rough_in').textContent).toContain('1 question, 1 with a photo')
    fireEvent.click(screen.getByRole('button', { name: 'Save the questions' }))
    expect(await screen.findByText(SAVED_TOAST)).toBeTruthy()
    expect(io.save).toHaveBeenCalledTimes(1)
    expect(io.save).toHaveBeenCalledWith('rough_in', [], [{ id: null, words: 'Did the water test hold?', asksPhoto: true }], expect.any(String))
  })

  it('stops on an empty question with its words, and saves nothing', async () => {
    const io = fakeIo(LIVE)
    renderWithProviders(<StageChecklistSettingsCard io={io} />)
    await waitFor(() => expect((screen.getByLabelText('Rough In: question 1') as HTMLInputElement).value).toBe('Did the water test hold?'))
    fireEvent.click(screen.getAllByRole('button', { name: 'Add a question' })[0]!)
    fireEvent.click(screen.getByRole('button', { name: 'Save the questions' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Question 2 for Rough In has no words. Type the question or take it off.'))
    expect(io.save).not.toHaveBeenCalled()
  })

  it('keeps a refused save’s words, and Put them back undoes the typing', async () => {
    const io = fakeIo(LIVE, { save: vi.fn(async () => { throw new Error('new row violates row-level security policy') }) })
    renderWithProviders(<StageChecklistSettingsCard io={io} />)
    await waitFor(() => expect((screen.getByLabelText('Rough In: question 1') as HTMLInputElement).value).toBe('Did the water test hold?'))
    fireEvent.change(screen.getByLabelText('Rough In: question 1'), { target: { value: 'Did the water test hold for 20 minutes?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the questions' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('The questions were not saved.'))
    fireEvent.click(screen.getByRole('button', { name: 'Put them back' }))
    expect((screen.getByLabelText('Rough In: question 1') as HTMLInputElement).value).toBe('Did the water test hold?')
    expect((screen.getByRole('button', { name: 'Save the questions' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('takes a question off and moves one up', async () => {
    const io = fakeIo([...LIVE, { id: 'q2', kind: 'rough_in', order: 2, words: 'Are the stub-outs marked?', asksPhoto: false }])
    renderWithProviders(<StageChecklistSettingsCard io={io} />)
    await waitFor(() => expect((screen.getByLabelText('Rough In: question 2') as HTMLInputElement).value).toBe('Are the stub-outs marked?'))
    fireEvent.click(screen.getByLabelText('Rough In: move question 2 up'))
    expect((screen.getByLabelText('Rough In: question 1') as HTMLInputElement).value).toBe('Are the stub-outs marked?')
    fireEvent.click(screen.getByLabelText('Rough In: take question 2 off'))
    expect(screen.queryByLabelText('Rough In: question 2')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Save the questions' }))
    await waitFor(() => expect(io.save).toHaveBeenCalledWith('rough_in', expect.anything(), [{ id: 'q2', words: 'Are the stub-outs marked?', asksPhoto: false }], expect.any(String)))
  })
})
