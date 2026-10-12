import { describe, expect, it } from 'vitest'
import { companyPapers, type CompanyPaperRow } from '../gc/companyPapers'
import { FLOW_FIXTURE_NOW as NOW, flowFixture } from './flowFixtures'
import type { FlowRows, ProjectRow } from './load'
import {
  askRounds,
  changeOrderRounds,
  finalWaiverStamps,
  flowStampsFor,
  offOf,
  packageStamps,
  paperStamps,
  portalStamps,
  projectStamps,
  questionRounds,
  questionsCloseOn,
  skipsOf,
  waitsOf,
} from './load'
import { SEED_FLOWS } from './seed'
import type { FlowReading } from './state'
import { readFlow } from './state'

const contact = (id: string, kind: FlowRows['contact']['kind']): FlowRows['contact'] => ({ id, kind, off_since: null, off_why: null, off_by: null })
const paper = (p: Partial<CompanyPaperRow> & Pick<CompanyPaperRow, 'doc_type' | 'status'>): CompanyPaperRow => ({
  id: `${p.doc_type}-${p.status}-${p.signed_at ?? p.sent_at ?? ''}`,
  company_id: 'hillside',
  sent_at: null,
  signed_at: null,
  expires_at: null,
  created_at: '2026-09-01T15:00:00Z',
  ...p,
})
const project = (p: Partial<ProjectRow> & Pick<ProjectRow, 'project_id'>): ProjectRow => ({
  stage: 'bidding',
  created_at: '2026-08-01T15:00:00Z',
  bid_due: null,
  our_bid_sent_on: null,
  won_on: null,
  lost_on: null,
  owner_contract_sent_on: null,
  owner_contract_signed_on: null,
  started_on: null,
  closed_on: null,
  owner_pay_days: null,
  ...p,
})
const NAMES = { 'u-rosa': 'Rosa', 'u-robert': 'Robert' }

/** Each lane's steps as "step:state since→due late waiting lapsed", keyed by lane and job, with the person's step on now. */
const shape = (r: FlowReading) => ({
  now: `${r.nowStepId}@${r.nowJobId}`,
  lanes: Object.fromEntries(
    r.lanes.map((l) => [
      `${l.lane}@${l.jobId ?? '-'}`,
      `head ${l.headStepId} · ` +
        l.steps
          .map((s) => `${s.stepId}:${s.state} ${s.since ?? '-'}→${s.due ?? '-'} ${s.lateDays ?? '-'} ${s.waitingOn ? `${s.waitingOn.contactId}/${s.waitingOn.stepId}/${s.waitingOn.since}` : '-'} ${s.lapsedPaper ?? '-'}`)
          .join(', '),
    ]),
  ),
})

// ---------- the prototype's people as main's rows ----------

const GREG: FlowRows = {
  contact: contact('greg', 'trade'),
  contactJobs: [
    { project_id: 'boerne', is_default: true },
    { project_id: 'padb', is_default: false },
  ],
  userNames: NAMES,
  company: { id: 'hillside', portal_opened_on: '2026-09-09' },
  tradeMessages: [{ company_id: 'hillside', kind: 'invite', sent_on: '2026-09-08', sent_by: 'u-rosa' }],
  papers: [
    paper({ doc_type: 'w9', status: 'signed', signed_at: '2026-09-12' }),
    paper({ doc_type: 'coi', status: 'signed', signed_at: '2025-09-30', expires_at: '2026-09-30' }),
    paper({ doc_type: 'agreement', status: 'signed', signed_at: '2026-09-14', sent_at: '2026-09-10T15:00:00Z' }),
  ],
  projects: [
    project({ project_id: 'boerne', bid_due: '2026-10-08', created_at: '2026-08-20T15:00:00Z' }),
    project({ project_id: 'padb', bid_due: '2026-10-22', created_at: '2026-09-01T15:00:00Z' }),
    project({ project_id: 'stoneoak', stage: 'building', created_at: '2026-07-01T15:00:00Z' }),
  ],
  packages: [
    { id: 'pk-boerne-site', project_id: 'boerne', trade: 'Sitework', carried_invite_id: null, awarded_invite_id: null, awarded_on: null, awarded_by: null },
    { id: 'pk-stone-site', project_id: 'stoneoak', trade: 'Sitework', carried_invite_id: 'inv-greg-stone', awarded_invite_id: 'inv-greg-stone', awarded_on: '2026-09-14', awarded_by: 'u-robert' },
  ],
  invites: [
    { id: 'inv-greg-boerne', company_id: 'hillside', package_id: 'pk-boerne-site', invited_on: '2026-09-22', status: 'opened', lost_on: null },
    { id: 'inv-greg-stone', company_id: 'hillside', package_id: 'pk-stone-site', invited_on: '2026-09-08', status: 'bid', lost_on: null },
  ],
  quotes: [{ invite_id: 'inv-greg-stone', submitted_on: '2026-09-11', created_at: '2026-09-11T20:00:00Z' }],
  askLines: [
    { invite_id: 'inv-greg-boerne', promised_by: null, contacted_on: '2026-09-22', created_at: '2026-09-22T15:00:00Z' },
    { invite_id: 'inv-greg-boerne', promised_by: '2026-09-30', contacted_on: '2026-09-26', created_at: '2026-09-26T15:00:00Z' },
  ],
  sows: [{ id: 'sow-greg-stone', invite_id: 'inv-greg-stone', package_id: 'pk-stone-site', sent_on: '2026-09-15', signed_on: '2026-09-18' }],
  draws: [
    { id: 'draw-1', sow_id: 'sow-greg-stone', number: 1, requested_on: '2026-09-25', approved_on: '2026-09-27', paid_on: '2026-09-30', final: false, waiver: 'conditional', waiver_on: null },
    { id: 'draw-2', sow_id: 'sow-greg-stone', number: 2, requested_on: '2026-10-01', approved_on: null, paid_on: null, final: false, waiver: 'conditional', waiver_on: null },
  ],
}

const ELENA: FlowRows = {
  contact: contact('elena', 'customer'),
  contactJobs: [
    { project_id: 'boerne', is_default: true },
    { project_id: 'padb', is_default: false },
    { project_id: 'fairoaks', is_default: false },
    { project_id: 'stoneoak', is_default: false },
  ],
  userNames: NAMES,
  papers: [paper({ company_id: null, doc_type: 'agreement', status: 'signed', signed_at: '2026-08-04' })],
  projects: [
    project({
      project_id: 'boerne',
      stage: 'building',
      created_at: '2026-08-11T15:00:00Z',
      our_bid_sent_on: '2026-08-20',
      won_on: '2026-08-28',
      owner_contract_sent_on: '2026-08-29',
      owner_contract_signed_on: '2026-09-02',
      started_on: '2026-09-14',
      owner_pay_days: 32,
    }),
  ],
  scheduleSends: [{ project_id: 'boerne', sent_on: '2026-09-08', sent_by: 'u-rosa' }],
  payApps: [
    { id: 'payapp-3', project_id: 'boerne', number: 3, sent_on: '2026-08-28', certified_on: '2026-09-02', paid_on: '2026-09-25' },
    { id: 'payapp-4', project_id: 'boerne', number: 4, sent_on: '2026-09-28', certified_on: null, paid_on: null },
  ],
  changeOrders: [
    { id: 'co-1', project_id: 'boerne', number: 1, description: '', status: 'signed', sent_on: '2026-09-10', answered_on: '2026-09-12' },
    { id: 'co-2', project_id: 'boerne', number: 2, description: '', status: 'signed', sent_on: '2026-09-16', answered_on: '2026-09-18' },
    { id: 'co-3', project_id: 'boerne', number: 3, description: 'A drinking fountain', status: 'draft', sent_on: null, answered_on: null },
  ],
  architectByProject: { boerne: 'jonah' },
}

const JONAH: FlowRows = {
  contact: contact('jonah', 'arch'),
  contactJobs: [
    { project_id: 'boerne', is_default: true },
    { project_id: 'padb', is_default: false },
  ],
  projects: [project({ project_id: 'boerne', stage: 'bidding', bid_due: '2026-10-08', created_at: '2026-08-11T15:00:00Z' })],
  planSets: [
    { id: 'set-bid', project_id: 'boerne', kind: 'bid', label: 'Issued for bid', issued_on: '2026-09-15' },
    { id: 'add-1', project_id: 'boerne', kind: 'addendum', label: 'Addendum 1', issued_on: '2026-09-24' },
    { id: 'add-2', project_id: 'boerne', kind: 'addendum', label: 'Addendum 2', issued_on: '2026-10-02' },
  ],
  planSetSends: [{ set_id: 'add-1', sent_at: '2026-09-25T16:00:00Z' }],
  planQuestions: [
    { id: 'q-panel', project_id: 'boerne', text: 'Panel size', sent_to_architect_on: '2026-09-16', answered_on: '2026-09-18' },
    { id: 'q-curbs', project_id: 'boerne', text: 'Roof curbs', sent_to_architect_on: '2026-09-21', answered_on: '2026-09-23' },
    { id: 'q-pond', project_id: 'boerne', text: 'Pond', sent_to_architect_on: '2026-10-02', answered_on: null },
    { id: 'q-held', project_id: 'boerne', text: 'Still with us', sent_to_architect_on: null, answered_on: null },
  ],
  payApps: [
    { id: 'payapp-3', project_id: 'boerne', number: 3, sent_on: '2026-08-28', certified_on: '2026-09-02', paid_on: '2026-09-25' },
    { id: 'payapp-4', project_id: 'boerne', number: 4, sent_on: '2026-09-28', certified_on: null, paid_on: null },
  ],
}

const fromRows = (rows: FlowRows) => readFlow(SEED_FLOWS[rows.contact.kind], flowStampsFor(rows.contact.kind, rows, NOW), NOW)
const fromFixture = (id: string) => {
  const p = flowFixture(id)
  return readFlow(SEED_FLOWS[p.kind], p.stamps, NOW)
}

describe('flowStampsFor: main’s rows read as the prototype’s people', () => {
  it('Greg, from his company’s rows, reads as his fixture', () => {
    expect(shape(fromRows(GREG))).toEqual(shape(fromFixture('greg')))
  })

  it('Elena, from her jobs’ rows, reads as her fixture, her pay app waiting on Jonah', () => {
    expect(shape(fromRows(ELENA))).toEqual(shape(fromFixture('elena')))
  })

  it('Jonah, from the job’s plan sets, questions and pay apps, reads as his fixture', () => {
    expect(shape(fromRows(JONAH))).toEqual(shape(fromFixture('jonah')))
  })

  it('puts the starred job first and the rest in the order they began', () => {
    const s = flowStampsFor('trade', GREG, NOW)
    expect([s.defaultJobId, s.jobIds]).toEqual(['boerne', ['boerne', 'stoneoak', 'padb']])
    expect(s.person.stamps.find((x) => x.fact === 'invite_sent')?.by).toBe('Rosa')
  })
})

describe('flows/load: one family at a time', () => {
  it('reads their papers by the company Documents’ rules', () => {
    const rows = (papers: CompanyPaperRow[]): FlowRows => ({ contact: contact('x', 'trade'), papers })
    const marks = (papers: CompanyPaperRow[]) => paperStamps(rows(papers), NOW).map((s) => `${s.fact}:${s.mark}:${s.at}:${s.until ?? '-'}`)
    // Current through its last day; bad the day after.
    expect(marks([paper({ doc_type: 'coi', status: 'signed', signed_at: '2026-01-02', expires_at: '2026-10-02' })])).toEqual(['coi_current:ok:2026-01-02:2026-10-02'])
    expect(marks([paper({ doc_type: 'coi', status: 'signed', signed_at: '2025-10-02', expires_at: '2026-10-01' })])).toEqual(['coi_current:bad:2026-10-01:2026-10-01'])
    // A certificate still waiting on the office counts for nothing; an agreement out to sign waits on them.
    expect(marks([paper({ doc_type: 'coi', status: 'received', expires_at: '2027-01-01' }), paper({ doc_type: 'agreement', status: 'sent', sent_at: '2026-09-30T15:00:00Z' })])).toEqual([
      'msa_signed:wait:2026-09-30:-',
    ])
    // The same verdicts as companyPapers for a trade partner.
    const own = GREG.papers ?? []
    const doc = companyPapers(own, 'hillside')
    expect([doc.w9, doc.msa, doc.coiExpires]).toEqual([true, 'signed', '2026-09-30'])
    expect(marks([...own])).toEqual(['w9_signed:ok:2026-09-12:-', 'coi_current:bad:2026-09-30:2026-09-30', 'msa_signed:ok:2026-09-14:-'])
  })

  it('takes the first visit to a live link over the press on Got it', () => {
    const base: FlowRows = { contact: contact('x', 'trade'), company: { id: 'c', portal_opened_on: '2026-09-09' } }
    expect(portalStamps(base)[0]?.at).toBe('2026-09-09')
    expect(portalStamps({ ...base, portalLinks: [{ company_id: 'c', revoked_at: null, first_opened_at: '2026-09-08T23:30:00Z' }] })[0]?.at).toBe('2026-09-08')
    expect(portalStamps({ ...base, portalLinks: [{ company_id: 'c', revoked_at: '2026-09-20T00:00:00Z', first_opened_at: '2026-09-01T15:00:00Z' }] })[0]?.at).toBe('2026-09-09')
    expect(portalStamps({ contact: contact('x', 'trade') })).toEqual([])
  })

  it('reads an ask: their promise over the bid’s day, a declined one dropped, a tied job not asked yet', () => {
    const r = askRounds(GREG, 'boerne')
    expect(r.map((x) => `${x.name}:${x.opened}:${x.due}:${x.stamps.map((s) => s.mark).join()}`)).toEqual(['Sitework:2026-09-22:2026-09-30:wait'])
    expect(askRounds(GREG, 'padb')).toEqual([{ key: 'planned:padb', name: 'Not asked yet', opened: null, due: '2026-10-22', stamps: [] }])
    const declined: FlowRows = { ...GREG, invites: GREG.invites?.map((i) => (i.id === 'inv-greg-boerne' ? { ...i, status: 'declined' } : i)) }
    expect(askRounds(declined, 'boerne')).toEqual([])
  })

  it('reads carried and not carried: ours, another’s, or a lost mark', () => {
    expect(packageStamps(GREG, 'stoneoak')).toEqual([{ fact: 'carried', mark: 'ok', at: '2026-09-14', by: 'Robert', until: null }])
    expect(packageStamps(GREG, 'boerne')).toEqual([])
    const another: FlowRows = { ...GREG, packages: GREG.packages?.map((p) => (p.id === 'pk-boerne-site' ? { ...p, carried_invite_id: 'inv-someone' } : p)) }
    expect(packageStamps(another, 'boerne')).toEqual([{ fact: 'not_carried', mark: 'ok', at: null, by: null, until: null }])
    const lost: FlowRows = { ...GREG, invites: GREG.invites?.map((i) => (i.id === 'inv-greg-boerne' ? { ...i, lost_on: '2026-10-01' } : i)) }
    expect(packageStamps(lost, 'boerne')[0]).toMatchObject({ fact: 'not_carried', at: '2026-10-01' })
  })

  it('reads the final waiver from the final draw, else their upload', () => {
    expect(finalWaiverStamps(GREG, 'stoneoak')).toEqual([])
    const upload: FlowRows = { ...GREG, tradeFiles: [{ company_id: 'hillside', project_id: 'stoneoak', paper: 'unconditional_final', uploaded_at: '2026-10-01T17:00:00Z' }] }
    expect(finalWaiverStamps(upload, 'stoneoak')[0]?.at).toBe('2026-10-01T17:00:00Z')
    const onDraw: FlowRows = { ...GREG, draws: [...(GREG.draws ?? []), { id: 'draw-3', sow_id: 'sow-greg-stone', number: 3, requested_on: '2026-10-01', approved_on: '2026-10-01', paid_on: '2026-10-02', final: true, waiver: 'unconditional', waiver_on: '2026-10-02' }] }
    expect(finalWaiverStamps(onDraw, 'stoneoak')[0]?.at).toBe('2026-10-02')
  })

  it('reads a customer’s job: a yes without a day, a loss, the contract out, the warranty year', () => {
    const facts = (p: ProjectRow, more: Partial<FlowRows> = {}) =>
      projectStamps({ contact: contact('x', 'customer'), projects: [p], ...more }, p.project_id, NOW).map((s) => `${s.fact}:${s.mark}:${s.at ?? '-'}`)
    expect(facts(project({ project_id: 'j', stage: 'buyout', owner_contract_sent_on: '2026-09-30' }))).toEqual([
      'asked_us:ok:2026-08-01',
      'said_yes:ok:-',
      'contract_signed:wait:2026-09-30',
    ])
    expect(facts(project({ project_id: 'j', lost_on: '2026-09-29' }))).toEqual(['asked_us:ok:2026-08-01', 'declined:ok:2026-09-29'])
    // The first plan set is the earlier day they asked.
    expect(facts(project({ project_id: 'j' }), { planSets: [{ id: 's', project_id: 'j', kind: 'bid', label: 'x', issued_on: '2026-07-15' }] })[0]).toBe('asked_us:ok:2026-07-15')
    const accepted = (on: string) => facts(project({ project_id: 'j', stage: 'closed', closed_on: '2025-09-30' }), { acceptances: [{ project_id: 'j', accepted_on: on }] })
    expect(accepted('2025-10-02')).toContain('warranty_over:ok:2026-10-02')
    expect(accepted('2025-10-03').some((x) => x.startsWith('warranty_over'))).toBe(false)
  })

  it('reads change orders once sent, answered when signed or declined', () => {
    const rows: FlowRows = { ...ELENA, changeOrders: [{ id: 'c', project_id: 'boerne', number: 2, description: 'a sink in exam 3', status: 'sent', sent_on: '2026-09-30', answered_on: null }] }
    expect(changeOrderRounds(rows, 'boerne')).toEqual([
      { key: 'c', name: 'CO 2 · a sink in exam 3', opened: '2026-09-30', due: null, stamps: [{ fact: 'co_answered', mark: 'wait', at: '2026-09-30', by: null, until: null }] },
    ])
  })

  it('reads questions: bidding ones due when questions close, an RFI due its needed days', () => {
    expect(questionsCloseOn(JONAH.projects?.[0])).toBe('2026-10-05')
    expect(questionsCloseOn(project({ project_id: 'b', stage: 'building', bid_due: '2026-10-08' }))).toBeNull()
    const rows: FlowRows = {
      ...JONAH,
      planQuestions: [],
      rfis: [{ id: 'r', project_id: 'boerne', number: 7, question: 'Slab depth', sent_to_architect_on: '2026-09-29', answered_on: null, needed_days: 5 }],
    }
    expect(questionRounds(rows, 'boerne')).toEqual([{ key: 'r', name: 'RFI 7', opened: '2026-09-29', due: '2026-10-04', stamps: [] }])
  })

  it('reads the waits, the standing skips and off the flow', () => {
    expect(waitsOf(ELENA)).toEqual([{ stepId: 'payapp', jobId: 'boerne', waitingOn: { contactId: 'jonah', stepId: 'certify', since: '2026-09-28' } }])
    expect(waitsOf({ ...ELENA, architectByProject: {} })).toEqual([])
    expect(
      skipsOf({
        contact: contact('x', 'trade'),
        skips: [
          { step_key: 'msa', project_id: null, why: 'A supplier.', by_name: 'Robert', created_at: '2026-09-01T15:00:00Z', undone_at: null },
          { step_key: 'papers', project_id: null, why: 'Undone.', by_name: 'Rosa', created_at: '2026-09-02T15:00:00Z', undone_at: '2026-09-03T15:00:00Z' },
        ],
      }),
    ).toEqual([{ stepId: 'msa', jobId: null, why: 'A supplier.', by: 'Robert', at: '2026-09-01T15:00:00Z' }])
    expect(offOf({ contact: { ...contact('m', 'customer'), off_since: '2026-09-29', off_why: 'Declined our bid.', off_by: 'u-rosa' }, userNames: NAMES })).toEqual({
      since: '2026-09-29',
      why: 'Declined our bid.',
      by: 'Rosa',
    })
  })
})
