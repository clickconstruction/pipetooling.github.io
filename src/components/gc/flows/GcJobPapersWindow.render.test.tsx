// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { JobPapers } from '../../../hooks/useJobPapers'
import { boardCompanyOf, jobPaperCompanyOf } from '../../../lib/flows/boardRead'
import { FIRST_NAMES, USUAL } from '../../../lib/flows/boardFixtures'
import { FLOW_FIXTURE_JOBS, FLOW_FIXTURE_NOW, FLOW_FIXTURE_PEOPLE } from '../../../lib/flows/flowFixtures'
import { SEED_FLOWS } from '../../../lib/flows/seed'
import { readFlow } from '../../../lib/flows/state'
import { installDomShims } from '../../../test/renderSmokeMocks'
import { GcCompanyOpenerContext } from '../gcCompanyOpener'
import { GcCustomerOpenerContext } from '../gcCustomerOpener'

installDomShims()

/** Everyone on Boerne Retail Shell, a bid due Thu Oct 8, read on their flows at Fri Oct 2. */
const onBoerne = FLOW_FIXTURE_PEOPLE.filter((p) => p.stamps.jobIds.includes('boerne')).map((p) => {
  const flow = SEED_FLOWS[p.kind]
  const r = readFlow(flow, p.stamps, FLOW_FIXTURE_NOW)
  const card = { name: p.name, goes_by: null, company: p.company || null, trades: p.trade ? [p.trade] : [], gc_company_id: null, customer_id: null }
  return jobPaperCompanyOf(flow, boardCompanyOf(flow, p.contactId, card, r), r, 'boerne')
})
const READ: JobPapers = {
  input: {
    jobId: 'boerne',
    flows: { trade: SEED_FLOWS.trade, customer: SEED_FLOWS.customer, arch: SEED_FLOWS.arch },
    companies: onBoerne,
    today: '2026-10-02',
    usual: USUAL,
    firstNames: FIRST_NAMES,
    jobs: Object.fromEntries(Object.entries(FLOW_FIXTURE_JOBS).map(([id, name]) => [id, { name }])),
  },
  refs: Object.fromEntries(onBoerne.map((c) => [c.contactId, c.kind === 'trade' ? { companyId: `co-${c.contactId}`, customerId: null } : { companyId: null, customerId: `cu-${c.contactId}` }])),
  loading: false,
  error: null,
  refresh: () => undefined,
}
let papers: JobPapers = READ
vi.mock('../../../hooks/useJobPapers', () => ({ useJobPapers: () => papers }))
const { GcJobPapersWindow } = await import('./GcJobPapersWindow')

const openPartner = vi.fn()
const openCustomer = vi.fn()
const onClose = vi.fn()
const onOpenProject = vi.fn()
const BOERNE = { name: 'Boerne Retail Shell', stage: 'pursuing', bidDue: '2026-10-08', ourBidSentOn: null }
const show = (ui: ReactElement = <GcJobPapersWindow projectId="boerne" project={BOERNE} onClose={onClose} onOpenProject={onOpenProject} />) =>
  render(
    <GcCompanyOpenerContext.Provider value={{ openPartner }}>
      <GcCustomerOpenerContext.Provider value={{ openCustomer }}>{ui}</GcCustomerOpenerContext.Provider>
    </GcCompanyOpenerContext.Provider>,
  )
const row = (id: string) => within(document.querySelector(`[data-papers-row="${id}"]`) as HTMLElement)

describe('GcJobPapersWindow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    papers = READ
  })

  it('reads the counts in the title, the strip before bid day, and a row per company with a column per paper', () => {
    show()
    const win = screen.getByRole('dialog', { name: 'Papers on Boerne Retail Shell' })
    expect(within(win).getByRole('button', { name: '1 lapsed' })).toBeTruthy()
    expect(within(win).getByRole('button', { name: '1 late' })).toBeTruthy()
    expect(within(win).getByText(/Before bid day · Thu Oct 8 · 6 days/)).toBeTruthy()
    expect(within(win).getByText("Hillside Excavation's insurance ran out Sep 30. No statement of work can go to them until a new one is in.")).toBeTruthy()
    expect(within(win).getByRole('columnheader', { name: 'Final waiver' })).toBeTruthy()
    expect(row('greg').getByRole('button', { name: 'Hillside Excavation, Insurance: ran out' })).toBeTruthy()
    expect(row('greg').getByRole('button', { name: 'Hillside Excavation, Quote: late 2 days' })).toBeTruthy()
  })

  it('opens the company at the paper, with the ask ready for one to ask for, and the compare on its card', () => {
    show()
    fireEvent.click(row('greg').getByRole('button', { name: 'Hillside Excavation, Insurance: ran out' }))
    expect(openPartner).toHaveBeenLastCalledWith('co-greg', { tab: 'documents', doc: 'w9', send: true })
    fireEvent.click(row('elena').getByRole('button', { name: /Cibolo Creek Partners, Contract:/ }))
    expect(openCustomer).toHaveBeenLastCalledWith('cu-elena', { tab: 'documents', doc: 'contract-boerne' })
    fireEvent.click(screen.getByRole('button', { name: 'Open the compare' }))
    expect(onClose).toHaveBeenCalled()
    expect(onOpenProject).toHaveBeenCalledWith('boerne')
  })

  it('keeps only the rows a pill names, and shows List behind its tab', () => {
    show()
    fireEvent.click(screen.getByRole('button', { name: '1 lapsed' }))
    expect(document.querySelectorAll('[data-papers-row]')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'List' }))
    const greg = within(document.querySelector('[data-papers-list="greg"]') as HTMLElement)
    expect(greg.getByText('ran out Sep 30')).toBeTruthy()
    expect(greg.getByText('Asked to quote · Greg is on it')).toBeTruthy()
    fireEvent.click(greg.getAllByRole('button', { name: 'Ask for it' })[0]!)
    expect(openPartner).toHaveBeenLastCalledWith('co-greg', { tab: 'documents', doc: 'w9', send: true })
  })

  it('has no strip once our bid went, closes on Escape, and says what it is doing in words', () => {
    const { unmount } = show(<GcJobPapersWindow projectId="boerne" project={{ ...BOERNE, ourBidSentOn: '2026-10-01' }} onClose={onClose} onOpenProject={onOpenProject} />)
    expect(screen.queryByText(/Before bid day/)).toBeNull()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
    unmount()
    papers = { ...READ, input: null, loading: true }
    const second = show()
    expect(screen.getByText('Reading the papers…')).toBeTruthy()
    second.unmount()
    papers = { ...READ, input: null, error: 'You need to be on the office team to see this.' }
    show()
    expect(screen.getByRole('alert').textContent).toBe('You need to be on the office team to see this.')
  })
})
