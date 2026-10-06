// @vitest-environment jsdom
/**
 * Render smoke for "We will be late" in the trade's portal (the Gantt, G-117): the door on the
 * company's own unfinished bars only, the form for work under way and work not started, what the
 * new day does to the work waiting on it, the exact notice sent, and each answer the bar shows.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Dispatch } from 'react'
import { GcPortalLate } from './GcPortalLate'
import { GcPortalSchedule } from './GcPortalSchedule'
import { PortalLangContext } from './gcPortalLang'
import { initialGcState } from '../../lib/gcMode/gcFixture'
import { gcReducer } from '../../lib/gcMode/gcReducer'
import type { GcAction, GcState } from '../../lib/gcMode/gcTypes'

afterEach(cleanup)

const ID = 'fairoaksd'
const TPO = 'froof-1'
const NOTE = 'The membrane ships Oct 12. We finish two days after it lands.'
const job = (s: GcState) => s.projects.find((p) => p.id === ID)!
const summit = (s: GcState) => s.partners.find((p) => p.id === 'summit')!

function bar(state: GcState, lineId: string, dispatch: Dispatch<GcAction> = vi.fn(), lang: 'en' | 'es' = 'en') {
  return render(
    <PortalLangContext.Provider value={lang}>
      <GcPortalLate state={state} project={job(state)} partner={summit(state)} lineId={lineId} dispatch={dispatch} />
    </PortalLangContext.Provider>,
  )
}

const told = () => gcReducer(initialGcState(), { type: 'tradeSayLate', projectId: ID, partnerId: 'summit', lineId: TPO, day: '2026-10-14', reason: 'materials', note: NOTE })

describe('We will be late, on the company’s own chart', () => {
  it('is on each unfinished bar of theirs, and on nobody else’s', () => {
    const state = initialGcState()
    render(
      <PortalLangContext.Provider value="en">
        <GcPortalSchedule state={state} project={job(state)} partner={summit(state)} dispatch={vi.fn()} />
      </PortalLangContext.Provider>,
    )
    // TPO membrane, Sheet metal and flashing, Roof curbs: Insulation is done, Joists and deck and Rooftop units are not theirs.
    expect(screen.getAllByText('We will be late')).toHaveLength(3)
    cleanup()
    expect(bar(state, 'froof-2').container.textContent).toBe('')
    cleanup()
    expect(bar(state, 'fhvac-1').container.textContent).toBe('')
  })

  it('asks for the day it will finish, says what is missing, shows what waits on it, and sends it', () => {
    const state = initialGcState()
    const dispatch = vi.fn()
    bar(state, TPO, dispatch)
    fireEvent.click(screen.getByText('We will be late'))
    expect(screen.getByText('Tell Click the day you will finish.')).toBeTruthy()
    const send = screen.getByText('Send it to Click').closest('button')!
    expect(send.disabled).toBe(true)
    expect(screen.getByText('Pick the day.')).toBeTruthy()
    const day = screen.getByLabelText('The day you will finish')
    fireEvent.change(day, { target: { value: '2026-10-09' } })
    expect(screen.getByText('Pick a day after Fri Oct 9.')).toBeTruthy()
    fireEvent.change(day, { target: { value: '2026-10-14' } })
    expect(screen.getByText('Wed Oct 14. That is 5 days after Fri Oct 9.')).toBeTruthy()
    expect(screen.getByText('Pick why.')).toBeTruthy()
    expect(screen.getByText('What waits on it')).toBeTruthy()
    expect(screen.getByText('Your Sheet metal and flashing would start Thu Oct 15, 3 days later.')).toBeTruthy()
    expect(screen.getByText('Rooftop units by Cool Breeze Mechanical would start Thu Oct 15, 3 days later.')).toBeTruthy()
    fireEvent.click(screen.getByText('Materials'))
    expect(screen.getByText('Say what happened, in a sentence.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Say what happened, in a sentence.'), { target: { value: NOTE } })
    expect(send.disabled).toBe(false)
    expect(screen.getByText('Click decides. Your dates stay as they are until Click moves them.')).toBeTruthy()
    fireEvent.click(send)
    expect(dispatch).toHaveBeenCalledWith({ type: 'tradeSayLate', projectId: ID, partnerId: 'summit', lineId: TPO, day: '2026-10-14', reason: 'materials', note: NOTE })
  })

  it('asks for the day it can start on work not started, and moves it whole', () => {
    bar(initialGcState(), 'froof-4')
    fireEvent.click(screen.getByText('We will be late'))
    expect(screen.getByText('Tell Click the day you can start.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('The day you can start'), { target: { value: '2026-10-07' } })
    expect(screen.getByText('Wed Oct 7. It would finish Sun Oct 11.')).toBeTruthy()
    // Only the final inspection waits on the curbs, and it does not move.
    expect(screen.queryByText('What waits on it')).toBeNull()
  })
})

describe('the bar says where its word stands', () => {
  it('waits on the office, and can be changed', () => {
    const state = told()
    bar(state, TPO)
    expect(screen.getByText('You said Wed Oct 14. Click has not answered yet.')).toBeTruthy()
    fireEvent.click(screen.getByText('Change it'))
    expect((screen.getByLabelText('The day you will finish') as HTMLInputElement).value).toBe('2026-10-14')
    expect(screen.getByText('Materials').getAttribute('aria-pressed')).toBe('true')
    expect((screen.getByLabelText('Say what happened, in a sentence.') as HTMLTextAreaElement).value).toBe(NOTE)
  })

  it('says the office took the day', () => {
    const asked = told()
    const a = job(asked).schedule!.activities.find((x) => x.lineId === TPO)!
    const taken = gcReducer(asked, { type: 'setScheduleActivity', projectId: ID, lineId: TPO, start: a.start, finish: '2026-10-14', after: a.after, why: { reason: 'materials', note: `Summit Roofing told us Fri Oct 2: ${NOTE}`, by: 'Robert' }, lateNoticeId: 'late-1' })
    bar(taken, TPO)
    expect(screen.getByText('Click took your day, Wed Oct 14.')).toBeTruthy()
    expect(screen.getByText('We will be late')).toBeTruthy()
  })

  it('shows a push back with the office’s words, and answers it', () => {
    const pushed = gcReducer(told(), { type: 'pushBackLateNotice', projectId: ID, noticeId: 'late-1', note: 'We need the roof dry by Oct 9.', by: 'Robert' })
    const dispatch = vi.fn()
    bar(pushed, TPO, dispatch)
    expect(screen.getByText('Click needs Fri Oct 9.')).toBeTruthy()
    expect(screen.getByText(/We need the roof dry by Oct 9\./)).toBeTruthy()
    expect(screen.getByText('Robert, Oct 2')).toBeTruthy()
    fireEvent.click(screen.getByText('We will make Fri Oct 9'))
    expect(dispatch).toHaveBeenCalledWith({ type: 'tradeKeepDay', projectId: ID, partnerId: 'summit', noticeId: 'late-1' })
    cleanup()
    bar(gcReducer(pushed, { type: 'tradeKeepDay', projectId: ID, partnerId: 'summit', noticeId: 'late-1' }), TPO)
    expect(screen.getByText('You said you will make Fri Oct 9.')).toBeTruthy()
  })

  it('reads in Spanish', () => {
    bar(initialGcState(), TPO, vi.fn(), 'es')
    fireEvent.click(screen.getByText('Vamos a atrasarnos'))
    expect(screen.getByText('Dígale a Click el día en que va a terminar.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('El día en que va a terminar'), { target: { value: '2026-10-14' } })
    expect(screen.getByText('mié 14 oct. Es decir, 5 días más tarde que el vie 9 oct.')).toBeTruthy()
    expect(screen.getByText('Materiales')).toBeTruthy()
    expect(screen.getByText('Rooftop units de Cool Breeze Mechanical empezaría el jue 15 oct, 3 días después.')).toBeTruthy()
    expect(screen.getByText('Enviarlo a Click')).toBeTruthy()
  })
})
