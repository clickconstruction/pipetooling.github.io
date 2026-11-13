// @vitest-environment jsdom
/**
 * The sub work-order strip as the job window's Edit tab draws it (`variant="inline"`, the owner's
 * pick of 2026-11-13): the chip and the state's own press, outlined in every state, each still
 * opening the assembler where it did. The boxed strip keeps its filled press. Every name is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import type { JobWorkOrderCoverage } from '../../lib/subWorkOrders/workOrderCoverage'

const { state } = vi.hoisted(() => ({ state: { coverage: { kind: 'none' } as unknown } }))

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useJobWorkOrderCoverage', () => ({ useJobWorkOrderCoverage: () => ({ coverage: state.coverage, rows: [], reload: () => Promise.resolve() }) }))
vi.mock('./WorkOrderAssemblerModal', () => ({
  WorkOrderAssemblerModal: ({ open, initial }: { open: boolean; initial: unknown }) => (open ? <div data-testid="assembler-stub">{JSON.stringify(initial)}</div> : null),
}))

import { makeJob, renderWithProviders } from '../../test/renderSmokeMocks'
import JobWorkOrderStrip from './JobWorkOrderStrip'

const job = makeJob({ id: 'job-7', hcp_number: '1431' })
const FILLED = /rgb\(37, 99, 235\)|#2563eb/i
const buttonNames = () => screen.getAllByRole('button').map((b) => b.textContent)
const row = (coverage: JobWorkOrderCoverage) => {
  state.coverage = coverage
  return renderWithProviders(<JobWorkOrderStrip job={job} variant="inline" authUserId="user-1" />)
}

beforeEach(() => {
  state.coverage = { kind: 'none' }
})
afterEach(cleanup)

describe('JobWorkOrderStrip in the job window’s row', () => {
  it('nothing for a sub: the chip and an outlined Draft a work order…, which opens the assembler on this job', () => {
    row({ kind: 'none' })
    expect(buttonNames()).toEqual(['No agreement', 'Draft a work order…'])
    const press = screen.getByRole('button', { name: 'Draft a work order…' })
    expect(press.getAttribute('style') ?? '').not.toMatch(FILLED)
    fireEvent.click(press)
    expect(screen.getByTestId('assembler-stub').textContent).toBe('{"jobId":"job-7"}')
  })

  it.each([
    [{ kind: 'draft', id: 'wo-1', subName: 'Ironwood Drain', unpriced: true }, ['Drafted · no price yet', 'Price…']],
    [{ kind: 'draft', id: 'wo-1', subName: 'Ironwood Drain', unpriced: false }, ['Drafted', 'Send…']],
    [{ kind: 'sent', id: 'wo-1', subName: 'Ironwood Drain', amount: 100, sentAt: '2026-11-10', expiresOn: null, expired: false }, ['Sent · awaiting signature', 'View']],
    [{ kind: 'signed', id: 'wo-1', subName: 'Ironwood Drain', amount: 100, signedOn: '2026-11-11', laborJobId: null, recordId: null }, ['✍ Signed', 'View record']],
    [{ kind: 'declined', id: 'wo-1', subName: 'Ironwood Drain', reason: null }, ['Declined', 'Re-offer…', 'Draft for another sub…']],
  ] as Array<[JobWorkOrderCoverage, string[]]>)('%o draws its presses outlined, and the first opens the order it names', (coverage, names) => {
    row(coverage)
    expect(buttonNames()).toEqual(names)
    for (const b of screen.getAllByRole('button')) expect(b.getAttribute('style') ?? '').not.toMatch(FILLED)
    fireEvent.click(screen.getByRole('button', { name: names[1]! }))
    expect(screen.getByTestId('assembler-stub').textContent).toBe('{"commitmentId":"wo-1"}')
  })

  it('declined: Draft for another sub… starts a new order on the job', () => {
    row({ kind: 'declined', id: 'wo-1', subName: 'Ironwood Drain', reason: 'Booked out' })
    fireEvent.click(screen.getByRole('button', { name: 'Draft for another sub…' }))
    expect(screen.getByTestId('assembler-stub').textContent).toBe('{"jobId":"job-7"}')
  })
})

describe('JobWorkOrderStrip as a boxed strip', () => {
  it('keeps its filled press', () => {
    state.coverage = { kind: 'none' }
    renderWithProviders(<JobWorkOrderStrip job={job} authUserId="user-1" />)
    expect(screen.getByRole('button', { name: 'Draft a work order…' }).getAttribute('style') ?? '').toMatch(FILLED)
  })
})
