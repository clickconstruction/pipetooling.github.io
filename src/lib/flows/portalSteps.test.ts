// The demo people's flows, read by `readFlow` from their stamps (flowFixtures.ts), drawn on their own pages through
// the adapter: the page must say what the hand-built fixtures of cut 8 said (`portal/portalTestPeople.ts`), now from the
// flow's real reading.
import { describe, expect, it } from 'vitest'
import { customerMove } from './customerMove'
import type { FlowKind } from './facts'
import { FLOW_FIXTURE_JOBS, FLOW_FIXTURE_NOW, flowFixture } from './flowFixtures'
import { customerWhere, portalPage, type PortalPage } from './portalPage'
import { askedOn, customerJobSteps, portalLanes } from './portalSteps'
import { SEED_FLOWS } from './seed'
import { readFlow, type FlowStamps } from './state'

const KINDS: Readonly<Record<string, FlowKind>> = { jonah: 'arch', elena: 'customer', priya: 'customer' }
const opts = { kindOf: (id: string) => KINDS[id] ?? null }

function pageOf(id: string, lang: 'en' | 'es' = 'en'): PortalPage {
  const p = flowFixture(id)
  const flow = SEED_FLOWS[p.kind]
  const reading = readFlow(flow, p.stamps, FLOW_FIXTURE_NOW)
  return portalPage(lang, { company: 'Click Construction', phone: '(210) 555-0100', off: !!reading.off, lanes: portalLanes(flow, reading, FLOW_FIXTURE_JOBS, opts) })
}
const rows = (page: PortalPage, title: string) =>
  page.sections.find((s) => s.title === title)?.rows.map((r) => [r.id, r.kind, 'line' in r ? r.line : r.when, 'due' in r ? r.due : null])

function customer(id: string) {
  const p = flowFixture(id)
  const flow = SEED_FLOWS[p.kind]
  const reading = readFlow(flow, p.stamps, FLOW_FIXTURE_NOW)
  return { reading, steps: customerJobSteps(flow, reading, p.stamps.defaultJobId ?? '', { ...opts, owedBy: (step) => (id === 'priya' && step === 'start' ? '2026-10-05' : null) }) }
}

describe("a trade partner's and an architect's page, from the flow's real reading", () => {
  it("draws Greg's: the certificate that ran out, the late quote, the draw, and no Pad B before anyone asked him", () => {
    const page = pageOf('greg')
    expect(page.sections.map((s) => s.title)).toEqual(['Getting set up', 'Boerne Retail Shell', 'Stone Oak Pharmacy'])
    expect(rows(page, 'Getting set up')).toEqual([
      ['invited', 'done', 'Tue Sep 8', null],
      ['portal', 'done', 'Wed Sep 9', null],
      ['papers', 'ranOut', 'Your certificate of insurance ran out. Upload the new one here. A photo of it is fine.', null],
      ['msa', 'done', 'Mon Sep 14', null],
    ])
    expect(rows(page, 'Boerne Retail Shell')?.[0]).toEqual(['ask', 'yours', 'Per the plans and the addenda.', 'late since Wed Sep 30'])
    expect(rows(page, 'Stone Oak Pharmacy')).toEqual([
      ['ask', 'done', 'Fri Sep 11', null],
      ['sow', 'done', 'Fri Sep 18', null],
      ['draws', 'onIt', 'We are on it.', null],
      ['closeout', 'later', 'Later. At the end of your work.', null],
    ])
  })

  it("never shows Bill our Compared while it is on now, nor a job he was never asked on", () => {
    const page = pageOf('bill')
    expect(page.sections.map((s) => s.title)).toEqual(['Getting set up', 'Boerne Retail Shell'])
    expect(page.sections.flatMap((s) => s.rows).some((r) => r.id === 'compare')).toBe(false)
  })

  it("asks Tom for his certificate, with no job before his first ask", () => {
    const page = pageOf('tom')
    expect(page.sections.map((s) => s.title)).toEqual(['Getting set up'])
    expect(rows(page, 'Getting set up')?.[2]).toEqual(['papers', 'yours', 'We need it before we can send you an agreement. A photo of it is fine.', null])
  })

  it("reads Jonah's open question and certificate, in Spanish too", () => {
    const page = pageOf('jonah')
    expect(page.sections.map((s) => s.title)).toEqual(['Boerne Retail Shell'])
    expect(rows(page, 'Boerne Retail Shell')?.find((r) => r[0] === 'certify')).toEqual(['certify', 'yours', 'Certify it or send it back with a note.', null])
    expect(rows(pageOf('jonah', 'es'), 'Boerne Retail Shell')?.find((r) => r[0] === 'questions')).toEqual(['questions', 'yours', 'Le toca a usted.', 'para el lun 5 oct'])
  })

  it("reads a draw asked for as on us, and the next one as theirs once the last is paid", () => {
    const p = flowFixture('greg')
    const stoneoak = p.stamps.jobs.stoneoak
    if (!stoneoak) throw new Error('no Stone Oak in Greg’s fixture')
    const paidOnly: FlowStamps = { ...p.stamps, jobs: { ...p.stamps.jobs, stoneoak: { ...stoneoak, rounds: { ...stoneoak.rounds, draws: (stoneoak.rounds.draws ?? []).slice(0, 1) } } } }
    const flow = SEED_FLOWS.trade
    const page = portalPage('en', { company: 'Click Construction', phone: '(210) 555-0100', off: false, lanes: portalLanes(flow, readFlow(flow, paidOnly, FLOW_FIXTURE_NOW), FLOW_FIXTURE_JOBS, opts) })
    expect(rows(page, 'Stone Oak Pharmacy')?.find((r) => r[0] === 'draws')).toEqual(['draws', 'yours', 'Send your pay application with its conditional waiver.', null])
    expect(rows(pageOf('greg'), 'Stone Oak Pharmacy')?.find((r) => r[0] === 'draws')).toEqual(['draws', 'onIt', 'We are on it.', null])
  })

  it('takes a job onto the page only once something on it went', () => {
    const p = flowFixture('greg')
    const reading = readFlow(SEED_FLOWS.trade, p.stamps, FLOW_FIXTURE_NOW)
    const asked = Object.fromEntries(reading.lanes.filter((l) => l.lane === 'per_job').map((l) => [l.jobId, askedOn(l)]))
    expect(asked).toEqual({ boerne: true, padb: false, stoneoak: true })
  })
})

describe("the customer's Home, from the flow's real reading", () => {
  it("says what we owe Priya by its day, and lists her job's steps", () => {
    const { steps } = customer('priya')
    const where = customerWhere('en', steps.perJob)
    expect(where.count).toBe('3 of 8 done')
    expect(where.rows.map((r) => [r.id, r.kind, 'line' in r ? r.line : r.when])).toEqual([
      ['contract', 'done', 'Sat Sep 19'],
      ['start', 'onIt', 'We are on it. We send it to you by Mon Oct 5.'],
      ['onsite', 'later', 'Later. After your start date.'],
    ])
  })

  it("puts Priya's open change order first on Your move", () => {
    const { steps } = customer('priya')
    const move = customerMove('en', {
      off: false,
      steps: [...steps.once, ...steps.perJob],
      changes: [{ id: 'co-2', number: 2, description: { en: 'a sink in exam 3', es: 'un lavabo en el consultorio 3' }, price: 2150, days: 0, state: 'open' }],
    })
    expect(move).toMatchObject({ kind: 'change', title: 'Change order 2 waits on your answer' })
  })

  it("reads Elena's pay application as waiting on her architect for the certificate", () => {
    const { steps } = customer('elena')
    expect(customerWhere('en', steps.perJob).rows.find((r) => r.id === 'payapp')).toEqual({ id: 'payapp', name: 'Pay application', kind: 'waiting', line: 'Waiting on your architect for the certificate.' })
  })

  it('thanks Marcus, off the flow', () => {
    const { reading, steps } = customer('marcus')
    expect(customerMove('en', { off: !!reading.off, steps: [...steps.once, ...steps.perJob], changes: [] })).toEqual({ kind: 'off', line: 'Thank you for considering us. If you need us again, text us.' })
  })
})
