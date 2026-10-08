/**
 * The trade portal's sample (`gc-trade-portal` for the sample token, What customers see): made-up rows through the same
 * slice builder as a real company's, then the mapper and the portal's kernels, the way the page reads it.
 */
import { describe, expect, it } from 'vitest'
import { TRADE_PORTAL_FIELDS } from '../../../supabase/functions/_shared/gcTradePortalSlice'
import { gcTradePortalSample, gcTradePortalSampleRows } from '../../../supabase/functions/_shared/gcTradePortalSample'
import { portalAsks, portalPlanNews, portalPromiseLine, portalQuestions } from './portal'
import { tradePortalState } from './tradePortalState'

const TODAY = '2026-10-08'
const slice = gcTradePortalSample(TODAY)
const { state, partnerId } = tradePortalState(slice, TODAY)

describe('the trade portal’s sample', () => {
  it('is one made-up company, through the same field list as a real one', () => {
    expect([slice.company.name, slice.people.map((p) => p.name)]).toEqual(['Sample Electric Co.', ['Marcus Lee']])
    const named = new Set(Object.values(TRADE_PORTAL_FIELDS).flat())
    const keys = new Set<string>()
    const walk = (v: unknown) => {
      if (Array.isArray(v)) v.forEach(walk)
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { keys.add(k); if (k !== 'lines' && k !== 'includes') walk(x) }
    }
    walk(slice)
    expect([...keys].filter((k) => !named.has(k as never) && !['company', 'people', 'invites', 'quotes', 'contacts', 'promises', 'projects', 'project', 'gc', 'team', 'packages', 'scopeItems', 'exclusions', 'sets', 'setItems', 'questions', 'messages', 'setSends', 'note', 'mine'].includes(k))).toEqual([])
  })

  it('stays current: its days count from today', () => {
    expect(gcTradePortalSampleRows('2026-11-02').projects[0]?.gc.bid_due).toBe('2026-11-16')
  })

  it('reads as one ask bidding and one it passed on, a new set that changes its trade, its day and its questions', () => {
    expect(portalAsks(state, partnerId).map((a) => [a.project.name, a.kind])).toEqual([
      ['Sample Retail Shell', 'bidding'],
      ['Sample Clinic Finish Out', 'passed'],
    ])
    const project = state.projects[0]!
    const pkg = project.packages[0]!
    const invite = pkg.invites[0]!
    expect(portalPlanNews(project, pkg, invite).forTrade.map((s) => s.label)).toEqual(['Addendum 1'])
    expect(portalPromiseLine(invite, TODAY, 'Click')?.late).toBe(false)
    expect(portalQuestions(project, pkg.id, partnerId).map((r) => [r.mine, r.state])).toEqual([
      [true, 'asked'],
      [false, 'answered'],
    ])
  })
})
