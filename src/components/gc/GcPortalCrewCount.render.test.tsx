// @vitest-environment jsdom
/**
 * Render smoke for a trade's own crew count in its portal (G-142): a line under each coming week of
 * Your next three weeks, the exact count sent, what it says once sent, the 0 to 50 rule, a company
 * with two trades on one job, and Spanish.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Dispatch } from 'react'
import { GcPortalLookAhead } from './GcPortalLookAhead'
import { GcMorningList } from './GcMorningList'
import { PortalLangContext } from './gcPortalLang'
import { initialGcState } from '../../lib/gcMode/gcFixture'
import { gcReducer } from '../../lib/gcMode/gcReducer'
import type { GcAction, GcState } from '../../lib/gcMode/gcTypes'

afterEach(cleanup)

const ID = 'fairoaksd'
const job = (s: GcState) => s.projects.find((p) => p.id === ID)!
const summit = (s: GcState) => s.partners.find((p) => p.id === 'summit')!

function lookAhead(state: GcState, dispatch: Dispatch<GcAction> = vi.fn(), lang: 'en' | 'es' = 'en') {
  return render(
    <PortalLangContext.Provider value={lang}>
      <GcPortalLookAhead state={state} project={job(state)} partner={summit(state)} dispatch={dispatch} />
    </PortalLangContext.Provider>,
  )
}

describe('People a day on site, in Your next three weeks', () => {
  it('asks under each coming week, and sends the count', () => {
    const dispatch = vi.fn()
    const { container } = lookAhead(initialGcState(), dispatch)
    expect(screen.getAllByText('People a day on site')).toHaveLength(3)
    expect([...container.querySelectorAll('[data-portal-crew]')].map((n) => n.getAttribute('data-portal-crew'))).toEqual(['2026-09-28', '2026-10-05', '2026-10-12'])
    const first = container.querySelector('[data-portal-crew="2026-09-28"]')!
    const send = [...first.querySelectorAll('button')].find((b) => b.textContent === 'Tell Click')!
    expect(send.disabled).toBe(true)
    fireEvent.change(first.querySelector('input')!, { target: { value: '4' } })
    expect(send.disabled).toBe(false)
    fireEvent.click(send)
    expect(dispatch).toHaveBeenCalledWith({ type: 'tradeSetCrewCount', projectId: ID, partnerId: 'summit', packageId: 'froof', weekOf: '2026-09-28', count: 4 })
  })

  it('says what they said, and opens it again to change', () => {
    const state = gcReducer(initialGcState(), { type: 'tradeSetCrewCount', projectId: ID, partnerId: 'summit', packageId: 'froof', weekOf: '2026-09-28', count: 4 })
    const { container } = lookAhead(state)
    expect(screen.getByText('You said 4 a day.')).toBeTruthy()
    fireEvent.click(screen.getByText('Change it'))
    expect((container.querySelector('[data-portal-crew="2026-09-28"] input') as HTMLInputElement).value).toBe('4')
    cleanup()
    lookAhead(gcReducer(initialGcState(), { type: 'tradeSetCrewCount', projectId: ID, partnerId: 'summit', packageId: 'froof', weekOf: '2026-09-28', count: 0 }))
    expect(screen.getByText('You said nobody.')).toBeTruthy()
  })

  it('takes only a whole number from 0 to 50', () => {
    const { container } = lookAhead(initialGcState())
    const first = container.querySelector('[data-portal-crew="2026-09-28"]')!
    const send = [...first.querySelectorAll('button')].find((b) => b.textContent === 'Tell Click')!
    for (const bad of ['51', '3.5', '-1']) {
      fireEvent.change(first.querySelector('input')!, { target: { value: bad } })
      expect(send.disabled).toBe(true)
      expect(screen.getByText('A whole number, 0 to 50.')).toBeTruthy()
    }
  })

  it('names the trade when a company has two on the job', () => {
    // Give Summit the HVAC trade too: this week it has the membrane and the ductwork.
    const base = initialGcState()
    const state: GcState = {
      ...base,
      projects: base.projects.map((p) =>
        p.id !== ID ? p : { ...p, packages: p.packages.map((k) => (k.id !== 'fhvac' ? k : { ...k, invites: k.invites.map((i) => (i.id === k.awardedInviteId ? { ...i, partnerId: 'summit' } : i)) })) },
      ),
    }
    const { container } = lookAhead(state)
    const first = container.querySelector('[data-portal-crew="2026-09-28"]')!
    expect(first.textContent).toContain('Roofing: people a day on site')
    expect(first.textContent).toContain('HVAC: people a day on site')
  })

  it('reads in Spanish', () => {
    lookAhead(initialGcState(), vi.fn(), 'es')
    expect(screen.getAllByText('Personas al día en la obra')).toHaveLength(3)
    expect(screen.getAllByText('Avisar a Click')).toHaveLength(3)
  })
})

describe('the morning list, once a trade has said', () => {
  it('reads Pecan Valley’s 2 on the log against the 4 it said, in amber', () => {
    let state = gcReducer(initialGcState(), { type: 'tradeSetCrewCount', projectId: ID, partnerId: 'pecanvalley', packageId: 'felec', weekOf: '2026-09-28', count: 4 })
    // Today's log written with Pecan Valley at 2, the rest as Thursday's.
    state = {
      ...state,
      projects: state.projects.map((p) => {
        if (p.id !== ID) return p
        const thursday = (p.dailyLogs ?? []).find((l) => l.date === '2026-10-01')!
        const today = { ...thursday, date: '2026-10-02', writtenOn: '2026-10-02', crews: thursday.crews.map((c) => (c.packageId === 'felec' ? { ...c, workers: 2 } : c)) }
        return { ...p, dailyLogs: [...(p.dailyLogs ?? []), today] }
      }),
    }
    render(<GcMorningList state={state} project={job(state)} day={state.today} onDay={vi.fn()} />)
    const line = screen.getByText("On today's log with 2 of the 4 they said.")
    expect((line as HTMLElement).style.color).toBe('var(--text-amber-800)')
  })
})

