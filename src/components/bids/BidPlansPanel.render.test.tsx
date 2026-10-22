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
const state = { pages: rows as unknown[] }
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => (table === 'bids_plan_pages' ? Promise.resolve({ data: state.pages, error: null }) : chain),
        limit: () => chain,
        maybeSingle: () => Promise.resolve({ data: table === 'bids_plan_substrates' ? { substrate, created_at: '2026-10-21T19:06:00Z' } : null, error: null }),
        upsert: () => Promise.resolve({ error: null }),
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
