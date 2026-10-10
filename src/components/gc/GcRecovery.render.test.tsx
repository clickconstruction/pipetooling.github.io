// @vitest-environment jsdom
/**
 * The schedule's PR 9d: days back on a late job (G-82) on main's test state, ported from the prototype's test. The Days
 * back card on a late job, with Call only (the Follow up sheet is the Board's and not here yet); the window a recovery
 * is saved from, Getting days back pressed, saved as one move through the one save with its line in the log.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { GcDaysBack, GcRecoveryWindow } from './GcRecovery'
import { addDays } from '../../lib/gc/building'
import { lateFinish } from '../../lib/gc/lateFinish'
import { planMove } from '../../lib/gc/schedule/moves'
import { CREW_RULE, recoveryOffers } from '../../lib/gc/schedule/recovery'
import { scheduleMeasures } from '../../lib/gc/schedule/schedule'
import { initialGcState } from '../../lib/gc/schedule/testState'
import type { GcState } from '../../lib/gc/types'
import { plainWordsFailures } from '../../lib/plainWords'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()
afterEach(cleanup)

const ID = 'fairoaksd'
const job = (s: GcState) => s.projects.find((p) => p.id === ID)!

/** A bar moved later by `days`, what waits on it pushed as a move pushes it. */
function moveBy(s: GcState, label: string, days: number): GcState {
  const a = scheduleMeasures(s, job(s)).items.find((i) => i.label === label)!.activity
  const plan = planMove(job(s), a.lineId, addDays(a.start, days), addDays(a.finish, days))!
  return { ...s, projects: s.projects.map((p) => (p.id === ID && p.schedule ? { ...p, schedule: { ...p.schedule, activities: plan.activities } } : p)) }
}

/** The prototype's late job: Trim a week out, Test and balance nine days: the finish 4 days past its date to meet. */
const lateJob = () => moveBy(moveBy(initialGcState(), 'Trim', 7), 'Test and balance', 9)

describe('GcDaysBack: the card on a late job', () => {
  it('lists each way to bring the finish in, with Call and no Follow up', () => {
    const s = lateJob()
    expect(lateFinish(s, job(s)).late).toBe(4)
    const offers = recoveryOffers(s, job(s))
    const onLook = vi.fn()
    const { container } = render(<GcDaysBack state={s} project={job(s)} offers={offers} onLook={onLook} />)
    const card = within(container.querySelector('[data-days-back]') as HTMLElement)
    expect(card.getByText('1 way to bring the finish in. Each stands alone: save one and the list reads again.')).toBeTruthy()
    expect(card.getByText('A second crew on Test and balance.')).toBeTruthy()
    expect(card.getByText('1 day back')).toBeTruthy()
    expect(card.getByText(`It would finish Sat Dec 12, not Sun Dec 13. ${CREW_RULE}`)).toBeTruthy()
    expect(card.getByText('Cool Breeze Mechanical has to agree: Andre Wallace.')).toBeTruthy()
    expect(card.getByText('Call Andre').getAttribute('href')).toMatch(/^tel:/)
    expect(card.queryByRole('button', { name: 'Follow up' })).toBeNull()
    fireEvent.click(card.getByRole('button', { name: 'Look at it' }))
    expect(onLook).toHaveBeenCalledWith('crew:fhvac-4')
  })

  it('says why when nothing on the red chain can come in', () => {
    const s = lateJob()
    render(<GcDaysBack state={s} project={job(s)} offers={[]} onLook={vi.fn()} />)
    expect(screen.getByText(/^Nothing on the red chain can come in yet\./)).toBeTruthy()
  })
})

describe('GcRecoveryWindow: the window a recovery is saved from', () => {
  it('shows the move in full, Getting days back pressed, and saves it through the one save with its line in the log', async () => {
    const s = lateJob()
    const onSave = vi.fn(() => Promise.resolve('db-9'))
    const onClose = vi.fn()
    render(<GcRecoveryWindow state={s} project={job(s)} offerKey="crew:fhvac-4" by="Rosa" onSave={onSave} onReload={vi.fn()} onClose={onClose} />)
    const dialog = screen.getByRole('dialog', { name: 'Get days back' })
    expect(within(dialog).getByText('Comes in behind it')).toBeTruthy()
    expect(within(dialog).getByText('The finish: Tue Dec 15 → Mon Dec 14.')).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Getting days back' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(dialog).getByText('Cool Breeze Mechanical has to agree: Andre Wallace. Ask them before you save it.')).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save the move' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    const [move, , words] = onSave.mock.calls[0] as unknown as [{ lineId: string; reason: string; note: string; recovery?: { how: string } }, unknown, string]
    expect(move).toMatchObject({ lineId: 'fhvac-4', reason: 'recovery', note: 'A second crew on Test and balance, to finish it Sat Dec 12.', recovery: { how: 'crew' } })
    expect(words).toBe('Rosa got 1 day back on Fair Oaks Shops, Building D. A second crew on Test and balance.')
  })

  it('shows nothing for an offer the schedule no longer has', () => {
    const s = initialGcState()
    const { container } = render(<GcRecoveryWindow state={s} project={job(s)} offerKey="crew:fhvac-4" by="Rosa" onSave={vi.fn()} onReload={vi.fn()} onClose={vi.fn()} />)
    expect(container.textContent).toBe('')
  })

  it('says each thing a first-timer reads in plain words', () => {
    const said = [
      '1 way to bring the finish in. Each stands alone: save one and the list reads again.',
      '2 ways to bring the finish in. Each stands alone: save one and the list reads again.',
      'Saved as one move by Rosa, today. Undo puts every date back.',
      'Cool Breeze Mechanical has to agree: Andre Wallace. Ask them before you save it.',
      'Your move was not saved. The chart shows the new dates now. Look at it again on them.',
    ]
    for (const words of said) expect(plainWordsFailures(words), words).toEqual([])
  })
})
