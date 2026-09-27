// @vitest-environment jsdom
/**
 * Render smokes for the Pay view (v2.3887): on a phone the ledger is rows —
 * a sub opens to its sheets, a sheet opens one bottom sheet with its verbs —
 * and the 980 px table is not drawn; on a desk the table is.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { installDomShims, makeLaborJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import JobsSubLaborTab from './JobsSubLaborTab'

const narrow = { on: true }
vi.mock('../../hooks/useIsNarrowScreen', () => ({ useIsNarrowScreen: () => narrow.on }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})
vi.mock('../dispatchMode/DispatchModeFooter', () => ({ DISPATCH_MODE_FOOTER_HEIGHT_PX: 56 }))

beforeAll(installDomShims)
afterEach(cleanup)

const job = makeLaborJob({ id: 'sheet-1', assigned_to_name: 'Sam Sub', job_number: 'S-212' })

function props(over: Record<string, unknown> = {}) {
  return {
    error: null,
    subLaborSearch: '',
    onSubLaborSearchChange: () => {},
    laborJobs: [job],
    laborJobsLoading: false,
    laborJobNamesByJobId: {},
    jobs: [],
    authUserId: 'u-1',
    laborJobAssigneesByJobId: new Map(),
    subLaborDueTotal: 0,
    onNewLaborJob: () => {},
    onEditLaborJob: vi.fn(),
    onPrintJobSubSheet: vi.fn(),
    onUpdateLaborJobDate: () => {},
    onSetLaborJobStage: () => {},
    onOpenMakePayment: vi.fn(),
    onOpenBackcharge: vi.fn(),
    hideToolbar: true,
    ...over,
  } as unknown as Parameters<typeof JobsSubLaborTab>[0]
}

describe('JobsSubLaborTab · the Pay view on a phone', () => {
  it('draws rows instead of the table, and a sheet row opens its verbs in one bottom sheet', async () => {
    narrow.on = true
    const p = props()
    renderWithProviders(<JobsSubLaborTab {...p} />)
    await settle()
    expect(document.querySelector('table')).toBeNull()
    const row = document.querySelector('[data-sub-pay-phone-row="sheet-1"]') as HTMLElement
    expect(row.textContent).toContain('S-212')
    fireEvent.click(row)
    const dialog = screen.getByRole('dialog')
    // Money is due on the sheet and nothing is in writing: the agreement leads, the payment follows.
    expect([...dialog.querySelectorAll('button')].map((x) => x.querySelector('span')?.textContent ?? x.textContent)).toEqual(expect.arrayContaining(['Record payment', 'Back-charge', 'Edit the sheet', 'Print', 'Story', 'Lien waiver', 'Close']))
    expect(dialog.textContent).toContain('Edit the sheet')
    expect(dialog.textContent).toContain('Back-charge')
    fireEvent.click(screen.getByText('Edit the sheet'))
    expect(p.onEditLaborJob).toHaveBeenCalledWith(expect.objectContaining({ id: 'sheet-1' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('on a desk the ledger is the table', async () => {
    narrow.on = false
    renderWithProviders(<JobsSubLaborTab {...props()} />)
    await settle()
    expect(document.querySelector('[data-sub-pay-phone]')).toBeNull()
  })
})
