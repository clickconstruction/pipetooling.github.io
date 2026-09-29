import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { autosaveFailureWords, newJobChildRowFailureWords, writeBillingSlice, writeMaterialsSlice, writeNewJobChildRows, writeTeamSlice, type NewJobChildRowFailure } from './jobFormSliceWrites'
import { discountSnapshot } from './discountActivity'
import type { FixtureRow, MaterialRow, PaymentRow } from './jobFormTypes'

type Step = { op: string; table: string; payload?: unknown; filters?: unknown[] }

/**
 * A client that records every call in the order it ran. `fail` names the step to refuse —
 * `<op>:<table>` or `<op>:<table>#<n>` for its n-th occurrence.
 */
function makeClient(opts: { fail?: string; team?: string[] } = {}) {
  const steps: Step[] = []
  const counts: Record<string, number> = {}
  const answer = (op: string, table: string) => {
    const key = `${op}:${table}`
    counts[key] = (counts[key] ?? 0) + 1
    const refused = opts.fail === key || opts.fail === `${key}#${counts[key]}`
    return { error: refused ? { message: `${key} refused` } : null }
  }
  const from = (table: string) => {
    const chain = (op: string, payload?: unknown) => {
      const filters: unknown[] = []
      const b: Record<string, unknown> = {}
      for (const m of ['eq', 'in']) {
        b[m] = (...a: unknown[]) => {
          filters.push(m, ...a)
          return b
        }
      }
      b.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => {
        steps.push({ op, table, payload, filters })
        const res = op === 'select' ? { data: (opts.team ?? []).map((user_id) => ({ user_id })), ...answer(op, table) } : answer(op, table)
        return Promise.resolve(res).then(onFulfilled, onRejected)
      }
      return b
    }
    return {
      update: (payload: unknown) => chain('update', payload),
      delete: () => chain('delete'),
      upsert: (payload: unknown, options: unknown) => chain('upsert', { rows: payload, options }),
      insert: (payload: unknown) => chain('insert', payload),
      select: () => chain('select'),
    }
  }
  const rpc = (name: string, params: unknown) => {
    steps.push({ op: 'rpc', table: name, payload: params })
    return Promise.resolve(answer('rpc', name))
  }
  return { steps, client: { from, rpc } as unknown as SupabaseClient }
}

const fixture = (id: string, name: string, price: number | null, extra: Partial<FixtureRow> = {}): FixtureRow => ({ id, name, count: 1, line_unit_price: price, line_description: '', invoice_id: null, ...extra })
const pay = (id: string, amount: number): PaymentRow => ({ id, amount, paid_on: '2026-09-01', sent_on: null, note: null, payment_type: 'check', reference_number: null, invoice_id: null, mercury_transaction_id: null })
const seq = (steps: Step[]) => steps.map((s) => `${s.op}:${s.table}`)

afterEach(() => {
  vi.restoreAllMocks()
})

describe('writeBillingSlice', () => {
  const fixtures = [fixture('f1', 'Rough-in', 1_000, { invoice_id: 'inv-1' }), fixture('f2', 'Top-out', 500), fixture('f3', '', null)]
  const base = () => ({
    jobId: 'job-1',
    fixtures,
    payments: [pay('p-kept', 300), pay('p-new', 200), pay('p-blank', 0)],
    riderFeesDollars: 75,
    hydratedPaymentIds: ['p-kept', 'p-gone'],
    persistedDiscounts: discountSnapshot(fixtures),
    onPaymentsWritten: vi.fn(),
    onDiscountsWritten: vi.fn(),
  })

  it('revenue → payments deleted then upserted → line items deleted then re-inserted, in that order', async () => {
    const { client, steps } = makeClient()
    await writeBillingSlice(client, base())
    expect(seq(steps)).toEqual([
      'update:jobs_ledger',
      'delete:jobs_ledger_payments',
      'upsert:jobs_ledger_payments',
      'delete:jobs_ledger_fixtures',
      'insert:jobs_ledger_fixtures',
      'insert:jobs_ledger_fixtures',
    ])
  })

  it('writes the Job Total with the rider fees as the revenue, and never payments_made', async () => {
    const { client, steps } = makeClient()
    await writeBillingSlice(client, base())
    expect(steps[0]).toMatchObject({ payload: { revenue: 1_575 }, filters: ['eq', 'id', 'job-1'] })
  })

  it('deletes only the payments the form owned and no longer has; upserts the ones with an amount', async () => {
    const { client, steps } = makeClient()
    await writeBillingSlice(client, base())
    expect(steps[1]?.filters).toEqual(['in', 'id', ['p-gone'], 'eq', 'job_id', 'job-1'])
    const upsert = steps[2]?.payload as { rows: Array<{ id: string; amount: number; sequence_order: number }>; options: unknown }
    expect(upsert.rows.map((r) => [r.id, r.amount, r.sequence_order])).toEqual([
      ['p-kept', 300, 0],
      ['p-new', 200, 1],
    ])
    expect(upsert.options).toEqual({ onConflict: 'id' })
  })

  it('skips the payment delete and the upsert when there is nothing for them', async () => {
    const { client, steps } = makeClient()
    await writeBillingSlice(client, { ...base(), payments: [pay('p-blank', 0)], hydratedPaymentIds: [] })
    expect(seq(steps)).toEqual(['update:jobs_ledger', 'delete:jobs_ledger_fixtures', 'insert:jobs_ledger_fixtures', 'insert:jobs_ledger_fixtures'])
  })

  it('re-inserts the named line items only, each carrying its invoice link', async () => {
    const { client, steps } = makeClient()
    await writeBillingSlice(client, base())
    const inserts = steps.filter((s) => s.op === 'insert').map((s) => s.payload as { name: string; invoice_id: string | null; sequence_order: number })
    expect(inserts.map((r) => [r.name, r.invoice_id, r.sequence_order])).toEqual([
      ['Rough-in', 'inv-1', 0],
      ['Top-out', null, 1],
    ])
  })

  it('tells the form which payments are saved before it touches the line items', async () => {
    const { client, steps } = makeClient()
    const args = base()
    args.onPaymentsWritten.mockImplementation(() => steps.push({ op: 'told', table: 'payments' }))
    args.onDiscountsWritten.mockImplementation(() => steps.push({ op: 'told', table: 'discounts' }))
    await writeBillingSlice(client, args)
    expect(args.onPaymentsWritten).toHaveBeenCalledWith(['p-kept', 'p-new'])
    expect(seq(steps)).toEqual([
      'update:jobs_ledger',
      'delete:jobs_ledger_payments',
      'upsert:jobs_ledger_payments',
      'told:payments',
      'delete:jobs_ledger_fixtures',
      'insert:jobs_ledger_fixtures',
      'insert:jobs_ledger_fixtures',
      'told:discounts',
    ])
  })

  it('a failed revenue write stops everything', async () => {
    const { client, steps } = makeClient({ fail: 'update:jobs_ledger' })
    const args = base()
    await expect(writeBillingSlice(client, args)).rejects.toEqual({ message: 'update:jobs_ledger refused' })
    expect(seq(steps)).toEqual(['update:jobs_ledger'])
    expect(args.onPaymentsWritten).not.toHaveBeenCalled()
  })

  it('a failed payment write leaves the line items untouched and the form’s saved payments as they were', async () => {
    for (const fail of ['delete:jobs_ledger_payments', 'upsert:jobs_ledger_payments']) {
      const { client, steps } = makeClient({ fail })
      const args = base()
      await expect(writeBillingSlice(client, args)).rejects.toEqual({ message: `${fail} refused` })
      expect(seq(steps)).not.toContain('delete:jobs_ledger_fixtures')
      expect(args.onPaymentsWritten).not.toHaveBeenCalled()
    }
  })

  it('a line item that fails part-way leaves the ones before it written, the payments saved, and the discounts as they were', async () => {
    const { client, steps } = makeClient({ fail: 'insert:jobs_ledger_fixtures#2' })
    const args = base()
    await expect(writeBillingSlice(client, args)).rejects.toEqual({ message: 'insert:jobs_ledger_fixtures refused' })
    expect(seq(steps).slice(-3)).toEqual(['delete:jobs_ledger_fixtures', 'insert:jobs_ledger_fixtures', 'insert:jobs_ledger_fixtures'])
    expect(args.onPaymentsWritten).toHaveBeenCalledTimes(1)
    expect(args.onDiscountsWritten).not.toHaveBeenCalled()
  })

  it('logs one event per discount that changed, after the line items, without waiting on it', async () => {
    const withDiscount = [fixture('f1', 'Rough-in', 1_000), fixture('d1', 'Discount', -100, { line_kind: 'discount' } as Partial<FixtureRow>)]
    const { client, steps } = makeClient({ fail: 'rpc:log_job_discount_event' })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const args = { ...base(), fixtures: withDiscount, persistedDiscounts: [] }
    await expect(writeBillingSlice(client, args)).resolves.toBeUndefined()
    const logs = steps.filter((s) => s.op === 'rpc')
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({ table: 'log_job_discount_event', payload: { p_job_id: 'job-1', p_event_type: 'discount_added' } })
    expect(steps.indexOf(logs[0]!)).toBeGreaterThan(seq(steps).lastIndexOf('insert:jobs_ledger_fixtures'))
    expect(args.onDiscountsWritten).toHaveBeenCalledWith(discountSnapshot(withDiscount))
    await Promise.resolve()
    expect(warn).toHaveBeenCalled()
  })

  it('logs nothing when no discount changed', async () => {
    const { client, steps } = makeClient()
    await writeBillingSlice(client, base())
    expect(steps.filter((s) => s.op === 'rpc')).toEqual([])
  })
})

describe('writeMaterialsSlice', () => {
  const materials: MaterialRow[] = [
    { id: 'm1', description: 'Copper', amount: 120 },
    { id: 'm2', description: 'Fittings', amount: 40 },
  ]

  it('deletes the job’s rows, then re-inserts each', async () => {
    const { client, steps } = makeClient()
    await writeMaterialsSlice(client, { jobId: 'job-1', materials })
    expect(seq(steps)).toEqual(['delete:jobs_ledger_materials', 'insert:jobs_ledger_materials', 'insert:jobs_ledger_materials'])
    expect(steps[0]?.filters).toEqual(['eq', 'job_id', 'job-1'])
  })

  it('a failed delete inserts nothing; a failed insert stops there', async () => {
    const del = makeClient({ fail: 'delete:jobs_ledger_materials' })
    await expect(writeMaterialsSlice(del.client, { jobId: 'job-1', materials })).rejects.toEqual({ message: 'delete:jobs_ledger_materials refused' })
    expect(seq(del.steps)).toEqual(['delete:jobs_ledger_materials'])
    const ins = makeClient({ fail: 'insert:jobs_ledger_materials#1' })
    await expect(writeMaterialsSlice(ins.client, { jobId: 'job-1', materials })).rejects.toBeTruthy()
    expect(seq(ins.steps)).toEqual(['delete:jobs_ledger_materials', 'insert:jobs_ledger_materials'])
  })
})

describe('writeTeamSlice', () => {
  it('reads who is on the job, adds the missing, then removes the dropped', async () => {
    const { client, steps } = makeClient({ team: ['u-stays', 'u-dropped'] })
    await writeTeamSlice(client, { jobId: 'job-1', teamMemberIds: ['u-stays', 'u-added'] })
    expect(seq(steps)).toEqual(['select:jobs_ledger_team_members', 'insert:jobs_ledger_team_members', 'delete:jobs_ledger_team_members'])
    expect(steps[1]?.payload).toEqual({ job_id: 'job-1', user_id: 'u-added' })
    expect(steps[2]?.filters).toEqual(['eq', 'job_id', 'job-1', 'eq', 'user_id', 'u-dropped'])
  })

  it('writes nothing when the team has not changed', async () => {
    const { client, steps } = makeClient({ team: ['u-1'] })
    await writeTeamSlice(client, { jobId: 'job-1', teamMemberIds: ['u-1'] })
    expect(seq(steps)).toEqual(['select:jobs_ledger_team_members'])
  })

  it('a failed read writes nothing; a failed add removes no one', async () => {
    const read = makeClient({ fail: 'select:jobs_ledger_team_members', team: ['u-dropped'] })
    await expect(writeTeamSlice(read.client, { jobId: 'job-1', teamMemberIds: ['u-added'] })).rejects.toBeTruthy()
    expect(seq(read.steps)).toEqual(['select:jobs_ledger_team_members'])
    const add = makeClient({ fail: 'insert:jobs_ledger_team_members', team: ['u-dropped'] })
    await expect(writeTeamSlice(add.client, { jobId: 'job-1', teamMemberIds: ['u-added'] })).rejects.toBeTruthy()
    expect(seq(add.steps)).toEqual(['select:jobs_ledger_team_members', 'insert:jobs_ledger_team_members'])
  })
})

describe('writeNewJobChildRows', () => {
  const args = {
    jobId: 'job-1',
    payments: [pay('p1', 300), pay('p-blank', 0)],
    materials: [{ id: 'm1', description: 'Copper', amount: 120 }],
    fixtures: [fixture('f1', 'Rough-in', 1_000), fixture('f2', '', null)],
    teamMemberIds: ['u-1', 'u-2'],
  }

  it('payments → materials → line items → team, one insert at a time, and nothing to report', async () => {
    const { client, steps } = makeClient()
    expect(await writeNewJobChildRows(client, args)).toEqual([])
    expect(seq(steps)).toEqual([
      'insert:jobs_ledger_payments',
      'insert:jobs_ledger_materials',
      'insert:jobs_ledger_fixtures',
      'insert:jobs_ledger_team_members',
      'insert:jobs_ledger_team_members',
    ])
  })

  it('a refused row is handed back with its reason, and the rows after it are still written', async () => {
    const { client, steps } = makeClient({ fail: 'insert:jobs_ledger_payments' })
    expect(await writeNewJobChildRows(client, args)).toEqual([{ kind: 'payment', message: 'insert:jobs_ledger_payments refused' }])
    expect(seq(steps)).toHaveLength(5)
  })

  it('hands back each refused row of a kind, in the order they were tried', async () => {
    const { client, steps } = makeClient({ fail: 'insert:jobs_ledger_team_members' })
    expect(await writeNewJobChildRows(client, args)).toEqual([
      { kind: 'team member', message: 'insert:jobs_ledger_team_members refused' },
      { kind: 'team member', message: 'insert:jobs_ledger_team_members refused' },
    ])
    expect(seq(steps)).toHaveLength(5)
  })

  it('a call that fails outright is a row that did not land, not a throw', async () => {
    const { client } = makeClient()
    const from = client.from.bind(client)
    vi.spyOn(client, 'from').mockImplementation(((table: string) => {
      if (table === 'jobs_ledger_fixtures') throw new Error('Failed to fetch')
      return from(table)
    }) as typeof client.from)
    expect(await writeNewJobChildRows(client, args)).toEqual([{ kind: 'line item', message: 'Failed to fetch' }])
  })
})

describe('newJobChildRowFailureWords', () => {
  const f = (kind: NewJobChildRowFailure['kind'], message = 'new row violates row-level security policy'): NewJobChildRowFailure => ({ kind, message })

  it('says nothing when every row landed', () => {
    expect(newJobChildRowFailureWords([])).toBeNull()
  })

  it('one row: what it was, why, and what to do', () => {
    expect(newJobChildRowFailureWords([f('payment')])).toBe('Job saved, but 1 payment did not save (new row violates row-level security policy). Open the job and add it again.')
  })

  it('counts by kind in the order they are written, with the first reason given', () => {
    expect(newJobChildRowFailureWords([f('line item', 'timeout.'), f('team member'), f('line item'), f('payment')])).toBe(
      'Job saved, but 1 payment, 2 line items and 1 team member did not save (timeout). Open the job and add them again.',
    )
    expect(newJobChildRowFailureWords([f('material', 'denied'), f('material', 'denied')])).toBe('Job saved, but 2 materials did not save (denied). Open the job and add them again.')
  })

  it('leaves the reason out when the database gave none', () => {
    expect(newJobChildRowFailureWords([f('team member', '  ')])).toBe('Job saved, but 1 team member did not save. Open the job and add it again.')
  })
})

describe('autosaveFailureWords', () => {
  it('reads an Error’s message, and anything else as a string', () => {
    expect(autosaveFailureWords(new Error('timeout'))).toBe('Autosave failed: timeout')
    expect(autosaveFailureWords('nope')).toBe('Autosave failed: nope')
    expect(autosaveFailureWords({ message: 'denied' })).toBe('Autosave failed: [object Object]')
  })
})
