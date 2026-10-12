import { describe, expect, it } from 'vitest'
import { FACT_GROUPS, FLOW_FACTS, FLOW_PAPERS, factById, factForPaper, factGroups, factsWords, isFactId, isPaperId } from './facts'
import { SEED_FLOWS } from './seed'
import { flat } from './state'

describe('flows/facts', () => {
  it('lists each fact once, in a known group', () => {
    const ids = FLOW_FACTS.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toHaveLength(33)
    for (const f of FLOW_FACTS) expect(FACT_GROUPS).toContain(f.group)
  })

  it('names what cut 4 adds wherever a fact is not kept in full', () => {
    const notFull = FLOW_FACTS.filter((f) => f.kept !== 'yes').map((f) => f.id)
    expect(notFull).toEqual(['portal_opened', 'not_carried', 'asked_us', 'said_yes', 'payapp_paid', 'warranty_over', 'named'])
    for (const f of FLOW_FACTS) if (f.kept === 'not_yet') expect(f.gap).toBeTruthy()
    expect(factById('portal_opened')?.gap).toContain('first_opened_at')
    expect(factById('said_yes')?.gap).toContain('won_on')
    expect(factById('payapp_paid')?.reads).toContain('invoice_id')
    expect(factById('asked_us')?.reads).toContain('gc_projects.created_at')
    // Warranty is computed from the acceptance, so nothing is added for it.
    expect(factById('warranty_over')?.gap).toBeNull()
  })

  it('marks the ways out that end a job’s lane: their no to an ask, and the two forks’', () => {
    expect(FLOW_FACTS.filter((f) => f.endsLane).map((f) => f.id)).toEqual(['quote_declined', 'not_carried', 'declined'])
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
})
