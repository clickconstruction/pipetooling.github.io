/**
 * The Legal desk's Evidence door's reads and writes (punch list #230 PR 5), against a stand-in client that applies each
 * query's own filters to a few made-up rows: what the load reads and joins, the refusal before the migration is pushed,
 * and the press, one .eml per email, past a row that fails.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { sentEmailCopyHtml } from '../../../supabase/functions/_shared/sentCopyEmail'
import { EVIDENCE_FROM_MESSAGES_WORDS, putPlan, sentItemKey } from './evidenceFromMessages'
import { DatabaseError } from '../../utils/errorHandling'

vi.mock('../supabase', () => ({ supabase: {} }))
const add = vi.hoisted(() => vi.fn())
vi.mock('./legalMatterDocumentsIo', async (orig) => ({ ...(await orig<typeof import('./legalMatterDocumentsIo')>()), addLegalMatterDocument: (...a: unknown[]) => add(...a) }))

import { loadEvidenceFromMessages, putEvidenceFromMessages } from './evidenceFromMessagesIo'

type Row = Record<string, unknown>
const state = {
  tables: {} as Record<string, Row[]>,
  errors: {} as Record<string, { code: string; message: string }>,
  objects: {} as Record<string, string | Uint8Array>,
  queries: [] as Array<{ table: string; ops: Array<[string, unknown[]]> }>,
}

function pass(r: Row, [op, args]: [string, unknown[]]): boolean {
  const [col, val] = args as [string, unknown]
  if (op === 'eq') return r[col] === val
  if (op === 'is') return (r[col] ?? null) === val
  if (op === 'in') return (val as unknown[]).includes(r[col])
  if (op === 'overlaps') return Array.isArray(r[col]) && (r[col] as unknown[]).some((x) => (val as unknown[]).includes(x))
  return true
}

const db = {
  from: (table: string) => {
    const q = { table, ops: [] as Array<[string, unknown[]]> }
    state.queries.push(q)
    let single = false
    const answer = () => {
      const error = state.errors[table] ?? null
      if (error) return { data: null, error, status: 400 }
      const rows = (state.tables[table] ?? []).filter((r) => q.ops.every((o) => pass(r, o)))
      return { data: single ? (rows[0] ?? null) : rows, error: null, status: 200 }
    }
    const builder: Record<string | symbol, unknown> = new Proxy(
      {},
      {
        get: (_t, prop) => {
          if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(answer())
          if (prop === 'maybeSingle') return () => { single = true; return builder }
          return (...args: unknown[]) => { q.ops.push([String(prop), args]); return builder }
        },
      },
    )
    return builder
  },
  storage: {
    from: (bucket: string) => ({
      list: async (folder: string, opts: { search: string }) => {
        const names = Object.keys(state.objects).filter((k) => k.startsWith(`${bucket}/${folder}/${opts.search}`))
        return { data: names.map((k) => ({ name: k.slice(`${bucket}/${folder}/`.length), metadata: { size: (state.objects[k] as Uint8Array | string).length } })), error: null }
      },
      download: async (path: string) => {
        const o = state.objects[`${bucket}/${path}`]
        if (o === undefined) return { data: null, error: Object.assign(new Error('Object not found'), { status: 400, statusCode: '404' }) }
        return { data: new Blob([o]), error: null }
      },
    }),
  },
} as unknown as SupabaseClient<Database>

const JOB = '11111111-1111-4111-8111-111111111111'
const BID = '33333333-3333-4333-8333-333333333333'
const SENT = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const FILED = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const msg = (id: string, over: Row): Row => ({ id, contact_id: 'c-dale', channel_id: 'ch-dale', bid_id: null, project_id: null, jobs_ledger_id: JOB, channel: 'email', direction: 'in', who_user_id: null, who_text: 'Dale Okafor <dale@ridgeway.example> to bids@', at: '2026-10-24T19:03:00Z', subject: 'Re: 4 Elm Ct water heater', body: 'Yes, go ahead with the 40.', mailbox: 'bids', mail_user_id: null, gmail_id: `g-${id}`, gmail_thread_id: 't-elm', rfc_message_id: `<${id}@x>`, ...over })

beforeEach(() => {
  add.mockReset()
  state.queries.length = 0
  state.errors = {}
  state.tables = {
    legal_matter_documents: [
      { id: 'd-1', matter_id: 'mat-1', source_message_id: 'm-1', original_name: 'Re 4 Elm Ct 1 of 3.eml', voided_at: null },
      { id: 'd-2', matter_id: 'mat-1', source_message_id: null, original_name: `sent-${SENT} Estimate.eml`, voided_at: '2026-10-30T00:00:00Z' },
      { id: 'd-3', matter_id: 'mat-other', source_message_id: 'm-2', original_name: 'x.eml', voided_at: null },
    ],
    messages: [
      msg('m-1', {}),
      msg('m-2', { direction: 'out', at: '2026-10-24T19:40:00Z', who_user_id: 'u-marisol', who_text: 'Marisol Vega <marisol@clickplumbing.example> to Dale Okafor <dale@ridgeway.example> · from Marisol Vega’s mail', mailbox: 'mine', mail_user_id: 'u-marisol' }),
      msg('m-3', { at: '2026-11-01T14:12:00Z', mailbox: 'mine', mail_user_id: 'u-marisol', who_text: 'Dale Okafor <dale@ridgeway.example> to Marisol Vega’s mail' }),
      // On the bid the job came from: the estimate's talk.
      msg('m-4', { jobs_ledger_id: null, bid_id: BID, gmail_thread_id: 't-bid', subject: 'Bid B482 questions', at: '2026-08-01T15:00:00Z' }),
      // Sent from the reply box: its copy is filed with the line as its source.
      msg('m-5', { direction: 'out', gmail_id: null, gmail_thread_id: null, rfc_message_id: null, who_text: '', who_user_id: 'u-rosa', mailbox: 'team', subject: 'Your invoice', at: '2026-10-10T15:00:00Z' }),
      // A text on the job, and an email on another job: neither is read.
      msg('m-6', { channel: 'text' }),
      msg('m-7', { jobs_ledger_id: '99999999-9999-4999-8999-999999999999' }),
    ],
    contacts: [{ id: 'c-dale', kind: 'customer', name: 'Dale Okafor' }],
    contact_channels: [{ id: 'ch-dale', value: 'dale@ridgeway.example' }],
    message_attachments: [{ id: 'f-1', message_id: 'm-1', sort_order: 0, kind: 'file', name: 'spec.pdf', mime: 'application/pdf', size_bytes: 8, bucket_path: 'g-m-1/0-spec.pdf', left_in_gmail: null, url: null }],
    users: [
      { id: 'u-marisol', name: 'Marisol Vega', email: 'marisol@clickplumbing.example' },
      { id: 'u-rosa', name: 'Rosa Diaz', email: 'rosa@clickplumbing.example' },
    ],
    bids: [{ id: BID, bid_number: 'B482', project_name: '4 Elm Ct', bid_due_date: null, bid_date_sent: null, outcome: 'won' }],
    sent_documents: [
      { id: SENT, kind: 'estimate_sent', title: 'Estimate 1044', how: 'email', recipient_name: 'Dale Okafor', recipient_emails: ['dale@ridgeway.example'], subject: 'Estimate 1044 sent', source_table: 'estimates', source_id: null, copy_path: `${SENT}/copy.html`, copy_type: 'text/html', copy_bytes: 300, copy_hash: 'h', attachments: [], sent_at: '2026-10-02T15:00:00Z', sent_by_name: 'Rosa Diaz', bid_id: null, job_ids: [JOB] },
      { id: FILED, kind: 'messages_email', title: 'Your invoice', how: 'email', recipient_name: 'Dale Okafor', recipient_emails: ['dale@ridgeway.example'], subject: 'Your invoice', source_table: 'messages', source_id: 'm-5', copy_path: `${FILED}/copy.html`, copy_type: 'text/html', copy_bytes: 300, copy_hash: 'h2', attachments: [], sent_at: '2026-10-10T15:00:00Z', sent_by_name: 'Rosa Diaz', bid_id: null, job_ids: [JOB] },
      { id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', kind: 'bill_pdf', title: 'Bill printed', how: 'print', recipient_name: '', recipient_emails: [], subject: '', source_table: '', source_id: null, copy_path: null, copy_type: '', copy_bytes: null, copy_hash: '', attachments: [], sent_at: '2026-10-03T15:00:00Z', sent_by_name: '', bid_id: null, job_ids: [JOB] },
    ],
    app_settings: [{ key: 'messages_boxes_v1', value_text: JSON.stringify({ bids: { address: 'bids@clickplumbing.example' }, team: { address: 'team@clickplumbing.example' } }) }],
  }
  state.objects = {
    'message-attachments/mine/m-3.eml': 'From: Dale Okafor <dale@ridgeway.example>\r\nSubject: Re: 4 Elm Ct water heater\r\n\r\nOwner wants the 50.',
    'message-attachments/g-m-1/0-spec.pdf': '%PDF-1.4',
    [`sent-documents/${SENT}/copy.html`]: sentEmailCopyHtml({ from: 'Click Plumbing <team@noreply.clicktooling.example>', to: ['dale@ridgeway.example'], subject: 'Estimate 1044 sent', html: '<p>Hi Dale,</p><p>Your estimate.</p>' }),
    [`sent-documents/${FILED}/copy.html`]: sentEmailCopyHtml({ from: 'Click Plumbing <team@noreply.clicktooling.example>', to: ['dale@ridgeway.example'], subject: 'Your invoice', html: '<p>Hi Dale,</p><p>Your invoice is attached.</p><p>Rosa</p>' }),
  }
})

const jobs = [{ id: JOB, hcp_number: 'J1077', click_number: null, job_name: '4 Elm Ct', status: 'billed', bid_id: BID }]

describe('loadEvidenceFromMessages', () => {
  it('reads the email on the account’s jobs and their bids, the app’s sends, what the matter holds and each raw copy', async () => {
    const data = await loadEvidenceFromMessages(db, { matterId: 'mat-1', jobs })
    expect(data.conversations.map((c) => [c.key, c.items.map((i) => i.key), c.jobWords])).toEqual([
      [`thread:t-elm|pipeline:${JOB}`, ['line:m-1', 'line:m-2', 'line:m-3'], 'J1077 · 4 Elm Ct'],
      ['line:m-5', ['line:m-5'], 'J1077 · 4 Elm Ct'],
      [`thread:t-bid|bid:${BID}`, ['line:m-4'], 'B482 · 4 Elm Ct'],
      [sentItemKey(SENT), [sentItemKey(SENT)], 'J1077 · 4 Elm Ct'],
    ])
    const elm = data.conversations[0]!
    expect(elm.provenance).toBe('read from bids@ · tagged by Marisol Vega from their mail')
    const first = elm.items[0]!
    expect(first.kind === 'line' && [first.line.contactAddress, first.line.files.map((f) => f.name)]).toEqual(['dale@ridgeway.example', ['spec.pdf']])
    // The reply box's email carries its filed copy; the copy is not a row of its own.
    const replyBox = data.conversations[1]!.items[0]!
    expect(replyBox.kind === 'line' && replyBox.line.filed?.id).toBe(FILED)
    // Only the matter's live documents count: the retired send and another matter's line do not.
    expect([...data.onMatter]).toEqual(['line:m-1'])
    expect(data.rawBytes).toEqual({ 'm-2': null, 'm-3': (state.objects['message-attachments/mine/m-3.eml'] as string).length })
    expect(data.ctx.boxes).toEqual({ team: 'team@clickplumbing.example', bids: 'bids@clickplumbing.example' })
    expect(data.people.users['u-marisol']?.name).toBe('Marisol Vega')
    const lineReads = state.queries.filter((q) => q.table === 'messages')
    expect(lineReads.map((q) => q.ops.filter(([op]) => op === 'eq' || op === 'in'))).toEqual([
      [['eq', ['channel', 'email']], ['in', ['jobs_ledger_id', [JOB]]]],
      [['eq', ['channel', 'email']], ['in', ['bid_id', [BID]]]],
    ])
  })

  it('says it waits for the push when the documents have no source line yet', async () => {
    state.errors.legal_matter_documents = { code: '42703', message: 'column legal_matter_documents.source_message_id does not exist' }
    await expect(loadEvidenceFromMessages(db, { matterId: 'mat-1', jobs })).rejects.toThrow(EVIDENCE_FROM_MESSAGES_WORDS.notPushed)
    expect(state.queries.some((q) => q.table === 'messages')).toBe(false)
  })
})

describe('putEvidenceFromMessages', () => {
  it('puts each ready email as an .eml with its line, past a row that fails, and names it', async () => {
    const data = await loadEvidenceFromMessages(db, { matterId: 'mat-1', jobs })
    const plan = putPlan([data.conversations[0]!, data.conversations[1]!, data.conversations[3]!], { onMatter: data.onMatter, rawBytes: data.rawBytes })
    expect(plan.button).toBe('Put 4 on the matter')
    add.mockImplementation(async (_db: unknown, _matter: string, draft: { title: string }) => {
      if (draft.title.includes('2 of 3')) throw new Error('Could not store the file: the bucket said no')
      return 'doc-new'
    })
    const outcome = await putEvidenceFromMessages(db, 'mat-1', plan, data)
    expect(outcome.done.map((d) => [d.key, d.copy])).toEqual([
      ['line:m-3', 'raw'],
      ['line:m-5', 'filed'],
      [sentItemKey(SENT), 'filed'],
    ])
    expect(outcome.failed).toEqual([{ key: 'line:m-2', title: 'Re: 4 Elm Ct water heater · 2 of 3 · Oct 24, 2026', reason: 'Could not store the file: the bucket said no' }])
    expect(outcome.held.map((h) => h.item.key)).toEqual(['line:m-1'])
    const calls = add.mock.calls as Array<[unknown, string, Record<string, unknown>, File]>
    // m-2 has no raw copy: its record is made, and its line says so.
    const m2 = calls.find((c) => c[2].sourceMessageId === 'm-2')!
    expect(m2[2].shows).toContain('The mail as received was not kept.')
    // m-3's file is the raw mail as received, byte for byte.
    const m3 = calls.find((c) => c[2].sourceMessageId === 'm-3')!
    expect([m3[1], m3[3].name, m3[3].type, await m3[3].text()]).toEqual(['mat-1', 'Re 4 Elm Ct water heater 3 of 3.eml', 'message/rfc822', state.objects['message-attachments/mine/m-3.eml']])
    expect(m3[2]).toMatchObject({ state: 'received', receivedOn: '2026-11-01', whose: 'theirs', shows: 'Email between Dale Okafor and Click Plumbing and Electrical on J1077 · 4 Elm Ct, as received.' })
    // The reply box's email is made from its filed copy, the page beside its words.
    const m5 = calls.find((c) => c[2].sourceMessageId === 'm-5')!
    const m5Text = await m5[3].text()
    expect(m5Text).toContain('From: Click Plumbing <team@noreply.clicktooling.example>')
    expect(m5Text).toContain('Content-Type: text/html; charset=utf-8')
    expect(m5[2]).toMatchObject({ state: 'sent', sent: { sentOn: '2026-10-10', sentHow: 'email', sentTo: 'Dale Okafor' }, whose: 'ours' })
    // The app's own send is named so the door knows it on the matter next time.
    const send = calls.find((c) => c[3].name.startsWith(`sent-${SENT}`))!
    expect(send[2]).toMatchObject({ sourceMessageId: null, state: 'sent' })
  })

  it('an email someone else put on while the window was open is named as already on the matter', async () => {
    const data = await loadEvidenceFromMessages(db, { matterId: 'mat-other', jobs })
    const plan = putPlan([data.conversations[0]!], { onMatter: new Set(), rawBytes: data.rawBytes })
    add.mockRejectedValueOnce(new DatabaseError('Failed to save the document: duplicate key value violates unique constraint "legal_matter_documents_one_per_line"', '23505', undefined, { status: 409 }))
    add.mockResolvedValue('doc-new')
    const outcome = await putEvidenceFromMessages(db, 'mat-other', plan, data)
    expect(outcome.failed).toEqual([{ key: 'line:m-1', title: 'Re: 4 Elm Ct water heater · 1 of 3 · Oct 24, 2026', reason: EVIDENCE_FROM_MESSAGES_WORDS.alreadyOn }])
    expect(outcome.done.map((d) => d.key)).toEqual(['line:m-2', 'line:m-3'])
  })

  it('a box-read mail carries its kept file inside', async () => {
    const data = await loadEvidenceFromMessages(db, { matterId: 'mat-other', jobs })
    const plan = putPlan([data.conversations[0]!], { onMatter: new Set(), rawBytes: data.rawBytes })
    add.mockResolvedValue('doc-new')
    await putEvidenceFromMessages(db, 'mat-other', { ...plan, ready: plan.ready.slice(0, 1) }, data)
    const [, , draft, file] = add.mock.calls[0] as [unknown, string, Record<string, unknown>, File]
    const text = await file.text()
    expect(draft).toMatchObject({ sourceMessageId: 'm-1', shows: 'Email between Dale Okafor and Click Plumbing and Electrical on J1077 · 4 Elm Ct, the app’s record of the mail as read from bids@.' })
    expect(text).toContain('Content-Disposition: attachment; filename="spec.pdf"')
    expect(text).toContain(Buffer.from('%PDF-1.4').toString('base64'))
    expect(text).toContain('To: bids@clickplumbing.example')
  })
})
