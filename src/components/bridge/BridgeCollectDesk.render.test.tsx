// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgeCollectDesk } from './BridgeCollectDesk'
import { buildCollectPile, type CollectBill } from '../../lib/bridge/collect/collectPile'
import { buildCollectPayers } from '../../lib/bridge/collect/collectPayers'
import type { PaySpeedData } from '../../lib/jobs/billedExpectedPay'
import { buildCollectSheet, collectMoveFor } from '../../lib/bridge/collect/collectMoves'
import { collectDecisions } from '../../lib/bridge/collect/collectDecisions'
import { collectWhatIf } from '../../lib/bridge/collect/collectWhatIf'
import { collectScorecard } from '../../lib/bridge/collect/collectScorecard'
import type { BridgeCall } from '../../lib/bridge/calls'
import { plainWordsFailures } from '../../lib/plainWords'
import { collectCountedLines, collectHeadline, collectPileLead, collectPlanLine } from './BridgeCollectCounted'

const speeds: PaySpeedData = {
  company: { medianDays: 7, samples: 286 },
  customers: { oak: { medianDays: 35, samples: 4 } },
  segments: { residential: { medianDays: 2, samples: 136 }, commercial: { medianDays: 12, samples: 150 } },
  customerTypes: { ridgeway: 'commercial', oak: 'commercial', pinestone: 'commercial' },
  receipts: {},
  quality: null,
}
const bill = (key: string, payerId: string, payerName: string, billedYmd: string, usd: number, over: Partial<CollectBill> = {}): CollectBill => ({ key, jobId: `j-${key}`, payerId, payerName, billedYmd, usd, ...over })
const bills = [
  bill('rw', 'ridgeway', 'Ridgeway Builders', '2026-09-24', 103_386, { sentFromHere: false }),
  bill('oak', 'oak', 'Oak Hollow HOA', '2026-08-20', 55_151),
  bill('ps', 'pinestone', 'Pinestone Construction', '2026-09-16', 38_625, { sentFromHere: false }),
  bill('coll', 'old', 'An old GC', '2026-02-01', 19_522, { inCollections: true }),
]
const pile = buildCollectPile({ bills, paySpeeds: speeds, promisesByJob: { 'j-ps': { promisedYmd: '2026-10-16', markedByName: 'Dana' } }, payAppJobIds: new Set(['j-rw']), gcPayerIds: new Set(['oak', 'pinestone']), todayYmd: '2026-10-25' })
const cut = buildCollectPayers(pile)
const md = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

const desk = { pile, cut, pace: { paidPerWeekUsd: 29_200, billedPerWeekUsd: 56_800 }, weeks: 6.8, segments: { commercial: 12, residential: 2, company: 7 }, dayLabel: md, chipsByJob: null, arDoor: { to: '/jobs?tab=billing', label: 'Open Billing' } }

describe('BridgeCollectDesk (v2.5853, on the step frame since spike candidate 9)', () => {
  it('opens on what is late and who holds it, two payers, and keeps the rest behind Show all and the folds', () => {
    const onClose = vi.fn()
    renderWithProviders(<BridgeCollectDesk {...desk} todayYmd="2026-10-25" readStamp="Sun, Oct 25 · pay week Oct 18–24" onClose={onClose} />)
    expect(screen.getByRole('dialog', { name: 'Collect, broken down' })).toBeTruthy()
    expect(screen.getByTestId('bridge-collect-headline').textContent).toBe('$93.8k is late. Three customers hold most of it.')
    expect(screen.getByTestId('bridge-collect-summary').textContent).toBe('$103k not yet due · $93.8k late · $0 doubtful')
    // Two payers show. The third waits behind Show all.
    expect(screen.getAllByTestId('bridge-collect-payer').map((r) => r.textContent)).toEqual(['Ridgeway Builders · $103k', 'Oak Hollow HOA · $55.2k'])
    fireEvent.click(screen.getByText('Show all 3 ›'))
    expect(screen.getAllByTestId('bridge-collect-payer')).toHaveLength(3)
    // Where it stands opens under its own row.
    expect(screen.queryByTestId('bridge-collect-stands-body')).toBeNull()
    const stands = screen.getAllByTestId('bridge-collect-stands')
    fireEvent.click(stands[0]!)
    expect(screen.getByTestId('bridge-collect-stands-body').textContent).toContain('first job · the GC pace here')
    fireEvent.click(stands[2]!)
    expect(screen.getAllByTestId('bridge-collect-stands-body')[1]!.textContent).toContain('Promised for Oct 16, recorded by Dana. 9 days past.')
    // The tiles, the legend, everyone else and what slows Collect wait in one fold.
    expect(screen.queryByText('Only this part waits on a call')).toBeNull()
    fireEvent.click(screen.getByTestId('bridge-step-fold-pile'))
    const pileFold = screen.getByTestId('bridge-step-fold-body-pile')
    expect(pileFold.textContent).toContain('$197k is billed and not yet paid, on 3 bills.')
    expect(pileFold.textContent).toContain('Only this part waits on a call')
    expect(pileFold.textContent).toContain('$19.5k in Collections')
    expect(screen.getByTestId('bridge-collect-rest').textContent).toContain('Everyone else')
    expect(screen.getByTestId('bridge-collect-slows').textContent).toMatch(/was marked billed by hand and never sent from here/)
    // With no what-if, the third tile is the left-alone case.
    fireEvent.click(screen.getByText('What if it is left alone ›'))
    expect(screen.getByText('Left alone')).toBeTruthy()
    expect(screen.queryByTestId('bridge-step-fold-body-pile')).toBeNull()
    fireEvent.click(screen.getByText('How this is counted ›'))
    const counted = screen.getByTestId('bridge-step-fold-body-counted')
    expect(counted.textContent).toContain('A bill is late once it is past the day it was billed plus that pace.')
    expect(counted.textContent).toContain('Read Sun, Oct 25 · pay week Oct 18–24')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('says so in one sentence when nothing is late', () => {
    const early = buildCollectPile({ bills: [bill('rw', 'ridgeway', 'Ridgeway Builders', '2026-10-20', 12_000)], paySpeeds: speeds, promisesByJob: null, payAppJobIds: new Set(), gcPayerIds: new Set(), todayYmd: '2026-10-25' })
    renderWithProviders(<BridgeCollectDesk {...desk} pile={early} cut={buildCollectPayers(early)} todayYmd="2026-10-25" readStamp="Sun, Oct 25" onClose={() => {}} />)
    expect(screen.getByTestId('bridge-collect-headline').textContent).toBe('Nothing is late.')
    expect(screen.getByTestId('bridge-collect-summary').textContent).toBe('$12k not yet due · $0 late · $0 doubtful')
  })

  it('draws the moves, the owner’s strip, the what-if and records the plan with the owners typed (v2.5854)', () => {
    const sheet = buildCollectSheet(cut, (p) => collectMoveFor(p, { todayYmd: '2026-10-25', dayLabel: md }))
    const decisions = collectDecisions(cut, { chipFor: () => null, customerHref: (id) => `/customers/${id}`, jobsHref: (ids) => (ids.length === 1 ? `/jobs?tab=stages&edit=${ids[0]}` : '/jobs?tab=stages'), dayLabel: md })
    const whatIf = collectWhatIf({ pileUsd: pile.latePileUsd + pile.byState.doubtful.usd, askUsd: sheet.askUsd, paidPerWeekUsd: 29_200, billedPerWeekUsd: 56_800, windowWeeks: 8, buildWeeks: 5.2 })
    const onRecordPlan = vi.fn()
    const onClose = vi.fn()
    renderWithProviders(<BridgeCollectDesk {...desk} todayYmd="2026-10-25" readStamp="Sun, Oct 25" onClose={onClose} sheet={sheet} decisions={decisions} whatIf={whatIf} thisWeekCall={null} recording={false} onRecordPlan={onRecordPlan} customerHref={(id) => `/customers/${id}`} outcomeWriter={{ write: vi.fn().mockResolvedValue(undefined) }} />)
    expect(screen.getByTestId('bridge-step-group-call').textContent).toContain('Call this week')
    // The first row: the payer and its money, the move, the words to say, and the one blue press.
    const firstRow = screen.getAllByTestId('bridge-step-row')[0]!
    expect(firstRow.textContent).toContain('Ridgeway Builders · $103k')
    expect(firstRow.textContent).toContain('Call for the pay date')
    expect(firstRow.textContent).toContain('Say: the pay application for $103k, marked billed here Sep 24.')
    expect(screen.getAllByRole('link', { name: 'Open the customer ›' }).map((l) => l.getAttribute('href'))).toEqual(['/customers/ridgeway', '/customers/oak'])
    const presses = screen.getAllByTestId('bridge-collect-after-call')
    expect(presses.map((b) => b.textContent)).toEqual(['Record the answer', 'Record the answer'])
    expect(presses[0]!.style.background).toBe('rgb(37, 99, 235)')
    expect(presses[1]!.style.background).not.toBe('rgb(37, 99, 235)')
    // The press opens the after-the-call sheet. Escape closes the sheet first, then the window.
    fireEvent.click(presses[0]!)
    expect(screen.getByTestId('bridge-collect-outcome')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('bridge-collect-outcome')).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getAllByTestId('bridge-collect-move')).toHaveLength(2)
    fireEvent.click(screen.getByTestId('bridge-step-all-call'))
    const moves = screen.getAllByTestId('bridge-collect-move')
    expect(moves).toHaveLength(3)
    expect(moves[2]!.textContent).toContain('Call: the Oct 16 promise')
    expect(screen.getByText(/Say: the \$38\.6k promised for Oct 16 has not landed/)).toBeTruthy()
    const strip = screen.getByTestId('bridge-collect-decisions')
    expect(strip.textContent).toContain('Only you can decide · 1')
    expect(strip.textContent).toContain('Is Ridgeway Builders the GC on this job?')
    expect((screen.getByRole('link', { name: 'Open the job' }) as HTMLAnchorElement).getAttribute('href')).toBe('/jobs?tab=stages&edit=j-rw')
    fireEvent.click(screen.getByText('What if half of it lands ›'))
    expect(screen.getByText(/If half of the/)).toBeTruthy()
    expect(plainWordsFailures(screen.getByTestId('bridge-collect-plan-line').textContent ?? '')).toEqual([])
    fireEvent.change(screen.getByLabelText('Owner and day for Pinestone Construction'), { target: { value: 'Dana · Mon' } })
    fireEvent.click(screen.getByTestId('bridge-collect-record-plan'))
    expect(onRecordPlan).toHaveBeenCalledTimes(1)
    const recorded = onRecordPlan.mock.calls[0]![0] as Array<{ title: string; who: string; then: number | null }>
    expect(recorded).toHaveLength(3)
    expect(recorded.find((m) => m.title.startsWith('Pinestone'))).toMatchObject({ title: 'Pinestone Construction: Call: the Oct 16 promise', who: 'Dana · Mon', then: 38_625 })
    expect((screen.getByRole('link', { name: 'Open Billing' }) as HTMLAnchorElement).getAttribute('href')).toBe('/jobs?tab=billing')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('draws Friday’s card once a plan is recorded: landed, dated calls, the notices, Monday carries (v2.5858)', () => {
    const sheet = buildCollectSheet(cut, (p) => collectMoveFor(p, { todayYmd: '2026-10-25', dayLabel: md }))
    const call: BridgeCall = { id: 'c1', weekStart: '2026-10-25', calledOn: '2026-10-26', calledByName: 'Sam', link: 'collect', moves: sheet.rows.map((r) => ({ key: 'chase' as const, title: `${r.payer.payerName}: ${r.move.title}`, who: 'Dana', then: r.move.askUsd })), measures: { linkWeeks: 10.2, stageWeeks: {}, keys: {} }, note: null, outcome: null, outcomeAt: null, outcomeNote: null }
    const scorecard = collectScorecard({ call, sheet, touches: [], payments: [{ payerId: 'oak', payerName: 'Oak Hollow HOA', usd: 10_000, paidOn: '2026-10-28' }], notices: { drafted: 2, signed: 2, mailed: 0, affidavitsFiled: 0 }, todayYmd: '2026-10-30' })
    renderWithProviders(<BridgeCollectDesk {...desk} todayYmd="2026-10-30" readStamp="Fri, Oct 30" onClose={() => {}} sheet={sheet} thisWeekCall={call} scorecard={scorecard} />)
    const cardEl = screen.getByTestId('bridge-collect-scorecard')
    expect(cardEl.textContent).toContain('Since the plan, recorded Oct 26')
    expect(cardEl.textContent).toContain('$10k · ')
    expect(cardEl.textContent).toContain('2 signed · 0 mailed')
    expect(cardEl.textContent).toContain('Monday carries:')
    expect(screen.getByTestId('bridge-collect-plan-line').textContent).toContain('This week’s plan is recorded, Oct 26.')
    expect(screen.queryByTestId('bridge-collect-record-plan')).toBeNull()
  })

  it('holds the window’s own words to the plain-words rule', () => {
    const sheet = buildCollectSheet(cut, (p) => collectMoveFor(p, { todayYmd: '2026-10-25', dayLabel: md }))
    const words = [collectHeadline(pile, cut).words, collectPileLead(pile, { paidPerWeekUsd: 29_200 }, 6.8), collectPlanLine(null, null), collectPlanLine(sheet, null), collectPlanLine({ ...sheet, calls: 1, moves: 1, waiting: 2 }, { on: 'Oct 26' }), ...collectCountedLines(pile, cut, { commercial: 12, residential: 2, company: 7 })]
    expect(words.length).toBeGreaterThan(15)
    for (const w of words) expect(plainWordsFailures(w), w).toEqual([])
  })
})
