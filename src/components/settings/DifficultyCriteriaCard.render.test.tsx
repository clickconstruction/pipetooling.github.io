// @vitest-environment jsdom
/**
 * Punch list #357 PR 1: Settings → Difficulty criteria over a fake io. The published version is drawn read only with
 * its three scales; Start a draft copies it and the editor appears; a rung reworded is one change and the publish press
 * wakes; a bad draft lists its problems and the press stays dead; publishing saves the draft, flips it and reads back;
 * a refused save keeps the draft and says why.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DIFFICULTY_CRITERIA_V1 } from '../../lib/bids/difficultyCriteria'
import type { DifficultyCriteriaIo, DifficultyCriteriaVersion } from '../../lib/bids/difficultyCriteriaIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { DIFFICULTY_CRITERIA_WORDS as W } from '../../lib/bids/difficultyCriteriaWords'
import { DifficultyCriteriaCard } from './DifficultyCriteriaCard'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'dev' })
})

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const V1: DifficultyCriteriaVersion = {
  id: 'v1',
  version: 1,
  status: 'published',
  body: DIFFICULTY_CRITERIA_V1,
  note: 'The three scales of 2026-11-14.',
  publishedAt: '2026-11-14T20:00:00Z',
  publishedByName: 'the app',
  updatedAt: '2026-11-14T20:00:00Z',
}

function fakeIo(rows: DifficultyCriteriaVersion[] = [V1], over: Partial<DifficultyCriteriaIo> = {}): DifficultyCriteriaIo {
  let store = [...rows]
  const io: DifficultyCriteriaIo = {
    loadVersions: vi.fn(async () => store),
    saveDraft: vi.fn(async (id, body, note) => {
      const row: DifficultyCriteriaVersion = { id: id ?? 'draft-1', version: 0, status: 'draft', body, note, publishedAt: null, publishedByName: '', updatedAt: '2026-11-15T00:00:00Z' }
      store = [row, ...store.filter((r) => r.status !== 'draft')]
      return row
    }),
    publish: vi.fn(async (id) => {
      const d = store.find((r) => r.id === id)!
      const row: DifficultyCriteriaVersion = { ...d, status: 'published', version: 2, publishedAt: '2026-11-15T00:00:00Z', publishedByName: 'Micah' }
      store = [row, ...store.filter((r) => r.id !== id)]
      return row
    }),
    discardDraft: vi.fn(async (id) => {
      store = store.filter((r) => r.id !== id)
    }),
    ...over,
  }
  return io
}

const card = () => within(screen.getByTestId('difficulty-criteria-card'))
const publishPress = () => card().getByRole('button', { name: W.publish(2) }) as HTMLButtonElement

afterEach(cleanup)

describe('DifficultyCriteriaCard', () => {
  it('draws the published version read only, with its three scales and their rungs', async () => {
    renderWithProviders(<DifficultyCriteriaCard io={fakeIo()} />)
    expect(await card().findByText(/Published: Version 1 · 2026-11-14 by the app/)).toBeTruthy()
    const picker = screen.getByTestId('difficulty-scales-picker')
    expect(picker.querySelectorAll('[data-difficulty-scale]')).toHaveLength(3)
    expect(picker.querySelectorAll('[data-difficulty-rung]')).toHaveLength(9)
    expect(within(picker).getByText('Read from their bills')).toBeTruthy()
    for (const radio of picker.querySelectorAll('input[type=radio]')) expect((radio as HTMLInputElement).disabled).toBe(true)
    expect(card().getByRole('button', { name: W.startDraft })).toBeTruthy()
    expect(screen.queryByTestId('difficulty-draft-editor')).toBeNull()
  })

  it('a draft copies the published version; a reworded rung is one change and wakes the publish press', async () => {
    const io = fakeIo()
    renderWithProviders(<DifficultyCriteriaCard io={io} />)
    fireEvent.click(await card().findByRole('button', { name: W.startDraft }))
    expect(screen.getByTestId('difficulty-draft-editor')).toBeTruthy()
    expect(screen.getByTestId('difficulty-draft-chip').textContent).toBe('Draft of version 2 · no changes yet · not saved')
    expect(publishPress().disabled).toBe(true)
    // The key of a published scale is locked; its name is not.
    expect((screen.getByLabelText('Key of Field and superintendent') as HTMLInputElement).readOnly).toBe(true)

    fireEvent.change(screen.getByLabelText('Sentence of Their office rung 2'), { target: { value: 'Pay apps come back twice.' } })
    expect(screen.getByTestId('difficulty-draft-chip').textContent).toBe('Draft of version 2 · 1 change · not saved')
    expect(publishPress().disabled).toBe(false)
    expect(within(screen.getByTestId('difficulty-changes')).getByText('Their office: the 1 point rung reworded.')).toBeTruthy()

    fireEvent.click(card().getByRole('button', { name: W.preview }))
    const preview = screen.getByTestId('difficulty-preview')
    expect(within(preview).getByText(/Pay apps come back twice\./)).toBeTruthy()

    fireEvent.click(card().getByRole('button', { name: W.saveDraft }))
    await waitFor(() => expect(io.saveDraft).toHaveBeenCalledTimes(1))
    expect((io.saveDraft as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toBeNull()
    await waitFor(() => expect(screen.getByTestId('difficulty-draft-chip').textContent).toBe('Draft of version 2 · 1 change'))
  })

  it('a bad draft lists its problems and the publish press stays dead', async () => {
    renderWithProviders(<DifficultyCriteriaCard io={fakeIo()} />)
    fireEvent.click(await card().findByRole('button', { name: W.startDraft }))
    fireEvent.click(card().getByRole('button', { name: W.addScale }))
    const problems = screen.getByTestId('difficulty-problems')
    expect(within(problems).getByText('Scale 4 (scale_1): give it a name.')).toBeTruthy()
    expect(within(problems).getByText('scale 4: rung 1 (0 points) has no sentence.')).toBeTruthy()
    expect(publishPress().disabled).toBe(true)
    fireEvent.click(card().getByRole('button', { name: 'Remove the scale scale_1' }))
    expect(screen.queryByTestId('difficulty-problems')).toBeNull()
  })

  it('publishing saves the draft, flips it after the confirm, and reads version 2 back', async () => {
    const io = fakeIo()
    renderWithProviders(<DifficultyCriteriaCard io={io} />)
    fireEvent.click(await card().findByRole('button', { name: W.startDraft }))
    fireEvent.change(screen.getByLabelText('Sentence of Their office rung 2'), { target: { value: 'Pay apps come back twice.' } })
    fireEvent.click(publishPress())
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText(W.publishTitle(2))).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: W.publish(2) }))
    await waitFor(() => expect(io.publish).toHaveBeenCalledWith('draft-1'))
    expect(await card().findByText(/Published: Version 2 · 2026-11-15 by Micah/)).toBeTruthy()
    expect(screen.queryByTestId('difficulty-draft-editor')).toBeNull()
    expect(await screen.findByText(W.published(2))).toBeTruthy()
  })

  it('a refused save keeps the draft and says why', async () => {
    const io = fakeIo([V1], { saveDraft: vi.fn(async () => { throw new Error('Only a dev may change the criteria.') }) })
    renderWithProviders(<DifficultyCriteriaCard io={io} />)
    fireEvent.click(await card().findByRole('button', { name: W.startDraft }))
    fireEvent.change(screen.getByLabelText('Sentence of Their office rung 2'), { target: { value: 'Changed.' } })
    fireEvent.click(card().getByRole('button', { name: W.saveDraft }))
    expect(await screen.findByText('Only a dev may change the criteria.')).toBeTruthy()
    expect((screen.getByLabelText('Sentence of Their office rung 2') as HTMLInputElement).value).toBe('Changed.')
  })

  it('a failed read says so and offers to try again', async () => {
    const io = fakeIo([V1], { loadVersions: vi.fn(async () => { throw new Error('The database is away.') }) })
    renderWithProviders(<DifficultyCriteriaCard io={io} />)
    expect((await screen.findByRole('alert')).textContent).toContain('The database is away.')
    expect(card().getByRole('button', { name: 'Try again' })).toBeTruthy()
  })
})
