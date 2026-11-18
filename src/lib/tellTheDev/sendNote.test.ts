import { beforeEach, describe, expect, it, vi } from 'vitest'

const insert = vi.hoisted(() => vi.fn())
const invoke = vi.hoisted(() => vi.fn(async () => ({ data: null, error: null })))
const changed = vi.hoisted(() => vi.fn())

vi.mock('../supabase', () => ({
  supabase: { from: () => ({ insert }), functions: { invoke } },
}))
vi.mock('../helpFeedbackHelpers', () => ({ notifyHelpFeedbackChanged: changed }))

import { sendDevNote } from './sendNote'
import { buildNoteContext } from './noteContext'

const context = buildNoteContext(
  { pageLabel: 'Jobs · Stages', windowTitle: null, role: 'assistant', training: false, twin: false, viewingAs: false, isPhone: false, width: 1440, height: 900, modes: [], appVersion: 'v2.0001', door: 'wrench', trouble: { errors: [], refused: [] } },
  1,
)
const base = { fromUserId: 'u1', pageKey: 'jobs:stages', pagePath: '/jobs?tab=stages', context }

beforeEach(() => {
  insert.mockReset()
  insert.mockResolvedValue({ data: null, error: null })
  invoke.mockClear()
  changed.mockClear()
})

describe('sendDevNote', () => {
  it('writes the note whole, with the start’s words, the page and the state', async () => {
    const { id } = await sendDevNote({ ...base, kind: 'want', typed: 'a search box' })
    expect(insert).toHaveBeenCalledTimes(1)
    expect(insert.mock.calls[0]![0]).toMatchObject({ id, from_user_id: 'u1', kind: 'want', body: 'I want a search box', page_key: 'jobs:stages', page_path: '/jobs?tab=stages' })
    expect(insert.mock.calls[0]![0].context).toMatchObject({ page_label: 'Jobs · Stages' })
    expect(changed).toHaveBeenCalledTimes(1)
  })

  it('refuses I want with no words before anything is written', async () => {
    await expect(sendDevNote({ ...base, kind: 'want', typed: '  ' })).rejects.toThrow('Say what you want first.')
    expect(insert).not.toHaveBeenCalled()
  })

  it('pushes the dev for a fault, and for nothing else', async () => {
    const { id } = await sendDevNote({ ...base, kind: 'broken', typed: '' })
    expect(insert.mock.calls[0]![0]).toMatchObject({ kind: 'broken', body: '' })
    expect(invoke).toHaveBeenCalledWith('notify-help-feedback', { body: { help_feedback_id: id } })
    invoke.mockClear()
    await sendDevNote({ ...base, kind: 'confusing', typed: '' })
    await sendDevNote({ ...base, kind: 'want', typed: 'a thing' })
    expect(invoke).not.toHaveBeenCalled()
  })

  it('counts a resend that meets its own row as sent', async () => {
    insert.mockResolvedValue({ data: null, error: { message: 'duplicate key value violates unique constraint "help_feedback_pkey"', code: '23505' } })
    await expect(sendDevNote({ ...base, kind: 'confusing', typed: '' })).resolves.toMatchObject({ id: expect.any(String) })
  })

  it('hands on any other refusal', async () => {
    insert.mockResolvedValue({ data: null, error: { message: 'new row violates row-level security policy', code: '42501' } })
    await expect(sendDevNote({ ...base, kind: 'confusing', typed: '' })).rejects.toThrow()
    expect(changed).not.toHaveBeenCalled()
  })
})
