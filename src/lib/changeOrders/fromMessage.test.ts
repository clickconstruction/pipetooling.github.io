import { describe, expect, it } from 'vitest'
import type { UserRole } from '../../hooks/useAuth'
import { plainWordsFailures } from '../plainWords'
import {
  becameChip,
  draftFromMessage,
  fromMessageLine,
  sendRecord,
  sendRecordLines,
  whoMayDraft,
  whoMaySend,
  type ChangeOrderJob,
  type ChangeOrderSendRow,
  type MessageContact,
  type SourceMessage,
} from './fromMessage'

// The prototype v1.178's Priya, a customer on Helotes Dental Office, who has signed change order 1 and texts to ask for
// a sink in exam 3: change order 2's start. Demo people only.
const PRIYA: MessageContact = { id: 'priya', kind: 'customer', name: 'Dr. Priya Raman', first: 'Priya' }
const GREG: MessageContact = { id: 'greg', kind: 'trade', name: 'Greg Paulk', first: 'Greg' }

const HELOTES: ChangeOrderJob = { id: 'helotes', name: 'Helotes Dental Office', stage: 'buyout', lostOn: null, changeOrders: [{ number: 1 }] }

/** Mon Sep 28 2026, 4:40 PM Central. */
const SINK: SourceMessage = {
  id: 'msg-sink',
  contactId: 'priya',
  jobId: 'helotes',
  channel: 'text',
  direction: 'in',
  at: '2026-09-28T21:40:00Z',
  body: 'Can we add a sink in exam 3? Same as the one in exam 2.',
}

describe('a change order started from Priya’s text', () => {
  it('drafts it on the job the text is tied to, signed by Priya, the text kept as its source', () => {
    expect(draftFromMessage(SINK, PRIYA, [HELOTES])).toEqual({
      ok: true,
      order: {
        projectId: 'helotes',
        jobName: 'Helotes Dental Office',
        draft: {
          description: 'Can we add a sink in exam 3? Same as the one in exam 2.',
          reason: 'owner',
          schedule: '',
          packageId: null,
          cost: 0,
          price: 0,
          days: 0,
        },
        signer: { contactId: 'priya', name: 'Dr. Priya Raman' },
        sourceMessageId: 'msg-sink',
        nextNumber: 2,
      },
    })
  })

  it('puts the chip on the text and the line back on the order', () => {
    expect(becameChip(2)).toBe('became CO 2')
    expect(fromMessageLine(SINK, PRIYA)).toBe("From Priya's text on Mon Sep 28.")
    expect(fromMessageLine({ ...SINK, channel: 'note', direction: 'team' }, PRIYA)).toBe('From a team note on Mon Sep 28.')
    expect(fromMessageLine({ ...SINK, channel: 'portal' }, PRIYA)).toBe("From Priya's message in the portal on Mon Sep 28.")
  })

  it('cuts a long message at a word, for the office to finish', () => {
    const long = { ...SINK, body: `${'Please add a sink to exam 3 '.repeat(8)}\nSecond line.` }
    const result = draftFromMessage(long, PRIYA, [HELOTES])
    const description = result.ok ? result.order.draft.description : ''
    expect(description.length).toBeLessThanOrEqual(161)
    expect(description.endsWith('…')).toBe(true)
    expect(description.includes('Second line')).toBe(false)
  })

  it('numbers the first change order on a job one', () => {
    const result = draftFromMessage(SINK, PRIYA, [{ ...HELOTES, changeOrders: [] }])
    expect(result.ok && result.order.nextNumber).toBe(1)
  })
})

describe('the refusals', () => {
  it('refuse a message with no job, or tied to a job that is not theirs', () => {
    const words = 'Tie the message to a job first. A change order belongs to one job.'
    expect(draftFromMessage({ ...SINK, jobId: null }, PRIYA, [HELOTES])).toEqual({ ok: false, why: 'no job', words })
    expect(draftFromMessage({ ...SINK, jobId: 'boerne' }, PRIYA, [HELOTES])).toEqual({ ok: false, why: 'no job', words })
  })

  it('refuse a message with someone who is not a customer', () => {
    expect(draftFromMessage({ ...SINK, contactId: 'greg' }, GREG, [HELOTES])).toEqual({
      ok: false,
      why: 'not a customer',
      words: 'A change order goes to a customer. This message is with a trade partner.',
    })
  })

  it('refuse a job still bidding, or lost', () => {
    expect(draftFromMessage(SINK, PRIYA, [{ ...HELOTES, stage: 'pursuing' }])).toEqual({
      ok: false,
      why: 'not won',
      words: 'A change order needs a job we won. Helotes Dental Office is still bidding.',
    })
    expect(draftFromMessage(SINK, PRIYA, [{ ...HELOTES, lostOn: '2026-09-29' }])).toMatchObject({
      ok: false,
      why: 'not won',
      words: 'A change order needs a job we won. Helotes Dental Office was lost.',
    })
  })
})

describe('plain words', () => {
  it('hold on every refusal', () => {
    const contacts: MessageContact[] = (['customer', 'trade', 'arch', 'unknown'] as const).map((kind) => ({ ...PRIYA, kind }))
    const results = [
      ...contacts.map((c) => draftFromMessage(SINK, c, [HELOTES])),
      draftFromMessage({ ...SINK, jobId: null }, PRIYA, [HELOTES]),
      draftFromMessage(SINK, PRIYA, [{ ...HELOTES, stage: 'pursuing' }]),
      draftFromMessage(SINK, PRIYA, [{ ...HELOTES, lostOn: '2026-09-29' }]),
    ]
    expect(results.flatMap((r) => (r.ok ? [] : plainWordsFailures(r.words)))).toEqual([])
  })
})

describe('who may', () => {
  const roles: UserRole[] = ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'superintendent', 'subcontractor', 'helpers', 'primary']

  it('lets anyone in the office draft one, and only the money team send it', () => {
    expect(roles.filter(whoMayDraft)).toEqual(['dev', 'master_technician', 'assistant', 'controller', 'estimator'])
    expect(roles.filter(whoMaySend)).toEqual(['dev', 'master_technician', 'controller'])
    expect(whoMayDraft(null)).toBe(false)
    expect(whoMaySend(undefined)).toBe(false)
  })
})

describe('the send record, as our contract’s send keeps it', () => {
  const sent: ChangeOrderSendRow = {
    change_order_id: 'co-2-row',
    project_id: 'helotes',
    customer_id: 'helotes-dental',
    sent_on: '2026-09-30',
    sent_by: 'user-rosa',
    sign_by: '2026-10-07',
    note: 'The sink in exam 3, as you asked.',
    file_name: 'Change order 2.pdf',
    file_path: 'helotes/change-order-2.pdf',
    file_sha256: 'a'.repeat(64),
    signed_on: null,
    signer_printed_name: null,
    signer_signature_storage_path: null,
    signer_consented_at: null,
    signer_ip: null,
    signer_user_agent: null,
  }

  it('reads a send waiting on their signature', () => {
    const record = sendRecord(sent, { link: 'click.co/c/helotes#co-2', openedAt: null })
    expect(record).toEqual({
      sent: { on: '2026-09-30', by: 'user-rosa', signBy: '2026-10-07' },
      link: 'click.co/c/helotes#co-2',
      opened: null,
      signed: null,
      name: null,
      signature: null,
      consent: null,
    })
    expect(sendRecordLines(record)).toEqual([
      'Sent Wed Sep 30, to sign by Wed Oct 7.',
      'Their link: click.co/c/helotes#co-2',
      'Not opened yet.',
      'Not signed yet.',
    ])
  })

  it('reads a signed one: opened, signed, the name, the signature, the consent', () => {
    const signed: ChangeOrderSendRow = {
      ...sent,
      signed_on: '2026-10-02',
      signer_printed_name: 'Priya Raman',
      signer_signature_storage_path: 'helotes/co-2-signature.png',
      signer_consented_at: '2026-10-02T15:02:00Z',
      signer_ip: '203.0.113.7',
      signer_user_agent: 'Safari',
    }
    const record = sendRecord(signed, { link: null, openedAt: '2026-10-01T14:14:00Z' })
    expect(record.consent).toEqual({ at: '2026-10-02T15:02:00Z', ip: '203.0.113.7', userAgent: 'Safari' })
    const lines = sendRecordLines(record)
    expect(lines).toEqual([
      'Sent Wed Sep 30, to sign by Wed Oct 7.',
      'Opened Thu Oct 1 at 9:14 AM.',
      'Signed Fri Oct 2 as Priya Raman.',
      'Their signature is kept with it.',
      'They agreed to sign electronically Fri Oct 2 at 10:02 AM.',
    ])
    expect(lines.flatMap((l) => plainWordsFailures(l))).toEqual([])
  })
})
