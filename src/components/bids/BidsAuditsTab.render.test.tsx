// @vitest-environment jsdom
/**
 * Render smokes for BidsAuditsTab (v2.2549 cockpit) — the robot feedback loop's
 * human side: triage rows with one card expanded, quick links + question answer
 * box + single sectioned composer + Finish audit; digested history stays
 * collapsed behind a toggle.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

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
  // v2.3210: a tap-answerable ask — the robot's pick renders first, filled.
  { id: 'tq3', twin_user_id: 'tw1', about_bid_id: null, mission: null, question: '[audit b474 / scope] Is a strip mall shell a no-go?', status: 'open', answer: null, answered_by: null, answered_at: null, created_at: '2026-09-02T10:00:00Z', topic: null, choices: ['No-go', 'Bid it'], recommended: 'Bid it' },
  // v2.3186 — the robot talking to the operator, not the estimator: classified
  // from the text (no audience column yet), it must NOT appear on the panel.
  { id: 'tq4', twin_user_id: 'tw1', about_bid_id: 'bid-422', mission: 'R2-BT-25', question: 'The sandbox blocked the bids_plan_substrates insert — can someone add a harness verb?', status: 'open', answer: null, answered_by: null, answered_at: null, created_at: '2026-09-04T10:00:00Z', topic: null },
  // v2.3212: a PLANS ask — a task on the bid, pointed at from the panel, never counted as a ruling.
  { id: 'tq5', twin_user_id: 'tw1', about_bid_id: 'bid-405', mission: null, question: 'SpaceX Level 1: the file on the bid is the electrical set. Attach the plumbing sheets?', status: 'open', answer: null, answered_by: null, answered_at: null, created_at: '2026-09-05T10:00:00Z', topic: null, kind: 'plans', choices: ['Attached — rerun', 'Use what is on the bid', 'Skip this bid'], recommended: 'Attached — rerun' },
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
    // v2.3187: bid-474 is a ZZ Twin copy paired to the human bid-214 (its "ours" link).
    table === 'bids' ? [{ id: 'bid-474', bid_number: '474', twin_source_bid_id: 'bid-214' }, { id: 'bid-214', bid_number: '214', twin_source_bid_id: null }, { id: 'bid-405', bid_number: '405', twin_source_bid_id: null }, { id: 'bid-422', bid_number: '422', twin_source_bid_id: null }] :
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
    expect(screen.getAllByText(/placement doctrine/).length).toBeGreaterThan(0) // the receipt's label
    // v2.4230: the coaching strip left the tab (its "recent runs" were the oldest audits; the Scoreboard says both facts).
    expect(screen.queryByText(/Coaching record/)).toBeNull()
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

    // v2.4232 — the sentence that sizes today and the one button; the panel reads
    // Questions · 3 (the two travel-bands questions are one; the plans ask is not counted)
    // with one line per question: the shared one first, its chip and its bids, then the
    // single with its ★ pick.
    expect(await screen.findByText(/Today: 3 questions, about two minutes\. Then 1 audit\./)).toBeTruthy()
    expect(screen.getByText(/Questions · 3/)).toBeTruthy()
    expect(screen.getByText(/1 asked twice/)).toBeTruthy()
    const lines = screen.getAllByTestId('question-line')
    expect(lines).toHaveLength(2)
    expect(lines[0]!.textContent).toMatch(/Travel bands.*2 bids.*Do we band travel by distance\?.*no pick/)
    expect(lines[1]!.textContent).toMatch(/Is a strip mall shell a no-go\?.*★ Bid it/)
    // The cards and their buttons are gone from the panel; the sheet answers.
    expect(screen.queryByRole('button', { name: '★ Bid it' })).toBeNull()
    expect(screen.queryByPlaceholderText('Your ruling — answers every copy at once…')).toBeNull()

    // v2.3212 — the plans ask is not a line and not in the count (still · 3); the
    // panel points at the bid's needs sheet instead.
    expect(screen.queryByText(/Attach the plumbing sheets/)).toBeNull()
    const plansLine = screen.getByTestId('rulings-plans-asks')
    expect(plansLine.textContent).toMatch(/one bid needs a different plan set/)
    const link = plansLine.querySelector('a') as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('/bids?tab=bid-board&bidId=bid-405&robot=needs')

    // v2.3186 — the operator-lane question is filtered out (still 3 on the header),
    // dev sees the count pointing at the console.
    expect(screen.queryByText(/sandbox blocked the bids_plan_substrates/)).toBeNull()
    expect(screen.getByText(/1 robot problem for the operator/)).toBeTruthy()

    // The run-through: Answer the 3 questions → question 1 is the shared one with its box
    // ("answers every copy"), → skips to the tap-answerable one with the ★ first, and every
    // "b474" in a question is still a link to its bid, "ours b214" beside it (v2.3174/v2.3187).
    fireEvent.click(screen.getByRole('button', { name: 'Answer the 3 questions' }))
    // Two steps for three questions: the shared one answers two copies at once.
    expect(await screen.findByText('Question 1 of 2')).toBeTruthy()
    const sheet = screen.getByTestId('ruling-run-through')
    expect(sheet.textContent).toMatch(/Travel bands/)
    expect(sheet.textContent).toMatch(/Do we band travel by distance\?/)
    expect(screen.getByText('asked on 2 bids · b405 · b422')).toBeTruthy()
    expect(screen.getByPlaceholderText('Your ruling — answers every copy at once…')).toBeTruthy()
    expect(screen.getByText('Answer all 2')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(await screen.findByText('Question 2 of 2')).toBeTruthy()
    expect(screen.getByRole('button', { name: /1 ★ Bid it/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /2 No-go/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /3 Something else…/ })).toBeTruthy()
    const bidLink = await screen.findByRole('link', { name: 'b474' })
    expect(bidLink.getAttribute('href')).toBe('/bids?tab=bid-board&bidId=bid-474')
    const ours = await screen.findByRole('link', { name: 'ours b214' })
    expect(ours.getAttribute('href')).toBe('/bids?tab=bid-board&bidId=bid-214')
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy()
    // "Not mine" stays hidden: the mock rows carry no `audience` column to write.
    expect(screen.queryByRole('button', { name: 'Not mine' })).toBeNull()
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByTestId('ruling-run-through')).toBeNull())

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

    // v2.2941 — the questions panel (and v2.4232's sentence and button) are write-audience only.
    expect(screen.queryByText(/Questions · /)).toBeNull()
    expect(screen.queryByTestId('audits-today')).toBeNull()
  })
})
