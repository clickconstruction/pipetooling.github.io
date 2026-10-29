// @vitest-environment jsdom
/**
 * The Pipeline's not-ready mark (punch list #164, PR 4): on a job drawn as stages, a stage whose checklist has a
 * question left reads in amber with the box before its name and the count in its title; a filled one and a stage
 * with no checklist read as before. Made-up stages and prices.
 */
import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { progressPaymentForJob } from '../../lib/jobs/progressPaymentForJob'
import type { StageChecklistState } from '../../lib/jobs/stageChecklist'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { StagesStageBar } from './StagesStageBar'

const job = {
  id: 'job-zz-1',
  revenue: 18400,
  payments_made: 0,
  pct_complete: 20,
  status: 'working',
  fixtures: [
    { id: 'f1', name: 'Rough In', count: 1, line_unit_price: 8400, sequence_order: 1, invoice_id: null, stage_kind: 'any' },
    { id: 'f2', name: 'Top Out', count: 1, line_unit_price: 5900, sequence_order: 2, invoice_id: null, stage_kind: 'any' },
    { id: 'f3', name: 'Trim Set', count: 1, line_unit_price: 4100, sequence_order: 3, invoice_id: null, stage_kind: 'any' },
  ],
  invoices: [],
  payments: [],
}
const notReady: StageChecklistState = { kind: 'rough_in', asked: 3, answered: 2, standing: 'not_ready', ready: false }
const filled: StageChecklistState = { kind: 'trim_set', asked: 1, answered: 1, standing: 'ready', ready: true }

afterEach(() => cleanup())

describe('StagesStageBar: the checklist mark', () => {
  it('marks the stage left in amber with the box and the count, and leaves the others as they were', () => {
    const { view } = progressPaymentForJob(job, null, '2026-10-29')
    expect(view.mode).toBe('stages')
    renderWithProviders(<StagesStageBar view={view} pctComplete={20} checklist={new Map([['f1', notReady], ['f3', filled]])} />)
    const names = Array.from(document.querySelectorAll('[role="listitem"]'))
    expect(names).toHaveLength(3)
    const rough = names[0] as HTMLElement
    expect(rough.getAttribute('data-stage-checklist')).toBe('not_ready')
    expect(rough.getAttribute('title')).toContain('checklist 2 of 3 answered · not ready')
    expect(rough.textContent).toContain('☐')
    expect(rough.style.color).toBe('var(--text-amber-700)')
    const top = names[1] as HTMLElement
    expect(top.getAttribute('data-stage-checklist')).toBeNull()
    expect(top.textContent).not.toContain('☐')
    const trim = names[2] as HTMLElement
    expect(trim.getAttribute('data-stage-checklist')).toBe('ready')
    expect(trim.getAttribute('title')).toContain('checklist filled')
    expect(trim.textContent).not.toContain('☐')
  })

  it('draws no mark while no question exists', () => {
    const { view } = progressPaymentForJob(job, null, '2026-10-29')
    renderWithProviders(<StagesStageBar view={view} pctComplete={20} checklist={null} />)
    expect(document.querySelector('[data-stage-checklist]')).toBeNull()
  })
})
