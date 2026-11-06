// @vitest-environment jsdom
/**
 * Settings → Jobs & billing → Stage checklists over a fake io, read-only since punch list #237 PR 4: the three kinds,
 * each question with its asks and the job it came from or who wrote it, the questions taken off the company's list
 * folded under a count, an empty kind pointing at the Documents tab, and nothing to press. Made-up questions only: the
 * owner writes the real ones.
 */
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CompanyMirror } from '../../lib/jobs/stageChecklistEditor'
import type { StageChecklistMirrorIo } from '../../lib/jobs/stageChecklistIo'
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

const MIRROR: CompanyMirror = {
  questions: [
    { id: 'q1', kind: 'rough_in', order: 1, words: 'Did the water test hold?', asksPhoto: true },
    { id: 'q2', kind: 'rough_in', order: 2, words: 'Are the carriers set?', asksPhoto: false, needsSignature: true },
  ],
  sources: new Map([
    ['q1', { jobLabel: null, by: 'Jo Sample', at: '2026-11-03T16:14:00.000Z' }],
    ['q2', { jobLabel: 'Job 1042 · Riders Walk', by: 'Pat Sample', at: '2026-11-04T16:14:00.000Z' }],
  ]),
  takenOff: [{ id: 'q0', kind: 'rough_in', words: 'Is the cleanout capped?', by: 'Jo Sample', at: '2026-11-05T17:20:00.000Z', why: 'the inspector no longer asks' }],
}

function fakeIo(mirror: CompanyMirror = MIRROR, over: Partial<StageChecklistMirrorIo> = {}): StageChecklistMirrorIo {
  return { load: vi.fn(async () => mirror), ...over }
}
const kindBox = (k: string) => document.querySelector<HTMLElement>(`[data-settings-stage-kind="${k}"]`)!

afterEach(() => {
  cleanup()
})

describe('StageChecklistSettingsCard (the mirror)', () => {
  it('reads each kind’s questions with their asks and where each came from, and has nothing to press', async () => {
    renderWithProviders(<StageChecklistSettingsCard io={fakeIo()} />)
    await waitFor(() => expect(kindBox('rough_in')).toBeTruthy())
    const rough = kindBox('rough_in')
    expect(rough.textContent).toContain('2 questions, 1 with a photo, 1 with a signature')
    const rows = within(rough).getAllByText(/Did the water test hold\?|Are the carriers set\?/)
    expect(rows).toHaveLength(2)
    expect(rough.textContent).toContain('Written by Jo Sample · Nov 3 · 10:14 am')
    expect(rough.textContent).toContain('From Job 1042 · Riders Walk, where Pat Sample added it · Nov 4 · 10:14 am')
    expect(rough.textContent).toContain('asks for a photo')
    expect(rough.textContent).toContain('needs a signature')
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('button', { name: /Save|Add a question|Take off/ })).toBeNull()
  })

  it('folds the questions taken off the company’s list under a count, with who, when and why', async () => {
    renderWithProviders(<StageChecklistSettingsCard io={fakeIo()} />)
    await waitFor(() => expect(kindBox('rough_in')).toBeTruthy())
    const fold = kindBox('rough_in').querySelector('[data-settings-stage-taken-off]')!
    expect(fold.querySelector('summary')!.textContent).toBe('Taken off · 1')
    expect(fold.textContent).toContain('Is the cleanout capped? · Taken off by Jo Sample · Nov 5 · 11:20 am · “the inspector no longer asks”')
    expect(kindBox('trim_set').querySelector('[data-settings-stage-taken-off]')).toBeNull()
  })

  it('points an empty kind at the Documents tab', async () => {
    renderWithProviders(<StageChecklistSettingsCard io={fakeIo()} />)
    await waitFor(() => expect(kindBox('top_out')).toBeTruthy())
    expect(kindBox('top_out').textContent).toContain('No questions for Top Out yet.')
    expect(within(kindBox('top_out')).getByRole('link', { name: 'Jobs' }).getAttribute('href')).toBe('/jobs')
    expect(kindBox('top_out').textContent).toContain('add a check with the company picked')
  })

  it('reads a failed read with its reason', async () => {
    renderWithProviders(<StageChecklistSettingsCard io={fakeIo(MIRROR, { load: vi.fn(async () => { throw { message: 'permission denied for table stage_checklist_templates', code: '42501' } }) })} />)
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain("You don't have access"))
  })
})
