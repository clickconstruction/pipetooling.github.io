// @vitest-environment jsdom
/**
 * Tagging a teammate from History's note box (punch list #375): the open day's box offers the task's own
 * people, a note that tags someone posts with its tags in one call, a plain note is inserted as it was, and
 * Reopen's reason goes the same way. The rules live in src/lib/jobs/noteTags.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

const db = vi.hoisted(() => ({
  rpcCalls: [] as Array<{ name: string; args: unknown }>,
  inserts: [] as Array<{ table: string; row: unknown }>,
  updates: [] as Array<{ table: string; row: unknown }>,
  notices: [] as unknown[],
}))

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as unknown as { from: (t: string) => unknown; rpc: (n: string, a?: unknown) => unknown; functions: { invoke: (n: string, o?: { body?: unknown }) => Promise<unknown> } }
  const rpc = stub.rpc.bind(stub)
  const rows = (table: string) => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'order', 'limit']) b[m] = () => b
    b.insert = (row: unknown) => {
      db.inserts.push({ table, row })
      return { select: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 'ev-plain' }, error: null }) }) }
    }
    b.update = (row: unknown) => {
      db.updates.push({ table, row })
      return b
    }
    b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok)
    return b
  }
  stub.from = (table: string) => rows(table)
  stub.rpc = (name: string, args?: unknown) => {
    db.rpcCalls.push({ name, args })
    if (name === 'task_note_taggable') return Promise.resolve({ data: [{ user_id: 'u-dana', name: 'Dana Whitlock', role: 'assistant', on_task: true, gave: true }], error: null })
    if (name === 'task_note_post_tagged') return Promise.resolve({ data: 'ev-new', error: null })
    return rpc(name, args)
  }
  stub.functions = {
    invoke: (name: string, opts?: { body?: unknown }) => {
      if (name === 'notify-note-tag') db.notices.push(opts?.body)
      return Promise.resolve({ data: null, error: null })
    },
  }
  return { supabase: stub }
})
vi.mock('../../hooks/useAuth', async (orig) => ({
  ...(await orig<typeof import('../../hooks/useAuth')>()),
  useOptionalAuth: () => ({ role: 'superintendent', user: { id: 'u-luis' } }),
}))

import { ChecklistHistoryLedger } from './ChecklistHistoryLedger'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const INSTANCES = [{ id: 'inst-1', checklist_item_id: 'item-1', scheduled_date: '2026-11-16', completed_at: '2026-11-16T20:00:00Z', completed_by_user_id: 'u-luis', checklist_items: { title: 'Sweep the shop bays' } }]

async function openDay() {
  renderWithProviders(<ChecklistHistoryLedger instances={INSTANCES} selectedUserId="u-luis" currentUserId="u-luis" todayStr="2026-11-17" setError={vi.fn()} empty={{ main: 'Nothing in this range' }} />)
  fireEvent.click(await screen.findByRole('button', { name: /Sweep the shop bays/ }))
  return (await screen.findByLabelText('Add a note')) as HTMLInputElement
}

beforeEach(() => {
  db.rpcCalls.length = 0
  db.inserts.length = 0
  db.updates.length = 0
  db.notices.length = 0
})

describe('ChecklistHistoryLedger, tagging a teammate', () => {
  it('offers the open day\'s people and posts a tagged note in one call', async () => {
    const box = await openDay()
    await vi.waitFor(() => expect(db.rpcCalls.some((c) => c.name === 'task_note_taggable' && (c.args as { p_instance_id: string }).p_instance_id === 'inst-1')).toBe(true))
    const offer = await vi.waitFor(() => {
      const el = document.querySelector('[data-note-tag-offer] [data-note-tag-press]') as HTMLElement | null
      expect(el?.textContent).toBe('@Dana Whitlockgave this task')
      return el!
    })
    fireEvent.pointerDown(offer)
    await vi.waitFor(() => expect(box.value).toBe('@Dana Whitlock '))
    fireEvent.change(box, { target: { value: '@Dana Whitlock was this one done right?', selectionStart: 39 } })
    fireEvent.keyDown(box, { key: 'Enter' })
    await vi.waitFor(() => expect(db.rpcCalls.find((c) => c.name === 'task_note_post_tagged')?.args).toEqual({ p_instance_id: 'inst-1', p_body: '@Dana Whitlock was this one done right?', p_tagged: ['u-dana'] }))
    expect(db.inserts).toEqual([])
    await vi.waitFor(() => expect(db.notices).toEqual([{ task_event_id: 'ev-new' }]))
  })

  it('inserts a note that tags nobody as it always did, and asks for the notice by its id', async () => {
    const box = await openDay()
    fireEvent.change(box, { target: { value: 'Done before lunch.', selectionStart: 18 } })
    fireEvent.keyDown(box, { key: 'Enter' })
    await vi.waitFor(() => expect(db.inserts).toEqual([{ table: 'checklist_instance_events', row: { instance_id: 'inst-1', event_type: 'comment', actor_user_id: 'u-luis', body: 'Done before lunch.' } }]))
    expect(db.rpcCalls.some((c) => c.name === 'task_note_post_tagged')).toBe(false)
    await vi.waitFor(() => expect(db.notices).toEqual([{ task_event_id: 'ev-plain' }]))
  })

  it('sends Reopen\'s reason with its tag, then reopens', async () => {
    const box = await openDay()
    const offer = await vi.waitFor(() => {
      const el = document.querySelector('[data-note-tag-offer] [data-note-tag-press]') as HTMLElement | null
      expect(el).toBeTruthy()
      return el!
    })
    fireEvent.pointerDown(offer)
    await vi.waitFor(() => expect(box.value).toBe('@Dana Whitlock '))
    fireEvent.change(box, { target: { value: '@Dana Whitlock bay 3 was missed', selectionStart: 31 } })
    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }))
    await vi.waitFor(() => expect(db.rpcCalls.find((c) => c.name === 'task_note_post_tagged')?.args).toEqual({ p_instance_id: 'inst-1', p_body: '@Dana Whitlock bay 3 was missed', p_tagged: ['u-dana'] }))
    await vi.waitFor(() => expect(db.updates).toEqual([{ table: 'checklist_instances', row: { completed_at: null, completed_by_user_id: null } }]))
  })
})
