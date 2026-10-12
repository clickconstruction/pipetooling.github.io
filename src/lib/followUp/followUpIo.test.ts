import { describe, expect, it } from 'vitest'
import { DatabaseError } from '../../utils/errorHandling'
import { pressProblem, recordsOfContacts, supabaseFollowUpIo } from './followUpIo'

/** A client that records each query's table, columns and filters, and each call's name and arguments. */
function fakeClient(data: Record<string, unknown[]> = {}, rpcResult: { data?: unknown; error?: { message: string; code: string } } = {}) {
  const queries: Array<{ table: string; select: string; filters: string[] }> = []
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = []
  const builder = (table: string) => {
    const q = { table, select: '', filters: [] as string[] }
    queries.push(q)
    const chain = {
      select(cols: string) {
        q.select = cols
        return chain
      },
      eq(col: string, v: unknown) {
        q.filters.push(`${col}=${String(v)}`)
        return chain
      },
      in(col: string, v: unknown[]) {
        q.filters.push(`${col} in ${v.join(',')}`)
        return chain
      },
      or(expr: string) {
        q.filters.push(`or ${expr}`)
        return chain
      },
      is(col: string, v: unknown) {
        q.filters.push(`${col} is ${String(v)}`)
        return chain
      },
      then(resolve: (r: { data: unknown[]; error: null; status: number }) => unknown) {
        return Promise.resolve({ data: data[table] ?? [], error: null, status: 200 }).then(resolve)
      },
    }
    return chain
  }
  const client = {
    from: (table: string) => builder(table),
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args })
      return rpcResult.error ? { data: null, error: rpcResult.error, status: 400 } : { data: rpcResult.data ?? null, error: null, status: 200 }
    },
  }
  return { client, queries, calls }
}

describe('loadQueue', () => {
  it('reads only what the queue needs, each with its filter', async () => {
    const { client, queries } = fakeClient()
    const rows = await supabaseFollowUpIo(client).loadQueue('2026-10-02')
    expect(queries.map((q) => [q.table, q.filters])).toEqual([
      ['contacts', []],
      ['contact_channels', []],
      ['messages', ['direction=in', 'contact.state in waiting,snoozed']],
      ['messages', ['channel=note', 'or back_on.not.is.null,back_words.not.is.null']],
      ['message_promises', ['or state.eq.offered,and(state.eq.written,day.gte.2026-10-02)']],
      ['contact_owed', ['done_at is null']],
    ])
    expect(queries[0]!.select).toContain('state, snoozed_until, has_user_id, has_since, has_how')
    expect(queries[2]!.select).toContain('contact:contacts!inner(state)')
    expect(rows).toMatchObject({ contacts: [], messages: [], heard: [], owed: [] })
  })

  it('keeps a line read by both queries once', async () => {
    const both = { id: 'm1', contact_id: 'c1', channel: 'note', direction: 'team', at: '2026-10-02T14:00:00.000Z', body: 'x', who_text: '' }
    const { client } = fakeClient({ messages: [both] })
    expect((await supabaseFollowUpIo(client).loadQueue('2026-10-02')).messages).toHaveLength(1)
  })

  it('gathers the records the contacts’ embedded rows name, once each', () => {
    const hillside = { id: 'gc-1', name: 'Hillside Excavation', contact_name: 'Greg Paulk', trades: ['Sitework'] }
    const records = recordsOfContacts([
      { company: hillside, customer: null, person: null, gc_person: null, roster: null },
      { company: null, customer: null, person: null, gc_person: { id: 'gcp-1', company_id: 'gc-1', name: 'Dana Paulk', company: hillside }, roster: null },
      { company: null, customer: null, person: { id: 'ccp-1', customer_id: 'cust-1', name: 'Dr. Priya Raman', customer: { id: 'cust-1', name: 'Helotes Dental Office' } }, gc_person: null, roster: { id: 'p-1', name: null } },
    ] as never)
    expect(records).toEqual({
      customers: [{ id: 'cust-1', name: 'Helotes Dental Office' }],
      customerContactPersons: [{ id: 'ccp-1', customer_id: 'cust-1', name: 'Dr. Priya Raman' }],
      gcCompanies: [{ id: 'gc-1', name: 'Hillside Excavation', contact_name: 'Greg Paulk', trades: ['Sitework'] }],
      gcCompanyPeople: [{ id: 'gcp-1', company_id: 'gc-1', name: 'Dana Paulk' }],
      people: [{ id: 'p-1', name: '' }],
    })
  })
})

describe('the presses', () => {
  it('call the migration’s functions with their arguments', async () => {
    const { client, calls } = fakeClient({}, { data: 'id-1' })
    const io = supabaseFollowUpIo(client)
    await io.takeIt('c1')
    await io.handTo('c1', null)
    await io.setState('c1', 'snoozed')
    await io.markOwed('c1', 'the start date', { ymd: '2026-10-05', words: null })
    await io.markOwed('c1', 'the start date', { ymd: null, words: 'after the award' })
    await io.owedDone('c1', 'Told her.', { kind: 'project', id: 'p1' })
    await io.writeDown('m1', 'start')
    await io.writeDown('m2', null)
    await io.readQuestion('m3', 'asked')
    await io.addNote('c1', 'Call her Monday.', null, { ymd: '2026-10-05', words: null })
    await io.setBackDay('n1', null)
    await io.backDone('n1')
    await io.highlight('m1', 'detention pond')
    await io.unhighlight('h1')
    expect(calls).toEqual([
      { fn: 'take_it', args: { p_contact_id: 'c1' } },
      { fn: 'hand_to', args: { p_contact_id: 'c1', p_user_id: null } },
      { fn: 'set_state', args: { p_contact_id: 'c1', p_state: 'snoozed' } },
      { fn: 'mark_owed', args: { p_contact_id: 'c1', p_what: 'the start date', p_by_day: '2026-10-05', p_by_words: null } },
      { fn: 'mark_owed', args: { p_contact_id: 'c1', p_what: 'the start date', p_by_day: null, p_by_words: 'after the award' } },
      { fn: 'owed_done', args: { p_contact_id: 'c1', p_note: 'Told her.', p_job_kind: 'project', p_job_id: 'p1' } },
      { fn: 'write_down', args: { p_message_id: 'm1', p_kind: 'start', p_writes: null } },
      { fn: 'write_down', args: { p_message_id: 'm2', p_kind: null, p_writes: null } },
      { fn: 'read_question', args: { p_message_id: 'm3', p_state: 'asked' } },
      { fn: 'add_note', args: { p_contact_id: 'c1', p_body: 'Call her Monday.', p_job_kind: null, p_job_id: null, p_back_on: '2026-10-05', p_back_words: null } },
      { fn: 'set_back_day', args: { p_note_id: 'n1', p_on: null, p_words: null } },
      { fn: 'back_done', args: { p_note_id: 'n1' } },
      { fn: 'highlight', args: { p_message_id: 'm1', p_text: 'detention pond' } },
      { fn: 'unhighlight', args: { p_highlight_id: 'h1' } },
    ])
  })

  it('reads the badge as a number', async () => {
    expect(await supabaseFollowUpIo(fakeClient({}, { data: 4 }).client).count()).toBe(4)
    expect(await supabaseFollowUpIo(fakeClient({}, { data: null }).client).count()).toBe(0)
  })

  it('rejects with the press’s own words, which the office reads as they are', async () => {
    const { client } = fakeClient({}, { error: { message: 'Write the note first.', code: 'P0001' } })
    const refused = await supabaseFollowUpIo(client).addNote('c1', ' ', null, null).catch((e: unknown) => e)
    expect(pressProblem(refused)).toBe('Write the note first.')
  })
})

describe('pressProblem', () => {
  const refusal = (code: string, words: string) => new DatabaseError(`Failed to x: ${words}`, code, null, { serverMessage: words, operationName: 'take a conversation' })

  it('says a press’s refusal in its own words, a training account’s and a twin’s included', () => {
    expect(pressProblem(refusal('P0001', 'That conversation is not there.'))).toBe('That conversation is not there.')
    expect(pressProblem(refusal('42501', 'A training account cannot take a conversation.'))).toBe('A training account cannot take a conversation.')
    expect(pressProblem(refusal('42501', 'Only the office team can take a conversation.'))).toBe('Only the office team can take a conversation.')
  })

  it('leaves a policy’s refusal and anything else to the house’s words', () => {
    expect(pressProblem(refusal('42501', 'new row violates row-level security policy for table "messages"'))).toBe("You don't have permission to take a conversation.")
    expect(pressProblem(new Error('boom'))).toBe('boom')
  })
})
