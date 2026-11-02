/**
 * The courtesy notice's reads and press (punch list #243, PR 1): opening the window makes no
 * Messages contact, a send by email alone makes none, and a send with a text makes the GC's
 * contact at the press through the office's own door, then texts the number on it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CourtesyFacts } from './lienCourtesyNotice'

const db = vi.hoisted(() => ({
  invokes: [] as { name: string; body: Record<string, unknown> }[],
  updates: [] as { table: string; patch: unknown; id: unknown }[],
  reads: [] as { table: string; id: unknown }[],
  customerInfo: null as unknown,
  textsOn: true,
  /** The GC's own contact, as the finder sees it: null when there is none. */
  foundContactId: null as string | null,
  contacts: {} as Record<string, { id: string; channels: { id: string; kind: 'phone' | 'email'; value: string; optedOutAt: string | null }[] }>,
  made: [] as string[],
  makeRefusal: null as string | null,
}))

vi.mock('../supabase', () => ({
  supabase: {
    functions: {
      invoke: async (name: string, { body }: { body: Record<string, unknown> }) => {
        db.invokes.push({ name, body })
        return name === 'quo-send' ? { data: { ok: true, messageId: 'q1' }, error: null } : { data: { success: true, resend_email_id: 're_1' }, error: null }
      },
    },
    from: (table: string) => ({
      select: () => ({
        eq: (_col: string, id: unknown) => ({
          maybeSingle: async () => {
            db.reads.push({ table, id })
            return { data: db.customerInfo == null ? null : { contact_info: db.customerInfo }, error: null }
          },
        }),
      }),
      update: (patch: unknown) => ({
        eq: async (_col: string, id: unknown) => {
          db.updates.push({ table, patch, id })
          return { data: null, error: null }
        },
      }),
    }),
  },
}))
vi.mock('../../utils/errorHandling', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/errorHandling')>()),
  withSupabaseRetry: async (op: () => PromiseLike<{ data: unknown; error: { message: string } | null }>) => {
    const r = await op()
    if (r.error) throw new Error(r.error.message)
    return r.data
  },
}))
vi.mock('../quo/textsSwitchIo', () => ({ supabaseTextsSwitchIo: () => ({ load: async () => db.textsOn }) }))
vi.mock('../messages/messagesIo', () => ({
  findCustomerContactId: async () => db.foundContactId,
  loadContact: async (id: string) => {
    const c = db.contacts[id]
    return c ? { id: c.id, kind: 'customer', name: 'Ridgeway Builders', goesBy: null, company: '', record: { kind: 'customer' }, channels: c.channels, jobIds: [], defaultJobId: null } : null
  },
  contactForCustomer: async (customerId: string) => {
    if (db.makeRefusal) throw new Error(db.makeRefusal)
    db.made.push(customerId)
    return 'c-new'
  },
}))

import { loadCourtesyRecipients, sendCourtesyNotice, type CourtesyRecipient } from './lienCourtesyIo'

const facts: CourtesyFacts = {
  jobNumber: '741',
  jobName: 'Riverbend Dental',
  propertyAddress: '2200 Riverbend Dr, Austin, TX 78704',
  county: 'Travis',
  gcName: 'Ridgeway Builders',
  claimantName: 'Click Plumbing and Electrical',
  claim: 4850,
  monthsWords: 'August 2026',
  noticeSentOn: '2026-10-14',
  lienDay: '2026-11-16',
  payLinks: [{ address: 'clicktooling.com/pay/8f3a', amount: 4850 }],
  contactPerson: 'R. Douglas, Master Plumber',
  phone: '(512) 555-0147',
}

const open = () => loadCourtesyRecipients({ gcCustomerId: 'cu-ridgeway', gcName: 'Ridgeway Builders', gcEmail: 'dortiz@ridgeway.example', ownerName: 'Cibolo Crossing Ltd', ownerEmail: '' })

const gc = (over: Partial<CourtesyRecipient> = {}): CourtesyRecipient => ({
  who: 'original_contractor',
  name: 'Ridgeway Builders',
  email: { address: 'dortiz@ridgeway.example', goes: true, reason: '' },
  text: { address: '(512) 555-0100', goes: true, reason: '' },
  contactId: null,
  textChannelId: null,
  ...over,
})
const owner: CourtesyRecipient = { who: 'owner', name: 'Cibolo Crossing Ltd', email: { address: '', goes: false, reason: 'no email on the property record' }, text: { address: '', goes: false, reason: 'no number on the property record' }, contactId: null, textChannelId: null }

const send = (recipients: CourtesyRecipient[]) => sendCourtesyNotice({ item: { id: 'it1', fields: {} }, jobId: 'j741', gcCustomerId: 'cu-ridgeway', facts, greeting: 'Hello Dana,', recipients, by: { userId: 'u1', name: 'Taunya' } })

beforeEach(() => {
  db.invokes = []
  db.updates = []
  db.reads = []
  db.customerInfo = null
  db.textsOn = true
  db.foundContactId = null
  db.contacts = {}
  db.made = []
  db.makeRefusal = null
})

describe('opening the window makes nothing', () => {
  it('a GC with no contact: the number on their record is planned for the text, no contact made, nothing to text from yet', async () => {
    db.customerInfo = { phone: '(512) 555-0100', email: 'office@ridgeway.example' }
    const [g, o] = await open()
    expect(db.made).toEqual([])
    expect(db.reads).toEqual([{ table: 'customers', id: 'cu-ridgeway' }])
    expect(g).toMatchObject({ who: 'original_contractor', email: { address: 'dortiz@ridgeway.example', goes: true }, text: { address: '(512) 555-0100', goes: true, reason: '' }, contactId: null, textChannelId: null })
    expect(o).toMatchObject({ who: 'owner', text: { goes: false } })
  })
  it('a GC with no contact and no number on their record: no text, and still nothing made', async () => {
    db.customerInfo = { email: 'office@ridgeway.example' }
    const [g] = await open()
    expect(db.made).toEqual([])
    expect(g!.text).toEqual({ address: '', goes: false, reason: 'no number on the job' })
  })
  it('a GC with a contact: its live number and channel are read, the record is not, and nothing is made', async () => {
    db.foundContactId = 'c1'
    db.contacts.c1 = { id: 'c1', channels: [{ id: 'p1', kind: 'phone', value: '(512) 555-0193', optedOutAt: null }] }
    const [g] = await open()
    expect(db.made).toEqual([])
    expect(db.reads).toEqual([])
    expect(g).toMatchObject({ text: { address: '(512) 555-0193', goes: true }, contactId: 'c1', textChannelId: 'p1' })
  })
})

describe('the press', () => {
  it('a send by email alone makes no contact', async () => {
    const r = await send([gc({ text: { address: '', goes: false, reason: 'no number on the job' } }), owner])
    expect(db.made).toEqual([])
    expect(db.invokes.map((i) => i.name)).toEqual(['send-lien-filing-email'])
    expect(r.record?.to).toEqual([expect.objectContaining({ channel: 'email', ok: true })])
    expect(db.updates).toHaveLength(1)
  })
  it('a send with a text makes the GC’s contact at the press and texts the number on it', async () => {
    db.contacts['c-new'] = { id: 'c-new', channels: [{ id: 'e-new', kind: 'email', value: 'office@ridgeway.example', optedOutAt: null }, { id: 'p-new', kind: 'phone', value: '512-555-0100', optedOutAt: null }] }
    const r = await send([gc(), owner])
    expect(db.made).toEqual(['cu-ridgeway'])
    const text = db.invokes.find((i) => i.name === 'quo-send')!
    expect(text.body).toMatchObject({ contactId: 'c-new', channelId: 'p-new', tie: { jobId: 'j741', column: 'jobs_ledger_id' } })
    expect(r.record?.to.map((t) => [t.channel, t.ok])).toEqual([['email', true], ['text', true]])
  })
  it('a GC who already has a contact is texted on it, and no second contact is made', async () => {
    await send([gc({ contactId: 'c1', textChannelId: 'p1' }), owner])
    expect(db.made).toEqual([])
    expect(db.invokes.find((i) => i.name === 'quo-send')!.body).toMatchObject({ contactId: 'c1', channelId: 'p1' })
  })
  it('a refusal to make the contact is the text’s reason; the email still goes and the record is written', async () => {
    db.makeRefusal = 'A training account cannot start a customer’s thread.'
    const r = await send([gc(), owner])
    expect(db.invokes.map((i) => i.name)).toEqual(['send-lien-filing-email'])
    expect(r.record?.to).toEqual([expect.objectContaining({ channel: 'email', ok: true }), expect.objectContaining({ channel: 'text', ok: false, reason: 'A training account cannot start a customer’s thread.' })])
  })
  it('a new contact that holds no number that can be texted names that as the reason', async () => {
    db.contacts['c-new'] = { id: 'c-new', channels: [{ id: 'e-new', kind: 'email', value: 'office@ridgeway.example', optedOutAt: null }] }
    const r = await send([gc(), owner])
    expect(db.made).toEqual(['cu-ridgeway'])
    expect(db.invokes.map((i) => i.name)).toEqual(['send-lien-filing-email'])
    expect(r.record?.to[1]).toMatchObject({ channel: 'text', ok: false, reason: 'their Messages contact holds no number that can be texted' })
  })
})
