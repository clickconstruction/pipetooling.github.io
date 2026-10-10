/**
 * The portal's job kernels lifted in P5c-3a (to-dos/gc-mode/mockups/portal-p5.md): `portalJobMoney`, `portalPay`,
 * `portalPapers` and `portalTodos` in ./portal.ts, and the schedule's `datesMessage` and `datesNotices` in
 * ./schedule/tellTrades.ts, read directly on main. The spike's own tests play its reducer; these read the sample company's
 * slice through the portal's mapper (`tradePortalState`), the shapes the page hands them.
 */
import { describe, expect, it } from 'vitest'
import { gcTradePortalSample, SAMPLE_TRADE_IDS as ID } from '../../../supabase/functions/_shared/gcTradePortalSample'
import { portalJobMoney, portalPapers, portalPay, portalTodos } from './portal'
import { datesMessage, datesNotices } from './schedule/tellTrades'
import type { ScheduleMove } from './schedule/types'
import { tradePortalState } from './tradePortalState'

const TODAY = '2026-10-08'
const { state, partnerId } = tradePortalState(gcTradePortalSample(TODAY), TODAY)
const job = state.projects.find((p) => p.id === ID.job)!
const pkg = job.packages[0]!

describe('the job’s money, as the company reads it', () => {
  it('reads its price, how far its work is done, what it was paid and what we hold', () => {
    expect(portalJobMoney(pkg)).toEqual({ price: 48600, donePct: 36, paid: 13122, held: 1458, coming: 0, reviewing: 0 })
  })

  it('reads none for a trade with no signed statement of work', () => {
    expect(portalJobMoney({ ...pkg, sow: null })).toBeNull()
  })

  it('reads each draw on its pay page, paid, with nothing left to pay by', () => {
    const pay = portalPay(state, partnerId)
    expect(Object.keys(pay).sort()).toEqual(['jobs', 'rows', 'totals'])
    expect(pay.rows.map((r) => [r.draw.id, r.state, r.payBy])).toEqual([[ID.draw1, 'paid', null]])
  })
})

describe('its papers', () => {
  it('reads its own first, then each job’s: the pay application, its conditional waiver and the statement of work', () => {
    const papers = portalPapers(state, partnerId)
    expect(papers.company.map((p) => p.key)).toEqual(['msa', 'w9', 'coi'])
    expect(papers.jobs.map((j) => [j.trade, j.papers.map((p) => p.key.split(':')[1])])).toEqual([['Electrical', ['app', 'cond', 'sow']]])
  })
})

describe('its to-dos', () => {
  const todos = portalTodos(state, partnerId)
  const kinds = todos.map((t) => t.key.split(':').slice(1, 2)[0])

  it('lists what the job asks of it: the punch item, the submittal, the waiver for the paid draw and the next draw', () => {
    expect(kinds).toEqual(expect.arrayContaining(['punch', 'submittals', 'waiver', 'draw']))
    expect(todos.find((t) => t.key.endsWith(':punch'))?.anchor).toBe(`report:${ID.jobTrade}`)
    expect(todos.find((t) => t.key.includes(':waiver:'))?.text).toBe('Draw 1 on Sample Dental Office is paid. Sign the unconditional waiver.')
  })

  it('lists its bidding work beside it: the charge to answer and the quote to send', () => {
    expect(todos.find((t) => t.key === `${ID.charge}:answer`)?.anchor).toBe(`charges:${ID.jobTrade}`)
    expect(todos.some((t) => t.key === `${ID.ask}:send`)).toBe(true)
  })
})

describe('its dates, when the schedule moved its work (the schedule’s, lifted with P5c-3a)', () => {
  it('reads no notice without a schedule', () => {
    expect(datesNotices(state, partnerId)).toEqual([])
  })

  it('words a move in its language: what moved, why, and what to answer', () => {
    const partner = state.partners[0]!
    const move = { reason: 'weather', note: 'Rain all week' } as unknown as ScheduleMove
    const line = { lineId: 'l1', work: 'Rough-in', from: { start: '2026-10-12', finish: '2026-10-16' }, to: { start: '2026-10-19', finish: '2026-10-23' } }
    const message = datesMessage(job, partner, { partner, moves: [move], lines: [line] }, 'en')
    expect(message.subject).toBe('Your dates moved on Sample Dental Office')
    expect(message.lines[0]).toBe('Hello Dana,')
    expect(message.lines.some((l) => l.startsWith('Rough-in: Oct 19 to Oct 23, not Oct 12 to Oct 16'))).toBe(true)
    expect(message.lines[message.lines.length - 1]).toBe('In your portal, tell us the dates work, or give us another day.')
  })
})
