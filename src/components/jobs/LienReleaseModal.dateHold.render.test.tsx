// @vitest-environment jsdom
/**
 * The lien waiver's draft autosave and a date typed one digit at a time: a browser reports the
 * year "2026" as 0002, 0020, 0202, 2026, and a pause mid-year must not write the half-typed
 * date. The dates are columns and ride inside `fields`, so the whole draft waits and the footer
 * says so; the finished year saves it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { makeInvoice, makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import LienReleaseModal from './LienReleaseModal'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, role: 'dev' }) }))

const db = vi.hoisted(() => ({ writes: [] as Array<{ op: string; payload: Record<string, unknown> }> }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as { from: (t: string) => unknown }
  const realFrom = stub.from.bind(stub)
  stub.from = (table: string) => {
    if (table !== 'job_lien_releases') return realFrom(table)
    let wrote: Record<string, unknown> | null = null
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order', 'in', 'is', 'limit']) builder[m] = () => builder
    for (const op of ['insert', 'update']) {
      builder[op] = (payload: Record<string, unknown>) => {
        db.writes.push({ op, payload })
        wrote = payload
        return builder
      }
    }
    builder.single = () => Promise.resolve({ data: wrote ? { id: 'rel-1', voided_at: null, ...wrote } : null, error: null })
    builder.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok)
    return builder
  }
  return { supabase: stub }
})

const invoice = makeInvoice({ id: 'inv-1', status: 'billed', amount: 2200, sequence_order: 0 })
const job = makeJob({ id: 'j1', hcp_number: '375', job_name: 'Springtown Vet', customer_name: 'Knight Contracting', invoices: [invoice] })

const HELD_LINE = /Not saved: a date is not finished\. Type the year in full, like \d{4}\./
const signedBox = () => screen.getByLabelText('Signature date') as HTMLInputElement

/** Real timers for the window, fake ones for the 800 ms pause that follows this change. */
async function pauseAfter(change: () => void) {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  try {
    change()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900)
    })
  } finally {
    vi.useRealTimers()
  }
  await settle()
}

async function openWaiver() {
  renderWithProviders(<LienReleaseModal open onClose={() => undefined} job={job} invoice={invoice} signerNameFallback="Robert Douglas, Managing Member" />)
  await screen.findByLabelText('Signature date')
  await settle()
  db.writes = []
}

beforeEach(() => {
  db.writes = []
})
afterEach(cleanup)

describe('LienReleaseModal — a date caught half typed', () => {
  it('a pause mid-year writes nothing and the footer says the draft is waiting on the date', async () => {
    await openWaiver()
    await pauseAfter(() => fireEvent.change(signedBox(), { target: { value: '0002-09-30' } }))
    expect(db.writes).toEqual([])
    expect(screen.getByText(HELD_LINE)).toBeTruthy()
  })

  it('the finished year saves the draft with the date, as a column and inside its fields', async () => {
    await openWaiver()
    await pauseAfter(() => fireEvent.change(signedBox(), { target: { value: '0202-09-30' } }))
    await pauseAfter(() => fireEvent.change(screen.getByLabelText('Signer title'), { target: { value: 'Managing Member' } }))
    expect(db.writes).toEqual([])
    await pauseAfter(() => fireEvent.change(signedBox(), { target: { value: '2026-09-30' } }))
    expect(db.writes).toHaveLength(1)
    expect(db.writes[0]).toMatchObject({ op: 'insert', payload: { job_id: 'j1', signed_date: '2026-09-30', fields: { signedDate: '2026-09-30', signerTitle: 'Managing Member' } } })
    expect(screen.queryByText(HELD_LINE)).toBeNull()
    expect(screen.getByText('All changes saved')).toBeTruthy()
  })

  it('a through date half typed holds the draft too; emptied, it is a cleared date and saves as null', async () => {
    await openWaiver()
    const through = screen.getByLabelText('Progress payments through') as HTMLInputElement
    await pauseAfter(() => fireEvent.change(through, { target: { value: '0020-09-15' } }))
    expect(db.writes).toEqual([])
    expect(screen.getByText(HELD_LINE)).toBeTruthy()
    await pauseAfter(() => fireEvent.change(through, { target: { value: '' } }))
    expect(db.writes).toHaveLength(1)
    expect(db.writes[0]?.payload.through_date).toBeNull()
  })
})
