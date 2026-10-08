// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { GcMoney } from './GcMoney'
import { allJobsMoney } from '../../lib/gc/ownerBilling'
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
    expect(screen.getByText('Interest on late bills comes once we bill the customer from the app.')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'Bill the customer' })[0]!)
    expect(onOpenBill).toHaveBeenCalled()
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
