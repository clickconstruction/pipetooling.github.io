// @vitest-environment jsdom
/**
 * The Retainage held band (punch list #165, PR 2): the lines the kernel builds, each with its
 * source, its age and a door to the job; the released line struck through; the empty and the
 * failed reads in words; the band closes and opens.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ArRetainageHeld } from './ArRetainageHeld'
import { buildRetainageHeldSection, retainageBandSummary } from '../../../lib/ar/retainageHeld'
import { assembleRetainageHeld, type RetainageJobRow } from '../../../lib/ar/retainageHeldRows'

const TODAY = '2026-10-26'

const job = (partial: Partial<RetainageJobRow> & { id: string }): RetainageJobRow => ({
  hcp_number: null,
  click_number: null,
  job_name: null,
  job_address: null,
  status: 'billed',
  customer_name: null,
  gc_customer_id: 'gc',
  lien_retainage_held: null,
  lien_contract_ended_on: null,
  gc: null,
  ...partial,
})

function built() {
  const { inputs, facts } = assembleRetainageHeld(
    [
      job({ id: 'c1385', hcp_number: 'C1385', job_name: 'Granite Shoals', job_address: '2740 Granite Shoals Dr', lien_retainage_held: 6400, gc: { name: 'Bluebonnet Commercial Builders' } }),
      job({ id: 'c1377', hcp_number: 'C1377', job_address: '118 Seminary Ridge Rd', lien_retainage_held: 3120, lien_contract_ended_on: '2026-09-30', gc: { name: 'Lampasas Builders JV' } }),
      job({ id: 'c1391', hcp_number: 'C1391', lien_contract_ended_on: '2026-10-20', gc: { name: 'Royse City ISD' } }),
    ],
    [
      { job_id: 'c1385', application_number: 3, retainage_held: 5840, updated_at: '2026-10-18T17:00:00Z', invoice_id: null },
      { job_id: 'c1391', application_number: 1, retainage_held: 700, updated_at: '2026-10-01T17:00:00Z', invoice_id: null },
      { job_id: 'c1391', application_number: 2, retainage_held: 0, updated_at: '2026-10-21T17:00:00Z', invoice_id: 'b7' },
    ],
    [{ id: 'b7', job_id: 'c1391', amount: 7000, status: 'billed' }],
  )
  return { section: buildRetainageHeldSection(inputs, TODAY), facts }
}

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

describe('ArRetainageHeld', () => {
  it('draws one line per job with its source, its age and a door, the released line struck through, the total over what is owed', () => {
    const { section, facts } = built()
    const onOpenJob = vi.fn()
    render(<ArRetainageHeld section={section} facts={facts} loading={false} error={null} narrow={false} onOpenJob={onOpenJob} />)
    expect(screen.getByTestId('ar-retainage-summary').textContent).toContain('$8,960.00 on 3 jobs')
    const lines = screen.getAllByTestId('ar-retainage-line')
    expect(lines).toHaveLength(3)
    // The oldest finish first, the open job last.
    expect(lines[0]!.textContent).toContain('C1377')
    expect(lines[0]!.textContent).toContain("typed in the job's lien details")
    expect(lines[0]!.textContent).toContain('Lampasas Builders JV')
    expect(lines[0]!.textContent).toContain('$3,120.00')
    expect(lines[0]!.textContent).toContain('26d since the job finished · Sep 30')
    expect(lines[1]!.textContent).toContain('C1391')
    expect(lines[1]!.textContent).toContain('release billed · awaiting payment')
    expect(within(lines[1]!).getByText('$700.00').style.textDecoration).toBe('line-through')
    expect(lines[2]!.textContent).toContain('C1385')
    expect(lines[2]!.textContent).toContain('from pay application 3, saved Oct 18')
    expect(lines[2]!.textContent).toContain('$5,840.00')
    expect(lines[2]!.textContent).toContain('job still open · not aging yet')
    fireEvent.click(within(lines[2]!).getByRole('button', { name: 'Open the job' }))
    expect(onOpenJob).toHaveBeenCalledWith('c1385')
  })

  it('on a phone the lines stack as cards with the same words', () => {
    const { section, facts } = built()
    render(<ArRetainageHeld section={section} facts={facts} loading={false} error={null} narrow onOpenJob={() => {}} />)
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getAllByTestId('ar-retainage-line')).toHaveLength(3)
    expect(screen.getByText('held by Lampasas Builders JV')).toBeTruthy()
  })

  it('no door without a handler', () => {
    const { section, facts } = built()
    render(<ArRetainageHeld section={section} facts={facts} loading={false} error={null} narrow={false} />)
    expect(screen.queryByRole('button', { name: 'Open the job' })).toBeNull()
  })

  it('nothing held is the good state and says so; a failed read says why', () => {
    render(<ArRetainageHeld section={buildRetainageHeldSection([], TODAY)} facts={new Map()} loading={false} error={null} narrow={false} />)
    expect(screen.getByTestId('ar-retainage-summary').textContent).toContain('nothing held')
    expect(screen.getByText('Nothing waiting on retainage a GC holds.')).toBeTruthy()
    cleanup()
    render(<ArRetainageHeld section={null} facts={new Map()} loading={false} error="The database refused the read." narrow={false} />)
    expect(screen.getByRole('alert').textContent).toBe('The database refused the read.')
    expect(screen.getByTestId('ar-retainage-summary').textContent).toContain('could not be read')
  })

  it('reading shows as such until the first section lands', () => {
    render(<ArRetainageHeld section={null} facts={new Map()} loading error={null} narrow={false} />)
    expect(screen.getByText('Reading the retainage GCs hold…')).toBeTruthy()
    expect(screen.getByTestId('ar-retainage-summary').textContent).toContain('reading…')
  })

  it('the band closes to its one line and remembers the choice', () => {
    const { section, facts } = built()
    render(<ArRetainageHeld section={section} facts={facts} loading={false} error={null} narrow={false} />)
    const toggle = screen.getByRole('button', { name: /Retainage held/ })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryAllByTestId('ar-retainage-line')).toHaveLength(0)
    expect(window.localStorage.getItem('ar.retainageHeld.open')).toBe('closed')
    cleanup()
    render(<ArRetainageHeld section={section} facts={facts} loading={false} error={null} narrow={false} />)
    expect(screen.getByRole('button', { name: /Retainage held/ }).getAttribute('aria-expanded')).toBe('false')
  })

  it('the closed band’s words', () => {
    expect(retainageBandSummary(null)).toBe('nothing held')
    expect(retainageBandSummary(built().section)).toBe('$8,960.00 on 3 jobs')
    const one = assembleRetainageHeld([job({ id: 'j', lien_retainage_held: 10 })], [], [])
    expect(retainageBandSummary(buildRetainageHeldSection(one.inputs, TODAY))).toBe('$10.00 on 1 job')
  })
})
