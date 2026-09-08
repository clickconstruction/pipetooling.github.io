// @vitest-environment jsdom
/**
 * Render smokes for BidsAuditsTab (v2.2549 cockpit) — the robot feedback loop's
 * human side: triage rows with one card expanded, quick links + question answer
 * box + single sectioned composer + Finish audit; digested history stays
 * collapsed behind a toggle.
 */
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'

import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BidsAuditsTab } from './BidsAuditsTab'
import type { BidAuditNoteRow } from '../../lib/bids/bidAudits'

const audits = [
  {
    id: 'a1',
    bid_id: 'bid-405',
    ct_project_id: 'ct-1',
    ct_view_url: 'https://counttooling.com/app/?t=tok',
    status: 'pending',
    requested_at: '2026-08-30T20:00:00Z',
    completed_at: null,
    completed_by: null,
    digested_at: null,
    created_by: null,
    created_at: '2026-08-30T20:00:00Z',
    updated_at: '2026-08-30T20:00:00Z',
    bids: { id: 'bid-405', bid_number: '405', project_name: 'ZZ Twin MPH CASA LINDA (backtest)', selected_bid_version_id: null },
  },
  {
    id: 'a2',
    bid_id: 'bid-300',
    ct_project_id: null,
    ct_view_url: null,
    status: 'digested',
    requested_at: '2026-08-20T20:00:00Z',
    completed_at: '2026-08-21T20:00:00Z',
    completed_by: 'u-w',
    digested_at: '2026-08-22T20:00:00Z',
    created_by: null,
    created_at: '2026-08-20T20:00:00Z',
    updated_at: '2026-08-22T20:00:00Z',
    bids: { id: 'bid-300', bid_number: '300', project_name: 'Old Backtest', selected_bid_version_id: null },
  },
  {
    // v2.2796: the robot opened this audit before pasting counts — no PT rows at all.
    id: 'a3',
    bid_id: 'bid-422',
    ct_project_id: 'ct-3',
    ct_view_url: 'https://counttooling.com/app/?t=tok3',
    status: 'pending',
    requested_at: '2026-08-31T23:16:00Z',
    completed_at: null,
    completed_by: null,
    digested_at: null,
    created_by: null,
    created_at: '2026-08-31T23:16:00Z',
    updated_at: '2026-08-31T23:16:00Z',
    bids: { id: 'bid-422', bid_number: '422', project_name: 'ZZ Twin AISD GARCIA SCHOOL RENOVATION (backtest)', selected_bid_version_id: null },
  },
]

// Only bid-405 has rows in PipeTooling; the tab filters by bid_id client-side.
const countRows = [{ id: 'r1', fixture: 'WC-1', count: 3, bid_version_id: null, bid_id: 'bid-405' }]
const assignments = [{ bid_id: 'bid-405', count_row_id: 'r1', price_book_entry_id: null, unit_price_override: 1000 }]

const notes: Array<Partial<BidAuditNoteRow> & { audit_id: string }> = [
  { id: 'q1', audit_id: 'a1', bid_id: 'bid-405', section: 'general', kind: 'question', body: 'Wet tables owner-furnished?', parent_id: null, created_at: '2026-08-30T20:01:00Z', author_id: null, digested_at: null, digest_outcome: null },
  { id: 'n1', audit_id: 'a1', bid_id: 'bid-405', section: 'footage', kind: 'note', body: 'Waste footage way low.', parent_id: null, created_at: '2026-08-30T21:00:00Z', author_id: null, digested_at: null, digest_outcome: null },
  { id: 'r1', audit_id: 'a1', bid_id: 'bid-405', section: 'footage', kind: 'receipt', body: 'Learned: developed-length multiplier.', parent_id: 'n1', created_at: '2026-08-30T22:00:00Z', author_id: null, digested_at: null, digest_outcome: 'doctrine' },
]

// Standing rulings (v2.2941): two open questions share the travel-bands topic
// (they collapse into one ruling), one is topicless (lists individually).
const twinQuestions = [
  { id: 'tq1', twin_user_id: 'tw1', about_bid_id: 'bid-405', mission: 'BT-12', question: 'Do we band travel by distance?', status: 'open', answer: null, answered_by: null, answered_at: null, created_at: '2026-09-03T10:00:00Z', topic: 'travel-bands' },
  { id: 'tq2', twin_user_id: 'tw2', about_bid_id: 'bid-422', mission: 'BT-13', question: 'Travel past 200 miles — carry $20k?', status: 'open', answer: null, answered_by: null, answered_at: null, created_at: '2026-09-01T10:00:00Z', topic: 'travel-bands' },
  { id: 'tq3', twin_user_id: 'tw1', about_bid_id: null, mission: null, question: '[audit b474 / scope] Is a strip mall shell a no-go?', status: 'open', answer: null, answered_by: null, answered_at: null, created_at: '2026-09-02T10:00:00Z', topic: null },
]

// Chainable thenable PostgREST stub: every builder method returns itself; awaiting
// resolves to the table's canned rows.
function tableResult(table: string): unknown {
  const data =
    table === 'bid_audits' ? audits :
    table === 'bid_audit_notes' ? notes :
    table === 'bids_count_rows' ? countRows :
    table === 'bid_pricing_assignments' ? assignments :
    table === 'twin_questions' ? twinQuestions :
    table === 'bids' ? [{ id: 'bid-474', bid_number: '474' }, { id: 'bid-405', bid_number: '405' }, { id: 'bid-422', bid_number: '422' }] :
    []
  const chain: Record<string, unknown> = {}
  const self = () => chain
  for (const m of ['select', 'order', 'limit', 'in', 'eq', 'insert', 'update', 'range']) chain[m] = self
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve)
  return chain
}

vi.mock('../../lib/supabase', () => ({
  supabase: { from: (table: string) => tableResult(table) },
}))

// The twin write-fence hook needs AuthProvider; the smokes only care that a
// non-twin renders, so stub it false.
vi.mock('../../hooks/useIsDigitalTwin', () => ({ useIsDigitalTwin: () => false }))

describe('BidsAuditsTab', () => {
  it('renders the pending card: links, question, note + receipt, Finish audit', async () => {
    renderWithProviders(<BidsAuditsTab authUser={null} myRole="dev" />)
    await waitFor(() => expect(screen.getByText(/ZZ Twin MPH CASA LINDA/)).toBeTruthy())
    // Auto-expand of the first pending card lands one effect-tick after the row renders.
    await waitFor(() => expect(screen.getByText('Open takeoff (CountTooling) ↗')).toBeTruthy())

    const ctLink = screen.getByText('Open takeoff (CountTooling) ↗') as HTMLAnchorElement
    expect(ctLink.getAttribute('href')).toBe('https://counttooling.com/app/?t=tok')
    expect(ctLink.getAttribute('target')).toBe('_blank')
    const ptLink = screen.getByText('Open bid (ClickTooling) ↗') as HTMLAnchorElement
    expect(ptLink.getAttribute('href')).toBe('/bids?tab=counts&bidId=bid-405')
    expect(ptLink.getAttribute('target')).toBe('_blank')

    // Notes land on a second query after the audit rows render — wait for them.
    expect(await screen.findByText(/Wet tables owner-furnished\?/)).toBeTruthy()
    expect(screen.getByPlaceholderText('Type your answer…')).toBeTruthy()
    expect(screen.getByText('Waste footage way low.')).toBeTruthy()
    expect(screen.getByText(/Learned: developed-length multiplier/)).toBeTruthy()
    expect(screen.getAllByText(/placement doctrine/).length).toBeGreaterThan(0) // receipt label + coaching strip
    expect(screen.getByText('Finish audit')).toBeTruthy()

    // One composer with section chips on a pending card (cockpit rework).
    expect(screen.getByPlaceholderText(/Anything off\?/)).toBeTruthy()
    expect(screen.getByText('Add note')).toBeTruthy()

    // Digested history is collapsed behind the toggle.
    expect(screen.queryByText('Old Backtest')).toBeNull()
    expect(screen.getByText(/Show digested audits \(1\)/)).toBeTruthy()

    // v2.2796: the audit with no PT count rows is a "Robot still working" row —
    // never "draft $0 · −100% vs ours" — and it did not steal the auto-expand.
    expect(screen.getByText('Robot still working')).toBeTruthy()
    expect(screen.getByText('no counts in PipeTooling yet')).toBeTruthy()
    expect(screen.getAllByText(/draft \$3,000/).length).toBeGreaterThan(0) // the priced card, not $0
    expect(screen.queryByText(/draft \$0\b/)).toBeNull()
    expect(screen.queryByText(/-100\.0% vs ours/)).toBeNull()

    // v2.2941 — Standing rulings: the two travel-bands questions collapse into
    // one ruling (newest text on top, one answer box for both); the topicless
    // one lists individually. Expanded by default because N > 0.
    expect(await screen.findByText(/Standing rulings · 3/)).toBeTruthy()
    expect(screen.getByText(/fifteen minutes here unblocks every robot/)).toBeTruthy()
    expect(screen.getByText('Travel bands')).toBeTruthy()
    expect(screen.getByText(/Do we band travel by distance\?/)).toBeTruthy()
    expect(screen.getByText('asked 2 times across 2 bids')).toBeTruthy()
    expect(screen.getByText('Answer all 2')).toBeTruthy()
    expect(screen.getByText(/Is a strip mall shell a no-go\?/)).toBeTruthy()
    // v2.3174 — the bid number inside a question is a link to its board row.
    const bidLink = await screen.findByRole('link', { name: 'b474' })
    expect(bidLink.getAttribute('href')).toBe('/bids?tab=bid-board&bidId=bid-474')
    // …and a question that never names its bid gets a trailing link to the bid it is about.
    const trailing = await screen.findByRole('link', { name: 'b405' })
    expect(trailing.getAttribute('href')).toBe('/bids?tab=bid-board&bidId=bid-405')

    // v2.2941 — doctrine-at-stake triage caption on a multi-pending queue.
    expect(screen.getByText('sorted by what your verdict unblocks')).toBeTruthy()
  })

  it('read-only roles (write RLS mirror) see the card without composers or Finish audit', async () => {
    renderWithProviders(<BidsAuditsTab authUser={null} myRole="superintendent" />)
    await waitFor(() => expect(screen.getByText(/ZZ Twin MPH CASA LINDA/)).toBeTruthy())

    // Content still renders… The audit row lands first; the auto-expand is an
    // effect tick later and the notes come back on a second query, so wait for
    // the note text itself (v2.2753 — this read raced on a loaded CI runner).
    expect(await screen.findByText(/Wet tables owner-furnished\?/)).toBeTruthy()
    expect(screen.getByText('Waste footage way low.')).toBeTruthy()

    // …but every write surface is gone: answer box, composer, Finish audit.
    expect(screen.queryByPlaceholderText('Type your answer…')).toBeNull()
    expect(screen.queryByPlaceholderText(/Anything off\?/)).toBeNull()
    expect(screen.queryByText('Finish audit')).toBeNull()
    expect(screen.getByText(/view only for your role/)).toBeTruthy()

    // v2.2941 — the Standing rulings panel is write-audience only.
    expect(screen.queryByText(/Standing rulings/)).toBeNull()
  })
})
