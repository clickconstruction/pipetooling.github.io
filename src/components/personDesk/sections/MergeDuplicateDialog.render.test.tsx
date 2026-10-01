// @vitest-environment jsdom
/**
 * Merge a duplicate… (PR D1): the person whose desk it is is always kept. The list offers only
 * accounts the rules allow, says why the rest are left out, hides samples and twins, and runs a
 * preview before the merge.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { MergeDuplicateDialog } from './MergeDuplicateDialog'
import { renderWithProviders } from '../../../test/renderSmokeMocks'

const USERS = [
  { id: 'u-keep', name: 'Kai Moss', email: 'kai@x.com', role: 'helpers', archived_at: null, last_sign_in_at: '2026-09-30T12:00:00Z' },
  { id: 'u-old', name: 'Kai M', email: 'kai.old@x.com', role: 'helpers', archived_at: '2026-08-01T00:00:00Z', last_sign_in_at: '2026-07-01T00:00:00Z' },
  { id: 'u-live', name: 'Kyle', email: 'kyle@x.com', role: 'helpers', archived_at: null, last_sign_in_at: '2026-09-30T12:00:00Z' },
  { id: 'u-sample', name: 'Sample helper', email: 'sample@x.com', role: 'helpers', archived_at: null, last_sign_in_at: null, is_sample: true },
]
const invoke = vi.fn(async (_name: string, o: { body: { dry_run: boolean } }) => ({ data: o.body.dry_run ? { success: true, moved: { clock_sessions: 4 }, warnings: [] } : { success: true }, error: null }))

vi.mock('../../../lib/supabase', () => {
  function builder(table: string): Record<string, unknown> {
    const b: Record<string, unknown> = {}
    for (const op of ['select', 'eq', 'is', 'order', 'limit']) b[op] = () => b
    b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: table === 'users' ? USERS : [], error: null }).then(ok)
    return b
  }
  return { supabase: { from: (t: string) => builder(t), functions: { invoke: (...a: unknown[]) => invoke(...(a as [string, { body: { dry_run: boolean } }])) } } }
})

describe('MergeDuplicateDialog', () => {
  it('offers the archived duplicate, explains the live one, hides the sample, then previews and merges', async () => {
    const onMerged = vi.fn()
    renderWithProviders(<MergeDuplicateDialog survivor={USERS[0]!} onClose={() => {}} onMerged={onMerged} />)
    const dialog = screen.getByRole('dialog', { name: 'Merge a duplicate into Kai Moss' })
    const select = (await within(dialog).findByLabelText('The duplicate')) as HTMLSelectElement
    const options = [...select.options].map((o) => o.textContent)
    expect(options).toContain('Kai M (kai.old@x.com) · archived')
    expect(options.some((o) => o?.startsWith('Kyle'))).toBe(false)
    expect(options.some((o) => o?.startsWith('Sample'))).toBe(false)
    expect(within(dialog).getByText(/must be archived, or never signed into/)).toBeTruthy()

    fireEvent.change(select, { target: { value: 'u-old' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Preview merge' }))
    expect(await within(dialog).findByText('clock sessions: 4')).toBeTruthy()
    expect(invoke).toHaveBeenCalledWith('merge-users', { body: { survivor_user_id: 'u-keep', absorbed_user_id: 'u-old', dry_run: true } })

    fireEvent.click(within(dialog).getByRole('button', { name: 'Merge into Kai Moss' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Merge now' }))
    await vi.waitFor(() => expect(onMerged).toHaveBeenCalled())
    expect(invoke).toHaveBeenCalledWith('merge-users', { body: { survivor_user_id: 'u-keep', absorbed_user_id: 'u-old', dry_run: false } })
  })
})
