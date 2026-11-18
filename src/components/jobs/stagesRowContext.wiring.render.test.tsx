// @vitest-environment jsdom
/**
 * Each of the four Pipeline lists builds its row context through `stagesRowContext` (the Stages map's step 13). This
 * pins what a list hands the builder: its own flat props, bundle and all, and the app's windows from its own hooks.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
const hook = vi.hoisted(() => ({
  openCustomerProfile: () => {},
  openJobHoursStory: () => {},
  openSessionNotes: () => {},
  dispatchTaskModal: { openDispatchTask: () => {} },
  checklistAddModal: { openChecklistAdd: () => {} },
  calls: [] as Array<{ props: Record<string, unknown>; hooks: Record<string, unknown> }>,
}))
vi.mock('../../contexts/CustomerProfileModalContext', async (original) => ({
  ...(await original<typeof import('../../contexts/CustomerProfileModalContext')>()),
  useCustomerProfileModal: () => ({ openCustomerProfile: hook.openCustomerProfile }),
}))
vi.mock('../../contexts/JobHoursStoryModalContext', async (original) => ({
  ...(await original<typeof import('../../contexts/JobHoursStoryModalContext')>()),
  useJobHoursStoryModal: () => ({ openJobHoursStory: hook.openJobHoursStory }),
}))
vi.mock('./sessionNotesOpenerContext', async (original) => ({
  ...(await original<typeof import('./sessionNotesOpenerContext')>()),
  useSessionNotesOpener: () => hook.openSessionNotes,
}))
vi.mock('../../contexts/DispatchTaskModalContext', async (original) => ({
  ...(await original<typeof import('../../contexts/DispatchTaskModalContext')>()),
  useDispatchTaskModal: () => hook.dispatchTaskModal,
}))
vi.mock('../../contexts/ChecklistAddModalContext', async (original) => ({
  ...(await original<typeof import('../../contexts/ChecklistAddModalContext')>()),
  useChecklistAddModal: () => hook.checklistAddModal,
}))
vi.mock('./stagesRowContext', async (original) => {
  const actual = await original<typeof import('./stagesRowContext')>()
  return {
    ...actual,
    stagesRowContext: (props: Parameters<typeof actual.stagesRowContext>[0], hooks: Parameters<typeof actual.stagesRowContext>[1]) => {
      hook.calls.push({ props: props as unknown as Record<string, unknown>, hooks: hooks as unknown as Record<string, unknown> })
      return actual.stagesRowContext(props, hooks)
    },
  }
})

import JobsStagesTable from './JobsStagesTable'
import JobsStagesUnifiedTable, { type JobsStagesUnifiedTableProps } from './JobsStagesUnifiedTable'
import JobsStagesCardList, { JobsStagesUnifiedCardList } from './JobsStagesCardList'
import { makeStagesCardListProps } from '../../test/stagesCardListProps'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const openNewReportForJob = vi.fn()
const jobProps = () => makeStagesCardListProps({ openNewReportForJob })
function unifiedProps(): JobsStagesUnifiedTableProps {
  return {
    rows: [],
    actionLabel: 'Bill Customer',
    onJobAction: vi.fn(),
    onInvoiceAction: vi.fn(),
    onInvoiceSendBack: vi.fn(),
    openNewReportForJob,
    shared: {
      ...makeStagesCardListProps().shared,
      stagesHamMode: false,
      stagesInvoiceUpdatingId: null,
      invoiceEstimatedBillDateSavingId: null,
      bumpInvoiceEstimatedBillDate: vi.fn(async () => {}),
      setWhenInvoiceBillModal: vi.fn(),
      setWhenInvoiceBillModalDate: vi.fn(),
    },
  }
}

describe('each list builds its row context through the one builder', () => {
  beforeEach(() => {
    hook.calls.length = 0
  })
  afterEach(cleanup)

  const LISTS = [
    ['JobsStagesTable', () => { const p = jobProps(); return { ui: <JobsStagesTable {...p} />, shared: p.shared } }],
    ['JobsStagesCardList', () => { const p = jobProps(); return { ui: <JobsStagesCardList {...p} />, shared: p.shared } }],
    ['JobsStagesUnifiedTable', () => { const p = unifiedProps(); return { ui: <JobsStagesUnifiedTable {...p} />, shared: p.shared } }],
    ['JobsStagesUnifiedCardList', () => { const p = unifiedProps(); return { ui: <JobsStagesUnifiedCardList {...p} />, shared: p.shared } }],
  ] as const

  for (const [name, make] of LISTS) {
    it(`${name} hands the builder its flat props and its own hooks`, () => {
      const { ui, shared } = make()
      renderWithProviders(ui)
      expect(hook.calls.length).toBeGreaterThan(0)
      const { props, hooks } = hook.calls[hook.calls.length - 1]!
      // The bundle's values, flat, and the section's own New report opener beside them.
      for (const key of ['showToast', 'customers', 'openJobCalendar', 'loadJobs', 'authRole', 'crewByJobId', 'applyStagesInvoiceFocus'] as const) {
        expect(props[key]).toBe(shared[key])
      }
      expect(props.openNewReportForJob).toBe(openNewReportForJob)
      // The app's windows, each from the list's own hook.
      expect(hooks.openCustomerProfile).toBe(hook.openCustomerProfile)
      expect(hooks.openJobHoursStory).toBe(hook.openJobHoursStory)
      expect(hooks.openSessionNotesForJob).toBe(hook.openSessionNotes)
      expect(hooks.dispatchTaskModal).toBe(hook.dispatchTaskModal)
      expect(hooks.checklistAddModal).toBe(hook.checklistAddModal)
      expect(typeof hooks.navigate).toBe('function')
      expect(Object.keys(hooks).sort()).toEqual(['checklistAddModal', 'dispatchTaskModal', 'navigate', 'openCustomerProfile', 'openJobHoursStory', 'openSessionNotesForJob'])
    })
  }
})
