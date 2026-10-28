import { describe, expect, it } from 'vitest'
import { stepsByKind } from '../quickReplies/kernel'
import { plainWordsFailures } from '../plainWords'
import { FACT_GROUPS, FLOW_FACTS, FLOW_KINDS, FLOW_PAPERS, factById, factForPaper, factGroups, contactFlowKind, factsWords, flowContactKind, hasFlow, isFactId, isPaperId, noFlowWords, type FlowKind } from './facts'
import { SEED_FLOWS } from './seed'
import { flat } from './state'

describe('flows/facts', () => {
  it('lists each fact once, in a known group', () => {
    const ids = FLOW_FACTS.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toHaveLength(60)
    for (const f of FLOW_FACTS) expect(FACT_GROUPS).toContain(f.group)
  })

  it('names what cut 4 adds wherever a fact is not kept in full', () => {
    const notFull = FLOW_FACTS.filter((f) => f.kept !== 'yes').map((f) => f.id)
    expect(notFull).toEqual([
      'portal_opened',
      'not_carried',
      'asked_us',
      'said_yes',
      'payapp_paid',
      'warranty_over',
      'named',
      'on_way',
      'review_asked',
      'sub_paid',
      // The hiring board keeps no day for a quals, a screening call or a decision (the candidate flow, spike).
      'qualifications_noted',
      'cand_called',
      'cand_hired',
      'cand_passed',
      // A sub coming on (spike): a call off the app and the decision to keep them are not written down.
      'sub_reached',
      'sub_kept',
    ])
    for (const f of FLOW_FACTS) if (f.kept === 'not_yet') expect(f.gap).toBeTruthy()
    expect(factById('portal_opened')?.gap).toContain('first_opened_at')
    expect(factById('said_yes')?.gap).toContain('won_on')
    expect(factById('payapp_paid')?.reads).toContain('invoice_id')
    expect(factById('asked_us')?.reads).toContain('gc_projects.created_at')
    // Warranty is computed from the acceptance, so nothing is added for it.
    expect(factById('warranty_over')?.gap).toBeNull()
    // The sheet keeps the sub's two days since v2.5429 (R8 · 12, PR 2).
    expect(factById('sub_on_site')?.reads).toContain('people_labor_jobs.on_site_at')
    expect(factById('sub_done')?.reads).toContain('people_labor_jobs.done_at')
  })

  it('lists the residential flow’s eleven facts once each, on the job or one bill, read from main’s columns', () => {
    const ids = ['booked', 'on_way', 'arrived', 'found', 'estimate_sent', 'estimate_approved', 'working', 'done', 'billed', 'paid', 'review_asked']
    for (const id of ids) expect(FLOW_FACTS.filter((f) => f.id === id)).toHaveLength(1)
    // The sub's six come after them (R8 · 12), then the candidate flow's five and the sub Once lane's five (spike).
    expect(FLOW_FACTS.slice(-27, -16).map((f) => f.id)).toEqual(ids)
    expect(FLOW_FACTS.filter((f) => f.scope === 'round' && ids.includes(f.id)).map((f) => f.id)).toEqual(['billed', 'paid'])
    expect(factGroups().find((g) => g.group === 'On the job')?.facts.map((f) => f.id)).toEqual([
      'booked',
      'on_way',
      'arrived',
      'found',
      'working',
      'done',
      'sub_asked',
      'sub_said_yes',
      'sub_declined',
      'sub_on_site',
      'sub_done',
    ])
    expect(factById('booked')?.reads).toContain('job_schedule_blocks')
    expect(factById('arrived')?.reads).toContain('clock_sessions.clocked_in_at')
    expect(factById('estimate_approved')?.reads).toContain("'customer_accepted'")
    expect(factById('done')?.reads).toContain("'ready_to_bill'")
    expect(factById('billed')?.reads).toContain('billed_at, else sent_to_customer_at')
    // A sent text keeps no line of its own until R3 adds one, so the loader's word rules stand in.
    expect(factById('on_way')?.reads).toContain('isOnOurWayText')
    expect(factById('review_asked')?.reads).toContain('isReviewAskText')
    // v2.6007: the app's own line is read by the rating link it carries, not by words a person might not type.
    expect(factById('review_asked')?.reads).toContain('/rate?t=')
    expect(factById('on_way')?.gap).toContain('messages.quick_reply_id')
    expect(factById('review_asked')?.gap).toContain('messages.quick_reply_id')
    expect(factForPaper('estimate')?.id).toBe('estimate_sent')
    expect(factForPaper('bill')?.id).toBe('billed')
    expect(FLOW_PAPERS.estimate.aName).toBe('An estimate')
  })

  it('marks the ways out that end a job’s lane: their no to an ask, and the five forks’', () => {
    expect(FLOW_FACTS.filter((f) => f.endsLane).map((f) => f.id)).toEqual(['quote_declined', 'not_carried', 'declined', 'sub_declined', 'cand_passed', 'sub_let_go'])
  })

  it('has a paper entry for every paper a fact reads, and a fact for every paper', () => {
    for (const f of FLOW_FACTS) if (f.paper) expect(FLOW_PAPERS[f.paper]?.id).toBe(f.paper)
    for (const p of Object.values(FLOW_PAPERS)) expect(factForPaper(p.id)?.paper).toBe(p.id)
  })

  it('gives each paper its article, fixing the prototype’s "A email" and "A addendum"', () => {
    expect(FLOW_PAPERS.invitation.aName).toBe('An invitation')
    expect(FLOW_PAPERS.addendum.aName).toBe('An addendum')
    expect(FLOW_PAPERS.coi.short).toBe('insurance')
    expect(FLOW_PAPERS.certificate.label).toBe("Architect's certificate")
  })

  it('looks ids up and refuses unknown ones', () => {
    expect(factById('coi_current')?.paper).toBe('coi')
    expect(factById('nope')).toBeNull()
    expect(isFactId('quote_in')).toBe(true)
    expect(isFactId('toString')).toBe(false)
    expect(isPaperId('sow')).toBe(true)
    expect(isPaperId('toString')).toBe(false)
  })

  it('groups the picker in order and covers every fact', () => {
    const groups = factGroups()
    expect(groups.map((g) => g.group)).toEqual(FACT_GROUPS)
    expect(groups.flatMap((g) => g.facts)).toHaveLength(FLOW_FACTS.length)
  })

  it('says a step’s facts in one phrase, with or on a fork', () => {
    expect(factsWords(['w9_signed', 'coi_current'], 'and')).toBe('their W-9 is signed and their insurance is current')
    expect(factsWords(['said_yes', 'declined'], 'or')).toBe('they said yes or they declined')
  })

  it('lets every seeded step pick only known facts and papers', () => {
    for (const flow of Object.values(SEED_FLOWS)) {
      for (const s of flat(flow)) {
        expect(s.facts.length).toBeGreaterThan(0)
        for (const f of s.facts) expect(isFactId(f)).toBe(true)
        for (const p of s.papers) expect(isPaperId(p)).toBe(true)
      }
    }
  })

  it('has a sub flow of five job steps (RESIDENTIAL_BUILD_PLAN.md R8 · 12) under a Once lane of seven (spike), and the flows tables allow every kind', () => {
    expect(flat(SEED_FLOWS.sub)).toHaveLength(12)
    expect(stepsByKind(SEED_FLOWS).sub?.map((s) => s.id)).toEqual(['reached', 'qualifications', 'w9', 'coi', 'agreement', 'first', 'kept', 'asked', 'yes', 'onsite', 'done', 'paid'])
    // The residential flow's migration widened flows_kind_known to the six; seed.test.ts reads its steps.
    const all: FlowKind[] = ['customer', 'trade', 'arch', 'residential', 'sub', 'unknown', 'candidate']
    expect([...FLOW_KINDS].sort()).toEqual([...all].sort())
    expect(flat(SEED_FLOWS.residential)).toHaveLength(11)
  })

  it('reads a residential flow’s person as a customer, and every other flow’s as its own kind', () => {
    const all: FlowKind[] = ['customer', 'trade', 'arch', 'residential', 'sub', 'unknown', 'candidate']
    expect(all.map(flowContactKind)).toEqual(['customer', 'trade', 'arch', 'customer', 'sub', 'unknown', 'candidate'])
  })

  it('sends a lead, a supply house and a teammate to the unknown flow, and every other kind to its own, a candidate since the spike', () => {
    expect(contactFlowKind('lead')).toBe('unknown')
    expect(contactFlowKind('supply_house')).toBe('unknown')
    expect(contactFlowKind('team')).toBe('unknown')
    expect(contactFlowKind('candidate')).toBe('candidate')
    expect(contactFlowKind('customer')).toBe('customer')
    expect(contactFlowKind('sub')).toBe('sub')
  })

  it('knows who has a flow of their own, and says why the others have none (spike)', () => {
    expect(['customer', 'trade', 'arch', 'sub', 'residential', 'candidate'].map((k) => hasFlow(k as FlowKind))).toEqual([true, true, true, true, true, true])
    expect(['unknown', 'lead', 'supply_house', 'team'].map((k) => hasFlow(k as never))).toEqual([false, false, false, false])
    expect(noFlowWords('candidate')).toBeNull()
    expect(noFlowWords('supply_house')).toBe('A supply house has no flow. Their quotes live on the RFQ desk.')
    expect(noFlowWords('lead')).toBe('A lead has no flow until they book.')
    expect(noFlowWords('team')).toBe('One of our own team has no flow.')
    expect(noFlowWords('customer')).toBeNull()
    expect(['supply_house', 'lead', 'team'].flatMap((k) => plainWordsFailures(noFlowWords(k as never) ?? ''))).toEqual([])
  })
})
