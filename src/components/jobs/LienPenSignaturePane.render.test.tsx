// @vitest-environment jsdom
/**
 * He signed the paper with a pen (the pen train, PR 2): the pane names the leader, fills in the
 * print day, offers the three ways the office knows, ticks every notice, and refuses a day after
 * today; Record writes one pen record per ticked notice and hands them back with the toast's words.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import LienPenSignaturePane from './LienPenSignaturePane'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
const recordSpy = vi.fn(async (args: { itemId: string; signedAtIso: string; how: string }) => ({ ok: true as const, signedAtIso: args.signedAtIso, how: args.how as 'watched', pagePath: null }))
vi.mock('../../lib/jobs/lienDeskSignIo', () => ({ recordLienPenSignature: (args: { itemId: string; signedAtIso: string; how: string }) => recordSpy(args) }))

const NOTICES = [
  { itemId: '4c2e91aa-0000-4000-8000-000000000001', jobNumber: '878', label: '878 · Take 5 - Seguin', amount: 38625, fields: { a: 1 } },
  { itemId: '4c2e91aa-0000-4000-8000-000000000002', jobNumber: '258', label: '258 · Dudley Mason', amount: 9810, fields: { a: 2 } },
]

describe('LienPenSignaturePane', () => {
  it('names the leader, fills in the print day, ticks every notice, and records one pen signature per tick', async () => {
    const onRecorded = vi.fn()
    renderWithProviders(
      <LienPenSignaturePane leader={{ userId: 'u-robert', name: 'Robert Douglas' }} recorder={{ userId: 'u-taunya', name: 'Taunya' }} notices={NOTICES} printedYmd="2026-10-09" todayYmd="2026-10-12" onRecorded={onRecorded} onClose={() => {}} />,
    )
    expect(screen.getByText('Robert Douglas')).toBeTruthy()
    expect((screen.getByLabelText('When he signed') as HTMLInputElement).value).toBe('2026-10-09')
    expect(screen.getByLabelText('I watched him sign')).toBeTruthy()
    expect(screen.getByText('L878-4C2E91')).toBeTruthy()
    const btn = screen.getByTestId('lien-pen-record') as HTMLButtonElement
    expect(btn.textContent).toContain('Record 2 pen signatures')
    fireEvent.click(screen.getByLabelText('258 · Dudley Mason signed with a pen'))
    expect(btn.textContent).toContain('Record 1 pen signature ▸')
    fireEvent.click(screen.getByLabelText('He told me he signed'))
    fireEvent.click(btn)
    await waitFor(() => expect(onRecorded).toHaveBeenCalledTimes(1))
    expect(recordSpy).toHaveBeenCalledTimes(1)
    expect(recordSpy.mock.calls[0]![0]).toMatchObject({ itemId: NOTICES[0]!.itemId, how: 'told', signedAtIso: '2026-10-09T17:00:00.000Z' })
    const [recorded, words] = onRecorded.mock.calls[0]!
    expect(recorded).toEqual([{ itemId: NOTICES[0]!.itemId, signedAtIso: '2026-10-09T17:00:00.000Z', how: 'told', pagePath: null }])
    expect(words).toBe('Recorded 1 pen signature · Robert Douglas signed October 9, 2026 · written down by Taunya, who was told by him that he had signed.')
  })

  it('refuses a day after today or before the print, and nothing ticked', () => {
    renderWithProviders(
      <LienPenSignaturePane leader={{ userId: 'u-robert', name: 'Robert Douglas' }} recorder={{ userId: 'u-taunya', name: 'Taunya' }} notices={NOTICES} printedYmd="2026-10-09" todayYmd="2026-10-12" onRecorded={() => {}} onClose={() => {}} />,
    )
    const day = screen.getByLabelText('When he signed') as HTMLInputElement
    fireEvent.change(day, { target: { value: '2026-10-13' } })
    expect(screen.getByTestId('lien-pen-problems').textContent).toBe('The day he signed cannot be after today.')
    expect((screen.getByTestId('lien-pen-record') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(day, { target: { value: '2026-10-08' } })
    expect(screen.getByTestId('lien-pen-problems').textContent).toMatch(/printed 2026-10-09/)
    fireEvent.change(day, { target: { value: '2026-10-10' } })
    expect(screen.queryByTestId('lien-pen-problems')).toBeNull()
    fireEvent.click(screen.getByLabelText('878 · Take 5 - Seguin signed with a pen'))
    fireEvent.click(screen.getByLabelText('258 · Dudley Mason signed with a pen'))
    expect(screen.getByTestId('lien-pen-problems').textContent).toBe('Tick at least one notice.')
  })
})
