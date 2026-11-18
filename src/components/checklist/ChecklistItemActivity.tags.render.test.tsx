// @vitest-environment jsdom
/**
 * Tagging a teammate in a task note (punch list #375): the task's own people are offered before a
 * letter is typed, a note that tags someone posts with its tags in one call, a note that tags
 * nobody goes in as it always did, and a posted note that carries a tag draws its chip and who it
 * waits on. The rules live in src/lib/jobs/noteTags.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

const TAGGABLE = [
  { user_id: 'u-dana', name: 'Dana Whitlock', role: 'assistant', on_task: true, gave: true },
  { user_id: 'u-bell', name: 'Chris Bell', role: 'assistant', on_task: false, gave: false },
  { user_id: 'u-marcus', name: 'Marcus Hale', role: 'master_technician', on_task: false, gave: false },
]

/** What the stubbed database holds and what was asked of it. */
const db = vi.hoisted(() => ({
  role: 'dev' as string,
  taggable: null as unknown[] | null,
  taggableError: null as { code: string; message: string } | null,
  tagRows: [] as unknown[],
  rpcCalls: [] as Array<{ name: string; args: unknown }>,
  inserts: [] as Array<{ table: string; row: unknown }>,
  notices: [] as unknown[],
}))

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as unknown as { from: (t: string) => unknown; rpc: (n: string, a?: unknown) => unknown; functions: { invoke: (n: string, o?: { body?: unknown }) => Promise<unknown> } }
  const rpc = stub.rpc.bind(stub)
  const DATA: Record<string, () => unknown[]> = {
    checklist_instances: () => [{ id: 'inst-1', scheduled_date: '2026-11-17', completed_at: null }],
    checklist_instance_events: () => [
      { id: 'ev-1', instance_id: 'inst-1', event_type: 'comment', actor_user_id: 'u-dana', body: 'Which bay first? @Luis Ortega', created_at: '2026-11-17T15:00:00Z', percent: null },
    ],
    checklist_item_due_changes: () => [],
    users: () => [{ id: 'u-dana', name: 'Dana Whitlock' }],
    task_note_tags: () => db.tagRows,
  }
  const rows = (table: string) => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'lte', 'gt', 'order', 'limit']) b[m] = () => b
    // The plain insert hands its new row's id back, which the phone notice is asked for by.
    b.insert = (row: unknown) => {
      db.inserts.push({ table, row })
      return { select: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 'ev-plain' }, error: null }) }) }
    }
    b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: (DATA[table] ?? (() => []))(), error: null }).then(ok)
    return b
  }
  stub.from = (table: string) => rows(table)
  stub.rpc = (name: string, args?: unknown) => {
    db.rpcCalls.push({ name, args })
    if (name === 'task_note_taggable') return Promise.resolve(db.taggableError ? { data: null, error: db.taggableError } : { data: db.taggable ?? TAGGABLE, error: null })
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
  useOptionalAuth: () => ({ role: db.role, user: { id: 'u-luis' } }),
}))

import { ChecklistItemActivity } from './ChecklistItemActivity'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const ITEM = { id: 'item-1', title: 'Sweep the shop bays', created_at: '2026-11-14T15:00:00Z', created_by_user_id: 'u-dana' }

async function mount() {
  const onPosted = vi.fn()
  const setError = vi.fn()
  renderWithProviders(<ChecklistItemActivity item={ITEM} authUserId="u-luis" showInstanceDays={false} setError={setError} commentInstanceId="inst-1" onPosted={onPosted} />)
  const box = (await screen.findByLabelText('Add a note to Sweep the shop bays')) as HTMLTextAreaElement
  return { box, onPosted, setError }
}

function type(box: HTMLElement, value: string) {
  fireEvent.change(box, { target: { value, selectionStart: value.length } })
}

beforeEach(() => {
  db.role = 'dev'
  db.taggable = null
  db.taggableError = null
  db.tagRows = []
  db.rpcCalls.length = 0
  db.inserts.length = 0
  db.notices.length = 0
})

describe('ChecklistItemActivity, tagging a teammate', () => {
  it('offers the task\'s own people before a letter is typed, and posts a tagged note in one call', async () => {
    const { box, onPosted } = await mount()
    // The names were read for the day row the note lands on.
    await vi.waitFor(() => expect(db.rpcCalls.some((c) => c.name === 'task_note_taggable' && (c.args as { p_instance_id: string }).p_instance_id === 'inst-1')).toBe(true))
    const offer = await vi.waitFor(() => {
      const el = document.querySelector('[data-note-tag-offer] [data-note-tag-press]') as HTMLElement | null
      expect(el).toBeTruthy()
      return el!
    })
    // Only the task's own people are offered cold. The office waits for an @.
    expect([...document.querySelectorAll('[data-note-tag-offer] [data-note-tag-press]')].map((el) => el.textContent)).toEqual(['@Dana Whitlockgave this task'])
    fireEvent.pointerDown(offer)
    await vi.waitFor(() => expect(box.value).toBe('@Dana Whitlock '))
    expect(document.querySelector('[data-note-tag-mark] [data-mark="tag"]')?.textContent).toBe('@Dana Whitlock')
    type(box, '@Dana Whitlock bay 2 or bay 3?')
    fireEvent.keyDown(box, { key: 'Enter' })
    await vi.waitFor(() => expect(db.rpcCalls.find((c) => c.name === 'task_note_post_tagged')?.args).toEqual({ p_instance_id: 'inst-1', p_body: '@Dana Whitlock bay 2 or bay 3?', p_tagged: ['u-dana'] }))
    // The note went through the one call, not the plain insert as well.
    expect(db.inserts).toEqual([])
    await vi.waitFor(() => expect(onPosted).toHaveBeenCalledWith('inst-1', '@Dana Whitlock bay 2 or bay 3?'))
    await vi.waitFor(() => expect(box.value).toBe(''))
    // The phone notice is asked for by the note's id. The function writes the words.
    expect(db.notices).toEqual([{ task_event_id: 'ev-new' }])
  })

  it('opens the row of names on @, the task\'s people first, and Enter picks', async () => {
    const { box } = await mount()
    await vi.waitFor(() => expect(document.querySelector('[data-note-tag-offer]')).toBeTruthy())
    type(box, 'ask @')
    await vi.waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(3))
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['@Dana Whitlockgave this task', '@Chris Belloffice', '@Marcus Haleoffice'])
    type(box, 'ask @chr')
    await vi.waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1))
    fireEvent.keyDown(box, { key: 'Enter' })
    await vi.waitFor(() => expect(box.value).toBe('ask @Chris Bell '))
    // Enter picked a name. It did not post.
    expect(db.rpcCalls.some((c) => c.name === 'task_note_post_tagged')).toBe(false)
    expect(db.inserts).toEqual([])
  })

  it('posts a note that tags nobody the way it always has', async () => {
    const { box, onPosted } = await mount()
    type(box, 'Bay 2 is done. @dana knows')
    fireEvent.keyDown(box, { key: 'Enter' })
    await vi.waitFor(() => expect(db.inserts).toEqual([{ table: 'checklist_instance_events', row: { instance_id: 'inst-1', event_type: 'comment', actor_user_id: 'u-luis', body: 'Bay 2 is done. @dana knows' } }]))
    expect(db.rpcCalls.some((c) => c.name === 'task_note_post_tagged')).toBe(false)
    await vi.waitFor(() => expect(onPosted).toHaveBeenCalled())
    // A plain note can answer a tag that waited on its writer, so it asks for the notice too.
    expect(db.notices).toEqual([{ task_event_id: 'ev-plain' }])
  })

  it('draws the chip and who it waits on, on a note that carries a tag', async () => {
    db.tagRows = [{ event_id: 'ev-1', tagged_user_id: 'u-luis', tagged_name: 'Luis Ortega', tagger_user_id: 'u-dana', created_at: '2026-11-17T15:00:00Z', cleared_at: null, cleared_how: null }]
    await mount()
    await vi.waitFor(() => expect(document.querySelector('[data-note-tag-chip]')?.textContent).toBe('@Luis Ortega'))
    expect(document.querySelector('[data-note-tag-words]')?.textContent).toMatch(/^waiting on you/)
  })

  it('is a plain box for a role the @ is not open to yet, and asks for no names', async () => {
    db.role = 'subcontractor'
    const { box } = await mount()
    expect(screen.queryByLabelText('Tag a teammate')).toBeNull()
    type(box, 'ask @')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(db.rpcCalls.some((c) => c.name === 'task_note_taggable')).toBe(false)
  })

  it('is a plain box for someone the task\'s list refuses, with no error drawn', async () => {
    db.taggableError = { code: '42501', message: "Only the office and this task's own people can tag a teammate on it" }
    const { box, setError } = await mount()
    await vi.waitFor(() => expect(db.rpcCalls.some((c) => c.name === 'task_note_taggable')).toBe(true))
    await vi.waitFor(() => expect(screen.queryByLabelText('Tag a teammate')).toBeNull())
    type(box, 'ask @')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(setError).not.toHaveBeenCalled()
  })
})
