// @vitest-environment jsdom
/**
 * Wiring smoke for the Pipeline row's stage strip (v2.3198): with a stage bar
 * the cell shows the chips + segments and drops the Unbilled row; without one
 * it is the classic money bar.
 */
import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { buildStagesMoneyBarModel } from '../../lib/stagesMoneyBar'
import { buildPipelineStageBar } from '../../lib/jobs/pipelineStageBar'
import StagesProgressPaymentCell from './StagesProgressPaymentCell'

const model = buildStagesMoneyBarModel({ totalBill: 37_745, paymentsMade: 13_211, pctComplete: 55 })
const stageBar = buildPipelineStageBar({
  fixtures: [
    { id: 'r', name: 'Rough In', count: 1, line_unit_price: 15098, sequence_order: 0, invoice_id: 'inv1', stage_kind: 'order', progress_pct: null },
    { id: 't', name: 'Top Out', count: 1, line_unit_price: 15098, sequence_order: 1, invoice_id: null, stage_kind: 'order', progress_pct: 60 },
    { id: 's', name: 'Trim Set', count: 1, line_unit_price: 7549, sequence_order: 2, invoice_id: null, stage_kind: 'order', progress_pct: null },
  ],
  invoices: [{ id: 'inv1', status: 'paid' }],
  payments: [{ invoice_id: 'inv1', paid_on: '2026-08-20' }],
  pctComplete: 55,
  todayYmd: '2026-09-09',
})!

describe('StagesProgressPaymentCell with a stage bar', () => {
  it('renders the three chips, the caption and Paid / Billed / Left — no Unbilled row', () => {
    render(<StagesProgressPaymentCell model={model} pctComplete={55} stageBar={stageBar} />)
    const strip = screen.getByRole('list', { name: 'Stages' })
    const chips = within(strip).getAllByRole('listitem')
    expect(chips).toHaveLength(3)
    expect(chips[0]!.textContent).toContain('Rough')
    expect(chips[1]!.textContent).toContain('Top Out')
    expect(chips[1]!.textContent).toContain('60%')
    expect(chips[2]!.textContent).toContain('Trim')
    expect(screen.getByRole('img', { name: 'Stage 2 of 3 · Top Out 60% · draw 1 paid' })).toBeTruthy()
    expect(screen.getByText('Stage 2 of 3 · Top Out 60% · draw 1 paid')).toBeTruthy()
    expect(screen.queryByText(/Unbilled/)).toBeNull()
    expect(screen.getByText(/Paid/)).toBeTruthy()
    expect(screen.getByText('Left on Job')).toBeTruthy()
    expect(screen.getByText('$37,745 bid')).toBeTruthy()
  })

  it('keeps the classic money bar when there is no stage bar', () => {
    render(<StagesProgressPaymentCell model={model} pctComplete={55} />)
    expect(screen.queryByRole('list', { name: 'Stages' })).toBeNull()
    expect(screen.getByText(/Unbilled/)).toBeTruthy()
  })

  it('compact cards show the strip and the condensed line without Unbilled', () => {
    render(<StagesProgressPaymentCell compact model={model} pctComplete={55} stageBar={stageBar} />)
    expect(screen.getByRole('list', { name: 'Stages' })).toBeTruthy()
    expect(screen.queryByText(/Unbilled/)).toBeNull()
    expect(screen.getByText(/Left/)).toBeTruthy()
  })
})
