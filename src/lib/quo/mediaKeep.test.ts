import { describe, expect, it } from 'vitest'
import { KEEP_FILE_BYTES } from '../emailIn/emailLine'
import { QUO_NOT_COPIED, keepsCopy, mediaToKeep, quoMediaPlans, quoMediaRow } from './mediaKeep'

// The pictures a customer texts (quo-messages-mockup.html draft 8, spike/gc-mode), as events.test.ts's fixtures carry them.
const photo = { url: 'https://files.example/1.jpg', type: 'image/jpeg' }
const sink = { url: 'https://files.example/2.jpg', type: 'image/jpeg' }
const MESSAGE = 'd0000000-0000-4000-8000-000000000004'

describe('quoMediaPlans: what the webhook copies from a text', () => {
  it('names each of a text’s files by its kind and place, and puts it under the text’s Quo id', () => {
    expect(quoMediaPlans('MS-1', [photo, sink, { url: 'https://files.example/3.pdf', type: 'application/pdf' }])).toEqual([
      { sort_order: 0, url: photo.url, name: 'picture-1.jpg', mime: 'image/jpeg', bucket_path: 'quo/MS-1/1.jpg' },
      { sort_order: 1, url: sink.url, name: 'picture-2.jpg', mime: 'image/jpeg', bucket_path: 'quo/MS-1/2.jpg' },
      { sort_order: 2, url: 'https://files.example/3.pdf', name: 'file-3.pdf', mime: 'application/pdf', bucket_path: 'quo/MS-1/3.pdf' },
    ])
  })

  it('keeps a file of no known type with no ending, and a Quo id safe as a folder', () => {
    expect(quoMediaPlans('MS/../2 x', [{ url: 'https://files.example/blob', type: null }])).toEqual([
      { sort_order: 0, url: 'https://files.example/blob', name: 'file-1', mime: null, bucket_path: 'quo/MS____2_x/1' },
    ])
    expect(quoMediaPlans('MS-1', [])).toEqual([])
  })
})

describe('quoMediaRow: the row each file leaves on the line', () => {
  const plan = quoMediaPlans('MS-1', [photo])[0]!

  it('points at our copy when it read and fits an email’s cap', () => {
    expect(quoMediaRow(MESSAGE, plan, { ok: true, bytes: 412_000 })).toEqual({
      message_id: MESSAGE,
      sort_order: 0,
      kind: 'file',
      name: 'picture-1.jpg',
      mime: 'image/jpeg',
      size_bytes: 412_000,
      bucket_path: 'quo/MS-1/1.jpg',
      left_in_gmail: null,
    })
  })

  it('keeps a copy of what read and fits, and nothing else', () => {
    expect(keepsCopy({ ok: true, bytes: KEEP_FILE_BYTES })).toBe(true)
    expect(keepsCopy({ ok: true, bytes: KEEP_FILE_BYTES + 1 })).toBe(false)
    expect(keepsCopy({ ok: false })).toBe(false)
  })

  it('marks one too big to keep, or one that did not read, as not copied from Quo', () => {
    expect(quoMediaRow(MESSAGE, plan, { ok: true, bytes: KEEP_FILE_BYTES + 1 })).toMatchObject({ bucket_path: null, left_in_gmail: QUO_NOT_COPIED, size_bytes: KEEP_FILE_BYTES + 1 })
    expect(quoMediaRow(MESSAGE, plan, { ok: false })).toMatchObject({ bucket_path: null, left_in_gmail: QUO_NOT_COPIED, size_bytes: null })
  })
})

describe('mediaToKeep: Quo’s retry keeps nothing twice', () => {
  const plans = quoMediaPlans('MS-1', [photo, sink, { url: 'https://files.example/3.pdf', type: 'application/pdf' }])

  it('keeps every file of a text the line has no rows for', () => {
    expect(mediaToKeep(plans, []).map((p) => p.name)).toEqual(['picture-1.jpg', 'picture-2.jpg', 'file-3.pdf'])
  })

  it('leaves the files a first delivery already kept, by their place', () => {
    expect(mediaToKeep(plans, [0, 2]).map((p) => p.name)).toEqual(['picture-2.jpg'])
    expect(mediaToKeep(plans, new Set([0, 1, 2]))).toEqual([])
  })
})
