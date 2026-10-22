// @vitest-environment jsdom
/**
 * The Plans panel (v2.5736, punch list #142): one box, the plans answer first from the page text
 * and the robot's read, the hits with Open sheet, the three folds, and the states.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { BidPlansPanel, BidPlansButton } from './BidPlansPanel'
import type { BidWithBuilder } from '../../types/bidWithBuilder'

const rows = [
  { page: 1, sheet_no: 'P-001', title: 'Plumbing notes', text: 'GENERAL NOTES 14. KITCHEN EQUIPMENT AND ITS CONNECTIONS BY OTHERS.', has_text: true, source: 'round', created_at: '2026-10-21T19:06:00Z' },
  { page: 2, sheet_no: 'P-201', title: 'First floor plumbing', text: 'FD-1 TYP. SEE DETAIL 4/P-501. FD-1 AT MOP SINK.', has_text: true, source: 'round', created_at: '2026-10-21T19:06:00Z' },
  { page: 3, sheet_no: 'P-601', title: 'Plumbing schedules', text: 'FD-1 FLOOR DRAIN ZURN Z415 3 IN OUTLET', has_text: true, source: 'round', created_at: '2026-10-21T19:06:00Z' },
]
const substrate = {
  sheets: [
    { page: 1, sheet_no: { value: 'P-001' }, notes: [{ category: 'general', text: { value: 'Kitchen equipment and its connections by others.' }, flags: ['exclusion_candidate'] }] },
    { page: 3, sheet_no: { value: 'P-601' }, schedules: [{ schedule_type: 'plumbing_fixture', rows: [{ tag: 'FD-1', description: 'Floor drain, Zurn Z415' }] }] },
  ],
  rollup: { sheet_inventory: { total: 3, in_trade: ['P-001', 'P-201', 'P-601'] } },
}
const state = { pages: rows as unknown[], questions: [] as unknown[], asked: [] as Record<string, unknown>[] }
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      // v2.5737: the thread (bid_plan_questions) reads as an empty list; asks and RFIs resolve.
      const chain = {
        select: () => chain,
        eq: () => chain,
        neq: () => chain,
        in: () => Promise.resolve({ data: [], error: null }),
        is: () => chain,
        order: () => (table === 'bids_plan_pages' ? Promise.resolve({ data: state.pages, error: null }) : table === 'bid_plan_questions' ? chain : chain),
        limit: () => (table === 'bid_plan_questions' ? Promise.resolve({ data: state.questions, error: null }) : chain),
        maybeSingle: () => Promise.resolve({ data: table === 'bids_plan_substrates' ? { substrate, created_at: '2026-10-21T19:06:00Z' } : null, error: null }),
        single: () => Promise.resolve({ data: { id: 'rfi-1', rfi_number: 7 }, error: null }),
        upsert: () => Promise.resolve({ error: null }),
        insert: (row: Record<string, unknown>) => { state.asked.push(row); return table === 'bids_rfis' ? chain : Promise.resolve({ error: null }) },
        update: () => chain,
      }
      return chain
    },
    functions: { invoke: () => Promise.resolve({ data: null, error: { message: 'not here' } }) },
  },
}))
vi.mock('../contracts/formStudio/PdfPageCanvas', () => ({ PdfPageCanvas: () => <div data-testid="pdf-page" /> }))

const bid = { id: 'h1', bid_number: '511', project_name: 'Oak Hollow Dental TI', plans_link: 'https://drive.example/folder' } as unknown as BidWithBuilder

describe('BidPlansPanel', () => {
  it('the plans answer first: the set line, the answer card from the text and the read, the hits, the folds', async () => {
    localStorage.removeItem('pipetooling_plans_panel_seen')
    renderWithProviders(<BidPlansPanel bid={bid} shellBidId="s1" canWrite open onClose={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('plans-set-line').textContent).toMatch(/^3 sheets, 3 plumbing\. Text from the round .*Type a word or a question\.$/))
    expect(screen.getByText('Type a word or a question. The plans answer first. The robot can look after.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Search the plans'), { target: { value: 'is there a grease interceptor on this job?' } })
    expect(screen.getByTestId('plans-answer').textContent).toContain('No sheet mentions grease interceptor.')
    fireEvent.change(screen.getByLabelText('Search the plans'), { target: { value: 'FD-1' } })
    expect(screen.getByTestId('plans-answer').textContent).toContain('is on 2 sheets, first P-201, P-601. The plumbing fixture on P-601 lists FD-1, Floor drain, Zurn Z415.')
    expect(screen.getByTestId('plans-hits').textContent).toContain('P-201')
    fireEvent.click(screen.getByText('Notes with flags'))
    expect(screen.getByTestId('plans-notes').textContent).toContain('Kitchen equipment and its connections by others.')
    expect(screen.getByTestId('plans-notes').textContent).toContain('exclusion')
    fireEvent.click(screen.getByText('Schedules'))
    expect(screen.getByTestId('plans-schedule').textContent).toContain('plumbing fixture on P-601')
    fireEvent.click(screen.getByText('Sheet index'))
    expect(screen.getByTestId('plans-index').textContent).toContain('First floor plumbing')
    expect(localStorage.getItem('pipetooling_plans_panel_seen')).toBe('1')
  })
  it('Open sheet opens the viewer and asks plan-fetch for the set; a refusal says so with the Drive link', async () => {
    renderWithProviders(<BidPlansPanel bid={bid} shellBidId="s1" canWrite open onClose={() => {}} />)
    await settle()
    fireEvent.change(screen.getByLabelText('Search the plans'), { target: { value: 'FD-1' } })
    fireEvent.click(screen.getAllByText('Open sheet')[0]!)
    await waitFor(() => expect(screen.getByTestId('plans-viewer').textContent).toContain('The sheet could not be opened from here.'))
    expect(screen.getByText('Open the plans in Drive').getAttribute('href')).toBe('https://drive.example/folder')
  })
  it('with no rows and no write, says no robot has read it; the button draws only with a bid', async () => {
    state.pages = []
    renderWithProviders(<BidPlansPanel bid={bid} shellBidId={null} canWrite={false} open onClose={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('plans-set-line').textContent).toBe('No robot has read this set yet.'))
    const onOpen = vi.fn()
    const { container } = renderWithProviders(<BidPlansButton bid={null} onOpen={onOpen} />)
    expect(container.textContent).toBe('')
  })
})

describe('Ask the robot to look (v2.5737)', () => {
  it('asks as yourself, shows the once-only count line, and lists the thread with Make this an RFI on an answer that says the plans do not say', async () => {
    state.pages = rows as unknown[]
    state.questions = [
      { id: 'q1', bid_id: 'h1', question: 'Is there a grease interceptor on this job?', asked_by: 'u1', asked_at: '2026-10-21T19:41:00Z', status: 'answered', answer: 'The plans do not show a grease interceptor. Note 14 on P-001 puts the kitchen with others.', sheet_refs: ['P-001', 'P-201'], answered_at: '2026-10-21T19:47:00Z', seen_at: null, rfi_id: null },
      { id: 'q2', bid_id: 'h1', question: 'How many floor drains on the first floor?', asked_by: 'u2', asked_at: '2026-10-21T18:12:00Z', status: 'open', answer: null, sheet_refs: [], answered_at: null, seen_at: null, rfi_id: null },
    ]
    localStorage.removeItem('pipetooling_plans_count_line_seen')
    renderWithProviders(<BidPlansPanel bid={bid} shellBidId="s1" canWrite open onClose={() => {}} userId="u1" shadowSealed />)
    await waitFor(() => expect(screen.getByTestId('plans-thread')).toBeTruthy())
    expect(screen.getByTestId('plans-robot-answer').textContent).toContain('cites P-001, P-201')
    expect(screen.getByText('Open P-001')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Search the plans'), { target: { value: 'how many floor drains' } })
    expect(screen.getByTestId('plans-count-line').textContent).toContain('Counts come after you send.')
    fireEvent.click(screen.getByTestId('plans-ask-robot'))
    await waitFor(() => expect(state.asked.some((r) => r.question === 'how many floor drains' && r.asked_by === 'u1')).toBe(true))
    fireEvent.click(screen.getByTestId('plans-make-rfi'))
    await waitFor(() => expect(state.asked.some((r) => typeof r.question === 'string' && (r.question as string).startsWith('Is there a grease interceptor on this job?') && r.sheet_ref === 'P-001')).toBe(true))
  })
})
