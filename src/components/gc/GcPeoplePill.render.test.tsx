// @vitest-environment jsdom
/**
 * Who to call on a board row (the Board's B2b-ii), from the design spike's `GcCounts.render.test.tsx`: the card carries
 * Pecan Valley Electric's schedule reasons and what Cibolo owes, grouped, and **Open Follow up** opens Follow up. Follow up
 * and Work the list come with the Follow up sheet (B2b-viii), so Call only dials here.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { GcPeoplePill } from './GcPeoplePill'
import { projectPeople } from '../../lib/gc/projectPeople'
import { initialGcState } from '../../lib/gc/schedule/testState'
import type { GcState } from '../../lib/gc/types'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()
afterEach(cleanup)

const ID = 'fairoaksd'
const job = (s: GcState) => s.projects.find((p) => p.id === ID)!
const s0 = initialGcState()

function card(onOpenFollowUp = vi.fn()) {
  render(<GcPeoplePill summary={projectPeople(s0, job(s0))} projectName="Fair Oaks Shops, Building D" onWorkList={null} onOpenFollowUp={onOpenFollowUp} />)
  fireEvent.click(screen.getByRole('button', { name: /Show who and why\./ }))
  return { onOpenFollowUp, dialog: screen.getByRole('dialog', { name: 'Who to call on Fair Oaks Shops, Building D' }) }
}
const groupsOf = (dialog: HTMLElement, company: string) => {
  const row = [...dialog.querySelectorAll('strong')].find((el) => el.textContent === company || el.parentElement?.textContent?.includes(company))!.closest('[style*="grid-template-columns"]')!
  return [...row.querySelectorAll('[data-gc-reason-group]')].map((g) => [g.getAttribute('data-gc-reason-group'), g.firstElementChild?.textContent])
}

describe('Who to call on a board row', () => {
  it('counts the job’s people and says Pecan Valley’s insurance at work and the bars that wait on it', () => {
    const { dialog } = card()
    expect(screen.getByRole('button', { name: /^6 to call/ })).toBeTruthy()
    expect(within(dialog).getByText('Their insurance ran out Tue Sep 15. Nothing they do for us is covered. They are at work on Panels and feeders, and Lighting.')).toBeTruthy()
    expect(within(dialog).getByText('Site lighting and Fire alarm wait on current insurance. Site lighting starts Mon Oct 19.')).toBeTruthy()
  })

  it('groups each person’s reasons: Pecan Valley both, Summit the schedule, Cibolo what it owes', () => {
    const { dialog } = card()
    expect(groupsOf(dialog, 'Pecan Valley Electric')).toEqual([
      ['schedule', 'On the schedule'],
      ['owed', 'Owed to us'],
    ])
    expect(groupsOf(dialog, 'Summit Roofing')).toEqual([['schedule', 'On the schedule']])
    expect(groupsOf(dialog, 'Cibolo Creek Partners')).toEqual([['owed', 'Owed to us']])
  })

  it('has no Work the list or Follow up yet, and Open Follow up opens Follow up', () => {
    const { dialog, onOpenFollowUp } = card()
    expect(within(dialog).queryByRole('button', { name: 'Work the list' })).toBeNull()
    expect(within(dialog).queryByRole('button', { name: /^Follow up$/ })).toBeNull()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Open Follow up' }))
    expect(onOpenFollowUp).toHaveBeenCalledTimes(1)
  })

  it('says nobody to chase on a job with no one to call', () => {
    const quiet = s0.projects.find((p) => projectPeople(s0, p).count === 0)!
    render(<GcPeoplePill summary={projectPeople(s0, quiet)} projectName={quiet.name} onWorkList={null} onOpenFollowUp={() => undefined} />)
    expect(screen.getByText('Nobody to chase')).toBeTruthy()
  })
})
