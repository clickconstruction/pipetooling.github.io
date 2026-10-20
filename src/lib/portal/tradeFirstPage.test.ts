// The trade partner's first page (Messages cut 8c), over the made-up sample company of `gc-trade-portal`: what the edge
// leaves out of its flow rows, the page the flow's kernels read from them, where each press lands, and which of Needs
// you's to-dos leave it.
import { describe, expect, it } from 'vitest'
import { NO_FLOW_EXTRA, tradeFlowRowsOf, type TradeFlowRows } from '../../../supabase/functions/_shared/gcTradeFlow'
import { gcTradePortalSampleFlow, gcTradePortalSampleRows, SAMPLE_TRADE_IDS as ID } from '../../../supabase/functions/_shared/gcTradePortalSample'
import { AWARDED_ELSEWHERE } from '../../../supabase/functions/_shared/gcTradePortalSlice'
import type { PortalPage, PortalPageSection, PortalStepReading } from '../flows/portalPage'
import type { PortalTodo } from '../gc/portal'
import type { PortalPaperId } from './pageWords'
import { parseTradeFlow, todayNoon, tradeFirstPage, tradePagePress, withoutPageTodos } from './tradeFirstPage'

const TODAY = '2026-10-08'
const rows = gcTradePortalSampleRows(TODAY)
const NAMES = Object.fromEntries(rows.projects.map((p) => [String(p.project.id), String(p.project.name)]))
const pageOf = (flow: TradeFlowRows = gcTradePortalSampleFlow(TODAY), lang: 'en' | 'es' = 'en') => tradeFirstPage(flow, NAMES, todayNoon(TODAY), lang)
const lines = (page: PortalPage) => page.sections.map((s) => [s.title, s.rows.map((r) => [r.id, r.kind, r.kind === 'done' ? r.when : r.line])])
const step = (page: PortalPage, title: string, id: string) => page.sections.find((s) => s.title === title)?.rows.find((r) => r.id === id)

describe("the company's flow rows, built at the edge", () => {
  it("leaves the office's words, our people and another company at the edge", () => {
    const flow = tradeFlowRowsOf(
      {
        ...rows,
        invites: [...rows.invites, { id: 'other-ask', package_id: ID.trade, company_id: ID.otherCompany, status: 'bid', invited_on: '2026-10-01', declined_on: null }],
        packages: rows.packages.map((k) => (k.id === ID.trade ? { ...k, carried_invite_id: 'other-ask', awarded_invite_id: 'other-ask', awarded_on: '2026-10-07', awarded_by: 'a-user' } : k)),
        sows: [...(rows.sows ?? []), { id: 'sow-cancelled', package_id: ID.trade, invite_id: ID.ask, company_id: ID.company, status: 'cancelled', sent_on: '2026-10-01', signed_on: null }],
      },
      { ...NO_FLOW_EXTRA, contact: { id: 'contact-1', off_since: '2026-10-07' }, skips: [{ step_key: 'msa', project_id: null, created_at: '2026-10-07T15:00:00Z' }] },
      ID.company,
    )
    expect(flow.contact).toEqual({ id: 'contact-1', kind: 'trade', off_since: '2026-10-07', off_why: null, off_by: null })
    expect(flow.invites.map((i) => i.id)).toEqual([ID.ask, ID.askPassed, ID.jobAsk])
    expect(flow.packages.find((k) => k.id === ID.trade)).toEqual({
      id: ID.trade,
      project_id: ID.project,
      trade: 'Electrical',
      carried_invite_id: AWARDED_ELSEWHERE,
      awarded_invite_id: AWARDED_ELSEWHERE,
      awarded_on: null,
      awarded_by: null,
    })
    expect(flow.packages.find((k) => k.id === ID.jobTrade)).toMatchObject({ carried_invite_id: ID.jobAsk, awarded_invite_id: ID.jobAsk, awarded_on: '2026-09-02', awarded_by: null })
    expect(flow.sows.map((s) => s.id)).toEqual([ID.sow])
    expect(flow.skips).toEqual([{ step_key: 'msa', project_id: null, why: '', by_name: '', created_at: '2026-10-07T15:00:00Z', undone_at: null }])
    expect(flow.tradeMessages).toEqual([{ company_id: ID.company, kind: 'invite', sent_on: '2026-09-30', sent_by: null }])
    expect(flow.projects.map((p) => [p.project_id, p.bid_due, p.our_bid_sent_on, p.closed_on])).toEqual([
      [ID.project, '2026-10-22', null, null],
      [ID.project2, '2026-10-13', null, null],
      [ID.job, '2026-08-24', null, null],
    ])
  })

  it('reads empty where cut 4 is not on prod yet: their Got it stands in for the first visit', () => {
    const noVisit = { ...rows, company: { ...rows.company, portal_opened_on: null } }
    expect(step(pageOf(tradeFlowRowsOf(noVisit, NO_FLOW_EXTRA, ID.company)), 'Getting set up', 'portal')).toEqual({
      id: 'portal',
      name: 'Portal opened',
      kind: 'yours',
      due: null,
      late: false,
      line: 'Your move.',
      button: null,
      button2: null,
      paper: null,
      signs: false,
    })
    const opened = tradeFlowRowsOf(noVisit, { ...NO_FLOW_EXTRA, links: [{ revoked_at: null, first_opened_at: '2026-10-05T14:00:00Z' }] }, ID.company)
    expect(step(pageOf(opened), 'Getting set up', 'portal')).toEqual({ id: 'portal', name: 'Portal opened', kind: 'done', when: 'Mon Oct 5' })
    expect(step(pageOf(tradeFlowRowsOf(rows, NO_FLOW_EXTRA, ID.company)), 'Getting set up', 'portal')).toEqual({ id: 'portal', name: 'Portal opened', kind: 'done', when: 'Fri Oct 2' })
  })

  it("reads the answer's flow, and nothing from an older function", () => {
    const flow = gcTradePortalSampleFlow(TODAY)
    expect(parseTradeFlow(JSON.parse(JSON.stringify(flow)))).toEqual(flow)
    expect(parseTradeFlow(undefined)).toBeNull()
    expect(parseTradeFlow(null)).toBeNull()
    expect(parseTradeFlow({ ...flow, draws: undefined })).toBeNull()
    expect(parseTradeFlow({ ...flow, contact: null })).toBeNull()
  })
})

describe('Where you are with Click Construction, from the sample company', () => {
  it('reads Getting set up, then each job it is asked on; the one it passed on stays off', () => {
    const page = pageOf()
    expect(page.title).toBe('Where you are with Click Construction')
    expect(page.off).toBeNull()
    expect(lines(page)).toEqual([
      [
        'Getting set up',
        [
          ['invited', 'done', 'Wed Sep 30'],
          ['portal', 'done', 'Fri Oct 2'],
          ['papers', 'done', 'Mon Aug 31'],
          ['msa', 'done', 'Mon Aug 31'],
        ],
      ],
      [
        'Sample Retail Shell',
        [
          ['ask', 'yours', 'Per the plans and the addenda.'],
          ['sow', 'later', 'Later. If we carry your quote.'],
          ['draws', 'later', 'Later. Monthly, once you are on site.'],
          ['closeout', 'later', 'Later. At the end of your work.'],
        ],
      ],
      [
        'Sample Dental Office',
        [
          ['ask', 'done', 'Mon Aug 17'],
          ['sow', 'done', 'Sat Sep 5'],
          ['draws', 'yours', 'Send your pay application with its conditional waiver.'],
          ['closeout', 'later', 'Later. At the end of your work.'],
        ],
      ],
    ])
    expect(step(page, 'Sample Retail Shell', 'ask')).toMatchObject({ due: 'due Mon Oct 12', button: 'Enter your quote', button2: 'Open the plans' })
    expect(page.sections.map((s) => [s.lane, s.jobId])).toEqual([
      ['once', null],
      ['perJob', ID.project],
      ['perJob', ID.job],
    ])
    expect(page.questions).toBe('Questions: text or call (512) 360-0599.')
  })

  it('says it in Spanish', () => {
    const page = pageOf(undefined, 'es')
    expect(page.title).toBe('Dónde está con Click Construction')
    expect(page.sections.map((s) => s.title)).toEqual(['Para empezar', 'Sample Retail Shell', 'Sample Dental Office'])
    expect(step(page, 'Sample Retail Shell', 'ask')).toMatchObject({ kind: 'yours', line: 'Según los planos y las adendas.', button: 'Ingrese su cotización' })
  })

  it('thanks a company off the flow first', () => {
    const off = tradeFlowRowsOf(rows, { ...NO_FLOW_EXTRA, contact: { id: 'contact-1', off_since: '2026-10-07' } }, ID.company)
    expect(pageOf(off).off).toBe('Thank you for considering us. If you need us again, text us.')
  })

  it('asks for the certificate that ran out, and opens its Paperwork line', () => {
    const lapsed = { ...rows, papers: (rows.papers ?? []).map((p) => (p.doc_type === 'coi' ? { ...p, expires_at: '2026-10-01' } : p)) }
    const page = pageOf(tradeFlowRowsOf(lapsed, NO_FLOW_EXTRA, ID.company))
    const setUp = page.sections[0] as PortalPageSection
    const papers = step(page, 'Getting set up', 'papers') as PortalStepReading
    expect(papers).toMatchObject({ kind: 'ranOut', paper: 'coi', line: 'Your certificate of insurance ran out. Upload the new one here. A photo of it is fine.' })
    expect(tradePagePress(setUp, papers)).toEqual({ kind: 'paperwork', line: 'coi' })
  })
})

const reading = (id: string, kind: 'yours' | 'onIt' | 'done', paper: PortalPaperId | null = null): PortalStepReading =>
  kind === 'done'
    ? { id, name: id, kind, when: 'Mon Oct 5' }
    : kind === 'onIt'
      ? { id, name: id, kind, line: 'We are on it.' }
      : { id, name: id, kind, due: null, late: false, line: 'Your move.', button: 'Go', button2: null, paper, signs: false }

const PAGE: PortalPage = {
  title: 'Where you are with Click Construction',
  off: null,
  questions: 'Questions: text or call (512) 360-0599.',
  sections: [
    { title: 'Getting set up', lane: 'once', jobId: null, rows: [reading('papers', 'yours', 'w9'), reading('msa', 'yours', 'msa')] },
    { title: 'Boerne', lane: 'perJob', jobId: 'p1', rows: [reading('ask', 'yours', 'quote'), reading('sow', 'yours', 'sow'), reading('draws', 'onIt'), reading('closeout', 'yours', 'final_waiver')] },
    { title: 'Stone Oak', lane: 'perJob', jobId: 'p2', rows: [reading('ask', 'done')] },
  ],
}

describe('where a press lands, and Needs you without what the page carries', () => {
  it('opens the job from a step on it and Paperwork from a paper of its own; a step on us presses nothing', () => {
    const [setUp, boerne] = PAGE.sections as [PortalPageSection, PortalPageSection]
    expect(tradePagePress(boerne, boerne.rows[0] as PortalStepReading)).toEqual({ kind: 'project', projectId: 'p1' })
    expect(tradePagePress(boerne, boerne.rows[2] as PortalStepReading)).toBeNull()
    expect(tradePagePress(setUp, setUp.rows[1] as PortalStepReading)).toEqual({ kind: 'paperwork', line: 'msa' })
  })

  it('drops a to-do only while the page shows its step as theirs, and keeps everything the flow has no step for', () => {
    const todo = (key: string, projectId: string | null = null): PortalTodo => ({ key, projectId, text: key, tone: 'amber', by: null })
    const todos = [
      todo('w9'),
      todo('coi'),
      todo('msa'),
      todo('coi:soon'),
      todo('vet'),
      todo('ask1:send', 'p1'),
      todo('ask2:late', 'p2'),
      todo('p1:lookahead:late', 'p1'),
      todo('ask1:sow', 'p1'),
      todo('ask1:draw', 'p1'),
      todo('ask1:final', 'p1'),
      todo('ask1:finalwaiver', 'p1'),
      todo('ask1:waiver:draw1', 'p1'),
      todo('dates:move1', 'p1'),
    ]
    expect(withoutPageTodos(todos, PAGE).map((t) => t.key)).toEqual([
      'coi',
      'coi:soon',
      'vet',
      'ask2:late',
      'p1:lookahead:late',
      'ask1:draw',
      'ask1:final',
      'ask1:waiver:draw1',
      'dates:move1',
    ])
  })
})
