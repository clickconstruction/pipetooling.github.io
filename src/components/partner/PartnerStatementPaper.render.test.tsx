// @vitest-environment jsdom
/**
 * Render smoke for the partner statement paper (v2.2157): letterhead + balance
 * words, the D7 "last statement awaiting sign-off" block only while looking at
 * the open week, lens hides actions, print mode drops buttons and nav.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PartnerStatementPaper, type PartnerStatementPaperProps } from './PartnerStatementPaper'
import type { PartnerSummary, WeekCard } from '../../lib/partnerLedger/partnerWeeks'

const summary: PartnerSummary = {
  exists: true,
  partnership_id: 'p1',
  display_name: 'Bryan',
  balance: -1008.13,
  modules: { weekly_statement: true, costing: true, profit_shares: true },
  current_week: { week_start: '2026-08-23', field_hours: 0, office_hours: 0, farm_hours: 0, gross_so_far: 0, pending_sessions: 0 },
  latest_statement: { pay_stub_id: 's2', period_start: '2026-08-09', period_end: '2026-08-15', partner_ack_at: null, company_ack_at: null },
  rates: { field: 50, estimating: 35, farm: 0 },
  pending_offsets: { count: 0, net: 0 },
}
const mk = (o: Partial<WeekCard>): WeekCard => ({ open: false, weekStart: '2026-08-09', weekEnd: '2026-08-15', stubId: 's2', lines: [], opening: -1258.23, closing: -1008.13, partnerAckAt: null, companyAckAt: null, crossings: [], ...o })
const live = mk({ open: true, weekStart: '2026-08-23', weekEnd: null, stubId: null, opening: -1008.13, closing: -1008.13 })
const last = mk({ lines: [{ label: 'Labor · 12.86 h × $35', amount: 450.1, cls: 'pos' }] })
const older = mk({ weekStart: '2026-03-22', weekEnd: '2026-03-28', stubId: 's1', opening: 0, closing: 60.25, partnerAckAt: '2026-04-01T00:00:00Z' })

const base: PartnerStatementPaperProps = {
  summary,
  cards: [live, last, older],
  idx: 0,
  fullRows: [],
  jobs: { costingOn: true, rows: [{ job_id: 'j1', label: '813', job_name: 'Reliant Health', status: 'billed', confirmed_at: '2026-08-22T00:00:00Z', service_type_name: 'Electrical', profit_share: null }] },
  isMobile: false,
  todayLabel: 'Aug 23, 2026',
  nowYear: 2026,
}

describe('PartnerStatementPaper', () => {
  it('prints the balance with its words and shows the awaiting statement under the open week', () => {
    render(<PartnerStatementPaper {...base} onPrint={vi.fn()} onAcknowledge={vi.fn()} />)
    expect(screen.getByText('Partner statement')).toBeTruthy()
    expect(screen.getByText('You owe Click')).toBeTruthy()
    expect(screen.getByText(/Last statement · Week of Aug 9 · awaiting your sign-off/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Acknowledge statement' })).toBeTruthy()
    expect(screen.getByText('partner since Mar 22, 2026 · field $50 · estimating $35 / h')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Costing ›' })).toBeTruthy()
  })

  it('hides the awaiting block when the reader is already on that week', () => {
    render(<PartnerStatementPaper {...base} idx={1} />)
    expect(screen.queryByText(/Last statement ·/)).toBeNull()
    expect(screen.getByText('Week closed')).toBeTruthy()
  })

  it('lens: no partner actions, ack status as text', () => {
    render(<PartnerStatementPaper {...base} idx={1} lens />)
    expect(screen.queryByRole('button', { name: 'Acknowledge statement' })).toBeNull()
    expect(screen.getByText('Awaiting the partner’s acknowledgment.')).toBeTruthy()
  })

  it('print mode: no buttons at all', () => {
    render(<PartnerStatementPaper {...base} printMode />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.getByText('Week of Aug 23')).toBeTruthy()
  })
})
