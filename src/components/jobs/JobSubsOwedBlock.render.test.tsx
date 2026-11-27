// @vitest-environment jsdom
/**
 * Render smoke for *Subs on this job* (punch list #346), the block in the job window's Costs tab: each person the
 * job's sheets are owed to, their sheets, the sum that adds up, the same-line warning and the doors.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { JobSubsOwedView } from './JobSubsOwedBlock'
import { buildJobOwedBlock, type OwedSheetInput } from '../../lib/people/subOwedBreakdown'
import type { NeedsWorkOrderRosterPerson } from '../../lib/subWorkOrders/rosterSub'
import { buildSheetPartiesLookup, sheetParties } from '../../lib/subWorkOrders/sheetParties'
import { WE_OWE_NOTHING } from '../../lib/subWorkOrders/subPaymentsLedger'

// Made-up people and sheets.
const ROSTER: NeedsWorkOrderRosterPerson[] = [
  { id: 'harlan', name: 'Harlan Mechanical', kind: 'sub', accountRole: 'subcontractor' },
  { id: 'marlow', name: 'Marlow Tile', kind: 'sub', accountRole: 'subcontractor' },
  { id: 'owen', name: 'Owen Farris', kind: 'helper', accountRole: 'helpers' },
]
const lookup = buildSheetPartiesLookup(ROSTER)
const READY = { kind: 'ready' as const, label: 'Ready', detail: 'customer paid', tone: 'green' as const, rank: 0 }

function sheet(id: string, people: string[], lines: Array<[string, number]>, paid = 0): OwedSheetInput {
  const s = {
    id,
    assigned_to_name: people.map((p) => ROSTER.find((r) => r.id === p)!.name).join(' | '),
    job_number: '2041',
    job_ledger_id: 'job-cedar',
    address: '418 Larkspur Ln',
    labor_rate: null,
    job_date: '2026-10-28',
    created_at: '2026-10-28T15:00:00Z',
    items: lines.map(([fixture, amount]) => ({ fixture, count: 1, hrs_per_unit: 0, direct_labor_amount: amount })),
    payments: paid > 0 ? [{ id: `${id}-p`, amount: paid, memo: null, created_at: '2026-10-31T15:00:00Z', payment_date: '2026-10-31' }] : [],
  }
  const assignees = people.map((p) => ({ personId: p, personName: ROSTER.find((r) => r.id === p)!.name }))
  return { sheet: s, parties: sheetParties(s, assignees, lookup), payWhen: READY, jobId: 'job-cedar', jobName: 'Cedar Hollow Clinic' } as unknown as OwedSheetInput
}

const BLOCK = buildJobOwedBlock([sheet('s1', ['harlan'], [['Top-out', 1800]], 600), sheet('s2', ['marlow'], [['Top-out', 1800]]), sheet('s3', ['owen'], [['Stayed late', 150]])])

function draw() {
  const onOpenSheet = vi.fn()
  const onOpenPerson = vi.fn()
  const onShowSheets = vi.fn()
  render(<JobSubsOwedView title="#2041 Cedar Hollow Clinic · subs on this job" block={BLOCK} onOpenSheet={onOpenSheet} onOpenPerson={onOpenPerson} onShowSheets={onShowSheets} />)
  return { onOpenSheet, onOpenPerson, onShowSheets }
}

afterEach(cleanup)

describe('JobSubsOwedView', () => {
  it('lists each person the job owes, a teammate with their own sheet among them, and a sum that adds up', () => {
    draw()
    const text = screen.getByTestId('job-subs-owed').textContent ?? ''
    expect(text).toContain('Harlan Mechanical')
    expect(text).toContain('Marlow Tile')
    // Taunya's rule of 2026-11-15: one teammate and no sub is that teammate's, owed as sub labor.
    expect(text).toContain('Owen Farris')
    expect(text).toContain('Team · sub labor')
    expect(text).toContain(BLOCK.sumWords)
    expect(text).toContain('✓ adds up')
    expect(BLOCK.open).toBe(3150)
  })
  it('warns when two sheets of the job carry the same line and amount, with a door to them', () => {
    const { onShowSheets } = draw()
    expect(screen.getByRole('alert').textContent).toContain('Top-out')
    fireEvent.click(screen.getByRole('button', { name: 'Show the sheets ›' }))
    expect(onShowSheets).toHaveBeenCalledTimes(1)
  })
  it('a person paid in full reads settled, the Ledger’s own word, and never paid up (finding 314)', () => {
    const block = buildJobOwedBlock([sheet('s1', ['harlan'], [['Top-out', 1800]], 1800), sheet('s2', ['marlow'], [['Trim', 900]])])
    render(<JobSubsOwedView title="#2041 Cedar Hollow Clinic · subs on this job" block={block} onOpenSheet={vi.fn()} onOpenPerson={vi.fn()} onShowSheets={vi.fn()} />)
    const text = screen.getByTestId('job-subs-owed').textContent ?? ''
    expect(text).toContain(`Harlan Mechanical`)
    expect(text).toContain(WE_OWE_NOTHING)
    expect(WE_OWE_NOTHING).toBe('settled')
    expect(text).not.toContain('paid up')
  })
  it('a sheet opens on the Pay view', () => {
    const { onOpenSheet } = draw()
    fireEvent.click(screen.getAllByRole('button', { name: 'Open the sheet ›' })[0]!)
    expect(onOpenSheet).toHaveBeenCalledTimes(1)
  })
})
