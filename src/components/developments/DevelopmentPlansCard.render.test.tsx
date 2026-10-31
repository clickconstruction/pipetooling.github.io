// @vitest-environment jsdom
/**
 * The Plans card's memo line (v2.6207): the memo reads in place, a writer's press opens the line, Enter
 * keeps it through the writer, a set on jobs alone offers no line. Harlow Ranch's made-up sets.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import type { PlansView, PlanSet } from '../../lib/developments/plans'
import { DevelopmentPlansCard } from './DevelopmentSideCards'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

beforeAll(installDomShims)
afterEach(cleanup)

const withMemo: PlanSet = { key: 'https://p/A', link: 'https://p/A', dated: '2026-10-20', filedAt: null, filedBy: null, carriers: [{ kind: 'bid', id: 'b1', label: 'BP401' }], memo: 'P-201 redrawn', memoRow: { id: 'r1', bidId: 'b1' } }
const noMemo: PlanSet = { key: 'https://p/B', link: 'https://p/B', dated: null, filedAt: '2026-10-01T00:00:00Z', filedBy: null, carriers: [{ kind: 'bid', id: 'b2', label: 'BP402' }], memo: '', memoRow: null }
const jobsOnly: PlanSet = { key: 'https://p/C', link: 'https://p/C', dated: null, filedAt: null, filedBy: null, carriers: [{ kind: 'job', id: 'j1', label: 'JP1102' }], memo: '', memoRow: null }
const view: PlansView = { sets: [withMemo, noMemo, jobsOnly], newest: withMemo, none: [], olderOrNone: [] }

describe('DevelopmentPlansCard memo line', () => {
  it('a writer presses the memo or Add a memo, types, and Enter keeps it through the writer; a jobs-only set offers no line', async () => {
    const write = vi.fn(async () => true)
    renderWithProviders(<DevelopmentPlansCard view={view} openCarrier={() => {}} askAbout={() => {}} memoWriter={write} />)
    expect(screen.getByText('P-201 redrawn')).toBeTruthy()
    expect(screen.getAllByText('Add a memo')).toHaveLength(1)
    fireEvent.click(screen.getByText('Add a memo'))
    const box = screen.getByLabelText("The set's memo") as HTMLInputElement
    fireEvent.change(box, { target: { value: 'Addendum 1: two more floor drains' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    await waitFor(() => expect(write).toHaveBeenCalledWith(noMemo, 'Addendum 1: two more floor drains'))
    await waitFor(() => expect(screen.queryByLabelText("The set's memo")).toBeNull())
    fireEvent.click(screen.getByText('P-201 redrawn'))
    expect((screen.getByLabelText("The set's memo") as HTMLInputElement).value).toBe('P-201 redrawn')
    fireEvent.keyDown(screen.getByLabelText("The set's memo"), { key: 'Escape' })
    expect(screen.queryByLabelText("The set's memo")).toBeNull()
  })
  it('a reader sees the words and no press', () => {
    renderWithProviders(<DevelopmentPlansCard view={view} openCarrier={() => {}} askAbout={() => {}} />)
    expect(screen.getByText('P-201 redrawn').tagName).toBe('SPAN')
    expect(screen.queryByText('Add a memo')).toBeNull()
  })
})
