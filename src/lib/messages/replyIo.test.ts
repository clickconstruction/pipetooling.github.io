import { beforeEach, describe, expect, it, vi } from 'vitest'

const sent = vi.hoisted(() => ({ calls: [] as Array<[string, Record<string, unknown>]> }))

vi.mock('../supabase', () => ({
  supabase: {
    functions: {
      invoke: (name: string, opts: { body: Record<string, unknown> }) => {
        sent.calls.push([name, opts.body])
        return Promise.resolve({ data: { ok: true, messageId: 'm-sent-1' }, error: null })
      },
    },
  },
}))

import type { EmailFileAsk } from '../documents/emailFileAsks'
import { supabaseReplyIo } from './replyIo'

const io = supabaseReplyIo({ addNote: vi.fn() })
const email = {
  contactId: '0f6a3c2e-1b7d-4e55-9a0c-3f2b8d1e4a01',
  channelId: '7c1d9e44-2a6b-4f03-8e5d-6b0a2c9f1d02',
  jobKey: 'bid:b3e8f0a1-9c2d-4e7f-a6b5-1d0c3e2f4a03',
  draft: { subject: 'Boerne Retail Shell: addendum 2 and the plans', greeting: 'Greg,', body: 'Here is addendum 2.', signature: ['Rosa'], footer: 'Click Construction.' },
}

beforeEach(() => {
  sent.calls.length = 0
})

describe('an email from the reply box (cut 3, its files cut 7e)', () => {
  it('sends the words alone as before when it has no files', async () => {
    await expect(io.sendEmail(email)).resolves.toBe('m-sent-1')
    expect(sent.calls[0]![0]).toBe('messages-email')
    expect(sent.calls[0]![1]).not.toHaveProperty('files')
    expect(sent.calls[0]![1]).toMatchObject({ subject: email.draft.subject, tie: { column: 'bid_id' } })
  })

  it('sends its files as the function takes them', async () => {
    const files: EmailFileAsk[] = [{ key: 'drive:drv-addendum-2', source: 'drive', ref: 'drvAddendum2000', path: null, name: 'Addendum 2.pdf', mime: '', way: 'file', page: null }]
    await io.sendEmail({ ...email, files })
    expect(sent.calls[0]![1].files).toEqual(files)
    await io.sendEmail({ ...email, files: [] })
    expect(sent.calls[1]![1]).not.toHaveProperty('files')
  })
})
