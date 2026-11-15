/**
 * The Pay calendar's reads and save either side of a push (punch list #341, PR 5): a database
 * from before `days_after` answers the calendars as they were, and a save of days after the bill
 * carries no pay day, so that database refuses it in words where it would have stored a calendar.
 */
import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { loadPayCalendars, loadPayerPayCalendars, savePayCalendar } from './payCalendarIo'
import { PAY_CALENDAR_DEFAULT } from './payCalendar'

type Answer = { data: unknown[] | null; error: { code?: string; message: string } | null }

/** A client whose table reads are answered by `answer(table, columns)`, and whose rpc calls are recorded. */
function fakeDb(answer: (table: string, columns: string) => Answer) {
  const selects: Array<{ table: string; columns: string; payerId: string | null }> = []
  const rpc = vi.fn(async () => ({ data: null, error: null }))
  const db = {
    from: (table: string) => ({
      select: (columns: string) => {
        const call = { table, columns, payerId: null as string | null }
        selects.push(call)
        const result = Promise.resolve(answer(table, columns))
        // A read is awaited bare or after `.eq` / `.in`: each hands back the same answer.
        const chain = {
          eq: (_col: string, value: string) => {
            call.payerId = value
            return result
          },
          in: () => result,
          then: result.then.bind(result),
        }
        return chain
      },
    }),
    rpc,
  }
  return { db: db as unknown as SupabaseClient<Database>, selects, rpc }
}

const NET_45_ROW = { payer_customer_id: 'lark', job_id: null, off: false, cutoff_day: null, pay_day: null, months_after: 1, pay_when_paid: false, clause: '§ 7.1', words: '', set_at: null, set_by: null, days_after: 45 }
const TENTH_ROW = { payer_customer_id: 'sable', job_id: null, off: false, cutoff_day: null, pay_day: 10, months_after: 1, pay_when_paid: false, clause: '', words: '', set_at: null, set_by: null }

describe('loadPayCalendars', () => {
  it('reads the days with the calendars, and a bill’s own due day beside them', async () => {
    const { db, selects } = fakeDb((table) =>
      table === 'payer_pay_calendars'
        ? { data: [NET_45_ROW, TENTH_ROW], error: null }
        : table === 'invoice_due_days'
          ? { data: [{ invoice_id: 'inv-1', due_on: '2027-02-15', clause: '§ 9.4', words: '', marked_at: null, marked_by: null }], error: null }
          : { data: [], error: null },
    )
    const rows = await loadPayCalendars(db)
    expect(rows.map((r) => [r.payerCustomerId, r.calendar?.daysAfter ?? null, r.calendar?.payDay ?? null, r.invoiceId ?? null])).toEqual([
      ['lark', 45, 10, null],
      ['sable', null, 10, null],
      ['', null, null, 'inv-1'],
    ])
    expect(selects.find((c) => c.table === 'payer_pay_calendars')?.columns).toContain('days_after')
  })

  it('reads the calendars as they were from a database with no days_after column yet', async () => {
    const { db, selects } = fakeDb((table, columns) => {
      if (table === 'invoice_due_days') return { data: null, error: { code: 'PGRST205', message: 'no such table' } }
      if (columns.includes('days_after')) return { data: null, error: { code: '42703', message: 'column payer_pay_calendars.days_after does not exist' } }
      return { data: [TENTH_ROW], error: null }
    })
    const rows = await loadPayCalendars(db)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ payerCustomerId: 'sable', calendar: { payDay: 10 } })
    expect(selects.filter((c) => c.table === 'payer_pay_calendars').map((c) => c.columns.includes('days_after'))).toEqual([true, false])
  })

  it('answers none before the table is there, and says why on any other failure', async () => {
    expect(await loadPayCalendars(fakeDb(() => ({ data: null, error: { code: 'PGRST205', message: 'no such table' } })).db)).toEqual([])
    await expect(loadPayerPayCalendars(fakeDb(() => ({ data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } })).db, 'lark')).rejects.toMatchObject({ code: '57014' })
  })

  it('reads one payer’s rows alone, with no bill’s day among them', async () => {
    const { db, selects } = fakeDb(() => ({ data: [NET_45_ROW], error: null }))
    const rows = await loadPayerPayCalendars(db, 'lark')
    expect(rows).toHaveLength(1)
    expect(selects.map((c) => [c.table, c.payerId])).toEqual([['payer_pay_calendars', 'lark']])
  })
})

describe('savePayCalendar', () => {
  it('sends days after the bill with no pay day', async () => {
    const { db, rpc } = fakeDb(() => ({ data: [], error: null }))
    await savePayCalendar(db, { payerId: 'lark', jobId: 'j1431', calendar: { ...PAY_CALENDAR_DEFAULT, clause: ' § 7.1 ', daysAfter: 45 } })
    expect(rpc).toHaveBeenCalledWith('set_payer_pay_calendar', { p_payer_customer_id: 'lark', p_job_id: 'j1431', p_calendar: { daysAfter: 45, payWhenPaid: false, clause: '§ 7.1', words: '' } })
  })

  it('sends a calendar, a job’s off switch and a clear as it always did', async () => {
    const { db, rpc } = fakeDb(() => ({ data: [], error: null }))
    await savePayCalendar(db, { payerId: 'lark', calendar: { ...PAY_CALENDAR_DEFAULT, cutoffDay: 25, payDay: 30 } })
    await savePayCalendar(db, { payerId: 'lark', jobId: 'j1431', calendar: { off: true } })
    await savePayCalendar(db, { payerId: 'lark', calendar: null })
    expect(rpc.mock.calls.map((c) => (c as unknown[])[1])).toEqual([
      { p_payer_customer_id: 'lark', p_job_id: null, p_calendar: { cutoffDay: 25, payDay: 30, monthsAfter: 1, payWhenPaid: false, clause: '', words: '' } },
      { p_payer_customer_id: 'lark', p_job_id: 'j1431', p_calendar: { off: true } },
      { p_payer_customer_id: 'lark', p_job_id: null, p_calendar: null },
    ])
  })

  it('throws what the database refused', async () => {
    const { db, rpc } = fakeDb(() => ({ data: [], error: null }))
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'The pay day is a day of the month, 1 to 31' } } as never)
    await expect(savePayCalendar(db, { payerId: 'lark', calendar: { ...PAY_CALENDAR_DEFAULT, daysAfter: 45 } })).rejects.toMatchObject({ message: 'The pay day is a day of the month, 1 to 31' })
  })
})
