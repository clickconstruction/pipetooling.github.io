// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { GcCloseoutWindow, type CloseoutWrites } from './GcCloseoutWindow'
import { initialGcState } from '../../lib/gc/schedule/testState'
import { plainWordsFailures } from '../../lib/plainWords'
import type { OwnWorkCosts } from '../../lib/gc/ownWorkCost'
import type { Draw, GcProject, GcState } from '../../lib/gc/types'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()

function setup({
  id = 'fairoaksd',
  project: change,
  billsRead = true,
  onSeeBill,
  own,
  emailOn = false,
}: {
  id?: string
  project?: (p: GcProject) => GcProject
  billsRead?: boolean
  onSeeBill?: () => void
  own?: OwnWorkCosts
  /** The window's email tick, on or off. Unset: no tick. */
  emailOn?: boolean
} = {}) {
  const base = initialGcState()
  const found = base.projects.find((p) => p.id === id)!
  const project = change ? change(found) : found
  const state: GcState = { ...base, projects: base.projects.map((p) => (p.id === project.id ? project : p)) }
  const writes: { [K in keyof CloseoutWrites]: ReturnType<typeof vi.fn> } = {
    onAccept: vi.fn(),
    onFinalCameIn: vi.fn(),
    onApproveRelease: vi.fn(),
    onPay: vi.fn(),
    onWaiverIn: vi.fn(),
    onCloseJob: vi.fn(),
  }
  const emailTick = emailOn ? { on: true, onChange: () => undefined } : null
  render(<GcCloseoutWindow state={state} project={project} billsRead={billsRead} writes={writes} onSeeBill={onSeeBill} own={own} emailTick={emailTick} onClose={() => undefined} />)
  return { writes }
}

const trade = (id: string) => document.querySelector(`[data-closeout-trade="${id}"]`) as HTMLElement
const step = (tradeId: string, key: string) => trade(tradeId).querySelector(`[data-closeout-step="${key}"]`) as HTMLElement

/** The customer paid our final pay application on Sep 20, so the trades' releases open Sep 30. */
const customerPaid = (p: GcProject): GcProject => ({
  ...p,
  ownerBilling: p.ownerBilling
    ? { ...p.ownerBilling, payApps: (p.ownerBilling.payApps ?? []).map((a, i, all) => (i === all.length - 1 ? { ...a, final: true, paidOn: '2026-09-20' } : a)) }
    : p.ownerBilling,
})

/** One trade's retainage release at another status. */
const releaseAt = (pkgId: string, status: Draw['status']) => (p: GcProject): GcProject => ({
  ...p,
  packages: p.packages.map((k) =>
    k.id === pkgId && k.sow
      ? {
          ...k,
          sow: {
            ...k.sow,
            draws: k.sow.draws.map((d) => (d.final ? { ...d, status, approvedOn: '2026-10-01', ...(status === 'paid' ? { paidOn: '2026-10-02' } : {}) } : d)),
          },
        }
      : k,
  ),
})

/** Every punch item on Concrete checked fixed. */
const punchDone = (p: GcProject): GcProject => ({
  ...p,
  punch: (p.punch ?? []).map((i) => ({ ...i, fixedOn: i.fixedOn ?? '2026-09-30', checkedOn: i.checkedOn ?? '2026-10-01' })),
})

describe('GcCloseoutWindow', () => {
  it('reads Fair Oaks D: a card for each trade with a signed statement of work, what we hold, and what is left before the job closes', () => {
    setup()
    expect(screen.getByRole('dialog', { name: 'Fair Oaks Shops, Building D: Closeout' })).toBeTruthy()
    expect([...document.querySelectorAll('[data-closeout-trade]')].map((el) => (el as HTMLElement).dataset.closeoutTrade)).toEqual(['fsite', 'fconc', 'fsteel', 'felec', 'froof', 'fhvac'])
    expect(trade('fsteel').querySelector('[data-closeout-not-billed]')!.textContent).toContain('Closeout starts when every line is billed.')
    expect(trade('fconc').textContent).toContain('We hold $21,400')
    const job = document.querySelector('[data-closeout-job]') as HTMLElement
    expect(job.dataset.closeoutJob).toBe('waits')
    expect((within(job).getByRole('button', { name: 'Close the job' }) as HTMLButtonElement).disabled).toBe(true)
    expect([...job.querySelectorAll('[data-closeout-left] li')].map((li) => li.textContent)).toContain('Plumbing: our own crew is 65% done.')
    expect(document.querySelector('[data-closeout-others]')!.textContent).toContain('Plumbing: our own crew, 65% done. Nothing is held.')
  })

  it('says what general conditions cost from their Pipeline job, or that they count at their budget (O11b)', () => {
    setup()
    expect(document.querySelector('[data-closeout-general-conditions]')!.textContent).toMatch(/^General conditions \$[\d,]+, at their budget: no Pipeline job is named for them yet\.$/)
    cleanup()
    const own: OwnWorkCosts = { payAccess: true, byJob: { 'j-gc': { jobId: 'j-gc', label: 'J 1080', name: 'Fair Oaks general conditions', spentUsd: 61_200, teamUsd: 61_200, subUsd: 0, partsUsd: 0, fieldDays: 30, finished: false } } }
    setup({ project: (p) => ({ ...p, generalConditionsJobId: 'j-gc' }), own })
    expect(document.querySelector('[data-closeout-general-conditions]')!.textContent).toMatch(/^General conditions \$[\d,]+: \$61,200 spent so far on Pipeline job J 1080\.$/)
  })

  it('holds Accept the work on the punch list in its words, and presses it once every item is checked', () => {
    setup()
    const accepted = step('fconc', 'accepted')
    expect(accepted.dataset.stepState).toBe('now')
    expect((within(accepted).getByRole('button', { name: 'Accept the work' }) as HTMLButtonElement).disabled).toBe(true)
    expect(accepted.querySelector('[data-closeout-accept-held]')!.textContent).toBe('2 punch items are not checked fixed yet.')
    expect(accepted.textContent).toContain('Punch list: 1 to fix, 1 fixed and waiting on our check, 1 checked.')
  })

  it('accepts the work once the punch list is done', () => {
    const { writes } = setup({ project: punchDone })
    fireEvent.click(within(step('fconc', 'accepted')).getByRole('button', { name: 'Accept the work' }))
    expect(writes.onAccept).toHaveBeenCalledWith('fconc')
  })

  it('says the company gets an email when the tick is on: the work accepted, a final that came in (the Portal’s P5c-4)', () => {
    setup({ project: punchDone, emailOn: true })
    expect(step('fconc', 'accepted').querySelector('[data-closeout-accept-email]')!.textContent).toBe('Guadalupe Flatwork gets an email that we accepted its work.')
    fireEvent.click(within(step('fsite', 'finalApp')).getByRole('button', { name: 'Their final pay application came by email' }))
    expect(step('fsite', 'finalApp').querySelector('[data-closeout-final-email]')!.textContent).toBe('Tri-County Site gets an email that its final pay application came in.')
  })

  it('says nothing of an email with the tick off', () => {
    setup({ project: punchDone })
    expect(document.querySelector('[data-closeout-accept-email]')).toBeNull()
    fireEvent.click(within(step('fsite', 'finalApp')).getByRole('button', { name: 'Their final pay application came by email' }))
    expect(document.querySelector('[data-closeout-final-email]')).toBeNull()
  })

  it('records a final pay application that came by email, held until it has its day', () => {
    const { writes } = setup()
    const finalApp = step('fsite', 'finalApp')
    expect(finalApp.textContent).toContain('Waiting on Tri-County Site.')
    fireEvent.click(within(finalApp).getByRole('button', { name: 'Their final pay application came by email' }))
    const form = finalApp.querySelector('[data-closeout-final-form]') as HTMLElement
    expect(form.querySelector('[data-closeout-final-sum]')!.textContent).toContain('It asks for the $16,800 we hold')
    const record = within(form).getByRole('button', { name: 'Record it' }) as HTMLButtonElement
    expect(record.disabled).toBe(true)
    expect(record.title).toBe('Say the day it runs to first.')
    fireEvent.change(form.querySelector('input[type="date"]')!, { target: { value: '2026-10-09' } })
    fireEvent.change(within(form).getByLabelText("The file's name"), { target: { value: 'Final pay app.pdf' } })
    if (record.disabled) fireEvent.change(within(form).getByText('Signed by').parentElement!.querySelector('input')!, { target: { value: 'Ray Ochoa' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Record it' }))
    expect(writes.onFinalCameIn).toHaveBeenCalledWith(expect.objectContaining({ packageId: 'fsite', periodTo: '2026-10-09', fileName: 'Final pay app.pdf' }))
    expect(finalApp.querySelector('[data-closeout-final-form]')).toBeNull()
  })

  it('waits on the customer for our retainage, with a way to Bill the customer', () => {
    const onSeeBill = vi.fn()
    setup({ id: 'stoneoak', onSeeBill })
    expect(document.querySelector('[data-closeout-owner]')!.textContent).toContain('Hollis Family Pharmacy still holds it.')
    const owner = step('sdry', 'ownerReleased')
    expect(owner.dataset.stepState).toBe('now')
    expect(owner.textContent).toContain('Waiting on the customer.')
    fireEvent.click(within(owner).getByRole('button', { name: 'Bill the customer' }))
    expect(onSeeBill).toHaveBeenCalled()
    expect(within(step('sdry', 'released')).queryByRole('button', { name: 'Approve the release' })).toBeNull()
  })

  it('says it is reading the customer’s bills until they load', () => {
    setup({ id: 'stoneoak', billsRead: false })
    expect(document.querySelector('[data-closeout-owner]')!.textContent).toContain("Reading the customer's bills.")
  })

  it('approves the release once the customer paid us and 10 days passed, marks it paid, then takes their final release', () => {
    const first = setup({ id: 'stoneoak', project: customerPaid })
    expect(document.querySelector('[data-closeout-owner]')!.textContent).toContain('Hollis Family Pharmacy paid it Sep 20. We can pay the trades theirs now.')
    fireEvent.click(within(step('sdry', 'released')).getByRole('button', { name: 'Approve the release' }))
    expect(first.writes.onApproveRelease).toHaveBeenCalledWith('sdry', 'sdry-draw-3')
  })

  it('marks an approved release paid', () => {
    const { writes } = setup({ id: 'stoneoak', project: (p) => releaseAt('sdry', 'approved')(customerPaid(p)) })
    fireEvent.click(within(step('sdry', 'released')).getByRole('button', { name: 'Mark paid' }))
    expect(writes.onPay).toHaveBeenCalledWith('sdry', 'sdry-draw-3')
  })

  it('records their unconditional final release once we paid', () => {
    const { writes } = setup({ id: 'stoneoak', project: (p) => releaseAt('sdry', 'paid')(customerPaid(p)) })
    const waiver = step('sdry', 'finalWaiver')
    expect(waiver.dataset.stepState).toBe('now')
    fireEvent.click(within(waiver).getByRole('button', { name: 'Their final release came in' }))
    expect(writes.onWaiverIn).toHaveBeenCalledWith('sdry', 'sdry-draw-3')
  })

  it('opens the final pay application to read, and steps back to closeout', () => {
    setup({ id: 'stoneoak' })
    fireEvent.click(within(step('sdry', 'finalApp')).getByRole('button', { name: 'Final pay application' }))
    expect(document.querySelector('[data-closeout-trade]')).toBeNull()
    expect(screen.getByRole('dialog').textContent).toContain('Retainage, released on this final application')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(trade('sdry')).toBeTruthy()
  })

  it('closes the job once nothing is left, and reads a closed job as closed', () => {
    const ready = (p: GcProject): GcProject => customerPaid({ ...p, packages: [] })
    const { writes } = setup({ id: 'stoneoak', project: ready })
    const job = document.querySelector('[data-closeout-job]') as HTMLElement
    expect(job.dataset.closeoutJob).toBe('ready')
    fireEvent.click(within(job).getByRole('button', { name: 'Close the job' }))
    expect(writes.onCloseJob).toHaveBeenCalled()
  })

  it('reads a closed job as closed, with its day', () => {
    setup({ id: 'stoneoak', project: (p) => ({ ...p, closedOn: '2026-10-09' }) })
    const job = document.querySelector('[data-closeout-job]') as HTMLElement
    expect(job.dataset.closeoutJob).toBe('closed')
    expect(job.textContent).toBe('job closed Oct 9')
  })

  it('shows each trade’s punch list under its steps when given its presses (U3b), and passes a press through', () => {
    const base = initialGcState()
    const project = base.projects.find((p) => p.id === 'fairoaksd')!
    const punchWrites = { onAdd: vi.fn(), onRemove: vi.fn(), onFixedIn: vi.fn(), onCheck: vi.fn() }
    const writes = { onAccept: vi.fn(), onFinalCameIn: vi.fn(), onApproveRelease: vi.fn(), onPay: vi.fn(), onWaiverIn: vi.fn(), onCloseJob: vi.fn() }
    render(<GcCloseoutWindow state={base} project={project} writes={writes} punchWrites={punchWrites} onClose={() => undefined} />)
    const list = trade('fconc').querySelector('[data-punch-list="fconc"]') as HTMLElement
    expect(list.querySelector('[data-punch-count]')!.textContent).toBe('2 of 3 still open.')
    fireEvent.click(within(list.querySelector('[data-punch-item="fairoaksd-punch-2"]') as HTMLElement).getByRole('button', { name: 'Checked, it is fixed' }))
    expect(punchWrites.onCheck).toHaveBeenCalledWith('fairoaksd-punch-2', true)
  })

  it('shows no punch list without its presses, as before U3b', () => {
    setup()
    expect(document.querySelector('[data-punch-list]')).toBeNull()
  })

  it('says each thing a first-timer reads in plain words', () => {
    setup()
    fireEvent.click(within(step('fsite', 'finalApp')).getByRole('button', { name: 'Their final pay application came by email' }))
    const said = [
      document.querySelector('[data-closeout-lede]')!.textContent!,
      document.querySelector('[role="dialog"] p')?.textContent ?? '',
      document.querySelector('[data-closeout-owner]')!.textContent!.replace("The customer's retainage on us", '').replace('Bill the customer', ''),
      ...[...document.querySelectorAll('[data-closeout-left] li')].map((li) => li.textContent!),
      document.querySelector('[data-closeout-accept-held]')!.textContent!,
      document.querySelector('[data-closeout-final-sum]')!.textContent!,
      trade('fsteel').querySelector('[data-closeout-not-billed]')!.textContent!,
      'No trade has a signed statement of work yet. Closeout starts once one does.',
      'Every trade is closed out, our own crew is done and the customer paid our retainage.',
      'Waiting on Tri-County Site.',
      'Waiting on the customer.',
      'Only people given access can open this link. Our office may not be one of them.',
      'Guadalupe Flatwork gets an email that we accepted its work.',
      'Tri-County Site gets an email that its final pay application came in.',
    ]
    for (const words of said) expect(plainWordsFailures(words), words).toEqual([])
  })
})
