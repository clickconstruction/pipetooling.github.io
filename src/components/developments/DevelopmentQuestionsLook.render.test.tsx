// @vitest-environment jsdom
/**
 * The Questions look (v2.6214): two presses always, a table per lane with questions, open first and
 * oldest first, the answered folded; the good-state words with none. Harlow Ranch's made-up rows.
 */
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import type { MemberRequest } from '../../lib/developments/overview'
import { DevelopmentQuestionsLook } from './DevelopmentQuestionsLook'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

beforeAll(installDomShims)
afterEach(cleanup)

function req(p: Partial<MemberRequest> & { id: string; created_at: string; lane: MemberRequest['lane'] }): MemberRequest {
  return { title: 'q', status: 'open', priority: null, closed_at: null, closed_note: null, from_user_id: 'u-robert', bid_id: 'b1', job_ledger_id: null, development_id: 'd1', reference_summary: null, notes: [], ...p }
}
const NAMES = new Map([
  ['u-robert', 'Robert'],
  ['u-wendi', 'Wendi'],
])
const ROWS: MemberRequest[] = [
  req({ id: 'e-new', lane: 'estimators', created_at: '2026-10-26T15:00:00Z', title: 'Did the Oct 20 set change the gas count?' }),
  req({ id: 'e-old', lane: 'estimators', created_at: '2026-10-20T15:00:00Z', title: 'Which set did we price from?' }),
  req({ id: 'e-done', lane: 'estimators', created_at: '2026-10-18T15:00:00Z', status: 'closed', closed_at: '2026-10-19T15:00:00Z', closed_note: 'The Sep 3 set.' }),
]

function draw(rows: MemberRequest[], onAsk = vi.fn(), phone = false) {
  renderWithProviders(<DevelopmentQuestionsLook requests={rows} names={NAMES} aboutLabel={() => 'BP418 Lodge'} openAbout={() => {}} onAsk={onAsk} phone={phone} />)
  return onAsk
}

describe('DevelopmentQuestionsLook', () => {
  it('two presses always, each opening its lane', () => {
    const onAsk = draw([])
    fireEvent.click(screen.getByText('Ask the estimators'))
    fireEvent.click(screen.getByText('Ask Dispatch'))
    expect(onAsk.mock.calls.map((c) => c[0])).toEqual(['estimators', 'dispatch'])
    expect(screen.getByText('Nothing waiting on the estimators or Dispatch.')).toBeTruthy()
    expect(screen.queryByTestId('questions-table-estimators')).toBeNull()
  })
  it('a table per lane with questions: open oldest first, the answer so far, the answered folded under a count', () => {
    draw(ROWS)
    expect(screen.queryByTestId('questions-table-dispatch')).toBeNull()
    const table = screen.getByTestId('questions-table-estimators')
    expect(within(table).getByTestId('questions-meta-estimators').textContent).toBe('2 open · 1 answered')
    const lines = () => [...table.querySelectorAll('[data-testid^="question-line-"]')].map((el) => el.getAttribute('data-testid')!.replace('question-line-', ''))
    expect(lines()).toEqual(['e-old', 'e-new'])
    expect(within(table).getAllByText('nothing yet')).toHaveLength(2)
    fireEvent.click(within(table).getByTestId('questions-fold-estimators'))
    expect(lines()).toEqual(['e-old', 'e-new', 'e-done'])
    expect(within(table).getByText('The Sep 3 set.')).toBeTruthy()
    expect(within(table).getByText('Hide the 1 answered')).toBeTruthy()
  })
  it('on a phone the rows are cards', () => {
    draw(ROWS, vi.fn(), true)
    expect(screen.getByTestId('question-row-e-old')).toBeTruthy()
    expect(screen.getByTestId('questions-table-estimators').querySelector('table')).toBeNull()
  })
})
