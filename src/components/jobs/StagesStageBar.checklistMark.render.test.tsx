// @vitest-environment jsdom
/**
 * The Pipeline's not-ready mark (punch list #164, PR 4): on a job drawn as stages, a stage whose checklist has a
 * question left reads in amber with the box before its name and the count in its title; a filled one and a stage
 * with no checklist read as before. Made-up stages and prices.
 */
import { cleanup, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
const withDispatch: StageChecklistState = { kind: 'trim_set', asked: 1, answered: 0, standing: 'not_ready', ready: false, withDispatch: 1 }

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

  it('with the door’s opener the marked name is a press to the row’s checklists sheet, and the others are not (#246)', () => {
    const { view } = progressPaymentForJob(job, null, '2026-10-29')
    const onChecklistPress = vi.fn()
    renderWithProviders(<StagesStageBar view={view} pctComplete={20} checklist={new Map([['f1', notReady], ['f3', filled]])} onChecklistPress={onChecklistPress} />)
    const presses = Array.from(document.querySelectorAll('[data-stage-checklist-press]'))
    expect(presses).toHaveLength(1)
    const press = presses[0] as HTMLButtonElement
    expect(press.getAttribute('aria-label')).toBe('Checklists on Rough · checklist 2 of 3 answered · not ready · press to open')
    expect(press.textContent).toContain('☐')
    fireEvent.click(press)
    expect(onChecklistPress).toHaveBeenCalledTimes(1)
    // Without the opener the mark stays words alone, as v2.6087 drew it.
    cleanup()
    renderWithProviders(<StagesStageBar view={view} pctComplete={20} checklist={new Map([['f1', notReady]])} />)
    expect(document.querySelector('[data-stage-checklist-press]')).toBeNull()
    expect((document.querySelector('[role="listitem"]') as HTMLElement).textContent).toContain('☐')
  })

  it('a check with Dispatch flies the flag in the box’s place and says so on the title, as words or as the press (#245, PR 3)', () => {
    const { view } = progressPaymentForJob(job, null, '2026-10-29')
    renderWithProviders(<StagesStageBar view={view} pctComplete={20} checklist={new Map([['f1', notReady], ['f3', withDispatch]])} />)
    const names = Array.from(document.querySelectorAll('[role="listitem"]')) as HTMLElement[]
    const trim = names[2]!
    expect(trim.getAttribute('data-stage-with-dispatch')).toBe('1')
    expect(trim.getAttribute('title')).toBe('Stage 3 · Trim · checklist 0 of 1 answered · not ready · with Dispatch')
    expect(trim.textContent).toContain('⚑')
    expect(trim.textContent).not.toContain('☐')
    expect(trim.style.color).toBe('var(--text-amber-700)')
    // The stage with a question left and nothing with Dispatch keeps the box.
    expect(names[0]!.getAttribute('data-stage-with-dispatch')).toBeNull()
    expect(names[0]!.textContent).toContain('☐')
    cleanup()
    renderWithProviders(<StagesStageBar view={view} pctComplete={20} checklist={new Map([['f3', withDispatch]])} onChecklistPress={vi.fn()} />)
    const press = document.querySelector('[data-stage-checklist-press]') as HTMLButtonElement
    expect(press.getAttribute('aria-label')).toBe('Checklists on Trim · checklist 0 of 1 answered · not ready · with Dispatch · press to open')
    expect(press.textContent).toContain('⚑')
  })

  it('draws no mark while no question exists', () => {
    const { view } = progressPaymentForJob(job, null, '2026-10-29')
    renderWithProviders(<StagesStageBar view={view} pctComplete={20} checklist={null} />)
    expect(document.querySelector('[data-stage-checklist]')).toBeNull()
  })
})
