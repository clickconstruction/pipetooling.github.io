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

const speeds: PaySpeedData = {
  company: { medianDays: 7, samples: 286 },
  customers: { rmc: { medianDays: 35, samples: 4 } },
  segments: { residential: { medianDays: 2, samples: 136 }, commercial: { medianDays: 12, samples: 150 } },
  customerTypes: { structura: 'commercial', rmc: 'commercial', southern: 'commercial' },
  receipts: {},
  quality: null,
}
const bill = (key: string, payerId: string, payerName: string, billedYmd: string, usd: number, over: Partial<CollectBill> = {}): CollectBill => ({ key, jobId: `j-${key}`, payerId, payerName, billedYmd, usd, ...over })
const bills = [
  bill('spacex', 'structura', 'Structura, Inc. – Austin', '2026-09-24', 103_386, { sentFromHere: false }),
  bill('rmc', 'rmc', 'RMC- Dudley Mason', '2026-08-20', 55_151),
  bill('sp', 'southern', 'Southern Post Construction', '2026-09-16', 38_625, { sentFromHere: false }),
  bill('coll', 'old', 'An old GC', '2026-02-01', 19_522, { inCollections: true }),
]
const pile = buildCollectPile({ bills, paySpeeds: speeds, promisesByJob: { 'j-sp': { promisedYmd: '2026-10-16', markedByName: 'Taunya' } }, payAppJobIds: new Set(['j-spacex']), gcPayerIds: new Set(['rmc', 'southern']), todayYmd: '2026-10-25' })
const cut = buildCollectPayers(pile)
const md = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

describe('BridgeCollectDesk (v2.5853)', () => {
  it('draws the headline, the tiles, the payers and where each stands, and closes on Escape', () => {
    const onClose = vi.fn()
    renderWithProviders(<BridgeCollectDesk pile={pile} cut={cut} pace={{ paidPerWeekUsd: 29_200, billedPerWeekUsd: 56_800 }} weeks={6.8} segments={{ commercial: 12, residential: 2, company: 7 }} todayYmd="2026-10-25" readStamp="Sun, Oct 25 · pay week Oct 18–24" dayLabel={md} chipsByJob={null} arDoor={{ to: '/jobs?tab=billing', label: 'Open Billing' }} onClose={onClose} />)
    expect(screen.getByTestId('bridge-collect-headline').textContent).toBe('$197k billed, not yet paid')
    expect(screen.getByText('Only this part waits on a call')).toBeTruthy()
    expect(screen.getByText('Left alone')).toBeTruthy()
    const rows = screen.getAllByTestId('bridge-collect-payer')
    expect(rows).toHaveLength(3)
    expect(rows[0]!.textContent).toContain('Structura, Inc. – Austin')
    expect(rows[0]!.textContent).toContain('first job · the GC pace here')
    expect(rows[2]!.textContent).toContain('Promised for Oct 16, recorded by Taunya. 9 days past.')
    expect(screen.getByText('$19.5k in Collections')).toBeTruthy()
    fireEvent.click(screen.getByText(/Show the/))
    expect(screen.getByText(/was marked billed by hand and never sent from here/)).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('draws the moves, the owner’s strip, the what-if and records the plan with the owners typed (v2.5854)', () => {
    const sheet = buildCollectSheet(cut, (p) => collectMoveFor(p, { todayYmd: '2026-10-25', dayLabel: md }))
    const decisions = collectDecisions(cut, { chipFor: () => null, customerHref: (id) => `/customers/${id}`, jobsHref: '/jobs?tab=stages', dayLabel: md })
    const whatIf = collectWhatIf({ headlineUsd: pile.headlineUsd, askUsd: sheet.askUsd, paidPerWeekUsd: 29_200, billedPerWeekUsd: 56_800, windowWeeks: 8, buildWeeks: 5.2 })
    const onRecordPlan = vi.fn()
    renderWithProviders(<BridgeCollectDesk pile={pile} cut={cut} pace={{ paidPerWeekUsd: 29_200, billedPerWeekUsd: 56_800 }} weeks={6.8} segments={{ commercial: 12, residential: 2, company: 7 }} todayYmd="2026-10-25" readStamp="Sun, Oct 25" dayLabel={md} chipsByJob={null} arDoor={{ to: '/jobs?tab=billing', label: 'Open Billing' }} onClose={() => {}} sheet={sheet} decisions={decisions} whatIf={whatIf} thisWeekCall={null} recording={false} onRecordPlan={onRecordPlan} customerHref={(id) => `/customers/${id}`} />)
    const moves = screen.getAllByTestId('bridge-collect-move')
    expect(moves).toHaveLength(3)
    expect(moves[2]!.textContent).toContain('Call: the Oct 16 promise')
    expect(screen.getByText(/Say: the \$38\.6k promised for Oct 16 has not landed/)).toBeTruthy()
    expect(screen.getByTestId('bridge-collect-decisions').textContent).toContain('Put Structura, Inc. – Austin on the job as the GC.')
    expect(screen.getByText(/If half of the/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Owner and day for Southern Post Construction'), { target: { value: 'Taunya · Mon' } })
    fireEvent.click(screen.getByTestId('bridge-collect-record-plan'))
    expect(onRecordPlan).toHaveBeenCalledTimes(1)
    const recorded = onRecordPlan.mock.calls[0]![0] as Array<{ title: string; who: string; then: number | null }>
    expect(recorded).toHaveLength(3)
    expect(recorded.find((m) => m.title.startsWith('Southern Post'))).toMatchObject({ title: 'Southern Post Construction: Call: the Oct 16 promise', who: 'Taunya · Mon', then: 38_625 })
  })

  it('draws Friday’s card once a plan is recorded: landed, dated calls, the notices, Monday carries (v2.5858)', () => {
    const sheet = buildCollectSheet(cut, (p) => collectMoveFor(p, { todayYmd: '2026-10-25', dayLabel: md }))
    const call: BridgeCall = { id: 'c1', weekStart: '2026-10-25', calledOn: '2026-10-26', calledByName: 'Robert', link: 'collect', moves: sheet.rows.map((r) => ({ key: 'chase' as const, title: `${r.payer.payerName}: ${r.move.title}`, who: 'Taunya', then: r.move.askUsd })), measures: { linkWeeks: 10.2, stageWeeks: {}, keys: {} }, note: null, outcome: null, outcomeAt: null, outcomeNote: null }
    const scorecard = collectScorecard({ call, sheet, touches: [], payments: [{ payerId: 'rmc', payerName: 'RMC- Dudley Mason', usd: 10_000, paidOn: '2026-10-28' }], notices: { drafted: 2, signed: 2, mailed: 0, affidavitsFiled: 0 }, todayYmd: '2026-10-30' })
    renderWithProviders(<BridgeCollectDesk pile={pile} cut={cut} pace={{ paidPerWeekUsd: 29_200, billedPerWeekUsd: 56_800 }} weeks={6.8} segments={{ commercial: 12, residential: 2, company: 7 }} todayYmd="2026-10-30" readStamp="Fri, Oct 30" dayLabel={md} chipsByJob={null} arDoor={{ to: '/jobs?tab=billing', label: 'Open Billing' }} onClose={() => {}} sheet={sheet} thisWeekCall={call} scorecard={scorecard} />)
    const cardEl = screen.getByTestId('bridge-collect-scorecard')
    expect(cardEl.textContent).toContain('Since the plan, recorded Oct 26')
    expect(cardEl.textContent).toContain('$10k · ')
    expect(cardEl.textContent).toContain('2 signed · 0 mailed')
    expect(cardEl.textContent).toContain('Monday carries:')
  })
})
