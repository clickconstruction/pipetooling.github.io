/**
 * The tab's door to gmail-mine over a fake client: each action posts the contract's request and answers its Ok; a
 * refusal reads whether it came as a 2xx body or under a non-2xx answer; a lost signal and an answer that is neither
 * are thrown. The person's switch reads the row's two columns through the guard, falls back to the address before the
 * push, and saves through my_mail_set. Everything is made up.
 */
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { errorKindOf } from '../../utils/errorHandling'
import type { MyMailListOk, MyMailRefusal } from './contract'
import { isMyMailRefusal, loadMyMailSetting, myMailSavedOf, myMailSettingOf, saveMyMailSetting, supabaseMyMailIo } from './myMailIo'

vi.mock('../supabase', () => ({ supabase: {} }))

const PAGE: MyMailListOk = { ok: true, address: 'marisol@clickplumbing.example', rows: [], nextPageToken: null, folded: 0 }
const OFF: MyMailRefusal = { ok: false, error: 'off', words: 'Your mail is not shown here.' }

const invoking = (answer: { data: unknown; error: unknown }) => {
  const invoke = vi.fn(async () => answer)
  return { invoke, io: supabaseMyMailIo({ functions: { invoke } }) }
}
const httpError = (status: number, body: unknown) => new FunctionsHttpError(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))

describe('supabaseMyMailIo', () => {
  it('posts each action with its request to gmail-mine and answers the Ok', async () => {
    const { invoke, io } = invoking({ data: PAGE, error: null })
    await expect(io.list({ view: 'toTag', q: 'Ridgeway', pageToken: null })).resolves.toEqual(PAGE)
    expect(invoke).toHaveBeenCalledWith('gmail-mine', { body: { action: 'list', view: 'toTag', q: 'Ridgeway', pageToken: null } })
    await io.open({ gmailId: 'g-1' })
    await io.tag({ threadId: 't-1', job: { kind: 'pipeline', id: 'job-elm' } })
    await io.untag({ threadId: 't-1' })
    expect(invoke.mock.calls.map((c) => (c as unknown as [string, { body: { action: string } }])[1].body.action)).toEqual(['list', 'open', 'tag', 'untag'])
  })

  it('answers a refusal sent as a 2xx body', async () => {
    const { io } = invoking({ data: OFF, error: null })
    await expect(io.list({ view: 'toTag' })).resolves.toEqual(OFF)
  })

  it('reads a refusal off a non-2xx answer’s body', async () => {
    const offWorkspace: MyMailRefusal = { ok: false, error: 'offWorkspace', words: 'Google will not read this address. Google said: unauthorized_client.' }
    const { io } = invoking({ data: null, error: httpError(403, offWorkspace) })
    await expect(io.list({ view: 'all' })).resolves.toEqual(offWorkspace)
  })

  it('throws a non-2xx answer whose body is not a refusal, as it came', async () => {
    const error = httpError(404, { code: 'NOT_FOUND', message: 'Requested function was not found' })
    const { io } = invoking({ data: null, error })
    await expect(io.list({ view: 'toTag' })).rejects.toBe(error)
  })

  it('throws a lost signal, which the screen reads as one', async () => {
    const error = new FunctionsFetchError(new TypeError('Failed to fetch'))
    const { io } = invoking({ data: null, error })
    const thrown = await io.open({ gmailId: 'g-1' }).catch((e: unknown) => e)
    expect(thrown).toBe(error)
    expect(errorKindOf(thrown)).toBe('network')
  })

  it('throws an answer that is neither an Ok nor a refusal, with its words when it has some', async () => {
    await expect(invoking({ data: { ok: false, error: 'somethingNew', words: 'A new reason.' }, error: null }).io.untag({ threadId: 't-1' })).rejects.toThrow('A new reason.')
    await expect(invoking({ data: null, error: null }).io.untag({ threadId: 't-1' })).rejects.toThrow('The mail reader gave an answer the app cannot read.')
  })

  it('knows a refusal by its shape and a reason the contract names', () => {
    expect(isMyMailRefusal(OFF)).toBe(true)
    expect(isMyMailRefusal({ ok: false, error: 'off' })).toBe(false)
    expect(isMyMailRefusal({ ok: false, error: 'nope', words: 'x' })).toBe(false)
    expect(isMyMailRefusal(PAGE)).toBe(false)
    expect(isMyMailRefusal(null)).toBe(false)
  })
})

/** A users row read: the columns asked for, answered by `answer`. */
function usersClient(answer: (columns: string) => { data: unknown; error: unknown }, rpc?: (fn: string, args: unknown) => { data: unknown; error: unknown }) {
  const asked: string[] = []
  return {
    asked,
    client: {
      auth: { getSession: async () => ({ data: { session: { user: { id: 'u-session' } } } }) },
      from: (table: string) => ({
        select: (columns: string) => ({
          eq: (_col: string, id: string) => ({
            maybeSingle: async () => {
              asked.push(`${table}:${columns}:${id}`)
              return answer(columns)
            },
          }),
        }),
      }),
      rpc: vi.fn(async (fn: string, args: unknown) => (rpc ? rpc(fn, args) : { data: null, error: null })),
    },
  }
}

describe('the person’s own switch', () => {
  it('reads the switch, the labels and the address off their own row', async () => {
    const { client, asked } = usersClient(() => ({ data: { email: ' marisol@clickplumbing.example ', my_mail_on: false, my_mail_hidden_labels: ['Personal', ' personal ', 7] }, error: null }))
    await expect(loadMyMailSetting('u-marisol', client)).resolves.toEqual({ on: false, hiddenLabels: ['Personal'], address: 'marisol@clickplumbing.example', ready: true })
    expect(asked).toEqual(['users:email, my_mail_on, my_mail_hidden_labels:u-marisol'])
  })

  it('reads the session’s person when none is named', async () => {
    const { client, asked } = usersClient(() => ({ data: { email: 'dale@clickplumbing.example', my_mail_on: true, my_mail_hidden_labels: [] }, error: null }))
    await loadMyMailSetting(null, client)
    expect(asked[0]).toBe('users:email, my_mail_on, my_mail_hidden_labels:u-session')
  })

  it('reads the address alone before the migration is pushed, the switch on', async () => {
    const { client, asked } = usersClient((columns) =>
      columns.includes('my_mail_on') ? { data: null, error: { code: '42703', message: 'column users.my_mail_on does not exist' } } : { data: { email: 'marisol@clickplumbing.example' }, error: null },
    )
    await expect(loadMyMailSetting('u-marisol', client)).resolves.toEqual({ on: true, hiddenLabels: [], address: 'marisol@clickplumbing.example', ready: false })
    expect(asked).toEqual(['users:email, my_mail_on, my_mail_hidden_labels:u-marisol', 'users:email:u-marisol'])
  })

  it('reads the switch on when nobody is signed in, and through the guard on a row it cannot read', async () => {
    const client = { auth: { getSession: async () => ({ data: { session: null } }) } }
    await expect(loadMyMailSetting(undefined, client)).resolves.toEqual({ on: true, hiddenLabels: [], address: '', ready: false })
    expect(myMailSettingOf(null)).toEqual({ on: true, hiddenLabels: [], address: '' })
    expect(myMailSettingOf({ my_mail_on: 'no', my_mail_hidden_labels: 'Personal', email: 3 })).toEqual({ on: true, hiddenLabels: [], address: '' })
  })

  it('saves through my_mail_set with the labels cleaned, and answers the row as saved', async () => {
    const { client } = usersClient(
      () => ({ data: null, error: null }),
      () => ({ data: [{ is_on: true, hidden_labels: ['Personal', 'Receipts'] }], error: null }),
    )
    await expect(saveMyMailSetting(true, [' Personal ', 'personal', 'Receipts'], client)).resolves.toEqual({ on: true, hiddenLabels: ['Personal', 'Receipts'] })
    expect(client.rpc).toHaveBeenCalledWith('my_mail_set', { p_on: true, p_hidden_labels: ['Personal', 'Receipts'] })
    await saveMyMailSetting(false, null, client)
    expect(client.rpc).toHaveBeenLastCalledWith('my_mail_set', { p_on: false, p_hidden_labels: null })
  })

  it('throws a refused save in words, and reads a saved row through the guard', async () => {
    const { client } = usersClient(
      () => ({ data: null, error: null }),
      () => ({ data: null, error: { code: 'P0001', message: 'Leave out twenty labels at most.' } }),
    )
    await expect(saveMyMailSetting(true, ['Personal'], client)).rejects.toThrow(/twenty labels/)
    expect(myMailSavedOf({ is_on: false, hidden_labels: ['A', 'a'] }, { on: true, hiddenLabels: null })).toEqual({ on: false, hiddenLabels: ['A'] })
    expect(myMailSavedOf(null, { on: true, hiddenLabels: ['Personal'] })).toEqual({ on: true, hiddenLabels: ['Personal'] })
    expect(myMailSavedOf([], { on: false, hiddenLabels: null }, ['Receipts'])).toEqual({ on: false, hiddenLabels: ['Receipts'] })
  })
})
