import { describe, expect, it } from 'vitest'
import type { FactStamp, FlowDef, FlowReading, FlowStamps } from './state'
import { flowMoves, flowProgress, moveWords, paperRead, perJobJobs, placesOf, readFlow, stepReading, whoMoves, wouldBeNow } from './state'
import { FLOW_FIXTURE_NOW as NOW, FLOW_FIXTURE_PEOPLE, flowFixture } from './flowFixtures'
import { SEED_FLOWS } from './seed'

const read = (id: string, stamps?: FlowStamps): FlowReading => {
  const p = flowFixture(id)
  return readFlow(SEED_FLOWS[p.kind], stamps ?? p.stamps, NOW)
}
/** Each lane as "lane[@job]: step:state …", the shape the panel draws. */
const drawn = (r: FlowReading) => r.lanes.map((l) => `${l.lane}${l.jobId ? '@' + l.jobId : ''}: ${l.steps.map((s) => `${s.stepId}:${s.state}`).join(' ')}`)
const places = (r: FlowReading) => placesOf(r).map((p) => `${p.stepId}@${p.jobId ?? '-'}:${p.state}`)
const withPerson = (s: FlowStamps, more: FactStamp[]): FlowStamps => ({ ...s, person: { ...s.person, stamps: [...s.person.stamps, ...more] } })

describe('readFlow over the prototype’s demo people', () => {
  it('Greg: Papers in lapsed on his insurance, Boerne’s quote late, Pad B not asked yet, Stone Oak on its second draw', () => {
    const r = read('greg')
    expect(drawn(r)).toEqual([
      'once: invited:done portal:done papers:lapsed msa:done',
      'per_job@boerne: ask:now compare:next sow:later draws:later closeout:later',
      'per_job@padb: ask:now compare:next sow:later draws:later closeout:later',
      'per_job@stoneoak: ask:done compare:done sow:done draws:now closeout:next',
    ])
    // The lapsed step does not hold the chain; he is on the default job's ask, as the prototype has him.
    expect([r.nowStepId, r.nowJobId]).toEqual(['ask', 'boerne'])
    expect(places(r)).toEqual(['papers@-:lapsed', 'ask@boerne:now', 'ask@padb:now', 'draws@stoneoak:now'])
    expect(stepReading(r, 'papers', null)).toMatchObject({ since: '2026-09-30', lapsedPaper: 'coi' })
    expect(stepReading(r, 'ask', 'boerne')).toMatchObject({ since: '2026-09-22', due: '2026-09-30', lateDays: 2 })
    expect(stepReading(r, 'ask', 'boerne')?.day?.words).toBe('late 2 days')
    expect(stepReading(r, 'ask', 'padb')).toMatchObject({ since: null, due: '2026-10-22', lateDays: -20 })
    expect(stepReading(r, 'draws', 'stoneoak')).toMatchObject({ since: '2026-10-01', isTrue: false })
    expect(stepReading(r, 'draws', 'stoneoak')?.rounds.map((x) => `${x.name}:${x.state}`)).toEqual(['Draw 1:done', 'Draw 2:now'])
  })

  it('Bill: his quote is in, so the ask is done and comparing it is on since the day it came', () => {
    const r = read('bill')
    expect(drawn(r)[1]).toBe('per_job@boerne: ask:done compare:now sow:next draws:later closeout:later')
    // Stone Oak has nothing on it yet, so nobody is on its first step.
    expect(drawn(r)[2]).toBe('per_job@stoneoak: ask:next compare:later sow:later draws:later closeout:later')
    expect(r.lanes[2]?.headStepId).toBeNull()
    expect([r.nowStepId, r.nowJobId]).toEqual(['compare', 'boerne'])
    expect(stepReading(r, 'compare', 'boerne')?.since).toBe('2026-09-29')
  })

  it('Tom: on Papers in since he pressed Got it, and Boerne’s ask is ours to send by Thu', () => {
    const r = read('tom')
    expect(drawn(r)).toEqual(['once: invited:done portal:done papers:now msa:next', 'per_job@boerne: ask:now compare:next sow:later draws:later closeout:later'])
    expect([r.nowStepId, r.nowJobId]).toEqual(['papers', null])
    expect(stepReading(r, 'papers', null)?.since).toBe('2026-09-28')
    expect(stepReading(r, 'papers', null)?.facts.map((f) => `${f.fact.id}:${f.mark}`)).toEqual(['w9_signed:ok', 'coi_current:no'])
    expect(stepReading(r, 'ask', 'boerne')?.day?.words).toBe('due Thu')
  })

  it('Priya: one job skips the master agreement; the start date is on; change order 2 is open apart', () => {
    const r = read('priya')
    expect(drawn(r)).toEqual([
      'once: agreement:skipped',
      'per_job@helotes: asked:done bid:done yes:done contract:done start:now onsite:next payapp:later close:later warranty:later co:now',
    ])
    expect(stepReading(r, 'agreement', null)?.skip?.why).toBe('One job, so no master agreement.')
    expect([r.nowStepId, r.nowJobId]).toEqual(['start', 'helotes'])
    expect(stepReading(r, 'start', 'helotes')?.since).toBe('2026-09-19')
    expect(stepReading(r, 'co', 'helotes')).toMatchObject({ since: '2026-09-30', isTrue: false })
  })

  it('Elena: a repeat customer’s pay app waits on the architect, and only her default job is started', () => {
    const r = read('elena')
    expect(drawn(r).slice(0, 2)).toEqual([
      'once: agreement:done',
      'per_job@boerne: asked:done bid:done yes:done contract:done start:done onsite:done payapp:now close:next warranty:later co:done',
    ])
    expect(r.lanes.slice(2).map((l) => l.headStepId)).toEqual([null, null, null])
    expect([r.nowStepId, r.nowJobId]).toEqual(['payapp', 'boerne'])
    expect(stepReading(r, 'payapp', 'boerne')).toMatchObject({
      since: '2026-09-28',
      due: '2026-10-30',
      waitingOn: { contactId: 'jonah', stepId: 'certify', since: '2026-09-28' },
    })
    expect(stepReading(r, 'payapp', 'boerne')?.day?.words).toBe('due Oct 30')
    expect(flowProgress(SEED_FLOWS.customer, r, 'boerne')).toEqual({ done: 7, of: 10 })
    expect(paperRead(r, 'payapp', 'boerne')).toEqual({ paper: 'payapp', stepId: 'payapp', stepState: 'now', mark: 'wait', on: '2026-09-28', expires: null })
  })

  it('Jonah: the open question leads; an addendum and a certificate are open beside it', () => {
    const r = read('jonah')
    expect(drawn(r)[0]).toBe('per_job@boerne: plans:done questions:now addenda:now submittals:next certify:now')
    // The prototype typed Addenda as his step on now; the facts put the Pond question first, due Monday.
    expect([r.nowStepId, r.nowJobId]).toEqual(['questions', 'boerne'])
    expect(stepReading(r, 'questions', 'boerne')).toMatchObject({ since: '2026-10-02', due: '2026-10-05', lateDays: -3 })
    expect(stepReading(r, 'questions', 'boerne')?.day?.words).toBe('due Mon')
    expect(places(r)).toEqual(['questions@boerne:now', 'addenda@boerne:now', 'certify@boerne:now'])
  })

  it('Marcus: his decline ends the job’s lane, and off the flow he is on no step', () => {
    const r = read('marcus')
    expect(drawn(r)).toEqual([
      'once: agreement:skipped',
      'per_job@bell: asked:done bid:done yes:done contract:later start:later onsite:later payapp:later close:later warranty:later co:later',
    ])
    expect(r.lanes[1]).toMatchObject({ headStepId: null, ended: 'declined' })
    expect(r.off?.why).toBe('Declined our bid, went with another plumber.')
    expect(r.nowStepId).toBeNull()
    expect(placesOf(r)).toEqual([])
  })

  it('an unknown number is on Who is this?', () => {
    const r = read('unk1')
    expect(drawn(r)).toEqual(['once: who:now'])
    expect(r.nowStepId).toBe('who')
  })

  it('puts the board’s companies where the prototype draws them, with the days it gives', () => {
    const at = (id: string, step: string, job: string | null) => stepReading(read(id), step, job)
    expect(at('g1', 'sow', 'stoneoak')).toMatchObject({ state: 'now', since: '2026-09-27' })
    expect(at('g2', 'sow', 'stoneoak')).toMatchObject({ state: 'now', since: '2026-10-01' })
    expect(at('g3', 'papers', null)).toMatchObject({ state: 'now', since: '2026-09-30' })
    expect(at('g3', 'ask', 'boerne')).toMatchObject({ state: 'now', since: '2026-09-24', due: '2026-10-08' })
    expect(at('g4', 'papers', null)).toMatchObject({ state: 'now', since: '2026-09-26' })
    expect(at('g4', 'ask', 'padb')).toMatchObject({ state: 'now', since: '2026-09-29', due: '2026-10-22' })
    expect(at('g5', 'msa', null)).toMatchObject({ state: 'now', since: '2026-09-29' })
    expect(at('g5', 'draws', 'stoneoak')).toMatchObject({ state: 'now', since: '2026-09-29' })
    expect(at('g8', 'bid', 'oakhills')).toMatchObject({ state: 'now', since: '2026-09-28' })
    expect(at('g9', 'yes', 'leonvalley')).toMatchObject({ state: 'now', since: '2026-09-24' })
    for (const id of ['g6', 'g7', 'g10']) expect(placesOf(read(id))).toEqual([])
    expect(read('g10').lanes[1]?.ended).toBe('declined')
  })

  it('reads every demo person without a made-up state', () => {
    for (const p of FLOW_FIXTURE_PEOPLE) {
      const r = readFlow(SEED_FLOWS[p.kind], p.stamps, NOW)
      expect(r.kind).toBe(p.kind)
      // At most one step on the chain per lane; an open round may add more.
      for (const l of r.lanes) expect(l.steps.filter((s) => s.stepId === l.headStepId).every((s) => s.state === 'now')).toBe(true)
    }
  })
})

describe('readFlow: the rules the prototype did not have', () => {
  it('a loop that ends on what follows holds the chain between rounds, until the next step reads true', () => {
    const elena = flowFixture('elena').stamps
    const boerne = elena.jobs.boerne
    if (!boerne) throw new Error('fixture')
    const paid = { ...boerne, rounds: { ...boerne.rounds, payapp: boerne.rounds.payapp?.map((x) => ({ ...x, stamps: [{ fact: 'payapp_paid' as const, mark: 'ok' as const, at: '2026-10-01', by: null, until: null }] })) } }
    const between = readFlow(SEED_FLOWS.customer, { ...elena, waits: [], jobs: { ...elena.jobs, boerne: paid } }, NOW)
    // Every pay app paid, the next not sent: she stays on Pay application, never on Closeout.
    expect(stepReading(between, 'payapp', 'boerne')).toMatchObject({ state: 'now', since: '2026-10-01' })
    expect(stepReading(between, 'close', 'boerne')?.state).toBe('next')
    const closed = { ...paid, stamps: [...paid.stamps, { fact: 'closed' as const, mark: 'ok' as const, at: '2026-10-02', by: 'Rosa', until: null }] }
    const after = readFlow(SEED_FLOWS.customer, { ...elena, waits: [], jobs: { ...elena.jobs, boerne: closed } }, NOW)
    expect(stepReading(after, 'payapp', 'boerne')?.state).toBe('done')
    expect(stepReading(after, 'close', 'boerne')?.state).toBe('done')
    expect(stepReading(after, 'warranty', 'boerne')).toMatchObject({ state: 'now', since: '2026-10-02' })
  })

  it('another loop’s round ends nothing: a certified pay application leaves the submittals next', () => {
    const jonah = flowFixture('jonah').stamps
    const boerne = jonah.jobs.boerne
    if (!boerne) throw new Error('fixture')
    const certified = {
      ...boerne,
      rounds: { ...boerne.rounds, certify: [{ key: 'cert-payapp-3', name: 'Pay app 3', opened: '2026-08-28', due: null, stamps: [{ fact: 'certified' as const, mark: 'ok' as const, at: '2026-09-02', by: null, until: null }] }, ...(boerne.rounds.certify ?? [])] },
    }
    const r = readFlow(SEED_FLOWS.arch, { ...jonah, jobs: { ...jonah.jobs, boerne: certified } }, NOW)
    expect(stepReading(r, 'submittals', 'boerne')?.state).toBe('next')
    expect(stepReading(r, 'certify', 'boerne')).toMatchObject({ state: 'now', since: '2026-09-28' })
  })

  it('their no to every ask ends the job’s lane: Tom declines Pad B', () => {
    const tom = flowFixture('tom').stamps
    const padb = { jobId: 'padb', stamps: [], dues: {}, rounds: { ask: [{ key: 'inv-tom-padb', name: 'Structural steel', opened: '2026-09-29', due: '2026-10-22', stamps: [{ fact: 'quote_declined' as const, mark: 'ok' as const, at: '2026-10-01', by: null, until: null }] }] } }
    const r = readFlow(SEED_FLOWS.trade, { ...tom, jobIds: ['boerne', 'padb'], jobs: { ...tom.jobs, padb } }, NOW)
    expect(r.lanes.find((l) => l.jobId === 'padb')).toMatchObject({ headStepId: null, ended: 'quote_declined' })
    expect(drawn(r)[2]).toBe('per_job@padb: ask:done compare:later sow:later draws:later closeout:later')
    expect(stepReading(r, 'ask', 'padb')?.rounds.map((x) => `${x.name}:${x.state}`)).toEqual(['Structural steel:done'])
    // Boerne and his papers are untouched.
    expect([r.nowStepId, stepReading(r, 'ask', 'boerne')?.state]).toEqual(['papers', 'now'])
    // A no on one ask and a quote on another leaves the lane open.
    const both = { ...padb, rounds: { ask: [...padb.rounds.ask, { key: 'inv-tom-padb-2', name: 'Misc. metals', opened: '2026-09-29', due: null, stamps: [{ fact: 'quote_in' as const, mark: 'ok' as const, at: '2026-10-01', by: null, until: null }] }] } }
    const open = readFlow(SEED_FLOWS.trade, { ...tom, jobIds: ['boerne', 'padb'], jobs: { ...tom.jobs, padb: both } }, NOW)
    expect(open.lanes.find((l) => l.jobId === 'padb')).toMatchObject({ headStepId: 'compare', ended: null })
  })

  it('a fork’s way out ends the job’s lane: a quote we did not carry', () => {
    const bill = flowFixture('bill').stamps
    const boerne = bill.jobs.boerne
    if (!boerne) throw new Error('fixture')
    const lost = { ...boerne, stamps: [{ fact: 'not_carried' as const, mark: 'ok' as const, at: '2026-10-01', by: 'Robert', until: null }] }
    const r = readFlow(SEED_FLOWS.trade, { ...bill, jobs: { ...bill.jobs, boerne: lost } }, NOW)
    expect(r.lanes[1]).toMatchObject({ headStepId: null, ended: 'not_carried' })
    expect(r.lanes[1]?.steps.map((s) => s.state)).toEqual(['done', 'done', 'later', 'later', 'later'])
    expect(r.nowStepId).toBeNull()
  })

  it('a step skipped for one person passes the chain', () => {
    const tom = flowFixture('tom').stamps
    const skipped = { ...withPerson(tom, [{ fact: 'coi_current', mark: 'ok', at: '2026-10-01', by: null, until: '2027-10-01' }]), skips: [{ stepId: 'msa', jobId: null, why: 'A supplier: no agreement.', by: 'Robert', at: '2026-10-01' }] }
    const r = readFlow(SEED_FLOWS.trade, skipped, NOW)
    expect(drawn(r)[0]).toBe('once: invited:done portal:done papers:done msa:skipped')
    expect([r.nowStepId, r.nowJobId]).toEqual(['ask', 'boerne'])
  })

  it('a step with no facts yet holds nobody', () => {
    const empty: FlowDef = {
      ...SEED_FLOWS.trade,
      lanes: SEED_FLOWS.trade.lanes.map((l) => (l.lane === 'once' ? { ...l, steps: [l.steps[0]!, l.steps[1]!, { ...l.steps[1]!, id: 'safety', name: 'Safety orientation', facts: [] }, ...l.steps.slice(2)] } : l)),
    }
    const r = readFlow(empty, flowFixture('tom').stamps, NOW)
    expect(drawn(r)[0]).toBe('once: invited:done portal:done safety:later papers:now msa:next')
    expect(stepReading(r, 'papers', null)?.since).toBe('2026-09-28')
  })

  it('the editor’s preview: who moves when Papers in asks for the W-9 alone', () => {
    const w9Only: FlowDef = {
      ...SEED_FLOWS.trade,
      lanes: SEED_FLOWS.trade.lanes.map((l) => ({ ...l, steps: l.steps.map((s) => (s.id === 'papers' ? { ...s, facts: ['w9_signed' as const] } : s)) })),
    }
    const trades = FLOW_FIXTURE_PEOPLE.filter((p) => p.kind === 'trade').map((p) => ({ contactId: p.contactId, name: p.name, stamps: p.stamps }))
    // The prototype's own example: Tom Riddle · Papers in → MSA signed. Greg's lapse passes either way, so he stays.
    expect(whoMoves(SEED_FLOWS.trade, w9Only, trades, NOW)).toEqual([{ contactId: 'tom', name: 'Tom Riddle', from: 'papers', to: 'msa', fromJobId: null, toJobId: null }])
    expect(wouldBeNow(SEED_FLOWS.trade, flowFixture('greg').stamps, NOW)).toEqual({ stepId: 'ask', jobId: 'boerne' })
  })

  it('says in the thread what a fact moved: Tom’s certificate comes in', () => {
    const tom = flowFixture('tom').stamps
    const before = readFlow(SEED_FLOWS.trade, tom, NOW)
    const after = readFlow(SEED_FLOWS.trade, withPerson(tom, [{ fact: 'coi_current', mark: 'ok', at: '2026-10-02', by: null, until: '2027-11-01' }]), NOW)
    const moves = flowMoves(before, after)
    expect(moves).toEqual([
      { stepId: 'papers', jobId: null, from: 'now', to: 'done' },
      { stepId: 'msa', jobId: null, from: 'next', to: 'now' },
    ])
    expect(moveWords(SEED_FLOWS.trade, moves)).toBe('Papers in is done. MSA signed is on now.')
    expect(stepReading(after, 'msa', null)?.since).toBe('2026-10-02')
  })

  it('lists the per-job lane’s jobs with the step each is on, the unstarted ones too', () => {
    expect(perJobJobs(read('elena')).map((j) => [j.jobId, j.headStepId, j.started, j.isDefault])).toEqual([
      ['boerne', 'payapp', true, true],
      ['padb', null, false, false],
      ['fairoaks', null, false, false],
      ['stoneoak', null, false, false],
    ])
  })
})
