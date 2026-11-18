// @vitest-environment jsdom
/**
 * The row presses, on the form itself (the Job form map's second pass, cut 4). The rules are four reducers in
 * `lib/jobs/jobFormRows.ts` with their own tests; this pins the wiring: each press reaches its own rule. The
 * segment generator is a stand-in with one press that hands the form two lines.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

const db = vi.hoisted(() => ({ job: null as unknown }))

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'dev' })
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/fetchJobWithDetailsById', () => ({ fetchJobWithDetailsById: async () => db.job }))
vi.mock('./MultipleSegmentGeneratorModal', () => ({
  MultipleSegmentGeneratorModal: ({ onAddToJob }: { onAddToJob: (lines: unknown[]) => void }) => (
    <button
      type="button"
      onClick={() =>
        onAddToJob([
          { name: 'Generated rough-in', count: 1, line_unit_price: 1200, line_description: '', invoice_id: null, stage_kind: 'order' },
          { name: 'Generated final', count: 1, line_unit_price: 800, line_description: '', invoice_id: null, stage_kind: 'order' },
        ])
      }
    >
      add the generated lines
    </button>
  ),
}))

import { makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import JobFormModal from './JobFormModal'

const line = (id: string, name: string, price: number, seq: number) => ({ id, job_id: 'job-ash', name, count: 1, line_unit_price: price, line_description: null, invoice_id: null, sequence_order: seq, line_kind: 'work', stage_kind: null, shared_with_gc: false })
const charge = (id: string, description: string, amount: number) => ({ id, description, amount, charged_on: '2026-11-03', memo: null })
const formProps = { initialJob: null, billingCustomerHighlightInitial: false, fixturesSectionHighlightInitial: false, jobPicturesLinkHighlightInitial: false, alsoOpenCreateCustomerModal: false, onClose: () => {}, onSaved: null }

async function openAshGrove(job: Record<string, unknown>) {
  db.job = makeJob({ id: 'job-ash', hcp_number: '972', job_name: 'Ash Grove', status: 'working', revenue: 2_000, ...job })
  renderWithProviders(<JobFormModal mode="edit" editJobId="job-ash" {...formProps} />)
  await settle()
  await screen.findByDisplayValue('Ash Grove')
  await settle()
}
async function openNewJob() {
  renderWithProviders(<JobFormModal mode="new" editJobId={null} {...formProps} />)
  await settle()
  await screen.findByText('Billing')
  await settle()
}

/** The work lines' name boxes, top to bottom. */
const lineNames = () => (screen.queryAllByPlaceholderText('Specific work or materials') as HTMLTextAreaElement[]).map((el) => el.value)
const discountLines = () => screen.queryAllByLabelText('Discount line').length
const chargeWords = () => (screen.queryAllByLabelText('Other charge description') as HTMLInputElement[]).map((el) => el.value)

describe('Edit Job and New Job: what a row press leaves behind', () => {
  it('Remove on a line item takes that line and leaves the other, which then has no Remove', async () => {
    await openAshGrove({ fixtures: [line('f-rough', 'Rough-in', 1_200, 0), line('f-final', 'Final', 800, 1)] })
    expect(lineNames()).toEqual(['Rough-in', 'Final'])
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove line item' })[0]!)
    await settle()
    expect(lineNames()).toEqual(['Final'])
    expect(screen.queryByRole('button', { name: 'Remove line item' })).toBeNull()
  })

  it('− Add discount on a blank New Job takes the placeholder line’s place', async () => {
    await openNewJob()
    expect(lineNames()).toEqual([''])
    expect(discountLines()).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: '− Add discount' }))
    await settle()
    expect(lineNames()).toEqual([])
    expect(discountLines()).toBe(1)
  })

  it('− Add discount under a named line keeps the line', async () => {
    await openNewJob()
    fireEvent.change(screen.getAllByPlaceholderText('Specific work or materials')[0]!, { target: { value: 'Rough-in' } })
    await settle()
    fireEvent.click(screen.getByRole('button', { name: '− Add discount' }))
    await settle()
    expect(lineNames()).toEqual(['Rough-in'])
    expect(discountLines()).toBe(1)
  })

  it('the generator’s lines take a blank New Job’s placeholder line’s place', async () => {
    await openNewJob()
    fireEvent.click(screen.getByRole('button', { name: 'Multiple Segment Generator' }))
    fireEvent.click(await screen.findByText('add the generated lines'))
    await settle()
    expect(lineNames()).toEqual(['Generated rough-in', 'Generated final'])
    expect(screen.queryByText('add the generated lines')).toBeNull()
  })

  it('the generator’s lines go under a line that is already named', async () => {
    await openNewJob()
    fireEvent.change(screen.getAllByPlaceholderText('Specific work or materials')[0]!, { target: { value: 'Demo' } })
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Multiple Segment Generator' }))
    fireEvent.click(await screen.findByText('add the generated lines'))
    await settle()
    expect(lineNames()).toEqual(['Demo', 'Generated rough-in', 'Generated final'])
  })

  it('Remove on a job charge takes that charge and leaves the other', async () => {
    await openAshGrove({ fixtures: [line('f-rough', 'Rough-in', 2_000, 0)], materials: [charge('m-permit', 'Permit', 125), charge('m-dump', 'Dump fee', 60)] })
    expect(chargeWords()).toEqual(['Permit', 'Dump fee'])
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' }).find((b) => b.closest('[data-testid="job-money-table"]') == null && b.getAttribute('aria-label') === 'Remove')!)
    await settle()
    expect(chargeWords()).toEqual(['Dump fee'])
  })

  it('Clear row on the last job charge empties it, and + Add other charge shows that one row again, not a second', async () => {
    await openAshGrove({ fixtures: [line('f-rough', 'Rough-in', 2_000, 0)], materials: [charge('m-permit', 'Permit', 125)] })
    expect(chargeWords()).toEqual(['Permit'])
    fireEvent.click(screen.getByRole('button', { name: 'Clear row' }))
    await settle()
    expect(chargeWords()).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: '+ Add other charge' }))
    await settle()
    expect(chargeWords()).toEqual([''])
  })
})
