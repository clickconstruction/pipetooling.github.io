// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { RideAlongCleanUpWindowView } from './RideAlongCleanUpWindow'
import { rideAlongCleanUp } from '../../lib/subWorkOrders/rideAlongCleanUp'
import type { NeedsWorkOrderRosterPerson } from '../../lib/subWorkOrders/rosterSub'
import { buildSheetPartiesLookup, sheetParties } from '../../lib/subWorkOrders/sheetParties'

// Made-up people and sheets.
const ROSTER: NeedsWorkOrderRosterPerson[] = [
  { id: 'harlan', name: 'Harlan Mechanical', kind: 'sub', accountRole: 'subcontractor' },
  { id: 'marlow', name: 'Marlow Tile', kind: 'sub', accountRole: 'subcontractor' },
  { id: 'dana', name: 'Dana Whitlock', kind: 'sub', accountRole: 'superintendent' },
]
const lookup = buildSheetPartiesLookup(ROSTER)
const party = (...ids: string[]) => sheetParties({ assigned_to_name: null }, ids.map((id) => ({ personId: id, personName: null })), lookup)
const CLEAN_UP = rideAlongCleanUp([
  { id: 'a', label: '2041 Cedar Hollow Clinic', day: '2026-08-25', parties: party('harlan', 'dana'), total: 500, open: 0 },
  { id: 'b', label: '2049 Mill Street Bakery', day: '2026-09-17', parties: party('marlow', 'dana'), total: 2150, open: 2150 },
  { id: 'c', label: '2033 Alder Court Remodel', day: '2026-09-12', parties: party('harlan', 'marlow', 'dana'), total: 1200, open: 1200 },
])

function draw(outcome: Parameters<typeof RideAlongCleanUpWindowView>[0]['outcome'] = null) {
  const onRun = vi.fn()
  const onOpenSheet = vi.fn()
  render(<RideAlongCleanUpWindowView cleanUp={CLEAN_UP} busy={false} outcome={outcome} onRun={onRun} onOpenSheet={onOpenSheet} onClose={() => {}} />)
  return { onRun, onOpenSheet }
}

afterEach(cleanup)

describe('RideAlongCleanUpWindowView', () => {
  it('ticks every ready sheet, holds the one with two subs, and the press names both counts', () => {
    draw()
    expect(screen.getAllByTestId('ride-along-row')).toHaveLength(2)
    expect(screen.getByTestId('ride-along-held').textContent).toContain('It names two subs. Say whose it is first.')
    expect(screen.getByRole('button', { name: 'Take teammates off 2 sheets · 1 needs a look first ▸' })).toBeTruthy()
    expect(screen.getByTestId('ride-along-effect').textContent).toContain('$2,150.00 is open on them before, and $2,150.00 after.')
  })
  it('runs only what is ticked, and the hold does not stop it', () => {
    const { onRun } = draw()
    fireEvent.click(screen.getByLabelText('2041 Cedar Hollow Clinic, Harlan Mechanical'))
    fireEvent.click(screen.getByRole('button', { name: 'Take teammates off 1 sheet · 1 needs a look first ▸' }))
    expect(onRun).toHaveBeenCalledTimes(1)
    expect(onRun.mock.calls[0]![0].map((r: { sheetId: string }) => r.sheetId)).toEqual(['b'])
  })
  it('is dead with nothing ticked', () => {
    draw()
    fireEvent.click(screen.getByLabelText('2041 Cedar Hollow Clinic, Harlan Mechanical'))
    fireEvent.click(screen.getByLabelText('2049 Mill Street Bakery, Marlow Tile'))
    expect((screen.getByRole('button', { name: 'Take teammates off ▸' }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('a held sheet has a door', () => {
    const { onOpenSheet } = draw()
    fireEvent.click(screen.getByRole('button', { name: 'Open the sheet to say whose it is ›' }))
    expect(onOpenSheet).toHaveBeenCalledWith('c')
  })
  it('after a run names what took and the sheet that did not, with its reason', () => {
    draw({ done: 1, failed: [{ row: CLEAN_UP.ready[1]!, reason: 'Nothing was changed: the database refused it' }] })
    const out = screen.getByTestId('ride-along-outcome').textContent ?? ''
    expect(out).toContain('Changed 1 sheet. 1 did not change.')
    expect(out).toContain('2049 Mill Street Bakery, Marlow Tile. Nothing was changed: the database refused it')
  })
})
