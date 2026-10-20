// @vitest-environment jsdom
/**
 * GC mode, the real build, the schedule's PR 14c: our superintendent's "To verify" on main's test state. Fair Oaks D,
 * today Fri Oct 2, with four trade marks waiting for the week of Sep 28 and the electrical service inspection due. A
 * mark checked as it stands, a "done" corrected to not done with why, a "not done" corrected to done, our own crew's
 * mark, and an inspection passed; a refusal shows under its line.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { GcVerifyCard } from './GcVerifyCard'
import { scheduleMeasures } from '../../lib/gc/schedule/schedule'
import { initialGcState } from '../../lib/gc/schedule/testState'
import type { LookAheadMark } from '../../lib/gc/schedule/types'
import type { GcProject } from '../../lib/gc/types'

afterEach(cleanup)

const s = initialGcState()
const fairOaks = s.projects.find((p) => p.id === 'fairoaksd')!
const rowsOf = (p: GcProject) => scheduleMeasures(s, p).rows
const line = (lineId: string) => document.querySelector(`[data-verify-line="${lineId}"]`) as HTMLElement
/** The trade's mark waiting on our superintendent, the week of Sep 28. */
const mark = (lineId: string) => fairOaks.schedule!.lookAhead.find((m) => m.lineId === lineId && !m.verifiedOn)!

function card(project: GcProject = fairOaks, presses: { onVerify?: (m: LookAheadMark) => Promise<void>; onCrewMark?: (m: LookAheadMark) => Promise<void>; onPass?: (lineId: string) => Promise<void> } = {}) {
  const onVerify = vi.fn(presses.onVerify ?? (() => Promise.resolve()))
  const onCrewMark = vi.fn(presses.onCrewMark ?? (() => Promise.resolve()))
  const onPass = vi.fn(presses.onPass ?? (() => Promise.resolve()))
  render(<GcVerifyCard project={project} rows={rowsOf(project)} today={s.today} onVerify={onVerify} onCrewMark={onCrewMark} onPass={onPass} onFail={vi.fn()} />)
  return { onVerify, onCrewMark, onPass }
}

describe('To verify (PR 14c)', () => {
  it('counts the marks and the inspection, and says what each trade said against its plan', () => {
    card()
    expect(screen.getByText('4 marks')).toBeTruthy()
    expect(screen.getByText('1 inspection')).toBeTruthy()
    expect(line('froof-1').textContent).toContain('Roofing · TPO membrane · Summit Roofing · week of Sep 28')
    expect(line('froof-1').textContent).toContain('They say done. Reported 50%, planned 100% by today.')
    expect(line('fsteel-3').textContent).toContain('They say not done: crew.')
  })

  it('checks a mark as it stands, today', async () => {
    const { onVerify } = card()
    fireEvent.click(within(line('froof-1')).getByRole('button', { name: 'Right, done' }))
    await waitFor(() => expect(onVerify).toHaveBeenCalledWith({ ...mark('froof-1'), verifiedOn: s.today }))
  })

  it('corrects a “done” to not done with why, and a “not done” to done', async () => {
    const { onVerify } = card()
    fireEvent.change(within(line('froof-1')).getByRole('combobox', { name: 'Why not, TPO membrane' }), { target: { value: 'weather' } })
    fireEvent.click(within(line('froof-1')).getByRole('button', { name: 'Not done' }))
    await waitFor(() => expect(onVerify).toHaveBeenCalledWith({ ...mark('froof-1'), verifiedOn: s.today, verifiedDone: false, verifiedReason: 'weather' }))
    fireEvent.click(within(line('fsteel-3')).getByRole('button', { name: 'It is done' }))
    await waitFor(() => expect(onVerify).toHaveBeenLastCalledWith({ ...mark('fsteel-3'), verifiedOn: s.today, verifiedDone: true }))
  })

  it('marks our own crew’s work this week, checked as it is made', async () => {
    // Our plumbing crew's marks for this week taken off, so its work waits on us.
    const plumbing = new Set(fairOaks.schedule!.activities.filter((a) => a.packageId === 'fplumb').map((a) => a.lineId))
    const ours: GcProject = { ...fairOaks, schedule: { ...fairOaks.schedule!, lookAhead: fairOaks.schedule!.lookAhead.filter((m) => !plumbing.has(m.lineId)) } }
    const { onCrewMark } = card(ours)
    const first = [...document.querySelectorAll<HTMLElement>('[data-verify-line]')].find((el) => el.textContent?.includes('Our own crew. Mark it yourself.'))!
    expect(first).toBeTruthy()
    const lineId = first.getAttribute('data-verify-line')!
    expect(plumbing.has(lineId)).toBe(true)
    fireEvent.click(within(first).getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(onCrewMark).toHaveBeenCalledWith({ weekOf: '2026-09-28', lineId, packageId: 'fplumb', done: true, markedOn: s.today, verifiedOn: s.today }))
  })

  it('passes an inspection due this week through the bar form’s own check', async () => {
    const { onPass } = card()
    const insp = document.querySelector('[data-verify-inspection="fairoaksd-insp-service"]') as HTMLElement
    expect(insp.textContent).toContain('Electrical service inspection · The city · planned Oct 2 to Oct 2')
    fireEvent.click(within(insp).getByRole('button', { name: 'It passed today' }))
    await waitFor(() => expect(onPass).toHaveBeenCalledWith('fairoaksd-insp-service'))
  })

  it('shows a refusal under its line', async () => {
    card(fairOaks, { onVerify: () => Promise.reject(new Error('That mark was checked already. Reload the schedule to see it.')) })
    fireEvent.click(within(line('froof-1')).getByRole('button', { name: 'Right, done' }))
    expect((await within(line('froof-1')).findByRole('alert')).textContent).toBe('That mark was checked already. Reload the schedule to see it.')
  })

  it('says nothing waits when every mark is checked and no inspection is due', () => {
    const quiet: GcProject = {
      ...fairOaks,
      schedule: {
        ...fairOaks.schedule!,
        lookAhead: fairOaks.schedule!.lookAhead.map((m) => ({ ...m, verifiedOn: s.today })),
        activities: fairOaks.schedule!.activities.map((a) => (a.inspection ? { ...a, inspection: { ...a.inspection, passedOn: s.today } } : a)),
      },
    }
    card(quiet)
    expect(document.querySelector('[data-verify-card]')!.textContent).toBe('To verify · nothing waits on our superintendent.')
  })
})
