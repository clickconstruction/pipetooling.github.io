// @vitest-environment jsdom
/**
 * Render smoke for Dispatch Mode's Schedule (v2.3893): for someone who can
 * edit the schedule, a tap on a block's job opens the block sheet — Open the
 * job · the note · Move or reassign · Remove — and Move or reassign opens the
 * move sheet.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { installDomShims, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import DispatchModeSchedule from './DispatchModeSchedule'

const openJobDetail = vi.fn()
/** The day's blocks the agenda reads; a test empties it to see the empty day. */
let mockDayBlocks: Array<Record<string, unknown>> = []
const BLOCK_473 = { id: 'b1', assigneeUserId: 'u-m', assigneeName: 'Malachi', timeStart: '07:00:00', timeEnd: '09:00:00', note: null, sharedBlockGroupId: null, jobId: 'j473', hcpNumber: '473', clickNumber: null, jobName: 'Mike Holub', jobAddress: '109 Tuscarora Trail', customerName: 'Mike Holub', serviceTypeName: null }
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})
vi.mock('../../contexts/JobDetailModalContext', () => ({ useJobDetailModal: () => ({ openJobDetail }) }))
vi.mock('../../hooks/useJobAccountStrips', () => ({ useJobAccountStrips: () => ({ byJob: new Map(), loaded: true, reload: () => {} }) }))
vi.mock('./DispatchModeFooter', () => ({ DISPATCH_MODE_FOOTER_HEIGHT_PX: 56 }))
vi.mock('../../lib/dispatchModeSchedule', async () => {
  const actual = await vi.importActual<typeof import('../../lib/dispatchModeSchedule')>('../../lib/dispatchModeSchedule')
  return {
    ...actual,
    fetchDispatchModeDayJobCounts: async () => ({ data: new Map(), error: null }),
    fetchDispatchModeDayBlocks: async () => ({
      data: mockDayBlocks,
      error: null,
      errorKind: null,
    }),
  }
})

beforeAll(installDomShims)
beforeEach(() => {
  mockDayBlocks = [BLOCK_473]
})
afterEach(cleanup)

describe('DispatchModeSchedule · the block sheet', () => {
  it('a tap on the block’s job opens the sheet, and Move or reassign opens the move sheet', async () => {
    renderWithProviders(<DispatchModeSchedule />)
    await settle()
    const block = document.querySelector('[data-dispatch-mode-block="b1"]') as HTMLElement
    expect(block).toBeTruthy()
    fireEvent.click(block)
    const sheet = screen.getByRole('dialog', { name: /473 · Mike Holub/ })
    expect([...sheet.querySelectorAll('button')].map((b) => b.querySelector('span')?.textContent ?? b.textContent)).toEqual(['Open the job', 'Add a note', 'Move or reassign', 'Remove from the schedule', 'Close'])
    expect(sheet.textContent).toContain('Malachi')
    fireEvent.click(screen.getByText('Move or reassign'))
    await settle()
    expect(screen.queryByText('Remove from the schedule')).toBeNull()
    expect(document.body.textContent).toContain('473 · Mike Holub')
  })

  it('Open the job opens the job window', async () => {
    renderWithProviders(<DispatchModeSchedule />)
    await settle()
    fireEvent.click(document.querySelector('[data-dispatch-mode-block="b1"]') as HTMLElement)
    fireEvent.click(screen.getByText('Open the job'))
    expect(openJobDetail).toHaveBeenCalledWith({ jobId: 'j473' })
  })
})

describe('DispatchModeSchedule · an empty day', () => {
  it('says nothing is scheduled and offers Assign work, which opens the Assign work sheet', async () => {
    mockDayBlocks = []
    renderWithProviders(<DispatchModeSchedule />)
    await settle()
    const empty = document.querySelector('[data-empty-state]') as HTMLElement
    expect(empty.textContent).toBe('Nothing scheduled. Assign work puts people on a job this day.')
    expect(document.getElementById('quick-assign-title')).toBeNull()
    fireEvent.click(within(empty).getByRole('button', { name: 'Assign work' }))
    expect(document.getElementById('quick-assign-title')).toBeTruthy()
  })
})
