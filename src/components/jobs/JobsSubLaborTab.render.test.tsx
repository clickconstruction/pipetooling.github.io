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
import { subLaborJobBalance } from '../../lib/subLaborOutstanding'

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

  it("a desk row's More button centres its dots by its own box, keeps its name and opens its menu (v2.7168)", async () => {
    narrow.on = false
    renderWithProviders(<JobsSubLaborTab {...props()} />)
    await settle()
    const more = screen.getByRole('button', { name: 'More' })
    // The dots are the Pipeline row's icon, not typed characters: text under the default button padding sat right and low.
    expect(more.textContent).toBe('')
    expect(more.querySelector('svg')).not.toBeNull()
    expect(more.style.display).toBe('inline-flex')
    expect(more.style.alignItems).toBe('center')
    expect(more.style.justifyContent).toBe('center')
    expect(more.style.padding).toBe('0px')
    expect(more.style.width).toBe('30px')
    expect(more.style.height).toBe('26px')
    fireEvent.click(more)
    expect(screen.getAllByRole('menuitem').map((x) => x.textContent)).toEqual(expect.arrayContaining(['Back-charge…', 'Edit sheet', 'Print', 'Story…', 'Lien waiver…']))
  })

  it('the Sheet date saves a finished date only: a half-typed year hands over nothing, a finished date once', async () => {
    narrow.on = false
    const onUpdateLaborJobDate = vi.fn()
    renderWithProviders(<JobsSubLaborTab {...props({ laborJobs: [makeLaborJob({ id: 'sheet-1', assigned_to_name: 'Sam Sub', job_number: 'S-212', job_date: '2026-09-10' })], onUpdateLaborJobDate })} />)
    await settle()
    const sheetRow = [...document.querySelectorAll('tr')].find((tr) => tr.firstElementChild?.textContent === '▶') as HTMLElement
    fireEvent.click(sheetRow)
    const box = screen.getByLabelText('Sheet date') as HTMLInputElement
    expect(box.value).toBe('2026-09-10')
    // The browser hands over 0002-09-30 when the first digit of the year lands.
    fireEvent.change(box, { target: { value: '0002-09-30' } })
    expect(onUpdateLaborJobDate).not.toHaveBeenCalled()
    fireEvent.change(box, { target: { value: '2026-09-30' } })
    expect(onUpdateLaborJobDate.mock.calls).toEqual([['sheet-1', '2026-09-30']])
    // Typed and left with the year half done: dropped, with a line that says why.
    fireEvent.keyDown(box, { key: '2' })
    fireEvent.change(box, { target: { value: '0002-09-10' } })
    fireEvent.blur(box)
    expect(onUpdateLaborJobDate).toHaveBeenCalledTimes(1)
    expect(box.value).toBe('2026-09-10')
    expect(screen.getByText(/That date was not finished, so it was not saved/)).toBeTruthy()
  })
})

describe('JobsSubLaborTab · an undated sheet made in the evening (v2.4469)', () => {
  it('shows the Central day it was made in the Sheet date box', async () => {
    narrow.on = false
    // 00:30 UTC on Sep 11 is 7:30 pm CDT on Sep 10.
    renderWithProviders(<JobsSubLaborTab {...props({ laborJobs: [makeLaborJob({ id: 'sheet-1', assigned_to_name: 'Sam Sub', job_number: 'S-212', job_date: null, created_at: '2026-09-11T00:30:00Z' })] })} />)
    await settle()
    const sheetRow = [...document.querySelectorAll('tr')].find((tr) => tr.firstElementChild?.textContent === '▶') as HTMLElement
    fireEvent.click(sheetRow)
    expect((screen.getByLabelText('Sheet date') as HTMLInputElement).value).toBe('2026-09-10')
  })
})

describe('JobsSubLaborTab · an empty ledger (#184)', () => {
  it('no sheet at all names New Sub Labor, and the press opens it', async () => {
    narrow.on = false
    const onNewLaborJob = vi.fn()
    renderWithProviders(<JobsSubLaborTab {...props({ laborJobs: [], onNewLaborJob })} />)
    await settle()
    const press = screen.getByRole('button', { name: 'New Sub Labor' })
    expect((press.closest('[data-empty-state]') as HTMLElement).textContent).toBe('No sub sheets yet. New Sub Labor adds the first.')
    fireEvent.click(press)
    expect(onNewLaborJob).toHaveBeenCalledTimes(1)
  })

  it('a search that hides every sheet quotes it and offers Clear the search', async () => {
    narrow.on = false
    const onSubLaborSearchChange = vi.fn()
    renderWithProviders(<JobsSubLaborTab {...props({ subLaborSearch: 'zzz', onSubLaborSearchChange })} />)
    await settle()
    const press = screen.getByRole('button', { name: 'Clear the search' })
    expect((press.closest('[data-empty-state]') as HTMLElement).textContent).toBe('No sub sheets match ‘zzz’. Clear the search')
    fireEvent.click(press)
    expect(onSubLaborSearchChange).toHaveBeenCalledWith('')
  })
})

describe('JobsSubLaborTab · when a sheet was paid (#347)', () => {
  it('a desk row says when its payments were made, and a paid sheet says the day it was paid in full (#347)', async () => {
    narrow.on = false
    const part = makeLaborJob({ id: 'sheet-part', job_number: 'S-300', payments: [{ id: 'p1', amount: 10, memo: null, created_at: '2026-10-21T15:00:00Z', payment_date: '2026-10-21' }] })
    const full = makeLaborJob({ id: 'sheet-full', job_number: 'S-301' })
    full.payments = [{ id: 'p2', amount: subLaborJobBalance(full).totalCost, memo: 'Zelle', created_at: '2026-11-02T15:00:00Z', payment_date: '2026-11-02' }]
    renderWithProviders(<JobsSubLaborTab {...props({ laborJobs: [part, full] })} />)
    await settle()
    const year = new Date().getFullYear() === 2026 ? '' : ', 2026'
    expect(document.querySelector('[data-sub-pay-dates="sheet-part"]')?.textContent).toBe(`Oct 21${year}`)
    // The paid sheet sits behind the Paid chip, with its day in the Paid cell and in Pay when.
    fireEvent.click(screen.getByRole('button', { name: /^Paid/ }))
    expect(document.querySelector('[data-sub-pay-dates="sheet-full"]')?.textContent).toBe(`Nov 2${year}`)
    expect(document.body.textContent).toContain(`paid in full Nov 2${year}`)
    expect(document.body.textContent).not.toContain('balance is $0')
  })

  it('on a phone a paid sheet reads the day it was paid in full', async () => {
    narrow.on = true
    const full = makeLaborJob({ id: 'sheet-full-phone', job_number: 'S-302' })
    full.payments = [{ id: 'p3', amount: subLaborJobBalance(full).totalCost, memo: null, created_at: '2026-11-02T15:00:00Z', payment_date: '2026-11-02' }]
    renderWithProviders(<JobsSubLaborTab {...props({ laborJobs: [full] })} />)
    await settle()
    const year = new Date().getFullYear() === 2026 ? '' : ', 2026'
    fireEvent.click(screen.getByRole('button', { name: /^Paid/ }))
    const row = document.querySelector('[data-sub-pay-phone-row="sheet-full-phone"]') as HTMLElement | null
    if (!row) {
      // A sub's group opens on a tap when it is not open already.
      const group = [...document.querySelectorAll('[data-sub-pay-phone] button')].find((b) => b.textContent?.includes('Sub Sam')) as HTMLElement
      fireEvent.click(group)
    }
    expect((document.querySelector('[data-sub-pay-phone-row="sheet-full-phone"]') as HTMLElement).textContent).toContain(`paid in full Nov 2${year}`)
  })
})
