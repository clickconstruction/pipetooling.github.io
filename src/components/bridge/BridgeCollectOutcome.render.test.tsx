// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgeCollectOutcome } from './BridgeCollectOutcome'
import { buildCollectPile, type CollectBill } from '../../lib/bridge/collect/collectPile'
import { buildCollectPayers } from '../../lib/bridge/collect/collectPayers'
import type { PaySpeedData } from '../../lib/jobs/billedExpectedPay'

const speeds: PaySpeedData = { company: { medianDays: 7, samples: 286 }, customers: {}, segments: { residential: null, commercial: { medianDays: 12, samples: 150 } }, customerTypes: { southern: 'commercial' }, receipts: {}, quality: null }
const bills: CollectBill[] = [
  { key: 'inv:a', jobId: 'j-take5', payerId: 'southern', payerName: 'Southern Post Construction', billedYmd: '2026-09-16', usd: 38_000, sentFromHere: false },
  { key: 'inv:b', jobId: 'j-take5', payerId: 'southern', payerName: 'Southern Post Construction', billedYmd: '2026-10-05', usd: 625 },
]
const pile = buildCollectPile({ bills, paySpeeds: speeds, promisesByJob: { 'j-take5': { promisedYmd: '2026-10-16', markedByName: 'Taunya' } }, payAppJobIds: new Set(), gcPayerIds: new Set(['southern']), todayYmd: '2026-10-26' })
const payer = buildCollectPayers(pile).payers[0]!
const md = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

describe('BridgeCollectOutcome (v2.5855)', () => {
  it('records a named date as a promise with who said it, through the writer, then closes', async () => {
    const write = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    const onRecorded = vi.fn()
    renderWithProviders(<BridgeCollectOutcome payer={payer} todayYmd="2026-10-26" dayLabel={md} graceDays={7} quietDays={3} customerHref="/customers/southern" writer={{ write }} onClose={onClose} onRecorded={onRecorded} />)
    expect(screen.getByText('Southern Post Construction · $38.6k · promised Oct 16')).toBeTruthy()
    const record = screen.getByTestId('bridge-collect-outcome-record') as HTMLButtonElement
    expect(record.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('They will pay by'), { target: { value: '2026-11-11' } })
    fireEvent.change(screen.getByPlaceholderText('Dana, accounts payable'), { target: { value: 'Dana' } })
    expect(screen.getByText(/The forecast moves the money to Nov 11\./)).toBeTruthy()
    fireEvent.click(record)
    await waitFor(() => expect(onRecorded).toHaveBeenCalled())
    expect(write).toHaveBeenCalledWith(payer, { kind: 'promise', ymd: '2026-11-11', saidBy: 'Dana', note: null })
    expect(onClose).toHaveBeenCalled()
  })

  it('records spoke with no day as a note, with a resent touch when asked', async () => {
    const write = vi.fn().mockResolvedValue(undefined)
    renderWithProviders(<BridgeCollectOutcome payer={payer} todayYmd="2026-10-26" dayLabel={md} graceDays={7} quietDays={3} customerHref={null} writer={{ write }} onClose={() => {}} onRecorded={() => {}} />)
    fireEvent.click(screen.getByText('No date'))
    fireEvent.change(screen.getByLabelText('What happened'), { target: { value: 'no_day' } })
    fireEvent.change(screen.getByPlaceholderText('optional'), { target: { value: 'the check went out Friday' } })
    fireEvent.click(screen.getByLabelText(/Resend the bill now/))
    fireEvent.click(screen.getByTestId('bridge-collect-outcome-record'))
    await waitFor(() => expect(write).toHaveBeenCalledTimes(2))
    expect(write.mock.calls[0]![1]).toEqual({ kind: 'touch', outcome: 'note', note: 'Spoke, they would not name a day. the check went out Friday' })
    expect(write.mock.calls[1]![1]).toEqual({ kind: 'touch', outcome: 'resend', note: 'The bill, sent again after the call.' })
  })
})
