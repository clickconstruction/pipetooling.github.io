// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GcMoney } from './GcMoney'
import { allJobsMoney } from '../../lib/gc/ownerBilling'
import { ownerInterest } from '../../lib/gc/ownerBillingInterest'
import { initialGcState } from '../../lib/gc/schedule/testState'
import { money } from '../../lib/gc/words'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()

describe('GcMoney', () => {
  it('reads money across every job that is ours: the headline, who owes us, each job, and what comes later', () => {
    const state = initialGcState()
    const m = allJobsMoney(state)
    const onOpenBill = vi.fn()
    render(<GcMoney state={state} onOpenBill={onOpenBill} />)
    expect(document.body.textContent).toContain(`Across our ${m.jobs.length} jobs we are`)
    expect(screen.getByText('Who owes us')).toBeTruthy()
    for (const b of m.owed) expect(document.body.textContent).toContain(money(b.open))
    for (const j of m.jobs) expect(screen.getAllByText(j.project.name).length).toBeGreaterThan(0)
    expect(screen.getByText('What each job makes us')).toBeTruthy()
    expect(document.body.textContent).toContain('No job charges interest on late bills.')
    fireEvent.click(screen.getAllByRole('button', { name: 'Bill the customer' })[0]!)
    expect(onOpenBill).toHaveBeenCalled()
  })

  it('shows the interest built up on each job that charges it, from the day after a bill falls due by the contract (O6b-1)', () => {
    const state = initialGcState()
    // Fair Oaks D's pay application 3 went Sep 25: 5 contract days put it due Sep 30, late two days by Oct 2.
    const charged = { ...state, projects: state.projects.map((p) => (p.id === 'fairoaksd' ? { ...p, ownerLateInterest: { pctPerMonth: 1.5 }, ownerPayDays: 5 } : p)) }
    const fair = charged.projects.find((p) => p.id === 'fairoaksd')!
    const interest = ownerInterest(charged, fair)
    expect(interest.toBill).toBeGreaterThan(0)
    render(<GcMoney state={charged} />)
    expect(document.body.textContent).toContain(`${money(interest.toBill)} of interest has built up and is not billed yet.`)
    expect(document.body.textContent).toContain('1.5% a month')
    expect(document.body.textContent).toContain(`Built up ${money(interest.builtUp)}, billed ${money(0)}, paid ${money(0)}.`)
    cleanup()
    const untyped = { ...state, projects: state.projects.map((p) => (p.id === 'fairoaksd' ? { ...p, ownerLateInterest: { pctPerMonth: 1.5 } } : p)) }
    render(<GcMoney state={untyped} />)
    expect(document.body.textContent).toContain('No interest is waiting to be billed.')
    expect(document.body.textContent).toContain('None runs until the contract’s days to pay are typed.')
  })

  it('shows each job\'s late finish once the schedules are read, one line for a job with none (O6b-3)', () => {
    const state = initialGcState()
    render(<GcMoney state={state} schedulesRead={false} />)
    expect(document.body.textContent).toContain('Reading the jobs’ schedules…')
    cleanup()
    const fair = state.projects.find((p) => p.id === 'fairoaksd')!
    const laid = {
      ...state,
      projects: state.projects.map((p) => {
        if (p.id === 'fairoaksd') return { ...p, ownerLateFinish: { perDay: 500 }, schedule: { ...fair.schedule!, milestones: fair.schedule!.milestones.map((m) => (m.label === 'Substantial completion' ? { ...m, metOn: '2026-12-14' } : m)) } }
        const { schedule: _schedule, ...rest } = p
        return rest
      }),
    }
    render(<GcMoney state={laid} />)
    expect(document.body.textContent).toContain('We reached substantial completion Mon Dec 14, 3 days past the contract\'s Fri Dec 11.')
    expect(document.body.textContent).toContain(`At ${money(500)} a day, the 3 days cost ${money(1500)}.`)
    expect(screen.getAllByText('No schedule yet.').length).toBe(allJobsMoney(laid).jobs.length - 1)
  })

  it('says nothing moved yet when no customer paid and no trade drew, and offers no bill without the window', () => {
    const state = initialGcState()
    const real = { ...state, projects: state.projects.map((p) => ({ ...p, ownerBilling: null, packages: p.packages.map((k) => ({ ...k, sow: null })) })) }
    render(<GcMoney state={real} />)
    expect(screen.getByText(`Nothing paid in or out yet across our ${allJobsMoney(real).jobs.length} jobs.`)).toBeTruthy()
    expect(screen.getByText('Paid in counts once customers pay our bills in the app. Paid out counts once the trades draw in the app.')).toBeTruthy()
    expect(screen.getByText('Nobody owes us right now.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Bill the customer' })).toBeNull()
  })
})
