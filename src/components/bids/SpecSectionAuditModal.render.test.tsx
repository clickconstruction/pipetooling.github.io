// @vitest-environment jsdom
/**
 * Render smokes for SpecSectionAuditModal — the "Division 22 codes" audit
 * opened from Pricing → Share. Pins: closed renders and reads nothing; open
 * paints the title, the coverage line and the uncoded names worst first (two
 * spellings of one name folded into one row); the coded list is behind its
 * toggle; the three ways out (×, Escape, the backdrop) report onClose; "Pin it"
 * and "No code" each insert ONE exact rule at the audit priority and the name
 * moves to coded without the name list being re-read; a failed load offers
 * Retry; a refused save says why and leaves the name uncoded; an empty ledger
 * reads as nothing to pin. Since v2.5058 the Rules and Sections tabs show each rule's standing and each
 * section's totals from the same load.
 *
 * fetchAllRows and withSupabaseRetry run for real over the table-aware stub.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

import { renderSettled, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { AUDIT_PIN_PRIORITY } from '../../lib/specSectionAudit'
import { SpecSectionAuditModal } from './SpecSectionAuditModal'

type AuditRow = { fixture: string; bid_count: number }
type RuleRow = { id: string; pattern: string; match_kind: string; section_code: string | null; priority: number }
type SectionRow = { code: string; title: string }
type StubError = { message: string; code: string }

const db: {
  audit: AuditRow[]
  rules: RuleRow[]
  sections: SectionRow[]
  auditError: StubError | null
  writeError: StubError | null
  rpcCalls: Array<{ name: string; from: number; to: number }>
  ruleReads: number
  ruleOrders: string[]
  inserted: Record<string, unknown>[]
  updated: Array<{ patch: Record<string, unknown>; id: string }>
} = {
  audit: [],
  rules: [],
  sections: [],
  auditError: null,
  writeError: null,
  rpcCalls: [],
  ruleReads: 0,
  ruleOrders: [],
  inserted: [],
  updated: [],
}

vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: (name: string) => ({
      range: (from: number, to: number) => {
        db.rpcCalls.push({ name, from, to })
        if (db.auditError) return Promise.resolve({ data: null, error: db.auditError, status: 403 })
        return Promise.resolve({ data: db.audit.slice(from, to + 1), error: null, status: 200 })
      },
    }),
    from: (table: string) => {
      if (table === 'spec_section_match_rules') {
        return {
          // The ledger loads sorted (priority, then age): select → order → order, then awaited.
          select: () => {
            db.ruleReads += 1
            const result = Promise.resolve({ data: [...db.rules], error: null, status: 200 })
            type Chain = { order: (col: string) => Chain; then: typeof result.then }
            const chain: Chain = {
              order: (col: string) => {
                db.ruleOrders.push(col)
                return chain
              },
              then: result.then.bind(result),
            }
            return chain
          },
          insert: (row: Record<string, unknown>) => {
            if (db.writeError) return Promise.resolve({ data: null, error: db.writeError })
            db.inserted.push(row)
            // The ledger keeps the row, so the reload that follows a pin sees it.
            db.rules.push({ id: `rule-new-${db.inserted.length}`, ...(row as Omit<RuleRow, 'id'>) })
            return Promise.resolve({ data: null, error: null })
          },
          update: (patch: Record<string, unknown>) => ({
            eq: (_col: string, id: string) => {
              db.updated.push({ patch, id })
              return Promise.resolve({ data: null, error: null })
            },
          }),
        }
      }
      if (table === 'spec_sections') {
        return { select: () => ({ order: () => Promise.resolve({ data: [...db.sections], error: null, status: 200 }) }) }
      }
      return { select: () => Promise.resolve({ data: [], error: null, status: 200 }) }
    },
  },
}))

const SINK_SECTION = '22 42 16 · Commercial Lavatories and Sinks'

beforeEach(() => {
  db.audit = [
    { fixture: 'WC-1', bid_count: 12 },
    { fixture: 'MYSTERY SINK', bid_count: 9 },
    { fixture: 'DEMO', bid_count: 5 },
    { fixture: 'mystery sink', bid_count: 2 },
    { fixture: 'ODD VALVE', bid_count: 1 },
  ]
  db.rules = [
    { id: 'rule-wc', pattern: 'WC-', match_kind: 'starts_with', section_code: '22 42 13', priority: 100 },
    { id: 'rule-demo', pattern: 'DEMO', match_kind: 'exact', section_code: null, priority: 10 },
  ]
  db.sections = [
    { code: '22 42 13', title: 'Commercial Water Closets' },
    { code: '22 42 16', title: 'Commercial Lavatories and Sinks' },
  ]
  db.auditError = null
  db.writeError = null
  db.rpcCalls = []
  db.ruleReads = 0
  db.ruleOrders = []
  db.inserted = []
  db.updated = []
})

/** Mount the open modal and wait for the table the load reveals. */
async function mountLoaded(onClose: () => void = () => {}) {
  return renderSettled(<SpecSectionAuditModal open onClose={onClose} />, {
    loaded: () => screen.findByText('Division 22 section'),
  })
}

/** The grid row that holds a fixture name — its select and its two buttons. */
function rowOf(name: string): HTMLElement {
  const row = screen.getByText(name).parentElement
  if (!row) throw new Error(`no row for ${name}`)
  return row
}

describe('SpecSectionAuditModal', () => {
  it('renders nothing and reads nothing while closed', async () => {
    renderWithProviders(<SpecSectionAuditModal open={false} onClose={() => {}} />)
    await settle()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText('Division 22 codes')).toBeNull()
    expect(db.rpcCalls).toHaveLength(0)
    expect(db.ruleReads).toBe(0)
  })

  it('open shows the title, the coverage line and the uncoded names worst first, one row per name whatever the spelling', async () => {
    await mountLoaded()
    expect(screen.getByRole('dialog', { name: 'Division 22 codes' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Division 22 codes' })).toBeTruthy()
    expect(db.rpcCalls[0]).toEqual({ name: 'spec_section_fixture_name_audit', from: 0, to: 999 })

    // WC-1 (a rule with a section) and DEMO (a rule with none) are covered; two names are gaps.
    expect(screen.getByText('2 coded')).toBeTruthy()
    expect(screen.getByText('2 uncoded')).toBeTruthy()
    expect(screen.getByRole('dialog').textContent).toContain('50%')

    const sink = rowOf('MYSTERY SINK')
    expect(within(sink).getByText('also spelled mystery sink')).toBeTruthy()
    expect(within(sink).getByText('11 bids')).toBeTruthy()
    expect(within(rowOf('ODD VALVE')).getByText('1 bid')).toBeTruthy()
    expect(sink.compareDocumentPosition(rowOf('ODD VALVE')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    // Coded names stay folded away until asked for.
    expect(screen.queryByText('WC-1')).toBeNull()
    expect(screen.queryByText('DEMO')).toBeNull()
  })

  it('Show coded names lists each coded name with the rule that decided it, and hides them again', async () => {
    await mountLoaded()
    fireEvent.click(screen.getByRole('button', { name: 'Show 2 coded names' }))

    const wc = rowOf('WC-1')
    expect(within(wc).getByText('22 42 13')).toBeTruthy()
    expect(wc.textContent).toContain('via “starts with WC-”')
    expect(within(wc).getByText('12 bids')).toBeTruthy()
    const demo = rowOf('DEMO')
    expect(within(demo).getByText('no code (deliberate)')).toBeTruthy()
    expect(demo.textContent).toContain('via “exactly DEMO”')
    // A coded row has nothing to pin.
    expect(within(wc).queryByRole('button')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Hide coded names' }))
    expect(screen.queryByText('WC-1')).toBeNull()
    expect(screen.getByRole('button', { name: 'Show 2 coded names' })).toBeTruthy()
  })

  it('the × button, the Escape key and a click on the backdrop each report onClose; a click inside the panel does not', async () => {
    const onClose = vi.fn()
    await mountLoaded(onClose)
    const dialog = screen.getByRole('dialog', { name: 'Division 22 codes' })

    fireEvent.click(dialog)
    fireEvent.click(screen.getByText('Fixture name'))
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)

    const backdrop = dialog.parentElement
    if (!backdrop) throw new Error('the dialog has no backdrop')
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('Pin it waits for a section, then writes one exact rule at the audit priority and the name moves to coded', async () => {
    await mountLoaded()
    const sink = rowOf('MYSTERY SINK')
    const pinIt = within(sink).getByRole('button', { name: 'Pin it' }) as HTMLButtonElement
    expect(pinIt.disabled).toBe(true)

    fireEvent.click(within(sink).getByRole('combobox'))
    fireEvent.click(await screen.findByRole('option', { name: SINK_SECTION }))
    expect(within(sink).getByRole('combobox').textContent).toContain(SINK_SECTION)
    expect(pinIt.disabled).toBe(false)

    const rpcCallsBefore = db.rpcCalls.length
    fireEvent.click(pinIt)
    await waitFor(() => expect(db.inserted).toHaveLength(1))
    expect(db.inserted[0]).toEqual({
      pattern: 'MYSTERY SINK',
      match_kind: 'exact',
      section_code: '22 42 16',
      priority: AUDIT_PIN_PRIORITY,
    })
    expect(db.updated).toHaveLength(0)

    // The rules are re-read and the name is classified again here — the name list is not fetched twice.
    expect(await screen.findByText('3 coded')).toBeTruthy()
    expect(screen.getByText('1 uncoded')).toBeTruthy()
    expect(screen.queryByText('MYSTERY SINK')).toBeNull()
    expect(screen.getByText('ODD VALVE')).toBeTruthy()
    expect(db.rpcCalls).toHaveLength(rpcCallsBefore)

    fireEvent.click(screen.getByRole('button', { name: 'Show 3 coded names' }))
    expect(within(rowOf('MYSTERY SINK')).getByText('22 42 16')).toBeTruthy()
  })

  it('No code writes an exact rule with no section, and the name stops counting as a gap', async () => {
    await mountLoaded()
    fireEvent.click(within(rowOf('ODD VALVE')).getByRole('button', { name: 'No code' }))
    await waitFor(() => expect(db.inserted).toHaveLength(1))
    expect(db.inserted[0]).toEqual({
      pattern: 'ODD VALVE',
      match_kind: 'exact',
      section_code: null,
      priority: AUDIT_PIN_PRIORITY,
    })

    expect(await screen.findByText('3 coded')).toBeTruthy()
    expect(screen.getByText('1 uncoded')).toBeTruthy()
    expect(screen.queryByText('ODD VALVE')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show 3 coded names' }))
    expect(within(rowOf('ODD VALVE')).getByText('no code (deliberate)')).toBeTruthy()
  })

  it('a load that fails shows the reason and a Retry button, and Retry loads the audit', async () => {
    db.auditError = { message: 'permission denied for function spec_section_fixture_name_audit', code: '42501' }
    await renderSettled(<SpecSectionAuditModal open onClose={() => {}} />, {
      loaded: () => screen.findByText(/permission denied for function/),
    })
    expect(screen.getByRole('heading', { name: 'Division 22 codes' })).toBeTruthy()
    expect(screen.queryByText('Division 22 section')).toBeNull()
    expect(screen.queryByText('MYSTERY SINK')).toBeNull()

    db.auditError = null
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('MYSTERY SINK')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
    expect(screen.getByText('2 uncoded')).toBeTruthy()
  })

  it('a refused save says why and leaves the name uncoded', async () => {
    db.writeError = { message: 'new row violates row-level security policy', code: '42501' }
    await mountLoaded()
    const rulesReadBefore = db.ruleReads
    fireEvent.click(within(rowOf('ODD VALVE')).getByRole('button', { name: 'No code' }))

    expect(await screen.findByText("You don't have permission to save the rule.")).toBeTruthy()
    expect(db.inserted).toHaveLength(0)
    expect(db.ruleReads).toBe(rulesReadBefore)
    expect(screen.getByText('2 uncoded')).toBeTruthy()
    const noCode = within(rowOf('ODD VALVE')).getByRole('button', { name: 'No code' }) as HTMLButtonElement
    await waitFor(() => expect(noCode.disabled).toBe(false))
  })

  it('a save the server turns down for another reason shows the server\u2019s own words', async () => {
    db.writeError = { message: 'duplicate key value violates unique constraint "spec_section_match_rules_pattern_key"', code: '23505' }
    await mountLoaded()
    fireEvent.click(within(rowOf('ODD VALVE')).getByRole('button', { name: 'No code' }))
    expect(await screen.findByText('Failed to save the rule: duplicate key value violates unique constraint "spec_section_match_rules_pattern_key"')).toBeTruthy()
    expect(db.inserted).toHaveLength(0)
  })

  it('with every name coded there is nothing to pin', async () => {
    db.audit = [
      { fixture: 'WC-1', bid_count: 12 },
      { fixture: 'DEMO', bid_count: 5 },
    ]
    await mountLoaded()
    expect(screen.getByText(/Every name has a code/)).toBeTruthy()
    expect(screen.getByText('2 coded')).toBeTruthy()
    expect(screen.getByText('0 uncoded')).toBeTruthy()
    expect(screen.getByRole('dialog').textContent).toContain('100%')
    expect(screen.queryByRole('button', { name: 'Pin it' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'No code' })).toBeNull()
  })
})

describe('SpecSectionAuditModal tabs (v2.5058, the rules manager read side)', () => {
  it('opens on Names; the Rules tab lists every section with its rules in deciding order and each rule\'s standing', async () => {
    await mountLoaded()
    expect(screen.getByRole('tab', { name: 'Names' }).getAttribute('aria-selected')).toBe('true')
    fireEvent.click(screen.getByRole('tab', { name: 'Rules' }))
    const panel = screen.getByRole('tabpanel', { name: 'Rules' })

    const closets = within(panel).getByRole('region', { name: '22 42 13 Commercial Water Closets' })
    expect(within(closets).getByText('starts with WC-')).toBeTruthy()
    expect(within(closets).getByText('Decides 1 name on 12 bids')).toBeTruthy()
    expect(within(closets).getByText('order 100 · patterns')).toBeTruthy()

    // A section no rule files names under still shows, and says so.
    const sinks = within(panel).getByRole('region', { name: '22 42 16 Commercial Lavatories and Sinks' })
    expect(within(sinks).getByText('No rule files names here yet.')).toBeTruthy()

    // The deliberate no-code rules come last, with what they decide.
    const noCode = within(panel).getByRole('region', { name: 'No code (deliberately)' })
    expect(within(noCode).getByText('exactly DEMO')).toBeTruthy()
    expect(within(noCode).getByText('Decides 1 name on 5 bids')).toBeTruthy()
    expect(closets.compareDocumentPosition(noCode) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('a rule an earlier rule always beats says which rule gets its names first; one that catches nothing says so', async () => {
    db.rules.push(
      { id: 'rule-wc1-late', pattern: 'WC-1', match_kind: 'contains', section_code: '22 42 16', priority: 500 },
      { id: 'rule-idle', pattern: 'ZZZ', match_kind: 'contains', section_code: '22 42 16', priority: 600 },
    )
    await mountLoaded()
    fireEvent.click(screen.getByRole('tab', { name: 'Rules' }))
    const sinks = within(screen.getByRole('tabpanel', { name: 'Rules' })).getByRole('region', { name: '22 42 16 Commercial Lavatories and Sinks' })
    expect(within(sinks).getByText('Never decides: “starts with WC-” gets its names first')).toBeTruthy()
    expect(within(sinks).getByText('Catches no name yet')).toBeTruthy()
  })

  it('Find narrows the Rules tab to matching rules or sections, and says when nothing matches', async () => {
    await mountLoaded()
    fireEvent.click(screen.getByRole('tab', { name: 'Rules' }))
    const panel = screen.getByRole('tabpanel', { name: 'Rules' })
    fireEvent.change(within(panel).getByRole('searchbox', { name: 'Find a rule or a section' }), { target: { value: 'demo' } })
    expect(within(panel).getByText('exactly DEMO')).toBeTruthy()
    expect(within(panel).queryByText('starts with WC-')).toBeNull()
    fireEvent.change(within(panel).getByRole('searchbox', { name: 'Find a rule or a section' }), { target: { value: 'nothing like it' } })
    expect(within(panel).getByText('No rule or section matches “nothing like it”.')).toBeTruthy()
  })

  it('the Sections tab totals each section\'s rules, names and bids, the no-code line last', async () => {
    await mountLoaded()
    fireEvent.click(screen.getByRole('tab', { name: 'Sections' }))
    const rows = within(screen.getByRole('tabpanel', { name: 'Sections' })).getAllByRole('row').map((r) => r.textContent)
    expect(rows).toEqual([
      'SectionTitleRulesNamesBids',
      '22 42 13Commercial Water Closets1112',
      '22 42 16Commercial Lavatories and Sinks000',
      '—No code (deliberately)115',
    ])
  })

  it('the ledger is read sorted, priority then age, so equal orders decide the same way on every load', async () => {
    await mountLoaded()
    expect(db.ruleReads).toBe(1)
    expect(db.ruleOrders).toEqual(['priority', 'created_at'])
  })
})
