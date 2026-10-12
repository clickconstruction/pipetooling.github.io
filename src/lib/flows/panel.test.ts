import { describe, expect, it } from 'vitest'
import { demoPeople, demoPerson } from './demoPeople.fixture'
import { FLOW_FIXTURE_NOW, flowFixture } from './flowFixtures'
import { flowPanel, type FlowPanelModel } from './panel'
import { SEED_FLOWS } from './seed'
import { readFlow } from './state'

const people = demoPeople()
const box = (m: FlowPanelModel, stepId: string) => m.lanes.flatMap((l) => l.boxes).find((b) => b.stepId === stepId)

describe('flowPanel: the panel and the rail over the demo people', () => {
  it('Greg: the title by kind, his lapsed papers with their marks, Boerne’s ask late and his', () => {
    const m = flowPanel(demoPerson('greg'), null, people)
    expect(m.title).toBe('Trade partner flow')
    expect(m.lanes.map((l) => `${l.label}${l.jobId ? '@' + l.jobId : ''}`)).toEqual(['Once', 'Per job@boerne'])
    expect(box(m, 'papers')).toMatchObject({ state: 'lapsed', symbol: '!', lapsed: 'lapsed · insurance expired', move: 'them' })
    expect(box(m, 'papers')?.papers.map((p) => `${p.short} ${p.mark}`)).toEqual(['W-9 ✓', 'insurance !'])
    expect(box(m, 'ask')).toMatchObject({ state: 'now', symbol: '↻', loop: true, day: { words: 'late 2 days', late: true }, move: 'them' })
    expect(box(m, 'invited')).toMatchObject({ state: 'done', symbol: '✓', move: null, day: null })
  })

  it('draws the Per job lane for the job picked, and lists every job in the caption', () => {
    // Greg on all three of his jobs, read from his stamps.
    const greg = { ...demoPerson('greg'), reading: readFlow(SEED_FLOWS.trade, flowFixture('greg').stamps, FLOW_FIXTURE_NOW) }
    const m = flowPanel(greg, 'stoneoak', people)
    expect(m.jobId).toBe('stoneoak')
    expect(m.lanes.find((l) => l.lane === 'per_job')?.jobId).toBe('stoneoak')
    expect(box(m, 'draws')).toMatchObject({ state: 'now', loop: true })
    expect(m.jobs.find((j) => j.jobId === 'stoneoak')).toMatchObject({ picked: true, words: 'Draws' })
    expect(m.jobs.find((j) => j.jobId === 'boerne')).toMatchObject({ isDefault: true, picked: false, words: 'Asked to quote' })
    // A job that is not theirs reads as the default.
    expect(flowPanel(greg, 'nowhere', people).jobId).toBe('boerne')
    expect(m.jobs.map((j) => `${j.name}: ${j.words}`)).toEqual(['Boerne Retail Shell: Asked to quote', 'Boerne Retail Pad B: Asked to quote', 'Stone Oak Pharmacy: Draws'])
  })

  it('Elena: her pay application waits on Jonah by name', () => {
    const m = flowPanel(demoPerson('elena'), null, people)
    expect(m.title).toBe('Customer flow')
    expect(box(m, 'payapp')).toMatchObject({ state: 'now', move: 'wait', waitingOn: 'Jonah' })
  })

  it('Priya: the master agreement skipped with why; change orders apart', () => {
    const m = flowPanel(demoPerson('priya'), null, people)
    expect(box(m, 'agreement')).toMatchObject({ state: 'skipped', symbol: '–' })
    expect(box(m, 'agreement')?.skipWhy).toBeTruthy()
    expect(box(m, 'co')).toMatchObject({ aside: true, loop: true })
  })

  it('Marcus: off the flow, said once at the top', () => {
    const m = flowPanel(demoPerson('marcus'), null, people)
    expect(m.off?.why).toBeTruthy()
  })

  it('counts how far along on the job drawn, the way the rail says it', () => {
    const m = flowPanel(demoPerson('greg'), null, people)
    expect(m.progress.of).toBeGreaterThan(m.progress.done)
    expect(m.progress.done).toBeGreaterThan(0)
  })

  it('marks a paper made in the New paper window from its fact', () => {
    const greg = demoPerson('greg')
    const docId = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'
    const flow = {
      ...greg.flow,
      lanes: greg.flow.lanes.map((l) =>
        l.lane === 'once' ? { ...l, steps: l.steps.map((s) => (s.id === 'msa' ? { ...s, papers: [...s.papers, `doc:${docId}` as never] } : s)) } : l,
      ),
    }
    const m = flowPanel({ ...greg, flow }, null, people)
    expect(box(m, 'msa')?.papers.map((p) => `${p.short} ${p.mark}`)).toEqual(['MSA ✓', 'paper ○'])
  })
})
