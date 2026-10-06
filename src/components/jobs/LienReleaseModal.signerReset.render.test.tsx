// @vitest-environment jsdom
/**
 * Who signs is picked per opening (v2.4567): Jobs → Stages keeps this modal mounted, so a leader
 * picked for one job stayed the pick on the next. Each job now opens on its own default.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { makeInvoice, makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import LienReleaseModal from './LienReleaseModal'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'assistant-1' }, role: 'assistant', profileName: 'Taunya' }) }))
// jsdom draws nothing: the line's canvas gets no 2D context (and no "not implemented" noise).
HTMLCanvasElement.prototype.getContext = (() => null) as never

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as { from: (t: string) => unknown }
  const realFrom = stub.from.bind(stub)
  stub.from = (table: string) => {
    if (table !== 'users') return realFrom(table)
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order', 'in', 'is', 'limit']) builder[m] = () => builder
    builder.then = (ok: (v: unknown) => unknown) =>
      Promise.resolve({
        data: [
          { id: 'master-1', name: 'Malachi Reyes', notes: null, archived_at: null },
          { id: 'master-2', name: 'Robert Douglas', notes: null, archived_at: null },
        ],
        error: null,
      }).then(ok)
    return builder
  }
  return { supabase: stub }
})

const jobFor = (id: string, masterId: string) => {
  const inv = makeInvoice({ id: `inv-${id}`, status: 'billed', amount: 11240, sequence_order: 0 })
  return { job: makeJob({ id, hcp_number: id, job_name: `Job ${id}`, master_user_id: masterId, invoices: [inv], revenue: 36000 }), inv }
}
const a = jobFor('j1', 'master-1')
const b = jobFor('j2', 'master-1')
const c = jobFor('j3', 'master-2')

const whoSigns = () => within(screen.getByTestId('lien-waiver-signer')).getByLabelText('Who signs') as HTMLSelectElement
const opened = async (value: string) => {
  await screen.findByTestId('lien-waiver-signer')
  await settle()
  await waitFor(() => expect(whoSigns().value).toBe(value))
}

afterEach(cleanup)

describe('LienReleaseModal — who signs resets with the job (v2.4567)', () => {
  it('a leader picked on one job is not the pick when the modal reopens on the next', async () => {
    const view = renderWithProviders(<LienReleaseModal signerNameFallback="Malachi Reyes" open onClose={() => undefined} job={a.job} invoice={a.inv} />)
    await opened('master-1')
    fireEvent.change(whoSigns(), { target: { value: 'master-2' } })
    expect(whoSigns().value).toBe('master-2')

    // Jobs → Stages closes it without unmounting, then opens it on another job.
    view.rerender(<LienReleaseModal signerNameFallback="Malachi Reyes" open={false} onClose={() => undefined} job={null} invoice={null} />)
    await settle()
    view.rerender(<LienReleaseModal signerNameFallback="Malachi Reyes" open onClose={() => undefined} job={b.job} invoice={b.inv} />)
    await opened('master-1')

    // Reopening the same job starts from its default too.
    fireEvent.change(whoSigns(), { target: { value: 'master-2' } })
    view.rerender(<LienReleaseModal signerNameFallback="Malachi Reyes" open={false} onClose={() => undefined} job={null} invoice={null} />)
    await settle()
    view.rerender(<LienReleaseModal signerNameFallback="Malachi Reyes" open onClose={() => undefined} job={b.job} invoice={b.inv} />)
    await opened('master-1')
  })

  it('a job swapped under the open modal takes its own leader', async () => {
    const view = renderWithProviders(<LienReleaseModal signerNameFallback="Malachi Reyes" open onClose={() => undefined} job={a.job} invoice={a.inv} />)
    await opened('master-1')
    view.rerender(<LienReleaseModal signerNameFallback="Malachi Reyes" open onClose={() => undefined} job={c.job} invoice={c.inv} />)
    await opened('master-2')
  })
})
