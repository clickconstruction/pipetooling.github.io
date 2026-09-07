import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Workflow-step lifecycle notifications, shared by the Workflow page and the
 * Dashboard Projects card. The tests pin who gets notified for each action,
 * how a recipient is resolved (person id first, then user by name, then
 * people by name), the exact payload handed to the edge function, and that
 * failures never surface.
 */
type Step = { method: string; args: unknown[] }
const queries: Array<{ table: string; steps: Step[] }> = []
type Row = Record<string, unknown>
let db: Record<string, Row[]> = {}
const invoke = vi.fn(async (_name: string, _opts: { body: Row }): Promise<{ error: { message: string } | null }> => ({ error: null }))
const getUser = vi.fn(async () => ({ data: { user: { id: 'auth-user' } as { id: string } | null } }))
vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => {
      const steps: Step[] = []
      queries.push({ table, steps })
      const p: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') {
              return (resolve: (v: { data: unknown; error: null }) => void) => {
                // A tiny query engine: every eq() narrows the table's rows; single()/maybeSingle() take the first.
                let rows = db[table] ?? []
                for (const s of steps) if (s.method === 'eq') rows = rows.filter((r) => r[s.args[0] as string] === s.args[1])
                const one = steps.some((s) => s.method === 'single' || s.method === 'maybeSingle')
                resolve({ data: one ? (rows[0] ?? null) : rows, error: null })
              }
            }
            return (...a: unknown[]) => {
              steps.push({ method: String(prop), args: a })
              return p
            }
          },
        },
      )
      return p
    },
    functions: { invoke: (name: string, opts: { body: Row }) => invoke(name, opts) },
    auth: { getUser: () => getUser() },
  },
}))
;(globalThis as unknown as { window: unknown }).window = { location: { origin: 'https://app.test' } }

import { sendStepLifecycleNotifications, type NotifiableStep } from './stepLifecycleNotifications'

const steps = [
  { id: 's1', workflow_id: 'w1', sequence_order: 1, name: 'Rough-in', assigned_to_name: 'Ana', assigned_person_id: 'p-ana' },
  { id: 's2', workflow_id: 'w1', sequence_order: 2, name: 'Inspection', assigned_to_name: 'Bob', assigned_person_id: null },
  { id: 's3', workflow_id: 'w1', sequence_order: 3, name: 'Top-out', assigned_to_name: 'Cy', assigned_person_id: 'p-cy' },
]
const step = (over: Partial<NotifiableStep> = {}): NotifiableStep => ({
  id: 's2',
  workflow_id: 'w1',
  name: 'Inspection',
  assigned_to_name: 'Bob',
  assigned_person_id: null,
  ...over,
})
// Third argument: pass it explicitly to hand that exact value to the sender (undefined
// included — that is the "resolve the session yourself" case); omit it to default to 'me'.
const send = (s: NotifiableStep, actionType: string, ...rest: [string | null | undefined] | []) =>
  sendStepLifecycleNotifications({ step: s, actionType: actionType as never, projectId: 'p1', projectName: 'Oak Ridge', currentUserId: rest.length ? rest[0] : 'me' })
const sent = () => invoke.mock.calls.map((c) => c[1].body)
const templates = () => sent().map((b) => b.template_type)

let errorSpy: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  queries.length = 0
  invoke.mockClear()
  getUser.mockClear()
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  db = {
    project_workflow_steps: steps,
    people: [
      { id: 'p-ana', name: 'Ana', email: 'ana@people.test', account_user_id: 'u-ana', archived_at: null },
      { id: 'p-cy', name: 'Cy', email: 'cy@people.test', account_user_id: null, archived_at: null },
      { id: 'p-bob', name: 'Bob', email: 'bob@people.test', account_user_id: null, archived_at: null },
    ],
    users: [
      { id: 'u-ana', name: 'Ana', email: 'ana@users.test' },
      { id: 'u-sub', name: null, email: 'sub@users.test' },
    ],
    step_subscriptions: [],
  }
})
afterEach(() => errorSpy.mockRestore())

describe('gates', () => {
  it('does nothing without a project id and name', async () => {
    await sendStepLifecycleNotifications({ step: step(), actionType: 'started' as never, projectId: '', projectName: 'x' })
    await sendStepLifecycleNotifications({ step: step(), actionType: 'started' as never, projectId: 'p1', projectName: '' })
    expect(queries).toHaveLength(0)
    expect(invoke).not.toHaveBeenCalled()
  })
  it('reads the workflow’s steps in sequence order, and an unknown action sends nothing', async () => {
    await send(step({ notify_assigned_when_started: true }), 'skipped')
    expect(queries.map((q) => q.table)).toEqual(['project_workflow_steps'])
    expect(queries[0]!.steps.find((s) => s.method === 'eq')?.args).toEqual(['workflow_id', 'w1'])
    expect(queries[0]!.steps.find((s) => s.method === 'order')?.args).toEqual(['sequence_order', { ascending: true }])
    expect(invoke).not.toHaveBeenCalled()
  })
  it('a flag that is off, or no assignee, means no assignee notification', async () => {
    await send(step({ notify_assigned_when_started: false }), 'started', null)
    await send(step({ notify_assigned_when_started: true, assigned_to_name: null }), 'started', null)
    expect(invoke).not.toHaveBeenCalled()
  })
})

describe('recipient resolution', () => {
  it('person id first: an account-linked person notifies their user (user email + id)', async () => {
    await send(step({ notify_assigned_when_started: true, assigned_to_name: 'Ana (stale)', assigned_person_id: 'p-ana' }), 'started', null)
    expect(sent()).toEqual([
      expect.objectContaining({ template_type: 'stage_assigned_started', recipient_email: 'ana@users.test', recipient_user_id: 'u-ana', recipient_name: 'Ana (stale)' }),
    ])
    expect(queries.map((q) => q.table)).toEqual(['project_workflow_steps', 'people', 'users'])
  })
  it('a person with no account uses the person’s email and no user id', async () => {
    await send(step({ notify_assigned_when_started: true, assigned_to_name: 'Cy', assigned_person_id: 'p-cy' }), 'started', null)
    expect(sent()[0]).toMatchObject({ recipient_email: 'cy@people.test', recipient_user_id: undefined })
  })
  it('without a person id: the user by exact trimmed name, else an active person by name, else nobody', async () => {
    await send(step({ notify_assigned_when_started: true, assigned_to_name: '  Ana ' }), 'started', null)
    expect(sent()[0]).toMatchObject({ recipient_email: 'ana@users.test', recipient_user_id: 'u-ana' })
    expect(queries.find((q) => q.table === 'users')!.steps.find((s) => s.method === 'eq')?.args).toEqual(['name', 'Ana'])

    invoke.mockClear()
    await send(step({ notify_assigned_when_started: true, assigned_to_name: 'Bob' }), 'started', null)
    expect(sent()[0]).toMatchObject({ recipient_email: 'bob@people.test', recipient_user_id: undefined })
    const peopleQ = queries.filter((q) => q.table === 'people').pop()!
    expect(peopleQ.steps.find((s) => s.method === 'is')?.args).toEqual(['archived_at', null])
    expect(peopleQ.steps.find((s) => s.method === 'limit')?.args).toEqual([1])

    invoke.mockClear()
    await send(step({ notify_assigned_when_started: true, assigned_to_name: 'Nobody' }), 'started', null)
    expect(invoke).not.toHaveBeenCalled()
  })
})

describe('what is sent', () => {
  it('the edge-function payload carries the template, step, recipient, variables and the deep link', async () => {
    await send(step({ notify_assigned_when_started: true, assigned_to_name: 'Ana', assigned_person_id: 'p-ana' }), 'started', null)
    expect(invoke).toHaveBeenCalledWith('send-workflow-notification', {
      body: {
        template_type: 'stage_assigned_started',
        step_id: 's2',
        recipient_email: 'ana@users.test',
        recipient_name: 'Ana',
        recipient_user_id: 'u-ana',
        push_title: undefined,
        push_body: undefined,
        push_url: 'https://app.test/workflows/p1#step-s2',
        variables: {
          name: 'Ana',
          email: 'ana@users.test',
          project_name: 'Oak Ridge',
          stage_name: 'Inspection',
          assigned_to_name: 'Ana',
          workflow_link: 'https://app.test/workflows/p1#step-s2',
        },
      },
    })
  })
  it('subscribers: only with a session user; each flagged subscriber gets the "me" template, named by their email when unnamed', async () => {
    db.step_subscriptions = [{ step_id: 's2', user_id: 'u-sub', notify_when_started: true }]
    await send(step(), 'started', null)
    expect(invoke).not.toHaveBeenCalled()
    expect(queries.some((q) => q.table === 'step_subscriptions')).toBe(false)

    await send(step(), 'started', 'me')
    const subQ = queries.find((q) => q.table === 'step_subscriptions')!
    expect(subQ.steps.find((s) => s.method === 'select')?.args).toEqual(['user_id, notify_when_started'])
    expect(subQ.steps.filter((s) => s.method === 'eq').map((s) => s.args)).toEqual([
      ['step_id', 's2'],
      ['notify_when_started', true],
    ])
    expect(sent()).toEqual([expect.objectContaining({ template_type: 'stage_me_started', recipient_email: 'sub@users.test', recipient_name: 'sub@users.test', recipient_user_id: 'u-sub' })])
    expect(getUser).not.toHaveBeenCalled()
  })
  it('with the session user left undefined, the sender resolves it itself', async () => {
    db.step_subscriptions = [{ step_id: 's2', user_id: 'u-sub', notify_when_reopened: true }]
    await send(step(), 'reopened', undefined)
    expect(getUser).toHaveBeenCalledTimes(1)
    expect(templates()).toEqual(['stage_me_reopened'])
    getUser.mockResolvedValueOnce({ data: { user: null } })
    invoke.mockClear()
    await send(step(), 'reopened', undefined)
    expect(invoke).not.toHaveBeenCalled()
  })
})

describe('per action', () => {
  it('completed / approved: the assignee, the subscribers, then the next step’s assignee gets a "Your turn" push with the previous stage named', async () => {
    db.step_subscriptions = [{ step_id: 's2', user_id: 'u-sub', notify_when_complete: true }]
    const s = step({ notify_assigned_when_complete: true, notify_next_assignee_when_complete_or_approved: true, assigned_to_name: 'Ana', assigned_person_id: 'p-ana' })
    await send(s, 'completed', 'me')
    expect(templates()).toEqual(['stage_assigned_complete', 'stage_me_complete', 'stage_next_complete_or_approved'])
    expect(sent()[2]).toEqual({
      template_type: 'stage_next_complete_or_approved',
      step_id: 's3',
      recipient_email: 'cy@people.test',
      recipient_name: 'Cy',
      recipient_user_id: undefined,
      push_title: 'Your turn: Step completed',
      push_body: "Inspection has been completed. You're up next for Top-out.",
      push_url: 'https://app.test/workflows/p1#step-s3',
      variables: expect.objectContaining({ name: 'Cy', stage_name: 'Top-out', assigned_to_name: 'Cy', previous_stage_name: 'Inspection', workflow_link: 'https://app.test/workflows/p1#step-s3' }),
    })
    invoke.mockClear()
    await send(s, 'approved', null)
    expect(templates()).toEqual(['stage_assigned_complete', 'stage_next_complete_or_approved'])
  })
  it('the last step has no next assignee to hand off to; the flag off also stops the handoff', async () => {
    await send(step({ id: 's3', name: 'Top-out', notify_next_assignee_when_complete_or_approved: true }), 'completed', null)
    await send(step({ notify_next_assignee_when_complete_or_approved: false }), 'completed', null)
    expect(invoke).not.toHaveBeenCalled()
  })
  it('rejected: the prior step’s assignee hears why; the first step has nobody prior', async () => {
    await send(step({ notify_prior_assignee_when_rejected: true, rejection_reason: 'Missing photos' }), 'rejected', 'me')
    expect(sent()).toEqual([
      expect.objectContaining({
        template_type: 'stage_prior_rejected',
        step_id: 's1',
        recipient_email: 'ana@users.test',
        recipient_user_id: 'u-ana',
        variables: expect.objectContaining({ stage_name: 'Rough-in', previous_stage_name: 'Rough-in', rejection_reason: 'Missing photos' }),
      }),
    ])
    invoke.mockClear()
    await send(step({ id: 's1', name: 'Rough-in', notify_prior_assignee_when_rejected: true }), 'rejected', 'me')
    expect(invoke).not.toHaveBeenCalled()
    await send(step({ notify_prior_assignee_when_rejected: true, rejection_reason: null }), 'rejected', null)
    expect(sent()[0]!.variables).toMatchObject({ rejection_reason: '' })
  })
  it('reopened: the assignee and the reopened subscribers', async () => {
    db.step_subscriptions = [{ step_id: 's2', user_id: 'u-sub', notify_when_reopened: true }]
    await send(step({ notify_assigned_when_reopened: true, assigned_to_name: 'Ana', assigned_person_id: 'p-ana' }), 'reopened', 'me')
    expect(templates()).toEqual(['stage_assigned_reopened', 'stage_me_reopened'])
  })
})

describe('best effort', () => {
  it('an edge-function error or throw is logged and swallowed; later sends still go out', async () => {
    invoke.mockResolvedValueOnce({ error: { message: 'smtp down' } })
    db.step_subscriptions = [{ step_id: 's2', user_id: 'u-sub', notify_when_started: true }]
    await expect(send(step({ notify_assigned_when_started: true, assigned_to_name: 'Ana', assigned_person_id: 'p-ana' }), 'started', 'me')).resolves.toBeUndefined()
    expect(templates()).toEqual(['stage_assigned_started', 'stage_me_started'])
    expect(errorSpy).toHaveBeenCalledTimes(1)

    invoke.mockClear()
    errorSpy.mockClear()
    invoke.mockRejectedValueOnce(new Error('network'))
    await expect(send(step({ notify_assigned_when_started: true, assigned_to_name: 'Ana', assigned_person_id: 'p-ana' }), 'started', 'me')).resolves.toBeUndefined()
    expect(templates()).toEqual(['stage_assigned_started', 'stage_me_started'])
    expect(errorSpy).toHaveBeenCalledTimes(1)
  })
})
