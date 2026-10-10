/**
 * The trade portal's sample (`gc-trade-portal` for the sample token, What customers see): made-up rows through the same
 * slice builder as a real company's, then the mapper and the portal's kernels, the way the page reads it.
 */
import { describe, expect, it } from 'vitest'
import { parseTradeSubmit } from '../../../supabase/functions/_shared/gcTradeSubmit'
import { TRADE_PORTAL_FIELDS } from '../../../supabase/functions/_shared/gcTradePortalSlice'
import { gcTradePortalSample, SAMPLE_TRADE_IDS, gcTradePortalSampleRows } from '../../../supabase/functions/_shared/gcTradePortalSample'
import { portalAsks, portalBackCharges, portalCanAskChange, portalChangeRequests, portalPlanNews, portalPromiseLine, portalQuestions } from './portal'
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
    expect([...keys].filter((k) => !named.has(k as never) && !['company', 'people', 'invites', 'quotes', 'contacts', 'promises', 'projects', 'project', 'gc', 'team', 'packages', 'scopeItems', 'exclusions', 'sets', 'setItems', 'questions', 'messages', 'setSends', 'sows', 'sowLines', 'backCharges', 'changeRequests', 'changeOrders', 'papers', 'submittals', 'submittalHolds', 'submittalRounds', 'rfis', 'rfiHolds', 'punch', 'draws', 'drawLines', 'lineReports', 'changeSends', 'note', 'mine'].includes(k))).toEqual([])
  })

  it('stays current: its days count from today', () => {
    expect(gcTradePortalSampleRows('2026-11-02').projects[0]?.gc.bid_due).toBe('2026-11-16')
  })

  it('reads as one ask bidding and one it passed on, a new set that changes its trade, its day and its questions', () => {
    expect(portalAsks(state, partnerId).map((a) => [a.project.name, a.kind])).toEqual([
      ['Sample Retail Shell', 'bidding'],
      ['Sample Clinic Finish Out', 'passed'],
      ['Sample Dental Office', 'job'],
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

describe('the sample’s job (P4b-i)', () => {
  const job = state.projects.find((p) => p.id === SAMPLE_TRADE_IDS.job)!
  const pkg = job.packages[0]!

  it('is awarded to the sample company and signed, so it can be charged and can ask for a change', () => {
    expect([pkg.awardedInviteId, pkg.sow?.status, pkg.sow?.price]).toEqual([SAMPLE_TRADE_IDS.jobAsk, 'signed', 48600])
    expect(portalCanAskChange(job, pkg, partnerId)).toBe(true)
  })

  it('carries the job’s work: a report, a paid draw, a punch item, a submittal and an answered question (P5c-1)', () => {
    expect(pkg.sow?.sov.map((l) => [l.pctReported, l.pctBilled])).toEqual([
      [60, 50],
      [0, 0],
    ])
    expect(pkg.sow?.draws.map((d) => [d.id, d.status, d.waiver])).toEqual([[SAMPLE_TRADE_IDS.draw1, 'paid', 'conditional']])
    expect([job.punch?.map((p) => p.id), job.submittals?.map((x) => x.id), job.rfis?.map((r) => [r.id, r.partnerId])]).toEqual([
      [SAMPLE_TRADE_IDS.punch1],
      [SAMPLE_TRADE_IDS.submittal1],
      [[SAMPLE_TRADE_IDS.rfi1, SAMPLE_TRADE_IDS.company]],
    ])
  })

  it('carries its statement of work’s lines, which add up to its price (P2c-ii)', () => {
    expect(pkg.sow?.sov.map((l) => [l.id, l.label, l.amount])).toEqual([
      [SAMPLE_TRADE_IDS.jobLine1, 'Rough-in', 29160],
      [SAMPLE_TRADE_IDS.jobLine2, 'Trim and fixtures', 19440],
    ])
    expect(pkg.sow?.sov.reduce((sum, l) => sum + l.amount, 0)).toBe(pkg.sow?.price)
  })

  it('shows one open charge with its photo, and one change with the customer at the company’s part only', () => {
    expect(portalBackCharges(job, pkg, partnerId, TODAY).map((r) => [r.state, r.canAnswer, r.charge.photo])).toEqual([['open', true, 'https://drive.google.com/file/d/sample-photo']])
    const [row] = portalChangeRequests(job, pkg, partnerId)
    expect(row?.state).toBe('withCustomer')
    expect(row?.words).toContain('$3,400')
    expect(JSON.stringify(slice)).not.toContain('3910')
  })
})

describe('the sample’s papers (B6-b-ii)', () => {
  it('reads its master agreement signed, its W-9 and its certificate, by the board’s rule, and the one trade it won', () => {
    const partner = state.partners.find((p) => p.id === partnerId)!
    expect([partner.msa, partner.msaSignedOn, partner.w9, partner.coiExpires, partner.won]).toEqual(['signed', '2026-08-31', true, '2027-08-31', 1])
    expect(JSON.stringify(slice)).not.toContain('never-passes')
  })
})

describe('a press on the sample (P2b-ii)', () => {
  it('passes the submit function’s shape check, so What customers see’s walk never errors', () => {
    const quote = { amount: 60000, includes: { [SAMPLE_TRADE_IDS.line1]: 'yes', [SAMPLE_TRADE_IDS.line2]: 'yes', [SAMPLE_TRADE_IDS.line3]: 'no' } }
    expect(parseTradeSubmit({ token: 'sample', kind: 'submit_quote', inviteId: SAMPLE_TRADE_IDS.ask, quote }).ok).toBe(true)
    expect(parseTradeSubmit({ token: 'sample', kind: 'ask_question', packageId: SAMPLE_TRADE_IDS.trade, text: 'Q?' }).ok).toBe(true)
    expect(parseTradeSubmit({ token: 'sample', kind: 'remove_person', personId: SAMPLE_TRADE_IDS.person }).ok).toBe(true)
    // The job's presses (P5c-2).
    expect(parseTradeSubmit({ token: 'sample', kind: 'punch_fixed', itemId: SAMPLE_TRADE_IDS.punch1 }).ok).toBe(true)
    expect(parseTradeSubmit({ token: 'sample', kind: 'submittal_send', submittalId: SAMPLE_TRADE_IDS.submittal1, fileName: 'panels.pdf' }).ok).toBe(true)
    expect(parseTradeSubmit({ token: 'sample', kind: 'rfi_ask', packageId: SAMPLE_TRADE_IDS.jobTrade, question: 'Q?', sheets: [] }).ok).toBe(true)
  })
})

